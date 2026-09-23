// api/creer-paiement-telechargement.js
// Fonction serveur Vercel : crée un paiement GeniusPay (mode Checkout) pour un
// téléchargement payé DIRECTEMENT en devise (pas de recharge Oscart requise).
// Le webhook (api/webhook-geniuspay.js) active le téléchargement (ventes.dlActive)
// et crédite les kiffs de l'acheteur dès que le paiement est confirmé.
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
    const { venteId, prix, prixOscart, uid, email, nom, qrId, albumLabel } = req.body || {};

    if (!venteId || !prix || !uid || !qrId) {
      return res.status(400).json({ error: 'Paramètres manquants (venteId, prix, uid, qrId)' });
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
        amount: prix,                       // montant en XOF, payé directement (pas de recharge)
        description: `Téléchargement ${albumLabel || ''} - Doniel Zik`,
        customer: {
          name: nom || 'Mélomane Doniel Zik',
          email: email || '',
        },
        success_url: `${origine}/fan/${qrId}?paiement=succes`,
        error_url: `${origine}/fan/${qrId}?paiement=echec`,
        // metadata : indispensable pour activer le bon téléchargement au bon
        // utilisateur via le webhook, sans jamais toucher son solde Oscart.
        metadata: {
          type: 'telechargement_direct',
          venteId,
          uid,
          qrId,
          prixOscart: String(prixOscart || Math.ceil(prix / 10)),
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
