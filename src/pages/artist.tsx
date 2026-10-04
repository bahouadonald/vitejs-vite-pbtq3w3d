// ─────────────────────────────────────────────
// TABLEAU DE BORD ARTISTE (étape 4 du découpage) — ArtistPage + tous ses
// onglets (Stats, Enregistrer, Mon Mood, Ma Bio, Pochettes...) + RetraitModal.
// Regroupés ici bien qu'ils étaient dispersés dans App.tsx à l'origine.
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc, getDocs,
  onSnapshot, query, orderBy, where, limit,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
import { QRCodeCanvas } from 'qrcode.react';
import {
  C, S, ADMIN_EMAIL, demanderResetPassword, envoyerNotification, CLOUDINARY_CLOUD,
  CLOUDINARY_UPLOAD_PRESET, BASE_URL, optimImg, logTx, lancerPaiementGeniusPay, LOGO_B64,
  badgeStyle, KIFFEMENTS, CATEGORIES_AUDIO, CATEGORIES_VIDEO, PRIX_PUBLICATION, COIN_OSCART_SYMBOLE,
  activerNotificationsPush, RECHARGES,
} from '../lib/utils';
import {
  ChangerMotDePasse, Logo, OSCART_TO_FCFA, OSCART_TO_EUR, OSCART_TO_USD, PALIERS_CONCOURS_DEFAUT, Lien,
} from '../components/shared';
import { SignaturesArtisteTab } from './admin';

