// api/creer-paiement.js
// Fonction serveur Vercel : crée un paiement GeniusPay (mode Checkout) et renvoie
// l'URL de la page de paiement. La clé secrète reste cachée côté serveur.
//
// PRÉREQUIS — variables d'environnement à définir dans Vercel :
//   GENIUSPAY_API_KEY    = pk_sandbox_... (puis pk_live_... en production)
//   GENIUSPAY_API_SECRET = sk_sandbox_... (puis sk_live_... en production)
//
// Déploiement : place ce fichier dans le dossier "api/" à la racine du projet.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { oscart, fcfa, uid, email, nom } = req.body || {};

    if (!oscart || !fcfa || !uid) {
      return res.status(400).json({ error: 'Paramètres manquants (oscart, fcfa, uid)' });
    }

    const API_KEY = process.env.GENIUSPAY_API_KEY;
    const API_SECRET = process.env.GENIUSPAY_API_SECRET;
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Clés GeniusPay non configurées' });
    }

    // Domaine de l'app (pour les redirections après paiement)
    const origine = req.headers.origin || 'https://doniel.art';

    const reponse = await fetch('https://geniuspay.ci/api/v1/merchant/payments', {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'X-API-Secret': API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: fcfa,                       // montant en XOF
        description: `Recharge ${oscart} Oscart - Doniel Zik`,
        customer: {
          name: nom || 'Mélomane Doniel Zik',
          email: email || '',
        },
        success_url: `${origine}/ziko?paiement=succes`,
        error_url: `${origine}/ziko?paiement=echec`,
        // metadata : indispensable pour créditer les bons Oscart au bon utilisateur via le webhook
        metadata: {
          uid,
          oscart: String(oscart),
          fcfa: String(fcfa),
          type: 'recharge_oscart',
        },
      }),
    });

    const data = await reponse.json();

    if (!reponse.ok || !data.success) {
      return res.status(500).json({ error: data?.error?.message || 'Échec création paiement' });
    }

    // URL vers laquelle rediriger le client (page de checkout GeniusPay)
    const url = data.data.checkout_url || data.data.payment_url;
    return res.status(200).json({ ok: true, url, reference: data.data.reference });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
