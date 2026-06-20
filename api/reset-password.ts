import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// ── Initialiser Firebase Admin une seule fois ──
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

// ── Générer un mot de passe temporaire lisible ──
function genererMotDePasse(longueur = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let mdp = '';
  for (let i = 0; i < longueur; i++) {
    mdp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return mdp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email manquant' });

  const emailClean = String(email).trim().toLowerCase();

  try {
    // 1. Vérifier que le compte existe
    let user;
    try {
      user = await admin.auth().getUserByEmail(emailClean);
    } catch (e) {
      // Sécurité : on renvoie un succès même si l'email n'existe pas
      // (pour ne pas révéler quels emails sont inscrits)
      return res.status(200).json({ ok: true });
    }

    // 2. Générer un mot de passe temporaire
    const tempPassword = genererMotDePasse(10);

    // 3. Appliquer ce mot de passe au compte
    await admin.auth().updateUser(user.uid, { password: tempPassword });

    // 4. Envoyer l'email via Resend
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Doniel Zik <onboarding@resend.dev>',
        to: [emailClean],
        subject: 'Votre mot de passe temporaire — Doniel Zik',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0E2A52;color:#EAF2FF;border-radius:16px;">
            <h1 style="color:#5BB0FF;font-size:22px;margin-bottom:8px;">Doniel Zik</h1>
            <p style="font-size:15px;line-height:1.6;color:#A9BEDC;">Bonjour,</p>
            <p style="font-size:15px;line-height:1.6;color:#A9BEDC;">
              Vous avez demandé à réinitialiser votre mot de passe. Voici votre mot de passe temporaire :
            </p>
            <div style="background:#143665;border-radius:12px;padding:18px;text-align:center;margin:20px 0;">
              <span style="font-size:26px;font-weight:bold;letter-spacing:2px;color:#F5C84C;">${tempPassword}</span>
            </div>
            <p style="font-size:14px;line-height:1.6;color:#A9BEDC;">
              Connectez-vous avec ce mot de passe, puis changez-le dans vos paramètres pour en choisir un nouveau.
            </p>
            <p style="font-size:13px;color:#7088aa;margin-top:24px;">
              Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.
            </p>
            <p style="font-size:13px;color:#7088aa;">— L'équipe Doniel Zik</p>
          </div>
        `,
      }),
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      console.error('Resend error:', errText);
      return res.status(500).json({ error: 'Email non envoyé' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('reset-password error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
