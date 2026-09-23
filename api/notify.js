// api/notify.js
// Fonction serveur Vercel : envoie un email de notification via Resend.
// Appelée par l'app quand une demande/réservation arrive, pour prévenir
// le destinataire par email même si l'app est fermée.
//
// PRÉREQUIS (déjà en place si /api/reset-password fonctionne) :
//   - Variable d'environnement RESEND_API_KEY définie dans Vercel
//   - Domaine doniel.art vérifié dans Resend
//
// Déploiement : place ce fichier dans le dossier "api/" à la racine du projet,
//   à côté de reset-password.js. Vercel le rend disponible sur /api/notify.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { to, sujet, message } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({ error: 'Destinataire et message requis' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'Clé Resend non configurée' });
    }

    const titre = sujet || 'Nouvelle notification Doniel Zik';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0E2A52; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0A2148, #143665); padding: 28px 24px; text-align: center;">
          <h1 style="color: #5BB0FF; margin: 0; font-size: 22px;">Doniel Zik</h1>
        </div>
        <div style="padding: 28px 24px; color: #EAF2FF;">
          <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 14px;">${titre}</h2>
          <p style="color: #A9BEDC; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${message}</p>
          <a href="https://doniel.art/notifications" style="display: inline-block; background: #0A84FF; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 99px; font-weight: bold; font-size: 14px;">Voir dans l'application</a>
        </div>
        <div style="padding: 16px 24px; background: rgba(0,0,0,0.2); text-align: center;">
          <p style="color: #6a88aa; font-size: 11px; margin: 0;">Doniel Zik — La Musique. Un Scan. Un Monde.</p>
        </div>
      </div>
    `;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Doniel Zik <notifications@doniel.art>',
        to: [to],
        subject: titre,
        html,
      }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return res.status(500).json({ error: data.message || 'Envoi email impossible' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
