// api/studio-paiement.js
// Crée un paiement GeniusPay pour un projet du Studio vocal (1 titre ou un pack).
// Le montant est fixé ICI, d'après la formule choisie — jamais par le navigateur.
// Le webhook (api/webhook-geniuspay.js, type "studio") marque le projet payé.
//
// Variables d'environnement Vercel (déjà utilisées par les autres paiements) :
//   GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET, FIREBASE_SERVICE_ACCOUNT_BASE64

import { adminApp, verifierUtilisateur, FORMULES } from './_studio-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { projetId, formule, idToken } = req.body || {};
    const f = FORMULES[formule];
    if (!projetId || !f) return res.status(400).json({ error: 'Paramètres invalides' });

    let utilisateur;
    try { utilisateur = await verifierUtilisateur(idToken); }
    catch { return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' }); }

    const db = adminApp().firestore();
    const snap = await db.collection('studio_projets').doc(projetId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Projet introuvable' });
    const projet = snap.data();
    if (projet.uid !== utilisateur.uid) return res.status(403).json({ error: 'Ce projet ne t\'appartient pas' });
    if (projet.statut !== 'extrait_dispo') return res.status(400).json({ error: 'Ce projet n\'attend pas de paiement' });

    const API_KEY = process.env.GENIUSPAY_API_KEY;
    const API_SECRET = process.env.GENIUSPAY_API_SECRET;
    if (!API_KEY || !API_SECRET) return res.status(500).json({ error: 'Clés GeniusPay non configurées' });

    const origine = req.headers.origin || 'https://doniel.art';
    const reponse = await fetch('https://geniuspay.ci/api/v1/merchant/payments', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'X-API-Secret': API_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: f.fcfa,
        description: `Studio vocal - ${f.label} - ${projet.titre || ''} - Doniel Zik`,
        customer: { name: projet.nomArtiste || utilisateur.name || 'Artiste Doniel Zik', email: utilisateur.email || projet.email || '' },
        success_url: `${origine}/artiste?tab=studio&paiement=succes`,
        error_url: `${origine}/artiste?tab=studio&paiement=echec`,
        metadata: { type: 'studio', projetId, uid: utilisateur.uid, formule },
      }),
    });
    const data = await reponse.json();
    if (!reponse.ok || !data.success) {
      return res.status(500).json({ error: data?.error?.message || 'Échec création paiement' });
    }
    const url = data.data.checkout_url || data.data.payment_url;
    return res.status(200).json({ ok: true, url, reference: data.data.reference });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
