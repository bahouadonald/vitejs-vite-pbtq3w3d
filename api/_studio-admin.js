// api/_studio-admin.js
// Outils partagés par les fonctions serveur du Studio vocal.
// (Le "_" au début du nom : Vercel ne l'expose pas comme une adresse publique.)
//
// Utilise le même compte de service que api/admin-set-password.ts :
//   FIREBASE_SERVICE_ACCOUNT_BASE64 = le JSON du compte de service, encodé en Base64
// Le SDK Admin passe outre les règles Firestore : c'est le SEUL endroit qui peut
// marquer un projet « payé » ou modifier les crédits d'un pack.

import admin from 'firebase-admin';

export function adminApp() {
  if (!admin.apps.length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '';
    if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 non configuré');
    const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  return admin;
}

// Tarifs officiels (le client ne choisit jamais le montant)
export const FORMULES = {
  // Studio complet : voix témoin → instru créée par l'équipe → prise finale
  production: { label: 'Production complète',  titres: 1, fcfa: 12000 },
  // L'artiste chante sur son propre beat
  beat:       { label: 'Arrangement sur ton beat', titres: 1, fcfa: 6000 },
  remaster:   { label: 'Remastering',          titres: 1, fcfa: 6000 },
  remix:      { label: 'Remixage',             titres: 1, fcfa: 6000 },
  // Anciens projets (avant le nouveau parcours)
  titre:      { label: '1 titre',              titres: 1, fcfa: 12000 },
  // Pack d'ouverture : priorité (48 h) pendant 3 mois, payé une fois
  priorite:   { label: 'Pack Priorité (3 mois)', titres: 0, fcfa: 1500, jours: 90 },
};
// Services du nouveau parcours (le prix vient toujours du service du projet)
export const SERVICES = ['production', 'beat', 'remaster', 'remix'];
// Compatibilité avec l'ancien code
export const SERVICES_TITRE_EXISTANT = ['beat', 'remaster', 'remix'];

export const ADMIN_EMAIL = 'bdonaldservices@gmail.com';

// Vérifie le jeton de connexion Firebase envoyé par le navigateur
export async function verifierUtilisateur(idToken) {
  if (!idToken) throw new Error('Non connecté');
  const a = adminApp();
  return await a.auth().verifyIdToken(idToken);
}

// Notification in-app (même format que envoyerNotification côté site)
export async function notifier(db, to, texte, lien, role) {
  if (!to) return;
  try {
    await db.collection('notifications').add({
      to, type: 'studio', text: texte, lien, ...(role ? { role } : {}),
      createdAt: new Date().toISOString(), lu: false,
    });
  } catch (e) { /* best-effort */ }
  // Vrai push (même app fermée), via la fonction existante api/send-push
  try {
    await fetch('https://doniel.art/api/send-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: to, title: 'Doniel Zik', body: texte, url: lien || '/notifications' }),
    });
  } catch (e) { /* best-effort */ }
}