// ─────────────────────────────────────────────
// ARTIST PAGE
// ─────────────────────────────────────────────
export function ArtistPage() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({ visits: 0, streams: 0, validStreams: 0, downloads: 0, qrcodes: [] });
  const [dashTab, setDashTab] = useState<'stats'|'publier'|'mot'|'bio'|'pochettes'|'signatures'|'notifs'>('stats');
  const [soldeOscartArtiste, setSoldeOscartArtiste] = useState(0);
  const [rechargeModalArtiste, setRechargeModalArtiste] = useState<{fcfa:number,oscart:number}|null>(null);
  const [artistNom, setArtistNom] = useState('');
  const refParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;

  // Charger solde Oscart artiste
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db,'coins_solde'), where('uid','==',user.uid)),
      snap => setSoldeOscartArtiste(snap.empty ? 0 : snap.docs[0].data().solde || 0)
    );
    return unsub;
  }, [user]);
  const [devise, setDevise] = useState<'fcfa'|'eur'|'usd'>('fcfa');

  // Basculer une publication Public ⇄ Privé (masquer/afficher dans le fil Découvrir)
  // NE TOUCHE PAS aux données (scans, écoutes, kiffs) — change juste la visibilité dans le fil
  const [togglingPrive, setTogglingPrive] = useState<string | null>(null);
  const basculerPrive = async (q: any, rendrePrive: boolean) => {
    const pid = q.publicLinkId || q.qrId || q.id;
    if (!pid) return;
    setTogglingPrive(q.id);
    try {
      // decouvrir : toutes les entrées de cette publication
      const dSnap = await getDocs(query(collection(db,'decouvrir'), where('publicLinkId','==',pid)));
      for (const d of dSnap.docs) await updateDoc(doc(db,'decouvrir',d.id), { masque: rendrePrive });
      // publicLinks : on garde la cohérence
      const plSnap = await getDocs(query(collection(db,'publicLinks'), where('publicLinkId','==',pid)));
      for (const d of plSnap.docs) await updateDoc(doc(db,'publicLinks',d.id), { masque: rendrePrive });
      // qrcode : pour refléter l'état dans le tableau de bord
      if (q.id) await updateDoc(doc(db,'qrcodes',q.id), { masque: rendrePrive });
    } catch(e) { console.error('basculerPrive', e); alert('Erreur. Réessayez.'); }
    setTogglingPrive(null);
  };

  // Ventes / chat mélomane
  const [ventes, setVentes] = useState<any[]>([]);
  const [chatVenteId, setChatVenteId] = useState<string|null>(null);
  const [venteMsgs, setVenteMsgs] = useState<any[]>([]);
  const [venteInput, setVenteInput] = useState('');
  const [venteSending, setVenteSending] = useState(false);
  const [unreadVentes, setUnreadVentes] = useState(0);

  // Option paiement artiste
  const [optionPaiement, setOptionPaiement] = useState<'dz'|'artiste'|''>('');
  const [lienPaiement, setLienPaiement] = useState('');
  const [savingOption, setSavingOption] = useState(false);
  const [optionMsg, setOptionMsg] = useState('');
  const [pubActionType, setPubActionType] = useState('url');
  const [pubActionLien, setPubActionLien] = useState('');
  const [pubActionMsg, setPubActionMsg] = useState('');

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        // L'admin ne doit pas être bloqué ici
        if (u.email === ADMIN_EMAIL) {
          setUser(null); setView('login');
          setMsg("Utilisez /admin pour accéder au dashboard administrateur.");
          return; // Ne pas déconnecter l'admin, juste ne pas afficher le dashboard artiste
        }
        // Vérifier que ce compte est bien un artiste
        const artistSnap = await getDocs(query(collection(db, 'artists'), where('email', '==', u.email)));
        if (!artistSnap.empty) {
          setUser(u); setView('dashboard');
          loadStats(u.email || '');
          loadArtistOptions(u.uid);
        } else {
          // Ce compte n'est pas artiste : on affiche simplement l'écran de connexion
          // artiste SANS déconnecter la session en cours (ex. un mélomane qui arrive
          // ici par erreur ne doit pas perdre l'accès à son compte mélomane).
          setUser(null); setView('login');
          setMsg("Ce compte n'est pas un compte artiste. Connectez-vous avec votre compte artiste.");
        }
      } else { setUser(null); setView('login'); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les demandes d'achat en temps réel
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'ventes'), where('artistId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVentes(list);
      setUnreadVentes(list.filter((v: any) => !v.readByArtist).length);
    });
    return unsub;
  }, [user]);

  // Messages de la vente sélectionnée
  useEffect(() => {
    if (!chatVenteId) return;
    const q = query(collection(db, 'venteMessages'), where('venteId', '==', chatVenteId), orderBy('ts', 'asc'));
    const unsub = onSnapshot(q, snap => setVenteMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    // Marquer comme lu
    if (chatVenteId) updateDoc(doc(db, 'ventes', chatVenteId), { readByArtist: true }).catch(() => {});
    return unsub;
  }, [chatVenteId]);

  const loadArtistOptions = async (uid: string) => {
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'artistOptions', uid));
      if (snap.exists()) {
        const d = snap.data();
        setOptionPaiement(d.optionPaiement || '');
        setLienPaiement(d.lienPaiement || '');
      }
    } catch(e) {}
  };

  const saveOptions = async () => {
    if (!user || !optionPaiement) { setOptionMsg('Choisissez une option'); return; }
    setSavingOption(true); setOptionMsg('');
    try {
      // setDoc avec merge évite les problèmes de permissions sur addDoc/updateDoc
      await setDoc(doc(db, 'artistOptions', user.uid), {
        uid: user.uid, optionPaiement, lienPaiement,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setOptionMsg('Options sauvegardées !');
    } catch(e: any) { setOptionMsg('Erreur: ' + e.message); }
    setSavingOption(false);
  };

  // Envoyer message à un mélomane
  const sendVenteMsg = async () => {
    if (!venteInput.trim() || !chatVenteId || !user) return;
    setVenteSending(true);
    await addDoc(collection(db, 'venteMessages'), {
      venteId: chatVenteId, artistId: user.uid,
      from: 'artiste', text: venteInput.trim(), ts: new Date().toISOString(),
    });
    // Mettre à jour vente comme "contacté"
    await updateDoc(doc(db, 'ventes', chatVenteId), { statut: 'en_discussion', readByArtist: true });
    setVenteInput(''); setVenteSending(false);
  };

  // Valider le paiement → active le téléchargement
  const validerPaiement = async (venteId: string, qrId: string) => {
    try {
      // Activer le téléchargement pour ce mélomane
      await updateDoc(doc(db, 'ventes', venteId), {
        statut: 'paye', payeAt: new Date().toISOString(),
        dlActive: true,
      });
      // Message automatique au mélomane
      await addDoc(collection(db, 'venteMessages'), {
        venteId, artistId: user.uid,
        from: 'artiste',
        text: 'Paiement reçu ! Votre téléchargement est maintenant actif. Retournez sur la page de l\'album pour télécharger.',
        ts: new Date().toISOString(),
      });
      setMsg('Paiement validé — téléchargement activé !');
    } catch(e: any) { setMsg('Erreur: ' + e.message); }
  };

  const loadStats = async (email: string) => {
    // Chercher dans artists par email
    const artistSnap = await getDocs(query(collection(db, 'artists'), where('email', '==', email)));
    let artistName = '';
    if (!artistSnap.empty) artistName = artistSnap.docs[0].data().name || '';

    // Chercher QR codes par email artiste OU par nom artiste
    let qrList: any[] = [];
    const qrByEmail = await getDocs(query(collection(db, 'qrcodes'), where('artistEmail', '==', email)));
    qrList = qrByEmail.docs.map(d => ({ id: d.id, ...d.data() }));

    // Si rien par email, essayer par nom artiste
    if (qrList.length === 0 && artistName) {
      const qrByName = await getDocs(query(collection(db, 'qrcodes'), where('artist', '==', artistName)));
      qrList = qrByName.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (qrList.length === 0 && !artistName) {
      setStats({ visits: 0, streams: 0, validStreams: 0, downloads: 0, qrcodes: [], pochettes: 0, scansTotal: 0, artistName: email, notLinked: true });
      return;
    }
    const getDl = (q: any) => q.downloads !== undefined ? q.downloads : (q.usedScans || 0);
    // QR codes originaux (non dupliqués en masse) = les pochettes créées
    const originalQRs = qrList.filter((q: any) => !q.bulk);
    const totalPochettes = originalQRs.length;
    const totalScansEffectues = qrList.reduce((s: number, q: any) => s + (q.usedScans || 0), 0);
    const totalVisits = qrList.reduce((s: number, q: any) => s + (q.visits || 0), 0);
    const totalStreams = qrList.reduce((s: number, q: any) => s + (q.streams || 0), 0);
    const totalValidStreams = qrList.reduce((s: number, q: any) => s + (q.validStreams || 0), 0);
    const totalDl = qrList.reduce((s: number, q: any) => s + getDl(q), 0);
    // Lien public de streaming/monétisation — compteurs strictement séparés des
    // QR de duplication physique (qrcodes), on les additionne ici pour le total.
    const publicLinks = await getDocs(query(collection(db, 'publicLinks'), where('artistEmail', '==', email)));
    const linksList = publicLinks.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalVisitsLiens = linksList.reduce((s: number, l: any) => s + (l.visits || 0), 0);
    const totalStreamsLiens = linksList.reduce((s: number, l: any) => s + (l.streams || 0), 0);
    const totalDlLiens = linksList.reduce((s: number, l: any) => s + (l.downloads || 0), 0);
    // Kifs reçus + gains kiffements (60% des Oscart de chaque cadeau)
    let kifsRecus = 0, gainsKiffementsOscart = 0;
    try {
      const cadeauxSnap = await getDocs(query(collection(db, 'cadeaux'), where('artistEmail', '==', email)));
      cadeauxSnap.docs.forEach(d => {
        const c = d.data();
        kifsRecus += (c.kiffs !== undefined ? c.kiffs : (c.coins || 0) * 250);
        gainsKiffementsOscart += (c.partArtisteOscart !== undefined ? c.partArtisteOscart : Math.round((c.coins || 0) * 0.70));
      });
    } catch(e) { /* pas de cadeaux */ }
    setStats({
      visits: totalVisits + totalVisitsLiens, streams: totalStreams + totalStreamsLiens, validStreams: totalValidStreams,
      downloads: totalDl + totalDlLiens, qrcodes: qrList, pochettes: totalPochettes, scansTotal: totalScansEffectues,
      artistName: artistName || email, notLinked: false, publicLinks: linksList, kifsRecus, gainsKiffementsOscart,
      // Détail physique (duplication QR) vs en ligne (liens publics), pour un futur affichage séparé
      visitsPhysique: totalVisits, streamsPhysique: totalStreams, downloadsPhysique: totalDl,
      visitsEnLigne: totalVisitsLiens, streamsEnLigne: totalStreamsLiens, downloadsEnLigne: totalDlLiens,
    });
  };

  const register = async () => {
    if (!email || !password) { setMsg('Email et mot de passe requis'); return; }
    if (password.length < 8) { setMsg('Le mot de passe doit faire au moins 8 caractères'); return; }
    setLoading(true); setMsg('');
    try {
      // L'email est-il déjà enregistré comme artiste ?
      const artistSnap = await getDocs(query(collection(db, 'artists'), where('email','==', email)));
      // Pas enregistré ET pas de lien commercial -> bloquer
      if (artistSnap.empty && !refParam) {
        setMsg('Cet email n\'est pas enregistré. Inscrivez-vous via le lien de votre commercial Doniel Zik.');
        setLoading(false); return;
      }
      if (artistSnap.empty && !artistNom.trim()) {
        setMsg('Indiquez votre nom d\'artiste.');
        setLoading(false); return;
      }
      // Résoudre le commercial parrain depuis le lien (?ref=)
      let commercialEmail = '';
      if (refParam) {
        try {
          const { getDoc } = await import('firebase/firestore');
          const cSnap = await getDoc(doc(db, 'commerciaux', refParam));
          if (cSnap.exists()) commercialEmail = (cSnap.data().email || '').toLowerCase();
        } catch {}
      }
      // Créer le compte Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (artistSnap.empty) {
        // Auto-inscription via lien commercial : créer la fiche artiste (1er contenu offert)
        await addDoc(collection(db, 'artists'), {
          email, uid: cred.user.uid, name: artistNom.trim(), artistName: artistNom.trim(),
          commercialEmail, premierContenuGratuit: true, status: 'actif',
          createdAt: new Date().toISOString(),
        });
      } else {
        // Déjà enregistré par l'admin : juste lier l'uid
        await updateDoc(doc(db, 'artists', artistSnap.docs[0].id), { uid: cred.user.uid });
      }
      setMsg('Compte créé ! Bienvenue.');
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        setMsg('Ce compte existe déjà. Connectez-vous.');
        setView('login');
      } else { setMsg('Erreur: ' + e.message); }
    }
    setLoading(false);
  };

  const login = async () => {
    setLoading(true); setMsg('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Mettre à jour l'uid dans la collection artists si absent (artistes inscrits avant ce fix)
      const artSnap = await getDocs(query(collection(db, 'artists'), where('email','==',email)));
      if (!artSnap.empty && !artSnap.docs[0].data().uid) {
        await updateDoc(doc(db, 'artists', artSnap.docs[0].id), { uid: cred.user.uid });
      }
    } catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  const logout = async () => { await signOut(auth); };

  if (view === 'dashboard' && user) return (
    <div style={{ minHeight: '100vh', overflowX:'hidden', width:'100%', maxWidth:'100vw', background:`radial-gradient(ellipse 900px 500px at 50% -10%, rgba(245,200,76,0.10), transparent), ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .vente-row:hover{background:rgba(255,255,255,0.05)!important}
        .art-inp{width:100%;background:rgba(255,255,255,0.05);border:1px solid ${C.border};border-radius:10px;padding:12px 14px;color:${C.text};font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;}
        .art-inp:focus{border-color:${C.blue}}
        .art-tabs::-webkit-scrollbar{display:none}
      `}</style>

      {/* HEADER */}
      <div style={{ background:'rgba(14,26,52,0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid '+C.border, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, position:'sticky', top:0, zIndex:50, gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <span style={{ width:38, height:38, borderRadius:99, background:'linear-gradient(135deg,'+C.gold+',#c9922e)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:'#2a1c00', flexShrink:0 }}>
            {(stats.artistName || user.email || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div style={{ minWidth:0 }}>
            <p style={{ color:C.text, fontSize:14, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{stats.artistName || user.email}</p>
            <p style={{ color:C.gold, fontSize:10.5, fontWeight:700, letterSpacing:0.5, margin:0 }}>ESPACE ARTISTE</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {unreadVentes > 0 && (
            <span style={{ background:'rgba(240,74,106,0.15)', border:'1px solid rgba(240,74,106,0.4)', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800, color:'#ff8095' }}>
              {unreadVentes} nouveau{unreadVentes>1?'x':''}
            </span>
          )}
          <button style={{ padding:'8px 12px', borderRadius:99, border:'1px solid '+C.border, background:'rgba(255,255,255,0.04)', color:C.textSoft, cursor:'pointer', fontSize:12, fontWeight:600 }} onClick={async () => await signOut(auth)}>Déco</button>
        </div>
      </div>

      {/* BOUTON FLOTTANT — basculer vers le compte mélomane, visible sur tous les onglets */}
      <a href="/profil" aria-label="Basculer côté mélomane"
        style={{ position:'fixed', bottom:24, right:20, zIndex:60, display:'flex', alignItems:'center', gap:8, padding:'12px 18px', borderRadius:99, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', boxShadow:'0 6px 24px rgba(10,132,255,0.5)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2l4 4-4 4"/><path d="M3 12v-2a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 12v2a4 4 0 0 1-4 4H3"/>
        </svg>
        Basculer côté mélomane
      </a>

      {/* TABS — façon pilules, comme le reste de l'app */}
      <div className="art-tabs" style={{ borderBottom:'1px solid '+C.border, padding:'10px 12px', display:'flex', gap:8, background:'rgba(14,26,52,0.5)', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        {[['stats','Stats'],['publier','Enregistrer'],['mot','Mon Mood'],['bio','Ma Bio'],['pochettes','Pochettes'],['signatures','Signatures'],['notifs','Notifs']].map(([id,label]) => (
          <button key={id} onClick={() => setDashTab(id as any)}
            style={{ flexShrink:0, whiteSpace:'nowrap', padding:'8px 16px', borderRadius:99, border:'1px solid '+(dashTab===id ? 'transparent' : C.border),
              background: dashTab===id ? 'linear-gradient(135deg,'+C.blue+',#5d3fff)' : 'transparent',
              color: dashTab===id ? '#fff' : C.textSoft, fontSize:13, fontWeight: dashTab===id ? 800 : 600, cursor:'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'24px 16px', boxSizing:'border-box', width:'100%' }}>
        {msg && <div style={{ background:'rgba(93,132,255,0.1)', border:'1px solid rgba(93,132,255,0.35)', borderRadius:12, padding:'12px 14px', marginBottom:16, color:'#8fb4ff', fontSize:13 }}>{msg} <span style={{ cursor:'pointer', float:'right' }} onClick={() => setMsg('')}>✕</span></div>}


        {/* ────────── ONGLET STATS ────────── */}
        {dashTab === 'stats' && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* PORTEFEUILLE OSCART ARTISTE */}
            <div style={{ borderRadius:16, padding:24, marginBottom:16, border:'1px solid '+C.border, background:'linear-gradient(135deg,#16214a,#1e2c5c)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div>
                  <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, margin:'0 0 4px' }}>Votre portefeuille</p>
                  <p style={{ fontWeight:900, fontSize:24, color:'#ffd700', margin:0 }}><img src={COIN_OSCART_SYMBOLE} alt="" style={{ width:22, height:22, verticalAlign:"-4px", marginRight:5 }} />{soldeOscartArtiste} Oscart</p>
                  <p style={{ color:'rgba(255,255,255,0.3)', fontSize:11, margin:0 }}>{(soldeOscartArtiste * 10).toLocaleString()} F CFA</p>
                </div>
                <button onClick={() => setRechargeModalArtiste(RECHARGES[1])}
                  style={{ padding:'8px 16px', borderRadius:99, border:'1px solid rgba(255,215,0,0.3)', background:'rgba(255,215,0,0.1)', color:'#ffd700', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Recharger
                </button>
              </div>
              <p style={{ color:'rgba(255,255,255,0.3)', fontSize:10, margin:0 }}>
                Utilisez vos Oscart pour publier vos contenus · Single 500 Oscart · Album 1 500 Oscart
              </p>
            </div>

            {/* Modal recharge artiste */}
            {rechargeModalArtiste && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
                onClick={() => setRechargeModalArtiste(null)}>
                <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
                  <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:6 }}>Recharger {rechargeModalArtiste.oscart} Oscart</p>
                  <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
                    Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
                  </p>
                  <button onClick={async () => {
                    const err = await lancerPaiementGeniusPay(rechargeModalArtiste.oscart, rechargeModalArtiste.fcfa);
                    if (err) alert(err);
                  }}
                    style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                    Payer {rechargeModalArtiste.fcfa.toLocaleString()} F CFA
                  </button>
                  <button onClick={() => setRechargeModalArtiste(null)}
                    style={{ width:'100%', padding:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
            <h2 style={{ fontFamily:'serif', fontSize:23, fontWeight:800, marginBottom:4, color:C.text }}>Mon tableau de bord</h2>
            <p style={{ color:C.textSoft, fontSize:13, marginBottom:22 }}>Vue d'ensemble de votre activité sur Doniel Zik</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              {[
                { label:'Pochettes créées', value:stats.pochettes||0 },
                { label:'Scans effectués', value:stats.scansTotal||0 },
              ].map((s,i) => (
                <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, textAlign:'center', padding:'20px 12px' }}>
                  <p style={{ fontSize:28, fontWeight:900, color:C.blueLite, marginBottom:4 }}>{s.value}</p>
                  <p style={{ color:C.textSoft, fontSize:11 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { label:'Téléchargements', value:stats.downloads||0 },
                { label:'Streams', value:stats.streams||0 },
              ].map((s,i) => (
                <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, textAlign:'center', padding:'20px 12px' }}>
                  <p style={{ fontSize:28, fontWeight:900, color:C.blueLite, marginBottom:4 }}>{s.value}</p>
                  <p style={{ color:C.textSoft, fontSize:11 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* SOLDE ARTISTE — portefeuille unique en Oscart + sélecteur devise */}
            <div style={{ background:'linear-gradient(135deg,#16214a,#1c2c5c)', border:'1px solid '+C.border, borderRadius:16, textAlign:'center', padding:'24px 20px', marginBottom:20 }}>
              {/* Sélecteur devise */}
              <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:12 }}>
                {(['fcfa','eur','usd'] as const).map(d => (
                  <button key={d} onClick={() => setDevise(d)}
                    style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${devise===d?'#ffd700':'rgba(255,255,255,0.1)'}`, background:devise===d?'rgba(255,215,0,0.15)':'transparent', color:devise===d?'#ffd700':'#8098b8', fontSize:11, fontWeight:devise===d?700:400, cursor:'pointer' }}>
                    {d === 'fcfa' ? 'F CFA' : d === 'eur' ? '€' : '$'}
                  </button>
                ))}
              </div>
              {/* Solde en Oscart (portefeuille unique) */}
              <p style={{ fontSize:32, fontWeight:900, color:'#ffd700', marginBottom:2 }}>
                {soldeOscartArtiste.toLocaleString()} Oscart
              </p>
              {/* Équivalent dans la devise choisie */}
              <p style={{ fontSize:18, fontWeight:700, color:'#dde4f5', marginBottom:4 }}>
                {devise === 'fcfa' && `${(soldeOscartArtiste * OSCART_TO_FCFA).toLocaleString()} F CFA`}
                {devise === 'eur' && `${(soldeOscartArtiste * OSCART_TO_EUR).toFixed(2)} €`}
                {devise === 'usd' && `${(soldeOscartArtiste * OSCART_TO_USD).toFixed(2)} $`}
              </p>
              <p style={{ color:'#8098b8', fontSize:11, marginBottom:(soldeOscartArtiste * OSCART_TO_FCFA) >= 15000 ? 12 : 4 }}>
                Portefeuille unique — gains, achats et crédits · retrait à partir de 15 000 F CFA
              </p>
              {(soldeOscartArtiste * OSCART_TO_FCFA) >= 15000 && (
                <RetraitModal montant={soldeOscartArtiste * OSCART_TO_FCFA} oscart={soldeOscartArtiste} artistEmail={user?.email||''} />
              )}
              {(soldeOscartArtiste * OSCART_TO_FCFA) < 15000 && soldeOscartArtiste > 0 && (
                <p style={{ color:'#4a5878', fontSize:11, marginTop:4 }}>
                  {(15000-(soldeOscartArtiste * OSCART_TO_FCFA)).toLocaleString()} F CFA restants avant retrait
                </p>
              )}
            </div>

            {/* CONCOURS KIFS + ESTIMATION DES GAINS */}
            <ConcoursKifsArtiste
              kifsRecus={stats.kifsRecus || 0}
              gainsKiffementsOscart={stats.gainsKiffementsOscart || 0}
              gainsTelechargementsOscart={Math.round((stats.soldeDL||0)/10)}
              devise={devise}
            />

            {/* LIENS PUBLICS */}
            {stats.publicLinks && stats.publicLinks.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <h3 style={{ fontFamily:'serif', fontSize:16, fontWeight:700, marginBottom:12, color:C.text }}>Mes liens de streaming</h3>
                {stats.publicLinks.map((link:any) => (
                  <div key={link.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <p style={{ fontWeight:700, fontSize:14, color:C.text }}>{link.label}</p>
                        <p style={{ color:C.textSoft, fontSize:12 }}>Streaming illimité · Sans scan limité</p>
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button onClick={() => { navigator.clipboard.writeText(BASE_URL+'/ecoute/'+link.publicLinkId); alert('Lien copié !'); }}
                          style={{ padding:'8px 14px', borderRadius:99, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Copier</button>
                        <button onClick={() => {
                          const url = BASE_URL+'/ecoute/'+link.publicLinkId;
                          const msg = `${link.label} — Écoutez et téléchargez mon tout nouveau contenu !\n\nCliquez sur le lien pour écouter ${url}`;
                          if (navigator.share) {
                            navigator.share({ title: link.label, text: msg, url });
                          } else {
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                          }
                        }} style={{ padding:'8px 14px', borderRadius:99, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontWeight:700, fontSize:12, cursor:'pointer' }}>Partager</button>
                        <button onClick={async () => {
                          // Publier sur la page Découvrir
                          const snap = await getDocs(query(collection(db, 'decouvrir'), where('publicLinkId','==', link.publicLinkId)));
                          if (!snap.empty) {
                            const docExistant = snap.docs[0];
                            if (docExistant.data().masque) {
                              // La fiche existe déjà mais était rendue privée — on la
                              // republie simplement, au lieu de bloquer avec "déjà publié".
                              await updateDoc(doc(db,'decouvrir', docExistant.id), { masque: false });
                              alert('Contenu republié sur la page Découvrir !');
                            } else {
                              alert('Ce contenu est déjà publié sur Découvrir !');
                            }
                            return;
                          }
                          // Récupérer les fichiers depuis le QR code lié
                          let files = link.files || [];
                          if (files.length === 0) {
                            const qrSnap = await getDocs(query(collection(db,'qrcodes'), where('publicLinkId','==', link.publicLinkId)));
                            if (!qrSnap.empty) files = qrSnap.docs[0].data().files || [];
                          }
                          if (files.length === 0) { alert('Ce contenu n\'a pas de fichier audio/vidéo. Impossible de le publier.'); return; }
                          await addDoc(collection(db, 'decouvrir'), {
                            publicLinkId: link.publicLinkId,
                            label: link.label,
                            artist: link.artist || '',
                            coverUrl: link.coverUrl || '',
                            type: link.type || 'single',
                            files,
                            artistEmail: user.email,
                            publishedAt: new Date().toISOString(),
                            likes: 0,
                            streams: 0,
                          });
                          alert('Contenu publié sur la page Découvrir !');
                        }} style={{ padding:'8px 14px', borderRadius:99, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                          Publier
                        </button>
                        <button onClick={async () => {
                          if (!window.confirm(`Supprimer définitivement "${link.label}" ? (QR, lien public et publication seront supprimés)`)) return;
                          try {
                            const plId = link.publicLinkId;
                            // Supprimer le QR code lié
                            const qrSnap = await getDocs(query(collection(db,'qrcodes'), where('publicLinkId','==',plId)));
                            for (const d of qrSnap.docs) await deleteDoc(doc(db,'qrcodes',d.id));
                            // Supprimer le lien public
                            const plSnap = await getDocs(query(collection(db,'publicLinks'), where('publicLinkId','==',plId)));
                            for (const d of plSnap.docs) await deleteDoc(doc(db,'publicLinks',d.id));
                            // Supprimer de Découvrir
                            const decSnap = await getDocs(query(collection(db,'decouvrir'), where('publicLinkId','==',plId)));
                            for (const d of decSnap.docs) await deleteDoc(doc(db,'decouvrir',d.id));
                            alert('Contenu supprimé. Actualisez la page.');
                          } catch(e:any) { alert('Erreur : ' + e.message); }
                        }} style={{ padding:'8px 14px', borderRadius:99, border:'1px solid rgba(240,74,106,0.4)', background:'rgba(240,74,106,0.1)', color:'#ff8095', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <p style={{ color:C.textSoft, fontSize:10, marginTop:8, marginBottom:12, wordBreak:'break-all' }}>{BASE_URL}/ecoute/{link.publicLinkId}</p>
                    {/* QR CODE DU LIEN PUBLIC (fond blanc volontairement conservé — nécessaire à la lisibilité du QR) */}
                    <div style={{ display:'flex', alignItems:'center', gap:16, background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:12, padding:14 }}>
                      <div style={{ background:'white', padding:8, borderRadius:8, flexShrink:0 }}>
                        <QRCodeCanvas
                          id={'pub-qr-'+link.id}
                          value={BASE_URL+'/ecoute/'+link.publicLinkId}
                          size={90} bgColor="#ffffff" fgColor="#000000" level="H"
                        />
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:700, fontSize:13, marginBottom:4, color:C.text }}>QR Code du lien public</p>
                        <p style={{ color:C.textSoft, fontSize:11, marginBottom:10, lineHeight:1.5 }}>Imprimez ce QR code pour que vos fans scannent et écoutent en streaming. Chaque écoute vous rémunère.</p>
                        <button onClick={() => {
                          const canvas = document.getElementById('pub-qr-'+link.id) as HTMLCanvasElement;
                          if (!canvas) return;
                          const a = document.createElement('a');
                          a.href = canvas.toDataURL('image/png');
                          a.download = (link.label||'streaming')+'-QR-public.png';
                          a.click();
                        }} style={{ padding:'8px 14px', borderRadius:99, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>⬇ Télécharger QR PNG</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* POCHETTES */}
            <h3 style={{ fontFamily:'serif', fontSize:16, fontWeight:700, marginBottom:12, color:C.text }}>Mes pochettes ({stats.qrcodes.length})</h3>
            {stats.qrcodes.map((q:any) => (
              <div key={q.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <p style={{ fontWeight:700, marginBottom:4, color:C.text }}>{q.label}</p>
                    <p style={{ color:C.textSoft, fontSize:12 }}>{q.usedScans||0}/{q.totalScans||0} scans · {q.downloads!==undefined?q.downloads:(q.usedScans||0)} DL · {q.streams||0} streams</p>
                  </div>
                  <span style={badgeStyle(q.status)}>{q.status}</span>
                </div>
                <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {[
                    { label:'Visites', val:q.visits||0, color:C.blueLite },
                    { label:'Streams', val:q.streams||0, color:C.gold },
                    { label:'DL', val:q.downloads!==undefined?q.downloads:(q.usedScans||0), color:C.blueLite },
                  ].map((s,i) => (
                    <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:8, textAlign:'center' }}>
                      <p style={{ color:s.color, fontWeight:800, fontSize:18 }}>{s.val}</p>
                      <p style={{ color:C.textSoft, fontSize:10 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* CONFIDENTIALITÉ : Public ⇄ Privé (masque du fil Découvrir sans rien supprimer) */}
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                  <div>
                    <p style={{ fontSize:12, fontWeight:700, color: q.masque ? C.gold : C.blueLite, margin:'0 0 2px' }}>
                      {q.masque ? 'Privé (masqué du fil)' : 'Public (visible dans Découvrir)'}
                    </p>
                    <p style={{ fontSize:10, color:C.textSoft, margin:0 }}>
                      {q.masque ? 'Vos données sont conservées. Repassez en Public quand vous voulez.' : 'Passez en Privé pour masquer sans rien perdre.'}
                    </p>
                  </div>
                  <button onClick={() => basculerPrive(q, !q.masque)} disabled={togglingPrive === q.id}
                    style={{ padding:'8px 16px', borderRadius:99, border:'none', cursor:'pointer', fontWeight:800, fontSize:12,
                      background: q.masque ? 'linear-gradient(135deg,'+C.blue+',#0050d0)' : 'linear-gradient(135deg,'+C.gold+',#f0c050)',
                      color: q.masque ? '#fff' : '#1a2340', opacity: togglingPrive === q.id ? 0.6 : 1, whiteSpace:'nowrap' }}>
                    {togglingPrive === q.id ? '...' : (q.masque ? 'Rendre Public' : 'Rendre Privé')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHANGER MOT DE PASSE (option 2) — visible sur l'onglet Stats */}
        {dashTab === 'stats' && (
          <div style={{ marginTop:20 }}>
            <ChangerMotDePasse />
          </div>
        )}

        {/* ────────── ONGLET VENTES ────────── */}
        {/* ── PUBLIER UN CONTENU ── */}
        {dashTab === 'publier' && <PublierContenuTab user={user} soldeOscart={soldeOscartArtiste} artistName={stats.artistName || user?.displayName || ''} onRecharge={() => setRechargeModalArtiste(RECHARGES[1])} />}

        {/* ── MON MOT ── */}
        {dashTab === 'mot' && <MotArtisteTab user={user} artistName={stats.artistName || user?.displayName || ''} />}
        {dashTab === 'bio' && <BioArtisteTab user={user} artistName={stats.artistName || user?.displayName || ''} coverUrl={stats.qrcodes?.[0]?.coverUrl || ''} />}

        {/* ── POCHETTES PHYSIQUES ── */}
        {dashTab === 'pochettes' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <CommandePochettes user={user} artistName={stats.artistName || user?.displayName || ''}
              contenusValides={(stats.qrcodes || [])} />
            <h3 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:16, color:C.text }}>Mes pochettes physiques</h3>
            {(stats.qrcodes || []).filter((q:any) => q.totalScans > 0).length === 0 ? (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, textAlign:'center', padding:40 }}>
                <p style={{ color:C.textSoft, fontSize:14 }}>Aucune pochette physique enregistrée.</p>
                <p style={{ color:C.textSoft, fontSize:12, marginTop:8 }}>Contactez votre commercial pour commander vos pochettes.</p>
              </div>
            ) : (
              (stats.qrcodes || []).filter((q:any) => q.totalScans > 0).map((q:any) => {
                const scansRestants = (q.totalScans || 0) - (q.usedScans || 0);
                const pct = Math.round(((q.usedScans||0) / (q.totalScans||1)) * 100);
                const nombrePochettes = Math.ceil((q.totalScans||0) / 2); // 2 scans par pochette
                const pochettesVendues = Math.floor((q.usedScans||0) / 2);
                const gainTotal = pochettesVendues * (q.prixVente || 0);
                return (
                  <div key={q.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:16 }}>
                    <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                      {q.coverUrl && <img src={optimImg(q.coverUrl, 120)} style={{ width:56, height:56, borderRadius:10, objectFit:'cover' }} alt="" />}
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:700, fontSize:14, margin:'0 0 2px', color:C.text }}>{q.label}</p>
                        <p style={{ color:C.textSoft, fontSize:12, margin:0 }}>{q.artist}</p>
                      </div>
                    </div>
                    {/* Stats pochettes */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                      {[
                        { label:'Pochettes totales', val:nombrePochettes },
                        { label:'Pochettes vendues', val:pochettesVendues },
                        { label:'Scans restants', val:scansRestants },
                      ].map((s,i) => (
                        <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                          <p style={{ fontWeight:800, fontSize:16, color:C.blueLite, margin:'0 0 2px' }}>{s.val}</p>
                          <p style={{ color:C.textSoft, fontSize:10, margin:0 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Barre progression scans */}
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>Scans utilisés</p>
                        <p style={{ color:C.blueLite, fontSize:11, fontWeight:700, margin:0 }}>{pct}%</p>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:99, height:6, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,'+C.blue+',#5bb0ff)', borderRadius:99 }} />
                      </div>
                    </div>
                    {/* Prix vente + gain */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <p style={{ color:C.textSoft, fontSize:12, margin:0 }}>
                        Prix de vente : <strong style={{ color:C.text }}>{q.prixVente ? q.prixVente.toLocaleString()+' F CFA' : 'Non défini'}</strong>
                      </p>
                      {gainTotal > 0 && (
                        <p style={{ color:C.success, fontSize:13, fontWeight:700, margin:0 }}>
                          +{gainTotal.toLocaleString()} F CFA
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {dashTab === 'signatures' && <SignaturesArtisteTab artistEmail={user.email} />}

        {dashTab === 'notifs' && <NotificationsTab userEmail={user.email} />}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:`radial-gradient(ellipse 900px 500px at 50% -10%, rgba(245,200,76,0.10), transparent), ${C.bgDeep}`, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <style>{`
        .art-inp{width:100%;background:rgba(255,255,255,0.05);border:1px solid ${C.border};border-radius:10px;padding:12px 14px;color:${C.text};font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;}
        .art-inp:focus{border-color:${C.blue}}
        .art-inp::placeholder{color:${C.textSoft}}
      `}</style>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Logo size="lg" />
          <p style={{ color:C.gold, fontWeight:700, fontSize:13, marginTop:8, letterSpacing:0.5 }}>ESPACE ARTISTE</p>
        </div>

        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:24 }}>
          {view === 'login' ? (
            <>
              <h2 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:4, textAlign:'center', color:C.text }}>Connexion</h2>
              <p style={{ color:C.textSoft, fontSize:12, textAlign:'center', marginBottom:20, lineHeight:1.6 }}>
                Connectez-vous avec l'email enregistré par Doniel Zik
              </p>

              {/* Google */}
              <button onClick={async () => {
                setLoading(true); setMsg('');
                try {
                  const provider = new GoogleAuthProvider();
                  const cred = await signInWithPopup(auth, provider);
                  // Vérifier que cet email est dans la liste artistes
                  const snap = await getDocs(query(collection(db, 'artists'), where('email','==', cred.user.email)));
                  if (snap.empty) {
                    await signOut(auth);
                    setMsg('Cet email n\'est pas enregistré comme artiste. Contactez Doniel Zik.');
                  }
                } catch(e:any) { setMsg('Erreur: ' + e.message); }
                setLoading(false);
              }} disabled={loading}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'12px', borderRadius:10, border:'1px solid '+C.border, background:'rgba(255,255,255,0.05)', cursor:'pointer', fontWeight:600, fontSize:14, marginBottom:12, color:C.text }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </button>

              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 12px' }}>
                <div style={{ flex:1, height:1, background:C.border }} />
                <span style={{ color:C.textSoft, fontSize:11 }}>ou</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>

              <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Email</label>
              <input className="art-inp" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com" onKeyDown={e => e.key==='Enter' && login()} />
              <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Mot de passe</label>
              <input className="art-inp" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key==='Enter' && login()} />

              {msg && <p style={{ color: msg.startsWith('Erreur')||msg.startsWith('Cet email') ? C.alert : C.blueLite, fontSize:12, marginBottom:10 }}>{msg}</p>}

              <button style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff' }} onClick={login} disabled={loading}>
                {loading ? 'Vérification...' : 'Se connecter'}
              </button>

              <button onClick={async () => {
                if (!email) { setMsg('Entrez votre email d\'abord'); return; }
                try {
                  await demanderResetPassword(email);
                  setMsg('Email de réinitialisation envoyé à ' + email);
                } catch(e:any) { setMsg('Email introuvable'); }
              }} style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:C.textSoft, cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:4 }}>
                Mot de passe oublié ?
              </button>

              <div style={{ borderTop:'1px solid '+C.border, marginTop:14, paddingTop:14 }}>
                <p style={{ color:C.textSoft, fontSize:11, textAlign:'center', marginBottom:10, lineHeight:1.6 }}>
                  Première connexion ? Créez votre compte avec l'email que vous avez fourni à Doniel Zik.
                </p>
                <button style={{ width:'100%', textAlign:'center', padding:12, borderRadius:10, border:'1px solid '+C.border, background:'transparent', color:C.blueLite, fontWeight:700, fontSize:13, cursor:'pointer' }}
                  onClick={() => { setView('register'); setMsg(''); }}>
                  Créer mon compte artiste →
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:4, textAlign:'center', color:C.text }}>Créer mon compte artiste</h2>
              <p style={{ color:C.textSoft, fontSize:12, textAlign:'center', marginBottom:20, lineHeight:1.6 }}>
                {refParam ? "Bienvenue sur Doniel Zik ! Créez votre compte — votre 1er contenu est OFFERT." : "Utilisez l'email que vous avez communiqué à Doniel Zik lors de votre enregistrement."}
              </p>

              {refParam && (<>
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Nom d'artiste *</label>
                <input className="art-inp" value={artistNom} onChange={e => setArtistNom(e.target.value)} placeholder="Votre nom de scène" />
              </>)}

              <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>{refParam ? 'Votre email *' : 'Email (celui enregistré chez nous) *'}</label>
              <input className="art-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
              <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Choisissez un mot de passe *</label>
              <input className="art-inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" />

              {msg && <p style={{ color: msg.startsWith('Erreur') ? C.alert : C.blueLite, fontSize:12, marginBottom:10 }}>{msg}</p>}

              <button style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff' }} onClick={register} disabled={loading}>
                {loading ? 'Création...' : 'Créer mon compte'}
              </button>

              <button style={{ width:'100%', marginTop:10, textAlign:'center', padding:12, borderRadius:10, border:'1px solid '+C.border, background:'transparent', color:C.blueLite, fontWeight:700, fontSize:13, cursor:'pointer' }}
                onClick={() => { setView('login'); setMsg(''); }}>
                ← Déjà un compte ? Se connecter
              </button>

              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px', marginTop:14 }}>
                <p style={{ color:C.textSoft, fontSize:11, lineHeight:1.7, margin:0 }}>
                  Seuls les artistes dont l'email a été enregistré par Doniel Zik peuvent accéder au dashboard. Si votre email n'est pas reconnu, contactez-nous.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONCOURS KIFS — paliers de prix + estimation des gains de l'artiste
// ─────────────────────────────────────────────
export function ConcoursKifsArtiste({ kifsRecus, gainsKiffementsOscart, gainsTelechargementsOscart, devise }: {
  kifsRecus: number,
  gainsKiffementsOscart: number,
  gainsTelechargementsOscart: number,
  devise: 'fcfa'|'eur'|'usd',
}) {
  const [paliers, setPaliers] = useState(PALIERS_CONCOURS_DEFAUT);

  useEffect(() => {
    // Charger les paliers configurés par l'admin (sinon valeurs par défaut)
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'config'), where('cle','==','concours_paliers')));
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (Array.isArray(data.paliers) && data.paliers.length > 0) setPaliers(data.paliers);
        }
      } catch(e) { /* valeurs par défaut */ }
    })();
  }, []);

  const conv = (oscart: number) => {
    if (devise === 'eur') return `${(oscart * OSCART_TO_EUR).toFixed(2)} €`;
    if (devise === 'usd') return `${(oscart * OSCART_TO_USD).toFixed(2)} $`;
    return `${(oscart * OSCART_TO_FCFA).toLocaleString()} F CFA`;
  };

  // Prochain palier non atteint
  const prochain = paliers.find(p => kifsRecus < p.kifs);
  const dernierAtteint = [...paliers].reverse().find(p => kifsRecus >= p.kifs);

  return (
    <div style={{ marginBottom:20 }}>
      {/* ESTIMATION DES GAINS (kiffements + téléchargements) */}
      <div style={{ ...S.card, padding:20, marginBottom:16, background:'linear-gradient(135deg,#fff8e6,#fff)' }}>
        <p style={{ color:'#b07a00', fontSize:12, fontWeight:700, letterSpacing:0.5, marginBottom:14, textTransform:'uppercase' }}>Estimation de vos gains</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ textAlign:'center', padding:'10px 6px', background:'#fffdf5', borderRadius:12 }}>
            <p style={{ fontSize:20, fontWeight:900, color:'#1a2340', margin:'0 0 2px' }}>{conv(gainsKiffementsOscart)}</p>
            <p style={{ color:'#5a7090', fontSize:11, margin:0 }}>Kiffements reçus</p>
          </div>
          <div style={{ textAlign:'center', padding:'10px 6px', background:'#fffdf5', borderRadius:12 }}>
            <p style={{ fontSize:20, fontWeight:900, color:'#1a2340', margin:'0 0 2px' }}>{conv(gainsTelechargementsOscart)}</p>
            <p style={{ color:'#5a7090', fontSize:11, margin:0 }}>⬇Téléchargements</p>
          </div>
        </div>
        <p style={{ color:'#8098b8', fontSize:10, textAlign:'center', marginTop:10, marginBottom:0 }}>
          Vous touchez 60% de chaque Oscart reçu · 1 Oscart = 10 F CFA
        </p>
      </div>

      {/* CONCOURS KIFS — paliers de prix */}
      <div style={{ ...S.card, padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <p style={{ color:'#1a2340', fontSize:16, fontWeight:800, margin:0 }}>Rémunération Kiffs</p>
          <span style={{ fontSize:13, fontWeight:800, color:'#1a6bff' }}>{kifsRecus.toLocaleString()} kiffs</span>
        </div>
        <p style={{ color:'#5a7090', fontSize:12, margin:'0 0 16px' }}>
          Galvanisez votre communauté ! Plus vous recevez de kiffs, plus vous gagnez de prix.
        </p>

        {/* Barre de progression vers le prochain palier */}
        {prochain && (
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ color:'#5a7090', fontSize:11 }}>Prochain prix : {prochain.icone} {prochain.label}</span>
              <span style={{ color:'#1a6bff', fontSize:11, fontWeight:700 }}>{Math.min(100, Math.round((kifsRecus / prochain.kifs) * 100))}%</span>
            </div>
            <div style={{ height:8, background:'#eef2f9', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.min(100, (kifsRecus / prochain.kifs) * 100)}%`, background:'linear-gradient(90deg,#1a6bff,#5BB0FF)', borderRadius:99 }} />
            </div>
            <p style={{ color:'#8098b8', fontSize:10, margin:'6px 0 0' }}>
              Plus que {(prochain.kifs - kifsRecus).toLocaleString()} kiffs pour débloquer ce prix
            </p>
          </div>
        )}

        {/* Liste des paliers */}
        <div>
          {paliers.map((p, i) => {
            const atteint = kifsRecus >= p.kifs;
            return (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 12px', marginBottom:8, borderRadius:12,
                background: atteint ? '#eaf7ee' : '#f7f9fc',
                border: atteint ? '1px solid #34c759' : '1px solid #eef2f9',
              }}>
                <span style={{ fontSize:26, flexShrink:0 }}>{p.icone}</span>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#1a2340', fontSize:14, fontWeight:700, margin:'0 0 2px' }}>{p.label}</p>
                  <p style={{ color:'#5a7090', fontSize:11, margin:0 }}>{p.kifs.toLocaleString()} kiffs</p>
                </div>
                {atteint
                  ? <span style={{ color:'#34c759', fontSize:12, fontWeight:800 }}>✓ Atteint</span>
                  : <span style={{ color:'#b0bccd', fontSize:11 }}>En cours</span>}
              </div>
            );
          })}
        </div>

        {dernierAtteint && (
          <p style={{ color:'#34c759', fontSize:12, fontWeight:700, textAlign:'center', marginTop:12, marginBottom:0 }}>
            Vous avez débloqué : {dernierAtteint.icone} {dernierAtteint.label}
          </p>
        )}
      </div>
    </div>
  );
}

export function NotificationsTab({ userEmail }: { userEmail: string }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [cadeaux, setCadeaux] = useState<any[]>([]);
  const [openFan, setOpenFan] = useState<string | null>(null);
  const [permNotif, setPermNotif] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    // Notifs classiques (commentaires, mots validés...) — SAUF kiffements (gérés à part, groupés)
    const unsub = onSnapshot(
      query(collection(db, 'notifications'), where('to','==', userEmail), orderBy('createdAt','desc')),
      async snap => {
        const docs = snap.docs.filter(d => {
          const r = d.data().role;
          const okRole = (r === 'artiste' || r === undefined || r === null);
          return okRole && d.data().type !== 'kiffement'; // kiffements regroupés plus bas
        });
        setNotifs(docs.map(d => ({id:d.id,...d.data()})));
        for (const d of docs) {
          if (!d.data().lu) await updateDoc(doc(db,'notifications',d.id),{lu:true});
        }
      }
    );
    // Kiffements (cadeaux) reçus — pour regroupement par mélomane
    const unsub2 = onSnapshot(
      query(collection(db, 'cadeaux'), where('artistEmail','==', userEmail)),
      snap => setCadeaux(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { unsub(); unsub2(); };
  }, [userEmail]);

  // Regrouper les cadeaux par mélomane
  const parFan: Record<string, { nom:string, total:number, types:Record<string,number>, dernier:string }> = {};
  for (const c of cadeaux) {
    const nom = c.userName || 'Un fan';
    if (!parFan[nom]) parFan[nom] = { nom, total:0, types:{}, dernier:c.createdAt };
    parFan[nom].total += 1;
    const lab = c.kiffementLabel || 'Cadeau';
    parFan[nom].types[lab] = (parFan[nom].types[lab] || 0) + 1;
    if (c.createdAt > parFan[nom].dernier) parFan[nom].dernier = c.createdAt;
  }
  const fans = Object.values(parFan).sort((a,b) => (b.dernier > a.dernier ? 1 : -1));

  const getIcon = (type: string) => {
    if (type === 'commentaire') return '';
    if (type === 'kiffement') return '';
    if (type === 'like') return '❤';
    return '';
  };

  const rien = notifs.length === 0 && fans.length === 0;

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:20, color:C.text }}>Notifications</h2>

      {/* Activation des notifications système — voir explication côté mélomane */}
      {permNotif === 'default' && (
        <div style={{ marginBottom:20, background:'rgba(93,132,255,0.1)', border:'1px solid rgba(93,132,255,0.3)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🔔</span>
          <div style={{ flex:1 }}>
            <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:'0 0 2px' }}>Activer les notifications</p>
            <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>Pour être alerté quand un fan kiffe, commente, ou vous envoie un cadeau.</p>
          </div>
          <button onClick={() => { activerNotificationsPush(userEmail).then(p => setPermNotif(p)); }}
            style={{ padding:'8px 14px', borderRadius:99, border:'none', background:C.blue, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            Activer
          </button>
        </div>
      )}
      {permNotif === 'denied' && (
        <div style={{ marginBottom:20, background:'rgba(255,100,124,0.1)', border:'1px solid rgba(255,100,124,0.3)', borderRadius:12, padding:'12px 16px' }}>
          <p style={{ color:C.alert, fontSize:12, margin:0, lineHeight:1.6 }}>Les notifications sont bloquées pour cette application. Pour les activer, va dans les réglages du téléphone → Applications → Doniel Zik → Notifications.</p>
        </div>
      )}

      {/* KIFFEMENTS REÇUS — groupés par mélomane */}
      {fans.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <p style={{ color:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>Kiffements reçus</p>
          {fans.map((f, i) => (
            <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:10, cursor:'pointer' }}
              onClick={() => setOpenFan(openFan === f.nom ? null : f.nom)}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:14, margin:'0 0 2px', color:C.text }}>{f.nom} vous a envoyé des kiffements</p>
                  <p style={{ color:C.textSoft, fontSize:12, margin:0 }}>{f.total} kiffement{f.total>1?'s':''} au total · touchez pour voir le détail</p>
                </div>
                <span style={{ color:C.textSoft, fontSize:16, transform: openFan === f.nom ? 'rotate(90deg)' : 'none', transition:'transform .2s' }}>›</span>
              </div>
              {/* Déroulé : détail par type de cadeau */}
              {openFan === f.nom && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid '+C.border }}>
                  {Object.entries(f.types).sort((a,b)=>b[1]-a[1]).map(([lab, nb], j) => (
                    <div key={j} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0' }}>
                      <span style={{ color:C.text, fontSize:13 }}>{lab}</span>
                      <span style={{ color:C.blueLite, fontSize:14, fontWeight:800 }}>×{nb}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AUTRES NOTIFS (commentaires, mots validés...) */}
      {notifs.length > 0 && (
        <div>
          <p style={{ color:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>Activité</p>
          {notifs.map(n => (
            <div key={n.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:10, borderLeft:`3px solid ${n.lu?'transparent':C.blue}`, opacity: n.lu ? 0.7 : 1 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <span style={{ fontSize:24, flexShrink:0 }}>{getIcon(n.type)}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600, fontSize:14, margin:'0 0 2px', color:C.text }}>{n.text}</p>
                  {n.from && <p style={{ color:C.textSoft, fontSize:12, margin:'0 0 4px' }}>De : {n.from}</p>}
                  <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>{new Date(n.createdAt).toLocaleDateString('fr')} à {new Date(n.createdAt).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                {!n.lu && <span style={{ width:8, height:8, borderRadius:99, background:C.blue, flexShrink:0, marginTop:4 }} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {rien && (
        <div style={{ textAlign:'center', padding:40 }}>
          <p style={{ color:C.textSoft, fontSize:14 }}>Aucune notification pour l'instant</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DECOUVRIR STAT — stats sous chaque contenu
// ─────────────────────────────────────────────
export function DiscouvrirStat({ qrId, buzz, partages }: { qrId: string, buzz: number, partages?: number }) {
  const [kiffs, setKiffs] = useState(0);
  const [comments, setComments] = useState(0);
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    if (!qrId) return;
    // getDocs au lieu de onSnapshot pour éviter les requêtes temps réel
    getDoc(doc(db,'kiffs_compteur', qrId)).then(s => setKiffs(s.exists() ? (s.data().total || 0) : 0));
    getDocs(query(collection(db,'commentaires'),where('qrId','==',qrId))).then(s => setComments(s.size));
    getDocs(query(collection(db,'cadeaux'),where('qrId','==',qrId))).then(s => {
      setCoins(s.docs.reduce((t,d) => t+(d.data().coins||0),0));
    });
  }, [qrId]);

  const stat = (label: string, val: number) => (
    <span style={{ color:'#4a5878', fontSize:11, display:'flex', alignItems:'center', gap:3 }}>
      <span style={{ fontWeight:700, color:'#8098b8' }}>{val.toLocaleString()}</span> {label}
    </span>
  );

  return <>
    {stat('Kiffs', kiffs)}
    {stat('Commentaires', comments)}
    {coins > 0 && stat('Oscart', coins)}
    {stat('Buzz', buzz)}
    {stat('Partages', partages || 0)}
  </>;
}

// ─────────────────────────────────────────────
// PAGE DÉCOUVRIR — /decouvrir — style Suno/TikTok
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// CATÉGORIES MUSICALES ET VIDÉO
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// AUTO-PLAY MEDIA — lecture automatique au scroll (style TikTok/Facebook)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PUBLIER UN CONTENU — soumission par l'artiste
// ─────────────────────────────────────────────

export function PublierContenuTab({ user, soldeOscart, artistName, onRecharge }: any) {
  const [mode, setMode] = useState<'simple'|'sortie'>('simple');
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<'single'|'album'|'video'|'serie'>('single');
  const [categorie, setCategorie] = useState('autres');
  const [file, setFile] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [mesSubmissions, setMesSubmissions] = useState<any[]>([]);
  const [pochetteUrl, setPochetteUrl] = useState('');
  const [uploadingPoch, setUploadingPoch] = useState(false);
  const [premierGratuit, setPremierGratuit] = useState(false);
  // Champs sortie programmée
  const [dateSortie, setDateSortie] = useState('');
  const [objTelech, setObjTelech] = useState('');
  const [objCadeaux, setObjCadeaux] = useState('');
  const [prixMusique, setPrixMusique] = useState('');
  // Outil de découpe du teaser (extrait pour la sortie officielle)
  const [teaserDebut, setTeaserDebut] = useState(0);      // point de départ en secondes
  const [teaserDuree, setTeaserDuree] = useState(30);     // durée de l'extrait (15/30/45/60)
  const [dureeTotale, setDureeTotale] = useState(0);      // durée totale du fichier uploadé
  const [descSortie, setDescSortie] = useState('');       // description du titre (sortie officielle)

  const prix = PRIX_PUBLICATION[type].oscart;
  const estVideo = type === 'video' || type === 'serie';
  const cats = estVideo ? CATEGORIES_VIDEO : CATEGORIES_AUDIO;

  useEffect(() => {
    if (!user?.email) return;
    const unsub = onSnapshot(
      query(collection(db,'soumissions'), where('artistEmail','==',user.email), orderBy('createdAt','desc')),
      snap => setMesSubmissions(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [user?.email]);

  // 1er contenu offert ? (artiste parrainé par un commercial)
  useEffect(() => {
    if (!user?.email) return;
    getDocs(query(collection(db,'artists'), where('email','==',user.email))).then(snap => {
      if (!snap.empty) setPremierGratuit(snap.docs[0].data().premierContenuGratuit === true);
    }).catch(() => {});
  }, [user?.email]);

  const uploadFichier = async (f: File) => {
    setUploading(true); setMsg('Upload en cours...');
    try {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      // Compte Cloudinary principal (le même que l'admin, qui fonctionne)
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method:'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setFileUrl(data.secure_url); setFile(f); setMsg('Fichier prêt.');
        if (data.duration) { setDureeTotale(Math.floor(data.duration)); }
        else {
          try {
            const el = document.createElement(estVideo ? 'video' : 'audio');
            el.preload = 'metadata';
            el.onloadedmetadata = () => { if (el.duration && isFinite(el.duration)) setDureeTotale(Math.floor(el.duration)); };
            el.src = data.secure_url;
          } catch {}
        }
      }
      else {
        const raison = data?.error?.message || 'réponse inattendue';
        setMsg('Erreur upload : ' + raison);
        console.error('Cloudinary upload error', data);
      }
    } catch(e:any) { setMsg('Erreur réseau : ' + (e?.message || 'connexion')); console.error(e); }
    setUploading(false);
  };

  // Construit l'URL Cloudinary DÉCOUPÉE (extrait) : Cloudinary coupe côté serveur,
  // le fichier complet n'est JAMAIS exposé au navigateur → impossible à aspirer.
  const construireTeaserUrl = (urlComplete: string, debut: number, duree: number): string => {
    if (!urlComplete || !urlComplete.includes('/upload/')) return urlComplete;
    const transfo = `so_${debut},du_${duree}`;
    return urlComplete.replace('/upload/', `/upload/${transfo}/`);
  };

  const uploadPochette = async (f: File) => {
    setUploadingPoch(true); setMsg('Upload pochette en cours...');
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const data = await res.json();
      console.log('POCHETTE Cloudinary réponse:', data);
      if (data.secure_url) { setPochetteUrl(data.secure_url); setMsg('Pochette chargée.'); }
      else {
        const raison = data?.error?.message || JSON.stringify(data).slice(0,120);
        setMsg('Erreur pochette : ' + raison);
      }
    } catch(e:any) { setMsg('Erreur réseau pochette : ' + (e?.message||'')); console.error(e); }
    setUploadingPoch(false);
  };

  const soumettre = async () => {
    if (!titre.trim()) { setMsg('Entrez le titre du contenu'); return; }
    if (!fileUrl) { setMsg('Ajoutez votre fichier'); return; }
    const coutReel = premierGratuit ? 0 : prix;
    if (!premierGratuit && soldeOscart < prix) { setMsg(`Solde insuffisant. Il vous faut ${prix} Oscart. Rechargez votre portefeuille.`); return; }
    try {
      // Débiter les Oscart (sauf 1er contenu offert)
      if (!premierGratuit) {
        const soldeSnap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
        if (!soldeSnap.empty) {
          const docRef = soldeSnap.docs[0];
          await updateDoc(doc(db,'coins_solde',docRef.id), { solde: (docRef.data().solde||0) - prix });
          logTx(user.uid, 'publication', -prix, 0, 'Publication de contenu');
        }
      }
      // Créer la soumission (statut en attente)
      await addDoc(collection(db,'soumissions'), {
        artistEmail: user.email, artistName, artistUid: user.uid,
        titre: titre.trim(), type, categorie, fileUrl, pochetteUrl,
        prixPaye: coutReel, gratuit: premierGratuit, statut: 'en_attente',
        createdAt: new Date().toISOString(),
      });
      // 1er contenu offert : on désactive la gratuité pour la suite
      if (premierGratuit) {
        const aSnap = await getDocs(query(collection(db,'artists'), where('email','==',user.email)));
        if (!aSnap.empty) await updateDoc(doc(db,'artists',aSnap.docs[0].id), { premierContenuGratuit: false });
        setPremierGratuit(false);
      }
      // Notifier l'admin
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'soumission',
        text: `Nouvelle soumission de ${artistName} : "${titre.trim()}" (${PRIX_PUBLICATION[type].label}). À écouter et valider.`,
        lien: fileUrl, createdAt: new Date().toISOString(),      });
      setMsg('Soumis ! Votre contenu sera écouté et validé sous peu.');
      setTitre(''); setFile(null); setFileUrl(''); setPochetteUrl('');
    } catch(e:any) { setMsg('Erreur : ' + e.message); }
  };

  const soumettreSortie = async () => {
    if (!titre.trim()) { setMsg('Entrez le titre'); return; }
    if (!fileUrl) { setMsg('Ajoutez votre fichier complet'); return; }
    if (!dateSortie) { setMsg('Indiquez la date de sortie officielle'); return; }
    if (!prixMusique || parseInt(prixMusique) <= 0) { setMsg('Indiquez le prix du téléchargement (en FCFA)'); return; }
    try {
      // L'URL teaser est l'extrait DÉCOUPÉ par Cloudinary (le fichier complet n'est jamais exposé avant le jour J)
      const teaserDecoupe = construireTeaserUrl(fileUrl, teaserDebut, teaserDuree);
      await addDoc(collection(db,'soumissions'), {
        artistEmail: user.email, artistName, artistUid: user.uid,
        titre: titre.trim(), type, categorie,
        fileUrl: teaserDecoupe,          // ce qui est public AVANT le jour J = l'extrait découpé
        fichierComplet: fileUrl,         // l'original complet, gardé pour le jour J (non exposé au public)
        teaserDebut, teaserDuree,        // paramètres de l'extrait
        pochetteUrl: pochetteUrl || '',  // pochette affichée sur la carte sortie
        description: descSortie.trim(),  // description du titre
        estSortie: true,
        dateSortie,
        objTelech: parseInt(objTelech) || 0,
        objCadeaux: parseInt(objCadeaux) || 0,
        cadeauxRecus: 0,
        prixMusique: parseInt(prixMusique),
        prixOscart: Math.round(parseInt(prixMusique) / 10),
        statut: 'en_attente',
        createdAt: new Date().toISOString(),
      });
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'soumission',
        text: `SORTIE PROGRAMMÉE de ${artistName} : "${titre.trim()}" — sortie le ${dateSortie}. À valider.`,
        lien: teaserDecoupe, createdAt: new Date().toISOString(),      });
      setMsg('Sortie programmée soumise ! Elle sera validée puis publiée dans "Sortie officielle".');
      setTitre(''); setFile(null); setFileUrl(''); setDateSortie(''); setObjTelech(''); setObjCadeaux(''); setPrixMusique('');
      setTeaserDebut(0); setTeaserDuree(30); setDureeTotale(0); setDescSortie(''); setPochetteUrl('');
    } catch(e:any) { setMsg('Erreur : ' + e.message); }
  };

  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <h3 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:6, color:C.text }}>Enregistrer un contenu</h3>
      <p style={{ color:C.textSoft, fontSize:13, marginBottom:16, lineHeight:1.6 }}>
        Enregistrez votre musique ou vidéo sur la plateforme. Vous devez figurer dans le contenu (featuring accepté). Après écoute et validation par notre équipe, votre QR public et votre lien seront générés — vous pourrez alors les partager et publier.
      </p>

      {/* SÉLECTEUR DE MODE */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={() => { setMode('simple'); setMsg(''); }}
          style={{ flex:1, padding:'12px', borderRadius:12, border:`2px solid ${mode==='simple'?C.blue:C.border}`, background:mode==='simple'?'rgba(93,132,255,0.12)':'transparent', color:mode==='simple'?C.blueLite:C.textSoft, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          Enregistrement simple
        </button>
        <button onClick={() => { setMode('sortie'); setMsg(''); }}
          style={{ flex:1, padding:'12px', borderRadius:12, border:`2px solid ${mode==='sortie'?C.gold:C.border}`, background:mode==='sortie'?'rgba(245,200,76,0.12)':'transparent', color:mode==='sortie'?C.gold:C.textSoft, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          Programmer une sortie
        </button>
      </div>

      {mode === 'sortie' && (
        <div style={{ background:'rgba(245,200,76,0.08)', border:'1px solid rgba(245,200,76,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
          <p style={{ color:C.gold, fontSize:12, margin:0, lineHeight:1.6 }}>
            Programmez la sortie officielle de votre œuvre. Vous chargez votre <strong>fichier complet</strong>, puis vous choisissez un <strong>extrait teaser</strong> (15s à 1 min) que les fans découvrent en streaming. Ils réservent leur téléchargement en payant à l'avance. Le jour J, le fichier complet est débloqué automatiquement pour tous ceux qui ont réservé — et il reste protégé jusque-là.
          </p>
        </div>
      )}

      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:24 }}>
        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Titre du contenu *</label>
        <input className="art-inp" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Mon nom — Titre (feat. ...)" />

        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Type de publication *</label>
        <select className="art-inp" value={type} onChange={e => { setType(e.target.value as any); setCategorie('autres'); }}>
          {Object.entries(PRIX_PUBLICATION).map(([k,v]) => (
            <option key={k} value={k}>{v.label} — {v.oscart} Oscart</option>
          ))}
        </select>

        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Catégorie *</label>
        <select className="art-inp" value={categorie} onChange={e => setCategorie(e.target.value)}>
          {cats.filter((c:any) => c.id !== 'tous').map((c:any) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>{mode === 'sortie' ? `Fichier complet (${estVideo ? 'vidéo' : 'audio'}) *` : `Fichier (${estVideo ? 'vidéo' : 'audio'}) *`}</label>
        <input type="file" accept={estVideo ? 'video/*' : 'audio/*'} id="inputFichierContenu"
          onChange={e => e.target.files?.[0] && uploadFichier(e.target.files[0])}
          style={{ display:'none' }} />
        <label htmlFor="inputFichierContenu" style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
          border:`2px dashed ${fileUrl ? C.success : C.blue}`, borderRadius:12, padding:'22px 14px',
          background: fileUrl ? 'rgba(0,212,154,0.08)' : 'rgba(93,132,255,0.08)', cursor:'pointer', textAlign:'center', marginBottom:6 }}>
          <span style={{ fontSize:13, fontWeight:800, color:C.blueLite }}>{uploading ? 'Envoi...' : fileUrl ? 'OK' : 'FICHIER'}</span>
          <span style={{ fontSize:13, fontWeight:700, color: fileUrl ? C.success : C.blueLite }}>
            {uploading ? 'Upload en cours...' : fileUrl ? 'Fichier chargé — cliquez pour changer' : `Cliquez pour choisir votre ${estVideo ? 'vidéo' : 'audio'}`}
          </span>
          <span style={{ fontSize:11, color:C.textSoft }}>
            {file?.name ? file.name : (estVideo ? 'Formats vidéo acceptés' : 'Formats audio acceptés (MP3, WAV...)')}
          </span>
        </label>
        {fileUrl && <p style={{ color:C.success, fontSize:12 }}>Fichier ajouté{mode === 'sortie' && dureeTotale > 0 ? ` — durée ${Math.floor(dureeTotale/60)}:${String(dureeTotale%60).padStart(2,'0')}` : ''}</p>}

        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Pochette (image carrée — affichée sur la fan page)</label>
        <input type="file" accept="image/*" id="inputPochetteContenu"
          onChange={e => e.target.files?.[0] && uploadPochette(e.target.files[0])}
          style={{ display:'none' }} />
        <label htmlFor="inputPochetteContenu" style={{
          display:'flex', alignItems:'center', gap:14,
          border:`2px dashed ${pochetteUrl ? C.success : C.blue}`, borderRadius:12, padding:'12px 14px',
          background: pochetteUrl ? 'rgba(0,212,154,0.08)' : 'rgba(93,132,255,0.08)', cursor:'pointer', marginBottom:6 }}>
          {pochetteUrl ? (
            <img src={pochetteUrl} alt="pochette" style={{ width:64, height:64, objectFit:'cover', borderRadius:10, flexShrink:0 }} />
          ) : (
            <div style={{ width:64, height:64, borderRadius:10, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:800, color:C.textSoft }}>IMG</div>
          )}
          <div>
            <p style={{ fontSize:13, fontWeight:700, color: pochetteUrl ? C.success : C.blueLite, margin:'0 0 2px' }}>
              {uploadingPoch ? 'Upload de la pochette...' : pochetteUrl ? 'Pochette chargée — cliquez pour changer' : 'Cliquez pour ajouter une pochette'}
            </p>
            <p style={{ fontSize:11, color:C.textSoft, margin:0 }}>Image carrée recommandée (JPG, PNG)</p>
          </div>
        </label>

        {/* Coût */}
        {mode === 'sortie' ? (
          <div style={{ marginTop:14 }}>
            <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Description du titre (affichée sur la carte sortie)</label>
            <textarea className="art-inp" style={{ minHeight:64, resize:'vertical' }} value={descSortie} onChange={e => setDescSortie(e.target.value)}
              placeholder="Ex : Un titre puissant inspiré par la grâce et la fidélité..." />

            <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Date de sortie officielle *</label>
            <input className="art-inp" type="date" value={dateSortie} onChange={e => setDateSortie(e.target.value)} />

            {/* ───── OUTIL DE DÉCOUPE DU TEASER ───── */}
            {fileUrl && (
              <div style={{ background:'rgba(93,132,255,0.08)', border:'1px solid rgba(93,132,255,0.25)', borderRadius:14, padding:16, margin:'14px 0' }}>
                <p style={{ color:C.blueLite, fontSize:13, fontWeight:800, margin:'0 0 4px' }}>Créer l'extrait teaser</p>
                <p style={{ color:C.textSoft, fontSize:11, lineHeight:1.6, margin:'0 0 14px' }}>
                  Choisissez le passage que le public écoutera <strong>avant la sortie</strong>. Le fichier complet reste protégé : il ne sera débloqué que le jour J pour ceux qui ont réservé.
                </p>

                {/* Durée de l'extrait */}
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Durée de l'extrait</label>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  {[15,30,45,60].map(d => (
                    <button key={d} type="button" onClick={() => setTeaserDuree(d)}
                      style={{ flex:1, padding:'10px 4px', borderRadius:10, border:`2px solid ${teaserDuree===d?C.blue:C.border}`, background:teaserDuree===d?'rgba(93,132,255,0.15)':'transparent', color:teaserDuree===d?C.blueLite:C.textSoft, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                      {d === 60 ? '1 min' : d + 's'}
                    </button>
                  ))}
                </div>

                {/* Point de départ */}
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>
                  Début de l'extrait : <span style={{ color:C.blueLite, fontWeight:800 }}>{Math.floor(teaserDebut/60)}:{String(teaserDebut%60).padStart(2,'0')}</span>
                </label>
                {dureeTotale > 0 ? (
                  <>
                    <input type="range" min={0} max={Math.max(0, dureeTotale - teaserDuree)} value={teaserDebut}
                      onChange={e => setTeaserDebut(parseInt(e.target.value))}
                      style={{ width:'100%', accentColor:C.blue, marginBottom:6 }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.textSoft, marginBottom:12 }}>
                      <span>Début 0:00</span>
                      <span>Fin {Math.floor(dureeTotale/60)}:{String(dureeTotale%60).padStart(2,'0')}</span>
                    </div>
                  </>
                ) : (
                  <p style={{ color:C.textSoft, fontSize:11, marginBottom:12 }}>Lecture de la durée du fichier... (ou réglez le début manuellement ci-dessous)</p>
                )}

                {/* Réglage manuel du début (secours) */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <span style={{ fontSize:11, color:C.textSoft }}>Début (secondes) :</span>
                  <input type="number" min={0} value={teaserDebut} onChange={e => setTeaserDebut(Math.max(0, parseInt(e.target.value)||0))}
                    className="art-inp" style={{ width:90, padding:'6px 10px', margin:0 }} />
                </div>

                {/* Aperçu de l'extrait */}
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Aperçu de l'extrait ({teaserDuree === 60 ? '1 min' : teaserDuree+'s'})</label>
                {estVideo ? (
                  <video key={`${teaserDebut}-${teaserDuree}`} src={construireTeaserUrl(fileUrl, teaserDebut, teaserDuree)} controls playsInline
                    style={{ width:'100%', maxHeight:200, background:'#000', borderRadius:10 }} />
                ) : (
                  <audio key={`${teaserDebut}-${teaserDuree}`} src={construireTeaserUrl(fileUrl, teaserDebut, teaserDuree)} controls
                    style={{ width:'100%' }} />
                )}
                <p style={{ color:C.success, fontSize:11, margin:'8px 0 0' }}>✓ C'est cet extrait que le public {estVideo ? 'verra' : 'entendra'} avant la sortie.</p>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Objectif téléchargements</label>
                <input className="art-inp" type="number" min="0" value={objTelech} onChange={e => setObjTelech(e.target.value)} placeholder="Ex: 100000" />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Objectif kiffements</label>
                <input className="art-inp" type="number" min="0" value={objCadeaux} onChange={e => setObjCadeaux(e.target.value)} placeholder="Ex: 50000" />
              </div>
            </div>

            <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Prix du téléchargement (FCFA) *</label>
            <input className="art-inp" type="number" min="0" value={prixMusique} onChange={e => setPrixMusique(e.target.value)} placeholder="Ex: 2000" />
            {prixMusique && <p style={{ color:C.textSoft, fontSize:11, margin:'4px 0 0' }}>Soit {Math.round(parseInt(prixMusique||'0')/10)} Oscart par réservation. L'artiste touche 70%.</p>}

            {msg && <p style={{ color: msg.startsWith('Erreur')||msg.startsWith('Solde') ? C.alert : C.success, fontSize:12, margin:'12px 0' }}>{msg}</p>}

            <button onClick={soumettreSortie} disabled={uploading} style={{ width:'100%', padding:14, marginTop:8, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.gold+',#f0c050)', color:'#1a2340' }}>
              {uploading ? 'Patientez...' : 'Soumettre la sortie programmée'}
            </button>
          </div>
        ) : (
          <>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px', margin:'14px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:C.textSoft, fontSize:13 }}>Coût de publication</span>
            <span style={{ color:C.blueLite, fontWeight:800, fontSize:16 }}>{premierGratuit ? 'OFFERT' : prix+' Oscart'}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
            <span style={{ color:C.textSoft, fontSize:11 }}>Votre solde</span>
            <span style={{ color: soldeOscart >= prix ? C.success : C.alert, fontWeight:700, fontSize:13 }}>{soldeOscart} Oscart</span>
          </div>
        </div>

        {msg && <p style={{ color: msg.startsWith('Erreur')||msg.startsWith('Solde') ? C.alert : C.success, fontSize:12, marginBottom:10 }}>{msg}</p>}

        {(!premierGratuit && soldeOscart < prix) ? (
          <button onClick={onRecharge} style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:C.gold, color:'#1a2340' }}>
            Recharger mes Oscart ({prix} requis)
          </button>
        ) : (
          <button onClick={soumettre} disabled={uploading || uploadingPoch}
            style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff' }}>
            {uploading ? 'Patientez...' : premierGratuit ? 'Soumettre — 1er contenu OFFERT' : `Soumettre (${prix} Oscart)`}
          </button>
        )}
          </>
        )}
      </div>

      {/* Mes soumissions */}
      {mesSubmissions.length > 0 && (
        <div style={{ marginTop:20 }}>
          <h4 style={{ fontWeight:800, fontSize:15, marginBottom:12, color:C.text }}>Mes soumissions</h4>
          {mesSubmissions.map(s => (
            <div key={s.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:'16px 20px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:700, fontSize:14, margin:'0 0 2px', color:C.text }}>{s.titre}</p>
                <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>{PRIX_PUBLICATION[s.type as keyof typeof PRIX_PUBLICATION]?.label || s.type}</p>
              </div>
              <span style={{
                borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:700,
                background: s.statut==='valide'?'rgba(0,212,154,0.15)':s.statut==='refuse'?'rgba(255,100,124,0.15)':'rgba(245,200,76,0.15)',
                color: s.statut==='valide'?C.success:s.statut==='refuse'?C.alert:C.gold,
              }}>
                {s.statut==='valide'?'Validé':s.statut==='refuse'?'Refusé':'En attente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LE MOT DE L'ARTISTE — message professionnel (présentation, promo, événement)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// COMMANDE DE POCHETTES PHYSIQUES
// ─────────────────────────────────────────────
export const PRIX_CREA_POCHETTE = 5000; // conception graphique par notre équipe

export function CommandePochettes({ user, artistName, contenusValides }: any) {
  const [contenuId, setContenuId] = useState('');
  const [nbPochettes, setNbPochettes] = useState('100');
  const [nbScans, setNbScans] = useState('1');
  const [creaParNous, setCreaParNous] = useState(false);
  const [qrPosition, setQrPosition] = useState<'bas-gauche'|'bas-droite'>('bas-droite');
  const [photoUrl, setPhotoUrl] = useState('');
  const [infos, setInfos] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [mesCommandes, setMesCommandes] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = onSnapshot(
      query(collection(db,'commandes_pochettes'), where('artistEmail','==',user.email), orderBy('createdAt','desc')),
      snap => setMesCommandes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [user?.email]);

  const uploadPhoto = async (f: File) => {
    setUploading(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) { setPhotoUrl(data.secure_url); setMsg('Photo ajoutée.'); }
      else setMsg('Erreur upload.');
    } catch { setMsg('Erreur upload.'); }
    setUploading(false);
  };

  const commander = async () => {
    if (!contenuId) { setMsg('Choisissez le contenu concerné'); return; }
    const nbP = parseInt(nbPochettes) || 0;
    const nbS = parseInt(nbScans) || 1;
    if (nbP < 1) { setMsg('Indiquez le nombre de pochettes'); return; }
    if (creaParNous && !photoUrl) { setMsg('Ajoutez une photo pour la conception'); return; }
    try {
      const contenu = contenusValides.find((c:any) => c.id === contenuId);
      await addDoc(collection(db,'commandes_pochettes'), {
        artistEmail: user.email, artistName,
        contenuId, contenuTitre: contenu?.label || contenu?.titre || '',
        nbPochettes: nbP, nbScans: nbS,
        qrPosition, creaParNous, coutCrea: creaParNous ? PRIX_CREA_POCHETTE : 0,
        photoUrl: creaParNous ? photoUrl : '',
        infos: infos.trim(),
        statut: 'nouvelle',
        createdAt: new Date().toISOString(),
      });
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'commande_pochette',
        text: `${artistName} commande ${nbP} pochettes${creaParNous ? ' + conception (5000 F)' : ''}.`,
        createdAt: new Date().toISOString(),      });
      setMsg('Commande envoyée ! Nous vous recontactons pour le paiement et la livraison.');
      setNbPochettes('100'); setNbScans('1'); setCreaParNous(false); setPhotoUrl(''); setInfos('');
    } catch(e:any) { setMsg('Erreur : ' + e.message); }
  };

  return (
    <div style={{ background:C.card, border:'2px solid '+C.blue, borderRadius:16, padding:24, marginBottom:20 }}>
      <h4 style={{ fontWeight:800, fontSize:16, color:C.blueLite, margin:'0 0 6px' }}>Commander des pochettes physiques</h4>
      <p style={{ color:C.textSoft, fontSize:12, marginBottom:14, lineHeight:1.6 }}>
        Vos pochettes sont au format carré, avec votre QR code en bas et les informations techniques au dos. Vos fans scannent et téléchargent directement votre musique.
      </p>

      {/* Exemple visuel recto/verso */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ flex:1, aspectRatio:'1', background:'linear-gradient(135deg,#0a1535,#1e3a6e)', borderRadius:10, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:'rgba(255,255,255,0.4)', fontSize:10, position:'absolute', top:8, left:8 }}>RECTO</span>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11, textAlign:'center', padding:8 }}>Visuel + titre</span>
          <div style={{ position:'absolute', bottom:8, right:8, width:28, height:28, background:'#fff', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#000' }}>QR</div>
        </div>
        <div style={{ flex:1, aspectRatio:'1', background:'rgba(255,255,255,0.04)', border:'1px dashed '+C.border, borderRadius:10, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:C.textSoft, fontSize:10, position:'absolute', top:8, left:8 }}>VERSO</span>
          <span style={{ color:C.textSoft, fontSize:10, textAlign:'center', padding:8, lineHeight:1.4 }}>Infos techniques :<br/>intervenants, crédits, contact</span>
        </div>
      </div>

      <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Contenu concerné *</label>
      <select className="art-inp" value={contenuId} onChange={e => setContenuId(e.target.value)}>
        <option value="">— Choisir —</option>
        {contenusValides.map((c:any) => <option key={c.id} value={c.id}>{c.label || c.titre}</option>)}
      </select>

      <div style={{ display:'flex', gap:10 }}>
        <div style={{ flex:1 }}>
          <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Nombre de pochettes *</label>
          <input className="art-inp" type="number" min="1" value={nbPochettes} onChange={e => setNbPochettes(e.target.value)} />
        </div>
        <div style={{ flex:1 }}>
          <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Scans par pochette *</label>
          <input className="art-inp" type="number" min="1" value={nbScans} onChange={e => setNbScans(e.target.value)} />
        </div>
      </div>

      <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Position du QR code</label>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['bas-droite','En bas à droite'],['bas-gauche','En bas à gauche']].map(([k,l]) => (
          <button key={k} onClick={() => setQrPosition(k as any)}
            style={{ flex:1, padding:10, borderRadius:8, border:`2px solid ${qrPosition===k?C.blue:C.border}`, background:qrPosition===k?'rgba(93,132,255,0.15)':'transparent', color:qrPosition===k?C.blueLite:C.textSoft, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Option conception */}
      <div style={{ background:'rgba(245,200,76,0.08)', border:'1px solid rgba(245,200,76,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
          <input type="checkbox" checked={creaParNous} onChange={e => setCreaParNous(e.target.checked)} style={{ marginTop:3 }} />
          <span>
            <span style={{ fontWeight:700, fontSize:13, color:C.text }}>Concevez ma pochette (+{PRIX_CREA_POCHETTE.toLocaleString()} F)</span>
            <span style={{ display:'block', color:C.gold, fontSize:11, marginTop:2 }}>Notre équipe crée votre pochette. Envoyez une photo et vos informations.</span>
          </span>
        </label>
      </div>

      {creaParNous && (
        <>
          <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Votre photo *</label>
          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} className="art-inp" style={{ padding:8 }} />
          {uploading && <p style={{ color:C.blueLite, fontSize:12 }}>Upload...</p>}
          {photoUrl && <img src={photoUrl} style={{ width:60, height:60, borderRadius:8, objectFit:'cover', margin:'4px 0' }} alt="" />}
          <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Informations pour la pochette</label>
          <textarea className="art-inp" style={{ minHeight:70, resize:'vertical', fontFamily:'inherit' }} value={infos}
            onChange={e => setInfos(e.target.value)} placeholder="Titre, nom d'artiste, intervenants, crédits, contact à mettre au dos..." />
        </>
      )}

      {msg && <p style={{ color: msg.startsWith('Erreur') ? C.alert : C.success, fontSize:12, margin:'8px 0' }}>{msg}</p>}

      <button onClick={commander} disabled={uploading}
        style={{ width:'100%', padding:14, marginTop:6, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff' }}>
        {uploading ? 'Patientez...' : 'Commander mes pochettes'}
      </button>

      {/* Mes commandes */}
      {mesCommandes.length > 0 && (
        <div style={{ marginTop:18 }}>
          <p style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.text }}>Mes commandes</p>
          {mesCommandes.map(c => (
            <div key={c.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:13, margin:0, color:C.text }}>{c.contenuTitre}</p>
                  <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>{c.nbPochettes} pochettes · {c.nbScans} scan(s)/pièce{c.creaParNous ? ' · créa incluse' : ''}</p>
                </div>
                <span style={{ borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700,
                  background: c.statut==='livree'?'rgba(0,212,154,0.15)':c.statut==='en_cours'?'rgba(93,132,255,0.15)':'rgba(245,200,76,0.15)',
                  color: c.statut==='livree'?C.success:c.statut==='en_cours'?C.blueLite:C.gold }}>
                  {c.statut==='livree'?'Livrée':c.statut==='en_cours'?'En cours':'Reçue'}
                </span>
              </div>
              {/* Créa livrée en PNG */}
              {c.creaUrl && (
                <a href={c.creaUrl} target="_blank" rel="noopener noreferrer" download
                  style={{ display:'block', textAlign:'center', marginTop:8, padding:8, borderRadius:8, background:C.success, color:'#062018', textDecoration:'none', fontSize:12, fontWeight:700 }}>
                  Télécharger ma pochette (PNG)
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MotArtisteTab({ user, artistName }: any) {
  const [texte, setTexte] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [mesMots, setMesMots] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = onSnapshot(
      query(collection(db,'mots_artiste'), where('artistEmail','==',user.email), orderBy('createdAt','desc')),
      snap => setMesMots(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [user?.email]);

  const uploadVideo = async (f: File) => {
    setUploading(true); setMsg('');
    try {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/video/upload', { method:'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) { setVideoUrl(data.secure_url); setMsg('Vidéo prête.'); }
      else setMsg('Erreur upload.');
    } catch { setMsg('Erreur upload.'); }
    setUploading(false);
  };

  const publier = async () => {
    if (!texte.trim() && !videoUrl) { setMsg('Écrivez un message ou ajoutez une vidéo'); return; }
    try {
      await addDoc(collection(db,'mots_artiste'), {
        artistEmail: user.email, artistName,
        texte: texte.trim(), videoUrl,
        statut: 'en_attente',
        createdAt: new Date().toISOString(),
      });
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'mot_artiste',
        text: `${artistName} a soumis un mot à valider.`,
        createdAt: new Date().toISOString(),      });
      setMsg('Soumis ! Votre mot sera validé puis publié.');
      setTexte(''); setVideoUrl('');
    } catch(e:any) { setMsg('Erreur : ' + e.message); }
  };

  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <h3 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:6, color:C.text }}>Mon Mood</h3>
      <p style={{ color:C.textSoft, fontSize:13, marginBottom:12, lineHeight:1.6 }}>
        Votre Mood est votre espace d'expression professionnel, public et validé par notre équipe. Ce n'est pas un espace de buzz ou de divertissement personnel.
      </p>

      <div style={{ background:'rgba(0,212,154,0.08)', border:'1px solid rgba(0,212,154,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
        <p style={{ color:C.success, fontSize:12, fontWeight:700, margin:'0 0 6px' }}>Ce que vous pouvez publier :</p>
        <p style={{ color:C.textSoft, fontSize:11, margin:0, lineHeight:1.7 }}>
          • Vous présenter à votre public<br/>
          • Décrire votre univers, votre projet musical<br/>
          • Promouvoir une sortie, un single, un clip<br/>
          • Inviter à un événement (concert, showcase)<br/>
          • Une signature ou un mot pour vos fans
        </p>
      </div>

      <div style={{ background:'rgba(255,100,124,0.08)', border:'1px solid rgba(255,100,124,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
        <p style={{ color:C.alert, fontSize:12, fontWeight:700, margin:'0 0 6px' }}>Ce qui sera refusé :</p>
        <p style={{ color:C.textSoft, fontSize:11, margin:0, lineHeight:1.7 }}>
          • Contenu de type buzz / divertissement (style TikTok)<br/>
          • Sujets personnels, sociaux ou hors musique<br/>
          • Tout ce qui n'est pas professionnel ou promotionnel
        </p>
      </div>

      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:24 }}>
        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Votre message</label>
        <textarea className="art-inp" style={{ minHeight:90, resize:'vertical', fontFamily:'inherit' }} value={texte}
          onChange={e => setTexte(e.target.value)} placeholder="Ex: Bonjour à tous ! Je serai en concert le... / Mon nouveau single est disponible..." />

        <label style={{ display:'block', color:C.textSoft, fontSize:12, marginBottom:6 }}>Vidéo (optionnel)</label>
        <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && uploadVideo(e.target.files[0])} className="art-inp" style={{ padding:8 }} />
        {uploading && <p style={{ color:C.blueLite, fontSize:12 }}>Upload en cours...</p>}
        {videoUrl && <p style={{ color:C.success, fontSize:12 }}>✓ Vidéo ajoutée</p>}

        {msg && <p style={{ color: msg.startsWith('Erreur') ? C.alert : C.success, fontSize:12, margin:'10px 0' }}>{msg}</p>}

        <button onClick={publier} disabled={uploading}
          style={{ width:'100%', padding:14, marginTop:8, borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff' }}>
          {uploading ? 'Patientez...' : 'Soumettre mon mot'}
        </button>
      </div>

      {mesMots.length > 0 && (
        <div style={{ marginTop:20 }}>
          <h4 style={{ fontWeight:800, fontSize:15, marginBottom:12, color:C.text }}>Mes messages</h4>
          {mesMots.map(m => (
            <div key={m.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:'16px 20px', marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                <p style={{ fontSize:13, margin:0, flex:1, color:C.text }}>{m.texte || '(vidéo)'}</p>
                <span style={{ borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap',
                  background: m.statut==='valide'?'rgba(0,212,154,0.15)':m.statut==='refuse'?'rgba(255,100,124,0.15)':'rgba(245,200,76,0.15)',
                  color: m.statut==='valide'?C.success:m.statut==='refuse'?C.alert:C.gold }}>
                  {m.statut==='valide'?'Publié':m.statut==='refuse'?'Refusé':'En attente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BIO ARTISTE — formulaire "Personne physique" + génération IA de la bio pro
// ─────────────────────────────────────────────
export function BioArtisteTab({ user, artistName, coverUrl }: any) {
  const [form, setForm] = useState({
    nom: artistName || '', genre: '', fonction: '', nationalite: '', residence: '',
    passionDecouverte: '', sourceMotivation: '', inspiration: '',
    expertise: '', impact: '', vision: '', background: '',
  });
  const [bioTexte, setBioTexte] = useState('');
  const [generation, setGeneration] = useState<'idle'|'loading'|'error'>('idle');
  const [erreurGeneration, setErreurGeneration] = useState('');
  const [sauvegarde, setSauvegarde] = useState<'idle'|'saving'|'done'>('idle');
  const [dejaPublie, setDejaPublie] = useState(false);
  const [charge, setCharge] = useState(true);
  const [bioPhotoUrl, setBioPhotoUrl] = useState('');
  const [uploadPhoto, setUploadPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db,'artists'), where('email','==',user.email.toLowerCase())));
        if (!snap.empty) {
          const d = snap.docs[0].data();
          if (d.bioFormulaire) setForm((f) => ({ ...f, ...d.bioFormulaire }));
          if (d.bioTexte) { setBioTexte(d.bioTexte); setDejaPublie(true); }
          if (d.bioPhotoUrl) setBioPhotoUrl(d.bioPhotoUrl);
        }
      } catch (e) { console.error(e); }
      setCharge(false);
    })();
  }, [user.email]);

  const champ = (cle: string, val: string) => setForm((f) => ({ ...f, [cle]: val }));

  const changerPhoto = async (file: File) => {
    setUploadPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload échoué');
      setBioPhotoUrl(data.secure_url);
      const snap = await getDocs(query(collection(db,'artists'), where('email','==',user.email.toLowerCase())));
      if (!snap.empty) await updateDoc(doc(db,'artists',snap.docs[0].id), { bioPhotoUrl: data.secure_url });
    } catch (e:any) { alert('Erreur : ' + e.message); }
    setUploadPhoto(false);
  };

  const genererBio = async () => {
    setGeneration('loading'); setErreurGeneration('');
    try {
      const res = await fetch('/api/generer-bio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form }),
      });
      const data = await res.json();
      if (!res.ok || !data.bio) throw new Error(data.error || 'Erreur de génération');
      setBioTexte(data.bio);
      setGeneration('idle');
    } catch (e: any) { console.error(e); setErreurGeneration(e.message || String(e)); setGeneration('error'); }
  };

  const enregistrer = async () => {
    setSauvegarde('saving');
    try {
      const slug = (form.nom || artistName || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const snap = await getDocs(query(collection(db,'artists'), where('email','==',user.email.toLowerCase())));
      if (!snap.empty) {
        await updateDoc(doc(db,'artists',snap.docs[0].id), { bioFormulaire: form, bioTexte, bioMiseAJour: new Date().toISOString(), slug, coverUrl });
      }
      setSauvegarde('done'); setDejaPublie(true);
      setTimeout(() => setSauvegarde('idle'), 2500);
    } catch (e) { console.error(e); setSauvegarde('idle'); }
  };
  const slugActuel = (form.nom || artistName || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  if (charge) return <div style={{ textAlign:'center', padding:40, color:C.textSoft }}>Chargement...</div>;

  const champStyle: CSSProperties = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid '+C.border, borderRadius:10, padding:'10px 12px', color:C.text, fontSize:13, marginBottom:12, boxSizing:'border-box' };
  const labelStyle: CSSProperties = { display:'block', color:C.textSoft, fontSize:11, fontWeight:700, marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 };

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6, color:C.text }}>Ma Bio</h2>
      <p style={{ color:C.textSoft, fontSize:12, marginBottom:20, lineHeight:1.6 }}>
        Remplis le formulaire, l'IA rédige ta bio professionnelle. Elle sera visible sur ta page publique (avec ta pochette), que n'importe qui pourra consulter — y compris sur Google.
      </p>

      <div style={{ marginBottom:20, textAlign:'center' }}>
        {(bioPhotoUrl || coverUrl) ? (
          <img src={optimImg(bioPhotoUrl || coverUrl,500)} alt="" style={{ width:180, height:180, objectFit:'cover', borderRadius:16, border:'1px solid '+C.border }} />
        ) : (
          <div style={{ width:180, height:180, borderRadius:16, background:'linear-gradient(135deg,#0d1535,#1a3a6e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
            <img src={LOGO_B64} alt="" style={{ width:60, opacity:0.4 }} />
          </div>
        )}
        <p style={{ color:C.textSoft, fontSize:10, marginTop:8 }}>
          {bioPhotoUrl ? 'Photo choisie pour ta page bio' : "Pochette utilisée par défaut — choisis ta propre photo ci-dessous"}
        </p>
        <label style={{ display:'inline-block', marginTop:10, padding:'9px 16px', borderRadius:99, border:'1px solid '+C.blue, background: uploadPhoto ? 'rgba(30,111,255,0.1)' : 'transparent', color:C.blueLite, fontSize:12, fontWeight:700, cursor: uploadPhoto ? 'wait' : 'pointer' }}>
          {uploadPhoto ? 'Envoi en cours...' : (bioPhotoUrl ? 'Changer la photo' : 'Choisir ma propre photo')}
          <input type="file" accept="image/*" style={{ display:'none' }} disabled={uploadPhoto}
            onChange={e => e.target.files?.[0] && changerPhoto(e.target.files[0])} />
        </label>
      </div>

      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:20 }}>
        <p style={{ color:C.gold, fontSize:10, fontWeight:800, letterSpacing:1.5, marginBottom:14, textTransform:'uppercase' }}>État civil</p>
        <label style={labelStyle}>Nom de scène</label>
        <input style={champStyle} value={form.nom} onChange={e=>champ('nom',e.target.value)} placeholder="Ton nom d'artiste" />
        <label style={labelStyle}>Genre</label>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {[['homme','Homme'],['femme','Femme']].map(([val,lab]) => (
            <button key={val} type="button" onClick={()=>champ('genre',val)}
              style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${form.genre===val?C.blue:C.border}`, background: form.genre===val?'rgba(30,111,255,0.15)':'rgba(255,255,255,0.05)', color: form.genre===val?C.blueLite:C.textSoft, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {lab}
            </button>
          ))}
        </div>
        <label style={labelStyle}>Fonction (précise ta spécialité)</label>
        <input style={champStyle} value={form.fonction} onChange={e=>champ('fonction',e.target.value)} placeholder="Ex : Chanteur gospel, ténor" />
        <label style={labelStyle}>Nationalité</label>
        <input style={champStyle} value={form.nationalite} onChange={e=>champ('nationalite',e.target.value)} placeholder="Ex : Ivoirienne" />
        <label style={labelStyle}>Lieu de résidence</label>
        <input style={{...champStyle, marginBottom:0}} value={form.residence} onChange={e=>champ('residence',e.target.value)} placeholder="Ex : Abidjan" />
      </div>

      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:20 }}>
        <p style={{ color:C.gold, fontSize:10, fontWeight:800, letterSpacing:1.5, marginBottom:14, textTransform:'uppercase' }}>Profil professionnel</p>
        <label style={labelStyle}>Quand as-tu découvert ta passion ?</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.passionDecouverte} onChange={e=>champ('passionDecouverte',e.target.value)} />
        <label style={labelStyle}>Qui a été ta source de motivation ?</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.sourceMotivation} onChange={e=>champ('sourceMotivation',e.target.value)} />
        <label style={labelStyle}>D'où tires-tu ton inspiration ?</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.inspiration} onChange={e=>champ('inspiration',e.target.value)} />
        <label style={labelStyle}>Décris ton expertise (talent, spécialisation)</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.expertise} onChange={e=>champ('expertise',e.target.value)} />
        <label style={labelStyle}>Quel impact veux-tu produire ?</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.impact} onChange={e=>champ('impact',e.target.value)} />
        <label style={labelStyle}>Ta vision / ambition</label>
        <textarea style={{...champStyle, minHeight:60}} value={form.vision} onChange={e=>champ('vision',e.target.value)} />
        <label style={labelStyle}>Ton background / parcours</label>
        <textarea style={{...champStyle, minHeight:60, marginBottom:0}} value={form.background} onChange={e=>champ('background',e.target.value)} />
      </div>

      <button onClick={genererBio} disabled={generation==='loading'}
        style={{ width:'100%', padding:14, borderRadius:14, border:'none', background: generation==='loading' ? '#2a4a6a' : 'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:14, cursor: generation==='loading' ? 'wait' : 'pointer', marginBottom:20 }}>
        {generation==='loading' ? 'Génération en cours...' : (bioTexte ? '✨ Régénérer ma bio' : '✨ Générer ma bio')}
      </button>
      {generation === 'error' && (
        <p style={{ color:C.alert, fontSize:12, marginTop:-14, marginBottom:16, textAlign:'center' }}>
          Erreur : {erreurGeneration || 'inconnue'}. Réessaie, ou copie ce message pour qu'on te dise quoi faire.
        </p>
      )}

      {bioTexte && (
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20 }}>
          <p style={{ color:C.gold, fontSize:10, fontWeight:800, letterSpacing:1.5, marginBottom:12, textTransform:'uppercase' }}>Ta bio (modifiable)</p>
          <textarea value={bioTexte} onChange={e=>setBioTexte(e.target.value)}
            style={{ width:'100%', minHeight:260, background:'rgba(255,255,255,0.05)', border:'1px solid '+C.border, borderRadius:10, padding:14, color:C.text, fontSize:13, lineHeight:1.7, boxSizing:'border-box', fontFamily:'inherit', marginBottom:14 }} />
          <button onClick={enregistrer} disabled={sauvegarde==='saving'}
            style={{ width:'100%', padding:13, borderRadius:12, border:'none', background: sauvegarde==='done' ? C.success : '#00d49a', color:'#04231a', fontWeight:800, fontSize:14, cursor: sauvegarde==='saving' ? 'wait' : 'pointer' }}>
            {sauvegarde==='saving' ? 'Enregistrement...' : sauvegarde==='done' ? '✓ Publié sur ta page bio' : 'Publier sur ma page bio'}
          </button>
          {dejaPublie && slugActuel && (
            <a href={`/artiste-bio/${slugActuel}`} target="_blank" rel="noreferrer"
              style={{ display:'block', textAlign:'center', marginTop:10, color:C.blueLite, fontSize:12, fontWeight:700, textDecoration:'none' }}>
              Voir ma page publique →
            </a>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// RETRAIT MODAL — méthodes de paiement
// ─────────────────────────────────────────────
export function RetraitModal({ montant, oscart, artistEmail }: { montant:number, oscart:number, artistEmail:string }) {
  const [open, setOpen] = useState(false);
  const [methode, setMethode] = useState('');
  const [numero, setNumero] = useState('');
  const [iban, setIban] = useState('');
  const [sent, setSent] = useState(false);

  const METHODES = [
    { id:'wave', label:'Wave', icon:'', color:'#1a6bff' },
    { id:'orange', label:'Orange Money', icon:'', color:'#fb923c' },
    { id:'mtn', label:'MTN MoMo', icon:'', color:'#ffd700' },
    { id:'virement', label:'Virement bancaire', icon:'', color:'#00c853' },
    { id:'visa', label:'Visa / Mastercard', icon:'', color:'#7c3aed' },
  ];

  const envoyer = async () => {
    if (!methode) return;
    await addDoc(collection(db,'retraits'), {
      artistEmail, montant, oscart, methode,
      numero: numero || iban,
      statut: 'en_attente',
      createdAt: new Date().toISOString(),
    });
    // Alerte admin immédiate (push + in-app) — avant, aucune notification n'était
    // envoyée, la demande restait invisible tant que personne n'allait vérifier
    // la base de données à la main.
    await envoyerNotification({
      to: ADMIN_EMAIL, role: 'admin', type: 'demande_retrait',
      text: `Nouvelle demande de retrait — ${artistEmail} : ${montant.toLocaleString()} F CFA via ${methode}`,
    });
    setSent(true);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ ...S.btn, padding:'8px 20px', fontSize:13 }}>
      Demander un retrait
    </button>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...S.btn, padding:'8px 20px', fontSize:13 }}>
        Demander un retrait
      </button>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
        onClick={() => setOpen(false)}>
        <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ width:40, height:4, borderRadius:99, background:'#dce6f7', margin:'0 auto 20px' }} />
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontWeight:800, fontSize:17, color:'#1a2340' }}>Demande envoyée !</p>
              <p style={{ color:'#8098b8', fontSize:13, marginTop:8 }}>
                Votre retrait de {montant.toLocaleString()} F CFA sera traité sous 72h via {methode}
              </p>
              <button onClick={() => { setOpen(false); setSent(false); }}
                style={{ ...S.btn, marginTop:20, width:'100%', padding:12 }}>Fermer</button>
            </div>
          ) : (
            <>
              <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', marginBottom:4 }}>Demande de retrait</p>
              <p style={{ color:'#8098b8', fontSize:13, marginBottom:20 }}>{montant.toLocaleString()} F CFA = {oscart} Oscart</p>
              <p style={{ fontWeight:700, fontSize:13, color:'#1a2340', marginBottom:10 }}>Choisissez votre méthode</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {METHODES.map(m => (
                  <button key={m.id} onClick={() => setMethode(m.id)}
                    style={{ padding:'10px 8px', borderRadius:10, border:`2px solid ${methode===m.id?m.color:'#dce6f7'}`, background:methode===m.id?`${m.color}11`:'#fff', cursor:'pointer', textAlign:'center' }}>
                    <p style={{ fontSize:20, margin:'0 0 4px' }}>{m.icon}</p>
                    <p style={{ fontWeight:700, fontSize:12, color:methode===m.id?m.color:'#1a2340', margin:0 }}>{m.label}</p>
                  </button>
                ))}
              </div>
              {methode && methode !== 'virement' && (
                <div style={{ marginBottom:16 }}>
                  <label style={S.lbl}>Numéro {methode}</label>
                  <input style={S.inp} value={numero} onChange={e => setNumero(e.target.value)} placeholder="+225 07 00 00 00 00" />
                </div>
              )}
              {methode === 'virement' && (
                <div style={{ marginBottom:16 }}>
                  <label style={S.lbl}>IBAN</label>
                  <input style={S.inp} value={iban} onChange={e => setIban(e.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
                </div>
              )}
              {methode === 'visa' && (
                <div style={{ marginBottom:16 }}>
                  <label style={S.lbl}>Numéro de carte (4 derniers chiffres)</label>
                  <input style={S.inp} value={numero} onChange={e => setNumero(e.target.value)} placeholder="**** **** **** 1234" />
                </div>
              )}
              <button onClick={envoyer} disabled={!methode}
                style={{ ...S.btn, width:'100%', padding:14, opacity:methode?1:0.5 }}>
                Confirmer la demande
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
