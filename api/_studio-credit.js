// api/_studio-credit.js (appelé par api/studio-paiement.js, action « credit »)
// Valide un projet du Studio vocal avec un titre restant d'un pack déjà payé.
// Tout se fait dans une transaction : impossible d'utiliser deux fois le même titre.

import { adminApp, verifierUtilisateur, ADMIN_EMAIL, notifier } from './_studio-admin.js';

export async function utiliserCredit(req, res) {
  try {
    const { projetId, idToken } = req.body || {};
    if (!projetId) return res.status(400).json({ error: 'Projet manquant' });

    let utilisateur;
    try { utilisateur = await verifierUtilisateur(idToken); }
    catch { return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' }); }

    const db = adminApp().firestore();
    const refProjet = db.collection('studio_projets').doc(projetId);
    const refCredits = db.collection('studio_credits').doc(utilisateur.uid);

    const titre = await db.runTransaction(async (t) => {
      const [p, c] = await Promise.all([t.get(refProjet), t.get(refCredits)]);
      if (!p.exists) throw new Error('Projet introuvable');
      const projet = p.data();
      if (projet.uid !== utilisateur.uid) throw new Error('Ce projet ne t\'appartient pas');
      if (projet.statut !== 'extrait_dispo') throw new Error('Ce projet n\'attend pas de validation');
      const credits = c.exists ? (c.data().credits || 0) : 0;
      if (credits < 1) throw new Error('Plus aucun titre dans ton pack');
      const maintenant = new Date().toISOString();
      t.set(refCredits, { uid: utilisateur.uid, credits: credits - 1, majLe: maintenant }, { merge: true });
      t.update(refProjet, { statut: 'paye', payeLe: maintenant, formule: 'credit_pack', majLe: maintenant });
      return projet.titre || '';
    });

    await notifier(db, ADMIN_EMAIL, `Studio vocal — « ${titre} » validé avec un titre du pack. À finaliser (mixage + mastering).`, '/admin?tab=studiovocal');
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Erreur serveur' });
  }
}
