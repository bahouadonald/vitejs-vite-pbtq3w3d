// api/webhook-geniuspay.js
// Reçoit les notifications de paiement de GeniusPay. Quand un paiement réussit
// (payment.success), crédite les Oscart de l'utilisateur dans Firestore.
//
// SÉCURITÉ : vérifie la signature HMAC-SHA256 du webhook avant de traiter.
//
// PRÉREQUIS — variables d'environnement Vercel :
//   GENIUSPAY_WEBHOOK_SECRET = whsec_sandbox_... (puis whsec_live_...)
//   FIREBASE_PROJECT_ID      = drop-platform-68cbc
//   FIREBASE_API_KEY         = (la clé web de ton app Firebase, déjà publique)
//
// Déploiement : place ce fichier dans "api/" à la racine du projet.

import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

// Lire le corps brut de la requête (nécessaire pour vérifier la signature)
async function lireCorpsBrut(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const corpsBrut = await lireCorpsBrut(req);
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const event = req.headers['x-webhook-event'];

    const SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET;
    if (!SECRET) return res.status(500).json({ error: 'Webhook secret non configuré' });

    // 1. Vérifier la signature : HMAC-SHA256(timestamp + "." + payload, secret)
    const donnee = `${timestamp}.${corpsBrut}`;
    const signatureAttendue = crypto.createHmac('sha256', SECRET).update(donnee).digest('hex');
    if (signature !== signatureAttendue) {
      return res.status(401).json({ error: 'Signature invalide' });
    }
    // 2. Protection rejeu (5 min)
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      return res.status(400).json({ error: 'Timestamp trop ancien' });
    }

    const payload = JSON.parse(corpsBrut);

    // 3. On ne traite que les paiements réussis
    if (event !== 'payment.success' && payload.event !== 'payment.success') {
      return res.status(200).json({ ok: true, ignore: true });
    }

    const meta = payload.data?.metadata || {};
    const reference0 = payload.data?.reference || '';

    // 3bis. Paiement direct d'un téléchargement (pas de recharge Oscart)
    if (meta.type === 'telechargement_direct') {
      return await traiterTelechargementDirect(meta, reference0, res);
    }
    // 3ter. Paiement direct d'une réservation / pré-téléchargement (pas de recharge Oscart)
    if (meta.type === 'reservation_directe') {
      return await traiterReservationDirecte(meta, reference0, res);
    }

    if (meta.type !== 'recharge_oscart' || !meta.uid || !meta.oscart) {
      return res.status(200).json({ ok: true, ignore: 'pas une recharge' });
    }

    const uid = meta.uid;
    const oscartAcrediter = parseInt(meta.oscart, 10);
    const reference = payload.data?.reference || '';

    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    // 4. Anti-doublon : si cette référence a déjà été créditée, on s'arrête
    const dejaUrl = `${baseUrl}/recharges_traitees/${reference}?key=${KEY}`;
    const dejaResp = await fetch(dejaUrl);
    if (dejaResp.ok) {
      return res.status(200).json({ ok: true, ignore: 'déjà traité' });
    }

    // 5. Trouver le solde de l'utilisateur (collection coins_solde, champ uid)
    const queryResp = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'coins_solde' }],
          where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
          limit: 1,
        },
      }),
    });
    const resultats = await queryResp.json();
    const docTrouve = Array.isArray(resultats) ? resultats.find(r => r.document) : null;

    if (docTrouve && docTrouve.document) {
      // Mettre à jour le solde existant
      const nomDoc = docTrouve.document.name;
      const soldeActuel = parseInt(docTrouve.document.fields?.solde?.integerValue || '0', 10);
      const nouveauSolde = soldeActuel + oscartAcrediter;
      await fetch(`https://firestore.googleapis.com/v1/${nomDoc}?key=${KEY}&updateMask.fieldPaths=solde`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { solde: { integerValue: String(nouveauSolde) } } }),
      });
    } else {
      // Créer un solde si l'utilisateur n'en a pas encore
      await fetch(`${baseUrl}/coins_solde?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: {
          uid: { stringValue: uid },
          solde: { integerValue: String(oscartAcrediter) },
        } }),
      });
    }

    // 6. Marquer cette référence comme traitée (anti-doublon)
    await fetch(`${baseUrl}/recharges_traitees?documentId=${reference}&key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        reference: { stringValue: reference },
        uid: { stringValue: uid },
        oscart: { integerValue: String(oscartAcrediter) },
        traiteLe: { stringValue: new Date().toISOString() },
      } }),
    });

    return res.status(200).json({ ok: true, credite: oscartAcrediter });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}

// Crédite des kiffs à un utilisateur (celui qui télécharge ou réserve obtient
// toujours des kiffs — règle : 1 Oscart équivalent = 250 kiffs), qu'il ait payé
// avec son solde Oscart ou directement en devise.
async function crediterKiffs(uid, kiffsGagnes, baseUrl, KEY) {
  const queryResp = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'coins_solde' }],
        where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
        limit: 1,
      },
    }),
  });
  const resultats = await queryResp.json();
  const docTrouve = Array.isArray(resultats) ? resultats.find(r => r.document) : null;

  if (docTrouve && docTrouve.document) {
    const nomDoc = docTrouve.document.name;
    const kiffsActuels = parseInt(docTrouve.document.fields?.kiffsDispo?.integerValue || '0', 10);
    await fetch(`https://firestore.googleapis.com/v1/${nomDoc}?key=${KEY}&updateMask.fieldPaths=kiffsDispo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { kiffsDispo: { integerValue: String(kiffsActuels + kiffsGagnes) } } }),
    });
  } else {
    await fetch(`${baseUrl}/coins_solde?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        uid: { stringValue: uid },
        solde: { integerValue: '0' },
        kiffsDispo: { integerValue: String(kiffsGagnes) },
      } }),
    });
  }
}

