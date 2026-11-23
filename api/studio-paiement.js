// api/studio-paiement.js
// Crée un paiement GeniusPay pour un projet du Studio vocal (1 titre ou un pack).
// Le montant est fixé ICI, d'après la formule choisie — jamais par le navigateur.
// Le webhook (api/webhook-geniuspay.js, type "studio") marque le projet payé.
//
// Variables d'environnement Vercel (déjà utilisées par les autres paiements) :
//   GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET, FIREBASE_SERVICE_ACCOUNT_BASE64

import { adminApp, verifierUtilisateur, FORMULES, SERVICES } from './_studio-admin.js';
import { utiliserCredit } from './_studio-credit.js';

// Une seule fonction serveur pour le Studio vocal (le plan Vercel Hobby limite
// le nombre de fonctions à 12) :
//   { action: 'credit', projetId, idToken }           → valider avec un titre du pack
//   { projetId, formule, idToken }                    → créer un paiement GeniusPay
//   { formule: 'priorite', idToken }                  → acheter le Pack Priorité (3 mois)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if ((req.body || {}).action === 'credit') return utiliserCredit(req, res);

  try {
    const { projetId, idToken } = req.body || {};
    let formule = (req.body || {}).formule;

    let utilisateur;
    try { utilisateur = await verifierUtilisateur(idToken); }
    catch { return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' }); }

    let projet = { titre: '', nomArtiste: '', email: '' };
    if (formule !== 'priorite') {
      if (!projetId) return res.status(400).json({ error: 'Paramètres invalides' });
      const db = adminApp().firestore();
      const snap = await db.collection('studio_projets').doc(projetId).get();
      if (!snap.exists) return res.status(404).json({ error: 'Projet introuvable' });
      projet = snap.data();
      if (projet.uid !== utilisateur.uid) return res.status(403).json({ error: 'Ce projet ne t\'appartient pas' });
      // Le prix est toujours celui du service du projet, quoi que demande le navigateur
      if (SERVICES.includes(projet.service)) {
        formule = projet.service;
        const attendu = projet.service === 'production' ? 'propositions_dispo' : 'extrait_dispo';
        if (projet.statut !== attendu) return res.status(400).json({ error: 'Ce projet n\'attend pas de paiement' });
        if (projet.service === 'production' && typeof projet.choix !== 'number') return res.status(400).json({ error: 'Choisis d\'abord ta proposition' });
      } else {
        // Ancien projet
        if (projet.statut !== 'extrait_dispo') return res.status(400).json({ error: 'Ce projet n\'attend pas de paiement' });
        formule = 'titre';
      }
    }
    const f = FORMULES[formule];
    if (!f || (formule === 'priorite' && projetId)) return res.status(400).json({ error: 'Paramètres invalides' });

    const API_KEY = process.env.GENIUSPAY_API_KEY;
    const API_SECRET = process.env.GENIUSPAY_API_SECRET;
    if (!API_KEY || !API_SECRET) return res.status(500).json({ error: 'Clés GeniusPay non configurées' });

    const origine = req.headers.origin || 'https://doniel.art';
    const reponse = await fetch('https://geniuspay.ci/api/v1/merchant/payments', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'X-API-Secret': API_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: f.fcfa,
        description: `Studio - ${f.label}${projet.titre ? ' - ' + projet.titre : ''} - Doniel Zik`,
        customer: { name: projet.nomArtiste || utilisateur.name || 'Artiste Doniel Zik', email: utilisateur.email || projet.email || '' },
        success_url: `${origine}/studio-vocal?paiement=succes`,
        error_url: `${origine}/studio-vocal?paiement=echec`,
        metadata: { type: 'studio', projetId: projetId || '', uid: utilisateur.uid, formule },
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
