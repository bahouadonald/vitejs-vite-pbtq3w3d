// api/send-push.js
// Envoie une vraie notification push (Firebase Cloud Messaging) à un
// utilisateur — fonctionne même quand l'application est complètement
// fermée, contrairement à l'ancien système qui dépendait de l'app ouverte.
//
// PRÉREQUIS — variables d'environnement à définir dans Vercel :
//   FCM_PROJECT_ID     = l'identifiant du projet Firebase (ex: drop-platform-68cbc)
//   FCM_CLIENT_EMAIL   = le "client_email" du compte de service Firebase
//   FCM_PRIVATE_KEY    = la "private_key" du compte de service (avec les \n)
// (Récupérables dans Firebase Console → Paramètres du projet → Comptes de
// service → Générer une nouvelle clé privée)
//
// Aucune dépendance externe : la signature du jeton OAuth2 se fait avec le
// module "crypto" intégré à Node, comme les autres fonctions serveur du projet.

import crypto from 'crypto';

async function obtenirJetonAcces() {
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: 'RS256', typ: 'JWT' };
  const charge = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  };
  const encoder = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const aSigner = `${encoder(entete)}.${encoder(charge)}`;
  const signature = crypto.createSign('RSA-SHA256').update(aSigner).sign(privateKey, 'base64url');
  const jwt = `${aSigner}.${signature}`;

  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await reponse.json();
  if (!data.access_token) throw new Error('Jeton OAuth2 introuvable : ' + JSON.stringify(data));
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { email, title, body, url } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email manquant' });

    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const FCM_PROJECT = process.env.FCM_PROJECT_ID || PROJECT;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    // Retrouver le/les jetons FCM enregistrés pour cet email
    const reponseRecherche = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'fcm_tokens' }],
          where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
          limit: 20,
        },
      }),
    });
    const resultats = await reponseRecherche.json();
    const tokens = (Array.isArray(resultats) ? resultats.filter(r => r.document) : [])
      .map(r => r.document.fields?.token?.stringValue)
      .filter(Boolean);

    if (tokens.length === 0) return res.status(200).json({ ok: true, envoyes: 0, raison: 'aucun jeton enregistré' });

    const accessToken = await obtenirJetonAcces();
    let envoyes = 0;
    for (const token of tokens) {
      try {
        const reponseEnvoi = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({
            message: {
              token,
              data: {
                title: title || 'Doniel Zik',
                body: body || 'Vous avez une nouvelle notification',
                url: url || '/notifications',
              },
              webpush: { fcm_options: { link: url || '/notifications' } },
            },
          }),
        });
        if (reponseEnvoi.ok) envoyes++;
      } catch (e) { console.error('envoi push', e); }
    }

    return res.status(200).json({ ok: true, envoyes, total: tokens.length });
  } catch (e) {
    console.error('send-push', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
