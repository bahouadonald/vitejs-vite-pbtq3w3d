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