// Paiement direct d'un téléchargement (en devise, sans passer par le solde Oscart) :
// active le téléchargement sur la vente concernée et crédite les kiffs de l'acheteur,
// exactement comme pour un kiffement (règle : 1 Oscart équivalent = 250 kiffs).
async function traiterTelechargementDirect(meta, reference, res) {
  try {
    if (!meta.venteId || !meta.uid) {
      return res.status(200).json({ ok: true, ignore: 'paramètres manquants' });
    }

    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    // Anti-doublon : si cette référence a déjà été traitée, on s'arrête
    const dejaUrl = `${baseUrl}/paiements_traites/${reference}?key=${KEY}`;
    const dejaResp = await fetch(dejaUrl);
    if (dejaResp.ok) {
      return res.status(200).json({ ok: true, ignore: 'déjà traité' });
    }

    const uid = meta.uid;
    const venteId = meta.venteId;
    const prixOscart = parseInt(meta.prixOscart, 10) || 0;
    const kiffsGagnes = prixOscart * 250;

    // 1. Activer le téléchargement sur la vente
    await fetch(`${baseUrl}/ventes/${venteId}?key=${KEY}&updateMask.fieldPaths=dlActive&updateMask.fieldPaths=statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        dlActive: { booleanValue: true },
        statut: { stringValue: 'paid' },
      } }),
    });

    // 2. Créditer les kiffs de l'acheteur (celui qui télécharge obtient toujours des kiffs)
    await crediterKiffs(uid, kiffsGagnes, baseUrl, KEY);

    // 3. Marquer cette référence comme traitée (anti-doublon)
    if (reference) {
      await fetch(`${baseUrl}/paiements_traites?documentId=${reference}&key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: {
          reference: { stringValue: reference },
          uid: { stringValue: uid },
          venteId: { stringValue: venteId },
          type: { stringValue: 'telechargement_direct' },
          traiteLe: { stringValue: new Date().toISOString() },
        } }),
      });
    }

    return res.status(200).json({ ok: true, dlActive: true, kiffsGagnes });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur (téléchargement direct)' });
  }
}

// Paiement direct d'une réservation / pré-téléchargement de sortie officielle
// (en devise, sans passer par le solde Oscart) : confirme la réservation,
// incrémente le compteur de la sortie et crédite les kiffs de l'acheteur.
async function traiterReservationDirecte(meta, reference, res) {
  try {
    if (!meta.reservationId || !meta.sortieId || !meta.uid) {
      return res.status(200).json({ ok: true, ignore: 'paramètres manquants' });
    }

    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    // Anti-doublon : si cette référence a déjà été traitée, on s'arrête
    const dejaUrl = `${baseUrl}/paiements_traites/${reference}?key=${KEY}`;
    const dejaResp = await fetch(dejaUrl);
    if (dejaResp.ok) {
      return res.status(200).json({ ok: true, ignore: 'déjà traité' });
    }

    const uid = meta.uid;
    const reservationId = meta.reservationId;
    const sortieId = meta.sortieId;
    const prixOscart = parseInt(meta.prixOscart, 10) || 0;
    const kiffsGagnes = prixOscart * 250;

    // 1. Confirmer la réservation
    await fetch(`${baseUrl}/reservations/${reservationId}?key=${KEY}&updateMask.fieldPaths=statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { statut: { stringValue: 'reserve' } } }),
    });

    // 2. Incrémenter le compteur de réservations de la sortie (+ part artiste 70%)
    const sortieResp = await fetch(`${baseUrl}/sorties/${sortieId}?key=${KEY}`);
    if (sortieResp.ok) {
      const sortieDoc = await sortieResp.json();
      const reservationsActuelles = parseInt(sortieDoc.fields?.reservations?.integerValue || '0', 10);
      await fetch(`https://firestore.googleapis.com/v1/${sortieDoc.name}?key=${KEY}&updateMask.fieldPaths=reservations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { reservations: { integerValue: String(reservationsActuelles + 1) } } }),
      });
      const artistEmail = sortieDoc.fields?.artistEmail?.stringValue || '';
      const titre = sortieDoc.fields?.titre?.stringValue || '';
      if (artistEmail) {
        const partArtiste = Math.round(prixOscart * 0.7);
        await fetch(`${baseUrl}/ventes?key=${KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: {
            artistEmail: { stringValue: artistEmail },
            type: { stringValue: 'reservation' },
            titre: { stringValue: titre },
            montantOscart: { integerValue: String(partArtiste) },
            createdAt: { stringValue: new Date().toISOString() },
          } }),
        });
      }
    }

    // 3. Créditer les kiffs de l'acheteur (celui qui réserve obtient toujours des kiffs)
    await crediterKiffs(uid, kiffsGagnes, baseUrl, KEY);

    // 4. Marquer cette référence comme traitée (anti-doublon)
    if (reference) {
      await fetch(`${baseUrl}/paiements_traites?documentId=${reference}&key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: {
          reference: { stringValue: reference },
          uid: { stringValue: uid },
          reservationId: { stringValue: reservationId },
          type: { stringValue: 'reservation_directe' },
          traiteLe: { stringValue: new Date().toISOString() },
        } }),
      });
    }

    return res.status(200).json({ ok: true, statut: 'reserve', kiffsGagnes });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur (réservation directe)' });
  }
}
