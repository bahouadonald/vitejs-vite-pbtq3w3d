import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// ── Initialiser Firebase Admin une seule fois (via service account en Base64) ──
if (!admin.apps.length) {
  const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '';
  const saJson = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(saJson),
  });
}

// ── Liste des admins autorisés à redéfinir les mots de passe ──
const ADMINS = [
  'bdonaldservices@gmail.com',
  'bigb80313@icloud.com',
  'ruthssgoudo@gmail.com',
  'kboklay13@gmail.com',
  'w.biastace@gmail.com',
  'bokobillionaire@gmail.com',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, targetEmail, newPassword } = req.body;
  if (!idToken || !targetEmail || !newPassword) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  // 1. Vérifier que l'appelant est bien un admin connecté
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide' });
  }
  const callerEmail = (decoded.email || '').toLowerCase();
  if (!ADMINS.includes(callerEmail)) {
    return res.status(403).json({ error: 'Action réservée aux administrateurs' });
  }

  // 2. Valider le nouveau mot de passe
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }

  // 3. Redéfinir le mot de passe du compte cible
  try {
    const user = await admin.auth().getUserByEmail(String(targetEmail).trim().toLowerCase());
    await admin.auth().updateUser(user.uid, { password: String(newPassword) });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('admin-set-password error:', err.message);
    if (err.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Aucun compte avec cet email' });
    }
    return res.status(500).json({ error: err.message });
  }
}
