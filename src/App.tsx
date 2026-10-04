import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { db, auth, getMessagingSiSupporte } from './firebase';
import { getToken } from 'firebase/messaging';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc, increment,
  onSnapshot, query, orderBy, where, getDocs, limit
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  RecaptchaVerifier, signInWithPhoneNumber, updateProfile,
  sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  estFichierAudio, C, GLOW_TOP, ADMIN_EMAIL, RESPONSABLES_AUTORISES, SOUS_ADMINS, GROUPE_WHATSAPP,
  estSuperAdmin, estSousAdmin, estAdmin, peutSupprimer, demanderResetPassword, envoyerEmailNotif,
  envoyerNotification, notifierAdminEnregistrement, STRIPE_PUBLIC_KEY, CLOUDINARY_CLOUD,
  CLOUDINARY_UPLOAD_PRESET, BASE_URL, optimImg, logTx, lancerPaiementGeniusPay,
  notifierActiviteCommunaute, donnerKiff, MSG_INVIT_ARTISTE, APP_NAME, APP_TAGLINE, LOGO_B64,
  KIF_ROSE_B64, KIF_ETOILE_B64, KIF_TROPHEE_B64, KIF_COURONNE_B64, KIF_PALME_B64, KIF_DIAMANT_B64,
  KIF_TRONE_B64, KIF_MEDAILLE_B64, KIF_HALL_B64, KIF_UNIVERS_B64, COIN_OSCART_B64, COIN_OSCART_SYMBOLE,
  isIOS, isAndroid, isSafari, isChromeiOS, isMobileDevice, S, tabStyle, badgeStyle, formatSize,
  KIFFEMENTS, CATEGORIES_AUDIO, CATEGORIES_VIDEO, PRIX_PUBLICATION,
  activerNotificationsPush, RECHARGES, TYPES_CONTENU,
} from './lib/utils';
import {
  WhatsAppLink, CONTRAT_COMMERCIAL, CONTRAT_PRODUCTION, CONDITIONS_ARTISTE, DocumentLegalModal,
  BoutonResetAdmin, ChangerMotDePasse, cleanName, formatTime, Spectrogram, LoginModal,
  RechargeDeviseSelector, SIGNATURES, SignatureShowcase, optimizeCloudinaryUrl, OSCART_TO_FCFA,
  OSCART_TO_EUR, OSCART_TO_USD, DEVISE_PAR_PAYS, INFO_DEVISE, PALIERS_CONCOURS_DEFAUT, formatOscart,
  useDeviseLocale, useNotifsNonLues, Lien, VignetteFiltreEnDirect, Logo,
} from './components/shared';
import {
  SignaturesArtisteTab, SoumissionsTab, DecouvrirAdminTab, SortiesAdminTab, ProductionTab,
  ResponsablesTab, CommerciauxtTab, ArtistesTab, ArtistFolder, useActivePub, PubOverlay, PubBanner,
  PubOscartTab, ConcoursConfigTab, NotifsEducativesTab, InscriptionsTab, MotsDePasseTab, AdminPage,
} from './pages/admin';
import {
  ArtistPage, ConcoursKifsArtiste, NotificationsTab, DiscouvrirStat, PublierContenuTab,
  PRIX_CREA_POCHETTE, CommandePochettes, MotArtisteTab, BioArtisteTab, RetraitModal,
} from './pages/artist';

function ScenePourFiltre() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 62 62" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="62" height="62" fill="#7fc8e8" />
      <circle cx="48" cy="14" r="8" fill="#ffd85e" />
      <rect x="0" y="40" width="62" height="22" fill="#4a9d5f" />
      <circle cx="31" cy="34" r="15" fill="#e8b08a" />
      <path d="M16 30a15 15 0 0 1 30 0v-3a15 15 0 0 0-30 0z" fill="#2b1a12" />
      <circle cx="25" cy="34" r="2" fill="#2b1a12" />
      <circle cx="37" cy="34" r="2" fill="#2b1a12" />
      <path d="M25 41q6 4 12 0" stroke="#7a3d2a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Icône SVG affichée sur la vignette de chaque effet du challenge (aucun emoji)
function IconeEffet({ id }: { id: string }) {
  const p = { width:26, height:26, viewBox:'0 0 24 24', fill:'none', stroke:'#fff', strokeWidth:1.7,
              strokeLinecap:'round' as const, strokeLinejoin:'round' as const };
  switch (id) {
    case 'aucun':    return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>;
    case 'zoomlent': return <svg {...p}><circle cx="11" cy="11" r="6"/><line x1="16" y1="16" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
    case 'punch':    return <svg {...p}><path d="M12 2l2.6 6.2L21 9l-5 4.2L17.4 20 12 16.6 6.6 20 8 13.2 3 9l6.4-.8z"/></svg>;
    case 'shake':    return <svg {...p}><line x1="4" y1="8" x2="4" y2="16"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="16" y1="5" x2="16" y2="19"/><line x1="20" y1="8" x2="20" y2="16"/></svg>;
    case 'glitch':   return <svg {...p}><rect x="3" y="6" width="14" height="4"/><rect x="7" y="14" width="14" height="4"/></svg>;
    case 'vhs':      return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/></svg>;
    case 'strobe':   return <svg {...p}><path d="M13 2L4 14h7l-1 8 10-12h-7z"/></svg>;
    case 'trail':    return <svg {...p}><circle cx="18" cy="12" r="3.5"/><circle cx="11" cy="12" r="2.2" opacity="0.6"/><circle cx="5" cy="12" r="1.4" opacity="0.35"/></svg>;
    case 'miroir':   return <svg {...p}><line x1="12" y1="3" x2="12" y2="21"/><path d="M9 6L3 12l6 6z"/><path d="M15 6l6 6-6 6z" opacity="0.45"/></svg>;
    case 'kaleido':  return <svg {...p}><path d="M12 3l5 5-5 5-5-5z"/><path d="M12 11l5 5-5 5-5-5z" opacity="0.5"/></svg>;
    case 'timewarp': return <svg {...p}><line x1="3" y1="9" x2="21" y2="9"/><polyline points="8 14 12 18 16 14"/><line x1="12" y1="18" x2="12" y2="11"/></svg>;
    case 'sketch':   return <svg {...p}><path d="M15 3l6 6L9 21H3v-6z"/><line x1="13" y1="5" x2="19" y2="11"/></svg>;
    case 'clone':    return <svg {...p}><rect x="3" y="5" width="12" height="14" rx="2"/><rect x="9" y="5" width="12" height="14" rx="2" opacity="0.5"/></svg>;
    case 'face_zoom':return <svg {...p}><circle cx="12" cy="12" r="7"/><polyline points="3 8 3 3 8 3"/><polyline points="21 16 21 21 16 21"/></svg>;
    case 'face_chant':return <svg {...p}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>;
    case 'face_crown':return <svg {...p}><path d="M3 8l3.5 4L12 5l5.5 7L21 8v10H3z"/></svg>;
    case 'face_glasses':return <svg {...p}><circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M10 13h4"/><path d="M3 10l2-3M21 10l-2-3"/></svg>;
    case 'face_blur':return <svg {...p}><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8" opacity="0.35" strokeDasharray="3 3"/></svg>;
    case 'face_beauty':return <svg {...p}><path d="M12 4l1.6 4L18 9.6 13.6 11 12 15l-1.6-4L6 9.6 10.4 8z"/><path d="M18 15l.7 1.7L20.4 17l-1.7.8L18 20l-.7-2.2L15.6 17l1.7-.3z"/></svg>;
    case 'fond_studio':return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="10" r="2.5"/><path d="M4 19l5-5 4 4 3-3 4 4"/></svg>;
    default:         return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

// Petit badge rouge avec le nombre de notifications non lues (pour la barre de navigation).
function BadgeNotif() {
  const [email, setEmail] = useState<string | undefined>(auth.currentUser?.email || undefined);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setEmail(u?.email || undefined));
    return () => unsub();
  }, []);
  const n = useNotifsNonLues(email);
  if (!n) return null;
  return (
    <span style={{ position:'absolute', top:-4, right:-8, minWidth:16, height:16, padding:'0 4px', borderRadius:99, background:'#f04a6a', color:'#fff', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, boxSizing:'border-box' }}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function usePushNotifications(userEmail?: string) {
  const dejaVus = useRef<Set<string>>(new Set());
  const premierChargement = useRef(true);

  useEffect(() => {
    if (!userEmail || typeof Notification === 'undefined') return;

    // Demander la permission une fois (sans bloquer)
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const unsub = onSnapshot(
      query(collection(db, 'notifications'), where('to', '==', userEmail), orderBy('createdAt', 'desc')),
      snap => {
        // Au tout premier chargement, on mémorise les notifs existantes SANS notifier
        // (sinon on recevrait une notif pour chaque ancienne notification)
        if (premierChargement.current) {
          snap.docs.forEach(d => dejaVus.current.add(d.id));
          premierChargement.current = false;
          return;
        }
        // Pour chaque NOUVELLE notification non lue, afficher une notification système
        snap.docChanges().forEach(ch => {
          if (ch.type === 'added' && !dejaVus.current.has(ch.doc.id)) {
            dejaVus.current.add(ch.doc.id);
            const n = ch.doc.data();
            if (n.lu) return;
            if (Notification.permission === 'granted') {
              try {
                // Sur Android, le constructeur Notification() direct échoue souvent
                // silencieusement (sans erreur visible) — il faut passer par le
                // service worker déjà installé dans l'app pour que ça s'affiche
                // vraiment dans la barre de notifications du téléphone.
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                  navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification('Doniel Zik', {
                      body: n.text || 'Vous avez une nouvelle notification',
                      icon: '/icons/icon-192x192.png',
                      badge: '/icons/icon-192x192.png',
                      tag: ch.doc.id,
                      data: { url: '/notifications' },
                    }).catch(() => {
                      // Filet de sécurité : navigateur sans service worker prêt
                      try {
                        const notif = new Notification('Doniel Zik', {
                          body: n.text || 'Vous avez une nouvelle notification',
                          icon: '/icons/icon-192x192.png', tag: ch.doc.id,
                        });
                        notif.onclick = () => { window.focus(); window.location.href = '/notifications'; notif.close(); };
                      } catch {}
                    });
                  });
                } else {
                  const notif = new Notification('Doniel Zik', {
                    body: n.text || 'Vous avez une nouvelle notification',
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png',
                    tag: ch.doc.id,
                  });
                  notif.onclick = () => { window.focus(); window.location.href = '/notifications'; notif.close(); };
                }
              } catch {}
            }
          }
        });
      }
    );
    return () => unsub();
  }, [userEmail]);
}



function KiffementSection({ qrId, artistEmail, compact, autoOpen, onClose, source = 'qr' }: { qrId: string, artistEmail?: string, compact?: boolean, autoOpen?: boolean, onClose?: () => void, source?: 'qr' | 'public' }) {
  const [open, setOpen] = useState(autoOpen || false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeModal, setRechargeModal] = useState<{fcfa:number,oscart:number}|null>(null);
  const [soldeCoins, setSoldeCoins] = useState(0);
  const { enLocal } = useDeviseLocale();
  const [sending, setSending] = useState<string|null>(null);
  const [msg, setMsg] = useState('');
  const [showLoginModal, setShowLoginModal] = useState('');
  const user = auth.currentUser;
  const [confirmKiff, setConfirmKiff] = useState<typeof KIFFEMENTS[0] | null>(null);
  const [skipConfirm, setSkipConfirm] = useState<Record<string, boolean>>({});
  const [dontAsk, setDontAsk] = useState(false);
  const [flying, setFlying] = useState<{ id:number, image:string, dx:number }[]>([]);

  // Charger le solde Oscart de l'utilisateur
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db,'coins_solde'), where('uid','==',user.uid)),
      snap => {
        if (!snap.empty) setSoldeCoins(snap.docs[0].data().solde || 0);
        else setSoldeCoins(0);
      }
    );
    return unsub;
  }, [user]);

  const envoyer = async (kiffement: typeof KIFFEMENTS[0]) => {
    if (!user) { setShowLoginModal('Connectez-vous pour envoyer un kiffement'); return; }
    if (soldeCoins < kiffement.coins) {
      setShowRecharge(true);
      return;
    }
    // SOLDE OPTIMISTE : on débite tout de suite à l'écran pour que les clics suivants soient instantanés
    setSoldeCoins(s => s - kiffement.coins);
    try {
      // Débiter les Oscart (on lit la vraie valeur en base pour éviter tout double débit)
      const snap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      if (!snap.empty) {
        const curSolde = snap.docs[0].data();
        const soldeReel = curSolde.solde || 0;
        await updateDoc(doc(db,'coins_solde',snap.docs[0].id), {
          solde: Math.max(0, soldeReel - kiffement.coins),
          kiffsDispo: (curSolde.kiffsDispo || 0) + kiffement.coins * 250,
        });
        logTx(user.uid, 'kiffement', -kiffement.coins, kiffement.coins * 250, `Kiffement ${kiffement.label}`);
      }
      // Enregistrer le kiffement
      // Répartition : Artiste 70% / Structure 30%
      const montantKiff = kiffement.coins * 100;
      const partArtisteOscart = Math.round(kiffement.coins * 0.70); // 70% en Oscart pour l'artiste
      await addDoc(collection(db,'cadeaux'), {
        qrId, artistEmail,
        kiffementId: kiffement.id,
        kiffementLabel: kiffement.label,
        coins: kiffement.coins,
        partArtiste: Math.round(montantKiff * 0.70),
        partStructure: Math.round(montantKiff * 0.30),
        partArtisteOscart,
        kiffs: kiffement.coins * 250,
        userId: user.uid,
        userName: user.displayName || 'Un mélomane',
        status: 'paid',
        createdAt: new Date().toISOString(),
      });
      // CRÉDITER LE PORTEFEUILLE UNIQUE DE L'ARTISTE (70% en Oscart va dans 'solde' + on garde le total des gains et les kiffs)
      if (artistEmail) {
        const artSnap = await getDocs(query(collection(db,'coins_solde'), where('email','==',artistEmail)));
        if (!artSnap.empty) {
          const a = artSnap.docs[0].data();
          await updateDoc(doc(db,'coins_solde',artSnap.docs[0].id), {
            solde: (a.solde || 0) + partArtisteOscart,
            gainsArtisteTotal: (a.gainsArtisteTotal || 0) + partArtisteOscart,
            kiffsRecus: (a.kiffsRecus || 0) + kiffement.coins * 250,
          });
        } else {
          await addDoc(collection(db,'coins_solde'), {
            email: artistEmail,
            solde: partArtisteOscart,
            gainsArtisteTotal: partArtisteOscart,
            kiffsRecus: kiffement.coins * 250,
          });
        }
      }
      // Notification artiste
      if (artistEmail) {
        await envoyerNotification({
          to: artistEmail,
          role: 'artiste',
          type: 'kiffement',
          text: `${user.displayName || 'Un fan'} vous a envoyé un kiffement — ${kiffement.label}`,
          qrId, source, from: user.displayName || 'Un mélomane',
        });
      }
      setMsg(`Kiffement envoyé ! ${kiffement.coins} Oscart débités. +${(kiffement.coins*250).toLocaleString()} kiffs à offrir.`);
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { console.error(e); }
    setSending(null);
  };

  // Animation TikTok + envoi réel
  const launch = (k: typeof KIFFEMENTS[0]) => {
    const fid = Date.now() + Math.random();
    const dx = (Math.random() - 0.5) * 80;
    setFlying(f => [...f, { id: fid, image: k.image, dx }]);
    setTimeout(() => setFlying(f => f.filter(x => x.id !== fid)), 1100);
    envoyer(k);
  };

  const handleClick = (k: typeof KIFFEMENTS[0]) => {
    if (!user) { setShowLoginModal('Connectez-vous pour envoyer un kiffement'); return; }
    if (soldeCoins < k.coins) { setShowRecharge(true); return; }
    if (skipConfirm[k.id]) { launch(k); } else { setDontAsk(false); setConfirmKiff(k); }
  };

  const confirmSend = () => {
    if (!confirmKiff) return;
    if (dontAsk) setSkipConfirm(s => ({ ...s, [confirmKiff.id]: true }));
    const k = confirmKiff; setConfirmKiff(null); launch(k);
  };

  return (
    <div style={{ marginBottom: compact ? 0 : 16, display: compact ? 'inline-block' : 'block' }}>
      <style>{`@keyframes kifFly{0%{opacity:0;transform:translate(-50%,0) scale(.5)}15%{opacity:1}100%{opacity:0;transform:translate(-50%,-230px) scale(1.25)}}`}</style>
      {flying.map(f => (
        <img key={f.id} src={f.image} alt="" style={{ position:'fixed', left:`calc(50% + ${f.dx}px)`, bottom:140, width:64, height:64, objectFit:'contain', transform:'translateX(-50%)', pointerEvents:'none', zIndex:99999, animation:'kifFly 1.05s ease-out forwards', filter:'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' }} />
      ))}
      {confirmKiff && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9991, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setConfirmKiff(null)}>
          <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 36px', width:'100%', maxWidth:480, textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 18px' }} />
            <img src={confirmKiff.image} alt={confirmKiff.label} style={{ width:90, height:90, objectFit:'contain', margin:'0 auto 12px', display:'block', filter:'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }} />
            <p style={{ color:'#fff', fontWeight:800, fontSize:17, margin:'0 0 4px' }}>Envoyer {confirmKiff.label} ?</p>
            <p style={{ color:'#ffd700', fontWeight:700, fontSize:15, margin:'0 0 16px' }}><img src={COIN_OSCART_SYMBOLE} alt="" style={{ width:14, height:14, verticalAlign:"-2px", marginRight:3 }} />{confirmKiff.coins} Oscart <span style={{ color:'#8098b8', fontWeight:400, fontSize:12 }}>= {(confirmKiff.coins*10).toLocaleString()} F CFA</span></p>
            <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:18, cursor:'pointer' }}>
              <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} style={{ width:16, height:16, accentColor:'#ffd700' }} />
              <span style={{ color:'#dde4f5', fontSize:13 }}>Enregistrer mon choix (ne plus demander)</span>
            </label>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmKiff(null)} style={{ flex:1, padding:13, borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'#8098b8', fontWeight:700, fontSize:14, cursor:'pointer' }}>Annuler</button>
              <button onClick={confirmSend} style={{ flex:2, padding:13, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:14, cursor:'pointer' }}>Confirmer l'envoi</button>
            </div>
          </div>
        </div>
      )}
      {showLoginModal && <LoginModal message={showLoginModal} onClose={() => setShowLoginModal('')} />}
      {!autoOpen && (
        <button onClick={() => setOpen(!open)} title="Kiffement"
          style={ compact
            ? { display:'inline-flex', alignItems:'center', gap:5, padding:'0 12px', height:40, borderRadius:99, border:'none', background:'rgba(255,200,0,0.12)', color:'#ffd700', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }
            : { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:99, border:'1px solid rgba(255,200,0,0.3)', background:'rgba(255,200,0,0.05)', color:'#ffd700', cursor:'pointer', fontSize:14, fontWeight:600 } }>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          Kiffement
        </button>
      )}
      {/* Modal recharge stylé */}
      {rechargeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setRechargeModal(null)}>
          <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
            <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:6 }}>
              Recharger {rechargeModal.oscart} Oscart
            </p>
            <RechargeDeviseSelector fcfa={rechargeModal.fcfa} />

            {/* PAIEMENT GENIUSPAY */}
            <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
              Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
            </p>
            <button onClick={async () => {
              setMsg('Redirection vers le paiement...');
              const err = await lancerPaiementGeniusPay(rechargeModal.oscart, rechargeModal.fcfa);
              if (err) setMsg(err);
            }}
              style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              Payer {rechargeModal.fcfa.toLocaleString()} F CFA
            </button>
            <button onClick={() => setRechargeModal(null)}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'#8098b8', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {open && (
        <div onClick={() => { setOpen(false); onClose?.(); }} style={{ position:'fixed', inset:0, zIndex:9980, background:'rgba(0,0,0,0.4)' }}>
        <div onClick={e => e.stopPropagation()} style={{ position:'fixed', left:'50%', bottom:90, transform:'translateX(-50%)', background:C.bgSecond, border:'1px solid '+C.border, borderRadius:16, padding:'10px 12px 12px', width:'88%', maxWidth:380, maxHeight:'44vh', overflowY:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.6)', animation:'bandUp .25s ease-out' }}>
          <style>{`@keyframes bandUp{0%{opacity:0;transform:translate(-50%,20px)}100%{opacity:1;transform:translate(-50%,0)}}`}</style>
          <div style={{ width:36, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)', margin:'2px auto 10px' }} />

          {/* Solde Oscart */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ color:'#8098b8', fontSize:12, margin:0 }}>Votre solde</p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'#ffd700', fontWeight:800, fontSize:14 }}><img src={COIN_OSCART_SYMBOLE} alt="" style={{ width:14, height:14, verticalAlign:"-2px", marginRight:3 }} />{soldeCoins.toLocaleString()} Oscart</span>
              <button onClick={() => setShowRecharge(!showRecharge)}
                style={{ padding:'4px 10px', borderRadius:8, border:'1px solid rgba(255,215,0,0.4)', background:'rgba(255,215,0,0.1)', color:'#ffd700', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                Recharger
              </button>
            </div>
          </div>

          {/* Panel recharge */}
          {showRecharge && (
            <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:10, padding:12, marginBottom:12 }}>
              <p style={{ color:'#ffd700', fontSize:12, fontWeight:700, marginBottom:8 }}>Recharger mes Oscart</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                {RECHARGES.map(r => (
                  <button key={r.oscart} onClick={() => setRechargeModal(r)}
                    style={{ padding:'10px 6px', borderRadius:10, border:'1px solid rgba(255,215,0,0.2)', background:'rgba(255,215,0,0.06)', cursor:'pointer', textAlign:'center' }}>
                    <p style={{ color:'#ffd700', fontWeight:800, fontSize:15, margin:'0 0 2px' }}>{r.oscart} Oscart</p>
                    <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{r.fcfa.toLocaleString()} F CFA</p>
                    {enLocal(r.fcfa) && <p style={{ color:'#5BB0FF', fontSize:10, margin:'2px 0 0' }}>{enLocal(r.fcfa)}</p>}
                  </button>
                ))}
              </div>
              <p style={{ color:'#4a5878', fontSize:10, textAlign:'center', margin:0 }}>Paiement via Wave · Orange Money · MTN MoMo</p>
            </div>
          )}

          {msg && <p style={{ color:'#ffd700', fontSize:12, marginBottom:8 }}>{msg}</p>}

          {/* Kiffements */}
          <p style={{ color:C.textSoft, fontSize:11, marginBottom:10 }}>Choisissez un kiffement</p>
          <style>{`
            @keyframes kifFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
            .kif-card:active { transform:scale(0.92); }
          `}</style>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {KIFFEMENTS.map((k, ki) => {
            const canSend = soldeCoins >= k.coins;
            return (
              <button key={k.id} className="kif-card" onClick={() => handleClick(k)} disabled={sending === k.id}
                style={{ padding:'9px 4px 8px', borderRadius:12, border:`1px solid ${canSend?'rgba(60,150,255,0.35)':'rgba(255,255,255,0.05)'}`, background: canSend?'linear-gradient(160deg,rgba(60,150,255,0.12),rgba(60,150,255,0.04))':'rgba(255,255,255,0.02)', cursor: canSend?'pointer':'not-allowed', textAlign:'center', opacity: canSend?1:0.45, transition:'transform .12s' }}>
                <img src={k.image} alt={k.label} style={{ width:38, height:38, objectFit:'contain', margin:'0 auto 4px', display:'block', filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.4))', animation: canSend?`kifFloat 3s ease-in-out ${ki*0.2}s infinite`:'none' }} />
                <p style={{ color: canSend?C.text:C.textSoft, fontSize:10, fontWeight:700, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.label}</p>
                <p style={{ color:C.gold, fontSize:9, margin:0, display:'inline-flex', alignItems:'center', gap:2, justifyContent:'center' }}><img src={COIN_OSCART_SYMBOLE} alt="" style={{ width:10, height:10 }} />{k.coins}</p>
              </button>
            );
          })}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION COMMENTAIRES — style TikTok
// ─────────────────────────────────────────────
function CommentSection({ qrId, artistEmail, compact, autoOpen, onClose, source = 'qr' }: { qrId: string, artistEmail?: string, compact?: boolean, autoOpen?: boolean, onClose?: () => void, source?: 'qr' | 'public' }) {
  const [comments, setComments] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(autoOpen || false);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState('');
  const [msg, setMsg] = useState('');
  const [editCommentId, setEditCommentId] = useState<string|null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string|null>(null); // id du commentaire auquel on répond
  const [replyText, setReplyText] = useState('');
  const user = auth.currentUser;

  // Charger le compteur dès le montage
  useEffect(() => {
    if (!qrId) return;
    const unsub = onSnapshot(
      query(collection(db, 'commentaires'), where('qrId','==',qrId)),
      snap => setCount(snap.docs.filter(d => !d.data().parentId).length)
    );
    return unsub;
  }, [qrId]);

  // Charger les commentaires complets quand ouvert
  useEffect(() => {
    if (!open || !qrId) return;
    const unsub = onSnapshot(
      query(collection(db, 'commentaires'), where('qrId','==',qrId), orderBy('createdAt','desc')),
      snap => setComments(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [qrId, open]);

  const MOTS_INTERDITS = ['nul','nuls','nulle','idiot','idiot','con','connard','bête','stupide','mauvais','horrible','merdique','pourri','déchet','trash','wack','pas bon','sans talent','zéro talent'];

  const submit = async () => {
    if (!user) { setShowLoginModal('Connectez-vous pour commenter'); return; }
    if (!text.trim()) return;
    // Modération automatique
    const textLower = text.toLowerCase();
    const motInterdit = MOTS_INTERDITS.find(m => textLower.includes(m));
    if (motInterdit) {
      setMsg('Votre commentaire contient des termes non autorisés. Encouragez les artistes avec bienveillance.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'commentaires'), {
        qrId, text: text.trim(),
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || 'Anonyme',
        userPhoto: user.photoURL || '',
        createdAt: new Date().toISOString(),
      });
      if (artistEmail) {
        await envoyerNotification({
          to: artistEmail,
          role: 'artiste',
          type: 'commentaire',
          text: `${user.displayName || 'Un fan'} a commenté votre contenu`,
          qrId, source,
          from: user.displayName || 'Un mélomane',
        });
      }
      // Notif activité (message 6) : prévenir les autres mélomanes actifs sur ce contenu
      await notifierActiviteCommunaute(qrId, user.uid,
        `${user.displayName || 'Quelqu\'un'} vient de commenter ce contenu. Rejoins la discussion !`);
      setText(''); setMsg('');
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // Envoyer une réponse à un commentaire (fil de discussion)
  const submitReply = async (parentId: string) => {
    if (!user) { setShowLoginModal('Connectez-vous pour répondre'); return; }
    if (!replyText.trim()) return;
    const textLower = replyText.toLowerCase();
    const motInterdit = MOTS_INTERDITS.find(m => textLower.includes(m));
    if (motInterdit) { setMsg('Votre réponse contient des termes non autorisés.'); return; }
    try {
      await addDoc(collection(db, 'commentaires'), {
        qrId, text: replyText.trim(),
        parentId, // marque cette entrée comme une réponse
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || 'Anonyme',
        userPhoto: user.photoURL || '',
        createdAt: new Date().toISOString(),
      });
      // Notif activité (message 7) : une réponse a été postée
      await notifierActiviteCommunaute(qrId, user.uid,
        `${user.displayName || 'Quelqu\'un'} a répondu à un commentaire sur ce contenu. Va voir la discussion !`);
      setReplyText(''); setReplyTo(null);
    } catch(e) { console.error(e); }
  };

  return (
    <div style={{ marginBottom: compact ? 0 : 16, display: compact ? 'inline-block' : 'block' }}>
      {showLoginModal && <LoginModal message={showLoginModal} onClose={() => setShowLoginModal('')} />}
      {!autoOpen && (
        <button onClick={() => setOpen(!open)} title="Commenter"
          style={ compact
            ? { display:'inline-flex', alignItems:'center', gap:4, padding:'0 10px', height:40, borderRadius:99, border:'none', background:'rgba(255,255,255,0.06)', color:'#8098b8', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0 }
            : { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:99, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', cursor:'pointer', fontSize:14, fontWeight:600 } }>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {compact ? (count > 0 ? count : '') : `Commenter ${count > 0 ? count : ''}`}
        </button>
      )}

      {open && (
        <div onClick={() => { setOpen(false); onClose?.(); }} style={{ position:'fixed', inset:0, zIndex:9980, background:'rgba(0,0,0,0.4)' }}>
        <div onClick={e => e.stopPropagation()} style={{ position:'fixed', left:'50%', bottom:90, transform:'translateX(-50%)', background:C.bgSecond, border:'1px solid '+C.border, borderRadius:18, padding:'14px 14px 16px', width:'92%', maxWidth:440, maxHeight:'60vh', overflowY:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.6)', animation:'bandUp .25s ease-out' }}>
          <style>{`@keyframes bandUp{0%{opacity:0;transform:translate(-50%,20px)}100%{opacity:1;transform:translate(-50%,0)}}`}</style>
          {/* Saisie commentaire */}
          <div style={{ display:'flex', gap:8, marginBottom: msg ? 8 : 14 }}>
            <input value={text} onChange={e => { setText(e.target.value); setMsg(''); }}
              onKeyDown={e => e.key==='Enter' && submit()}
              placeholder="Encouragez votre artiste..."
              style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:99, padding:'8px 14px', color:'#fff', fontSize:13, outline:'none' }} />
            <button onClick={submit} disabled={loading || !text.trim()}
              style={{ padding:'8px 14px', borderRadius:99, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {loading ? '...' : 'Envoyer'}
            </button>
          </div>
          {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
          {/* Liste commentaires */}
          {comments.filter(c => !c.parentId).length === 0 ? (
            <p style={{ color:'#4a5878', fontSize:12, textAlign:'center' }}>Soyez le premier à commenter</p>
          ) : comments.filter(c => !c.parentId).map(c => (
            <div key={c.id} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:99, background:'linear-gradient(135deg,#1a6bff,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                {c.userPhoto ? <img src={c.userPhoto} style={{ width:32, height:32, borderRadius:99 }} alt="" /> : c.userName?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {editCommentId === c.id ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                      style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'6px 10px', color:'#fff', fontSize:13, outline:'none' }} />
                    <button onClick={async () => {
                      if (!editCommentText.trim()) return;
                      await updateDoc(doc(db,'commentaires',c.id), { text: editCommentText.trim() });
                      setEditCommentId(null); setEditCommentText('');
                    }} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'#1a6bff', color:'#fff', fontSize:12, cursor:'pointer' }}>OK</button>
                    <button onClick={() => { setEditCommentId(null); setEditCommentText(''); }}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:12, cursor:'pointer' }}>Annuler</button>
                  </div>
                ) : (
                  <div style={{ display:'inline-block', background:'rgba(255,255,255,0.06)', borderRadius:16, padding:'8px 12px', maxWidth:'100%' }}>
                    <span style={{ fontWeight:700, fontSize:12.5, color:'#eaf2ff', display:'block', marginBottom:1 }}>{c.userName}</span>
                    <span style={{ fontSize:13, color:'#dde4f5', lineHeight:1.4, wordBreak:'break-word' }}>{c.text}</span>
                  </div>
                )}
                <div style={{ display:'flex', gap:14, marginTop:3, paddingLeft:12, alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'#4a5878' }}>{new Date(c.createdAt).toLocaleDateString('fr')}</span>
                  <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); }}
                    style={{ fontSize:11, color:'#8098b8', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    Répondre
                  </button>
                  {user && c.userId === user.uid && (
                    <>
                      <button onClick={() => { setEditCommentId(c.id); setEditCommentText(c.text); }}
                        style={{ fontSize:11, color:'#8098b8', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                        Modifier
                      </button>
                      <button onClick={async () => { if (window.confirm('Supprimer ce commentaire ?')) await deleteDoc(doc(db,'commentaires',c.id)); }}
                        style={{ fontSize:11, color:'#f04a6a', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                        Supprimer
                      </button>
                    </>
                  )}
                  {user && user.email === ADMIN_EMAIL && c.userId !== user.uid && (
                    <button onClick={async () => { if (window.confirm('Supprimer ce commentaire (admin) ?')) await deleteDoc(doc(db,'commentaires',c.id)); }}
                      style={{ fontSize:11, color:'#f04a6a', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      Supprimer
                    </button>
                  )}
                </div>

                {/* Zone de réponse */}
                {replyTo === c.id && (
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <input value={replyText} onChange={e => setReplyText(e.target.value)} autoFocus
                      onKeyDown={e => e.key==='Enter' && submitReply(c.id)}
                      placeholder={`Répondre à ${c.userName}...`}
                      style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:99, padding:'6px 12px', color:'#fff', fontSize:12, outline:'none' }} />
                    <button onClick={() => submitReply(c.id)} disabled={!replyText.trim()}
                      style={{ padding:'6px 12px', borderRadius:99, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                      Envoyer
                    </button>
                  </div>
                )}

                {/* Réponses à ce commentaire (fil) */}
                {comments.filter(r => r.parentId === c.id).map(r => (
                  <div key={r.id} style={{ display:'flex', gap:8, marginTop:8, marginLeft:4, paddingLeft:8, borderLeft:'2px solid rgba(90,176,255,0.2)' }}>
                    <div style={{ width:24, height:24, borderRadius:99, background:'linear-gradient(135deg,#5BB0FF,#1a6bff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>
                      {r.userPhoto ? <img src={r.userPhoto} style={{ width:24, height:24, borderRadius:99 }} alt="" /> : r.userName?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, fontSize:11, color:'#5BB0FF', marginBottom:1 }}>{r.userName}</p>
                      <p style={{ fontSize:12, color:'#dde4f5', lineHeight:1.4 }}>{r.text}</p>
                      <div style={{ display:'flex', gap:8, marginTop:2 }}>
                        <p style={{ fontSize:9, color:'#4a5878' }}>{new Date(r.createdAt).toLocaleDateString('fr')}</p>
                        {user && r.userId === user.uid && (
                          <button onClick={async () => { if (window.confirm('Supprimer cette réponse ?')) await deleteDoc(doc(db,'commentaires',r.id)); }}
                            style={{ fontSize:9, color:'#f04a6a', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                            Supprimer
                          </button>
                        )}
                        {user && user.email === ADMIN_EMAIL && r.userId !== user.uid && (
                          <button onClick={async () => { if (window.confirm('Supprimer cette réponse (admin) ?')) await deleteDoc(doc(db,'commentaires',r.id)); }}
                            style={{ fontSize:9, color:'#f04a6a', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                            Supprimer (admin)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TRAVAILLEURS — classement des donateurs + messages honorifiques
// ─────────────────────────────────────────────
const MESSAGES_HONORIFIQUES = [
  "Merci infiniment pour ton soutien, tu es un vrai Travailleur !",
  "Ton kiffement me touche profondément, que Dieu te bénisse !",
  "Tu es la raison pour laquelle je continue à créer. Merci !",
  "Un grand merci à toi, mon fidèle Travailleur !",
  "Ton soutien me donne de l'énergie. Je te dédie cette musique !",
];

function Travailleurs({ qrId, artistEmail }: { qrId: string, artistEmail?: string }) {
  const [travailleurs, setTravailleurs] = useState<any[]>([]);
  const [showReply, setShowReply] = useState<string|null>(null);
  const [replyMsg, setReplyMsg] = useState('');
  const user = auth.currentUser;
  const isArtist = user?.email === artistEmail;

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'cadeaux'), where('qrId','==',qrId)),
      snap => {
        const map: Record<string, any> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const uid = data.userId;
          if (!map[uid]) map[uid] = { userId:uid, userName:data.userName, coins:0, count:0 };
          map[uid].coins += data.coins || 0;
          map[uid].count += 1;
        });
        const sorted = Object.values(map).sort((a:any,b:any) => b.coins - a.coins);
        setTravailleurs(sorted);
      }
    );
    return unsub;
  }, [qrId]);

  const getTitre = (coins: number) => {
    if (coins >= 50) return { titre:'Travailleur Elite', color:'#ffd700' };
    if (coins >= 20) return { titre:'Grand Travailleur', color:'#c0c0c0' };
    if (coins >= 10) return { titre:'Travailleur', color:'#cd7f32' };
    return { titre:'Supporter', color:'#8098b8' };
  };

  const sendReply = async (travailleur: any) => {
    if (!replyMsg) return;
    await envoyerNotification({
      to: travailleur.userId,
      type: 'remerciement',
      text: replyMsg,
      from: user?.displayName || artistEmail,
      qrId,
    });
    setShowReply(null);
    setReplyMsg('');
    alert('Message envoyé !');
  };

  if (travailleurs.length === 0) return null;

  return (
    <div style={{ marginBottom:16 }}>
      <p style={{ fontSize:11, fontWeight:700, color:'#ffd700', letterSpacing:1, marginBottom:8, textTransform:'uppercase' }}>
        Travailleurs
      </p>
      {travailleurs.slice(0,5).map((t,i) => {
        const { titre, color } = getTitre(t.coins);
        return (
          <div key={t.userId} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.15)', borderRadius:10, marginBottom:6 }}>
            <span style={{ fontSize:16, fontWeight:900, color:'#ffd700', minWidth:20 }}>#{i+1}</span>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:700, fontSize:13, color:'#dde4f5', margin:0 }}>{t.userName}</p>
              <p style={{ fontSize:10, color, margin:0 }}>{titre} · {t.coins} Oscart · {t.count} kiffements</p>
            </div>
            {isArtist && (
              <button onClick={() => setShowReply(showReply === t.userId ? null : t.userId)}
                style={{ padding:'4px 10px', borderRadius:8, border:'1px solid rgba(255,215,0,0.3)', background:'transparent', color:'#ffd700', fontSize:11, cursor:'pointer' }}>
                Remercier
              </button>
            )}
          </div>
        );
      })}

      {/* Panel remerciement */}
      {showReply && isArtist && (
        <div style={{ background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:12, padding:14, marginTop:8 }}>
          <p style={{ color:'#ffd700', fontSize:12, fontWeight:700, marginBottom:8 }}>Message honorifique</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {MESSAGES_HONORIFIQUES.map((m,i) => (
              <button key={i} onClick={() => setReplyMsg(m)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${replyMsg===m?'#ffd700':'rgba(255,215,0,0.2)'}`, background: replyMsg===m?'rgba(255,215,0,0.1)':'transparent', color:'#dde4f5', fontSize:12, cursor:'pointer', textAlign:'left' }}>
                {m}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => sendReply(travailleurs.find(t => t.userId === showReply))}
              style={{ flex:1, padding:10, borderRadius:10, border:'none', background:'#ffd700', color:'#1a2340', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Envoyer
            </button>
            <button onClick={() => setShowReply(null)}
              style={{ padding:10, borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TUTO POINTER — flèche qui pointe le vrai bouton
// ─────────────────────────────────────────────
const TUTO_STEPS = [
  { id:'btn-play', label:'Écoutez', desc:'Appuyez sur Play pour écouter la musique de votre artiste', color:'#1a6bff' },
  { id:'btn-download', label:'Téléchargez', desc:'Téléchargez ce contenu sur votre téléphone', color:'#1a6bff' },
  { id:'btn-like', label:'Kiffez', desc:'Appuyez sur Kiff pour soutenir votre artiste', color:'#f04a6a' },
  { id:'btn-kiffement', label:'Kiffement', desc:'Envoyez un kiffement — 70% va directement à l\'artiste', color:'#ffd700' },
  { id:'btn-ziko', label:'Zikothèque', desc:'Ajoutez à votre Zikothèque pour retrouver ce contenu partout', color:'#7c3aed' },
  { id:'pwa-install-btn', label:'Installer l\'app', desc:'Installez Doniel Zik pour accéder à votre musique partout', color:'#1a6bff' },
];

function TutoPointer({ step, onNext, onSkip }: { step: number, onNext: () => void, onSkip: () => void }) {
  const [arrowPos, setArrowPos] = useState<{x:number,y:number,w:number,h:number}|null>(null);
  const current = TUTO_STEPS[step - 1];
  const retryRef = useRef<any>(null);

  const findAndPosition = () => {
    if (!current?.id) { setArrowPos(null); return; }
    const el = document.getElementById(current.id);
    if (!el) {
      retryRef.current = setTimeout(findAndPosition, 300);
      return;
    }
    const rect = el.getBoundingClientRect();
    setArrowPos({ x: rect.left + rect.width/2, y: rect.top, w: Math.max(rect.width, 40), h: Math.max(rect.height, 40) });
  };

  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    setArrowPos(null);
    // Attendre 500ms que le DOM se stabilise
    retryRef.current = setTimeout(findAndPosition, 500);
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLast = step === 6;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9998, pointerEvents:'none' }}>
      <style>{`
        @keyframes tutoArrow { 0%,100%{transform:translateY(0) translateX(-50%)} 50%{transform:translateY(-10px) translateX(-50%)} }
        @keyframes tutoSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tutoPulse { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.2);opacity:0.4} }
      `}</style>

      {/* Overlay sombre */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)' }} />

      {/* Flèche + cercle sur le bouton */}
      {arrowPos && (
        <>
          {/* Cercle pulsant autour du bouton */}
          <div style={{
            position:'absolute',
            left: arrowPos.x - arrowPos.w/2 - 8,
            top: arrowPos.y - 8,
            width: arrowPos.w + 16,
            height: arrowPos.h + 16,
            borderRadius: 99,
            border: `3px solid ${current.color}`,
            boxShadow: `0 0 0 4px ${current.color}33`,
            animation: 'tutoPulse 1.2s ease infinite',
            zIndex: 9999,
          }} />
          {/* Flèche pointante */}
          <div style={{
            position:'absolute',
            left: arrowPos.x,
            top: arrowPos.y - 50,
            animation: 'tutoArrow 0.8s ease infinite',
            zIndex: 9999,
          }}>
            <svg width="28" height="36" viewBox="0 0 28 36">
              <polygon points="14,36 0,0 28,0" fill={current.color}/>
            </svg>
          </div>
        </>
      )}

      {/* Bulle info en bas */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, pointerEvents:'auto', animation:'tutoSlide .3s ease' }}>
        <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'20px 24px 36px', maxWidth:500, margin:'0 auto', boxShadow:'0 -8px 32px rgba(0,0,0,0.3)' }}>
          {/* Points de progression */}
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:16 }}>
            {TUTO_STEPS.map((_,i) => (
              <div key={i} style={{ width:i+1===step?24:8, height:8, borderRadius:99, background:i+1===step?current.color:'#dce6f7', transition:'all .3s' }} />
            ))}
          </div>

          <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', textAlign:'center', marginBottom:8 }}>{current.label}</p>
          <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.7, textAlign:'center', marginBottom:20 }}>{current.desc}</p>

          {isLast ? (
            <>
              <button onClick={() => { document.getElementById('pwa-install-btn')?.click(); onSkip(); }}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                Installer Doniel Zik
              </button>
              <button onClick={onSkip}
                style={{ width:'100%', padding:10, borderRadius:12, border:'1px solid #dce6f7', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Plus tard
              </button>
            </>
          ) : (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onSkip}
                style={{ flex:1, padding:10, borderRadius:12, border:'1px solid #dce6f7', background:'transparent', color:'#b0c4d8', fontSize:13, cursor:'pointer' }}>
                Passer
              </button>
              <button onClick={onNext}
                style={{ flex:2, padding:12, borderRadius:12, border:'none', background:current.color, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Suivant →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACTION BAR — barre horizontale Kiff · Commenter · Kiffement · Buzz
// ─────────────────────────────────────────────
function ActionBar({ qrId, artistEmail, buzz, tutoStep, onTutoNext, source = 'qr' }: {
  qrId: string, artistEmail?: string, buzz: number, tutoStep: number, onTutoNext: () => void, source?: 'qr' | 'public'
}) {
  const [kiffs, setKiffs] = useState(0);
  const kiffsBase = useRef(0); // dernier total connu de Firestore
  const [kiffsLocaux, setKiffsLocaux] = useState(0); // +1 instantanés en attente de synchro
  const [justKiffed, setJustKiffed] = useState(false);
  const [flyHearts, setFlyHearts] = useState<{id:number,dx:number,size:number,dur:number,sway:number}[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showKiffements, setShowKiffements] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [byTypeRecu, setByTypeRecu] = useState<{ id:string, label:string, image:string, count:number }[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState('');
  const [showSignatures, setShowSignatures] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db,'kiffs_compteur', qrId), snap => {
      const total = snap.exists() ? (snap.data().total || 0) : 0;
      kiffsBase.current = total;
      setKiffs(total);
      setKiffsLocaux(0); // Firestore a rattrapé → on annule l'offset optimiste
    });
    const unsub2 = onSnapshot(query(collection(db,'commentaires'),where('qrId','==',qrId)), snap => setCommentCount(snap.size));
    const unsub3 = onSnapshot(query(collection(db,'cadeaux'),where('qrId','==',qrId)), snap => {
      const totalOscart = snap.docs.reduce((s,d) => s + (d.data().coins||0), 0);
      setTotalCoins(totalOscart);
      const counts: Record<string, number> = {};
      snap.docs.forEach(d => { const kid = d.data().kiffementId; if (kid) counts[kid] = (counts[kid]||0) + 1; });
      setByTypeRecu(KIFFEMENTS.filter(k => counts[k.id]).map(k => ({ id:k.id, label:k.label, image:k.image, count:counts[k.id] })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [qrId, user]);

  const tapKiff = async () => {
    if (!user) { setShowLoginModal('Connectez-vous pour kiffer votre artiste'); return; }
    // Réaction IMMÉDIATE : cœur qui s'envole tout de suite (comme TikTok), sans attendre le réseau
    const id = Date.now() + Math.random();
    const news = [{
      id,
      dx: (Math.random() - 0.5) * 50,
      size: 26 + Math.random() * 20,
      dur: 1.1 + Math.random() * 0.6,
      sway: (Math.random() - 0.5) * 80,
    }];
    setFlyHearts(h => [...h, ...news]);
    setKiffsLocaux(n => n + 1); // +1 INSTANTANÉ à l'écran, sans attendre Firestore
    setTimeout(() => setFlyHearts(h => h.filter(x => x.id !== id)), 1800);
    setJustKiffed(true); setTimeout(() => setJustKiffed(false), 250);
    if (tutoStep === 3) onTutoNext();
    // Enregistrement en arrière-plan : si plus de kiffs disponibles, on propose d'en offrir
    try {
      const r = await donnerKiff(user.uid, qrId, artistEmail, source);
      if (r === 'vide') { setShowKiffements(true); }
      else if (r === 'ok') {
        // Notif activité (message 4) : quelqu'un a kiffé ce contenu
        notifierActiviteCommunaute(qrId, user.uid,
          `${user.displayName || 'Quelqu\'un'} a kiffé ce contenu. Toi aussi, montre ton soutien : kiffe-le !`);
        // Notif à l'ARTISTE (B1), modérée car le kiff arrive souvent
        if (artistEmail && Math.random() < 0.25) {
          await envoyerNotification({
            to: artistEmail, role:'artiste', type:'kiff',
            text: `${user.displayName || 'Un fan'} a kiffé votre contenu ! Continuez comme ça.`,
            createdAt: new Date().toISOString(),          });
        }
      }
    } catch(e) { console.error(e); }
  };

  const btnStyle = (active?: boolean, color?: string) => ({
    flex:1,
    display:'flex',
    flexDirection:'column' as const,
    alignItems:'center',
    gap:3,
    padding:'10px 4px',
    border:'none',
    background: active ? `rgba(${color||'30,111,255'},0.12)` : 'rgba(255,255,255,0.04)',
    borderRadius:12,
    cursor:'pointer',
    color: active ? (color ? `rgb(${color})` : '#1a6bff') : '#8098b8',
    transition:'all .2s',
  });

  return (
    <div style={{ marginBottom:16 }}>
      <style>{`
        @keyframes heartFly {
          0%   { opacity:0; transform:translateX(-50%) translateY(0) scale(.3) rotate(0deg); }
          10%  { opacity:1; transform:translateX(-50%) translateY(-10px) scale(1.4) rotate(-6deg); }
          50%  { opacity:1; }
          100% { opacity:0; transform:translateX(calc(-50% + var(--sway))) translateY(-240px) scale(.85) rotate(10deg); }
        }
        @keyframes heartPop { 0%{transform:scale(1)} 35%{transform:scale(1.7)} 100%{transform:scale(1)} }
        @keyframes countPop { 0%{transform:scale(1)} 30%{transform:scale(1.45); color:#ff3b6b} 100%{transform:scale(1)} }
      `}</style>
      {showLoginModal && <LoginModal message={showLoginModal} onClose={() => setShowLoginModal('')} />}
      {showSignatures && <SignatureShowcase onClose={() => setShowSignatures(false)} />}
      {/* Barre principale */}
      <div id="action-bar" style={{ display:'flex', gap:6, marginBottom:8 }}>
        {/* KIFF */}
        <button id="btn-like" onClick={tapKiff} style={{ ...btnStyle(justKiffed, '240,74,106'), position:'relative', overflow:'visible' }}>
          {flyHearts.map(h => (
            <span key={h.id} style={{ position:'absolute', left:`calc(50% + ${h.dx}px)`, bottom:'70%', ['--sway' as any]:`${h.sway}px`, transform:'translateX(-50%)', pointerEvents:'none', color:'#ff3b6b', fontSize:h.size, lineHeight:1, textShadow:'0 2px 10px rgba(255,59,107,0.7)', animation:`heartFly ${h.dur}s ease-out forwards`, zIndex:30 }}>&#10084;</span>
          ))}
          <svg width="20" height="20" viewBox="0 0 24 24" fill={justKiffed?'#ff3b6b':'none'} stroke={justKiffed?'#ff3b6b':'#8098b8'} strokeWidth="2" style={{ animation: justKiffed ? 'heartPop .3s ease' : 'none' }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700, display:'inline-block', animation: justKiffed ? 'countPop .3s ease' : 'none' }}>Kiff {(kiffs + kiffsLocaux) > 0 ? (kiffs + kiffsLocaux) : ''}</span>
        </button>

        {/* COMMENTER */}
        <button id="btn-comment" onClick={() => { setShowComments(!showComments); if (tutoStep === 4) onTutoNext(); }} style={btnStyle(showComments)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700 }}>Commenter {commentCount > 0 ? commentCount : ''}</span>
        </button>

        {/* KIFFEMENT */}
        <button id="btn-kiffement" onClick={() => { setShowKiffements(!showKiffements); if (tutoStep === 5) onTutoNext(); }} style={btnStyle(showKiffements, '255,215,0')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700 }}>Kiffement {totalCoins > 0 ? totalCoins+' Oscart' : ''}</span>
        </button>


        {/* SIGNATURE */}
        <button onClick={() => setShowSignatures(true)} style={{ ...btnStyle(false, '255,215,0'), background:'rgba(255,215,0,0.1)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700, color:'#ffd700' }}>Signature</span>
        </button>

        {/* BUZZ */}
        <div style={{ ...btnStyle(), cursor:'default' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:700 }}>Buzz {buzz > 0 ? buzz : ''}</span>
        </div>
      </div>

      {/* Section commentaires dépliable */}
      {showComments && <CommentSection qrId={qrId} artistEmail={artistEmail} autoOpen={true} onClose={() => setShowComments(false)} source={source} />}

      {/* Section kiffements dépliable */}
      {showKiffements && <KiffementSection qrId={qrId} artistEmail={artistEmail} autoOpen={true} onClose={() => setShowKiffements(false)} source={source} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// LIKE BUTTON — like sur un contenu
// ─────────────────────────────────────────────
function LikeButton({ qrId, compact, artistEmail, source = 'qr' }: { qrId: string, compact?: boolean, artistEmail?: string, source?: 'qr' | 'public' }) {
  const [justKiffed, setJustKiffed] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    if (!qrId) return;
    // Charger le nombre de likes
    const unsub = onSnapshot(doc(db,'kiffs_compteur', qrId), snap => {
      setCount(snap.exists() ? (snap.data().total || 0) : 0);
    });
    return unsub;
  }, [qrId, user]);

  const tap = async () => {
    if (!user) { setShowLoginModal('Connectez-vous pour kiffer ce contenu'); return; }
    if (loading) return;
    // Animation IMMÉDIATE (avant le réseau) pour une réaction instantanée
    setJustKiffed(true);
    setTimeout(() => setJustKiffed(false), 280);
    setLoading(true);
    // Enregistrement en arrière-plan (ne bloque pas l'animation)
    try {
      const r = await donnerKiff(user.uid, qrId, artistEmail, source);
      if (r === 'vide') { alert('Offre un kiffement pour obtenir des kiffs à donner.'); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      {showLoginModal && <LoginModal message={showLoginModal} onClose={() => setShowLoginModal('')} />}
      <button onClick={tap} title="Kiff"
        style={ compact
          ? { display:'inline-flex', alignItems:'center', gap:4, padding:'0 10px', height:40, borderRadius:99, border:'none', background: justKiffed?'rgba(240,74,106,0.15)':'rgba(255,255,255,0.06)', color: justKiffed?'#f04a6a':'#8098b8', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0 }
          : { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:99, border:`1px solid ${justKiffed?'rgba(240,74,106,0.5)':'rgba(255,255,255,0.1)'}`, background: justKiffed?'rgba(240,74,106,0.1)':'transparent', color: justKiffed?'#f04a6a':'#8098b8', cursor:'pointer', fontSize:14, fontWeight:600, transition:'all .2s' } }>
        <svg width="17" height="17" viewBox="0 0 24 24" fill={justKiffed?'#f04a6a':'none'} stroke={justKiffed?'#f04a6a':'currentColor'} strokeWidth="2" style={{ transform: justKiffed?'scale(1.4)':'scale(1)', transition:'transform .15s ease' }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        {compact ? (count > 0 ? count.toLocaleString() : '') : `Kiff ${count > 0 ? count.toLocaleString() : ''}`}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// AUDIO PLAYER — bannière pub pendant lecture + timer 7s + VideoPlayer avec pub YouTube
// ─────────────────────────────────────────────
function AudioPlayer({ files, onStream, onPlay, onDownload, onPlayingChange, autoStartIdx, autoStartCle, onFinAlbum, albumTitre, albumArtiste, albumCover }: { files: any[], onStream?: (track: string, duration: number) => void, onPlay?: () => void, onDownload?: () => void, onPlayingChange?: (playing: boolean) => void, autoStartIdx?: number, autoStartCle?: number, onFinAlbum?: () => void, albumTitre?: string, albumArtiste?: string, albumCover?: string }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { onPlayingChange?.(playing); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [ct, setCt] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  const streamStart = useRef<number>(0);
  const stopTimer = useRef<any>(null);
  const derniereCleAuto = useRef<number>(0);
  const cur = files[idx];

  // ── Analyseur audio (avec protection : si échec, le son continue) ──
  const audioCtxRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const rafRef = useRef<any>(null);
  const analyserFailed = useRef<boolean>(false);
  const setupAnalyser = () => {
    if (!ref.current || audioCtxRef.current || analyserFailed.current) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) { analyserFailed.current = true; return; }
      const ctx = new AC();
      const src = ctx.createMediaElementSource(ref.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75; // lissage pour un mouvement continu
      src.connect(analyser);
      analyser.connect(ctx.destination); // reconnecte le son aux HP
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch (e) {
      analyserFailed.current = true;
    }
  };
  const loopRunning = useRef<boolean>(false);
  const smoothLevel = useRef<number>(0);
  const startLevelLoop = () => {
    if (!analyserRef.current || loopRunning.current) return;
    loopRunning.current = true;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    const tick = () => {
      if (!loopRunning.current || !analyserRef.current) return;
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      analyserRef.current.getByteFrequencyData(data);
      // Niveau brut (basses + médiums)
      let sum = 0; const n = Math.min(20, data.length);
      for (let i = 0; i < n; i++) sum += data[i];
      const raw = (sum / n) / 255; // 0 → 1
      // Lissage asymétrique : monte vite (attaque), retombe doucement (release)
      // → la pochette POUSSE sur les beats puis REDESCEND (elle danse)
      if (raw > smoothLevel.current) {
        smoothLevel.current = smoothLevel.current * 0.4 + raw * 0.6; // attaque rapide
      } else {
        smoothLevel.current = smoothLevel.current * 0.85 + raw * 0.15; // release douce
      }
      const level = smoothLevel.current;
      const img = document.getElementById('cover-reactive');
      // Marge de jeu musical : zoom de 0% (silence) à 12% (grosse caisse saturée)
      // + FLASH lumineux : la pochette s'illumine et un halo lumineux pulse en rythme
      // Tout est piloté ici dans la même boucle audio → AUCUNE latence
      if (img) {
        const zoom = 1 + level * 0.12;
        // Halo lumineux blanc/doré qui flashe avec l'intensité (rayon + opacité suivent le son)
        const glowRadius = Math.round(level * 55);          // 0 → 55px
        const glowOpacity = Math.min(0.9, level * 1.1);      // 0 → 0.9
        const glow2 = Math.round(level * 110);               // halo large secondaire
        // Éclat de lumière (brightness) : flash bref sur les beats forts
        const brightness = 1 + level * 0.35;                 // 1 → 1.35
        img.style.transform = `scale(${zoom})`;
        img.style.boxShadow = `0 0 ${glowRadius}px ${Math.round(glowRadius/2)}px rgba(255,245,210,${glowOpacity}), 0 0 ${glow2}px ${Math.round(glow2/3)}px rgba(255,220,130,${glowOpacity * 0.5})`;
        img.style.filter = `brightness(${brightness})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };
  const stopLevelLoop = () => {
    loopRunning.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const img = document.getElementById('cover-reactive');
    if (img) { img.style.transform = 'scale(1)'; img.style.boxShadow = 'none'; img.style.filter = 'none'; }
  };
  useEffect(() => () => { stopLevelLoop(); if (audioCtxRef.current) audioCtxRef.current.close?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Relance la boucle si elle s'est arrêtée pendant la lecture (sécurité anti-blocage)
  useEffect(() => {
    if (playing && analyserRef.current && !loopRunning.current) {
      startLevelLoop();
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Pub plein écran après arrêt/fin
  const [showPubAfter, setShowPubAfter] = useState(false);
  const [pendingNext, setPendingNext] = useState(false);
  void showPubAfter; void setShowPubAfter; void pendingNext; void setPendingNext;
  const [showPlaylist, setShowPlaylist] = useState(false);

  // Pub pendant lecture SUPPRIMÉE — la pub vient uniquement APRÈS la lecture complète

  const toggle = () => {
    if (!ref.current) return;
    if (playing) {
      const elapsed = Date.now() / 1000 - streamStart.current;
      if (elapsed > 2 && onStream) onStream(cur?.name || 'Piste ' + (idx + 1), elapsed);
      ref.current.pause();
      setPlaying(false);
      stopLevelLoop();
    } else {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      streamStart.current = Date.now() / 1000;
      setupAnalyser();
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      ref.current.play().catch(() => setPlaying(false));
      setPlaying(true);
      startLevelLoop();
      if (onPlay) onPlay();
    }
  };

  useEffect(() => () => { if (stopTimer.current) clearTimeout(stopTimer.current); }, []);

  const prev = () => {
    if (idx > 0) { setIdx(i => i - 1); setPlaying(true); streamStart.current = Date.now() / 1000; if (ref.current) ref.current.play().catch(()=>setPlaying(false)); }
  };

  const next = () => {
    if (idx < files.length - 1) { setIdx(i => i + 1); setPlaying(true); streamStart.current = Date.now() / 1000; if (ref.current) ref.current.play().catch(()=>setPlaying(false)); }
  };

  // ── MEDIA SESSION — expose la piste courante à l'OS (écran de verrouillage,
  // notification système, touches média). Les handlers sont (ré)enregistrés
  // par le lecteur qui joue réellement — mini-lecteur ou pleine page.
  const msNavRef = useRef({ prev: () => {}, next: () => {}, toggle: () => {} });
  useEffect(() => { msNavRef.current = { prev, next, toggle }; });
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => msNavRef.current.toggle());
      navigator.mediaSession.setActionHandler('pause', () => msNavRef.current.toggle());
      navigator.mediaSession.setActionHandler('previoustrack', () => msNavRef.current.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => msNavRef.current.next());
    } catch { /* action non supportée */ }
  }, []);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch { /* ignore */ }
  }, [playing]);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !cur) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (cur.name || 'Piste').replace(/\.[^/.]+$/, ''),
        artist: albumArtiste || '',
        album: albumTitre || 'Doniel Zik',
        artwork: albumCover ? [{ src: optimImg(albumCover, 512), sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    } catch { /* ignore */ }
  }, [cur, albumArtiste, albumTitre, albumCover]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lecture automatique demandée par le parent (enchaînement playlists/albums).
  // autoStartCle change à chaque demande → (re)lance la piste autoStartIdx.
  // files.length est une dépendance : au 1er montage via une playlist, les
  // fichiers arrivent après coup (chargement Firestore) → on relance alors.
  useEffect(() => {
    if (!autoStartCle || autoStartIdx === undefined) return; // 0 = aucune demande d'auto-start
    if (!files[autoStartIdx]) return;
    // Garde anti-doublon : StrictMode (dev) invoque chaque effet 2× — sans
    // cette garde, load()+play() partent en parallèle et l'horloge audio se fige.
    if (derniereCleAuto.current === autoStartCle) return;
    derniereCleAuto.current = autoStartCle;
    const srcCible = files[autoStartIdx]?.url || '';
    const memeSrc = !!ref.current?.currentSrc && !!srcCible && ref.current.currentSrc.includes(srcCible.split('/').pop() || '___');
    if (idx !== autoStartIdx) setIdx(autoStartIdx);
    if (memeSrc && ref.current && !ref.current.paused) return; // déjà en lecture sur la bonne piste
    setPlaying(true);
    streamStart.current = Date.now() / 1000;
    const a = ref.current;
    if (a) {
      // load() uniquement si la source réelle change — sinon on coupe une lecture en cours
      if (!memeSrc) a.load();
      const lancer = () => {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        setupAnalyser();
        // Si le navigateur bloque la lecture (autoplay strict), rétablir
        // l'état « en pause » pour que le 1er tap sur ▶ lance vraiment le son.
        a.play().then(() => startLevelLoop()).catch(() => setPlaying(false));
      };
      lancer();
      a.addEventListener('canplay', lancer, { once: true });
      return () => a.removeEventListener('canplay', lancer);
    }
  }, [autoStartCle, files.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Au changement de piste : recharger et relancer la lecture (même élément audio, fiable sur mobile)
  useEffect(() => {
    const a = ref.current;
    if (!a || !cur) return;
    // load() uniquement si la source change vraiment — sinon on coupe une lecture en cours
    if (!a.currentSrc || !(cur.url || '') || !a.currentSrc.includes((cur.url || '').split('/').pop() || '___')) a.load();
    if (playing) {
      const lancer = () => {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        setupAnalyser();
        a.play().then(() => { startLevelLoop(); }).catch(() => setPlaying(false));
      };
      lancer();
      a.addEventListener('canplay', lancer, { once: true });
      return () => a.removeEventListener('canplay', lancer);
    }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterPub = () => {};
  void afterPub;

  if (!files || files.length === 0) return null;

  return (
    <div style={{ background: 'rgba(20,28,48,0.92)', borderRadius: 16, padding: '12px 14px', border: '1px solid '+C.border, boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>

      <audio ref={ref} src={cur?.url} crossOrigin="anonymous"
        onTimeUpdate={() => { if (ref.current) { setCt(ref.current.currentTime); setProgress((ref.current.currentTime / ref.current.duration) * 100 || 0); } }}
        onLoadedMetadata={() => { if (ref.current) setDur(ref.current.duration); }}
        onCanPlay={() => { if (playing && ref.current && ref.current.paused) { ref.current.play().catch(()=>{}); } }}
        onPlay={() => { setPlaying(true); }}
        onEnded={() => {
          if (onStream) onStream(cur?.name || 'Piste ' + (idx + 1), ref.current?.duration || 0);
          if (idx < files.length - 1) {
            setIdx(i => i + 1);
            setPlaying(true);
          } else { setPlaying(false); stopLevelLoop(); if (onFinAlbum) onFinAlbum(); }
        }}
        preload="auto" />

      {/* LIGNE COMPACTE : play + titre + hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={prev} disabled={idx === 0}
          style={{ background: 'none', border: 'none', color: idx === 0 ? 'rgba(120,160,220,0.2)' : C.textSoft, fontSize: 16, cursor: idx === 0 ? 'default' : 'pointer', padding: 2, flexShrink: 0 }}>⏮</button>
        <button id="btn-play" onClick={toggle}
          style={{ width: 42, height: 42, borderRadius: 99, border: 'none', background: 'linear-gradient(135deg, '+C.blue+', #0050d0)', color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 14px rgba(10,132,255,0.5)', flexShrink: 0 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={next} disabled={idx === files.length - 1}
          style={{ background: 'none', border: 'none', color: idx === files.length - 1 ? 'rgba(120,160,220,0.2)' : C.textSoft, fontSize: 16, cursor: idx === files.length - 1 ? 'default' : 'pointer', padding: 2, flexShrink: 0 }}>⏭</button>

        {/* Titre + temps */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cur?.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (idx + 1)}
          </p>
          <p style={{ color: C.textSoft, fontSize: 10, margin: 0 }}>{formatTime(ct)} / {formatTime(dur)}{files.length > 1 ? `  ·  ${idx + 1}/${files.length}` : ''}</p>
        </div>

        {/* Bouton télécharger (près du play, reconnaissable) */}
        {onDownload && (
          <button onClick={onDownload} title="Télécharger"
            style={{ background: 'linear-gradient(135deg,'+C.blue+',#0050d0)', border: 'none', borderRadius: 10, height: 34, padding:'0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap:6, flexShrink: 0, color: '#fff', fontSize: 12, fontWeight:700, boxShadow:'0 2px 10px rgba(10,132,255,0.4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>
            </svg>
            Télécharger
          </button>
        )}

        {/* Hamburger playlist (si plusieurs pistes) */}
        {files.length > 1 && (
          <button onClick={() => setShowPlaylist(!showPlaylist)}
            style={{ background: showPlaylist ? 'rgba(10,132,255,0.18)' : 'transparent', border: '1px solid '+C.border, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0 }}>
            <span style={{ width: 14, height: 2, background: C.textSoft, borderRadius: 2 }} />
            <span style={{ width: 14, height: 2, background: C.textSoft, borderRadius: 2 }} />
            <span style={{ width: 14, height: 2, background: C.textSoft, borderRadius: 2 }} />
          </button>
        )}
      </div>

      {/* BARRE DE PROGRESSION fine */}
      <div
        onClick={(e) => { if (!ref.current || !ref.current.duration) return; const r = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.clientX - r.left) / r.width) * ref.current.duration; }}
        style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginTop: 10, cursor: 'pointer' }}>
        <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, '+C.blue+', '+C.blueLite+')', borderRadius: 99, transition: 'width .1s' }} />
      </div>

      {/* PLAYLIST déroulante (hamburger) */}
      {showPlaylist && files.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid '+C.border, paddingTop: 10, maxHeight: 200, overflowY: 'auto' }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { setIdx(i); setPlaying(true); streamStart.current = Date.now() / 1000; }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: i === idx ? 'rgba(10,132,255,0.15)' : 'transparent', marginBottom: 2 }}>
              <span style={{ color: i === idx ? C.blueLite : C.textSoft, fontSize: 12, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                {i === idx && playing ? '▶' : (i + 1)}
              </span>
              <span style={{ fontSize: 12, color: i === idx ? C.text : C.textSoft, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (i + 1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────
// TUTO CASCADE — bulles qui apparaissent après Play
// ─────────────────────────────────────────────
const TUTO_BUBBLES = [
  { id:'btn-like', text:'Kiffez la musique\nde votre artiste', color:'#f04a6a', side:'right' },
  { id:'btn-comment', text:'Commentez', color:'#1a6bff', side:'left' },
  { id:'btn-kiffement', text:'Faites un kiffement\nà votre artiste', color:'#ffd700', side:'right' },
  { id:'btn-ziko', text:'Ajoutez à votre\nZikothèque', color:'#7c3aed', side:'left' },
  { id:'btn-download', text:'Téléchargez\nla musique', color:'#00c853', side:'right' },
];

function TutoCascade({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{x:number,y:number,w:number,h:number}|null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (step >= TUTO_BUBBLES.length) { onDone(); return; }
    const bubble = TUTO_BUBBLES[step];
    const tryFind = (attempts = 0) => {
      const el = document.getElementById(bubble.id);
      if (!el && attempts < 10) { setTimeout(() => tryFind(attempts+1), 300); return; }
      if (!el) { setStep(s => s+1); return; }
      const rect = el.getBoundingClientRect();
      setPos({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, w: rect.width, h: rect.height });
      setVisible(true);
    };
    tryFind();
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setStep(s => s+1), 400);
    }, 3000);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (step >= TUTO_BUBBLES.length || !pos) return null;
  const bubble = TUTO_BUBBLES[step];
  const isRight = bubble.side === 'right';

  return (
    <div style={{ position:'fixed', zIndex:9990, pointerEvents:'none', inset:0 }}>
      {/* Overlay léger */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.3)' }} />

      {/* Cercle pulsant autour du bouton */}
      <div style={{
        position:'absolute',
        left: pos.x - pos.w/2 - 6,
        top: pos.y - pos.h/2 - 6,
        width: pos.w + 12,
        height: pos.h + 12,
        borderRadius: 99,
        border: `3px solid ${bubble.color}`,
        boxShadow: `0 0 0 6px ${bubble.color}44, 0 0 20px ${bubble.color}66`,
        animation: 'tutoPulse 1s ease infinite',
        zIndex: 9991,
      }} />

      {/* Bulle texte — grande et lisible */}
      <div style={{
        position:'absolute',
        left: isRight ? Math.min(pos.x + pos.w/2 + 16, window.innerWidth - 220) : Math.max(pos.x - pos.w/2 - 226, 8),
        top: Math.max(pos.y - 36, 8),
        background: `linear-gradient(135deg, ${bubble.color}, ${bubble.color}dd)`,
        color: '#fff',
        fontWeight: 900,
        fontSize: 14,
        borderRadius: 16,
        padding: '14px 18px',
        width: 200,
        lineHeight: 1.5,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.85)',
        transition: 'all .35s ease',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.2)`,
        whiteSpace: 'pre-wrap',
        zIndex: 9992,
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}>
        {bubble.text}
        {/* Flèche */}
        <div style={{
          position:'absolute',
          top: '50%',
          [isRight ? 'left' : 'right']: -12,
          transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: '10px solid transparent',
          borderBottom: '10px solid transparent',
          [isRight ? 'borderRight' : 'borderLeft']: `12px solid ${bubble.color}`,
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FAN PAGE
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// VIDEO PLAYER — pub avant/après comme YouTube
// ─────────────────────────────────────────────
function VideoPlayer({ files, onPlay }: { files: any[], onPlay?: () => void }) {
  const [idx, setIdx] = useState(0);
  const [showPubBefore, setShowPubBefore] = useState(false);
  void setShowPubBefore;
  const [showPubAfter, setShowPubAfter] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [pendingIdx, setPendingIdx] = useState<number|null>(null);
  void pendingIdx; void setPendingIdx;
  const ref = useRef<HTMLVideoElement>(null);
  const countRef = useRef<any>(null);
  if (!files || files.length === 0) return null;
  const cur = files[idx];

  // Compte à rebours 10s avant pub vidéo
  useEffect(() => {
    if (!showPubBefore) return;
    setCountdown(10);
    countRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countRef.current);
  }, [showPubBefore, idx]);

  return (
    <div style={{ background: '#000', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

      {/* Compte à rebours avant pub */}
      {showPubBefore && countdown > 0 && (
        <div style={{ position:'relative' }}>
          <video ref={ref} key={cur?.url} src={cur?.url} style={{ width:'100%', maxHeight:280, display:'block', opacity:0.3 }} />
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
            <div style={{ width:56, height:56, borderRadius:99, border:'3px solid #fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontWeight:900, fontSize:22 }}>{countdown}</span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>Publicité dans {countdown}s</p>
          </div>
        </div>
      )}

      {/* Lecteur vidéo */}
      {!showPubBefore && (
        <video
          ref={ref}
          key={cur?.url}
          src={cur?.url}
          controls
          controlsList="nodownload"
          autoPlay
          style={{ width: '100%', maxHeight: 280, background: '#000', display: 'block' }}
          onEnded={() => {
            if (idx < files.length - 1) {
              setIdx(idx + 1);
            }
          }}
        />
      )}

      {/* Titre */}
      <div style={{ padding: '10px 16px', background:'rgba(0,0,0,0.8)' }}>
        <p style={{ fontWeight: 700, fontSize: 13, color:'#fff' }}>{cur?.name?.replace(/\.[^/.]+$/, '') || 'Clip ' + (idx + 1)}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{idx + 1} / {files.length}</p>
      </div>

      {/* Liste clips */}
      {files.length > 1 && (
        <div style={{ padding: '8px 0', background:'rgba(0,0,0,0.6)' }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { if (i !== idx) setIdx(i); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', background: i === idx ? 'rgba(30,111,255,0.2)' : 'transparent' }}>
              <span style={{ color: i === idx ? '#4da6ff' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{i === idx ? '▶' : '○'}</span>
              <span style={{ fontSize: 12, color: i === idx ? '#fff' : 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name?.replace(/\.[^/.]+$/, '') || 'Clip ' + (i + 1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MEDIA PLAYERS — Audio + Video séparés
// ─────────────────────────────────────────────
function MediaPlayers({ files, onStream, onSafari, downloaded, onMarkDownloaded, onPlay }:
  { files: any[], onStream: (t: string, d: number) => void, onSafari: boolean, downloaded: boolean, onMarkDownloaded: () => void, onPlay?: () => void }) {
  const isVideo = (f: any) => /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(f.name || '');
  const audioFiles = files.filter(f => !isVideo(f));
  const videoFiles = files.filter(f => isVideo(f));
  return (
    <>
      {audioFiles.length > 0 && (
        <div style={S.card}>
          <p style={{ color: '#8098b8', fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>LECTEUR AUDIO</p>
          <AudioPlayer files={audioFiles} onStream={onStream} onPlay={onPlay} />
          {onSafari && !downloaded && (
            <div style={{ borderTop: '1px solid #dce6f7', paddingTop: 12 }}>
              <p style={{ color: '#8098b8', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>APPUYEZ LONGUEMENT POUR TELECHARGER</p>
              {audioFiles.map((f: any, i: number) => (
                <a key={i} href={f.url.replace('/upload/', '/upload/fl_attachment/')} download={f.name} target="_blank" rel="noreferrer"
                  onClick={i === 0 ? onMarkDownloaded : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f5f8ff', border: '1px solid #dce6f7', borderRadius: 10, padding: '10px 14px', marginBottom: 8, textDecoration: 'none', color: '#1a2340' }}>
                                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name?.replace(/\.[^/.]+$/, '')}</span>
                  <span style={{ color: '#1a6bff' }}>⬇</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {videoFiles.length > 0 && (
        <div style={S.card}>
          <p style={{ color: '#8098b8', fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>STREAMING VIDÉO — ACHETEURS UNIQUEMENT</p>
          <VideoPlayer files={videoFiles} onPlay={onPlay} />
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// MODAL CONNEXION RAPIDE POUR ZIKOTHÈQUE
// S'affiche en overlay sur la page, sans navigation
// ─────────────────────────────────────────────
function ZikoLoginModal({ onSuccess, onClose }: { onSuccess: (uid: string) => void, onClose: () => void }) {
  const [mode, setMode] = useState<'choose' | 'email' | 'register'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Écouter la connexion en temps réel
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { onSuccess(u.uid); }
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginGoogle = async () => {
    setLoading(true); setMsg('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onSuccess(result.user.uid);
    } catch (e: any) { setMsg(e.code === 'auth/popup-closed-by-user' ? 'Connexion annulée. Veuillez réessayer.' : 'Erreur Google: ' + e.message); setLoading(false); }
  };

  const loginEmail = async () => {
    setLoading(true); setMsg('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onSuccess(result.user.uid);
    } catch { setMsg('Email ou mot de passe incorrect'); setLoading(false); }
  };

  const registerEmail = async () => {
    if (!displayName) { setMsg('Entrez votre prénom'); return; }
    setLoading(true); setMsg('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      notifierAdminEnregistrement('Nouveau mélomane', `${displayName || ''} (${email})`);
      onSuccess(result.user.uid);
    } catch (e: any) { setMsg('Erreur: ' + e.message); setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 0 0 0' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:'100%', maxWidth:500, background:'#0f1322', borderRadius:'20px 20px 0 0', padding:'28px 20px 40px', border:'1px solid rgba(255,255,255,0.1)' }}>

        {/* Poignée */}
        <div style={{ width:40, height:4, background:'rgba(255,255,255,0.15)', borderRadius:99, margin:'0 auto 20px' }} />

        {/* Titre */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <p style={{ fontWeight:800, fontSize:18, color:'#fff', margin:0 }}>Ajouter à ma Zikothèque</p>
            <p style={{ color:'#4a5878', fontSize:12, margin:'4px 0 0' }}>Connectez-vous pour sauvegarder cet album</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:99, width:32, height:32, color:'#8098b8', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {mode === 'choose' && (
          <>
            {/* Google */}
            <button onClick={loginGoogle} disabled={loading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, width:'100%', padding:'14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continuer avec Google
            </button>
            <button onClick={() => setMode('email')} disabled={loading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, width:'100%', padding:'14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer' }}>
              Continuer avec l'email
            </button>
          </>
        )}

        {(mode === 'email' || mode === 'register') && (
          <>
            <button onClick={() => { setMode('choose'); setMsg(''); }} style={{ background:'none', border:'none', color:'#8098b8', cursor:'pointer', marginBottom:14, fontSize:13 }}>← Retour</button>
            {mode === 'register' && (
              <>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Prénom ou pseudo"
                  style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' }} />
              </>
            )}
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' }} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" type="password"
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', marginBottom:14, boxSizing:'border-box' }} />
            {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
            <button onClick={mode === 'register' ? registerEmail : loginEmail} disabled={loading}
              style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              {loading ? 'Chargement...' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button onClick={() => { setMode(mode === 'email' ? 'register' : 'email'); setMsg(''); }}
              style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', cursor:'pointer', fontSize:13 }}>
              {mode === 'email' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
            {mode === 'email' && (
              <button onClick={async () => {
                if (!email) { setMsg('Entrez votre email d\'abord'); return; }
                try { const r = await demanderResetPassword(email); if (r.ok) setMsg('Email de réinitialisation envoyé. Vérifiez aussi vos spams.'); else setMsg('Erreur : ' + (r.error||'')); }
                catch { setMsg('Email introuvable. Vérifiez votre adresse.'); }
              }} style={{ width:'100%', padding:'10px', border:'none', background:'transparent', color:'#a78bfa', cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:4 }}>
                Mot de passe oublié ?
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FanPage() {
  const { qrId } = useParams<{ qrId: string }>();
  const [step, setStep] = useState<'loading' | 'ready' | 'zipping' | 'done'>('loading');
  const [qrData, setQrData] = useState<any>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [zikoState, setZikoState] = useState<'idle' | 'modal' | 'adding' | 'done'>('idle');
  const [showPubAfterDL, setShowPubAfterDL] = useState(false);
  const [showZikoTuto, setShowZikoTuto] = useState(false);
  const [tutoStep, setTutoStep] = useState(0);
  const [showTutoCascade, setShowTutoCascade] = useState(false);
  const [tutoSeen, setTutoSeen] = useState(false);

  // Démarrer tuto après chargement des données
  useEffect(() => {
    if (localStorage.getItem('dz_tuto_seen_v4')) return;
    let attempts = 0;
    const tryStart = () => {
      attempts++;
      const el = document.getElementById('btn-play') || document.getElementById('btn-download') || document.getElementById('btn-like');
      if (el) {
        setTutoStep(1);
      } else if (attempts < 30) {
        setTimeout(tryStart, 300);
      }
    };
    setTimeout(tryStart, 800);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onSafari = isSafari() && isIOS() && !isChromeiOS();
  const qrDocId = useRef<string>('');

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'qrcodes'), where('qrId', '==', qrId));
      const snap = await getDocs(q);
      if (snap.empty) { setStep('ready'); return; } // QR inexistant → page vide mais pas bloquée
      const docId = snap.docs[0].id;
      qrDocId.current = docId;
      const data = { id: docId, ...snap.docs[0].data() } as any;
      setQrData(data);
      // Afficher la page TOUT DE SUITE (ne pas attendre l'écriture des stats)
      setStep('ready');
      // Enregistrer la visite EN ARRIÈRE-PLAN (ne bloque plus l'affichage)
      addDoc(collection(db, 'visits'), { qrId, artist: data.artist || '', label: data.label || '', ts: new Date().toISOString() }).catch(()=>{});
      updateDoc(doc(db, 'qrcodes', docId), { visits: (data.visits || 0) + 1 }).catch(()=>{});
    };
    load();
  }, [qrId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ajouter à la Zikothèque (appelé après connexion confirmée) ──
  const doAddToZiko = async (uid: string) => {
    if (!qrData) return;
    setZikoState('adding');
    try {
      const zikoData = {
        qrId: qrData.qrId || qrId,
        source: 'qr',
        label: qrData.label || '',
        artist: qrData.artist || '',
        type: qrData.type || 'album',
        files: qrData.files || [],
        coverUrl: qrData.coverUrl || '',
        addedAt: new Date().toISOString(),
      };
      const existing = await getDocs(query(
        collection(db, 'zikotheque'),
        where('uid', '==', uid),
        where('qrId', '==', zikoData.qrId)
      ));
      if (existing.empty) {
        await addDoc(collection(db, 'zikotheque'), { uid, ...zikoData });
        const uZiko = auth.currentUser;
        if (uZiko && qrData.qrId) {
          notifierActiviteCommunaute(qrData.qrId, uZiko.uid,
            `${uZiko.displayName || 'Quelqu\'un'} a ajouté "${qrData.label || 'ce contenu'}" à sa Zikothèque. Ajoute-le à la tienne aussi !`);
        }
        // Notif à l'ARTISTE (B1) : son contenu a été ajouté à une Zikothèque
        if (qrData.artistEmail) {
          await envoyerNotification({
            to: qrData.artistEmail, role:'artiste', type:'zikotheque',
            text: `${uZiko?.displayName || 'Un fan'} a ajouté votre contenu "${qrData.label || ''}" à sa Zikothèque.`,
            createdAt: new Date().toISOString(),          });
        }
      }
      setZikoState('done');
    } catch(e) { console.error('ziko', e); setZikoState('idle'); }
  };

  // ── Clic sur "Ajouter à ma Zikothèque" ──
  const handleAddToZiko = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await doAddToZiko(currentUser.uid);
    } else {
      setZikoState('modal');
    }
  };

  // ── Enregistrer un stream ──
  const recordStream = async (trackName: string, duration: number) => {
    if (!qrData || !qrDocId.current) return;
    try {
      await addDoc(collection(db, 'streams'), {
        qrId, artist: qrData.artist || '', label: qrData.label || '',
        track: trackName, duration: Math.round(duration),
        valid: true, ts: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'qrcodes', qrDocId.current), { streams: (qrData.streams || 0) + 1 });
      setQrData((prev: any) => ({ ...prev, streams: (prev.streams || 0) + 1 }));
      // Notif activité (message 8) : écouter arrive souvent → on ne notifie qu'occasionnellement (anti-spam)
      const uEcoute = auth.currentUser;
      if (uEcoute && qrData.qrId && Math.random() < 0.2) {
        notifierActiviteCommunaute(qrData.qrId, uEcoute.uid,
          `${uEcoute.displayName || 'Quelqu\'un'} écoute "${qrData.label || 'ce contenu'}". Écoute-le toi aussi !`);
      }
      // Déclencher tuto cascade après la première écoute
      if (!localStorage.getItem('dz_tuto_seen_v4')) {
        setTimeout(() => setShowTutoCascade(true), 500);
      }
      if (zikoState === 'idle') setShowZikoTuto(true);
    } catch (e) { console.error('stream', e); }
  };

  const markAsDownloaded = async () => {
    if (!qrData || downloaded || !qrDocId.current) return;
    setDownloaded(true);
    const newUsed = (qrData.usedScans || 0) + 1;
    try {
      await updateDoc(doc(db, 'qrcodes', qrDocId.current), {
        usedScans: newUsed, downloads: (qrData.downloads || 0) + 1,
        // On ne bloque plus jamais — le DL devient payant quand épuisé
        status: 'active',
      });
      // Notif activité (message 9) : quelqu'un a téléchargé ce contenu
      const u = auth.currentUser;
      if (u && qrData.qrId) {
        notifierActiviteCommunaute(qrData.qrId, u.uid,
          `${u.displayName || 'Quelqu\'un'} a téléchargé "${qrData.label || 'ce contenu'}". Télécharge-le toi aussi !`);
      }
      // Notif à l'ARTISTE (B1) : son contenu a été téléchargé
      if (qrData.artistEmail) {
        await envoyerNotification({
          to: qrData.artistEmail, role:'artiste', type:'telechargement',
          text: `${u?.displayName || 'Un fan'} a téléchargé votre contenu "${qrData.label || ''}".`,
          createdAt: new Date().toISOString(),        });
      }
    } catch(e) { console.error('markDL', e); }
  };

  const startDownload = async () => {
    if (!qrData) return;
    const files = qrData.files || [];
    if (files.length === 0) return;

    setStep('zipping');

    // Mobile — marquer AVANT le téléchargement pour ne pas perdre le tracking
    if (isMobileDevice()) {
      // 1. Marquer immédiatement comme téléchargé
      await markAsDownloaded();
      setDlStatus('Telechargement lance !');
      // 2. Ouvrir chaque fichier dans un nouvel onglet
      for (let i = 0; i < files.length; i++) {
        setDlProgress(Math.round(((i + 1) / files.length) * 100));
        const dlUrl = files[i].url.replace('/upload/', '/upload/fl_attachment/');
        window.open(dlUrl, '_blank');
        if (i < files.length - 1) await new Promise(r => setTimeout(r, 1500));
      }
      setDlProgress(100);
      setStep('done');
      setShowPubAfterDL(false);
      if (zikoState === 'idle') setShowZikoTuto(true);
      return;
    }

    // Desktop — ZIP
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder(qrData.label || APP_NAME) as any;
      for (let i = 0; i < files.length; i++) {
        setDlStatus('Preparation ' + (i + 1) + '/' + files.length);
        setDlProgress(Math.round((i / files.length) * 70));
        try {
          const r = await fetch(files[i].url.replace('/upload/', '/upload/fl_attachment/'));
          folder.file(files[i].name, await r.blob());
        } catch (e) { console.error(e); }
      }
      setDlStatus('Compression...'); setDlProgress(80);
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (m) => setDlProgress(80 + Math.round(m.percent * 0.2)));
      setDlProgress(100);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = (qrData.label || APP_NAME).replace(/[^a-zA-Z0-9_-]/g, '_') + '.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await markAsDownloaded();
      setDlStatus('Telechargement lance !');
      setShowPubAfterDL(false);
      setTimeout(() => setStep('done'), 1500);
    } catch (e: any) {
      setDlStatus('Erreur: ' + e.message);
      setStep('done');
    }
  };
  void startDownload; // conservé pour usage futur (le bouton du haut a été retiré)

  return (
    <div style={{ minHeight: '100vh', background: C.bgDeep, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .fp-row:hover { background: rgba(255,255,255,0.04) !important; }
        .fp-btn-dl:active { transform: scale(0.97); }
      `}</style>

      {/* ── LOADING ── */}
      {step === 'loading' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16 }}>
          <div style={{ width:44, height:44, border:'3px solid #1e6fff', borderTopColor:'transparent', borderRadius:99, animation:'spin .8s linear infinite' }} />
          <p style={{ color:'#4a5878', fontSize:13 }}>Chargement...</p>
        </div>
      )}

      {/* ── READY ── */}
      {step === 'ready' && qrData && (
        <div style={{ animation:'fadeUp .35s ease', paddingBottom:40 }}>
          {/* Bulles flottantes en bas à droite — ne prennent aucune place dans la
              mise en page et ne gênent jamais la pochette. Profil (et depuis là,
              bascule vers l'espace artiste) + Découvrir. */}
          <div style={{ position:'fixed', bottom:20, right:16, zIndex:60, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
            <Link to="/decouvrir" aria-label="Découvrir" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:99, background:'#1a2340', color:'#fff', textDecoration:'none', boxShadow:'0 4px 14px rgba(0,0,0,0.45)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </Link>
            <Link to="/profil" aria-label="Mon profil" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:99, background:'#1a2340', color:'#fff', textDecoration:'none', boxShadow:'0 4px 14px rgba(0,0,0,0.45)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </Link>
          </div>

          {/* PUB après téléchargement gratuit */}
      {/* ── TUTO CASCADE — bulles après Play ── */}
      {showTutoCascade && <TutoCascade onDone={() => { setShowTutoCascade(false); localStorage.setItem('dz_tuto_seen_v4','1'); }} />}

      {false && showPubAfterDL && (
        <PubOverlay trigger="download" onDone={() => setShowPubAfterDL(false)} />
      )}

      {/* PUB MAISON — supprimée sur FanPage, remplacée par tuto */}

          {/* POCHETTE — grande, visible, centrée en haut */}
          <div style={{ position:'relative', width:'100%', background:C.bgDeep }}>
            {qrData.coverUrl ? (
              <img
                src={optimImg(qrData.coverUrl, 800)}
                alt={qrData.label}
                style={{ width:'100%', maxHeight:360, objectFit:'cover', display:'block' }}
              />
            ) : (
              <div style={{ width:'100%', height:260, background:'linear-gradient(135deg,#0d1535,#1a3a6e)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={LOGO_B64} alt="DZ" style={{ width:100, opacity:0.35 }} />
              </div>
            )}
          </div>

          {/* TITRE + ARTISTE */}
          <div style={{ padding:'14px 18px 0', marginBottom:20 }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:4, lineHeight:1.1 }}>{qrData.label}</h1>
            <p style={{ color:'#6a88aa', fontSize:13 }}>par <strong style={{ color:'#4da6ff' }}>{qrData.artist}</strong></p>
          </div>

          <div style={{ padding:'0 16px', maxWidth:500, margin:'0 auto' }}>

            {/* ── TÉLÉCHARGER ──
                QR privé (totalScans défini, price=0) :
                  - scans restants → DL gratuit direct
                  - scans épuisés → DL payant via Wave (AchatWidget)
                Lien public (price > 0) → AchatWidget
            ── */}
            {qrData.files?.length > 0 && (() => {
              // QR privé = a un totalScans défini ET n'est pas un lien public
              // Un lien public a un publicLinkId ou vient de /ecoute/
              // Cette page (/fan/:qrId) EST la fan page de duplication par définition —
              // qu'un lien public existe aussi en parallèle pour ce même contenu n'a
              // aucune importance ici. Seul le nombre de scans définis compte.
              const isPrivateQR = qrData.totalScans > 0;
              const dlsEpuises = isPrivateQR && (qrData.usedScans || 0) >= (qrData.totalScans || 0);

              // Bouton "Télécharger l'album complet" du haut RETIRÉ (doublon) — seul le bouton Télécharger du bas est conservé
              if (isPrivateQR && !dlsEpuises) return null;

              // DL épuisés ou lien public → AchatWidget (payant)
              return (
                <>
                  {dlsEpuises && (
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'rgba(255,200,0,0.08)', border:'1px solid rgba(255,200,0,0.2)', marginBottom:12 }}>
                      <span style={{ fontSize:16 }}>ℹ</span>
                      <p style={{ color:'#ffd700', fontSize:12, fontWeight:600, margin:0 }}>
                        Les téléchargements gratuits de cette pochette sont épuisés. Le téléchargement est maintenant disponible via paiement.
                      </p>
                    </div>
                  )}
                  <AchatWidget
                    qrId={qrData.qrId || qrId || ''}
                    albumLabel={qrData.label || ''}
                    artistEmail={qrData.artistEmail || ''}
                    prix={qrData.price || 0}
                    files={qrData.files || []}
                    source="qr"
                  />
                </>
              );
            })()}

            {/* ── LECTEUR AUDIO ── */}
            {qrData.files?.some((f:any) => estFichierAudio(f)) && (
              <div style={{ marginBottom:20 }}>
                <AudioPlayer
                  files={qrData.files.filter((f:any) => estFichierAudio(f))}
                  onStream={recordStream}
                  onPlay={() => { if (!localStorage.getItem('dz_tuto_seen_v4')) setTimeout(() => setShowTutoCascade(true), 800); }}
                />
              </div>
            )}

            {/* ── BARRE ACTIONS HORIZONTALE — Kiff · Commenter · Kiffement · Buzz ── */}
            <ActionBar qrId={qrId || ''} artistEmail={qrData?.artistEmail} buzz={(qrData?.visits||0)+(qrData?.streams||0)} tutoStep={tutoStep} onTutoNext={() => setTutoStep(s => s+1)} source="qr" />

            {/* ── TRAVAILLEURS — classement donateurs ── */}
            {qrId && <Travailleurs qrId={qrId} artistEmail={qrData?.artistEmail} />}

            {/* ── VIDÉOS ── */}
            {qrData.files?.some((f:any) => f.name?.match(/\.(mp4|mov|avi|mkv|webm)$/i)) && (
              <div style={{ marginBottom:20 }}>
                <p style={{ color:'#4a5878', fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10, textTransform:'uppercase' }}>Vidéos</p>
                <VideoPlayer files={qrData.files.filter((f:any) => f.name?.match(/\.(mp4|mov|avi|mkv|webm)$/i))} onPlay={() => { if (!localStorage.getItem('dz_tuto_seen_v4')) setTimeout(() => setShowTutoCascade(true), 800); }} />
              </div>
            )}

            {/* ── BOUTON TÉLÉCHARGER GRATUIT — uniquement tant que le quota de
                scans n'est pas épuisé (sinon place au bouton payant plus haut).
                Un seul bouton, plus de liste déroulante (comme sur le lien
                public) ── */}
            {qrData.files?.length > 0 && !(qrData.totalScans > 0 && (qrData.usedScans || 0) >= (qrData.totalScans || 0)) && (
              <div style={{ marginBottom:20 }}>
                <button onClick={() => {
                    markAsDownloaded();
                    qrData.files.forEach((f:any, i:number) => {
                      setTimeout(() => {
                        const a = document.createElement('a');
                        a.href = f.url.replace('/upload/','/upload/fl_attachment/');
                        a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }, i * 400); // léger décalage pour que le navigateur ne bloque pas les téléchargements multiples
                    });
                    if (zikoState === 'idle') setTimeout(() => setShowZikoTuto(true), 800);
                  }}
                  style={{ width:'100%', padding:'14px 18px', borderRadius:14, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 4px 18px rgba(10,132,255,0.45)' }}>
                  <span style={{ fontSize:18 }}>⬇</span>
                  Télécharger {qrData.files.length > 1 ? `(${qrData.files.length} titres)` : ''}
                </button>
                {downloaded && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)' }}>
                    <span style={{ color:C.success, fontSize:16 }}>✓</span>
                    <p style={{ color:C.success, fontSize:12, fontWeight:700, margin:0 }}>Téléchargement effectué</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TUTO ZIKOTHÈQUE — après écoute ou téléchargement ── */}
            {showZikoTuto && zikoState === 'idle' && (
              <div style={{ animation:'fadeUp .4s ease', marginBottom:16, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.3)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:13, color:'#c4b5fd', margin:'0 0 4px' }}>
                    Vous voulez ajouter ce contenu à votre Zikothèque ?
                  </p>
                  <p style={{ color:'#8098b8', fontSize:12, lineHeight:1.6, margin:'0 0 10px' }}>
                    Retrouvez cette {qrData?.type === 'video' ? 'vidéo' : qrData?.type === 'album' ? 'album' : 'musique'} à tout moment, même sans le lien.
                  </p>
                  <div style={{ display:'flex', gap:8 }}>
                    <button id="btn-ziko" onClick={handleAddToZiko}
                      style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      Ajouter à ma Zikothèque
                    </button>
                    <button onClick={() => setShowZikoTuto(false)}
                      style={{ padding:'8px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                      Plus tard
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── AJOUTER À MA ZIKOTHÈQUE — uniquement si pas encore téléchargé via QR privé ── */}
            {!downloaded && (zikoState === 'done' ? (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:14, background:'rgba(30,200,100,0.1)', border:'1px solid rgba(30,200,100,0.3)', marginBottom:24 }}>
                                <div>
                  <p style={{ fontWeight:700, fontSize:14, color:'#4dff9a', margin:0 }}>Ajouté à ta Zikothèque !</p>
                  <a href="/ziko" style={{ color:'#4da6ff', fontSize:12, textDecoration:'none' }}>Voir ma Zikothèque →</a>
                </div>
              </div>
            ) : (
              <button onClick={handleAddToZiko} disabled={zikoState === 'adding'}
                style={{ width:'100%', padding:'15px 20px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:15, cursor: zikoState === 'adding' ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:12, marginBottom:24, opacity: zikoState === 'adding' ? 0.7 : 1, boxShadow:'0 4px 20px rgba(124,58,237,0.4)' }}>
                <span style={{ fontSize:22, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'4px 8px' }}>
                  {zikoState === 'adding' ? '' : ''}
                </span>
                <div style={{ textAlign:'left' }}>
                  <p style={{ margin:0, fontWeight:800 }}>{zikoState === 'adding' ? 'Ajout en cours...' : 'Ajouter à ma Zikothèque'}</p>
                  <p style={{ margin:0, fontSize:11, opacity:0.7 }}>Retrouvez cet album à tout moment</p>
                </div>
              </button>
            ))}

            {/* MODAL CONNEXION RAPIDE */}
            {zikoState === 'modal' && (
              <ZikoLoginModal
                onSuccess={(uid) => doAddToZiko(uid)}
                onClose={() => setZikoState('idle')}
              />
            )}

            {/* ── DÉCOUVRIR D'AUTRES ARTISTES — garder le visiteur sur la plateforme ── */}
            <Lien href="/decouvrir" style={{ textDecoration:'none', display:'block', marginBottom:20 }}>
              <div style={{ padding:'16px 20px', borderRadius:14, background:'linear-gradient(135deg,#1e6fff,#4da6ff)', display:'flex', alignItems:'center', gap:14, boxShadow:'0 4px 20px rgba(30,111,255,0.35)' }}>
                                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:15, color:'#fff' }}>Découvrir d'autres artistes</p>
                  <p style={{ margin:'2px 0 0', fontSize:12, color:'rgba(255,255,255,0.85)' }}>Explorez toute la musique et les talents sur Doniel Zik</p>
                </div>
                <span style={{ fontSize:20, color:'#fff' }}>→</span>
              </div>
            </Lien>

            {/* FOOTER */}
            <div style={{ textAlign:'center' }}>
              <img src={LOGO_B64} alt="DZ" style={{ width:36, opacity:0.4, display:'block', margin:'0 auto 6px' }} />
              <p style={{ color:'rgba(100,140,200,0.25)', fontSize:9, letterSpacing:2 }}>LA MUSIQUE. UN SCAN. UN MONDE.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ZIPPING ── */}
      {step === 'zipping' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:24 }}>
          <div style={{ width:'100%', maxWidth:340, background:'#0f1322', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:36, textAlign:'center' }}>
            <div style={{ width:52, height:52, border:'3px solid #1e6fff', borderTopColor:'transparent', borderRadius:99, margin:'0 auto 20px', animation:'spin .8s linear infinite' }} />
            <p style={{ fontWeight:700, fontSize:16, marginBottom:8, color:'#dde4f5' }}>Préparation...</p>
            <p style={{ color:'#4a5878', fontSize:13, marginBottom:20 }}>{dlStatus}</p>
            <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:99, marginBottom:10 }}>
              <div style={{ height:'100%', width:dlProgress+'%', background:'linear-gradient(90deg,#1e6fff,#4da6ff)', borderRadius:99, transition:'width .3s' }} />
            </div>
            <p style={{ color:'#1e6fff', fontWeight:800, fontSize:28 }}>{dlProgress}%</p>
          </div>
        </div>
      )}

      {/* ── LOCKED ── */}
      {/* ── DONE ── */}
      {step === 'done' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:24 }}>
          <div style={{ width:'100%', maxWidth:340, background:'#0f1322', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:36, textAlign:'center', animation:'fadeUp .4s ease' }}>
            <div style={{ width:68, height:68, borderRadius:99, background: dlStatus.startsWith('Erreur')?'rgba(240,74,106,0.15)':'rgba(30,111,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 20px', border: dlStatus.startsWith('Erreur')?'1px solid rgba(240,74,106,0.3)':'1px solid rgba(30,111,255,0.3)' }}>
              {dlStatus.startsWith('Erreur')?'':''}
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:800, marginBottom:8, color:'#dde4f5' }}>
              {dlStatus.startsWith('Erreur')?'Erreur':'Téléchargement lancé !'}
            </h2>
            <p style={{ color:'#4a5878', fontSize:13, lineHeight:1.7, marginBottom:20 }}>
              {dlStatus.startsWith('Erreur')?dlStatus:"Vos fichiers s'ouvrent dans un nouvel onglet. Appuyez longuement pour enregistrer."}
            </p>
            {!dlStatus.startsWith('Erreur') && (
              <>
                <a href="/ziko" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'14px', fontSize:14, fontWeight:700, borderRadius:14, border:'none', background:'linear-gradient(135deg,#1e6fff,#0050d0)', color:'#fff', textDecoration:'none', marginBottom:10, boxSizing:'border-box' }}>
                  Ma Zikothèque
                </a>
                <button onClick={() => setStep('ready')} style={{ width:'100%', padding:'12px', fontSize:13, fontWeight:700, borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#6a88aa', cursor:'pointer' }}>
                  Écouter en streaming
                </button>
              </>
            )}
            <p style={{ color:'#2a3a60', fontSize:10, marginTop:16 }}>DONIEL ZIK · La Musique. Un Scan. Un Monde.</p>
          </div>
        </div>
      )}

    </div>
  );
}
// ─────────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ARTISTES TAB — Liste des artistes enregistrés
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// POCHETTE GENERATOR (dans AdminPage — onglet Pochettes)
// ─────────────────────────────────────────────
async function generatePochettes(qrcodes: any[], templateFile: File, onProgress: (p: number) => void): Promise<void> {
  const QRCode = (await import('qrcode')).default;
  const templateUrl = URL.createObjectURL(templateFile);
  const templateImg = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = templateUrl;
  });
  const SIZE = 1000; // canvas carré 1000x1000px
  const QR_SIZE = Math.round(SIZE * 0.22); // 22% de la largeur
  const QR_X = Math.round(SIZE * 0.03); // bas gauche
  const QR_Y = SIZE - QR_SIZE - Math.round(SIZE * 0.06);

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('pochettes') as any;

  for (let i = 0; i < qrcodes.length; i++) {
    const q = qrcodes[i];
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    // Dessiner la pochette template
    ctx.drawImage(templateImg, 0, 0, SIZE, SIZE);
    // Générer QR code
    const qrDataUrl = await QRCode.toDataURL(BASE_URL + '/fan/' + q.qrId, {
      width: QR_SIZE, margin: 1, errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    });
    const qrImg = await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = qrDataUrl;
    });
    // Fond blanc sous le QR
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(QR_X - 4, QR_Y - 4, QR_SIZE + 8, QR_SIZE + 8);
    // Dessiner le QR code
    ctx.drawImage(qrImg, QR_X, QR_Y, QR_SIZE, QR_SIZE);
    // Texte "Scannez et Téléchargez"
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(SIZE * 0.022)}px Arial`;
    const textY = QR_Y + QR_SIZE + Math.round(SIZE * 0.035);
    ctx.fillStyle = '#000000';
    ctx.fillText('Scannez et ', QR_X, textY);
    const scannezWidth = ctx.measureText('Scannez et ').width;
    ctx.fillStyle = '#1a6bff';
    ctx.fillText('Téléchargez', QR_X + scannezWidth, textY);
    // Exporter en PNG
    const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png', 0.95));
    folder.file((q.label || 'pochette').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + q.qrId + '.png', blob);
    onProgress(Math.round(((i + 1) / qrcodes.length) * 100));
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipBlob);
  a.download = 'pochettes_' + qrcodes[0]?.label?.replace(/[^a-zA-Z0-9_-]/g, '_') + '.zip';
  a.click();
  URL.revokeObjectURL(templateUrl);
}

// ─────────────────────────────────────────────
// USER AUTH PAGE — Connexion utilisateur
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// LANDING PAGE — page d'accueil professionnelle
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// SCANNER QR CODE — intégré à l'app, aucune redirection externe.
// Dès qu'un QR de notre plateforme (/fan/... ou /ecoute/...) est détecté,
// navigation interne immédiate vers la bonne page.
// ─────────────────────────────────────────────
function ScannerQR({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [lienExterne, setLienExterne] = useState('');
  const scannerRef = useRef<any>(null);
  const dejaTraiteRef = useRef(false);
  const arretFaitRef = useRef(false);

  // Coupe la caméra une seule fois, quel que soit l'endroit qui le demande
  // (bouton fermer, résultat de scan, ou démontage du composant). Avant, la
  // caméra pouvait être coupée deux fois en même temps (une fois manuellement,
  // une fois via le nettoyage automatique au démontage) — ce chevauchement
  // pouvait geler la page sur Android (écran figé après un scan réussi).
  const couperCamera = async () => {
    if (arretFaitRef.current) return;
    arretFaitRef.current = true;
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); } catch { /* déjà arrêtée, sans importance */ }
      try { await s.clear(); } catch { /* idem */ }
    }
  };

  const arreterEtFermer = async () => {
    await couperCamera();
    onClose();
  };

  const traiterResultat = async (texte: string) => {
    try {
      const url = new URL(texte, window.location.origin);
      const chemin = url.pathname + url.search;
      if (chemin.startsWith('/fan/') || chemin.startsWith('/ecoute/')) {
        // On attend que la caméra soit vraiment coupée AVANT de fermer et de
        // naviguer — sinon la navigation démonte le composant pendant que la
        // caméra est encore en train de s'arrêter, d'où le blocage.
        await couperCamera();
        onClose();
        navigate(chemin);
        return;
      }
      // QR externe (pas à nous) : on affiche, on laisse la personne décider
      setLienExterne(texte);
    } catch {
      // Pas une URL → texte brut
      setLienExterne(texte);
    }
  };

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (annule) return;
        const html5QrCode = new Html5Qrcode('zone-scanner-qr');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (texteDecoded: string) => {
            if (dejaTraiteRef.current) return;
            dejaTraiteRef.current = true;
            traiterResultat(texteDecoded);
          },
          () => { /* image sans QR détecté — bruit normal, on ignore */ }
        );
      } catch (e: any) {
        setMsg("Impossible d'accéder à la caméra. Vérifiez que l'autorisation caméra est activée pour l'application.");
      }
    })();
    return () => {
      annule = true;
      couperCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:99999, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', flexShrink:0 }}>
        <p style={{ color:'#fff', fontWeight:800, fontSize:16, margin:0 }}>Scanner un QR code</p>
        <button onClick={arreterEtFermer}
          style={{ background:'rgba(255,255,255,0.15)', border:'none', width:36, height:36, borderRadius:99, color:'#fff', fontSize:18, cursor:'pointer' }}>✕</button>
      </div>
      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, textAlign:'center', margin:'0 0 12px' }}>Cadrez le QR code dans la zone</p>
      <div id="zone-scanner-qr" style={{ flex:1 }} />
      {msg && <p style={{ color:'#ff647c', textAlign:'center', padding:20, fontSize:13 }}>{msg}</p>}
      {lienExterne && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.card, padding:20, borderRadius:'20px 20px 0 0', border:'1px solid '+C.border, borderBottom:'none' }}>
          <p style={{ color:C.textSoft, fontSize:12, marginBottom:8 }}>Ce QR code ne fait pas partie de Doniel Zik :</p>
          <p style={{ color:C.text, fontSize:14, wordBreak:'break-all', marginBottom:14 }}>{lienExterne}</p>
          <div style={{ display:'flex', gap:10 }}>
            {/^https?:\/\//.test(lienExterne) && (
              <a href={lienExterne} target="_blank" rel="noreferrer"
                style={{ flex:1, textAlign:'center', padding:12, borderRadius:10, background:C.blue, color:'#fff', textDecoration:'none', fontWeight:700, fontSize:13 }}>
                Ouvrir le lien
              </a>
            )}
            <button onClick={() => { setLienExterne(''); dejaTraiteRef.current = false; }}
              style={{ flex:1, padding:12, borderRadius:10, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, cursor:'pointer', fontSize:13 }}>
              Scanner à nouveau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Petite icône scanner réutilisable pour les en-têtes de page
function IconeScannerBouton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Scanner un QR code"
      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:99, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
        <rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/><line x1="15" y1="15" x2="18" y2="15"/><line x1="15" y1="18" x2="15" y2="18"/><line x1="18" y1="18" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function LandingPage() {
  const [showScanner, setShowScanner] = useState(false);
  const [showInstallIOS, setShowInstallIOS] = useState(false);
  useEffect(() => {
    // Enregistrer une visite du site (1 fois par session)
    if (!sessionStorage.getItem('dz_visited')) {
      sessionStorage.setItem('dz_visited', '1');
      addDoc(collection(db, 'visits'), {
        page: 'landing', ts: new Date().toISOString(),
        ua: navigator.userAgent.substring(0, 100),
      }).catch(() => {});
    }
  }, []);
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#060d2a 0%,#091840 40%,#040e28 100%)', color:'#fff', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 8px 32px rgba(30,111,255,0.4)}50%{box-shadow:0 8px 48px rgba(30,111,255,0.7)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .dz-hero-btn{animation:glowPulse 2.5s ease infinite}
        .dz-service-card{animation:fadeInUp .5s ease backwards}
        .dz-service-card:hover{transform:translateY(-4px);transition:transform .2s ease}
      `}</style>

      {/* HERO */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px 40px', textAlign:'center' }}>
        <div style={{ animation:'float 3s ease infinite', marginBottom:24 }}>
          <Logo size="lg" />
        </div>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, letterSpacing:3, fontWeight:600, marginBottom:32, textTransform:'uppercase' }}>La Musique. Un Scan. Un Monde.</p>

        <a href="/ziko" className="dz-hero-btn" style={{ display:'block', width:'100%', maxWidth:360, padding:18, borderRadius:14, background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:17, textDecoration:'none', marginBottom:12, boxShadow:'0 8px 32px rgba(30,111,255,0.4)' }}>
          Accéder à ma Zikothèque
        </a>
        <button onClick={() => setShowScanner(true)}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', maxWidth:360, padding:18, borderRadius:14, border:'2px solid #f5c84c', background:'rgba(245,200,76,0.1)', color:'#f5c84c', fontWeight:800, fontSize:17, cursor:'pointer', marginBottom:12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5c84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/>
          </svg>
          Scanner un QR code
        </button>
        {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}
        <Lien href="/decouvrir" style={{ display:'block', width:'100%', maxWidth:360, padding:15, borderRadius:14, border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.8)', fontWeight:600, fontSize:15, textDecoration:'none', marginBottom:20 }}>
          Découvrir des contenus
        </Lien>

        {/* TÉLÉCHARGER L'APP — détection automatique Android (APK) / iPhone (PWA) */}
        {isAndroid() ? (
          <a href="/doniel-zik.apk" download
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', maxWidth:360, padding:16, borderRadius:14, border:'1px solid rgba(0,212,154,0.4)', background:'rgba(0,212,154,0.08)', color:'#4dff9a', fontWeight:700, fontSize:14, textDecoration:'none', marginBottom:20 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4dff9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
            Télécharger l'app Android (.apk)
          </a>
        ) : isIOS() ? (
          <button onClick={() => setShowInstallIOS(true)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', maxWidth:360, padding:16, borderRadius:14, border:'1px solid rgba(0,212,154,0.4)', background:'rgba(0,212,154,0.08)', color:'#4dff9a', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:20 }}>
            📲 Installer l'app sur iPhone
          </button>
        ) : (
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:12, marginBottom:20, textAlign:'center' }}>
            Ouvre ce lien depuis ton téléphone (Android ou iPhone) pour installer l'app
          </p>
        )}
        {showInstallIOS && (
          <div onClick={() => setShowInstallIOS(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ background:'#12213f', width:'100%', borderRadius:'20px 20px 0 0', padding:24 }}>
              <p style={{ fontWeight:800, fontSize:15, color:'#fff', marginBottom:12 }}>Installer sur iPhone</p>
              <p style={{ color:'rgba(255,255,255,0.7)', fontSize:14, lineHeight:1.8, marginBottom:16 }}>
                1. Appuie sur le bouton <strong>Partager ⬆</strong> (en bas de Safari)<br/>
                2. Fais défiler et appuie <strong>"Sur l'écran d'accueil"</strong><br/>
                3. Appuie <strong>"Ajouter"</strong>
              </p>
              <button onClick={() => setShowInstallIOS(false)}
                style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Compris
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SERVICES */}
      <div style={{ padding:'0 20px 40px', maxWidth:500, margin:'0 auto' }}>
        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:11, letterSpacing:2, textAlign:'center', marginBottom:20, textTransform:'uppercase' }}>Nos services</p>
        {[
          { titre:'Pour les Artistes', desc:'Monétisez votre musique, humour ou cinéma via QR code, liens publics et kiffements. Soyez payé à chaque écoute et téléchargement.', lien:'/artiste', btn:'Espace Artiste' },
          { titre:'Pour les Annonceurs', desc:'Diffusez votre publicité auprès de milliers de mélomanes ivoiriens actifs. À partir de 1 000 FCFA.', lien:'/annonceurs', btn:'Espace Annonceur' },
          { titre:'Production musicale', desc:'Faites produire votre single par Doniel Zik : studio, pochettes QR, clip et promotion télé. Enregistrez-vous et signez votre contrat en ligne.', lien:'/production', btn:'Produire ma musique' },
        ].map((s,i) => (
          <div key={i} className="dz-service-card" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'16px 18px', marginBottom:12, animationDelay:`${i * 0.12}s` }}>
            <p style={{ fontWeight:700, fontSize:14, color:'#dde4f5', marginBottom:6 }}>{s.titre}</p>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, lineHeight:1.6, marginBottom:12 }}>{s.desc}</p>
            <a href={s.lien} style={{ display:'inline-block', padding:'8px 18px', borderRadius:99, background:'rgba(30,111,255,0.2)', border:'1px solid rgba(30,111,255,0.3)', color:'#4da6ff', fontSize:12, fontWeight:700, textDecoration:'none' }}>
              {s.btn}
            </a>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign:'center', padding:'20px 0 40px' }}>
        <Lien href="/admin" style={{ color:'rgba(255,255,255,0.08)', fontSize:10, textDecoration:'none' }}>·</Lien>
      </div>
    </div>
  );
}

function UserAuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'choose' | 'email' | 'phone' | 'register'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onAuthStateChanged(auth, u => { setUser(u); });
  }, []);

  // Si on est arrivé ici avec un "retour" (ex: depuis un téléchargement sur une
  // fan page), on y renvoie automatiquement une fois connecté — sinon la
  // personne se retrouvait bloquée sur la Zikothèque après avoir créé son
  // compte, sans moyen de revenir terminer son téléchargement.
  const retour = new URLSearchParams(location.search).get('retour');
  useEffect(() => {
    if (user && retour) {
      navigate(decodeURIComponent(retour), { replace: true });
    }
  }, [user, retour]);

  // ── Google ──
  const loginGoogle = async () => {
    setLoading(true); setMsg('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) { setMsg(e.code === 'auth/popup-closed-by-user' ? 'Connexion annulée. Veuillez réessayer.' : 'Erreur Google: ' + e.message); }
    setLoading(false);
  };

  // ── Téléphone ──
  const sendSMS = async () => {
    if (!phone) { setMsg('Entrez votre numéro'); return; }
    setLoading(true); setMsg('');
    try {
      const recaptchaContainer = recaptchaRef.current!;
      const verifier = new RecaptchaVerifier(auth, recaptchaContainer, { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmResult(result);
      setStep('verify');
      setMsg('Code SMS envoyé !');
    } catch (e: any) { setMsg('Erreur SMS: ' + e.message); }
    setLoading(false);
  };

  const verifyCode = async () => {
    if (!confirmResult || !code) return;
    setLoading(true); setMsg('');
    try {
      await confirmResult.confirm(code);
    } catch (e: any) { setMsg('Code incorrect'); }
    setLoading(false);
  };

  // ── Email ──
  const loginEmail = async () => {
    setLoading(true); setMsg('');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  const registerEmail = async () => {
    if (!displayName) { setMsg('Entrez votre prénom ou pseudo'); return; }
    setLoading(true); setMsg('');
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName });
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  // ── Dashboard si connecté (sauf si on doit repartir vers une page de retour) ──
  if (user != null) return retour ? null : <ZikothequePage user={user} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4fb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* NAV */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(240,244,251,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #dce6f7', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', gap: 6 }}>
          <Lien href="/artiste" style={{ background: '#eaf1ff', border: '1px solid #c8d8ef', borderRadius: 8, padding: '5px 10px', color: '#1a6bff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>Artiste</Lien>
          <Lien href="/annonceurs" style={{ background: '#eaf1ff', border: '1px solid #c8d8ef', borderRadius: 8, padding: '5px 10px', color: '#1a6bff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>Annonceurs</Lien>
          <Lien href="/commercial" style={{ background: '#eaf1ff', border: '1px solid #c8d8ef', borderRadius: 8, padding: '5px 10px', color: '#1a6bff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>Commercial</Lien>
          <Lien href="/admin" style={{ background: 'transparent', border: 'none', borderRadius: 8, padding: '5px 10px', color: 'transparent', fontSize: 6, fontWeight: 600, textDecoration: 'none', opacity: 0.08, userSelect: 'none' }}>·</Lien>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 380, padding: '52px 16px 0' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}><Logo size="lg" /></div>

        <div style={S.card}>
          {mode === 'choose' && (
            <>
              <h2 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>Ma Zikothèque</h2>
              <p style={{ color: '#8098b8', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>Connectez-vous pour accéder à votre bibliothèque musicale</p>

              {/* Google */}
              <button onClick={loginGoogle} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '14px 20px', borderRadius: 12, border: '1px solid #c8d8ef', background: '#ffffff', color: '#1a2340', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </button>

              {/* Email */}
              <button onClick={() => setMode('email')} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '14px 20px', borderRadius: 12, border: '1px solid #c8d8ef', background: '#ffffff', color: '#1a2340', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
                Continuer avec l'email
              </button>

              <p style={{ color: '#2a3a60', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Votre compte vous permet d'accéder à Ma Zikothèque — votre bibliothèque musicale personnelle
              </p>
            </>
          )}

          {(mode === 'email' || mode === 'register') && (
            <>
              <button onClick={() => { setMode('choose'); setMsg(''); }} style={{ background: 'none', border: 'none', color: '#8098b8', cursor: 'pointer', marginBottom: 12, fontSize: 13 }}>← Retour</button>
              <h2 style={{ fontFamily: 'serif', fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
                {mode === 'register' ? 'Créer un compte' : 'Connexion par email'}
              </h2>
              {mode === 'register' && (
                <>
                  <label style={S.lbl}>Prénom ou pseudo</label>
                  <input style={S.inp} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ex: Jean-Paul" />
                </>
              )}
              <label style={S.lbl}>Email</label>
              <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
              <label style={S.lbl}>Mot de passe</label>
              <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              {msg && <p style={{ color: '#e04060', fontSize: 12, marginBottom: 8 }}>{msg}</p>}
              <button style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10 }}
                onClick={mode === 'register' ? registerEmail : loginEmail} disabled={loading}>
                {loading ? 'Chargement...' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
              </button>
              <button style={{ ...S.btn2, width: '100%', textAlign: 'center' }}
                onClick={() => { setMode(mode === 'email' ? 'register' : 'email'); setMsg(''); }}>
                {mode === 'email' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
              {mode === 'email' && (
                <button style={{ width:'100%', textAlign:'center', padding:'10px', border:'none', background:'transparent', color:'#1a6bff', cursor:'pointer', fontSize:13, textDecoration:'underline', marginTop:4 }}
                  onClick={async () => {
                    if (!email) { setMsg('Entrez votre email d\'abord'); return; }
                    try { const r = await demanderResetPassword(email); if (r.ok) setMsg('Email de réinitialisation envoyé. Vérifiez aussi vos spams.'); else setMsg('Erreur : ' + (r.error||'')); }
                    catch { setMsg('Email introuvable. Vérifiez votre adresse.'); }
                  }}>
                  Mot de passe oublié ?
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
// MA ZIKOTHÈQUE PAGE
// ─────────────────────────────────────────────
function ZikothequePage({ user }: { user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentAlbum, setCurrentAlbum] = useState<any>(null);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string|null>(null);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [ct, setCt] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentFiles = currentAlbum?.files || [];
  const currentTrack = currentFiles[currentTrackIdx];
  const streamCompte = useRef<string>(''); // évite de compter 2x la même piste en boucle

  // Compter une écoute quand une piste démarre (incrémente streams du qrcode de l'album)
  const recordStreamAlbum = async () => {
    if (!currentAlbum) return;
    const cle = `${currentAlbum.qrId || currentAlbum.id}_${currentTrackIdx}`;
    if (streamCompte.current === cle) return; // déjà compté pour cette piste
    streamCompte.current = cle;
    try {
      const qid = currentAlbum.qrId;
      if (!qid) return;
      if (currentAlbum.source === 'public') {
        // Contenu ajouté depuis Découvrir/streaming → compteur du LIEN PUBLIC uniquement
        const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', qid)));
        if (!snap.empty) {
          await updateDoc(doc(db, 'publicLinks', snap.docs[0].id), { streams: (snap.docs[0].data().streams || 0) + 1 });
        }
      } else {
        // Contenu ajouté depuis un scan de QR physique → compteur de DUPLICATION uniquement.
        // Repli sur publicLinkId seulement pour les entrées Zikothèque créées avant
        // cette séparation (anciennes données sans le champ "source").
        let snap = await getDocs(query(collection(db, 'qrcodes'), where('qrId', '==', qid)));
        if (snap.empty && currentAlbum.source === undefined) {
          snap = await getDocs(query(collection(db, 'qrcodes'), where('publicLinkId', '==', qid)));
        }
        if (!snap.empty) {
          const ref0 = snap.docs[0];
          await updateDoc(doc(db, 'qrcodes', ref0.id), { streams: (ref0.data().streams || 0) + 1 });
        }
      }
      await addDoc(collection(db, 'streams'), {
        qrId: qid, artist: currentAlbum.artist || '', label: currentAlbum.label || '',
        track: currentTrack?.name || ('Piste ' + (currentTrackIdx + 1)), valid: true, ts: new Date().toISOString(),
      });
    } catch(e) { console.error('stream album', e); }
  };

  useEffect(() => {
    if (!user) return;

    const syncPending = async () => {
      // Récupérer depuis localStorage (persiste entre pages, contrairement à sessionStorage)
      const pending = localStorage.getItem('pendingZiko');
      if (pending) {
        try {
          const zikoData = JSON.parse(pending);
          // Vérifier si déjà présent pour éviter les doublons
          const existing = await getDocs(query(
            collection(db, 'zikotheque'),
            where('uid', '==', user.uid),
            where('qrId', '==', zikoData.qrId)
          ));
          if (existing.empty) {
            await addDoc(collection(db, 'zikotheque'), { uid: user.uid, ...zikoData });
          }
          localStorage.removeItem('pendingZiko');
        } catch(e) { console.error('sync pending ziko', e); }
      }

      // Démarrer l'écoute en temps réel APRÈS la sync
      const q = query(collection(db, 'zikotheque'), where('uid', '==', user.uid));
      const unsub = onSnapshot(q, snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
      return unsub;
    };

    let unsubFn: (() => void) | undefined;
    syncPending().then(unsub => { unsubFn = unsub; });
    return () => { if (unsubFn) unsubFn(); };
  }, [user]);

  useEffect(() => {
    // Au changement de piste : recharger la nouvelle source puis lancer la lecture.
    // On garde le MÊME élément audio (pas de key) pour que play() reste autorisé sur mobile.
    const a = audioRef.current;
    if (!a || !currentTrack) return;
    a.load();
    if (playing) {
      const lancer = () => { a.play().catch(() => {}); };
      // Tenter dès que possible + filet via l'événement canplay
      lancer();
      a.addEventListener('canplay', lancer, { once: true });
      return () => a.removeEventListener('canplay', lancer);
    }
  }, [currentTrackIdx, currentAlbum]);

  const [showPubZiko, setShowPubZiko] = useState(false);
  const [pendingNextZiko, setPendingNextZiko] = useState(false);
  void showPubZiko; void setShowPubZiko; void pendingNextZiko; void setPendingNextZiko;

  const playAlbum = (item: any, trackIdx = 0) => {
    // Lecture directe sans pub avant
    doPlayAlbum(item, trackIdx);
  };

  const doPlayAlbum = (item: any, trackIdx = 0) => {
    setCurrentAlbum(item);
    setCurrentTrackIdx(trackIdx);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  };

  const onEnded = () => {
    // Enchaîner directement sur la piste suivante (sans pub)
    if (currentTrackIdx < currentFiles.length - 1) {
      setCurrentTrackIdx(i => i + 1);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  const logout = async () => { await signOut(auth); };

  // Contrôles média en arrière-plan (écran verrouillé, barre de notifications) :
  // sans ça, le téléphone ne sait proposer que play/pause, jamais
  // piste suivante/précédente pour un album qui joue en fond.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentAlbum) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (currentTrack?.name || 'Piste ' + (currentTrackIdx + 1)).replace(/\.[^/.]+$/, ''),
        artist: currentAlbum.artist || 'Doniel Zik',
        album: currentAlbum.label || '',
        artwork: currentAlbum.coverUrl ? [
          { src: currentAlbum.coverUrl, sizes: '512x512', type: 'image/png' },
        ] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (currentTrackIdx > 0) { setCurrentTrackIdx(i => i - 1); setPlaying(true); }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (currentTrackIdx < currentFiles.length - 1) { setCurrentTrackIdx(i => i + 1); setPlaying(true); }
      });
    } catch { /* MediaSession pas supportée, on ignore */ }
  }, [currentAlbum, currentTrackIdx, currentFiles.length, currentTrack]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }, [playing]);

  return (
    <div style={{ minHeight: '100vh', background: `${GLOW_TOP}, ${C.bgDeep}`, color: C.text, fontFamily: "'DM Sans', sans-serif", paddingBottom: currentAlbum ? 148 : 58 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .track-row:hover { background: rgba(30,111,255,0.08) !important; }
        .album-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(30,111,255,0.15) !important; }
      `}</style>

      {/* AUDIO ENGINE */}
      {currentTrack && (
        <audio ref={audioRef} src={currentTrack.url}
          onTimeUpdate={() => { if (audioRef.current) { setCt(audioRef.current.currentTime); setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0); } }}
          onLoadedMetadata={() => { if (audioRef.current) setDur(audioRef.current.duration); }}
          onPlay={() => { setPlaying(true); recordStreamAlbum(); }}
          onPause={() => { if (audioRef.current && !audioRef.current.ended) setPlaying(false); }}
          onEnded={onEnded} preload="auto" />
      )}

      {/* HEADER */}
      <div style={{ background: 'rgba(26,31,53,0.96)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size="sm" />
          <div>
            <p style={{ fontWeight: 800, fontSize: 13, color: '#dde4f5' }}>Ma Zikothèque</p>
            <p style={{ color: '#4a5878', fontSize: 10 }}>{items.length} album{items.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <IconeScannerBouton onClick={() => setShowScanner(true)} />
          <Lien href="/decouvrir" style={{ background: 'rgba(30,111,255,0.15)', border: '1px solid rgba(30,111,255,0.3)', borderRadius: 20, padding: '6px 12px', color: '#4da6ff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>Découvrir</Lien>
          {user.email === ADMIN_EMAIL && (
            <Lien href="/admin" style={{ background: 'transparent', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'transparent', fontSize: 6, fontWeight: 700, textDecoration: 'none', opacity: 0.08, userSelect: 'none' }}>·</Lien>
          )}
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#8098b8', cursor: 'pointer', fontSize: 11 }}>Déco</button>
        </div>
      </div>
      {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #1e6fff', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 12px', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', animation: 'fadeUp .4s ease' }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#dde4f5' }}>Votre Zikothèque est vide</h3>
            <p style={{ color: '#4a5878', fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
              Scannez une pochette musicale ou recevez un lien<br />pour ajouter vos premiers albums.
            </p>
            <Lien href="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #1e6fff, #0050d0)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Découvrir de la musique
            </Lien>
          </div>
        ) : (
          <div style={{ animation: 'fadeUp .4s ease' }}>
            {/* NOW PLAYING — si un album est sélectionné */}
            {currentAlbum && (
              <div style={{ background: 'linear-gradient(135deg, rgba(30,111,255,0.2), rgba(77,166,255,0.08))', border: '1px solid rgba(30,111,255,0.25)', borderRadius: 18, padding: '14px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
                {currentAlbum.coverUrl ? (
                  <img src={optimImg(currentAlbum.coverUrl, 120)} alt={currentAlbum.label} style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a6e,#0a1535)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, color: '#4da6ff', fontWeight: 700, marginBottom: 2, letterSpacing: 1.5, textTransform: 'uppercase' }}>En lecture</p>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentAlbum.label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{currentAlbum.artist}</p>
                </div>
                {playing && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ width: 3, background: '#4da6ff', borderRadius: 99, minHeight: 4, height: `${4 + Math.random()*12}px`, transition: 'height .3s' }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LISTE ALBUMS */}
            <p style={{ color: '#4a5878', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>Mes contenus</p>
            {items.map((item, idx) => {
              const audioFiles = (item.files || []).filter((f: any) => estFichierAudio(f));
              const isActive = currentAlbum?.id === item.id;
              return (
                <div key={item.id} className="album-card"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, background: isActive ? 'rgba(30,111,255,0.18)' : 'rgba(255,255,255,0.06)', border: isActive ? '1px solid rgba(30,111,255,0.35)' : '1px solid rgba(255,255,255,0.08)', marginBottom: 10, cursor: 'pointer', transition: 'all .2s', position:'relative', boxShadow: isActive ? '0 4px 20px rgba(30,111,255,0.2)' : '0 2px 8px rgba(0,0,0,0.2)' }}
                  onClick={() => playAlbum(item)}>
                  {item.coverUrl ? (
                    <img src={optimImg(item.coverUrl, 120)} alt={item.label} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: 'linear-gradient(135deg, #0a1535, #1e3a6e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: isActive ? '#4da6ff' : '#dde4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ color: '#4a5878', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist} · {audioFiles.length} titre{audioFiles.length > 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if (isActive) { togglePlay(); } else { playAlbum(item); } }}
                    style={{ width: 40, height: 40, borderRadius: 99, border: 'none', background: isActive ? 'linear-gradient(135deg, #1e6fff, #0050d0)' : 'rgba(30,111,255,0.15)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
                    {isActive && playing ? '⏸' : '▶'}
                  </button>
                  {/* Menu ... */}
                  <div style={{ position:'relative' }}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === item.id ? null : item.id); }}
                      style={{ width:32, height:32, borderRadius:99, border:'none', background:'transparent', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      ···
                    </button>
                    {menuOpenId === item.id && (
                      <div style={{ position:'absolute', right:0, top:36, background:'#1e2540', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'6px 0', zIndex:100, minWidth:180, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => { playAlbum(item); setMenuOpenId(null); }}
                          style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 16px', background:'transparent', border:'none', color:'#dde4f5', cursor:'pointer', fontSize:13, textAlign:'left' }}>
                          ▶ Lire
                        </button>
                        <button onClick={() => {
                          const url = `${BASE_URL}/ecoute/${item.publicLinkId || item.qrId}`;
                          const msg = `${item.label} — Écoutez ce contenu sur Doniel Zik !\n${url}`;
                          if (navigator.share) navigator.share({ title: item.label, text: msg, url });
                          else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                          setMenuOpenId(null);
                        }}
                          style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 16px', background:'transparent', border:'none', color:'#dde4f5', cursor:'pointer', fontSize:13, textAlign:'left' }}>
                          Partager
                        </button>
                        <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'4px 0' }} />
                        <button onClick={async () => {
                          await deleteDoc(doc(db, 'zikotheque', item.id));
                          setMenuOpenId(null);
                        }}
                          style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 16px', background:'transparent', border:'none', color:'#f04a6a', cursor:'pointer', fontSize:13, textAlign:'left' }}>
                          Retirer de ma Zikothèque
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Info Premium */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', marginTop: 16 }}>
              <p style={{ color: '#4a5878', fontSize: 12, lineHeight: 1.7 }}>
                Le téléchargement depuis la Zikothèque sera disponible avec l'abonnement <strong style={{ color: '#4da6ff' }}>Premium</strong> — bientôt disponible.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MINI LECTEUR EN BAS — style Spotify */}
      {currentAlbum && (
        <div style={{ position: 'fixed', bottom: 58, left: 0, right: 0, zIndex: 98, animation: 'slideUp .3s ease' }}>
          {/* PLAYLIST PANEL — slide up */}
          {showPlaylist && (
            <div style={{ background: '#0b0f1e', borderTop: '1px solid rgba(255,255,255,0.08)', maxHeight: '45vh', overflowY: 'auto', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 10px' }}>
                <p style={{ color: '#4da6ff', fontWeight: 700, fontSize: 13 }}>Playlist — {currentAlbum.label}</p>
                <button onClick={() => setShowPlaylist(false)} style={{ background: 'none', border: 'none', color: '#4a5878', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              {currentFiles.map((f: any, i: number) => (
                <div key={i} className="track-row"
                  onClick={() => { setCurrentTrackIdx(i); setPlaying(true); setShowPlaylist(false); if (audioRef.current) audioRef.current.play().catch(()=>{}); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer', background: i === currentTrackIdx ? 'rgba(30,111,255,0.12)' : 'transparent', transition: 'background .15s' }}>
                  <span style={{ color: i === currentTrackIdx ? '#4da6ff' : '#4a5878', fontSize: 13, fontWeight: 700, minWidth: 20 }}>
                    {i === currentTrackIdx && playing ? '▶' : (i + 1)}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: i === currentTrackIdx ? '#dde4f5' : '#8098b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (i + 1)}
                  </span>
                  {i === currentTrackIdx && playing && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                      {[1,2,3].map(j => <div key={j} style={{ width: 3, background: '#4da6ff', borderRadius: 99, height: j * 4 + 2, animation: `bar${j} ${0.4 + j * 0.15}s ease infinite alternate` }} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MINI PLAYER BAR */}
          <div style={{ background: 'rgba(11,15,30,0.98)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px' }}>
            {/* Progress bar */}
            <div onClick={(e) => { if (!audioRef.current) return; const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * audioRef.current.duration; }}
              style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99, marginBottom: 10, cursor: 'pointer' }}>
              <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #1e6fff, #4da6ff)', borderRadius: 99, transition: 'width .1s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Album cover */}
              {currentAlbum.coverUrl ? (
                <img src={optimImg(currentAlbum.coverUrl, 120)} alt={currentAlbum.label} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'linear-gradient(135deg, #0a1535, #1e3a6e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
              )}
              {/* Track info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#dde4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentAlbum?.label || currentTrack?.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (currentTrackIdx + 1)}
                </p>
                <p style={{ color: '#4a5878', fontSize: 11 }}>{currentAlbum.artist}</p>
              </div>
              {/* Time */}
              <span style={{ color: '#4a5878', fontSize: 10, flexShrink: 0 }}>{formatTime(ct)} / {formatTime(dur)}</span>
              {/* Controls */}
              <button onClick={() => { if (currentTrackIdx > 0) { setCurrentTrackIdx(i => i - 1); setPlaying(true); if (audioRef.current) audioRef.current.play().catch(()=>{}); } }}
                style={{ background: 'none', border: 'none', color: currentTrackIdx === 0 ? '#2a3a60' : '#8098b8', fontSize: 18, cursor: 'pointer', padding: 4 }}>⏮</button>
              <button onClick={togglePlay}
                style={{ width: 42, height: 42, borderRadius: 99, border: 'none', background: 'linear-gradient(135deg, #1e6fff, #0050d0)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(30,111,255,0.4)' }}>
                {playing ? '⏸' : '▶'}
              </button>
              <button onClick={() => { if (currentTrackIdx < currentFiles.length - 1) { setCurrentTrackIdx(i => i + 1); setPlaying(true); if (audioRef.current) audioRef.current.play().catch(()=>{}); } }}
                style={{ background: 'none', border: 'none', color: currentTrackIdx === currentFiles.length - 1 ? '#2a3a60' : '#8098b8', fontSize: 18, cursor: 'pointer', padding: 4 }}>⏭</button>
              {/* Playlist toggle */}
              <button onClick={() => setShowPlaylist(!showPlaylist)}
                style={{ background: showPlaylist ? 'rgba(30,111,255,0.2)' : 'none', border: showPlaylist ? '1px solid rgba(30,111,255,0.4)' : '1px solid transparent', borderRadius: 6, padding: '6px 10px', color: showPlaylist ? '#4da6ff' : '#4a5878', cursor: 'pointer', fontSize: 16 }}>
                ☰
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRE NAVIGATION FIXE EN BAS — toujours visible */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(11,15,30,0.98)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-around', padding:'10px 0 14px', zIndex:99 }}>
        {[
          { label:'Accueil', path:'/', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { label:'Découvrir', path:'/decouvrir', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { label:'Challenge', path:'/challenge', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
          { label:'Notifs', path:'/notifications', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { label:'Profil', path:'/profil', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: window.location.pathname === item.path ? '#4da6ff' : '#4a5878' }}>
            <span style={{ position:'relative', display:'inline-flex' }}>
              {item.svg}
              {item.path === '/notifications' && <BadgeNotif />}
            </span>
            <span style={{ fontSize:10, fontWeight:600 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// PAGE CONDITIONS GÉNÉRALES D'UTILISATION
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DASHBOARD COMMERCIAL — /commercial
// Suivi artistes recrutés, marchands, commissions
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DASHBOARD RESPONSABLE COMMERCIAL — /responsable
// Vue équipe commerciaux + commissions 1/10
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// NOTIFICATIONS TAB — pour artiste et mélomane
// ─────────────────────────────────────────────
function AutoPlayMedia({ fileUrl, isVideo, coverUrl, label, publicLinkId }: any) {
  const mediaRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    const media = mediaRef.current;
    if (!el || !media) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          // La vidéo joue seulement si elle est bien visible (au moins 60% à l'écran)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // Couper toutes les autres vidéos/audios de la page avant de jouer celle-ci
            document.querySelectorAll('video, audio').forEach((m: any) => {
              if (m !== media && !m.paused) { try { m.pause(); } catch {} }
            });
            media.muted = muted;
            const p = media.play();
            if (p && p.then) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
          } else {
            // Dès qu'elle sort de la zone centrale, elle se coupe
            try { media.pause(); } catch {}
            setPlaying(false);
          }
        });
      },
      { threshold: [0, 0.6, 1], rootMargin: '-10% 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [muted]);

  // Lecture manuelle au clic sur le média (si autoplay bloqué)
  const handleTap = (e: any) => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      e.preventDefault(); e.stopPropagation();
      media.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: any) => {
    e.preventDefault(); e.stopPropagation();
    if (mediaRef.current) {
      mediaRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', background:'#0a0e1a' }}>
      {isVideo ? (
        <video ref={mediaRef} src={fileUrl} poster={coverUrl} muted={muted} loop playsInline onClick={handleTap}
          style={{ width:'100%', height:280, objectFit:'cover', display:'block' }} />
      ) : (
        <div onClick={handleTap} style={{ position:'relative' }}>
          {coverUrl ? (
            <img src={coverUrl} alt={label} style={{ width:'100%', height:280, objectFit:'cover', objectPosition:'top', display:'block' }} />
          ) : (
            <div style={{ width:'100%', height:280, background:'linear-gradient(135deg,#0a1535,#1e3a6e)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
          )}
          {!playing && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ width:60, height:60, borderRadius:99, background:'rgba(26,107,255,0.85)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"/></svg>
              </div>
            </div>
          )}
          <audio ref={mediaRef} src={fileUrl} loop />
        </div>
      )}

      {/* Indicateur lecture + bouton son */}
      <div style={{ position:'absolute', bottom:10, right:10, display:'flex', gap:8 }}>
        {playing && (
          <button onClick={toggleMute}
            style={{ width:38, height:38, borderRadius:99, border:'none', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
        )}
      </div>

      {/* Badge lecture auto */}
      {playing && (
        <div style={{ position:'absolute', top:10, left:10, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', borderRadius:99, padding:'4px 10px', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:99, background:'#00e676', display:'inline-block' }} />
          <span style={{ color:'#fff', fontSize:10, fontWeight:600 }}>En lecture</span>
        </div>
      )}
    </div>
  );
}

// Compte à rebours pour les réservations (dans les notifications)
function CompteRebours({ dateSortie }: { dateSortie?: string }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!dateSortie) return (
    <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(240,74,106,0.12)', border:'1px solid rgba(240,74,106,0.3)', display:'inline-block' }}>
      <span style={{ color:'#ff8095', fontSize:12, fontWeight:700 }}>Réservé — en attente de la sortie</span>
    </div>
  );
  const cible = new Date(dateSortie).getTime();
  const diff = cible - maintenant;
  if (diff <= 0) return (
    <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(77,255,154,0.12)', border:'1px solid rgba(77,255,154,0.3)', display:'inline-block' }}>
      <span style={{ color:'#4dff9a', fontSize:12, fontWeight:700 }}>C'est le jour J ! Votre téléchargement arrive.</span>
    </div>
  );
  const jours = Math.floor(diff / (1000*60*60*24));
  const heures = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
  const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
  const secondes = Math.floor((diff % (1000*60)) / 1000);
  const Bloc = ({ v, l }: { v:number, l:string }) => (
    <div style={{ textAlign:'center', background:'rgba(240,74,106,0.15)', borderRadius:8, padding:'6px 8px', minWidth:42 }}>
      <p style={{ color:'#ff8095', fontSize:18, fontWeight:800, margin:0, lineHeight:1 }}>{String(v).padStart(2,'0')}</p>
      <p style={{ color:'#8098b8', fontSize:9, margin:'2px 0 0', textTransform:'uppercase' }}>{l}</p>
    </div>
  );
  return (
    <div style={{ marginTop:10 }}>
      <p style={{ color:'#8098b8', fontSize:11, margin:'0 0 4px' }}>Sortie prévue le <strong style={{ color:'#fff' }}>{new Date(dateSortie).toLocaleDateString('fr',{ day:'2-digit', month:'long', year:'numeric' })}</strong></p>
      <p style={{ color:'#ff8095', fontSize:11, fontWeight:700, margin:'0 0 6px' }}>Réservé — disponible dans :</p>
      <div style={{ display:'flex', gap:6 }}>
        <Bloc v={jours} l="jours" />
        <Bloc v={heures} l="h" />
        <Bloc v={minutes} l="min" />
        <Bloc v={secondes} l="sec" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CARTE SORTIE — rubrique "Sortie officielle" avec réservation
// ─────────────────────────────────────────────
function CarteSortie({ s, cible }: { s: any, cible?: boolean }) {
  const navigate = useNavigate();
  const [reserve, setReserve] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [rechargeModalRes, setRechargeModalRes] = useState<{fcfa:number,oscart:number}|null>(null);
  const [msg, setMsg] = useState('');
  const [maintenant, setMaintenant] = useState(Date.now());
  const [ouvert, setOuvert] = useState(!!cible); // plié par défaut ; ouvert si on arrive via lien partagé
  const user = auth.currentUser;
  const estVideo = /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(s.teaserUrl || '');

  // Compte à rebours en direct (se rafraîchit chaque seconde)
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,'reservations'), where('sortieId','==',s.id), where('userId','==',user.uid)))
      .then(snap => { if (!snap.empty) setReserve(true); }).catch(()=>{});
  }, [user, s.id]);

  // Compte à rebours détaillé (jusqu'à la seconde)
  const diffMs = new Date(s.dateSortie).getTime() - maintenant;
  const estSorti = diffMs <= 0;
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const cdJours = Math.floor(totalSec / (3600*24));
  const cdHeures = Math.floor((totalSec % (3600*24)) / 3600);
  const cdMinutes = Math.floor((totalSec % 3600) / 60);
  const cdSecondes = totalSec % 60;
  const joursRestants = Math.ceil(diffMs / (1000*60*60*24));
  const progTelech = s.objTelech > 0 ? Math.min(100, Math.round((s.reservations || 0) / s.objTelech * 100)) : 0;
  const progCadeaux = s.objCadeaux > 0 ? Math.min(100, Math.round((s.cadeauxRecus || 0) / s.objCadeaux * 100)) : 0;
  void joursRestants;

  const reserver = async () => {
    if (!user) { window.location.href = '/ziko'; return; }
    setReserving(true); setMsg('');
    try {
      // Vérifier le solde
      const soldeSnap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      const solde = soldeSnap.empty ? 0 : (soldeSnap.docs[0].data().solde || 0);
      if (solde < s.prixOscart) {
        setMsg(`Solde insuffisant. Il vous faut ${s.prixOscart} Oscart.`);
        setRechargeModalRes({ oscart: s.prixOscart, fcfa: s.prixOscart * 10 });
        setReserving(false); return;
      }
      const kiffsGagnes = s.prixOscart * 250;
      // Débiter + créditer les kiffs (celui qui réserve obtient toujours des kiffs)
      await updateDoc(doc(db,'coins_solde',soldeSnap.docs[0].id), {
        solde: solde - s.prixOscart,
        kiffsDispo: (soldeSnap.docs[0].data().kiffsDispo || 0) + kiffsGagnes,
      });
      logTx(user.uid, 'reservation', -s.prixOscart, kiffsGagnes, 'Réservation de sortie');
      // Créer la réservation
      await addDoc(collection(db,'reservations'), {
        sortieId: s.id, titre: s.titre, artistEmail: s.artistEmail, artistName: s.artistName,
        userId: user.uid, userEmail: user.email, userName: user.displayName || 'Un mélomane',
        prixOscart: s.prixOscart, statut:'reserve', telecharge:false,
        createdAt: new Date().toISOString(),
      });
      // Incrémenter le compteur de réservations
      await updateDoc(doc(db,'sorties',s.id), { reservations: (s.reservations || 0) + 1 });
      // Part artiste 70%
      const partArtiste = Math.round(s.prixOscart * 0.7);
      await addDoc(collection(db,'ventes'), {
        artistEmail: s.artistEmail, type:'reservation', titre: s.titre,
        montantOscart: partArtiste, createdAt: new Date().toISOString(),
      });
      // Notif perso au fan — bouton rouge (en attente du jour J)
      await envoyerNotification({
        to: user.email, type:'reservation', sortieId: s.id, dateSortie: s.dateSortie,
        text: `Réservation confirmée pour "${s.titre}" de ${s.artistName}. Disponible le ${s.dateSortie}.`,
        boutonStatut:'rouge', createdAt: new Date().toISOString(),      });
      // Notif à l'ADMIN (suivi de toutes les réservations)
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'reservation_admin', sortieId: s.id,
        text: `Nouvelle réservation : "${s.titre}" de ${s.artistName} — par ${user.displayName || 'Un mélomane'}. Total : ${(s.reservations || 0) + 1}.`,
        createdAt: new Date().toISOString(),      });
      // Email à l'admin (reçu même app fermée)
      envoyerEmailNotif('bdonaldservices@gmail.com', 'Nouvelle réservation Doniel Zik',
        `Nouvelle réservation pour "${s.titre}" de ${s.artistName}, faite par ${user.displayName || 'Un mélomane'}. Total : ${(s.reservations || 0) + 1} réservation(s).`);
      // Notif à l'ARTISTE (sa sortie a été réservée)
      if (s.artistEmail) {
        await envoyerNotification({
          to: s.artistEmail, type:'reservation_artiste', sortieId: s.id,
          text: `Quelqu'un a réservé votre sortie "${s.titre}" ! Vous avez maintenant ${(s.reservations || 0) + 1} réservation(s).`,
          createdAt: new Date().toISOString(),        });
        // Email à l'artiste
        envoyerEmailNotif(s.artistEmail, 'Votre sortie a été réservée !',
          `Bonne nouvelle ! Quelqu'un vient de réserver votre sortie "${s.titre}". Vous avez maintenant ${(s.reservations || 0) + 1} réservation(s).`);
      }
      // Notif GÉNÉRALE (message 11) : une réservation pousse les autres à réserver aussi
      await envoyerNotification({
        to: 'all', type:'generale',
        text: `${user.displayName || 'Quelqu\'un'} a réservé "${s.titre}" de ${s.artistName}. Réserve-la toi aussi avant la sortie !`,
        createdAt: new Date().toISOString(),      });
      setReserve(true); setShowDetail(false); setMsg('Réservé ! Vous recevrez le contenu le jour de la sortie.');
    } catch(e:any) { setMsg('Erreur : ' + e.message); }
    setReserving(false);
  };

  // Partage de la sortie officielle
  const partagerSortie = async () => {
    const url = `${window.location.origin}/decouvrir?sortie=${s.id}`;
    const texte = `Sortie officielle : "${s.titre}" de ${s.artistName} — disponible le ${new Date(s.dateSortie).toLocaleDateString('fr')}. Pré-télécharge dès maintenant sur Doniel Zik !`;
    try {
      if (navigator.share) { await navigator.share({ title: s.titre, text: texte, url }); }
      else { await navigator.clipboard.writeText(`${texte} ${url}`); setMsg('Lien copié ! Partagez-le.'); }
      // Notif générale (message 12) : un partage pousse les autres à partager aussi
      const u = auth.currentUser;
      await envoyerNotification({
        to: 'all', type:'generale',
        text: `${u?.displayName || 'Quelqu\'un'} a partagé "${s.titre}" de ${s.artistName}. Partage-le toi aussi pour soutenir l'artiste !`,
        createdAt: new Date().toISOString(),      });
    } catch {}
  };

  // ── Paiement direct en devise (sans passer par une recharge Oscart) ──
  const [devise, setDevise] = useState<'fcfa'|'eur'|'usd'>('fcfa');
  const [showDetail, setShowDetail] = useState(false);
  const [payingDirect, setPayingDirect] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const cleReservationPendante = 'dz_reservation_pendante_' + s.id;

  // Reprendre l'écoute d'une réservation en attente au retour d'une redirection de paiement
  useEffect(() => {
    if (reservationId) return;
    try {
      const idSauve = localStorage.getItem(cleReservationPendante);
      if (idSauve) setReservationId(idSauve);
    } catch { /* ignore */ }
  }, []);

  // Écouter en temps réel la confirmation du paiement direct (via webhook GeniusPay)
  useEffect(() => {
    if (!reservationId) return;
    const unsub = onSnapshot(doc(db, 'reservations', reservationId), (d) => {
      if (d.exists() && d.data()?.statut === 'reserve') {
        setReserve(true);
        setPayingDirect(false);
        setShowDetail(false);
        try { localStorage.removeItem(cleReservationPendante); } catch { /* ignore */ }
      }
    });
    return unsub;
  }, [reservationId]);

  const payerDirect = async () => {
    if (!user) { window.location.href = '/ziko'; return; }
    setPayingDirect(true); setMsg('');
    try {
      const resRef = await addDoc(collection(db,'reservations'), {
        sortieId: s.id, titre: s.titre, artistEmail: s.artistEmail, artistName: s.artistName,
        userId: user.uid, userEmail: user.email, userName: user.displayName || 'Un mélomane',
        prixOscart: s.prixOscart, statut:'en_attente', telecharge:false,
        createdAt: new Date().toISOString(),
      });
      setReservationId(resRef.id);
      try { localStorage.setItem(cleReservationPendante, resRef.id); } catch { /* ignore */ }

      const res = await fetch('/api/creer-paiement-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: resRef.id, sortieId: s.id, prix: s.prixMusique, prixOscart: s.prixOscart,
          uid: user.uid, email: user.email, nom: user.displayName,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erreur serveur'); }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e:any) {
      setMsg('Erreur : ' + e.message);
      setPayingDirect(false);
    }
  };


  return (
    <div id={'sortie-' + s.id} style={{ marginBottom:14, background:C.card, border:`1px solid ${cible ? C.blue : C.border}`, boxShadow: cible ? `0 0 0 2px ${C.blue}` : 'none', borderRadius:14, overflow:'hidden' }}>
      {/* Bandeau : badge + compte à rebours compact (cliquable pour déplier) */}
      <div onClick={() => setOuvert(o => !o)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'rgba(10,132,255,0.15)', cursor:'pointer' }}>
        <span style={{ color:C.blueLite, fontWeight:800, fontSize:10, letterSpacing:0.5 }}>SORTIE OFFICIELLE</span>
        <span style={{ color:C.blueLite, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
          {estSorti ? 'Disponible' : `${cdJours}j ${String(cdHeures).padStart(2,'0')}:${String(cdMinutes).padStart(2,'0')}:${String(cdSecondes).padStart(2,'0')}`}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: ouvert ? 'rotate(180deg)' : 'none', transition:'transform .25s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>

      {/* COMPTE À REBOURS visuel — TOUJOURS visible (plié ou déplié) */}
      {!estSorti && (
        <div style={{ display:'flex', gap:6, justifyContent:'center', padding:'12px 12px 4px' }}>
          {[
            { val: cdJours, lbl: cdJours > 1 ? 'JOURS' : 'JOUR' },
            { val: cdHeures, lbl: 'H' },
            { val: cdMinutes, lbl: 'MIN' },
            { val: cdSecondes, lbl: 'SEC' },
          ].map((b,i) => (
            <div key={i} style={{ flex:1, maxWidth:64, background:'rgba(10,132,255,0.12)', border:`1px solid ${C.border}`, borderRadius:10, padding:'7px 2px', textAlign:'center' }}>
              <p style={{ color:C.blueLite, fontWeight:800, fontSize:19, margin:0, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(b.val).padStart(2,'0')}</p>
              <p style={{ color:C.textSoft, fontSize:8, margin:'3px 0 0', letterSpacing:0.5 }}>{b.lbl}</p>
            </div>
          ))}
        </div>
      )}

      {/* Haut : pochette + infos (cliquable pour déplier) */}
      <div onClick={() => setOuvert(o => !o)} style={{ display:'flex', gap:12, padding:'12px 12px', cursor:'pointer' }}>
        {s.pochetteUrl ? (
          <img src={optimImg(s.pochetteUrl, ouvert ? 600 : 200)} alt={s.titre} style={{ width: ouvert ? 130 : 72, height: ouvert ? 130 : 72, objectFit:'cover', borderRadius:10, flexShrink:0, transition:'width .25s, height .25s' }} />
        ) : (
          <div style={{ width: ouvert ? 130 : 72, height: ouvert ? 130 : 72, borderRadius:10, background:C.bgSecond, flexShrink:0, transition:'width .25s, height .25s' }} />
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ color:C.text, fontWeight:800, fontSize:16, margin:'0 0 2px', lineHeight:1.2 }}>{s.titre}</p>
          <p style={{ color:C.blueLite, fontSize:12, fontWeight:600, margin:'0 0 4px' }}>{s.artistName}</p>
          <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>
            Sortie le <strong style={{ color:C.text }}>{new Date(s.dateSortie).toLocaleDateString('fr', { day:'numeric', month:'long' })}</strong>
          </p>
          {!ouvert && <p style={{ color:C.blueLite, fontSize:10, margin:'6px 0 0', opacity:0.8 }}>Appuyez pour voir les détails</p>}
          {ouvert && s.description && <p style={{ color:C.textSoft, fontSize:11, lineHeight:1.4, margin:'4px 0 0' }}>{s.description}</p>}
        </div>
      </div>

      {/* CONTENU DÉPLIÉ : visible seulement quand ouvert */}
      {ouvert && (<>
      {/* Teaser compact */}
      <div style={{ padding:'10px 12px 0' }}>
        {estVideo ? (
          <video src={s.teaserUrl} controls playsInline style={{ width:'100%', maxHeight:150, background:'#000', display:'block', borderRadius:8 }} />
        ) : (
          <audio src={s.teaserUrl} controls style={{ width:'100%', height:34 }} />
        )}
      </div>

      <div style={{ padding:'10px 12px 12px' }}>
        {/* Objectifs compacts */}
        {s.objCadeaux > 0 && (
          <div style={{ marginBottom:7 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.textSoft, marginBottom:3 }}>
              <span>Kiffements</span>
              <span><strong style={{ color:C.text }}>{(s.cadeauxRecus || 0).toLocaleString()}</strong> / {s.objCadeaux.toLocaleString()}</span>
            </div>
            <div style={{ height:6, borderRadius:99, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
              <div style={{ width:`${progCadeaux}%`, height:'100%', background:C.blueLite, borderRadius:99, transition:'width .4s' }} />
            </div>
          </div>
        )}
        {s.objTelech > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.textSoft, marginBottom:3 }}>
              <span>Pré-téléchargements</span>
              <span><strong style={{ color:C.text }}>{(s.reservations || 0).toLocaleString()}</strong> / {s.objTelech.toLocaleString()}</span>
            </div>
            <div style={{ height:6, borderRadius:99, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
              <div style={{ width:`${progTelech}%`, height:'100%', background:C.blue, borderRadius:99, transition:'width .4s' }} />
            </div>
          </div>
        )}

        {msg && <p style={{ color: msg.startsWith('') ? C.success:C.alert, fontSize:11, margin:'0 0 6px' }}>{msg}</p>}

        {/* Modal détail prix (paiement direct ou via solde Oscart) */}
        {showDetail && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9992, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setShowDetail(false)}>
            <div style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:'24px 24px 36px', width:'100%', maxWidth:480, textAlign:'center' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)', margin:'0 auto 18px' }} />
              <p style={{ color:C.text, fontWeight:800, fontSize:17, margin:'0 0 12px' }}>Réserver {s.titre}</p>
              <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:10 }}>
                {(['fcfa','eur','usd'] as const).map(d => (
                  <button key={d} onClick={() => setDevise(d)}
                    style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${devise===d?C.gold:C.border}`, background:devise===d?'rgba(255,215,0,0.15)':'transparent', color:devise===d?C.gold:C.textSoft, fontSize:11, cursor:'pointer' }}>
                    {d === 'fcfa' ? 'F CFA' : d === 'eur' ? '€' : '$'}
                  </button>
                ))}
              </div>
              <p style={{ color:C.gold, fontWeight:800, fontSize:26, margin:'0 0 20px' }}>
                {devise === 'eur' ? `${(s.prixMusique * 0.0015).toFixed(2)} €` : devise === 'usd' ? `${(s.prixMusique * 0.0016).toFixed(2)} $` : `${s.prixMusique.toLocaleString()} F CFA`}
              </p>
              {msg && <p style={{ color: msg.startsWith('Erreur') || msg.startsWith('Solde') ? C.alert : C.success, fontSize:12, margin:'0 0 12px' }}>{msg}</p>}

              {rechargeModalRes && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
                  onClick={() => setRechargeModalRes(null)}>
                  <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
                    <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:16 }}>
                      Recharger {rechargeModalRes.oscart} Oscart
                    </p>
                    <RechargeDeviseSelector fcfa={rechargeModalRes.fcfa} />
                    <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
                      Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
                    </p>
                    <button onClick={async () => {
                      const err = await lancerPaiementGeniusPay(rechargeModalRes.oscart, rechargeModalRes.fcfa);
                      if (err) alert(err);
                    }}
                      style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                      Payer {rechargeModalRes.fcfa.toLocaleString()} F CFA
                    </button>
                    <button onClick={() => setRechargeModalRes(null)}
                      style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Oscart = moyen de paiement mis en avant (plus fiable que le direct) */}
              <button onClick={reserver} disabled={reserving}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor: reserving?'wait':'pointer' }}>
                {reserving ? 'Réservation...' : `Payer avec mon solde (${s.prixOscart} Oscart)`}
              </button>
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 10px' }}>
                <div style={{ flex:1, height:1, background:C.border }} />
                <span style={{ color:C.textSoft, fontSize:11 }}>ou</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>
              {/* Paiement direct en devise — option secondaire, discrète */}
              <button onClick={payerDirect} disabled={payingDirect}
                style={{ width:'100%', padding:11, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontWeight:600, fontSize:13, cursor: payingDirect?'wait':'pointer' }}>
                {payingDirect ? 'Redirection en cours...' : `Payer ${devise === 'eur' ? `${(s.prixMusique*0.0015).toFixed(2)} €` : devise === 'usd' ? `${(s.prixMusique*0.0016).toFixed(2)} $` : `${s.prixMusique.toLocaleString()} F CFA`} directement`}
              </button>
              <button onClick={() => setShowDetail(false)}
                style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer', marginTop:10 }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Bouton réserver + partage côte à côte */}
        <div style={{ display:'flex', gap:8 }}>
          {reserve ? (
            <div style={{ flex:1, padding:11, borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)', textAlign:'center' }}>
              <p style={{ color:C.success, fontWeight:700, fontSize:12, margin:0 }}>Réservé</p>
            </div>
          ) : (
            <button onClick={() => setShowDetail(true)}
              style={{ flex:1, padding:12, borderRadius:10, border:'none', background:`linear-gradient(135deg,${C.blue},#0050d0)`, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
              {`PRÉ-TÉLÉCHARGER / RÉSERVER${s.prixMusique ? ` · ${s.prixMusique.toLocaleString()} F CFA` : ''}`}
            </button>
          )}
          <button onClick={partagerSortie} title="Partager"
            style={{ flexShrink:0, width:46, padding:0, borderRadius:10, border:`1px solid ${C.border}`, background:C.bgSecond, color:C.blueLite, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>

        {/* Bouton ENVOYER UN KIFFEMENT (soutenir l'artiste avant la sortie) */}
        <button onClick={() => { navigate(`/decouvrir?sortie=${s.id}`); }}
          style={{ width:'100%', marginTop:8, padding:12, borderRadius:10, border:`1px solid ${C.gold}`, background:'rgba(245,200,76,0.1)', color:C.gold, fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          ENVOYER UN KIFFEMENT
        </button>
      </div>
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE MES CHALLENGES — /challenge (onglet du bas)
// ─────────────────────────────────────────────
function MesChallengesPage() {
  const [user, setUser] = useState<any>(null);
  const [mesChallenges, setMesChallenges] = useState<any[]>([]);
  const [tousChallenges, setTousChallenges] = useState<any[]>([]);
  const [contenus, setContenus] = useState<any[]>([]);
  const [sortiesTeaser, setSortiesTeaser] = useState<any[]>([]);
  const [qrContenus, setQrContenus] = useState<any[]>([]);
  const [creer, setCreer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ongletCh, setOngletCh] = useState<'tous'|'mes'>('tous');
  const [monSolde, setMonSolde] = useState(0);
  const [partageCh, setPartageCh] = useState<any>(null); // challenge à partager
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (!u) { window.location.href = '/ziko'; return; }
      setUser(u);
      // Mes challenges (temps réel)
      onSnapshot(
        query(collection(db,'challenges'), where('userId','==',u.uid)),
        snap => { setMesChallenges(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a:any,b:any)=>(b.createdAt||'').localeCompare(a.createdAt||''))); setLoading(false); },
        () => setLoading(false)
      );
      // Mon solde Oscart (pour envoyer des kiffements)
      onSnapshot(query(collection(db,'coins_solde'), where('uid','==',u.uid)),
        s => { if (!s.empty) setMonSolde(s.docs[0].data().solde || 0); });
    });
    // Tous les challenges (fil Découvrir)
    const unsubTous = onSnapshot(
      query(collection(db,'challenges'), orderBy('createdAt','desc')),
      snap => { setTousChallenges(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    // Contenus (pour choisir la chanson dans la création)
    const unsub = onSnapshot(
      query(collection(db, 'decouvrir'), orderBy('publishedAt','desc')),
      snap => setContenus(snap.docs.map(d => ({id:d.id,...d.data()})).filter((c:any)=>c.masque!==true))
    );
    // Sorties officielles (même pas encore lancées) — leur teaser public peut
    // aussi servir de chanson pour un challenge, sinon un artiste qui n'a
    // qu'une sortie à venir se retrouve sans aucune chanson disponible.
    const unsubSorties = onSnapshot(
      query(collection(db, 'sorties'), orderBy('createdAt','desc')),
      snap => setSortiesTeaser(snap.docs.map(d => {
        const s: any = d.data();
        return {
          id: 'sortie_' + d.id,
          artist: s.artistName, artistEmail: s.artistEmail,
          label: s.titre, coverUrl: s.pochetteUrl || '',
          files: [{ url: s.teaserUrl, name: s.teaserUrl }],
        };
      }))
    );
    // QR codes (circuit principal de diffusion/téléchargement) — beaucoup de
    // contenus n'ont jamais été explicitement "publiés sur Découvrir", ce qui
    // les rendait invisibles pour les challenges alors qu'ils existent bien.
    const unsubQr = onSnapshot(
      query(collection(db, 'qrcodes'), orderBy('createdAt','desc')),
      snap => setQrContenus(snap.docs.map(d => {
        const q: any = d.data();
        return {
          id: 'qr_' + d.id, publicLinkId: q.publicLinkId,
          artist: q.artist, artistEmail: q.artistEmail,
          label: q.label, coverUrl: q.coverUrl || '',
          files: q.files || [],
        };
      }).filter((q:any) => q.files && q.files.length > 0))
    );
    return () => { unsub(); unsubTous(); unsubSorties(); unsubQr(); };
  }, []);

  // Chansons disponibles pour un challenge = contenus Découvrir + teasers des
  // sorties officielles + tout ce qui existe via QR code (sans doublonner un
  // contenu déjà publié sur Découvrir, reconnu par son publicLinkId).
  const publicLinkIdsDecouvrir = new Set(contenus.map((c:any) => c.publicLinkId).filter(Boolean));
  const contenusChallenge = [
    ...contenus,
    ...sortiesTeaser,
    ...qrContenus.filter((q:any) => !q.publicLinkId || !publicLinkIdsDecouvrir.has(q.publicLinkId)),
  ];

  // Kiffer un challenge (like simple, +1)
  const kifferChallenge = async (ch: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db,'challenges', ch.id), { kiffements: (ch.kiffements || 0) + 1 });
    } catch(e) { console.error(e); }
  };

  // Envoyer un kiffement (cadeau) : répartition Mélomane 40% / Artiste 30% / Structure 30%
  const kiffementChallenge = async (ch: any, coins: number) => {
    if (!user) return;
    if (monSolde < coins) { alert('Solde Oscart insuffisant. Rechargez dans votre profil.'); return; }
    try {
      const montant = coins * 100; // valeur FCFA du kiffement
      // Débiter le donateur
      const soldeSnap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      if (!soldeSnap.empty) {
        await updateDoc(doc(db,'coins_solde', soldeSnap.docs[0].id), { solde: increment(-coins) });
      }
      // Enregistrer le kiffement du challenge avec la répartition (calcul interne)
      await addDoc(collection(db,'challenge_kiffements'), {
        challengeId: ch.id,
        donateurId: user.uid, donateurName: user.displayName || 'Mélomane',
        beneficiaireMelomane: ch.userId, melomaneNom: ch.userName,
        artisteEmail: ch.artisteEmail, artisteNom: ch.artisteNom,
        coins, montant,
        partMelomane: Math.round(montant * 0.40),
        partArtiste: Math.round(montant * 0.30),
        partStructure: Math.round(montant * 0.30),
        createdAt: new Date().toISOString(),
      });
      // Incrémenter le compteur affiché
      await updateDoc(doc(db,'challenges', ch.id), { kiffements: (ch.kiffements || 0) + coins });
      // Notifier le créateur du challenge
      await envoyerNotification({
        to: ch.userEmail || ch.userId, type:'activite',
        text: `${user.displayName || 'Une personne'} vous a envoye un kiffement sur votre challenge !`,
        createdAt: new Date().toISOString(),      });
    } catch(e) { console.error(e); alert('Erreur lors de l\'envoi.'); }
  };

  // Partage
  const partagerChallenge = (ch: any, reseau: string) => {
    const url = window.location.origin + '/challenge';
    const texte = `Regarde ce challenge sur Doniel Zik : ${ch.chansonTitre} par ${ch.artisteNom} !`;
    if (reseau === 'natif' && navigator.share) {
      navigator.share({ title:'Challenge Doniel Zik', text: texte, url }).catch(()=>{});
      return;
    }
    let lien = '';
    if (reseau === 'whatsapp') lien = `https://wa.me/?text=${encodeURIComponent(texte + ' ' + url)}`;
    if (reseau === 'facebook') lien = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (reseau === 'tiktok') lien = 'https://www.tiktok.com/upload';
    if (reseau === 'youtube') lien = 'https://www.youtube.com/upload';
    if (lien) window.open(lien, '_blank');
    // Compter le partage
    updateDoc(doc(db,'challenges', ch.id), { partages: (ch.partages || 0) + 1 }).catch(()=>{});
  };

  const telecharger = (url: string, nom: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = nom || 'mon-challenge.mp4'; a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:90 }}>
      {creer && (
        <ChallengePage artisteEmail="" sigId="" contenus={contenusChallenge} onClose={() => setCreer(false)} />
      )}

      {/* HEADER */}
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, position:'sticky', top:0, zIndex:50 }}>
        <Logo size="sm" />
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <p style={{ color:'#4da6ff', fontWeight:700, fontSize:14, margin:0 }}>Challenge</p>
          <IconeScannerBouton onClick={() => setShowScanner(true)} />
        </div>
      </div>
      {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}

      <div style={{ maxWidth:500, margin:'0 auto', padding:'20px 16px' }}>
        <button onClick={() => setCreer(true)}
          style={{ width:'100%', padding:15, borderRadius:14, border:'none', background:'linear-gradient(135deg,#f04a6a,#d0324e)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Créer un challenge
        </button>

        {/* Onglets internes : Tous les challenges / Mes challenges */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button onClick={() => setOngletCh('tous')}
            style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${ongletCh==='tous'?'#4da6ff':'rgba(255,255,255,0.1)'}`, background: ongletCh==='tous'?'rgba(77,166,255,0.12)':'transparent', color: ongletCh==='tous'?'#4da6ff':C.textSoft, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Tous les challenges
          </button>
          <button onClick={() => setOngletCh('mes')}
            style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${ongletCh==='mes'?'#4da6ff':'rgba(255,255,255,0.1)'}`, background: ongletCh==='mes'?'rgba(77,166,255,0.12)':'transparent', color: ongletCh==='mes'?'#4da6ff':C.textSoft, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Mes challenges
          </button>
        </div>

        {/* ONGLET TOUS — fil des challenges avec interactions */}
        {ongletCh === 'tous' && (
          loading ? (
            <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', padding:30 }}>Chargement...</p>
          ) : tousChallenges.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <p style={{ color:C.textSoft, fontSize:14 }}>Aucun challenge pour l'instant</p>
              <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Soyez le premier à créer votre challenge !</p>
            </div>
          ) : (
            tousChallenges.map(ch => (
              <div key={ch.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px' }}>
                  {ch.userPhoto ? <img src={ch.userPhoto} style={{ width:32, height:32, borderRadius:99, objectFit:'cover' }} alt="" /> : <div style={{ width:32, height:32, borderRadius:99, background:'linear-gradient(135deg,#1a6bff,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#fff', fontWeight:700 }}>{ch.userName?.[0]?.toUpperCase()}</div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:'#eaf2ff', fontSize:13, fontWeight:700, margin:0 }}>{ch.userName}</p>
                    <p style={{ color:C.textSoft, fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.chansonTitre} · {ch.artisteNom}</p>
                  </div>
                </div>
                <video src={ch.videoUrl} controls playsInline style={{ width:'100%', maxHeight:420, background:'#000' }} />
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px' }}>
                  <button onClick={() => kifferChallenge(ch)}
                    style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', color:'#f04a6a', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    ♥ {ch.kiffements || 0}
                  </button>
                  <button onClick={() => { if (window.confirm('Envoyer un kiffement (10 Oscart) sur ce challenge ?')) kiffementChallenge(ch, 10); }}
                    style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(245,200,76,0.12)', border:'1px solid rgba(245,200,76,0.3)', borderRadius:99, padding:'5px 12px', color:C.gold, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    Kiffement
                  </button>
                  <button onClick={() => setPartageCh(ch)}
                    style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, background:'none', border:'none', color:C.textSoft, fontSize:13, cursor:'pointer' }}>
                    ↗ {ch.partages || 0}
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* ONGLET MES CHALLENGES — téléchargeables pour soi */}
        {ongletCh === 'mes' && (
          loading ? (
            <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', padding:30 }}>Chargement...</p>
          ) : mesChallenges.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <p style={{ color:C.textSoft, fontSize:14 }}>Vous n'avez pas encore de challenge</p>
              <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Créez votre premier challenge sur la musique de votre artiste !</p>
            </div>
          ) : (
            mesChallenges.map(ch => (
              <div key={ch.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                <video src={ch.videoUrl} controls playsInline style={{ width:'100%', maxHeight:400, background:'#000' }} />
                <div style={{ padding:'12px 14px' }}>
                  <p style={{ color:'#eaf2ff', fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{ch.chansonTitre} · {ch.artisteNom}</p>
                  <div style={{ display:'flex', gap:14, margin:'8px 0' }}>
                    <span style={{ color:'#f04a6a', fontSize:12, fontWeight:700 }}>♥ {ch.kiffements || 0} kiffements</span>
                    <span style={{ color:C.textSoft, fontSize:12 }}>↗ {ch.partages || 0} partages</span>
                  </div>
                  <button onClick={() => telecharger(ch.videoUrl, `challenge-${ch.chansonTitre||'video'}.mp4`)}
                    style={{ width:'100%', padding:11, borderRadius:10, border:'1px solid rgba(90,176,255,0.4)', background:'rgba(90,176,255,0.1)', color:'#5BB0FF', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    Télécharger ma vidéo
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* MODAL PARTAGE */}
      {partageCh && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10001, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setPartageCh(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'22px 20px 34px', width:'100%', maxWidth:480 }}>
            <p style={{ color:'#fff', fontWeight:800, fontSize:16, margin:'0 0 16px' }}>Partager ce challenge</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <button onClick={() => { partagerChallenge(partageCh,'whatsapp'); setPartageCh(null); }}
                style={{ padding:14, borderRadius:12, border:'1px solid rgba(37,211,102,0.4)', background:'rgba(37,211,102,0.12)', color:'#25D366', fontWeight:700, fontSize:14, cursor:'pointer' }}>WhatsApp</button>
              <button onClick={() => { partagerChallenge(partageCh,'facebook'); setPartageCh(null); }}
                style={{ padding:14, borderRadius:12, border:'1px solid rgba(66,103,178,0.4)', background:'rgba(66,103,178,0.12)', color:'#6a9eff', fontWeight:700, fontSize:14, cursor:'pointer' }}>Facebook</button>
              <button onClick={() => { partagerChallenge(partageCh,'tiktok'); setPartageCh(null); }}
                style={{ padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>TikTok</button>
              <button onClick={() => { partagerChallenge(partageCh,'youtube'); setPartageCh(null); }}
                style={{ padding:14, borderRadius:12, border:'1px solid rgba(255,0,0,0.35)', background:'rgba(255,0,0,0.1)', color:'#ff6b6b', fontWeight:700, fontSize:14, cursor:'pointer' }}>YouTube Shorts</button>
            </div>
            <button onClick={() => { partagerChallenge(partageCh,'natif'); setPartageCh(null); }}
              style={{ width:'100%', marginTop:10, padding:13, borderRadius:12, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>Autre / Copier le lien</button>
            <button onClick={() => setPartageCh(null)}
              style={{ width:'100%', marginTop:8, padding:11, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* NAV BAS */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(11,15,30,0.98)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-around', padding:'10px 0 14px', zIndex:99 }}>
        {[
          { label:'Accueil', path:'/', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { label:'Découvrir', path:'/decouvrir', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { label:'Challenge', path:'/challenge', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
          { label:'Notifs', path:'/notifications', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { label:'Profil', path:'/profil', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: window.location.pathname === item.path ? '#4da6ff' : '#4a5878' }}>
            <span style={{ position:'relative', display:'inline-flex' }}>
              {item.svg}
              {item.path === '/notifications' && <BadgeNotif />}
            </span>
            <span style={{ fontSize:10, fontWeight:600 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE CHALLENGE — façon TikTok (filmer sur la musique de l'artiste)
// ─────────────────────────────────────────────
function ChallengePage({ artisteEmail, sigId, contenus, onClose }: { artisteEmail: string, sigId: string, contenus: any[], onClose: () => void }) {
  // Étapes : 1=choix artiste, 2=choix chanson, 3=filmer, 4=publier
  const [etape, setEtape] = useState(artisteEmail ? 2 : 1);
  const [artiste, setArtiste] = useState(artisteEmail);
  const [recherche, setRecherche] = useState('');
  const [chanson, setChanson] = useState<any>(null);
  const [videoBlob, setVideoBlob] = useState<Blob|null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const videoBlobOriginalRef = useRef<Blob|null>(null); // toujours la version à vitesse normale (1x), pour pouvoir recalculer sans cumuler les vitesses
  const [vitesse, setVitesse] = useState(1);
  const [reEncodage, setReEncodage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState('');
  const [tempsEcoule, setTempsEcoule] = useState(0);        // secondes filmées
  const [musiqueDebut, setMusiqueDebut] = useState(0);      // départ de l'extrait musique (secondes)
  const [musiqueFin, setMusiqueFin] = useState(60);         // fin de l'extrait musique (secondes)
  const [dureeMusique, setDureeMusique] = useState(0);      // durée réelle (0 = pas encore chargée)
  const [chargeMusique, setChargeMusique] = useState(false); // true quand la durée est connue
  const [filtre, setFiltre] = useState('aucun');            // filtre vidéo appliqué
  const [effet, setEffet] = useState('aucun');              // effet de mouvement (zoom animé)
  const [cameraFace, setCameraFace] = useState<'user'|'environment'>('user'); // avant/arrière
  const [sonCoupe, setSonCoupe] = useState(false);          // couper la musique
  const [micCoupe, setMicCoupe] = useState(false);          // couper le micro (voix)
  const [cameraPrete, setCameraPrete] = useState(false);    // la caméra d'aperçu est prête (pour les vignettes de filtres en direct)
  const micCoupeRef = useRef(false);
  useEffect(() => { micCoupeRef.current = micCoupe; if (gainMicRef.current) gainMicRef.current.gain.value = micCoupe ? 0 : 1; }, [micCoupe]);
  const [apercuJoue, setApercuJoue] = useState(false);      // aperçu musique en lecture
  const [faceStatus, setFaceStatus] = useState('');         // message d'attente chargement visage
  const [panneau, setPanneau] = useState<'aucun'|'filtres'|'effets'|'musique'>('aucun');
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const faceRef = useRef<any>(null);
  const faceLoadingRef = useRef(false);
  const imageSegmenterRef = useRef<any>(null);   // détecteur de fond (pour "Fond studio")
  const segLoadingRef = useRef(false);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); // dernier masque personne/fond (petit, mis à jour périodiquement)
  const compteurFondRef = useRef(0);
  const backdropCanvasRef = useRef<HTMLCanvasElement | null>(null); // décor "studio" dessiné une seule fois, réutilisé chaque image
  const personneCanvasRef = useRef<HTMLCanvasElement | null>(null); // toile de travail pour découper la personne du fond
  const bandeRef = useRef<HTMLDivElement|null>(null);      // la bande de sélection musique
  const poigneeRef = useRef<'debut'|'fin'|null>(null);    // poignée en cours de glissement
  const rafRef = useRef<any>(null);
  const figeRef = useRef<HTMLCanvasElement|null>(null);    // image figée du Time Warp
  const scanPrevRef = useRef<number>(0);                    // position précédente de la ligne
  const compteurImageRef = useRef(0);                        // pour n'analyser le visage qu'une image sur deux (allège le processeur)
  const croquisRef = useRef<HTMLCanvasElement|null>(null);  // tampon du croquis
  const t0Ref = useRef<number>(0);
  const filtreRef = useRef('aucun');
  const effetRef = useRef('aucun');
  const audioRef = useRef<any>(null); // lecteur d'aperçu (lit audio ET vidéo)
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const musiqueElRef = useRef<HTMLAudioElement|null>(null);
  const gainMicRef = useRef<any>(null); // gain du micro — permet de couper/rétablir la voix en direct

  const DUREE_MAX = 75; // 1 min 15 s maximum

  // Filtres CSS applicables à la vidéo (style beauté/ambiance moderne)
  const FILTRES: {id:string, nom:string, css:string}[] = [
    { id:'aucun',   nom:'Original',  css:'none' },
    { id:'beaute',  nom:'Beauté',    css:'brightness(1.12) saturate(1.15) contrast(0.96) blur(0.3px)' },
    { id:'eclat',   nom:'Éclat',     css:'brightness(1.15) saturate(1.3) contrast(1.05)' },
    { id:'doux',    nom:'Doux',      css:'brightness(1.08) saturate(0.9) contrast(0.92) blur(0.4px)' },
    { id:'vif',     nom:'Vif',       css:'saturate(1.7) contrast(1.15)' },
    { id:'chaud',   nom:'Chaud',     css:'sepia(0.25) saturate(1.4) hue-rotate(-8deg) brightness(1.05)' },
    { id:'froid',   nom:'Froid',     css:'saturate(1.2) hue-rotate(18deg) brightness(1.05)' },
    { id:'nb',      nom:'N&B',       css:'grayscale(1) contrast(1.1)' },
    { id:'vintage', nom:'Vintage',   css:'sepia(0.45) contrast(1.15) brightness(0.98) saturate(1.3)' },
    { id:'cine',    nom:'Ciné',      css:'contrast(1.3) brightness(0.92) saturate(1.25) hue-rotate(-5deg)' },
  ];
  // (le filtre appliqué au rendu passe par filtreRef + un calcul frais dans la boucle de dessin, voir plus bas)

  // Garde les réglages à jour pour la boucle de dessin (qui tourne hors du cycle React)
  useEffect(() => { filtreRef.current = filtre; }, [filtre]);
  useEffect(() => { effetRef.current = effet; }, [effet]);

  // Filet de sécurité : dès qu'on quitte le panneau musique ou l'étape de sélection,
  // on coupe l'aperçu s'il était resté en lecture (évite d'entendre la chanson
  // deux fois en décalé pendant le filmage ou la relecture finale).
  useEffect(() => {
    if (panneau !== 'musique' && audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      setApercuJoue(false);
    }
  }, [panneau]);
  useEffect(() => {
    if (etape !== 3 && audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      setApercuJoue(false);
    }
  }, [etape]);

  // Charge le détecteur de visage MediaPipe UNIQUEMENT quand un effet visage est choisi
  useEffect(() => {
    const estEffetVisage = effet.startsWith('face_');
    if (!estEffetVisage || faceLandmarkerRef.current || faceLoadingRef.current) return;
    faceLoadingRef.current = true;
    setFaceStatus('Préparation des effets visage...');
    (async () => {
      try {
        // Import ESM depuis le CDN — méthode officielle, plus fiable qu'un script global
        // Import évalué au moment de l'exécution : TypeScript et Vite ne cherchent pas à résoudre l'URL
        const importDistant = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
        const vision: any = await importDistant('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const fl = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        faceLandmarkerRef.current = fl;
        setFaceStatus('');
      } catch (e:any) {
        console.error('MediaPipe:', e);
        setFaceStatus('Chargement des effets visage impossible : ' + (e?.message || 'réseau'));
        faceLoadingRef.current = false;
      }
    })();
  }, [effet]);

  // Charge le détecteur de fond MediaPipe (segmentation personne/arrière-plan)
  // UNIQUEMENT quand l'effet "Fond studio" est choisi — même principe que les
  // effets visage : rien n'est téléchargé tant que l'effet n'est pas utilisé.
  useEffect(() => {
    const estFond = effet.startsWith('fond_');
    if (!estFond || imageSegmenterRef.current || segLoadingRef.current) return;
    segLoadingRef.current = true;
    setFaceStatus('Préparation du fond studio...');
    (async () => {
      try {
        const importDistant = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
        const vision: any = await importDistant('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const seg = await vision.ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        imageSegmenterRef.current = seg;
        setFaceStatus('');
      } catch (e:any) {
        console.error('MediaPipe segmentation:', e);
        setFaceStatus('Chargement du fond studio impossible : ' + (e?.message || 'réseau'));
        segLoadingRef.current = false;
      }
    })();
  }, [effet]);

  // ── MOTEUR D'EFFETS : dessine chaque image de la caméra sur le canvas ──
  // C'est le canvas qui est enregistré, donc les effets sont VRAIMENT dans la vidéo.
  const dessinerBoucle = () => {
    const cv = canvasRef.current;
    const vd = videoRef.current;
    if (!cv || !vd) { rafRef.current = requestAnimationFrame(dessinerBoucle); return; }
    const ctx = cv.getContext('2d');
    if (!ctx || !vd.videoWidth) { rafRef.current = requestAnimationFrame(dessinerBoucle); return; }

    // Format portrait 9:16
    if (cv.width !== 720) { cv.width = 720; cv.height = 1280; }
    const W = cv.width, H = cv.height;
    const t = (performance.now() - t0Ref.current) / 1000; // temps écoulé en secondes
    const eff = effetRef.current;
    const estVisage = eff.startsWith('face_');

    // Détection du visage (si un effet visage est actif et le détecteur prêt) —
    // une image sur deux seulement : la détection IA est coûteuse en calcul, et
    // la position du visage ne change pas assez vite pour justifier de la
    // relancer à chaque image. Sur les images sautées, on garde la dernière
    // position connue (le mouvement reste fluide, juste moins souvent recalculé).
    if (estVisage && faceLandmarkerRef.current) {
      compteurImageRef.current++;
      if (compteurImageRef.current % 2 === 0) {
        try {
          const res = faceLandmarkerRef.current.detectForVideo(vd, performance.now());
          faceRef.current = (res && res.faceLandmarks && res.faceLandmarks[0]) ? res.faceLandmarks[0] : null;
        } catch { /* ignore une image ratée */ }
      }
    }
    const face = estVisage ? faceRef.current : null;

    // Segmentation personne/arrière-plan pour "Fond studio" — même principe :
    // une image sur deux, résultat asynchrone (callback) stocké dans une petite
    // toile réutilisable (le masque n'a pas besoin d'être en pleine résolution).
    const estFond = eff.startsWith('fond_');
    if (estFond && imageSegmenterRef.current) {
      compteurFondRef.current++;
      if (compteurFondRef.current % 2 === 0) {
        try {
          imageSegmenterRef.current.segmentForVideo(vd, performance.now(), (res: any) => {
            const cm = res?.categoryMask;
            if (!cm) return;
            const donnees: Uint8Array = cm.getAsUint8Array ? cm.getAsUint8Array() : cm;
            const mw = cm.width || vd.videoWidth, mh = cm.height || vd.videoHeight;
            if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
            const mc = maskCanvasRef.current;
            mc.width = mw; mc.height = mh;
            const mctx = mc.getContext('2d');
            if (mctx) {
              const img = mctx.createImageData(mw, mh);
              for (let i = 0; i < mw * mh; i++) {
                const personne = donnees[i] === 1 ? 255 : 0;
                img.data[i*4] = 255; img.data[i*4+1] = 255; img.data[i*4+2] = 255;
                img.data[i*4+3] = personne; // alpha = zone "personne" uniquement
              }
              mctx.putImageData(img, 0, 0);
            }
            cm.close?.();
          });
        } catch { /* ignore une image ratée */ }
      }
    }

    // Cadrage de la caméra pour remplir le portrait sans déformer
    const ratioV = vd.videoWidth / vd.videoHeight;
    let sw = vd.videoWidth, sh = vd.videoHeight, sx = 0, sy = 0;
    if (ratioV > W / H) { sw = vd.videoHeight * (W / H); sx = (vd.videoWidth - sw) / 2; }
    else { sh = vd.videoWidth / (W / H); sy = (vd.videoHeight - sh) / 2; }

    // Réglages de l'effet pour cette image
    let zoom = 1, dx = 0, dy = 0, alpha = 1;
    if (eff === 'zoomlent') zoom = 1.08 + Math.sin(t * 0.5) * 0.08;
    if (eff === 'punch')    zoom = 1 + Math.pow(Math.max(0, Math.sin(t * 3.2)), 6) * 0.35;
    if (eff === 'shake')    { zoom = 1.08; dx = Math.sin(t * 28) * 10; dy = Math.cos(t * 33) * 8; }
    if (eff === 'trail')    { zoom = 1.02; alpha = 0.55; }
    if (eff === 'strobe')   zoom = 1.03;
    if (eff === 'vhs')      { zoom = 1.04; dy = Math.sin(t * 1.5) * 3; }

    // Effets visage qui déplacent/zooment le cadrage sur le visage
    if ((eff === 'face_zoom' || eff === 'face_chant') && face) {
      // Centre du visage (moyenne de quelques points)
      let cxF = 0, cyF = 0;
      const pts = [1, 33, 263, 61, 291, 199]; // nez, yeux, bouche, menton
      pts.forEach(idx => { cxF += face[idx].x; cyF += face[idx].y; });
      cxF /= pts.length; cyF /= pts.length;
      // Taille du visage (écart entre les yeux) pour ajuster le zoom
      const ecart = Math.abs(face[263].x - face[33].x);
      const zVisage = eff === 'face_chant' ? 1.9 : 1.5;
      zoom = zVisage;
      // Recentrer sur le visage
      dx = (0.5 - cxF) * W * zoom;
      dy = (0.5 - cyF) * H * zoom;
      void ecart;
    }

    // Traînée : on ne nettoie pas complètement, l'image précédente reste un peu
    if (eff === 'trail') { ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    else { ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H); }

    ctx.globalAlpha = alpha;
    // On relit le filtre CSS à chaque image depuis la ref (toujours à jour),
    // pas depuis la variable calculée au rendu React : cette boucle tourne en
    // continu sur sa propre instance et ne voit jamais les nouveaux rendus,
    // donc un changement de filtre ne passait jamais avant ce correctif.
    const filtreCssActuel = FILTRES.find(f => f.id === filtreRef.current)?.css || 'none';
    ctx.filter = filtreRef.current === 'aucun' ? 'none' : filtreCssActuel;

    const dw = W * zoom, dh = H * zoom;
    const ox = (W - dw) / 2 + dx, oy = (H - dh) / 2 + dy;

    if (eff === 'miroir') {
      // Moitié gauche + son reflet
      ctx.drawImage(vd, sx, sy, sw / 2, sh, 0, 0, W / 2, H);
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
      ctx.drawImage(vd, sx, sy, sw / 2, sh, 0, 0, W / 2, H);
      ctx.restore();
    } else if (eff === 'kaleido') {
      // Quatre quartiers en miroir
      const hw = W / 2, hh = H / 2;
      ctx.drawImage(vd, sx, sy, sw, sh, 0, 0, hw, hh);
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(vd, sx, sy, sw, sh, 0, 0, hw, hh); ctx.restore();
      ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); ctx.drawImage(vd, sx, sy, sw, sh, 0, 0, hw, hh); ctx.restore();
      ctx.save(); ctx.translate(W, H); ctx.scale(-1, -1); ctx.drawImage(vd, sx, sy, sw, sh, 0, 0, hw, hh); ctx.restore();
    } else if (eff === 'glitch') {
      // Décalage des couches rouge et bleue (RGB split)
      const d = 6 + Math.sin(t * 9) * 6;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      ctx.filter = (filtreRef.current === 'aucun' ? '' : filtreCssActuel + ' ') + 'sepia(1) saturate(6) hue-rotate(-50deg)';
      ctx.drawImage(vd, sx, sy, sw, sh, ox - d, oy, dw, dh);
      ctx.filter = (filtreRef.current === 'aucun' ? '' : filtreCssActuel + ' ') + 'sepia(1) saturate(6) hue-rotate(160deg)';
      ctx.drawImage(vd, sx, sy, sw, sh, ox + d, oy, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
    } else if (eff === 'timewarp') {
      // TIME WARP SCAN : une ligne descend ; ce qu'elle a franchi reste figé
      if (!figeRef.current) { figeRef.current = document.createElement('canvas'); figeRef.current.width = W; figeRef.current.height = H; }
      const fg = figeRef.current;
      const fctx = fg.getContext('2d');
      const cycle = 6;                                  // 6 secondes pour un balayage complet
      const ligneY = ((t % cycle) / cycle) * H;
      if (ligneY < scanPrevRef.current) { fctx?.clearRect(0, 0, W, H); } // nouveau passage : on efface
      // 1) image en direct
      ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
      // 2) on fige la bande que la ligne vient de franchir
      if (fctx && ligneY > scanPrevRef.current) {
        const hBande = Math.max(1, ligneY - scanPrevRef.current);
        fctx.drawImage(cv, 0, scanPrevRef.current, W, hBande, 0, scanPrevRef.current, W, hBande);
      }
      scanPrevRef.current = ligneY;
      // 3) on recouvre le haut avec l'image figée
      if (ligneY > 0) ctx.drawImage(fg, 0, 0, W, ligneY, 0, 0, W, ligneY);
      // 4) la ligne bleue lumineuse
      ctx.save();
      ctx.shadowColor = '#4da6ff'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#9fd4ff'; ctx.fillRect(0, ligneY - 2, W, 4);
      ctx.restore();
    } else if (eff === 'sketch') {
      // DEMI-CROQUIS : moitié gauche normale, moitié droite en dessin au crayon
      if (!croquisRef.current) { croquisRef.current = document.createElement('canvas'); croquisRef.current.width = W; croquisRef.current.height = H; }
      const cr = croquisRef.current;
      const cctx = cr.getContext('2d');
      if (cctx) {
        cctx.globalCompositeOperation = 'source-over';
        cctx.filter = 'grayscale(1) contrast(1.1)';
        cctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
        // Copie inversée et floutée en color-dodge = rendu crayon
        cctx.globalCompositeOperation = 'color-dodge';
        cctx.filter = 'grayscale(1) invert(1) blur(6px)';
        cctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
        cctx.globalCompositeOperation = 'source-over';
        cctx.filter = 'none';
      }
      ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);          // gauche : normal
      ctx.drawImage(cr, W / 2, 0, W / 2, H, W / 2, 0, W / 2, H);  // droite : croquis
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(W / 2 - 1, 0, 2, H);                            // trait de séparation
    } else if (eff === 'clone') {
      // CLONE : plusieurs copies décalées, la principale bien nette
      const ecart = W * 0.16;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(vd, sx, sy, sw, sh, ox - ecart, oy, dw, dh);
      ctx.drawImage(vd, sx, sy, sw, sh, ox + ecart, oy, dw, dh);
      ctx.globalAlpha = 1;
      ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
    } else if (eff === 'fond_studio') {
      // FOND STUDIO : décor dessiné une seule fois (mis en cache), puis on
      // découpe la personne (grâce au masque IA) et on la pose par-dessus.
      if (!backdropCanvasRef.current) {
        const bc = document.createElement('canvas'); bc.width = W; bc.height = H;
        const bctx = bc.getContext('2d');
        if (bctx) {
          const grad = bctx.createLinearGradient(0, 0, W, H);
          grad.addColorStop(0, '#1a1033'); grad.addColorStop(0.55, '#2a1450'); grad.addColorStop(1, '#0d0620');
          bctx.fillStyle = grad; bctx.fillRect(0, 0, W, H);
          // quelques halos de lumière de scène
          [[W*0.25,H*0.2,'#ff9adb'], [W*0.8,H*0.15,'#5bb0ff'], [W*0.5,H*0.85,'#ffd76a']].forEach(([cx,cy,couleur]:any) => {
            const g = bctx.createRadialGradient(cx, cy, 0, cx, cy, W*0.45);
            g.addColorStop(0, couleur + '55'); g.addColorStop(1, couleur + '00');
            bctx.fillStyle = g; bctx.fillRect(0, 0, W, H);
          });
        }
        backdropCanvasRef.current = bc;
      }
      ctx.drawImage(backdropCanvasRef.current, 0, 0, W, H);
      if (maskCanvasRef.current) {
        if (!personneCanvasRef.current) { personneCanvasRef.current = document.createElement('canvas'); personneCanvasRef.current.width = W; personneCanvasRef.current.height = H; }
        const pc = personneCanvasRef.current;
        const pctx = pc.getContext('2d');
        if (pctx) {
          pctx.clearRect(0, 0, W, H);
          pctx.filter = ctx.filter; // même filtre couleur que le reste
          pctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
          pctx.filter = 'none';
          pctx.globalCompositeOperation = 'destination-in';
          pctx.drawImage(maskCanvasRef.current, 0, 0, W, H);
          pctx.globalCompositeOperation = 'source-over';
          ctx.filter = 'none';
          ctx.drawImage(pc, 0, 0, W, H);
        }
      } else {
        // masque pas encore prêt (premières images) : afficher la caméra normalement en attendant
        ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
      }
    } else {
      ctx.drawImage(vd, sx, sy, sw, sh, ox, oy, dw, dh);
    }

    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    // Habillage par-dessus
    if (eff === 'vhs') {
      ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);   // lignes de balayage
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#2ad';
      ctx.fillRect(0, (t * 260) % H, W, 40);                      // bande qui défile
      ctx.globalAlpha = 1;
    }
    if (eff === 'strobe' && Math.sin(t * 12) > 0.75) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }

    // ── Habillage VISAGE (couronne, lunettes, flou fond, beauté) ──
    if (estVisage && face) {
      // Repères en pixels
      const px = (i:number) => face[i].x * W;
      const py = (i:number) => face[i].y * H;
      const yeuxG = { x:px(33), y:py(33) }, yeuxD = { x:px(263), y:py(263) };
      const largeurVisage = Math.abs(yeuxD.x - yeuxG.x) * 2.6;
      const centreX = (yeuxG.x + yeuxD.x) / 2;
      const hautTete = py(10); // sommet du front

      if (eff === 'face_crown') {
        // Couronne dorée dessinée au-dessus de la tête
        const cw = largeurVisage, ch = cw * 0.5;
        const cx = centreX - cw / 2, cy = hautTete - ch * 1.05;
        ctx.fillStyle = '#F5C84C';
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy + ch);
        ctx.lineTo(cx, cy + ch * 0.35);
        ctx.lineTo(cx + cw * 0.2, cy + ch * 0.7);
        ctx.lineTo(cx + cw * 0.35, cy);
        ctx.lineTo(cx + cw * 0.5, cy + ch * 0.7);
        ctx.lineTo(cx + cw * 0.65, cy);
        ctx.lineTo(cx + cw * 0.8, cy + ch * 0.7);
        ctx.lineTo(cx + cw, cy + ch * 0.35);
        ctx.lineTo(cx + cw, cy + ch);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Joyaux
        ctx.fillStyle = '#e0402e';
        [0.2, 0.5, 0.8].forEach(f => { ctx.beginPath(); ctx.arc(cx + cw * f, cy + ch * 0.72, cw * 0.03, 0, 7); ctx.fill(); });
      }

      if (eff === 'face_glasses') {
        // Lunettes de soleil sur les yeux
        const r = largeurVisage * 0.16;
        ctx.fillStyle = 'rgba(10,10,20,0.85)';
        ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(yeuxG.x, yeuxG.y, r, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(yeuxD.x, yeuxD.y, r, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(yeuxG.x + r, yeuxG.y); ctx.lineTo(yeuxD.x - r, yeuxD.y); ctx.stroke();
        // Reflet
        ctx.fillStyle = 'rgba(120,180,255,0.35)';
        ctx.beginPath(); ctx.arc(yeuxG.x - r*0.3, yeuxG.y - r*0.3, r*0.35, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(yeuxD.x - r*0.3, yeuxD.y - r*0.3, r*0.35, 0, 7); ctx.fill();
      }

      if (eff === 'face_beauty') {
        // Voile doux sur le visage (peau lissée) — zone autour du visage
        const r = largeurVisage * 0.62;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(centreX, py(1), r*0.8, r, 0, 0, 7); ctx.clip();
        ctx.globalAlpha = 0.35; ctx.filter = 'blur(6px) brightness(1.08) saturate(1.05)';
        ctx.drawImage(cv, 0, 0, W, H);
        ctx.restore();
        ctx.filter = 'none'; ctx.globalAlpha = 1;
      }
    }

    // Flou fond : visage net, reste flou (dessine un cercle net par-dessus une base floue)
    if (eff === 'face_blur') {
      if (face) {
        const px = (i:number) => face[i].x * W, py = (i:number) => face[i].y * H;
        const centreX = (px(33) + px(263)) / 2;
        const r = Math.abs(px(263) - px(33)) * 2.4;
        // On a déjà l'image nette dessinée ; on refloute tout SAUF un disque autour du visage
        ctx.save();
        ctx.filter = 'blur(9px)';
        // redessiner l'image floue partout
        ctx.drawImage(cv, 0, 0, W, H);
        ctx.filter = 'none';
        // re-découper le visage net
        ctx.beginPath(); ctx.ellipse(centreX, py(1), r*0.8, r, 0, 0, 7); ctx.clip();
        ctx.drawImage(vd, sx, sy, sw, sh, 0, 0, W, H);
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(dessinerBoucle);
  };

  const lancerRendu = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    t0Ref.current = performance.now();
    scanPrevRef.current = 0;
    if (figeRef.current) figeRef.current.getContext('2d')?.clearRect(0, 0, figeRef.current.width, figeRef.current.height);
    rafRef.current = requestAnimationFrame(dessinerBoucle);
  };
  const stopperRendu = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  // Effets CRÉATIFS — dessinés image par image sur le canvas, donc réellement gravés dans la vidéo
  const EFFETS: {id:string, nom:string}[] = [
    { id:'aucun',    nom:'Original' },
    { id:'zoomlent', nom:'Zoom lent' },
    { id:'punch',    nom:'Zoom punch' },
    { id:'shake',    nom:'Shake' },
    { id:'glitch',   nom:'Glitch RGB' },
    { id:'vhs',      nom:'VHS' },
    { id:'strobe',   nom:'Strobe' },
    { id:'trail',    nom:'Traînée' },
    { id:'miroir',   nom:'Miroir' },
    { id:'kaleido',  nom:'Kaléido' },
    { id:'timewarp', nom:'Time Warp' },
    { id:'sketch',   nom:'Demi-croquis' },
    { id:'clone',    nom:'Clone' },
    { id:'face_zoom',   nom:'Zoom visage' },
    { id:'face_chant',  nom:'Zoom chant' },
    { id:'face_crown',  nom:'Couronne' },
    { id:'face_glasses',nom:'Lunettes' },
    { id:'face_blur',   nom:'Flou fond' },
    { id:'face_beauty', nom:'Beauté pro' },
    { id:'fond_studio',  nom:'Fond studio' },
  ];

  // Liste des artistes distincts (à partir des contenus officiels)
  const artistes = Array.from(new Set(contenus.map((c:any) => c.artistEmail || c.artist).filter(Boolean)))
    .map((email:any) => {
      const c = contenus.find((x:any) => (x.artistEmail || x.artist) === email);
      return { email, nom: c?.artist || c?.artistName || String(email).split('@')[0] };
    })
    .filter(a => !recherche || a.nom.toLowerCase().includes(recherche.toLowerCase()));

  // Même logique que Découvrir : le fichier réel est dans files[0].url, sinon fileUrl.
  // On lit la BANDE SON du fichier, qu'il soit audio ou vidéo.
  const urlMedia = (c:any) => (c?.files?.[0]?.url) || (c?.files?.[0]?.name) || c?.fileUrl || c?.fichierUrl || c?.audioUrl || '';

  // Chansons de l'artiste sélectionné — seuls les contenus qui ont un vrai fichier lisible
  const chansonsArtiste = contenus.filter((c:any) => (c.artistEmail || c.artist) === artiste && !!urlMedia(c));

  // Fichier de la chanson choisie
  const urlChanson = urlMedia(chanson);

  const DUREE_MAX_MUSIQUE = 90; // 1 min 30 maximum

  // Quand on arrive à l'étape musique, CHARGER la durée réelle (avec progression)
  useEffect(() => {
    if (etape === 3 && urlChanson) {
      setChargeMusique(false);
      setDureeMusique(0);
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => {
        if (a.duration && isFinite(a.duration) && a.duration > 0) {
          const d = Math.floor(a.duration);
          setDureeMusique(d);
          setChargeMusique(true);
          // Sélection par défaut : les 30 premières secondes (ou toute la musique si courte)
          setMusiqueDebut(0);
          setMusiqueFin(Math.min(d, 30));
        }
      };
      a.onerror = () => { setDureeMusique(180); setChargeMusique(true); setMusiqueFin(30); };
      // Sécurité : si la métadonnée met trop longtemps, on débloque avec une durée par défaut
      setTimeout(() => { setChargeMusique(prev => { if (!prev) { setDureeMusique(180); setMusiqueFin(30); return true; } return prev; }); }, 12000);
      a.src = urlChanson;
    }
  }, [etape, urlChanson]);

  // Allumer la caméra en APERÇU dès qu'on arrive à l'étape filmer (on se voit avant de filmer)
  useEffect(() => {
    if (etape !== 3) return;
    let stream: MediaStream | null = null;
    let annule = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFace },
          audio: false, // pas de micro en aperçu (évite le mode appel avant de filmer)
        });
        if (annule) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(()=>{}); }
        setCameraPrete(true); // signale aux vignettes de filtres qu'elles peuvent afficher un aperçu en direct
        lancerRendu();
      } catch {}
    })();
    return () => {
      annule = true;
      setCameraPrete(false);
      // Ne pas couper si on est en train d'enregistrer
      if (!recording && stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [etape, cameraFace]); // se relance si on change de caméra

  // Démarrer la caméra + MIXER la musique dans l'enregistrement + minuteur + arrêt auto à 75s
  const demarrerFilm = async () => {
    setMsg('');
    // Couper l'aperçu de la musique (bouton "Écouter") s'il était resté en lecture —
    // sinon il continue de jouer en parallèle de la musique mixée dans l'enregistrement,
    // ce qui donne l'impression d'entendre la même chanson deux fois, en décalé.
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    setApercuJoue(false);
    try {
      // Récupérer un flux caméra + micro (nouveau, avec audio pour l'enregistrement)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFace },
        // Annulation d'écho ACTIVÉE : sans elle, le micro capte la musique qui
        // sort du haut-parleur du téléphone et la réenregistre en plus du
        // mixage propre → on entend la même chanson deux fois, en décalé.
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
      });
      // Couper l'ancien flux d'aperçu s'il existe
      if (streamRef.current && streamRef.current !== stream) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      lancerRendu();
      await new Promise(r => setTimeout(r, 120)); // laisse le canvas se remplir avant la capture

      // ── MIXAGE AUDIO : mélanger le micro + la musique dans une seule piste enregistrée ──
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      // 1) Le micro (son ambiant de la personne) — passe par un gain pour pouvoir
      // le couper/rétablir en direct via le bouton Micro, sans redémarrer le flux.
      try {
        const micSource = ctx.createMediaStreamSource(stream);
        const gainMic = ctx.createGain();
        gainMic.gain.value = micCoupeRef.current ? 0 : 1;
        gainMicRef.current = gainMic;
        micSource.connect(gainMic);
        gainMic.connect(dest);
      } catch {}

      // 2) La musique de l'artiste (si le son n'est pas coupé)
      if (urlChanson && !sonCoupe) {
        // Élément vidéo caché : lit la bande son aussi bien d'un fichier audio que d'une vidéo
        const musEl = document.createElement('video') as any;
        musEl.crossOrigin = 'anonymous';
        musEl.preload = 'auto';
        musEl.volume = 1;
        musEl.playsInline = true;
        musEl.style.display = 'none';
        // On lit le fichier COMPLET (déjà mis en cache par Cloudinary) et on se
        // positionne directement au bon endroit, plutôt que de demander à
        // Cloudinary de générer un extrait à la volée à chaque lecture — cette
        // découpe à la demande est ce qui provoquait les saccades pendant la
        // lecture, surtout avec une connexion lente.
        musEl.src = urlChanson;
        musiqueElRef.current = musEl;
        musEl.onloadeddata = () => { try { musEl.currentTime = musiqueDebut; } catch {} };
        try {
          // Attendre que l'audio soit prêt à jouer (évite le son muet)
          await new Promise<void>((resolve) => {
            let fini = false;
            const ok = () => { if (!fini) { fini = true; resolve(); } };
            musEl.oncanplaythrough = ok;
            musEl.oncanplay = ok;
            musEl.onloadeddata = () => { try { musEl.currentTime = musiqueDebut; } catch {} ok(); };
            musEl.onerror = ok;
            setTimeout(ok, 3000); // sécurité : on n'attend jamais plus de 3s
          });
          try { musEl.currentTime = musiqueDebut; } catch {}
          // Mixage Web Audio (pour enregistrer la musique dans la vidéo)
          const musSource = ctx.createMediaElementSource(musEl);
          // Deux branches séparées : le volume envoyé à l'ENREGISTREMENT reste
          // à fond, mais celui envoyé au HAUT-PARLEUR (juste pour s'entendre en
          // filmant) est baissé — ça réduit fortement ce que le micro peut
          // recapter par écho, en plus de l'annulation d'écho déjà activée.
          const gainRec = ctx.createGain();
          gainRec.gain.value = 1;
          const gainMonitor = ctx.createGain();
          gainMonitor.gain.value = 0.35;
          musSource.connect(gainRec);
          musSource.connect(gainMonitor);
          gainRec.connect(dest);              // vers l'enregistrement (plein volume)
          gainMonitor.connect(ctx.destination); // vers les haut-parleurs (volume réduit, pour s'entendre)
          await ctx.resume().catch(()=>{});
          await musEl.play().catch(()=>{});
        } catch (err) {
          // Si le mixage Web Audio échoue (CORS), au moins jouer le son en direct
          musEl.play().catch(()=>{});
        }
      }

      // Flux final = vidéo (caméra) + audio mixé (micro + musique)
      // On enregistre le CANVAS (avec les effets) + l'audio mixé
      const canvasStream = (canvasRef.current as any).captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      const mixedStream = new MediaStream([videoTrack, ...dest.stream.getAudioTracks()]);

      chunksRef.current = [];
      const mr = new MediaRecorder(mixedStream);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type:'video/webm' });
        setVideoBlob(blob);
        videoBlobOriginalRef.current = blob; // référence 1x, jamais écrasée par un changement de vitesse
        setVitesse(1);
        setVideoUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (musiqueElRef.current) musiqueElRef.current.pause();
        if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
        gainMicRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        stopperRendu();
        setEtape(4);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setTempsEcoule(0);
      timerRef.current = setInterval(() => {
        setTempsEcoule(t => {
          const nv = t + 1;
          if (nv >= DUREE_MAX) { arreterFilm(); }
          return nv;
        });
      }, 1000);
    } catch (e:any) {
      setMsg('Impossible d\'accéder à la caméra. Autorisez l\'accès dans votre navigateur.');
    }
  };

  const arreterFilm = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // Change la vitesse de lecture de la vidéo déjà filmée (ralenti/accéléré),
  // en repartant TOUJOURS de la version à vitesse normale (1x) pour ne pas
  // cumuler les changements. On "refilme" la lecture de la vidéo d'origine à
  // la nouvelle vitesse via canvas + MediaRecorder — aucune bibliothèque
  // externe nécessaire, ça marche dans n'importe quel navigateur.
  const changerVitesse = async (v: number) => {
    const original = videoBlobOriginalRef.current;
    if (!original || reEncodage) return;
    if (v === vitesse) return;
    setReEncodage(true); setMsg('');
    try {
      const vd = document.createElement('video');
      vd.src = URL.createObjectURL(original);
      vd.muted = false;
      vd.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        vd.onloadedmetadata = () => resolve();
        vd.onerror = () => reject(new Error('Lecture de la vidéo impossible'));
        setTimeout(() => reject(new Error('Délai dépassé')), 8000);
      });

      const cv = document.createElement('canvas');
      cv.width = vd.videoWidth || 720; cv.height = vd.videoHeight || 1280;
      const cctx = cv.getContext('2d');
      if (!cctx) throw new Error('Canvas indisponible');

      const ctxAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctxAudio.createMediaElementSource(vd);
      const dest = ctxAudio.createMediaStreamDestination();
      source.connect(dest);
      const gainSilencieux = ctxAudio.createGain(); gainSilencieux.gain.value = 0;
      source.connect(gainSilencieux); gainSilencieux.connect(ctxAudio.destination); // garde le flux actif sans jouer de son à l'écran

      const flux = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const mr = new MediaRecorder(flux, { mimeType: 'video/webm;codecs=vp9,opus' });
      const morceaux: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) morceaux.push(e.data); };

      const fini = new Promise<Blob>((resolve) => {
        mr.onstop = () => resolve(new Blob(morceaux, { type:'video/webm' }));
      });

      vd.playbackRate = v;
      let dessineActif = true;
      const dessiner = () => {
        if (!dessineActif) return;
        cctx.drawImage(vd, 0, 0, cv.width, cv.height);
        requestAnimationFrame(dessiner);
      };
      vd.onended = () => { dessineActif = false; if (mr.state !== 'inactive') mr.stop(); ctxAudio.close().catch(()=>{}); };

      mr.start();
      await vd.play();
      dessiner();

      const nouveauBlob = await fini;
      setVideoBlob(nouveauBlob);
      setVideoUrl(URL.createObjectURL(nouveauBlob));
      setVitesse(v);
    } catch (e:any) {
      setMsg('Changement de vitesse impossible : ' + (e?.message || 'erreur'));
    } finally {
      setReEncodage(false);
    }
  };

  // Publier le challenge
  const publier = async () => {
    if (!videoBlob) return;
    setPublishing(true); setMsg('');
    try {
      const user = auth.currentUser;
      // Upload vidéo sur Cloudinary
      const fd = new FormData();
      fd.append('file', videoBlob); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method:'POST', body: fd });
      const data = await res.json();
      if (!data.secure_url) { setMsg('Erreur upload vidéo.'); setPublishing(false); return; }

      const artisteNom = artistes.find(a => a.email === artiste)?.nom || String(artiste).split('@')[0];
      // Enregistrer le challenge (tag automatique de l'artiste)
      await addDoc(collection(db,'challenges'), {
        userId: user?.uid, userName: user?.displayName || 'Mélomane', userEmail: user?.email || '',
        userPhoto: user?.photoURL || '',
        artisteEmail: artiste, artisteNom,
        chansonTitre: chanson?.label || chanson?.titre || '',
        chansonId: chanson?.id || '',
        musiqueDebut,
        musiqueFin,
        filtre,
        effet,
        videoUrl: data.secure_url,
        sigId: sigId || '',
        kiffements: 0, partages: 0,
        createdAt: new Date().toISOString(),
      });
      // Si le challenge vient d'une signature → marquer réalisé + notifier l'artiste
      if (sigId) {
        try {
          await updateDoc(doc(db,'signatures', sigId), { statutChallenge: 'realise' });
        } catch {}
      }
      // Notifier l'artiste (tag auto)
      await envoyerNotification({
        to: artiste, role:'artiste', type:'challenge_realise',
        text: `${user?.displayName || 'Un mélomane'} a réalisé un challenge sur votre chanson "${chanson?.label || chanson?.titre || ''}" !`,
        createdAt: new Date().toISOString(),      });
      setMsg('Challenge publié ! Votre artiste a été notifié.');
      setTimeout(() => onClose(), 1800);
    } catch (e:any) {
      setMsg('Erreur : ' + (e?.message || ''));
    }
    setPublishing(false);
  };

  // Partage externe
  const partager = async (reseau: string) => {
    const url = window.location.origin + '/decouvrir';
    const texte = `Regarde mon challenge sur Doniel Zik !`;
    if (navigator.share) {
      try { await navigator.share({ title:'Mon challenge', text: texte, url }); return; } catch {}
    }
    let lien = '';
    if (reseau === 'facebook') lien = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (reseau === 'youtube') lien = 'https://www.youtube.com/upload';
    if (reseau === 'tiktok') lien = 'https://www.tiktok.com/upload';
    if (lien) window.open(lien, '_blank');
  };

  return (
    <div style={{ position:'fixed', inset:0, background:C.bgDeep, zIndex:10000, overflowY:'auto', fontFamily:"'DM Sans',sans-serif", color:C.text }}>
      <style>{`
        @keyframes chZoomLent { 0%,100% { transform:scale(1); } 50% { transform:scale(1.18); } }
        @keyframes chLoad { 0% { margin-left:-40%; } 100% { margin-left:100%; } }
        @keyframes chPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.06); } }
        @keyframes chBalance { 0%,100% { transform:scale(1.1) translateX(-4%); } 50% { transform:scale(1.1) translateX(4%); } }
        @keyframes chZoomIn { 0% { transform:scale(1); } 100% { transform:scale(1.35); } }
        @keyframes chVibe { 0%,100% { transform:scale(1.05); } 25% { transform:scale(1.05) translate(-2%,1%); } 75% { transform:scale(1.05) translate(2%,-1%); } }
      `}</style>
      {/* En-tête */}
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:5 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.text, fontSize:22, cursor:'pointer' }}>×</button>
        <p style={{ fontWeight:800, fontSize:15, color:C.gold, margin:0 }}>Faire mon challenge</p>
        <span style={{ width:22 }} />
      </div>

      <div style={{ maxWidth:500, margin:'0 auto', padding:'20px 16px' }}>
        {/* ÉTAPE 1 — Choisir l'artiste */}
        {etape === 1 && (
          <>
            <p style={{ fontWeight:800, fontSize:17, margin:'0 0 4px' }}>Sélectionnez votre artiste</p>
            <p style={{ color:C.textSoft, fontSize:13, margin:'0 0 16px' }}>Cherchez ou choisissez l'artiste dont vous voulez utiliser une chanson.</p>
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher un artiste..."
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, marginBottom:14, boxSizing:'border-box' as any }} />
            {artistes.length === 0 ? (
              <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', padding:20 }}>Aucun artiste trouvé.</p>
            ) : artistes.map((a:any) => (
              <button key={a.email} onClick={() => { setArtiste(a.email); setEtape(2); }}
                style={{ width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:C.text, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:8 }}>
                {a.nom}
              </button>
            ))}
          </>
        )}

        {/* ÉTAPE 2 — Choisir la chanson */}
        {etape === 2 && (
          <>
            <p style={{ fontWeight:800, fontSize:17, margin:'0 0 4px' }}>Choisissez la chanson</p>
            <p style={{ color:C.textSoft, fontSize:13, margin:'0 0 16px' }}>La musique jouera pendant que vous filmez votre vidéo.</p>
            {chansonsArtiste.length === 0 ? (
              <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', padding:20 }}>Cet artiste n'a pas encore de chanson disponible.</p>
            ) : chansonsArtiste.map((c:any) => (
              <button key={c.id} onClick={() => { setChanson(c); setEtape(3); }}
                style={{ width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:12, border:`1px solid ${chanson?.id===c.id?C.gold:'rgba(255,255,255,0.08)'}`, background:'rgba(255,255,255,0.04)', color:C.text, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                {c.label || c.titre || 'Chanson'}
              </button>
            ))}
            {!artisteEmail && (
              <button onClick={() => setEtape(1)}
                style={{ width:'100%', marginTop:8, padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer' }}>
                Changer d'artiste
              </button>
            )}
          </>
        )}

        {/* ÉTAPE 3 — Filmer (écran plein, façon TikTok) */}
        {etape === 3 && (
          <div style={{ position:'fixed', inset:0, background:'#000', zIndex:10002, overflow:'hidden' }}>

            {/* CAMÉRA PLEIN ÉCRAN — le canvas porte les filtres et effets */}
            <video ref={videoRef} muted playsInline style={{ display:'none' }} />
            <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            <video ref={audioRef} playsInline style={{ display:'none' }} />

            {/* Barre de progression de l'enregistrement, tout en haut */}
            {recording && (
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.2)', zIndex:6 }}>
                <div style={{ height:'100%', width:`${(tempsEcoule/DUREE_MAX)*100}%`, background:'#fe2c55', transition:'width 1s linear' }} />
              </div>
            )}

            {/* HAUT — fermer + pilule musique + minuteur */}
            <div style={{ position:'absolute', top:0, left:0, right:0, padding:'16px 14px 0', display:'flex', alignItems:'center', gap:10, zIndex:5 }}>
              {!recording && (
                <button onClick={onClose} aria-label="Fermer"
                  style={{ width:36, height:36, borderRadius:99, border:'none', background:'rgba(0,0,0,0.4)', color:'#fff', fontSize:22, lineHeight:1, cursor:'pointer', flexShrink:0 }}>×</button>
              )}
              <button onClick={() => !recording && setPanneau('musique')}
                style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'8px 14px', borderRadius:99, border:'none', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(10px)', color:'#fff', fontSize:13, fontWeight:600, cursor: recording?'default':'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chanson?.label || chanson?.titre || 'Choisir la musique'}</span>
              </button>
              {recording && (
                <div style={{ background:'rgba(254,44,85,0.95)', borderRadius:99, padding:'6px 13px', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {Math.floor(tempsEcoule/60)}:{String(tempsEcoule%60).padStart(2,'0')}
                </div>
              )}
            </div>

            {/* COLONNE DROITE — outils */}
            <div style={{ position:'absolute', right:12, top:'20%', display:'flex', flexDirection:'column', gap:20, zIndex:5 }}>
              {[
                { id:'flip',    label:'Retourner', actif:false, onTap:() => setCameraFace(cameraFace==='user'?'environment':'user'),
                  svg:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M20 8a8 8 0 0 0-14-3M4 16a8 8 0 0 0 14 3"/><polyline points="4 4 4 9 9 9"/><polyline points="20 20 20 15 15 15"/></svg> },
                { id:'effets',  label:'Effets', actif: effet!=='aucun', onTap:() => setPanneau('effets'),
                  svg:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3l2.2 5.6L20 10l-5.8 1.4L12 17l-2.2-5.6L4 10l5.8-1.4z"/><path d="M18 16l.8 2L21 19l-2.2.9L18 22l-.8-2.1L15 19l2.2-1z"/></svg> },
                { id:'son',     label: sonCoupe?'Muet':'Musique', actif: sonCoupe, onTap:() => setSonCoupe(!sonCoupe),
                  svg: sonCoupe
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg> },
                { id:'micro',   label: micCoupe?'Micro coupé':'Micro', actif: micCoupe, onTap:() => setMicCoupe(!micCoupe),
                  svg: micCoupe
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 5.12 2.12M19 10v2a7 7 0 0 1-11.87 5.03M5 10v2a7 7 0 0 0 .69 3.03M12 19v4M8 23h8"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> },
              ].map(o => {
                const bloquePendantEnregistrement = recording && o.id === 'effets';
                return (
                <button key={o.id} onClick={() => { if (!bloquePendantEnregistrement) o.onTap(); }}
                  style={{ background:'none', border:'none', padding:0, cursor: bloquePendantEnregistrement ? 'default' : 'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, opacity: recording && o.id!=='flip' && o.id!=='son' && o.id!=='micro' ? 0.4 : 1 }}>
                  <span style={{ width:46, height:46, borderRadius:99, background: o.actif ? 'rgba(254,44,85,0.9)' : 'rgba(0,0,0,0.35)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {o.svg}
                  </span>
                  <span style={{ color:'#fff', fontSize:10.5, fontWeight:600, textShadow:'0 1px 3px rgba(0,0,0,0.6)' }}>{o.label}</span>
                </button>
                );
              })}
            </div>

            {/* Message d'état (chargement effets visage, erreurs) */}
            {(faceStatus || msg) && (
              <div style={{ position:'absolute', bottom:170, left:16, right:16, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', borderRadius:12, padding:'10px 14px', textAlign:'center', zIndex:5 }}>
                <span style={{ color:'#fff', fontSize:12.5, fontWeight:600 }}>{faceStatus || msg}</span>
              </div>
            )}

            {/* BANDE DE FILTRES EN DIRECT (façon Snapchat) — toujours visible pendant le cadrage,
                juste au-dessus du bouton d'enregistrement. Un aperçu caméra réel par filtre. */}
            {!recording && (
              <div style={{ position:'absolute', bottom:128, left:0, right:0, zIndex:6, display:'flex', gap:12, padding:'0 18px', overflowX:'auto', WebkitOverflowScrolling:'touch' }}
                className="masquer-scrollbar">
                {[{ id:'aucun', nom:'Normal', css:'none' }, ...FILTRES].map(f => {
                  const actif = filtre === f.id;
                  const taille = actif ? 60 : 48;
                  return (
                    <button key={f.id} onClick={() => setFiltre(f.id)}
                      style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                      <span style={{ width:taille, height:taille, borderRadius:99, overflow:'hidden', display:'block',
                        border: actif ? '3px solid #fff' : '2px solid rgba(255,255,255,0.35)', boxShadow: actif ? '0 2px 10px rgba(0,0,0,0.4)' : 'none', transition:'width .15s, height .15s' }}>
                        {cameraPrete && streamRef.current
                          ? <VignetteFiltreEnDirect stream={streamRef.current} css={f.css} miroir={cameraFace==='user'} />
                          : <ScenePourFiltre />}
                      </span>
                      <span style={{ color: actif ? '#fff' : 'rgba(255,255,255,0.75)', fontSize:10.5, fontWeight:600, textShadow:'0 1px 3px rgba(0,0,0,0.6)' }}>{f.nom}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* BAS — bouton d'enregistrement */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, paddingBottom:38, display:'flex', flexDirection:'column', alignItems:'center', gap:12, zIndex:5 }}>
              {!recording && (
                <p style={{ color:'rgba(255,255,255,0.75)', fontSize:11.5, margin:0, textShadow:'0 1px 3px rgba(0,0,0,0.6)' }}>Maintenez pour filmer · 1 min 15 max</p>
              )}
              <button onClick={recording ? arreterFilm : demarrerFilm} aria-label={recording?'Arrêter':'Filmer'}
                style={{ position:'relative', width:86, height:86, borderRadius:99, border:'none', background:'none', cursor:'pointer', padding:0 }}>
                {/* Anneau de progression */}
                <svg width="86" height="86" viewBox="0 0 86 86" style={{ position:'absolute', inset:0, transform:'rotate(-90deg)' }}>
                  <circle cx="43" cy="43" r="39" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
                  {recording && (
                    <circle cx="43" cy="43" r="39" fill="none" stroke="#fe2c55" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={2*Math.PI*39}
                      strokeDashoffset={2*Math.PI*39*(1 - tempsEcoule/DUREE_MAX)}
                      style={{ transition:'stroke-dashoffset 1s linear' }} />
                  )}
                </svg>
                {/* Pastille centrale */}
                <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                  width: recording ? 30 : 66, height: recording ? 30 : 66,
                  borderRadius: recording ? 8 : 99, background:'#fe2c55',
                  transition:'all .22s ease', display:'block' }} />
              </button>
            </div>

            {/* ── PANNEAU FILTRES ── */}
            {panneau === 'filtres' && (
              <div onClick={() => setPanneau('aucun')} style={{ position:'absolute', inset:0, zIndex:20, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                <div onClick={e => e.stopPropagation()} style={{ background:'rgba(18,18,22,0.96)', backdropFilter:'blur(20px)', borderRadius:'18px 18px 0 0', padding:'16px 0 30px' }}>
                  <div style={{ width:38, height:4, borderRadius:99, background:'rgba(255,255,255,0.25)', margin:'0 auto 14px' }} />
                  <p style={{ color:'#fff', fontSize:14, fontWeight:700, margin:'0 0 14px', paddingLeft:18 }}>Filtres</p>
                  <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'0 18px 4px' }}>
                    {FILTRES.map(f => (
                      <button key={f.id} onClick={() => { setFiltre(f.id); setPanneau('aucun'); }}
                        style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
                        <span style={{ width:62, height:62, borderRadius:14, display:'block', overflow:'hidden',
                          filter: f.css === 'none' ? 'none' : f.css,
                          outline: filtre===f.id ? '3px solid #fe2c55' : '2px solid rgba(255,255,255,0.15)', outlineOffset:2 }}>
                          <ScenePourFiltre />
                        </span>
                        <span style={{ color: filtre===f.id ? '#fe2c55' : 'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600 }}>{f.nom}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PANNEAU EFFETS ── */}
            {panneau === 'effets' && (
              <div onClick={() => setPanneau('aucun')} style={{ position:'absolute', inset:0, zIndex:20, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                <div onClick={e => e.stopPropagation()} style={{ background:'rgba(18,18,22,0.96)', backdropFilter:'blur(20px)', borderRadius:'18px 18px 0 0', padding:'16px 0 30px', maxHeight:'62vh', overflowY:'auto' }}>
                  <div style={{ width:38, height:4, borderRadius:99, background:'rgba(255,255,255,0.25)', margin:'0 auto 14px' }} />
                  <p style={{ color:'#fff', fontSize:14, fontWeight:700, margin:'0 0 14px', paddingLeft:18 }}>Effets</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, padding:'0 18px' }}>
                    {EFFETS.map(e => {
                      const estVisage = e.id.startsWith('face_');
                      return (
                        <button key={e.id} onClick={() => { setEffet(e.id); setPanneau('aucun'); }}
                          style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ width:58, height:58, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
                            background: estVisage ? 'linear-gradient(135deg,#7b3fe4,#c840a0)' : 'linear-gradient(135deg,#2b3350,#4a5578)',
                            outline: effet===e.id ? '3px solid #fe2c55' : '2px solid rgba(255,255,255,0.12)', outlineOffset:2 }}>
                            <IconeEffet id={e.id} />
                          </span>
                          <span style={{ color: effet===e.id ? '#fe2c55' : 'rgba(255,255,255,0.85)', fontSize:10.5, fontWeight:600, textAlign:'center', lineHeight:1.25 }}>{e.nom}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── PANNEAU MUSIQUE (sélection de l'extrait) ── */}
            {panneau === 'musique' && (
              <div onClick={() => setPanneau('aucun')} style={{ position:'absolute', inset:0, zIndex:20, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                <div onClick={e => e.stopPropagation()} style={{ background:'rgba(18,18,22,0.96)', backdropFilter:'blur(20px)', borderRadius:'18px 18px 0 0', padding:'16px 18px 30px' }}>
                  <div style={{ width:38, height:4, borderRadius:99, background:'rgba(255,255,255,0.25)', margin:'0 auto 14px' }} />
                  <p style={{ color:'#fff', fontSize:14, fontWeight:700, margin:'0 0 4px' }}>{chanson?.label || chanson?.titre || 'Chanson'}</p>

                  {!chargeMusique ? (
                    <div style={{ padding:'14px 0' }}>
                      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, margin:'0 0 10px' }}>Chargement de la musique...</p>
                      <div style={{ height:6, background:'rgba(255,255,255,0.1)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:'40%', background:'#fe2c55', borderRadius:99, animation:'chLoad 1.2s ease-in-out infinite' }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, margin:'0 0 12px' }}>
                        {Math.floor(musiqueDebut/60)}:{String(musiqueDebut%60).padStart(2,'0')} → {Math.floor(musiqueFin/60)}:{String(musiqueFin%60).padStart(2,'0')} · {musiqueFin - musiqueDebut}s
                      </p>

                      <div
                        ref={bandeRef}
                        onPointerDown={(e) => {
                          const bande = bandeRef.current; if (!bande) return;
                          const rect = bande.getBoundingClientRect();
                          const pos = ((e.clientX - rect.left) / rect.width) * dureeMusique;
                          poigneeRef.current = Math.abs(pos - musiqueDebut) < Math.abs(pos - musiqueFin) ? 'debut' : 'fin';
                          // Capture le pointeur : le glissement continue de fonctionner même
                          // si le doigt sort de la petite bande (fréquent au toucher), au lieu
                          // de s'arrêter net dès qu'on quitte la zone.
                          try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}
                        }}
                        onPointerMove={(e) => {
                          if (!poigneeRef.current) return;
                          const bande = bandeRef.current; if (!bande) return;
                          const rect = bande.getBoundingClientRect();
                          let pos = Math.round(((e.clientX - rect.left) / rect.width) * dureeMusique);
                          pos = Math.max(0, Math.min(dureeMusique, pos));
                          if (poigneeRef.current === 'debut') {
                            const nv = Math.max(0, Math.min(pos, musiqueFin - 1));
                            setMusiqueDebut(nv);
                            if (musiqueFin - nv > DUREE_MAX_MUSIQUE) setMusiqueFin(nv + DUREE_MAX_MUSIQUE);
                          } else {
                            const nv = Math.min(dureeMusique, Math.max(pos, musiqueDebut + 1));
                            setMusiqueFin(nv);
                            if (nv - musiqueDebut > DUREE_MAX_MUSIQUE) setMusiqueDebut(nv - DUREE_MAX_MUSIQUE);
                          }
                        }}
                        onPointerUp={() => { poigneeRef.current = null; }}
                        onPointerLeave={() => { poigneeRef.current = null; }}
                        style={{ position:'relative', height:56, background:'rgba(255,255,255,0.06)', borderRadius:10, marginBottom:8, cursor:'pointer', touchAction:'none', overflow:'hidden' }}>
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', gap:2, padding:'0 6px', opacity:0.25 }}>
                          {Array.from({length:44}).map((_,i) => (
                            <div key={i} style={{ flex:1, height:`${18 + Math.abs(Math.sin(i*1.7))*64}%`, background:'#fff', borderRadius:2 }} />
                          ))}
                        </div>
                        <div style={{ position:'absolute', top:0, bottom:0, left:`${(musiqueDebut/dureeMusique)*100}%`, width:`${((musiqueFin-musiqueDebut)/dureeMusique)*100}%`, background:'rgba(254,44,85,0.22)', border:'2px solid #fe2c55', borderRadius:6 }} />
                        {[musiqueDebut, musiqueFin].map((v,i) => (
                          <div key={i} style={{ position:'absolute', top:0, bottom:0, left:`${(v/dureeMusique)*100}%`, width:14, marginLeft:-7, background:'#fe2c55', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 8px rgba(0,0,0,0.5)' }}>
                            <div style={{ width:2, height:20, background:'rgba(255,255,255,0.7)' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:14 }}>
                        <span>0:00</span>
                        <span>{Math.floor(dureeMusique/60)}:{String(dureeMusique%60).padStart(2,'0')}</span>
                      </div>

                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={() => {
                            if (!audioRef.current) return;
                            const a = audioRef.current;
                            if (!a.paused) { a.pause(); setApercuJoue(false); return; }
                            a.volume = 1; setMsg('');
                            // Fichier complet (déjà mis en cache) + positionnement direct,
                            // plutôt qu'un extrait généré à la volée par Cloudinary — évite
                            // les saccades pendant la lecture.
                            a.src = urlChanson;
                            a.onended = () => setApercuJoue(false);
                            a.load();
                            const lancer = () => {
                              try { a.currentTime = musiqueDebut; } catch {}
                              a.play().then(() => {
                                setApercuJoue(true);
                                setTimeout(() => { try { a.pause(); } catch {} setApercuJoue(false); }, (musiqueFin - musiqueDebut) * 1000);
                              }).catch(() => setMsg('Lecture impossible pour cette chanson.'));
                            };
                            if (a.readyState >= 2) lancer(); else { a.oncanplay = () => { a.oncanplay = null; lancer(); }; }
                          }}
                          style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.18)', background:'transparent', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                          {apercuJoue
                            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" style={{verticalAlign:'-1px', marginRight:6}}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" style={{verticalAlign:'-1px', marginRight:6}}><polygon points="6 4 20 12 6 20"/></svg>Écouter</>}
                        </button>
                        <button onClick={() => { setPanneau('aucun'); setEtape(2); }}
                          style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.18)', background:'transparent', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                          Changer
                        </button>
                        <button onClick={() => setPanneau('aucun')}
                          style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:'#fe2c55', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                          OK
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 4 — Aperçu + Publier */}
        {etape === 4 && (
          <>
            <p style={{ fontWeight:800, fontSize:17, margin:'0 0 14px' }}>Votre challenge</p>
            {videoUrl && (
              <video src={videoUrl} controls playsInline style={{ width:'100%', borderRadius:16, maxHeight:'55vh', marginBottom:10, background:'#000' }} />
            )}
            {/* Vitesse : ralenti / accéléré, appliqué directement sur le rendu final */}
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {[0.5, 1, 1.5, 2].map(v => (
                <button key={v} onClick={() => changerVitesse(v)} disabled={reEncodage}
                  style={{ flex:1, padding:9, borderRadius:10, border: vitesse===v ? '1.5px solid '+C.gold : '1px solid rgba(255,255,255,0.12)',
                    background: vitesse===v ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)',
                    color: vitesse===v ? C.gold : C.text, fontSize:12.5, fontWeight:700, cursor: reEncodage?'wait':'pointer' }}>
                  {reEncodage && vitesse!==v ? '…' : (v===1 ? 'Normal' : v+'x')}
                </button>
              ))}
            </div>
            <button onClick={publier} disabled={publishing}
              style={{ width:'100%', padding:15, borderRadius:14, border:'none', background:'linear-gradient(135deg,#1a6bff,#4da6ff)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              {publishing ? 'Publication...' : 'Publier mon challenge'}
            </button>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <button onClick={() => partager('tiktok')} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:12, fontWeight:700, cursor:'pointer' }}>TikTok</button>
              <button onClick={() => partager('facebook')} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:12, fontWeight:700, cursor:'pointer' }}>Facebook</button>
              <button onClick={() => partager('youtube')} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:12, fontWeight:700, cursor:'pointer' }}>Shorts</button>
            </div>
            <button onClick={() => { setVideoBlob(null); setVideoUrl(''); videoBlobOriginalRef.current = null; setVitesse(1); setEtape(3); }}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer' }}>
              Refaire la vidéo
            </button>
            {msg && <p style={{ color: msg.includes('publié') ? '#00c853' : '#f04a6a', fontSize:13, textAlign:'center', marginTop:10 }}>{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TENDANCES — classements des titres et artistes les plus écoutés.
// Agrège les dernières entrées de la collection 'streams' sur la période
// choisie (7 jours / 30 jours / tout temps). 100% temps réel via onSnapshot.
// ─────────────────────────────────────────────
function TendancesSection({ contenus }: { contenus: any[] }) {
  const [periode, setPeriode] = useState<'7j'|'30j'|'tout'>('7j');
  const [streams, setStreams] = useState<any[]>([]);
  // Horodatage figé au montage : évite d'appeler Date.now() (impur) pendant le rendu.
  // Rafraîchi toutes les minutes pour que la fenêtre glissante reste exacte.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Derniers 800 streams : largement suffisant pour dégager des tendances
    const unsub = onSnapshot(
      query(collection(db, 'streams'), orderBy('ts', 'desc'), limit(800)),
      snap => setStreams(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, []);

  const debut = periode === 'tout' ? 0 : maintenant - (periode === '7j' ? 7 : 30) * 24 * 3600 * 1000;
  const recents = streams.filter(s => {
    if (periode === 'tout') return true;
    const t = new Date(s.ts || 0).getTime();
    return t >= debut;
  });

  // Comptage par contenu (clé : publicLinkId, qrId, ou label+artiste en secours)
  // et par artiste (chaque stream porte le nom d'artiste).
  const parTitre = new Map<string, number>();
  const parArtiste = new Map<string, number>();
  for (const s of recents) {
    const cle = s.publicLinkId || s.qrId || `${(s.label || '').toLowerCase().trim()}__${(s.artist || '').toLowerCase().trim()}`;
    if (cle) parTitre.set(cle, (parTitre.get(cle) || 0) + 1);
    const art = (s.artist || '').trim();
    if (art) parArtiste.set(art, (parArtiste.get(art) || 0) + 1);
  }

  // Relie chaque clé au contenu publié correspondant (pour pochette + lien)
  const topTitres = [...parTitre.entries()]
    .map(([cle, ecoutes]) => {
      const meta = contenus.find((c: any) =>
        c.publicLinkId === cle ||
        `${(c.label || '').toLowerCase().trim()}__${(c.artist || '').toLowerCase().trim()}` === cle
      );
      if (!meta) return null;
      return { ...meta, ecoutes };
    })
    .filter((t): t is { ecoutes: number } & Record<string, any> => Boolean(t))
    .sort((a, b) => b.ecoutes - a.ecoutes)
    .slice(0, 5);

  const topArtistes = [...parArtiste.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Pas encore d'écoutes sur la période → on n'affiche rien du tout
  if (recents.length === 0) return null;

  return (
    <div style={{ margin:'4px 16px 20px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'14px 14px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:16, fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:6 }}>🔥 Tendances</h3>
        <div style={{ display:'flex', gap:4 }}>
          {([['7j','7 j'],['30j','30 j'],['tout','Tout']] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setPeriode(id)}
              style={{ padding:'3px 10px', borderRadius:99, border:`1px solid ${periode===id?'#4da6ff':'rgba(255,255,255,0.1)'}`, background:periode===id?'rgba(77,166,255,0.15)':'transparent', color:periode===id?'#4da6ff':'#4a5878', cursor:'pointer', fontSize:10, fontWeight:700 }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {topTitres.length > 0 && (
        <div>
          {topTitres.map((t: any, i: number) => (
            <Lien key={t.id} href={`/ecoute/${t.publicLinkId}`} state={{ contenu: t }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:10, textDecoration:'none' }}>
              <span style={{ width:22, textAlign:'center', fontSize:15, fontWeight:900, color:i===0?'#ffd700':i===1?'#cfd8ea':i===2?'#c88a5a':'#4a5878', flexShrink:0 }}>{i+1}</span>
              {t.coverUrl ? (
                <img src={optimImg(t.coverUrl, 120)} alt={t.label} style={{ width:42, height:42, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
              ) : (
                <div style={{ width:42, height:42, borderRadius:8, background:'linear-gradient(135deg,#0a1535,#1e3a6e)', flexShrink:0 }} />
              )}
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', color:C.text, fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.label}</span>
                <span style={{ display:'block', color:'#4da6ff', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}</span>
              </span>
              <span style={{ fontSize:11, fontWeight:700, color:'#4a5878', flexShrink:0 }}>▶ {t.ecoutes}</span>
            </Lien>
          ))}
        </div>
      )}

      {topArtistes.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop: topTitres.length > 0 ? 8 : 2, paddingTop: topTitres.length > 0 ? 10 : 0, borderTop: topTitres.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          {topArtistes.map(([nom, n]) => (
            <span key={nom} style={{ padding:'4px 10px', borderRadius:99, background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.25)', color:'#ffd700', fontSize:11, fontWeight:700 }}>{nom} · {n}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// POUR TOI — recommandations personnalisées.
// Se base sur l'historique du fan (collection historique_ecoute : écoutes +
// kiffs) : artistes et catégories qu'il aime → contenus publiés correspondants,
// en excluant ceux qu'il connaît déjà (Zikothèque ou déjà écoutés).
// Visiteur / fan sans historique → fallback : les contenus les plus populaires.
// ─────────────────────────────────────────────
function PourToiSection({ contenus }: { contenus: any[] }) {
  const user = auth.currentUser;
  const [historique, setHistorique] = useState<any[]>([]);
  const [zikoIds, setZikoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setHistorique([]); setZikoIds(new Set()); return; }
    // Historique d'écoute/kiffs du fan (temps réel)
    const unsub = onSnapshot(
      query(collection(db, 'historique_ecoute'), where('uid', '==', user.uid), limit(200)),
      snap => setHistorique(snap.docs.map(d => d.data())),
      () => {}
    );
    // Contenus déjà dans sa Zikothèque → à exclure des recommandations
    getDocs(query(collection(db, 'zikotheque'), where('uid', '==', user.uid)))
      .then(s => setZikoIds(new Set(s.docs.map(d => d.data().qrId))))
      .catch(() => {});
    return () => unsub();
  }, [user]);

  // Recommandations personnalisées : score = artistes suivis (10/8 pts) + catégories écoutées
  const recommandes = (() => {
    if (!user || historique.length === 0) return [];
    const emailsArtistes = new Set<string>();
    const nomsArtistes = new Set<string>();
    const catsAimees = new Map<string, number>();
    for (const h of historique) {
      if (h.artistEmail) emailsArtistes.add(h.artistEmail);
      if (h.artist) nomsArtistes.add((h.artist || '').toLowerCase().trim());
      if (h.categorie) catsAimees.set(h.categorie, (catsAimees.get(h.categorie) || 0) + (h.nb || 1));
    }
    const connus = new Set([...zikoIds, ...historique.map(h => h.qrId)]);
    return contenus
      .filter(c => !connus.has(c.publicLinkId))
      .map((c: any) => {
        let s = 0;
        if (c.artistEmail && emailsArtistes.has(c.artistEmail)) s += 10;
        if (nomsArtistes.has((c.artist || '').toLowerCase().trim())) s += 8;
        s += (catsAimees.get(c.categorie) || 0) * 0.5;
        return { c, s };
      })
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || ((b.c.kiffs||0)+(b.c.buzz||0)) - ((a.c.kiffs||0)+(a.c.buzz||0)))
      .slice(0, 4)
      .map(x => x.c);
  })();

  // Fallback visiteur / fan sans historique : populaires (kiffs + buzz + partages)
  const populaires = contenus
    .filter(c => !zikoIds.has(c.publicLinkId))
    .map((c: any) => ({ c, s: (c.kiffs || 0) * 2 + (c.buzz || 0) + (c.partages || 0) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(x => x.c);

  const estPersonnalise = !!user && recommandes.length > 0;
  const liste = estPersonnalise ? recommandes : populaires;
  if (liste.length === 0) return null;
  const titre = estPersonnalise ? '✨ Pour toi' : '🔥 Populaire en ce moment';

  return (
    <div style={{ margin:'4px 0 20px' }}>
      <h3 style={{ fontSize:16, fontWeight:800, color:C.text, margin:'0 16px 10px', display:'flex', alignItems:'center', gap:6 }}>{titre}</h3>
      <div style={{ display:'flex', gap:10, overflowX:'auto', padding:'0 16px 4px', scrollbarWidth:'none' }}>
        {liste.map(c => (
          <Lien key={c.id} href={`/ecoute/${c.publicLinkId}`} state={{ contenu: c }}
            style={{ flexShrink:0, width:150, textDecoration:'none', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
            {c.coverUrl ? (
              <img src={optimImg(c.coverUrl, 300)} alt={c.label} style={{ width:'100%', height:150, objectFit:'cover', objectPosition:'top', display:'block' }} />
            ) : (
              <div style={{ width:'100%', height:150, background:'linear-gradient(135deg,#0a1535,#1e3a6e)' }} />
            )}
            <div style={{ padding:'8px 10px' }}>
              <p style={{ color:C.text, fontSize:12, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label}</p>
              <p style={{ color:'#4da6ff', fontSize:11, margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.artist}</p>
            </div>
          </Lien>
        ))}
      </div>
    </div>
  );
}


function DecouvrirPage() {
  const navigate = useNavigate();
  const [contenus, setContenus] = useState<any[]>([]);
  const [motsArtistes, setMotsArtistes] = useState<any[]>([]);
  const [sorties, setSorties] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [typeFiltre, setTypeFiltre] = useState('tous');
  const [categorieFiltre, setCategorieFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortieCiblee, setSortieCiblee] = useState('');
  const [banniereKiff, setBanniereKiff] = useState(false);
  const [challengeMode, setChallengeMode] = useState(false);
  const [challengeArtiste, setChallengeArtiste] = useState('');
  const [challengeSig, setChallengeSig] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const user = auth.currentUser;

  // Lien partagé vers une sortie précise : ?sortie=ID → onglet Bientôt + mise en évidence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sortie');
    if (sid) { setTypeFiltre('bientot'); setSortieCiblee(sid); }
    // Venu d'une notif éducative "envoyez des kiffements" → afficher une bannière d'invitation
    if (params.get('action') === 'kiffement') { setBanniereKiff(true); }
    // Venu d'une signature "Faire mon challenge" ou du bouton Challenge → page Challenge
    if (params.get('action') === 'challenge') {
      setChallengeMode(true);
      setChallengeArtiste(params.get('artiste') || '');
      setChallengeSig(params.get('sig') || '');
    }
  }, []);

  // Quand les sorties sont chargées et qu'une cible existe, scroller dessus
  useEffect(() => {
    if (sortieCiblee && sorties.length > 0) {
      const t = setTimeout(() => {
        const el = document.getElementById('sortie-' + sortieCiblee);
        if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [sortieCiblee, sorties]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'decouvrir'), orderBy('publishedAt','desc')),
      snap => {
        const tous = snap.docs.map(d => ({id:d.id,...d.data()})) as any[];
        // Déduplication : une seule entrée par publicLinkId (et par titre+artiste en secours)
        // + on masque les publications mises en "Privé" par l'artiste (masque === true)
        const vus = new Set<string>();
        const uniques = tous.filter((c:any) => {
          if (c.masque === true) return false; // publication privée → masquée du fil
          const cle1 = c.publicLinkId || '';
          const cle2 = `${(c.label||'').toLowerCase().trim()}__${(c.artist||c.artistEmail||'').toLowerCase().trim()}`;
          if (cle1 && vus.has('id:'+cle1)) return false;
          if (vus.has('lab:'+cle2)) return false;
          if (cle1) vus.add('id:'+cle1);
          vus.add('lab:'+cle2);
          return true;
        });
        setContenus(uniques);
        setLoading(false);
        // Suggestions pour la lecture enchaînée depuis une page d'écoute directe
        try {
          localStorage.setItem('dz_suggestions', JSON.stringify(
            uniques.slice(0, 30).map((c: any) => ({ publicLinkId: c.publicLinkId, label: c.label, artist: c.artist, coverUrl: c.coverUrl }))
          ));
        } catch { /* quota */ }
      }
    );
    const unsubMots = onSnapshot(
      query(collection(db, 'mots_artiste'), orderBy('createdAt','desc')),
      snap => setMotsArtistes(snap.docs.map(d => ({id:d.id,...d.data()})).filter((m:any) => m.statut === 'valide'))
    );
    const unsubSorties = onSnapshot(
      query(collection(db, 'sorties'), orderBy('createdAt','desc')),
      snap => setSorties(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    const unsubChallenges = onSnapshot(
      query(collection(db, 'challenges'), orderBy('createdAt','desc')),
      snap => setChallenges(snap.docs.map(d => ({id:d.id,...d.data()}))),
      () => {}
    );
    return () => { unsub(); unsubMots(); unsubSorties(); unsubChallenges(); };
  }, []);

  // Réinitialiser catégorie quand on change de type
  const handleTypeChange = (type: string) => {
    setTypeFiltre(type);
    setCategorieFiltre('tous');
  };

  const categoriesActuelles = typeFiltre === 'video' ? CATEGORIES_VIDEO : CATEGORIES_AUDIO;

  // RECHERCHE — filtre instantané sur titre, artiste, catégorie et description.
  // Insensible à la casse ET aux accents (é→e, à→a…) : « elite » trouve « Élite ».
  // Tout est déjà chargé côté client → filtrage local, aucune requête Firebase.
  const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termeRecherche = sansAccents(recherche.trim().toLowerCase());
  const contenusFiltres = contenus.filter(c => {
    const isVideo = c.files?.some((f:any) => f.name?.match(/\.(mp4|mov|avi|mkv|webm)$/i));
    if (typeFiltre === 'audio' && isVideo) return false;
    if (typeFiltre === 'video' && !isVideo) return false;
    if (categorieFiltre !== 'tous' && c.categorie !== categorieFiltre) return false;
    if (termeRecherche) {
      const haystack = sansAccents(`${c.label || ''} ${c.artist || ''} ${c.categorie || ''} ${c.description || ''}`.toLowerCase());
      if (!haystack.includes(termeRecherche)) return false;
    }
    return true;
  });

  return (
    <>
    {challengeMode && (
      <ChallengePage
        artisteEmail={challengeArtiste}
        sigId={challengeSig}
        contenus={contenus}
        onClose={() => { setChallengeMode(false); window.history.replaceState({}, '', '/decouvrir'); }}
      />
    )}
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:80 }}>

      {/* HEADER */}
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, position:'sticky', top:0, zIndex:50 }}>
        <Logo size="sm" />
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <p style={{ color:'#4da6ff', fontWeight:700, fontSize:14, margin:0 }}>Découvrir</p>
          <IconeScannerBouton onClick={() => setShowScanner(true)} />
        </div>
      </div>
      {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}

      {/* Bannière : invitation à envoyer des kiffements (venu d'une notif éducative) */}
      {banniereKiff && (
        <div style={{ margin:'12px 16px 0', padding:'14px 16px', borderRadius:14, background:'linear-gradient(135deg, rgba(245,200,76,0.18), rgba(245,200,76,0.08))', border:'1px solid rgba(245,200,76,0.4)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <p style={{ color:C.gold, fontWeight:800, fontSize:14, margin:'0 0 4px' }}>Envoyez des kiffements à votre artiste</p>
            <p style={{ color:C.textSoft, fontSize:12, margin:0, lineHeight:1.5 }}>Choisissez un artiste ci-dessous et ouvrez son contenu pour lui offrir des kiffements.</p>
          </div>
          <button onClick={() => setBanniereKiff(false)}
            style={{ flexShrink:0, width:28, height:28, borderRadius:99, border:'none', background:'rgba(255,255,255,0.1)', color:C.text, fontSize:16, cursor:'pointer' }}>×</button>
        </div>
      )}

      {/* FILTRES TYPE — barre d'icônes style Facebook */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 8px' }}>
        {TYPES_CONTENU.map(t => (
          <button key={t.id} onClick={() => handleTypeChange(t.id)}
            title={t.titre}
            style={{ flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', borderBottom:`2px solid ${typeFiltre===t.id?'#4da6ff':'transparent'}`, transition:'all 0.2s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={typeFiltre===t.id?'#4da6ff':'#8098b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
          </button>
        ))}
      </div>

      {/* TITRE EN GRAND de l'onglet actif */}
      <div style={{ padding:'16px 16px 8px' }}>
        <h2 style={{ fontSize:24, fontWeight:800, color:C.text, margin:0, fontFamily:"'DM Sans',sans-serif" }}>
          {TYPES_CONTENU.find(t => t.id === typeFiltre)?.titre || ''}
        </h2>
      </div>

      {/* RECHERCHE — titre, artiste, catégorie, description */}
      <div style={{ padding:'0 16px 12px' }}>
        <div style={{ position:'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5878" strokeWidth="2" strokeLinecap="round"
            style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher un titre, un artiste, un style…"
            style={{ width:'100%', boxSizing:'border-box', padding:'11px 38px 11px 38px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, outline:'none' }} />
          {recherche && (
            <button onClick={() => setRecherche('')} title="Effacer"
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:24, height:24, borderRadius:99, border:'none', background:'rgba(255,255,255,0.1)', color:C.textSoft, fontSize:14, cursor:'pointer', lineHeight:1 }}>×</button>
          )}
        </div>
        {termeRecherche && (
          <p style={{ color:'#4a5878', fontSize:11, margin:'6px 2px 0' }}>
            {contenusFiltres.length} résultat{contenusFiltres.length > 1 ? 's' : ''} pour « {recherche.trim()} »
          </p>
        )}
      </div>

      {/* HERO CARD — contenu à la une (onglet Actu uniquement) */}
      {typeFiltre === 'tous' && !loading && !termeRecherche && contenusFiltres.length > 0 && (() => {
        // Rotation intelligente : on pioche au hasard parmi les meilleurs contenus
        // (mélange : récents + populaires en kiffs/buzz), pas juste le dernier.
        const candidats = [...contenusFiltres]
          .map(c => ({ c, score: (c.kiffs || 0) * 2 + (c.buzz || 0) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, Math.min(6, contenusFiltres.length))  // top 6 meilleurs
          .map(x => x.c);
        const pool = candidats.length > 0 ? candidats : contenusFiltres.slice(0, 6);
        const hero = pool[Math.floor(Math.random() * pool.length)];
        return (
          <Lien href={`/ecoute/${hero.publicLinkId}`} state={{ contenu: hero }} style={{ display:'block', textDecoration:'none', margin:'4px 16px 20px', borderRadius:20, overflow:'hidden', position:'relative', height:210 }}>
            {hero.coverUrl ? (
              <img src={hero.coverUrl} alt={hero.label} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top' }} />
            ) : (
              <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,'+C.blue+',#0a1535)' }} />
            )}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(13,21,38,0.85) 0%, transparent 45%)' }} />
            <div style={{ position:'absolute', top:14, left:14, padding:'5px 12px', borderRadius:99, background:'rgba(10,132,255,0.92)' }}>
              <span style={{ color:'#fff', fontSize:11, fontWeight:700, letterSpacing:0.5 }}>À LA UNE</span>
            </div>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'18px', display:'flex', justifyContent:'flex-end' }}>
              <div style={{ display:'inline-block', padding:'9px 22px', borderRadius:99, background:'#fff' }}>
                <span style={{ color:'#0D1526', fontSize:13, fontWeight:800 }}>Écouter</span>
              </div>
            </div>
          </Lien>
        );
      })()}

      {/* TENDANCES — classements d'écoutes (Actu uniquement, masqué pendant une recherche).
          Reste MONTÉE pendant la recherche (juste masquée en CSS) pour garder son
          abonnement Firestore et réapparaître instantanément sans rechargement. */}
      {!loading && (
        <div style={{ display: (typeFiltre === 'tous' && !termeRecherche) ? 'block' : 'none' }}>
          <TendancesSection contenus={contenus} />
          {/* POUR TOI — recommandations personnalisées (ou populaires pour les visiteurs) */}
          <PourToiSection contenus={contenus} />
        </div>
      )}

      {/* FILTRES CATÉGORIE — seulement sur Musique/Vidéo */}
      {typeFiltre !== 'tous' && (
        <div style={{ display:'flex', gap:6, padding:'0 16px 12px', overflowX:'auto' }}>
          {categoriesActuelles.map(c => (
            <button key={c.id} onClick={() => setCategorieFiltre(c.id)}
              style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${categorieFiltre===c.id?'#ffd700':'rgba(255,255,255,0.08)'}`, background:categorieFiltre===c.id?'rgba(255,215,0,0.15)':'transparent', color:categorieFiltre===c.id?'#ffd700':'#4a5878', cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* CONTENUS */}
      <div style={{ padding:'0 16px' }}>
        {/* RUBRIQUE BIENTÔT — sorties programmées */}
        {typeFiltre === 'bientot' && (
          !loading && sorties.filter(s => s.statut === 'a_venir').length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <p style={{ color:'#4a5878', fontSize:14 }}>Aucune sortie programmée pour l'instant</p>
              <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Les prochaines sorties officielles apparaîtront ici</p>
            </div>
          ) : (
            sorties.filter(s => s.statut === 'a_venir').map(s => <CarteSortie key={s.id} s={s} cible={s.id === sortieCiblee} />)
          )
        )}

        {/* RUBRIQUE CHALLENGE — vidéos de challenges + bouton Créer */}
        {typeFiltre === 'challenge' && (
          <div>
            <button onClick={() => { navigate('/challenge'); }}
              style={{ width:'100%', padding:15, borderRadius:14, border:'none', background:'linear-gradient(135deg,#f04a6a,#d0324e)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Créer mon challenge
            </button>
            {challenges.length === 0 ? (
              <div style={{ textAlign:'center', padding:40 }}>
                <p style={{ color:'#4a5878', fontSize:14 }}>Aucun challenge pour l'instant</p>
                <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Soyez le premier à créer votre challenge !</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {challenges.map(ch => (
                  <div key={ch.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                    <video src={ch.videoUrl} controls playsInline style={{ width:'100%', aspectRatio:'9/16', objectFit:'cover', background:'#000' }} />
                    <div style={{ padding:'8px 10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        {ch.userPhoto ? <img src={ch.userPhoto} style={{ width:20, height:20, borderRadius:99, objectFit:'cover' }} alt="" /> : <div style={{ width:20, height:20, borderRadius:99, background:'linear-gradient(135deg,#1a6bff,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700 }}>{ch.userName?.[0]?.toUpperCase()}</div>}
                        <span style={{ color:'#eaf2ff', fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.userName}</span>
                      </div>
                      <p style={{ color:'#8098b8', fontSize:10, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.chansonTitre} · {ch.artisteNom}</p>
                      <div style={{ display:'flex', gap:10, marginTop:6 }}>
                        <span style={{ color:'#f04a6a', fontSize:11, fontWeight:700 }}>♥ {ch.kiffements || 0}</span>
                        <span style={{ color:'#8098b8', fontSize:11 }}>↗ {ch.partages || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MOODS — affichés dans le fil uniquement sur l'onglet Actu & Mood */}
        {typeFiltre !== 'bientot' && !loading && typeFiltre === 'tous' && !termeRecherche && motsArtistes.map(m => (
          <div key={'mood-'+m.id} style={{ marginBottom:16, background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.22)', borderRadius:16, overflow:'hidden', padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ background:'rgba(255,215,0,0.2)', color:'#ffd700', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99 }}>MOOD</span>
              <span style={{ color:'#ffd700', fontWeight:700, fontSize:13 }}>{m.artistName}</span>
            </div>
            {m.videoUrl && <video src={m.videoUrl} controls playsInline style={{ width:'100%', borderRadius:10, marginBottom:8, maxHeight:300 }} />}
            {m.imageUrl && <img src={m.imageUrl} style={{ width:'100%', borderRadius:10, marginBottom:8, maxHeight:300, objectFit:'cover' }} alt="" />}
            {m.texte && <p style={{ color:'#dde4f5', fontSize:14, lineHeight:1.6, margin:0 }}>{m.texte}</p>}
          </div>
        ))}

        {(typeFiltre === 'bientot' || typeFiltre === 'challenge') ? null : loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#4a5878' }}>Chargement...</div>
        ) : contenusFiltres.length === 0 && (termeRecherche !== '' || !(typeFiltre === 'tous' && motsArtistes.length > 0)) ? (
          <div style={{ textAlign:'center', padding:40 }}>
            {termeRecherche ? (
              <>
                <p style={{ color:'#4a5878', fontSize:14 }}>Aucun résultat pour « {recherche.trim()} »</p>
                <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Essaie un autre mot-clé : titre, artiste ou style musical</p>
              </>
            ) : (
              <>
                <p style={{ color:'#4a5878', fontSize:14 }}>Aucun contenu publié pour l'instant</p>
                <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Les artistes peuvent publier depuis leur dashboard</p>
              </>
            )}
          </div>
        ) : contenusFiltres.map(c => {
          const mediaFile = c.files?.[0];
          const rawUrl = mediaFile?.url || mediaFile?.name || c.fileUrl || '';
          const isVideo = /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(rawUrl);
          const fileUrl = rawUrl;
          return (
          <div key={c.id} style={{ marginBottom:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, overflow:'hidden' }}>
            {/* Média avec lecture automatique */}
            <Lien href={`/ecoute/${c.publicLinkId}`} state={{ contenu: c }} style={{ textDecoration:'none', display:'block' }}>
              {fileUrl ? (
                <AutoPlayMedia fileUrl={fileUrl} isVideo={isVideo} coverUrl={c.coverUrl} label={c.label} publicLinkId={c.publicLinkId} />
              ) : c.coverUrl ? (
                <img src={optimImg(c.coverUrl, 800)} alt={c.label} style={{ width:'100%', height:220, objectFit:'cover', objectPosition:'top', display:'block' }} />
              ) : (
                <div style={{ width:'100%', height:220, background:'linear-gradient(135deg,#0a1535,#1e3a6e)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
              )}
            </Lien>
            <div style={{ padding:'12px 14px' }}>
              <p style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>{c.label}</p>
              <p style={{ color:'#4da6ff', fontSize:13, marginBottom:8 }}>{c.artist}</p>
              {/* Stats Buzz */}
              <div style={{ display:'flex', gap:14, marginBottom:10 }}>
                <DiscouvrirStat qrId={c.publicLinkId} buzz={c.buzz||0} partages={c.partages||0} />
              </div>
              {/* Actions — une seule ligne, tout compact et visible */}
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <LikeButton qrId={c.publicLinkId} artistEmail={c.artistEmail} compact source="public" />
                <CommentSection qrId={c.publicLinkId} artistEmail={c.artistEmail} compact source="public" />
                <KiffementSection qrId={c.publicLinkId} artistEmail={c.artistEmail} compact source="public" />
                <button onClick={async () => {
                  const url = `${window.location.origin}/ecoute/${c.publicLinkId}`;
                  // Compter le partage (collection decouvrir = ce qui s'affiche, + qrcodes pour stats artiste)
                  try {
                    await addDoc(collection(db,'partages'), { publicLinkId: c.publicLinkId, artistEmail: c.artistEmail||'', ts: new Date().toISOString() });
                    await updateDoc(doc(db,'decouvrir',c.id), { partages: (c.partages||0) + 1 });
                    const qrSnap = await getDocs(query(collection(db,'qrcodes'), where('publicLinkId','==',c.publicLinkId)));
                    if (!qrSnap.empty) await updateDoc(doc(db,'qrcodes',qrSnap.docs[0].id), { partages: (qrSnap.docs[0].data().partages||0) + 1 });
                  } catch(e) { console.log('partage', e); }
                  if (navigator.share) {
                    navigator.share({ title: c.label, text: `Écoute "${c.label}" de ${c.artist}`, url }).catch(()=>{});
                  } else {
                    navigator.clipboard?.writeText(`Écoute "${c.label}" de ${c.artist} sur Doniel Zik : ${url}`);
                    alert('Lien copié ! Partage-le à tes amis.');
                  }
                }} title="Partager" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:40, height:40, borderRadius:99, background:'rgba(255,255,255,0.06)', border:'none', cursor:'pointer', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
                <Lien href={`/ecoute/${c.publicLinkId}`} state={{ contenu: c }}
                  style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:40, height:40, borderRadius:99, background:'rgba(30,111,255,0.2)', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#4da6ff"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                </Lien>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* BARRE NAVIGATION */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(11,15,30,0.98)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-around', padding:'10px 0 14px', zIndex:99 }}>
        {[
          { label:'Accueil', path:'/', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { label:'Découvrir', path:'/decouvrir', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { label:'Challenge', path:'/challenge', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
          { label:'Notifs', path:'/notifications', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { label:'Profil', path:'/profil', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: window.location.pathname === item.path ? '#4da6ff' : '#4a5878' }}>
            <span style={{ position:'relative', display:'inline-flex' }}>
              {item.svg}
              {item.path === '/notifications' && <BadgeNotif />}
            </span>
            <span style={{ fontSize:10, fontWeight:600 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
    </>
  );
}

// ─────────────────────────────────────────────
// PAGE PROFIL MÉLOMANE — /profil
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PAGE NOTIFICATIONS MÉLOMANE
// ─────────────────────────────────────────────
function NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [notifsPerso, setNotifsPerso] = useState<any[]>([]);
  const [notifsGen, setNotifsGen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState<'perso'|'generale'>('perso');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [permNotif, setPermNotif] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = '/ziko'; return; }
      setUser(u);
      const unsubP = onSnapshot(
        query(collection(db,'notifications'), where('to','==',u.email), orderBy('createdAt','desc')),
        snap => {
          // Côté MÉLOMANE : on EXCLUT les notifs destinées au compte artiste
          // (même email, mais interfaces séparées : un kiff/Oscart reçu en tant
          //  qu'artiste ne doit PAS apparaître dans les notifs mélomane)
          const docs = snap.docs.filter(d => d.data().role !== 'artiste');
          setNotifsPerso(docs.map(d => ({id:d.id,...d.data()})));
          setLoading(false);
        }
      );
      const unsubG = onSnapshot(
        query(collection(db,'notifications'), where('to','==','all'), orderBy('createdAt','desc')),
        snap => { setNotifsGen(snap.docs.map(d => ({id:d.id,...d.data()}))); setLoading(false); }
      );
      return () => { unsubP(); unsubG(); };
    });
  }, []);

  const notifs = vue === 'perso' ? notifsPerso : notifsGen;

  const markRead = async (id: string) => {
    await updateDoc(doc(db,'notifications',id), { lu: true });
  };

  const getIcon = (type: string) => {
    if (type === 'kiff') return <svg width="20" height="20" viewBox="0 0 24 24" fill="#f04a6a" stroke="#f04a6a" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
    if (type === 'commentaire' || type === 'activite') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    if (type === 'kiffement') return <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffd700" stroke="#ffd700" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    if (type === 'signature') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    if (type === 'generale' || type === 'mot_valide' || type === 'mot_artiste' || type === 'educative') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8098b8" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>;
  };

  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:80 }}>
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 20px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center' }}>
          <Logo size="sm" />
          <p style={{ marginLeft:16, fontWeight:700, fontSize:16, color:'#dde4f5' }}>Notifications</p>
        </div>
        <IconeScannerBouton onClick={() => setShowScanner(true)} />
      </div>
      {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}

      {/* Activation des notifications système — la demande automatique au
          chargement de la page est ignorée par la plupart des navigateurs
          (surtout sur Android) : il faut un vrai clic pour que le téléphone
          accepte de proposer la fenêtre d'autorisation. */}
      {permNotif === 'default' && (
        <div style={{ margin:'12px 16px 0', maxWidth:500, marginLeft:'auto', marginRight:'auto', background:'rgba(93,132,255,0.1)', border:'1px solid rgba(93,132,255,0.3)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🔔</span>
          <div style={{ flex:1 }}>
            <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:'0 0 2px' }}>Activer les notifications</p>
            <p style={{ color:C.textSoft, fontSize:11, margin:0 }}>Pour être alerté quand quelqu'un kiffe, commente, ou vous envoie un cadeau.</p>
          </div>
          <button onClick={() => { activerNotificationsPush(user?.email || '').then(p => setPermNotif(p)); }}
            style={{ padding:'8px 14px', borderRadius:99, border:'none', background:C.blue, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            Activer
          </button>
        </div>
      )}
      {permNotif === 'denied' && (
        <div style={{ margin:'12px 16px 0', maxWidth:500, marginLeft:'auto', marginRight:'auto', background:'rgba(255,100,124,0.1)', border:'1px solid rgba(255,100,124,0.3)', borderRadius:12, padding:'12px 16px' }}>
          <p style={{ color:C.alert, fontSize:12, margin:0, lineHeight:1.6 }}>Les notifications sont bloquées pour cette application. Pour les activer, va dans les réglages du téléphone → Applications → Doniel Zik → Notifications.</p>
        </div>
      )}

      {/* Onglets Perso / Générale */}
      <div style={{ display:'flex', gap:8, padding:'12px 16px 4px', maxWidth:500, margin:'0 auto' }}>
        {[['perso','Pour moi', notifsPerso.filter(n=>!n.lu).length],['generale','Général', notifsGen.length]].map(([k,l,n]) => (
          <button key={k as string} onClick={() => setVue(k as any)}
            style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
              background: vue===k ? '#1a6bff' : 'rgba(255,255,255,0.05)', color: vue===k ? '#fff' : '#8098b8' }}>
            {l as string}{(n as number) > 0 ? ` (${n})` : ''}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:500, margin:'0 auto', padding:'16px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a3a60" strokeWidth="1.5" style={{ marginBottom:16 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <p style={{ color:'#2a3a60', fontSize:14 }}>Aucune notification pour l'instant</p>
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ textAlign:'center', padding:60 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a3a60" strokeWidth="1.5" style={{ marginBottom:16 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <p style={{ color:'#2a3a60', fontSize:14 }}>Aucune notification pour l'instant</p>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} onClick={() => {
              markRead(n.id);
              if (n.type === 'reservation') { setExpanded(x => ({ ...x, [n.id]: !x[n.id] })); return; }
              // Signature reçue → profil (section Mes signatures)
              if (n.type === 'signature') { navigate('/profil'); return; }
              // Rediriger vers l'endroit concerné selon le type de notification —
              // adresse corrigée (l'ancienne "/fan?id=" n'existait dans aucune
              // route, ça retombait toujours sur la Zikothèque par défaut) et
              // distinction qr/public pour renvoyer vers la bonne page.
              if (n.qrId) { navigate(n.source === 'public' ? `/ecoute/${n.qrId}` : `/fan/${n.qrId}`); return; }
              if (n.type === 'educative' || n.type === 'generale' || n.type === 'activite') {
                // Si la notif parle de kiffements → bannière d'invitation ; sinon Découvrir
                if (n.text && n.text.toLowerCase().includes('kiffement')) {
                  navigate('/decouvrir?action=kiffement'); return;
                }
                navigate('/decouvrir'); return;
              }
              if (n.type === 'tuto_artiste' || n.type === 'kiff' || n.type === 'zikotheque' || n.type === 'telechargement') {
                navigate('/decouvrir'); return;
              }
            }}
            style={{ display:'flex', gap:14, padding:'14px 16px', borderRadius:14, marginBottom:8, background: n.lu ? 'rgba(255,255,255,0.02)' : 'rgba(30,111,255,0.08)', border:`1px solid ${n.lu ? 'rgba(255,255,255,0.04)' : 'rgba(30,111,255,0.2)'}`, cursor:'pointer' }}>
            <div style={{ flexShrink:0, width:40, height:40, borderRadius:99, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {getIcon(n.type)}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, color: n.lu ? '#5a7090' : '#dde4f5', margin:'0 0 4px', lineHeight:1.5 }}>{n.text}</p>
              <p style={{ fontSize:11, color:'#2a3a60', margin:0 }}>{new Date(n.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
              {/* Bouton réservation : compte à rebours (rouge) ou disponible (vert) */}
              {n.type === 'reservation' && (
                <div style={{ marginTop:8 }}>
                  <button onClick={(e) => { e.stopPropagation(); setExpanded(x => ({ ...x, [n.id]: !x[n.id] })); }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid rgba(30,111,255,0.35)', background:'rgba(30,111,255,0.12)', color:'#4da6ff', fontSize:11, fontWeight:800, letterSpacing:0.4, cursor:'pointer' }}>
                    <span>SORTIE OFFICIELLE RÉSERVÉE</span>
                    <span style={{ fontWeight:700 }}>{expanded[n.id] ? 'Masquer ▲' : 'Compte à rebours ▼'}</span>
                  </button>
                  {expanded[n.id] && <CompteRebours dateSortie={n.dateSortie} />}
                </div>
              )}
              {n.type === 'sortie_dispo' && (
                <button onClick={async (e) => {
                  e.stopPropagation();
                  // Télécharger + ajouter à la zikothèque
                  try {
                    const a = document.createElement('a');
                    a.href = n.fichierUrl; a.download = (n.titre||'contenu'); a.target = '_blank';
                    document.body.appendChild(a); a.click(); a.remove();
                    const u = auth.currentUser;
                    if (u) {
                      await addDoc(collection(db,'zikotheque'), {
                        uid: u.uid, userEmail: u.email, titre: n.titre, artistName: n.artistName,
                        fileUrl: n.fichierUrl, addedAt: new Date().toISOString(),
                      });
                    }
                  } catch {}
                }} style={{ marginTop:8, padding:'10px 16px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00a040,#4dff9a)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  ⬇ Télécharger maintenant
                </button>
              )}
              {n.type === 'educative' && (
                <button onClick={(e) => { e.stopPropagation(); navigate('/decouvrir'); }}
                  style={{ marginTop:8, padding:'10px 16px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#F5C84C,#e0a82e)', color:'#1a2340', fontWeight:800, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                  Envoyer un kiffement
                </button>
              )}
            </div>
            {!n.lu && <div style={{ width:8, height:8, borderRadius:99, background:'#1a6bff', flexShrink:0, marginTop:6 }} />}
          </div>
        ))}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(11,15,30,0.98)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-around', padding:'10px 0 14px', zIndex:99 }}>
        {[
          { label:'Accueil', path:'/', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { label:'Découvrir', path:'/decouvrir', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { label:'Challenge', path:'/challenge', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
          { label:'Notifs', path:'/notifications', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { label:'Profil', path:'/profil', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: window.location.pathname === item.path ? '#4da6ff' : '#4a5878' }}>
            <span style={{ position:'relative', display:'inline-flex' }}>
              {item.svg}
              {item.path === '/notifications' && <BadgeNotif />}
            </span>
            <span style={{ fontSize:10, fontWeight:600 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PROFIL PAGE
// ─────────────────────────────────────────────
function ProfilPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [likes, setLikes] = useState(0);
  const [kiffements, setKiffements] = useState(0);
  const [kiffsDispo, setKiffsDispo] = useState(0);
  const [kiffsOfferts, setKiffsOfferts] = useState(0);
  const [soldeOscart, setSoldeOscart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showProjet, setShowProjet] = useState(false);
  const [projetForm, setProjetForm] = useState({ nom:'', type:'musique', description:'', whatsapp:'' });
  const [projetSent, setProjetSent] = useState(false);
  const [rechargeModalProfil, setRechargeModalProfil] = useState<{fcfa:number,oscart:number}|null>(null);
  const [mesSignatures, setMesSignatures] = useState<any[]>([]);
  const [spotModal, setSpotModal] = useState<any>(null); // signature Spot à remplir (nom+slogan)
  const [spotNom, setSpotNom] = useState('');
  const [spotSlogan, setSpotSlogan] = useState('');
  // Édition du profil (photo + pseudo)
  const [editProfil, setEditProfil] = useState(false);
  const [pseudoEdit, setPseudoEdit] = useState('');
  const [photoEdit, setPhotoEdit] = useState('');
  const [uploadPhoto, setUploadPhoto] = useState(false);
  const [savingProfil, setSavingProfil] = useState(false);
  const [estArtiste, setEstArtiste] = useState(false); // ce compte est-il aussi un artiste validé ?

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = '/ziko'; return; }
      setUser(u);
      const [likesSnap, kiffSnap, soldeSnap] = await Promise.all([
        getDocs(query(collection(db,'likes'), where('userId','==',u.uid))),
        getDocs(query(collection(db,'cadeaux'), where('userId','==',u.uid))),
        getDocs(query(collection(db,'coins_solde'), where('uid','==',u.uid))),
      ]);
      setLikes(likesSnap.size);
      setKiffements(kiffSnap.size);
      const sd = soldeSnap.empty ? {} : soldeSnap.docs[0].data();
      setSoldeOscart(sd.solde || 0);
      setKiffsDispo(sd.kiffsDispo || 0);
      setKiffsOfferts(sd.kiffsOfferts || 0);
      setLoading(false);
      // Ce compte est-il aussi un artiste validé ? (pour proposer un accès direct au tableau de bord artiste)
      getDocs(query(collection(db,'artists'), where('email','==', u.email))).then(snap => setEstArtiste(!snap.empty));
      // Écouter mes signatures reçues (temps réel)
      onSnapshot(
        query(collection(db,'signatures'), where('donateurId','==',u.uid)),
        snap => setMesSignatures(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a:any,b:any) => (b.createdAt||'').localeCompare(a.createdAt||'')))
      );
    });
  }, []);

  // Le fan remplit le formulaire Spot (nom + slogan)
  const envoyerSpot = async () => {
    if (!spotModal || !spotNom.trim()) return;
    try {
      await updateDoc(doc(db,'signatures', spotModal.id), {
        spotNom: spotNom.trim(), spotSlogan: spotSlogan.trim(), statutSpot: 'rempli',
      });
      // Notifier l'artiste que le fan a rempli son nom + slogan
      await envoyerNotification({
        to: spotModal.artistEmail, role:'artiste', type:'spot_rempli',
        text: `${spotModal.donateurName} a renseigné son nom (${spotNom.trim()}) à citer dans votre musique.`,
        createdAt: new Date().toISOString(),      });
      setSpotModal(null); setSpotNom(''); setSpotSlogan('');
    } catch(e) { console.error(e); }
  };

  // Ouvrir l'édition du profil (pré-remplir avec les valeurs actuelles)
  const ouvrirEditProfil = () => {
    setPseudoEdit(user?.displayName || '');
    setPhotoEdit(user?.photoURL || '');
    setEditProfil(true);
  };
  // Upload de la photo de profil sur Cloudinary
  const uploadPhotoProfil = async (f: File) => {
    setUploadPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) setPhotoEdit(data.secure_url);
    } catch(e) { console.error(e); }
    setUploadPhoto(false);
  };
  // Enregistrer le profil (pseudo + photo)
  const sauvegarderProfil = async () => {
    if (!user) return;
    setSavingProfil(true);
    try {
      await updateProfile(user, {
        displayName: pseudoEdit.trim() || user.displayName || '',
        photoURL: photoEdit || user.photoURL || '',
      });
      // Rafraîchir l'affichage local
      setUser({ ...user, displayName: pseudoEdit.trim(), photoURL: photoEdit });
      setEditProfil(false);
    } catch(e) { console.error(e); }
    setSavingProfil(false);
  };

  const envoyerProjet = async () => {
    if (!projetForm.nom || !projetForm.whatsapp) return;
    await addDoc(collection(db,'demandes_production'), {
      ...projetForm, userId: user?.uid, email: user?.email,
      statut: 'en_attente', createdAt: new Date().toISOString(),
    });
    setProjetSent(true);
  };
  // "Projet créatif" en attente (Pour bientôt) — variables conservées pour réactivation
  void showProjet; void setShowProjet; void projetSent; void projetForm; void setProjetForm; void envoyerProjet;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'#4a5878' }}>Chargement...</p>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:100 }}>
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 20px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <Logo size="sm" />
        <IconeScannerBouton onClick={() => setShowScanner(true)} />
      </div>
      {showScanner && <ScannerQR onClose={() => setShowScanner(false)} />}

      <div style={{ maxWidth:500, margin:'0 auto', padding:'24px 16px' }}>
        {/* Avatar + identité */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" style={{ width:84, height:84, borderRadius:99, border:'3px solid '+C.blue, marginBottom:12 }} />
          ) : (
            <div style={{ width:84, height:84, borderRadius:99, background:'linear-gradient(135deg,'+C.blue+',#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, fontWeight:800, color:'#fff', margin:'0 auto 12px', boxShadow:'0 6px 24px rgba(47,128,255,0.35)' }}>
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <p style={{ fontWeight:800, fontSize:20, marginBottom:4, color:'#fff' }}>{user?.displayName || 'Mélomane'}</p>
          <div style={{ display:'inline-block', padding:'4px 14px', borderRadius:99, background:'rgba(245,200,76,0.12)', border:'1px solid rgba(245,200,76,0.3)', marginBottom:6 }}>
            <span style={{ color:C.gold, fontSize:12, fontWeight:700 }}>Niveau {Math.max(1, Math.floor((likes + kiffements) / 10) + 1)}</span>
          </div>
          <p style={{ color:C.textSoft, fontSize:12, margin:'0 0 10px' }}>Membre depuis 2026</p>
          <button onClick={ouvrirEditProfil}
            style={{ padding:'7px 18px', borderRadius:99, border:'1px solid '+C.border, background:'rgba(255,255,255,0.05)', color:C.text, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            Modifier mon profil
          </button>
        </div>

        {/* VOTRE IMPACT */}
        <div style={{ marginBottom:16 }}>
          <p style={{ color:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10, paddingLeft:4 }}>Votre impact</p>
          <div style={{ display:'flex', gap:10 }}>
            {[
              { val:kiffsOfferts, lab:'Kiffs offerts', col:'#FF647C' },
              { val:kiffements, lab:'Kiffements', col:C.blueLite },
              { val:soldeOscart, lab:'Oscart', col:C.gold },
            ].map((s,i) => (
              <div key={i} style={{ flex:1, background:C.card, border:'1px solid '+C.border, borderRadius:14, padding:'14px 8px', textAlign:'center' }}>
                <p style={{ fontWeight:900, fontSize:24, color:s.col, margin:0, lineHeight:1 }}>{s.val}</p>
                <p style={{ color:C.textSoft, fontSize:10, margin:'5px 0 0' }}>{s.lab}</p>
              </div>
            ))}
          </div>
        </div>

        {/* MES SIGNATURES */}
        {mesSignatures.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ color:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10, paddingLeft:4 }}>Mes signatures</p>
            {mesSignatures.map(sig => {
              const meta = SIGNATURES.find(x => x.id === sig.type);
              const couleur = meta?.color || C.gold;
              return (
                <div key={sig.id} style={{ background:C.card, border:`1px solid ${couleur}44`, borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    {meta?.image && <img src={meta.image} alt="" style={{ width:32, height:32, objectFit:'contain' }} />}
                    <div style={{ flex:1 }}>
                      <p style={{ color:'#fff', fontWeight:800, fontSize:14, margin:0 }}>{sig.label}</p>
                      <p style={{ color:C.textSoft, fontSize:11, margin:'2px 0 0' }}>Offerte par {sig.artistName || 'un artiste'}</p>
                    </div>
                  </div>

                  {/* Dédicace vidéo → lecture */}
                  {sig.type === 'dedicace' && sig.mediaUrl && (
                    <video src={sig.mediaUrl} controls playsInline style={{ width:'100%', borderRadius:10, maxHeight:280 }} />
                  )}

                  {/* Accès VIP → date + infos */}
                  {sig.type === 'vip' && (
                    <div style={{ background:'rgba(245,200,76,0.08)', borderRadius:10, padding:'10px 12px' }}>
                      {sig.date && <p style={{ color:C.gold, fontSize:13, fontWeight:700, margin:'0 0 4px' }}>Date : {new Date(sig.date).toLocaleDateString('fr', { day:'2-digit', month:'long', year:'numeric' })}</p>}
                      {sig.details && <p style={{ color:C.text, fontSize:12, lineHeight:1.5, margin:0 }}>{sig.details}</p>}
                    </div>
                  )}

                  {/* Dans son clip → présentiel (date) ou challenge (bouton) */}
                  {sig.type === 'clip' && sig.sousType === 'presentiel' && (
                    <div style={{ background:'rgba(0,200,83,0.08)', borderRadius:10, padding:'10px 12px' }}>
                      {sig.date && <p style={{ color:'#00c853', fontSize:13, fontWeight:700, margin:'0 0 4px' }}>Tournage le {new Date(sig.date).toLocaleDateString('fr', { day:'2-digit', month:'long', year:'numeric' })}</p>}
                      {sig.details && <p style={{ color:C.text, fontSize:12, lineHeight:1.5, margin:0 }}>{sig.details}</p>}
                    </div>
                  )}
                  {sig.type === 'clip' && sig.sousType === 'challenge' && (
                    <div>
                      {sig.details && <p style={{ color:C.text, fontSize:12, lineHeight:1.5, margin:'0 0 10px', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>{sig.details}</p>}
                      <button onClick={() => { navigate(`/decouvrir?action=challenge&artiste=${encodeURIComponent(sig.artistEmail)}&sig=${sig.id}`); }}
                        style={{ width:'100%', padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#fb923c,#f0730c)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                        {sig.statutChallenge === 'realise' ? 'Challenge réalisé ✓' : 'Faire mon challenge'}
                      </button>
                    </div>
                  )}

                  {/* Signature Spot → formulaire nom+slogan à remplir */}
                  {sig.type === 'spot' && (
                    sig.statutSpot === 'rempli' ? (
                      <div style={{ background:'rgba(245,200,76,0.08)', borderRadius:10, padding:'10px 12px' }}>
                        <p style={{ color:C.gold, fontSize:13, fontWeight:700, margin:'0 0 2px' }}>Nom à chanter : {sig.spotNom}</p>
                        {sig.spotSlogan && <p style={{ color:C.text, fontSize:12, margin:0 }}>Slogan : {sig.spotSlogan}</p>}
                      </div>
                    ) : (
                      <button onClick={() => { setSpotModal(sig); setSpotNom(''); setSpotSlogan(''); }}
                        style={{ width:'100%', padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#F5C84C,#e0a800)', color:'#1a2340', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                        Indiquer mon nom à chanter
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <p style={{ color:C.textSoft, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10, paddingLeft:4 }}>Vos badges</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              { lab:'Premier soutien', ok: kiffements >= 1 },
              { lab:'Mélomane actif', ok: likes >= 5 },
              { lab:'Découvreur', ok: likes >= 20 },
              { lab:'Ambassadeur', ok: kiffements >= 10 },
            ].map((b,i) => (
              <div key={i} style={{ padding:'8px 14px', borderRadius:99, background: b.ok ? 'rgba(0,196,140,0.12)' : 'rgba(255,255,255,0.03)', border:'1px solid '+(b.ok ? 'rgba(0,196,140,0.3)' : C.border), opacity: b.ok ? 1 : 0.45 }}>
                <span style={{ color: b.ok ? C.success : C.textSoft, fontSize:12, fontWeight:600 }}>{b.lab}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PORTEFEUILLE OSCART — carte premium */}
        <div style={{
          position:'relative', borderRadius:20, padding:'22px 22px 20px', marginBottom:16, overflow:'hidden',
          background:'linear-gradient(135deg, #1e2d4d 0%, #16223c 60%, #111b30 100%)',
          border:'1px solid rgba(245,200,76,0.3)',
          boxShadow:'0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)'
        }}>
          {/* reflets lumineux */}
          <div style={{ position:'absolute', top:-60, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,200,76,0.2), transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-80, left:-50, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle, rgba(47,128,255,0.18), transparent 70%)', pointerEvents:'none' }} />

          <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <img src={COIN_OSCART_SYMBOLE} alt="" style={{ width:30, height:30 }} />
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:600, letterSpacing:0.5 }}>Mon portefeuille</span>
            </div>
            <button onClick={() => setRechargeModalProfil(RECHARGES[1])}
              style={{ padding:'8px 16px', borderRadius:99, border:'none', background:'linear-gradient(135deg,#F5C84C,#e0b03a)', color:'#1a1208', fontSize:12, fontWeight:800, cursor:'pointer', boxShadow:'0 2px 10px rgba(245,200,76,0.35)' }}>
              Recharger
            </button>
          </div>

          {/* CHIFFRE GÉANT */}
          <div style={{ position:'relative', marginTop:18 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <span style={{ fontWeight:900, fontSize:52, color:'#fff', lineHeight:1, letterSpacing:-1 }}>{soldeOscart}</span>
              <span style={{ fontWeight:800, fontSize:18, color:'#F5C84C', letterSpacing:1 }}>OSCART</span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:13, margin:'6px 0 0' }}>&#8776; {(soldeOscart * 10).toLocaleString()} FCFA</p>
          </div>

          {/* Kiffs disponibles */}
          <div style={{ position:'relative', marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color:'#FF647C', fontSize:14, fontWeight:700 }}>&#9829; {kiffsDispo.toLocaleString()} kiffs disponibles</span>
          </div>
        </div>

        {/* Modal recharge profil */}
        {/* MODAL — édition du profil (photo + pseudo) */}
        {editProfil && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
            onClick={() => setEditProfil(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'#fff', borderRadius:18, padding:'22px 20px', width:'100%', maxWidth:400 }}>
              <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', margin:'0 0 16px' }}>Modifier mon profil</p>

              {/* Photo */}
              <div style={{ textAlign:'center', marginBottom:16 }}>
                <label style={{ cursor:'pointer', display:'inline-block' }}>
                  {photoEdit ? (
                    <img src={photoEdit} alt="" style={{ width:90, height:90, borderRadius:99, objectFit:'cover', border:'3px solid #1a6bff' }} />
                  ) : (
                    <div style={{ width:90, height:90, borderRadius:99, background:'linear-gradient(135deg,#1a6bff,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, fontWeight:800, color:'#fff', margin:'0 auto' }}>
                      {pseudoEdit?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => e.target.files?.[0] && uploadPhotoProfil(e.target.files[0])} />
                </label>
                <p style={{ color:'#1a6bff', fontSize:12, fontWeight:600, marginTop:8 }}>{uploadPhoto ? 'Upload...' : 'Toucher pour changer la photo'}</p>
              </div>

              {/* Pseudo */}
              <label style={{ display:'block', color:'#5a7090', fontSize:12, fontWeight:700, marginBottom:6 }}>Pseudonyme</label>
              <input value={pseudoEdit} onChange={e => setPseudoEdit(e.target.value)}
                placeholder="Votre nom d'affichage"
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #d0d8e8', fontSize:14, marginBottom:16, boxSizing:'border-box' as any }} />

              <button onClick={sauvegarderProfil} disabled={savingProfil || uploadPhoto}
                style={{ width:'100%', padding:13, borderRadius:10, border:'none', background:'linear-gradient(135deg,#1a6bff,#4da6ff)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                {savingProfil ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditProfil(false)}
                style={{ width:'100%', marginTop:8, padding:11, borderRadius:10, border:'1px solid #dce6f7', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* MODAL — formulaire Signature Spot (nom + slogan) */}
        {spotModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
            onClick={() => setSpotModal(null)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'#fff', borderRadius:18, padding:'22px 20px', width:'100%', maxWidth:400 }}>
              <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', margin:'0 0 4px' }}>Votre nom dans la musique</p>
              <p style={{ color:'#8098b8', fontSize:13, margin:'0 0 16px', lineHeight:1.5 }}>
                {spotModal.artistName} va citer votre nom dans une prochaine musique. Indiquez le nom et le slogan à chanter.
              </p>
              <label style={{ display:'block', color:'#5a7090', fontSize:12, fontWeight:700, marginBottom:6 }}>Nom à chanter *</label>
              <input value={spotNom} onChange={e => setSpotNom(e.target.value)}
                placeholder="Ex : Guy le Boss"
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #d0d8e8', fontSize:14, marginBottom:12, boxSizing:'border-box' as any }} />
              <label style={{ display:'block', color:'#5a7090', fontSize:12, fontWeight:700, marginBottom:6 }}>Slogan (optionnel)</label>
              <input value={spotSlogan} onChange={e => setSpotSlogan(e.target.value)}
                placeholder="Ex : Le patron du game"
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #d0d8e8', fontSize:14, marginBottom:16, boxSizing:'border-box' as any }} />
              <button onClick={envoyerSpot} disabled={!spotNom.trim()}
                style={{ width:'100%', padding:13, borderRadius:10, border:'none', background: spotNom.trim() ? 'linear-gradient(135deg,#F5C84C,#e0a800)' : '#e0e0e0', color:'#1a2340', fontWeight:800, fontSize:14, cursor: spotNom.trim()?'pointer':'default' }}>
                Envoyer à l'artiste
              </button>
              <button onClick={() => setSpotModal(null)}
                style={{ width:'100%', marginTop:8, padding:11, borderRadius:10, border:'1px solid #dce6f7', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {rechargeModalProfil && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setRechargeModalProfil(null)}>
            <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
              <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:6 }}>Recharger {rechargeModalProfil.oscart} Oscart</p>
              <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
                Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
              </p>
              <button onClick={async () => {
                const err = await lancerPaiementGeniusPay(rechargeModalProfil.oscart, rechargeModalProfil.fcfa);
                if (err) alert(err);
              }}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                Payer {rechargeModalProfil.fcfa.toLocaleString()} F CFA
              </button>
              <button onClick={() => setRechargeModalProfil(null)}
                style={{ width:'100%', padding:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:16, textAlign:'center' }}>
            <p style={{ fontWeight:900, fontSize:24, color:'#f04a6a', marginBottom:4 }}>{kiffsOfferts.toLocaleString()}</p>
            <p style={{ color:'#4a5878', fontSize:12 }}>Kiffs offerts</p>
          </div>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:16, textAlign:'center' }}>
            <p style={{ fontWeight:900, fontSize:24, color:'#ffd700', marginBottom:4 }}>{kiffements}</p>
            <p style={{ color:'#4a5878', fontSize:12 }}>Kiffements envoyés</p>
          </div>
        </div>

        {/* PROJET CRÉATIF — en attente (Pour bientôt) */}
        <div style={{ background:'rgba(30,111,255,0.06)', border:'1px solid rgba(30,111,255,0.2)', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
          <p style={{ fontWeight:800, fontSize:15, color:'#4da6ff', marginBottom:6 }}>Vous avez un projet créatif ?</p>
          <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.6, marginBottom:14 }}>
            Vous êtes artiste, humoriste, réalisateur ou scénariste mais vous n'avez pas les moyens de produire ? Doniel Zik peut vous aider à produire et promouvoir votre contenu.
          </p>
          <div style={{ width:'100%', padding:12, borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#8098b8', fontWeight:700, fontSize:14, textAlign:'center' }}>
            Pour bientôt
          </div>
        </div>

        {/* Accès direct au tableau de bord artiste, si ce compte est aussi un artiste validé */}
        {estArtiste && (
          <a href="/artiste"
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'14px 16px', borderRadius:14, marginBottom:16, textDecoration:'none',
              background:'linear-gradient(135deg, rgba(26,107,255,0.15), rgba(93,63,255,0.15))', border:'1px solid rgba(93,132,255,0.3)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:36, height:36, borderRadius:99, background:'rgba(93,132,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5d84ff" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </span>
              <span style={{ color:'#dde4f5', fontSize:14, fontWeight:700 }}>Mon tableau de bord artiste</span>
            </span>
            <span style={{ color:'#5d84ff', fontSize:18 }}>›</span>
          </a>
        )}

        {/* INFORMATIONS */}
        <div style={{ marginBottom:16 }}>
          <p style={{ color:'#4a5878', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:8, paddingLeft:4 }}>Informations</p>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:14, overflow:'hidden' }}>
            {[
              { label:'À propos de Doniel Zik', path:'/apropos' },
              { label:"Conditions d'utilisation", path:'/conditions' },
              { label:'Confidentialité', path:'/privacy' },
            ].map((it, i) => (
              <a key={it.path} href={it.path}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', textDecoration:'none', color:'#dde4f5', fontSize:14, borderTop: i>0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span>{it.label}</span>
                <span style={{ color:'#4a5878', fontSize:18 }}>›</span>
              </a>
            ))}
          </div>
        </div>

        {/* Déconnexion */}
        <button onClick={() => signOut(auth).then(() => window.location.href = '/')}
          style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(240,74,106,0.3)', background:'rgba(240,74,106,0.08)', color:'#f04a6a', fontWeight:700, fontSize:14, cursor:'pointer' }}>
          Se déconnecter
        </button>
      </div>

      {/* BARRE NAVIGATION */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(11,15,30,0.98)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-around', padding:'10px 0 14px', zIndex:99 }}>
        {[
          { label:'Accueil', path:'/', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { label:'Découvrir', path:'/decouvrir', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { label:'Challenge', path:'/challenge', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
          { label:'Notifs', path:'/notifications', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { label:'Profil', path:'/profil', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: window.location.pathname === item.path ? '#4da6ff' : '#4a5878' }}>
            <span style={{ position:'relative', display:'inline-flex' }}>
              {item.svg}
              {item.path === '/notifications' && <BadgeNotif />}
            </span>
            <span style={{ fontSize:10, fontWeight:600 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ResponsablePage() {
  const [view, setView] = useState<'login'|'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'stats'|'enregistrer'|'demandes'|'equipe'>('stats');
  const [respMode, setRespMode] = useState<'login'|'inscription'>('login');
  const [respNom, setRespNom] = useState('');
  const [respTel, setRespTel] = useState('');
  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [allArtistes, setAllArtistes] = useState<any[]>([]);
  const [allMarchands, setAllMarchands] = useState<any[]>([]);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u && RESPONSABLES_AUTORISES.includes((u.email||'').toLowerCase())) {
        setUser(u); setView('dashboard');
      } else {
        setUser(null); setView('login');
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Tous les commerciaux : en attente (sans responsable) + les siens
    const u1 = onSnapshot(
      query(collection(db, 'commerciaux')),
      snap => setCommerciaux(snap.docs.map(d => ({id:d.id,...d.data()})).filter((c:any) =>
        c.status === 'en_attente' || c.responsableEmail === user.email
      ))
    );
    // Artistes liés aux commerciaux de ce responsable
    const u2 = onSnapshot(
      query(collection(db, 'artists'), where('responsableEmail','==', user.email)),
      snap => setAllArtistes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    // Marchands liés aux commerciaux de ce responsable
    const u3 = onSnapshot(
      query(collection(db, 'annonceurs'), where('responsableEmail','==', user.email), orderBy('createdAt','desc')),
      snap => setAllMarchands(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const login = async () => {
    setLoading(true); setMsg('');
    if (!RESPONSABLES_AUTORISES.includes(email.trim().toLowerCase())) {
      setMsg('Cet email n\'est pas autorisé comme responsable commercial.');
      setLoading(false); return;
    }
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  // Commissions responsable = 10% de ce que gagnent ses commerciaux
  // Commerciaux gagnent : 10 000 F/artiste actif + résidu 10% + 10% marchands
  const artistesActifs = allArtistes.filter(a => {
    const vues = a.buzz || a.vues || 0;
    return vues >= 5000 || (a.downloads||0) >= 30 || (a.cadeaux||0) >= 2000 || (a.partages||0) >= 1000;
  });
  const commArtistes = Math.round(artistesActifs.length * 10000 * 0.10);
  const residu = Math.round(allArtistes.reduce((s,a) => {
    const part = (a.downloads||0)*(a.prixDL||500)*0.30 + (a.pochettes||0)*150 + (a.cadeaux||0)*10*0.30;
    return s + part * 0.10 * 0.10;
  }, 0));
  const commPub = Math.round(allMarchands.reduce((s,m) => s + ((m.cout||0) * 0.10 * 0.10), 0));
  const totalCommissions = commArtistes + residu + commPub;

  if (view === 'login') return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Logo size="lg" />
          <p style={{ color:'#1a6bff', fontWeight:700, fontSize:14, marginTop:8 }}>Espace Responsable Commercial</p>
        </div>
        <div style={S.card}>
          {respMode === 'inscription' ? (
            <>
              <p style={{ fontWeight:700, fontSize:15, marginBottom:14, textAlign:'center' }}>Créer mon compte responsable</p>
              <label style={S.lbl}>Nom complet *</label>
              <input style={S.inp} value={respNom} onChange={e => setRespNom(e.target.value)} placeholder="Prénom Nom" />
              <label style={S.lbl}>Email *</label>
              <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
              <label style={S.lbl}>Téléphone</label>
              <input style={S.inp} type="tel" value={respTel} onChange={e => setRespTel(e.target.value)} placeholder="+225 07 00 00 00 00" />
              <label style={S.lbl}>Mot de passe *</label>
              <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 caractères" />
              {msg && <p style={{ color: msg.startsWith('')?'#00a040':'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
              <button style={{ ...S.btn, width:'100%', padding:14 }} disabled={loading} onClick={async () => {
                if (!respNom || !email || !password) { setMsg('Nom, email et mot de passe requis'); return; }
                if (password.length < 6) { setMsg('Mot de passe : minimum 6 caractères'); return; }
                if (!RESPONSABLES_AUTORISES.includes(email.trim().toLowerCase())) {
                  setMsg('Cet email n\'est pas autorisé à devenir responsable commercial.');
                  return;
                }
                setLoading(true); setMsg('');
                try {
                  let uid = '';
                  try {
                    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
                    uid = cred.user.uid;
                  } catch(e:any) {
                    if (e.code === 'auth/email-already-in-use') {
                      // Compte existe déjà (ex: mélomane) → se connecter pour récupérer l'uid
                      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
                      uid = cred.user.uid;
                    } else throw e;
                  }
                  // Enregistrer comme responsable
                  const existing = await getDocs(query(collection(db,'responsables'), where('email','==',email.trim().toLowerCase())));
                  if (existing.empty) {
                    await addDoc(collection(db,'responsables'), {
                      uid, nom: respNom, email: email.trim().toLowerCase(), telephone: respTel,
                      status: 'actif', createdAt: new Date().toISOString(), commerciauxCount: 0,
                    });
                  }
                  setMsg('Compte créé !');
                } catch(e:any) {
                  setMsg(e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
                    ? 'Cet email a déjà un compte avec un autre mot de passe. Utilisez ce mot de passe ou "Se connecter".'
                    : 'Erreur : ' + e.message);
                }
                setLoading(false);
              }}>
                {loading ? '...' : 'Créer mon compte'}
              </button>
              <button onClick={() => { setRespMode('login'); setMsg(''); }}
                style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'#8098b8', cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:8 }}>
                J'ai déjà un compte — Se connecter
              </button>
            </>
          ) : (
            <>
              <label style={S.lbl}>Email</label>
              <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" onKeyDown={e => e.key==='Enter' && login()} />
              <label style={S.lbl}>Mot de passe</label>
              <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key==='Enter' && login()} />
              {msg && <p style={{ color: msg.startsWith('')?'#00a040':'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
              <button style={{ ...S.btn, width:'100%', padding:14 }} onClick={login} disabled={loading}>
                {loading ? '...' : 'Se connecter'}
              </button>
              <button onClick={() => { setRespMode('inscription'); setMsg(''); }}
                style={{ width:'100%', padding:12, marginTop:10, borderRadius:10, border:'1px solid #1a6bff', background:'rgba(26,107,255,0.05)', color:'#1a6bff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Première fois ? Créer mon compte
              </button>

              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0' }}>
                <div style={{ flex:1, height:1, background:'#dce6f7' }} />
                <span style={{ color:'#8098b8', fontSize:11 }}>ou</span>
                <div style={{ flex:1, height:1, background:'#dce6f7' }} />
              </div>

              <button onClick={async () => {
                setLoading(true); setMsg('');
                try {
                  const provider = new GoogleAuthProvider();
                  const cred = await signInWithPopup(auth, provider);
                  if (!RESPONSABLES_AUTORISES.includes((cred.user.email||'').toLowerCase())) {
                    await signOut(auth);
                    setMsg('Ce compte n\'est pas autorisé comme responsable commercial.');
                    setLoading(false); return;
                  }
                  // Vérifier ou créer le responsable
                  const existing = await getDocs(query(collection(db,'responsables'), where('email','==', cred.user.email)));
                  if (existing.empty) {
                    await addDoc(collection(db,'responsables'), {
                      uid: cred.user.uid, nom: cred.user.displayName || cred.user.email,
                      email: cred.user.email, telephone: '',
                      status: 'actif', createdAt: new Date().toISOString(), commerciauxCount: 0,
                    });
                  }
                } catch(e:any) { setMsg('Erreur connexion Google : ' + e.message); }
                setLoading(false);
              }} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid #dce6f7', background:'#fff', color:'#1a2340', cursor:'pointer', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </button>

              <button onClick={async () => {
                if (!email) { setMsg('Entrez votre email d\'abord'); return; }
                try { const r = await demanderResetPassword(email); if (r.ok) setMsg('Email de réinitialisation envoyé'); else setMsg('Erreur : ' + (r.error||'')); }
                catch { setMsg('Email introuvable'); }
              }} style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'#8098b8', cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:4 }}>
                Mot de passe oublié ?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ ...S.bg, minHeight:'100vh' }}>
      {/* HEADER */}
      <div style={{ background:'#fff', borderBottom:'1px solid #dce6f7', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Logo size="sm" />
          <div>
            <p style={{ fontWeight:700, fontSize:13, color:'#1a6bff', margin:0 }}>Responsable Commercial</p>
            <p style={{ color:'#8098b8', fontSize:10, margin:0 }}>{user?.email}</p>
          </div>
        </div>
        <button style={S.btn2} onClick={() => signOut(auth)}>Déco</button>
      </div>

      {/* TABS */}
      <div style={{ borderBottom:'1px solid #dce6f7', padding:'0 12px', display:'flex', background:'#fff', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        {[['stats','Stats'],['enregistrer','Enregistrer'],['demandes',`Demandes (${commerciaux.filter(c=>c.status==='en_attente').length})`],['equipe',`Mon équipe (${commerciaux.filter(c=>c.status!=='en_attente').length})`]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ padding:'12px 14px', border:'none', background:'transparent', color: tab===t?'#1a6bff':'#8098b8', cursor:'pointer', fontSize:13, fontWeight: tab===t?700:400, borderBottom:`2px solid ${tab===t?'#1a6bff':'transparent'}`, flexShrink:0, whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'20px 16px' }}>

        {/* REJOINDRE LE GROUPE WHATSAPP */}
        <a href={GROUPE_WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, background:'#25D366', boxShadow:'0 3px 14px rgba(37,211,102,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.961z"/></svg>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontWeight:800, fontSize:14, color:'#fff' }}>Rejoindre le groupe WhatsApp</p>
              <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.9)' }}>Échangez avec l'équipe et recevez les actualités</p>
            </div>
            <span style={{ fontSize:18, color:'#fff' }}>→</span>
          </div>
        </a>

        {/* ENREGISTRER UN ARTISTE */}
        {tab === 'enregistrer' && <EnregistrerArtisteTab commercialEmail={user.email} db={db} />}

        {/* STATS */}
        {tab === 'stats' && (
          <div>
            <div style={{ ...S.card, background:'linear-gradient(135deg,#eef9f0,#dbeede)', marginBottom:20 }}>
              <p style={{ fontWeight:800, fontSize:15, color:'#1a2340', margin:'0 0 6px' }}>Lien d'inscription artiste</p>
              <p style={{ color:'#5a7090', fontSize:12, margin:'0 0 10px', lineHeight:1.5 }}>Envoyez ce lien a un artiste : il s'inscrit lui-meme et son 1er contenu est offert.</p>
              <div style={{ background:'#fff', border:'1px solid #c8d8ef', borderRadius:10, padding:'8px 12px', marginBottom:10 }}>
                <span style={{ fontSize:12, color:'#1a6bff', wordBreak:'break-all', fontWeight:600 }}>{BASE_URL}/artiste?ref=responsable</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={() => { navigator.clipboard?.writeText(`${BASE_URL}/artiste?ref=responsable`); setMsg('Lien copie !'); }}
                  style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Copier le lien
                </button>
                <button onClick={() => { navigator.clipboard?.writeText(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=responsable`)); setMsg('Message copie !'); }}
                  style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, border:'1px solid #c8d8ef', background:'#fff', color:'#1a6bff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Copier le message
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=responsable`))}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, background:'#25D366', color:'#fff', fontWeight:700, fontSize:13, textAlign:'center', textDecoration:'none' }}>
                  WhatsApp
                </a>
              </div>
            </div>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:20 }}>Mes commissions</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { label:'Sur artistes actifs', val: commArtistes.toLocaleString()+' F', detail: artistesActifs.length+' actifs (10% des commerciaux)', color:'#1a6bff' },
                { label:'Prime résiduelle', val: residu.toLocaleString()+' F', detail: '10% des résidus commerciaux', color:'#00a040' },
                { label:'Sur marchands', val: commPub.toLocaleString()+' F', detail: '10% des commissions pub', color:'#b07a00' },
                { label:'Total équipe', val: allArtistes.length.toString(), detail: 'artistes recrutés', color:'#7c3aed' },
              ].map((s,i) => (
                <div key={i} style={S.card}>
                  <p style={{ color:s.color, fontWeight:900, fontSize:20, margin:'0 0 4px' }}>{s.val}</p>
                  <p style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{s.label}</p>
                  <p style={{ color:'#8098b8', fontSize:11 }}>{s.detail}</p>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, textAlign:'center', background:'linear-gradient(135deg,#eef4ff,#dce8ff)', padding:24, marginBottom:16 }}>
              <p style={{ color:'#8098b8', fontSize:12, marginBottom:4 }}>Total commissions estimées</p>
              <p style={{ color:'#1a6bff', fontWeight:900, fontSize:32, margin:0 }}>{totalCommissions.toLocaleString()} FCFA</p>
            </div>

            <div style={S.card}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Objectif recommandé</p>
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <p style={{ fontSize:13, fontWeight:600 }}>Commerciaux actifs</p>
                  <p style={{ fontSize:13, color:'#1a6bff', fontWeight:700 }}>{commerciaux.length}/50</p>
                </div>
                <div style={{ height:8, background:'#dce6f7', borderRadius:99 }}>
                  <div style={{ height:'100%', width: Math.min((commerciaux.length/50)*100, 100)+'%', background:'linear-gradient(90deg,#1a6bff,#4da6ff)', borderRadius:99, transition:'width .3s' }} />
                </div>
              </div>
              <p style={{ color:'#8098b8', fontSize:12 }}>
                Avec 50 commerciaux actifs qui atteignent leurs objectifs, vous pouvez générer <strong style={{ color:'#1a6bff' }}>1 550 000 FCFA/mois</strong>
              </p>
            </div>
            <ChangerMotDePasse />
          </div>
        )}

        {/* ÉQUIPE */}
        {tab === 'demandes' && (
          <div>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Demandes d'inscription</h2>
            <p style={{ color:'#8098b8', fontSize:12, marginBottom:20 }}>
              Commerciaux qui se sont inscrits et attendent votre validation.
            </p>
            {commerciaux.filter(c => c.status === 'en_attente').length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14 }}>Aucune demande en attente</p>
              </div>
            ) : commerciaux.filter(c => c.status === 'en_attente').map(c => (
              <div key={c.id} style={{ ...S.card, marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:99, background:'linear-gradient(135deg,#eaf1ff,#c8d8ef)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'#1a6bff' }}>
                    {(c.name||c.email)[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{c.name || c.email}</p>
                    <p style={{ color:'#8098b8', fontSize:11, margin:'2px 0 0' }}>{c.email}</p>
                    {c.telephone && <p style={{ margin:'2px 0 0' }}><WhatsAppLink numero={c.telephone} /></p>}
                  </div>
                </div>
                {/* Profilage */}
                {(c.methode || c.cible || c.objectif || c.commune) && (
                  <div style={{ background:'#f5f8ff', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
                    {c.commune && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 4px' }}><strong>Commune :</strong> {c.commune}</p>}
                    {c.methode && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 4px' }}><strong>Prospection :</strong> {c.methode}</p>}
                    {c.cible && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 4px' }}><strong>Cibles :</strong> {c.cible}</p>}
                    {c.objectif && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 4px' }}><strong>Objectif/mois :</strong> {c.objectif} créateurs</p>}
                  </div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={async () => {
                    await updateDoc(doc(db,'commerciaux',c.id), { status:'valide', responsableEmail: user.email });
                  }} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'#00a040', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    Valider
                  </button>
                  <button onClick={async () => {
                    if (window.confirm('Refuser ce commercial ?')) await updateDoc(doc(db,'commerciaux',c.id), { status:'refuse', responsableEmail: user.email });
                  }} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #f04a6a', background:'transparent', color:'#f04a6a', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'equipe' && (
          <div>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Mon équipe</h2>
            <p style={{ color:'#8098b8', fontSize:12, marginBottom:20 }}>
              Commerciaux validés sous votre supervision.
            </p>

            {commerciaux.filter(c => c.status !== 'en_attente' && c.status !== 'refuse').length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14 }}>Aucun commercial validé dans votre équipe</p>
              </div>
            ) : commerciaux.filter(c => c.status !== 'en_attente' && c.status !== 'refuse').map(c => {
              const artistes = allArtistes.filter(a => a.commercialEmail === c.email);
              const marchands = allMarchands.filter(m => m.commercialEmail === c.email);
              const commC = (artistes.length * 1000) +
                (artistes.reduce((s,a) => s + ((a.pochettes||0)*100), 0)) +
                (allMarchands.filter(m=>m.commercialEmail===c.email).reduce((s,m)=>s+(m.cout||0)*0.1,0));
              return (
                <div key={c.id} style={{ ...S.card, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ width:40, height:40, borderRadius:99, background:'linear-gradient(135deg,#eaf1ff,#c8d8ef)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{c.name || c.email}</p>
                      <p style={{ color:'#8098b8', fontSize:11, margin:'2px 0 0' }}>{c.email}</p>
                      {c.telephone && (
                        <a href={`https://wa.me/${(c.telephone||'').replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer"
                          style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#25D366', fontSize:11, fontWeight:700, textDecoration:'none', margin:'2px 0 0' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.961zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                          {c.telephone}
                        </a>
                      )}
                      {c.commune && <p style={{ color:'#1a6bff', fontSize:11, margin:0 }}>{c.commune}</p>}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ color:'#1a6bff', fontWeight:700, fontSize:13, margin:0 }}>+{Math.round(commC*0.1).toLocaleString()} F</p>
                      <p style={{ color:'#8098b8', fontSize:10 }}>votre commission</p>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      { label:'Artistes recrutés', val: artistes.length, color:'#1a6bff' },
                      { label:'Marchands recrutés', val: marchands.length, color:'#b07a00' },
                    ].map((s,i) => (
                      <div key={i} style={{ background:'#f5f8ff', borderRadius:8, padding:'8px', textAlign:'center' }}>
                        <p style={{ fontWeight:800, fontSize:18, color:s.color, margin:0 }}>{s.val}</p>
                        <p style={{ color:'#8098b8', fontSize:10, margin:'2px 0 0' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE INSCRIPTION COMMERCIAL — /commercial/inscription
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ENREGISTRER ARTISTE — depuis dashboard commercial
// Tarification : Single 5K / Album 15K / Vidéo 5K / Saison 25K
// Commission : 20% du prix
// ─────────────────────────────────────────────
function EnregistrerArtisteTab({ commercialEmail, db }: { commercialEmail: string, db: any }) {
  const TARIFS = [
    { type:'single', label:'Single audio', desc:'1 titre audio' },
    { type:'album', label:'Album audio', desc:'Plusieurs titres audio' },
    { type:'video', label:'Vidéo solo', desc:'1 clip vidéo · court-métrage · film découpé 3 min' },
    { type:'saison', label:'Série complète', desc:'Série complète · épisodes de 3 min' },
  ];

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [typeContenu, setTypeContenu] = useState('');
  const [titreContenu, setTitreContenu] = useState('');
  const [categorieContenu, setCategorieContenu] = useState('autres');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [conditionsOK, setConditionsOK] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<any>(null);

  const tarif = TARIFS.find(t => t.type === typeContenu);
  const estVideoType = typeContenu === 'video' || typeContenu === 'saison';

  const uploadContenu = async (f: File) => {
    setUploadingFile(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) { setFileUrl(data.secure_url); setMsg('Contenu ajouté.'); }
      else setMsg('Erreur upload du contenu.');
    } catch { setMsg('Erreur upload du contenu.'); }
    setUploadingFile(false);
  };

  const submit = async () => {
    if (!nom || !email || !whatsapp || !typeContenu) { setMsg('Tous les champs sont requis (dont le WhatsApp)'); return; }
    if (!titreContenu.trim()) { setMsg('Indiquez le titre du contenu'); return; }
    if (!fileUrl) { setMsg('Ajoutez le fichier du contenu (musique ou vidéo)'); return; }
    setLoading(true); setMsg('');
    try {
      // Vérifier si email déjà enregistré
      const existing = await getDocs(query(collection(db, 'artists'), where('email','==', email.trim().toLowerCase())));
      if (existing.empty) {
        // Créer la fiche artiste (compte créé automatiquement quand l'artiste se connectera avec cet email)
        await addDoc(collection(db, 'artists'), {
          name: nom.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          commercialEmail,
          typeContenu,
          statut: 'actif',
          createdAt: new Date().toISOString(),
        });
      }

      // Créer la SOUMISSION du contenu → validation par l'admin (lien d'écoute)
      await addDoc(collection(db, 'soumissions'), {
        artistEmail: email.trim().toLowerCase(),
        artistName: nom.trim(),
        titre: titreContenu.trim(),
        type: typeContenu === 'single' ? 'single' : typeContenu === 'album' ? 'album' : typeContenu === 'video' ? 'video' : 'serie',
        categorie: categorieContenu,
        fileUrl,
        parCommercial: commercialEmail,
        statut: 'en_attente',
        createdAt: new Date().toISOString(),
      });

      // Notifier l'admin
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type:'soumission',
        text: `${commercialEmail} a enregistré "${titreContenu.trim()}" pour l'artiste ${nom.trim()}. À écouter et valider.`,
        lien: fileUrl, createdAt: new Date().toISOString(),      });

      setDone({ nom: nom.trim(), email: email.trim(), titre: titreContenu.trim(), tarif });
      setNom(''); setEmail(''); setWhatsapp(''); setTypeContenu(''); setTitreContenu(''); setCategorieContenu('autres'); setFileUrl('');
    } catch(e:any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Enregistrer un artiste</h2>
      <p style={{ color:'#8098b8', fontSize:13, marginBottom:20, lineHeight:1.6 }}>
        Enregistrez l'artiste et son contenu. Le contenu sera écouté et validé par notre équipe avant publication.
      </p>

      {done && (
        <div style={{ ...S.card, background:'#eaffea', border:'1px solid #4dff9a', marginBottom:20 }}>
          <p style={{ fontWeight:800, fontSize:15, color:'#00a040', margin:'0 0 6px' }}>Enregistré avec succès !</p>
          <p style={{ color:'#5a7090', fontSize:13, margin:'0 0 4px' }}><strong>{done.nom}</strong> — {done.email}</p>
          <p style={{ color:'#5a7090', fontSize:13, margin:'0 0 4px' }}>Contenu : « {done.titre} »</p>
          <p style={{ color:'#8098b8', fontSize:11, marginTop:8 }}>Le contenu a été soumis pour validation. Une fois validé, l'artiste recevra son lien et son QR public dans son compte (accessible avec son email).</p>
          <button onClick={() => setDone(null)} style={{ ...S.btn2, marginTop:10 }}>Enregistrer un autre artiste</button>
        </div>
      )}

      {!done && (
        <div style={S.card}>
          <label style={S.lbl}>Nom de l'artiste *</label>
          <input style={S.inp} value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom d'artiste ou nom réel" />

          <label style={S.lbl}>Email de l'artiste *</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="artiste@email.com" />

          <label style={S.lbl}>Numéro WhatsApp de l'artiste *</label>
          <input style={S.inp} type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="Ex: +225 07 00 00 00 00" />

          <label style={S.lbl}>Type de contenu *</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {TARIFS.map(t => (
              <button key={t.type} onClick={() => setTypeContenu(t.type)}
                style={{ padding:'14px 10px', borderRadius:12, border:`2px solid ${typeContenu===t.type?'#1a6bff':'#dce6f7'}`, background: typeContenu===t.type?'#eaf1ff':'#fff', cursor:'pointer', textAlign:'left', transition:'all .2s' }}>
                <p style={{ fontWeight:700, fontSize:13, color: typeContenu===t.type?'#1a6bff':'#1a2340', margin:'0 0 2px' }}>{t.label}</p>
                <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{t.desc}</p>
              </button>
            ))}
          </div>

          <label style={S.lbl}>Titre du contenu *</label>
          <input style={S.inp} value={titreContenu} onChange={e => setTitreContenu(e.target.value)} placeholder="Ex: Nom de l'artiste — Titre (feat. ...)" />

          <label style={S.lbl}>Catégorie *</label>
          <select style={S.inp} value={categorieContenu} onChange={e => setCategorieContenu(e.target.value)}>
            {(estVideoType ? CATEGORIES_VIDEO : CATEGORIES_AUDIO).filter((c:any) => c.id !== 'tous').map((c:any) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <label style={S.lbl}>Fichier du contenu ({estVideoType ? 'vidéo' : 'audio'}) *</label>
          <input type="file" accept={estVideoType ? 'video/*' : 'audio/*'}
            onChange={e => e.target.files?.[0] && uploadContenu(e.target.files[0])}
            style={{ ...S.inp, padding:8 }} />
          {uploadingFile && <p style={{ color:'#1a6bff', fontSize:12 }}>Upload en cours...</p>}
          {fileUrl && <p style={{ color:'#00a040', fontSize:12 }}>✓ Contenu ajouté</p>}

          {msg && <p style={{ color: msg.includes('ajouté')||msg.includes('Contenu ajouté') ? '#00a040':'#f04a6a', fontSize:12, margin:'10px 0' }}>{msg}</p>}

          {showConditions && <DocumentLegalModal titre="Conditions d'enregistrement de l'artiste" articles={CONDITIONS_ARTISTE} onClose={() => setShowConditions(false)} />}

          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', margin:'14px 0', padding:'12px', background:'#f5f8ff', borderRadius:10, border:'1px solid #dce6f7' }}>
            <input type="checkbox" checked={conditionsOK} onChange={e => setConditionsOK(e.target.checked)} style={{ marginTop:3 }} />
            <span style={{ fontSize:12, color:'#3a4860', lineHeight:1.5 }}>
              L'artiste a été informé et accepte les{' '}
              <span onClick={(e) => { e.preventDefault(); setShowConditions(true); }} style={{ color:'#1a6bff', fontWeight:700, textDecoration:'underline' }}>conditions d'enregistrement</span>{' '}
              de Doniel Zik.
            </span>
          </label>

          <button onClick={submit} disabled={loading || uploadingFile || !typeContenu || !conditionsOK}
            style={{ ...S.btn, width:'100%', padding:14, marginTop:8, opacity: (typeContenu && conditionsOK)?1:0.5 }}>
            {loading ? 'Enregistrement...' : 'Enregistrer le contenu'}
          </button>

          <div style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:10, padding:'10px 14px', marginTop:14 }}>
            <p style={{ color:'#b07a00', fontSize:11, lineHeight:1.7, margin:0 }}>
              Le contenu sera écouté et validé par notre équipe. Une fois validé, l'artiste recevra son lien et son QR public dans son compte (accessible avec son email).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CommercialPage() {
  const [view, setView] = useState<'login'|'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'stats'|'enregistrer'|'artistes'|'marchands'>('stats');
  const [artistes, setArtistes] = useState<any[]>([]);
  const [marchands, setMarchands] = useState<any[]>([]);
  const [mode, setMode] = useState<'login'|'inscription'>('login');
  const [inscStep, setInscStep] = useState(1);
  const [inscNom, setInscNom] = useState('');
  const [inscEmail, setInscEmail] = useState('');
  const [inscTel, setInscTel] = useState('');
  const [inscCommune, setInscCommune] = useState('');
  const [inscPass, setInscPass] = useState('');
  const [inscMethode, setInscMethode] = useState('');
  const [inscCible, setInscCible] = useState('');
  const [inscObjectif, setInscObjectif] = useState('');
  const [contratAccepte, setContratAccepte] = useState<boolean|null>(null);
  const [showContrat, setShowContrat] = useState(false);
  const [monDocId, setMonDocId] = useState('');

  // Vérifier si le contrat est accepté
  useEffect(() => {
    if (!user?.email) return;
    getDocs(query(collection(db,'commerciaux'), where('email','==',user.email.toLowerCase()))).then(snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setMonDocId(d.id);
        setContratAccepte(d.data().contratAccepte === true);
      } else {
        setContratAccepte(true); // pas de fiche = ne pas bloquer
      }
    }).catch(() => setContratAccepte(true));
  }, [user?.email]);

  const accepterContrat = async () => {
    if (monDocId) {
      await updateDoc(doc(db,'commerciaux',monDocId), { contratAccepte: true, contratAccepteLe: new Date().toISOString() });
    }
    setContratAccepte(true); setShowContrat(false);
  };

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setView('dashboard'); }
      else { setUser(null); setView('login'); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Artistes recrutés par ce commercial
    const u1 = onSnapshot(
      query(collection(db, 'artists'), where('commercialEmail','==', user.email)),
      snap => setArtistes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    // Marchands recrutés par ce commercial
    const u2 = onSnapshot(
      query(collection(db, 'annonceurs'), where('commercialEmail','==', user.email), orderBy('createdAt','desc')),
      snap => setMarchands(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { u1(); u2(); };
  }, [user]);

  const login = async () => {
    setLoading(true); setMsg('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDocs(query(collection(db, 'commerciaux'), where('email','==', cred.user.email)));
      if (snap.empty) {
        await signOut(auth);
        setMsg('Cet email n\'est pas enregistré comme commercial.');
      } else {
        const statut = snap.docs[0].data().status;
        if (statut === 'en_attente') {
          await signOut(auth);
          setMsg('Votre compte est en attente de validation par votre responsable.');
        } else if (statut === 'refuse') {
          await signOut(auth);
          setMsg('Votre demande n\'a pas été acceptée.');
        }
      }
    } catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  // Calcul commissions — nouvelle structure
  // 1. Artistes actifs : 10 000 F par artiste actif
  // 2. Résidu mensuel : 10% des revenus générés par les artistes
  // 3. Marchands : 10% du CA publicité
  const artistesActifs = artistes.filter(a => {
    const vues = a.buzz || a.vues || 0;
    const dl = a.downloads || 0;
    const cad = a.cadeaux || 0;
    const parts = a.partages || 0;
    return vues >= 5000 || dl >= 30 || cad >= 2000 || parts >= 1000; // critère artiste actif
  });
  const commArtistes = artistesActifs.length * 10000;
  // Résidu : 10% de la part plateforme (téléchargements 30%, pochettes 150F, cadeaux 30%)
  const residu = Math.round(artistes.reduce((s,a) => {
    const partDL = (a.downloads||0) * (a.prixDL||500) * 0.30;
    const partPoch = (a.pochettes||0) * 150;
    const partCad = (a.cadeaux||0) * 10 * 0.30;
    return s + (partDL + partPoch + partCad) * 0.10;
  }, 0));
  const commPub = Math.round(marchands.reduce((s,m) => s + ((m.cout||0) * 0.10), 0));
  const totalCommissions = commArtistes + residu + commPub;

  if (view === 'login') return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Logo size="lg" />
          <p style={{ color:'#1a6bff', fontWeight:700, fontSize:14, marginTop:8 }}>Espace Commercial</p>
        </div>
        <div style={S.card}>
          {mode === 'inscription' ? (
            <>
              <p style={{ fontWeight:700, fontSize:15, marginBottom:4, textAlign:'center' }}>Devenir commercial DZ TEAM</p>
              <p style={{ color:'#8098b8', fontSize:11, textAlign:'center', marginBottom:16 }}>Étape {inscStep}/3</p>

              {/* ÉTAPE 1 — Identité */}
              {inscStep === 1 && (
                <>
                  <label style={S.lbl}>Nom complet *</label>
                  <input style={S.inp} value={inscNom} onChange={e => setInscNom(e.target.value)} placeholder="Prénom Nom" />
                  <label style={S.lbl}>Email *</label>
                  <input style={S.inp} type="email" value={inscEmail} onChange={e => setInscEmail(e.target.value)} placeholder="votre@email.com" />
                  <label style={S.lbl}>Téléphone *</label>
                  <input style={S.inp} type="tel" value={inscTel} onChange={e => setInscTel(e.target.value)} placeholder="+225 07 00 00 00 00" />
                  <label style={S.lbl}>Commune / Ville *</label>
                  <input style={S.inp} value={inscCommune} onChange={e => setInscCommune(e.target.value)} placeholder="Ex: Cocody, Yopougon, Abidjan..." />
                  <label style={S.lbl}>Mot de passe *</label>
                  <input style={S.inp} type="password" value={inscPass} onChange={e => setInscPass(e.target.value)} placeholder="Minimum 6 caractères" />
                  {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
                  <button style={{ ...S.btn, width:'100%', padding:14 }} onClick={() => {
                    if (!inscNom || !inscEmail || !inscTel || !inscCommune || !inscPass) { setMsg('Tous les champs sont requis'); return; }
                    if (inscPass.length < 6) { setMsg('Mot de passe : minimum 6 caractères'); return; }
                    setMsg(''); setInscStep(2);
                  }}>Continuer</button>
                </>
              )}

              {/* ÉTAPE 2 — Profilage */}
              {inscStep === 2 && (
                <>
                  <label style={S.lbl}>Comment comptez-vous prospecter ? *</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {['Digital (réseaux sociaux, WhatsApp, recherche en ligne)','Terrain (maquis, événements, studios, prospection directe)','Les deux (digital + terrain)'].map(m => (
                      <button key={m} onClick={() => setInscMethode(m)}
                        style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${inscMethode===m?'#1a6bff':'#dce6f7'}`, background:inscMethode===m?'#eaf1ff':'#fff', color:inscMethode===m?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:12, fontWeight:600, textAlign:'left' }}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <label style={S.lbl}>Quelles cibles allez-vous recruter ? *</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {['Artistes ayant déjà des contenus','Artistes voulant réaliser un projet (production)','Marchands / Annonceurs','Toutes les cibles'].map(c => (
                      <button key={c} onClick={() => setInscCible(c)}
                        style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${inscCible===c?'#1a6bff':'#dce6f7'}`, background:inscCible===c?'#eaf1ff':'#fff', color:inscCible===c?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:12, fontWeight:600, textAlign:'left' }}>
                        {c}
                      </button>
                    ))}
                  </div>

                  <label style={S.lbl}>Combien de créateurs pouvez-vous recruter par mois ? *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:14 }}>
                    {['10','30','50','60','100'].map(o => (
                      <button key={o} onClick={() => setInscObjectif(o)}
                        style={{ padding:'10px', borderRadius:10, border:`1px solid ${inscObjectif===o?'#1a6bff':'#dce6f7'}`, background:inscObjectif===o?'#eaf1ff':'#fff', color:inscObjectif===o?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                        {o}
                      </button>
                    ))}
                  </div>
                  {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ ...S.btn2, flex:1, padding:14 }} onClick={() => setInscStep(1)}>Retour</button>
                    <button style={{ ...S.btn, flex:2, padding:14 }} onClick={() => {
                      if (!inscMethode || !inscCible || !inscObjectif) { setMsg('Répondez à toutes les questions'); return; }
                      setMsg(''); setInscStep(3);
                    }}>Voir les revenus</button>
                  </div>
                </>
              )}

              {/* ÉTAPE 3 — Grille de rémunération */}
              {inscStep === 3 && (
                <>
                  <p style={{ fontSize:13, color:'#5a7090', marginBottom:16, lineHeight:1.6 }}>
                    Vous êtes rémunéré uniquement sur les résultats — aucun risque, vous gagnez sur l'activité réelle. Voici comment :
                  </p>

                  {/* SOURCE 1 — ARTISTES */}
                  <div style={{ border:'2px solid #1a6bff', borderRadius:12, padding:'14px 16px', marginBottom:12, background:'#f5f9ff' }}>
                    <p style={{ fontWeight:800, fontSize:14, color:'#1a6bff', margin:'0 0 8px' }}>1. Obtention d'artistes</p>
                    <p style={{ fontSize:13, color:'#1a2340', margin:'0 0 6px', fontWeight:700 }}>
                      10 000 F par artiste actif
                    </p>
                    <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 8px', lineHeight:1.6 }}>
                      Vous touchez 10 000 F uniquement pour un artiste qui devient actif.
                    </p>
                    <p style={{ fontSize:12, color:'#00a040', margin:0, fontWeight:700 }}>
                      + Une prime mensuelle sur l'activité de vos artistes (versée par la suite).
                    </p>
                  </div>

                  {/* CONDITIONS ARTISTE ACTIF */}
                  <div style={{ border:'1px solid #f0b84a', background:'#fff8e6', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                    <p style={{ fontWeight:800, fontSize:13, color:'#b07a00', margin:'0 0 8px' }}>Qu'est-ce qu'un artiste actif ?</p>
                    <p style={{ fontSize:12, color:'#5a4a20', margin:'0 0 8px', lineHeight:1.6 }}>
                      Un artiste est considéré comme actif lorsqu'il atteint au moins l'un de ces résultats :
                    </p>
                    <p style={{ fontSize:12, color:'#5a4a20', margin:0, lineHeight:1.9 }}>
                      • 5 000 vues (buzz) ou plus<br/>
                      • 30 téléchargements ou plus<br/>
                      • 2 000 cadeaux (kiffements) ou plus<br/>
                      • 1 000 partages ou plus
                    </p>
                    <p style={{ fontSize:11, color:'#8a7340', margin:'8px 0 0', lineHeight:1.5 }}>
                      Votre rôle : recruter de vrais artistes et les encourager à partager activement leur musique sur les réseaux pour générer du buzz.
                    </p>
                  </div>

                  {/* SOURCE 2 — MARCHANDS */}
                  <div style={{ border:'2px solid #ffd700', borderRadius:12, padding:'14px 16px', marginBottom:14, background:'#fffdf5' }}>
                    <p style={{ fontWeight:800, fontSize:14, color:'#b07a00', margin:'0 0 8px' }}>2. Obtention de marchands</p>
                    <p style={{ fontSize:13, color:'#1a2340', margin:'0 0 6px', fontWeight:700 }}>
                      10% sur chaque publicité payée
                    </p>
                    <p style={{ fontSize:11, color:'#5a7090', margin:0, lineHeight:1.6 }}>
                      Vous touchez 10% du montant de chaque publicité achetée par les marchands que vous recrutez.
                    </p>
                  </div>

                  <div style={{ background:'#eaf1ff', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                    <p style={{ color:'#1a6bff', fontSize:12, lineHeight:1.7, margin:0, fontWeight:700 }}>
                      Exemples : 50 artistes actifs = 500 000 F · une publicité marchand de 600 000 F = 60 000 F de commission.
                    </p>
                  </div>

                  {msg && <p style={{ color: msg.startsWith('')?'#00a040':'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ ...S.btn2, flex:1, padding:14 }} onClick={() => setInscStep(2)}>Retour</button>
                    <button style={{ ...S.btn, flex:2, padding:14 }} disabled={loading} onClick={async () => {
                      setLoading(true); setMsg('');
                      try {
                        let uid = '';
                        try {
                          const cred = await createUserWithEmailAndPassword(auth, inscEmail.trim().toLowerCase(), inscPass);
                          uid = cred.user.uid;
                        } catch(e:any) {
                          if (e.code === 'auth/email-already-in-use') {
                            const cred = await signInWithEmailAndPassword(auth, inscEmail.trim().toLowerCase(), inscPass);
                            uid = cred.user.uid;
                          } else throw e;
                        }
                        const existing = await getDocs(query(collection(db,'commerciaux'), where('email','==', inscEmail.trim().toLowerCase())));
                        if (!existing.empty) {
                          setMsg('Vous avez déjà une candidature commerciale.');
                          await signOut(auth); setLoading(false); return;
                        }
                        await addDoc(collection(db,'commerciaux'), {
                          uid, name: inscNom, email: inscEmail.trim().toLowerCase(), telephone: inscTel,
                          commune: inscCommune,
                          methode: inscMethode, cible: inscCible, objectif: inscObjectif,
                          status: 'en_attente', createdAt: new Date().toISOString(),
                        });
                        notifierAdminEnregistrement('Nouveau commercial', `${inscNom} (${inscEmail.trim().toLowerCase()}) — ${inscCommune || ''}`);
                        setMsg('Inscription envoyée ! Votre compte sera validé par votre responsable.');
                        await signOut(auth);
                        setTimeout(() => { setMode('login'); setInscStep(1); setInscNom(''); setInscEmail(''); setInscTel(''); setInscPass(''); setMsg(''); }, 2500);
                      } catch(e:any) {
                        setMsg(e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
                          ? 'Cet email a déjà un compte. Entrez le bon mot de passe de ce compte.'
                          : 'Erreur : ' + e.message);
                      }
                      setLoading(false);
                    }}>{loading ? '...' : 'Envoyer ma candidature'}</button>
                  </div>
                </>
              )}

              <button onClick={() => { setMode('login'); setInscStep(1); setMsg(''); }}
                style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'#8098b8', cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:8 }}>
                J'ai déjà un compte — Se connecter
              </button>
            </>
          ) : (
            <>
              <label style={S.lbl}>Email</label>
              <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" onKeyDown={e => e.key==='Enter' && login()} />
              <label style={S.lbl}>Mot de passe</label>
              <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key==='Enter' && login()} />
              {msg && <p style={{ color: msg.startsWith('')?'#1a6bff':'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
              <button style={{ ...S.btn, width:'100%', padding:14 }} onClick={login} disabled={loading}>
                {loading ? '...' : 'Se connecter'}
              </button>
              <button onClick={() => { setMode('inscription'); setMsg(''); }}
                style={{ width:'100%', padding:12, marginTop:10, borderRadius:10, border:'1px solid #1a6bff', background:'rgba(26,107,255,0.05)', color:'#1a6bff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Devenir commercial — S'inscrire
              </button>

              <button onClick={async () => {
                if (!email) { setMsg('Entrez votre email d\'abord'); return; }
                try { const r = await demanderResetPassword(email); if (r.ok) setMsg('Email de réinitialisation envoyé'); else setMsg('Erreur : ' + (r.error||'')); }
                catch { setMsg('Email introuvable'); }
              }} style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'#8098b8', cursor:'pointer', fontSize:12, textDecoration:'underline', marginTop:4 }}>
                Mot de passe oublié ?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ ...S.bg, minHeight:'100vh' }}>
      {contratAccepte === false && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'#f0f4fb', overflowY:'auto', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:560, width:'100%', margin:'20px 0', padding:24 }}>
            <Logo size="sm" />
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, color:'#1a2340', margin:'16px 0 4px' }}>Contrat d'apporteur d'affaires</h2>
            <p style={{ color:'#8098b8', fontSize:12, marginBottom:16 }}>BDE SARL — RCCM CI-ABJ-2017-B-15187 — éditrice de Doniel Zik</p>
            <div style={{ background:'#f5f8ff', border:'1px solid #dce6f7', borderRadius:12, padding:16, marginBottom:16 }}>
              {CONTRAT_COMMERCIAL.map((a,i) => (
                <div key={i} style={{ marginBottom:12 }}>
                  <p style={{ fontWeight:700, fontSize:13, color:'#1a6bff', margin:'0 0 4px' }}>{a.t}</p>
                  <p style={{ fontSize:13, color:'#3a4860', lineHeight:1.6, margin:0 }}>{a.c}</p>
                </div>
              ))}
            </div>
            <button onClick={accepterContrat} style={{ ...S.btn, width:'100%', padding:14 }}>J'ai lu et j'accepte le contrat</button>
            <button onClick={() => signOut(auth)} style={{ width:'100%', padding:12, marginTop:10, borderRadius:10, border:'1px solid #dce6f7', background:'transparent', color:'#8098b8', cursor:'pointer', fontSize:13 }}>Refuser et quitter</button>
          </div>
        </div>
      )}
      {/* HEADER */}
      <div style={{ background:'#fff', borderBottom:'1px solid #dce6f7', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Logo size="sm" />
          <div>
            <p style={{ fontWeight:700, fontSize:13, color:'#1a6bff', margin:0 }}>Espace Commercial</p>
            <p style={{ color:'#8098b8', fontSize:10, margin:0 }}>{user?.email}</p>
          </div>
        </div>
        <button style={S.btn2} onClick={() => signOut(auth)}>Déco</button>
      </div>

      {/* TABS */}
      <div style={{ borderBottom:'1px solid #dce6f7', padding:'0 20px', display:'flex', background:'#fff', overflowX:'auto' }}>
        {[['stats','Stats'],['enregistrer','Enregistrer'],['artistes',`Artistes (${artistes.length})`],['marchands',`Marchands (${marchands.length})`]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ padding:'12px 14px', border:'none', background:'transparent', color: tab===t?'#1a6bff':'#8098b8', cursor:'pointer', fontSize:13, fontWeight: tab===t?700:400, borderBottom:`2px solid ${tab===t?'#1a6bff':'transparent'}`, whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'20px 16px' }}>

        {/* REJOINDRE LE GROUPE WHATSAPP */}
        <a href={GROUPE_WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, background:'#25D366', boxShadow:'0 3px 14px rgba(37,211,102,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.961z"/></svg>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontWeight:800, fontSize:14, color:'#fff' }}>Rejoindre le groupe WhatsApp</p>
              <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.9)' }}>Échangez avec l'équipe et recevez les actualités</p>
            </div>
            <span style={{ fontSize:18, color:'#fff' }}>→</span>
          </div>
        </a>

        {/* STATS */}
        {/* ENREGISTRER UN ARTISTE */}
        {tab === 'enregistrer' && <EnregistrerArtisteTab commercialEmail={user.email} db={db} />}

        {tab === 'stats' && (
          <div>
            {monDocId && (
              <div style={{ ...S.card, background:'linear-gradient(135deg,#eef4ff,#dbe8ff)', marginBottom:20 }}>
                <p style={{ fontWeight:800, fontSize:14, color:'#1a2340', margin:'0 0 6px' }}>Mon lien de parrainage artiste</p>
                <p style={{ color:'#5a7090', fontSize:12, margin:'0 0 10px', lineHeight:1.5 }}>Partagez ce lien a vos artistes. Ils s'inscrivent eux-mêmes (vous n'avez plus besoin de l'admin) et leur 1er contenu est offert. Vous êtes crédité automatiquement.</p>
                <div style={{ background:'#fff', border:'1px solid #c8d8ef', borderRadius:10, padding:'8px 12px', marginBottom:10 }}>
                  <span style={{ fontSize:12, color:'#1a6bff', wordBreak:'break-all', fontWeight:600 }}>{BASE_URL}/artiste?ref={monDocId}</span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { navigator.clipboard?.writeText(`${BASE_URL}/artiste?ref=${monDocId}`); setMsg('Lien copie !'); }}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    Copier le lien
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=${monDocId}`))}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex:1, padding:'10px', borderRadius:10, background:'#25D366', color:'#fff', fontWeight:700, fontSize:13, textAlign:'center', textDecoration:'none' }}>
                    Partager WhatsApp
                  </a>
                </div>
                <button onClick={() => { navigator.clipboard?.writeText(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=${monDocId}`)); setMsg('Message d\'invitation copié !'); }}
                  style={{ width:'100%', marginTop:8, padding:'9px', borderRadius:10, border:'1px solid #c8d8ef', background:'#fff', color:'#1a6bff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  Copier le message d'invitation
                </button>
                {msg && <p style={{ color:'#00a040', fontSize:12, marginTop:8 }}>{msg}</p>}
              </div>
            )}
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:20 }}>Mes commissions</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { label:'Artistes actifs', val: commArtistes.toLocaleString()+' F', detail: artistesActifs.length+' × 10 000 F', color:'#1a6bff' },
                { label:'Prime résiduelle', val: residu.toLocaleString()+' F', detail: '10% des revenus / mois', color:'#00a040' },
                { label:'Marchands (pub)', val: commPub.toLocaleString()+' F', detail: '10% du CA publicité', color:'#b07a00' },
                { label:'Artistes recrutés', val: artistes.length.toString(), detail: artistesActifs.length+' actifs', color:'#7c3aed' },
              ].map((s,i) => (
                <div key={i} style={S.card}>
                  <p style={{ color:s.color, fontWeight:900, fontSize:20, margin:'0 0 4px' }}>{s.val}</p>
                  <p style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{s.label}</p>
                  <p style={{ color:'#8098b8', fontSize:11 }}>{s.detail}</p>
                </div>
              ))}
            </div>
            <div style={{ ...S.card, textAlign:'center', background:'linear-gradient(135deg,#eef4ff,#dce8ff)', padding:24 }}>
              <p style={{ color:'#8098b8', fontSize:12, marginBottom:4 }}>Total commissions estimées</p>
              <p style={{ color:'#1a6bff', fontWeight:900, fontSize:32, margin:0 }}>{totalCommissions.toLocaleString()} FCFA</p>
            </div>

            <div style={{ ...S.card, marginTop:16 }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Objectifs recommandés</p>
              {[
                { label:'Artistes actifs', actuel: artistes.length, objectif: 20 },
                { label:'Marchands actifs', actuel: marchands.filter(m=>m.status==='active').length, objectif: 30 },
              ].map((o,i) => (
                <div key={i} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <p style={{ fontSize:13, fontWeight:600 }}>{o.label}</p>
                    <p style={{ fontSize:13, color:'#1a6bff', fontWeight:700 }}>{o.actuel}/{o.objectif}</p>
                  </div>
                  <div style={{ height:8, background:'#dce6f7', borderRadius:99 }}>
                    <div style={{ height:'100%', width: Math.min((o.actuel/o.objectif)*100, 100)+'%', background:'linear-gradient(90deg,#1a6bff,#4da6ff)', borderRadius:99, transition:'width .3s' }} />
                  </div>
                </div>
              ))}
            </div>
            <ChangerMotDePasse />
          </div>
        )}

        {/* ARTISTES */}
        {tab === 'artistes' && (
          <div>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Mes artistes recrutés</h2>
            <p style={{ color:'#8098b8', fontSize:12, marginBottom:20 }}>
              Ces artistes ont été enregistrés avec votre email comme référence.
            </p>
            {artistes.length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14 }}>Aucun artiste recruté pour l'instant</p>
              </div>
            ) : artistes.map(a => {
              const vues = a.buzz || a.vues || 0;
              const dl = a.downloads || 0;
              const parts = a.partages || 0;
              const cad = a.cadeaux || 0;
              const estActif = vues >= 5000 || dl >= 30 || cad >= 2000 || parts >= 1000;
              const wa = (a.whatsapp || '').replace(/[^0-9]/g,'');
              const prenom = (a.name||'').split(' ')[0] || 'cher artiste';
              // Messages préconfigurés
              const messages = [
                { label:'Encouragement', txt: `Bonjour ${prenom} ! Sur Doniel Zik, plus tu partages ton lien à tes fans, plus tu gagnes. Partage ton contenu sur WhatsApp, Facebook, TikTok dès aujourd'hui et fais décoller ton audience !` },
                { label:'Cadeaux', txt: `${prenom}, savais-tu que tes fans peuvent t'envoyer des cadeaux (kiffements) directement sur Doniel Zik ? Invite ta communauté à te soutenir : chaque cadeau te rapporte. Demande-leur de t'envoyer des kiffements !` },
                { label:'Téléchargements', txt: `${prenom}, chaque téléchargement de ton contenu te rapporte de l'argent. Partage ton lien partout et encourage tes fans à télécharger ta musique sur Doniel Zik !` },
                { label:'Pochettes', txt: `${prenom}, duplique ta pochette chez nous à seulement 250 F et revends-la à 1 000 F ! Plus besoin de lecteur : tes fans scannent et téléchargent ta musique directement. Commande tes pochettes maintenant !` },
                { label:'Écoutes / Vues', txt: `${prenom}, plus ton contenu est écouté et visionné, plus tu gagnes en visibilité et en revenus. Partage ton lien Doniel Zik à un maximum de personnes pour booster tes vues !` },
              ];
              return (
              <div key={a.id} style={{ ...S.card, marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:99, background:'linear-gradient(135deg,#eaf1ff,#c8d8ef)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{a.name}</p>
                    <p style={{ color:'#8098b8', fontSize:11, margin:'2px 0 0' }}>{a.email}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {estActif ? (
                      <>
                        <p style={{ color:'#00a040', fontWeight:700, fontSize:13, margin:0 }}>+10 000 F</p>
                        <p style={{ color:'#00a040', fontSize:10 }}>Actif</p>
                      </>
                    ) : (
                      <>
                        <p style={{ color:'#b07a00', fontWeight:700, fontSize:12, margin:0 }}>En attente</p>
                        <p style={{ color:'#8098b8', fontSize:10 }}>pas encore actif</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Activité de l'artiste */}
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  {[
                    { l:'Vues', v: vues },
                    { l:'Téléch.', v: dl },
                    { l:'Partages', v: parts },
                    { l:'Cadeaux', v: cad },
                  ].map((s,i) => (
                    <div key={i} style={{ flex:1, minWidth:60, background:'#f5f8ff', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                      <p style={{ color:'#1a6bff', fontWeight:800, fontSize:14, margin:0 }}>{s.v.toLocaleString()}</p>
                      <p style={{ color:'#8098b8', fontSize:9, margin:0 }}>{s.l}</p>
                    </div>
                  ))}
                </div>

                {/* Contact WhatsApp + messages préconfigurés */}
                {wa ? (
                  <div>
                    <p style={{ color:'#5a7090', fontSize:11, marginBottom:6, fontWeight:600 }}>Envoyer un message (WhatsApp) :</p>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {messages.map((m,i) => (
                        <a key={i} href={`https://wa.me/${wa}?text=${encodeURIComponent(m.txt)}`} target="_blank" rel="noopener noreferrer"
                          style={{ padding:'5px 10px', borderRadius:99, background:'#eaf1ff', color:'#1a6bff', textDecoration:'none', fontSize:11, fontWeight:600, border:'1px solid #c8d8ef' }}>
                          {m.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color:'#b0c4d8', fontSize:11, margin:0 }}>Pas de WhatsApp enregistré pour cet artiste.</p>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* MARCHANDS */}
        {tab === 'marchands' && (
          <div>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Mes marchands recrutés</h2>
            <p style={{ color:'#8098b8', fontSize:12, marginBottom:20 }}>
              Ces annonceurs ont été enregistrés avec votre email comme référence.
            </p>
            {marchands.length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14 }}>Aucun marchand recruté pour l'instant</p>
              </div>
            ) : marchands.map(m => (
              <div key={m.id} style={{ ...S.card, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div>
                    <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{m.entreprise||m.nom}</p>
                    <p style={{ color:'#8098b8', fontSize:11, margin:'2px 0 0' }}>{m.telephone}</p>
                    <p style={{ color:'#8098b8', fontSize:10, margin:'2px 0 0' }}>{new Date(m.createdAt).toLocaleDateString('fr')}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ background: m.status==='active'?'#eaffea':'#fff8e6', border:`1px solid ${m.status==='active'?'#4dff9a':'#f0b84a'}`, borderRadius:99, padding:'2px 10px', fontSize:10, fontWeight:700, color: m.status==='active'?'#00a040':'#b07a00' }}>
                      {m.status==='active'?'● Actif':'En attente'}
                    </span>
                    {m.status==='active' && (
                      <p style={{ color:'#1a6bff', fontWeight:700, fontSize:12, margin:'4px 0 0' }}>+{((m.cout||0)*0.1).toLocaleString()} F</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE REJOINDRE — inscription artiste (/rejoindre, lien à partager)
// ─────────────────────────────────────────────
function RejoindrePage() {
  const CONTACT_TEL = '2250720008993';
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [typeContenu, setTypeContenu] = useState('');
  const [ville, setVille] = useState('');
  const [message, setMessage] = useState('');
  const [engagements, setEngagements] = useState<boolean[]>([false, false, false, false, false]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const QUESTIONS = [
    'Je suis prêt(e) à distribuer mes pochettes reçues.',
    'Je suis prêt(e) à partager mes liens pour faire écouter et télécharger au maximum de mélomanes.',
    'Je suis prêt(e) à inciter ma communauté à menvoyer un maximum de cadeaux.',
    'Je vais challenger pour atteindre les millions de Kiffs et obtenir des récompenses (cash, voiture).',
    'Je suis prêt(e) à programmer des sorties officielles et inciter ma communauté à télécharger au maximum.',
  ];

  const toggleEngagement = (i: number) => {
    setEngagements(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  const tousEngages = engagements.every(e => e);

  const enregistrer = async () => {
    setErr('');
    if (!nom.trim()) { setErr('Indiquez votre nom dartiste.'); return; }
    if (!tel.trim()) { setErr('Indiquez votre numéro de téléphone.'); return; }
    if (!typeContenu) { setErr('Choisissez votre type de contenu.'); return; }
    if (!tousEngages) { setErr('Merci de cocher tous les engagements pour continuer.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'inscriptions_artistes'), {
        nom: nom.trim(),
        tel: tel.trim(),
        typeContenu,
        ville: ville.trim(),
        message: message.trim(),
        engagements,
        statut: 'nouveau',
        createdAt: new Date().toISOString(),
      });
      notifierAdminEnregistrement('Demande artiste (/rejoindre)', `${nom.trim()} — ${tel.trim()} — ${ville.trim()}`);
      setDone(true);
    } catch(e:any) {
      console.error(e);
      setErr('Erreur lors de lenregistrement. Réessayez ou contactez-nous directement.');
    }
    setLoading(false);
  };

  const waLink = `https://wa.me/${CONTACT_TEL}?text=${encodeURIComponent('Bonjour, je viens de minscrire sur Doniel Zik (' + (nom || 'artiste') + '). Je souhaite prendre rendez-vous.')}`;

  // ── ÉCRAN DE CONFIRMATION ──
  if (done) {
    return (
      <div style={{ minHeight:'100vh', background:C.bgDeep, color:C.text, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ maxWidth:440, width:'100%', textAlign:'center' }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900, color:'#fff', marginBottom:12 }}>Inscription enregistrée !</h1>
          <p style={{ color:C.textSoft, fontSize:15, lineHeight:1.6, marginBottom:8 }}>
            Merci {nom.trim()} ! Ta demande est bien reçue. Prochaine étape : <strong style={{ color:C.gold }}>prends rendez-vous</strong> avec notre équipe pour finaliser ton intégration.
          </p>
          <div style={{ background:C.card, borderRadius:16, padding:20, margin:'20px 0' }}>
            <p style={{ color:C.textSoft, fontSize:13, marginBottom:14 }}>Contacte-nous maintenant pour ton rendez-vous :</p>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'15px', borderRadius:14, background:'#25D366', color:'#fff', fontWeight:800, fontSize:16, textDecoration:'none', marginBottom:12 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.961z"/></svg>
              Prendre rendez-vous sur WhatsApp
            </a>
            <p style={{ color:C.textSoft, fontSize:13 }}>
              Ou appelle le <a href={`tel:+${CONTACT_TEL}`} style={{ color:C.blueLite, fontWeight:700, textDecoration:'none' }}>+{CONTACT_TEL}</a>
            </p>
          </div>
          <Lien href="/decouvrir" style={{ color:C.textSoft, fontSize:13, textDecoration:'none' }}>← Découvrir la plateforme</Lien>
        </div>
      </div>
    );
  }

  // ── FORMULAIRE ──
  const inpStyle: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', padding:'13px 16px', borderRadius:12,
    border:`1px solid ${C.border}`, background:C.bgSecond, color:C.text, fontSize:15,
    marginBottom:14, outline:'none',
  };
  const labelStyle: React.CSSProperties = { display:'block', color:C.textSoft, fontSize:13, fontWeight:600, marginBottom:6 };

  return (
    <div style={{ minHeight:'100vh', background:C.bgDeep, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');`}</style>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'0 18px' }}>

        {/* HERO PROMO */}
        <div style={{ textAlign:'center', paddingTop:40, marginBottom:28 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:900, color:'#fff', lineHeight:1.2, marginBottom:10 }}>
            Le monde attend ta voix.<br/>Ensemble, on te propulse.
          </h1>
          <p style={{ color:C.textSoft, fontSize:15, lineHeight:1.6 }}>
            Rejoins Doniel Zik et transforme ta passion en revenus.
          </p>
        </div>

        {/* OFFRE */}
        <div style={{ background:`linear-gradient(135deg,${C.card},${C.cardHi})`, borderRadius:18, padding:22, marginBottom:16, border:`1px solid ${C.border}` }}>
          <div style={{ display:'inline-block', background:C.gold, color:'#3a2c00', fontWeight:800, fontSize:13, padding:'5px 14px', borderRadius:99, marginBottom:14 }}>
            Pour seulement 25 000 FCFA
          </div>
          <p style={{ color:C.text, fontSize:15, fontWeight:700, marginBottom:12 }}>Tu bénéficies de :</p>
          {[
            ['', 'Un single produit fini', '(si besoin)'],
            ['', '100 pochettes musicales', 'prêtes à être distribuées'],
          ].map(([ic, t, s], i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
              <span style={{ fontSize:22 }}>{ic}</span>
              <div>
                <p style={{ color:C.text, fontSize:15, fontWeight:700, margin:0 }}>{t}</p>
                <p style={{ color:C.textSoft, fontSize:12, margin:0 }}>{s}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AVANTAGES PLATEFORME */}
        <div style={{ background:C.card, borderRadius:18, padding:22, marginBottom:16, border:`1px solid ${C.border}` }}>
          <p style={{ color:C.text, fontSize:15, fontWeight:700, marginBottom:12 }}>Sur notre plateforme :</p>
          {[
            ['', 'Sois rémunéré à chaque écoute et visionnage'],
            ['', 'Obtiens des lots exclusifs grâce aux Kiffs reçus de tes fans'],
            ['', 'Bientôt clip et promotion TV'],
          ].map(([ic, t], i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <span style={{ fontSize:20 }}>{ic}</span>
              <p style={{ color:C.textSoft, fontSize:14, margin:0 }}>{t}</p>
            </div>
          ))}
          <p style={{ color:C.gold, fontSize:15, fontWeight:800, textAlign:'center', marginTop:14, marginBottom:0 }}>
            Tu distribues. Tu partages. Tu grandis.
          </p>
          <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', marginTop:4 }}>
            Et nous, on t'accompagne à chaque étape.
          </p>
        </div>

        {/* ENGAGEMENTS */}
        <div style={{ background:C.card, borderRadius:18, padding:22, marginBottom:16, border:`1px solid ${C.border}` }}>
          <p style={{ color:C.text, fontSize:16, fontWeight:800, marginBottom:6 }}>Tes engagements</p>
          <p style={{ color:C.textSoft, fontSize:13, marginBottom:16 }}>Coche pour confirmer ta motivation :</p>
          {QUESTIONS.map((q, i) => (
            <div key={i} onClick={() => toggleEngagement(i)}
              style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px', borderRadius:12, marginBottom:10, cursor:'pointer',
                background: engagements[i] ? 'rgba(0,212,154,0.12)' : C.bgSecond,
                border: `1px solid ${engagements[i] ? C.success : C.border}` }}>
              <div style={{ flexShrink:0, width:24, height:24, borderRadius:7, marginTop:1,
                background: engagements[i] ? C.success : 'transparent',
                border: `2px solid ${engagements[i] ? C.success : C.textSoft}`,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {engagements[i] && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <p style={{ color:C.text, fontSize:14, margin:0, lineHeight:1.4 }}>{q}</p>
            </div>
          ))}
        </div>

        {/* FORMULAIRE */}
        <div style={{ background:C.card, borderRadius:18, padding:22, marginBottom:16, border:`1px solid ${C.border}` }}>
          <p style={{ color:C.text, fontSize:16, fontWeight:800, marginBottom:16 }}>Tes informations</p>

          <label style={labelStyle}>Nom d'artiste *</label>
          <input style={inpStyle} value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom de scène" />

          <label style={labelStyle}>Téléphone / WhatsApp *</label>
          <input style={inpStyle} type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="Ex : 07 00 00 00 00" />

          <label style={labelStyle}>Type de contenu *</label>
          <select style={inpStyle} value={typeContenu} onChange={e => setTypeContenu(e.target.value)}>
            <option value="">Choisir...</option>
            <option value="musique">Musique</option>
            <option value="gospel">Gospel</option>
            <option value="humour">Humour</option>
            <option value="cinema">Cinéma / Vidéo</option>
            <option value="autre">Autre</option>
          </select>

          <label style={labelStyle}>Ville</label>
          <input style={inpStyle} value={ville} onChange={e => setVille(e.target.value)} placeholder="Ex : Abidjan" />

          <label style={labelStyle}>Message (optionnel)</label>
          <textarea style={{ ...inpStyle, minHeight:70, resize:'vertical' }} value={message} onChange={e => setMessage(e.target.value)} placeholder="Parle-nous de ton projet..." />

          {err && <p style={{ color:C.alert, fontSize:13, marginBottom:12, textAlign:'center' }}>{err}</p>}

          <button onClick={enregistrer} disabled={loading}
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg,${C.blue},#0050d0)`, color:'#fff', fontWeight:800, fontSize:16,
              opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enregistrement...' : 'Minscrire maintenant'}
          </button>
        </div>

        {/* CONTACT */}
        <p style={{ color:C.textSoft, fontSize:13, textAlign:'center', lineHeight:1.6 }}>
          Places limitées — Inscris-toi maintenant.<br/>
          Contact : <a href={`tel:+${CONTACT_TEL}`} style={{ color:C.blueLite, fontWeight:700, textDecoration:'none' }}>+{CONTACT_TEL}</a>
        </p>
      </div>
    </div>
  );
}

function AProposPage() {
  const sections = [
    {
      t: "Qu'est-ce que Doniel Zik ?",
      c: "Doniel Zik est une plateforme numérique africaine de distribution, de promotion et de monétisation de contenu créatif, conçue et éditée par BDE SARL, basée à Abidjan en Côte d'Ivoire. Elle a été pensée pour répondre à un besoin réel et longtemps ignoré : permettre aux artistes africains de vivre véritablement de leur talent. Là où la plupart des artistes voient leur travail circuler, être écouté, partagé et apprécié sans jamais leur rapporter le moindre revenu, Doniel Zik renverse cette logique en plaçant la rémunération de l'artiste au cœur de son fonctionnement."
    },
    {
      t: "Pour tous les talents créatifs",
      c: "La plateforme s'adresse à l'ensemble des talents créatifs, et non à la seule musique. Chanteurs, acteurs, vidéastes, danseurs et humoristes peuvent tous y publier leurs contenus, qu'il s'agisse de titres audio, de clips, de vidéos, de séries ou de performances. Chaque création trouve sa place et son public. Doniel Zik n'est pas un réseau social de plus, où l'on accumule des vues sans contrepartie : c'est un outil professionnel, sérieux et structuré, dont la finalité est de faire vivre et de rentabiliser la création."
    },
    {
      t: "Comment l'artiste gagne de l'argent",
      c: "Le principe de rémunération est simple et transparent. Sur Doniel Zik, le contenu d'un artiste lui rapporte directement et de plusieurs façons. À chaque écoute ou visionnage de son contenu, l'artiste perçoit un revenu. À chaque téléchargement de sa musique ou de sa vidéo, il est payé. À chaque cadeau que lui envoie un fan, il reçoit sa part. Plus son public s'engage, écoute, télécharge et le soutient, plus ses revenus augmentent. L'artiste n'est plus spectateur de son propre succès : il en récolte les fruits."
    },
    {
      t: "Le lien public et le QR code",
      c: "Chaque artiste dispose d'un lien public et d'un QR code personnel, qu'il peut partager partout : sur ses réseaux sociaux, lors de ses concerts, à ses événements. Toute personne qui ouvre ce lien ou scanne ce code accède instantanément au contenu de l'artiste, peut l'écouter, le regarder et le télécharger, où qu'elle se trouve. L'artiste peut également commander des pochettes physiques intelligentes portant son QR code, à revendre à ses fans : chaque pochette devient à la fois un objet promotionnel et une source de revenus."
    },
    {
      t: "Une communauté de mélomanes",
      c: "La vie de la plateforme repose sur sa communauté. Les fans, appelés mélomanes, découvrent les contenus, les écoutent, les regardent, les aiment, les commentent, les partagent et soutiennent leurs artistes préférés. Ce partage est un moteur de croissance : plus un contenu circule et est vu, plus l'artiste gagne en visibilité et en revenus. La découverte des talents et le soutien direct du public forment le cœur battant de Doniel Zik."
    },
    {
      t: "Notre engagement",
      c: "À travers cet écosystème complet, Doniel Zik poursuit un engagement clair : valoriser le talent créatif africain et offrir aux artistes un véritable outil professionnel pour faire connaître, diffuser et rentabiliser leur travail, en toute transparence et au plus près de leur public."
    },
  ];
  return (
    <div style={{ ...S.bg, minHeight:'100vh' }}>
      <div style={{ background:'#fff', borderBottom:'1px solid #dce6f7', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
        <Logo size="sm" />
        <Lien href="/" style={{ color:'#1a6bff', fontSize:13, textDecoration:'none', fontWeight:700 }}>← Accueil</Lien>
      </div>
      <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 20px 60px' }}>
        <h1 style={{ fontFamily:'serif', fontSize:30, fontWeight:800, marginBottom:8, color:'#1a6bff' }}>À propos de Doniel Zik</h1>
        <p style={{ color:'#8098b8', fontSize:14, marginBottom:32, fontStyle:'italic' }}>La plateforme qui fait vivre et rentabilise le talent créatif africain</p>
        {sections.map((s,i) => (
          <div key={i} style={{ marginBottom:28 }}>
            <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, color:'#1a2340', marginBottom:10 }}>{s.t}</h2>
            <p style={{ color:'#3a4860', fontSize:15, lineHeight:1.75, margin:0 }}>{s.c}</p>
          </div>
        ))}
        <div style={{ marginTop:40, padding:'20px', background:'#f5f8ff', borderRadius:12, textAlign:'center' }}>
          <p style={{ color:'#1a2340', fontSize:15, fontWeight:700, marginBottom:8 }}>Rejoignez Doniel Zik dès aujourd'hui</p>
          <p style={{ color:'#5a7090', fontSize:14, lineHeight:1.6, marginBottom:16 }}>
            Que vous soyez artiste, mélomane ou annonceur, Doniel Zik vous ouvre les portes d'un nouvel écosystème créatif. Faites vivre votre talent, soutenez vos artistes préférés, ou faites connaître votre activité auprès d'une communauté active et engagée.
          </p>
          <Lien href="/decouvrir" style={{ display:'inline-block', padding:'12px 24px', borderRadius:99, background:'#1a6bff', color:'#fff', textDecoration:'none', fontWeight:700, fontSize:14 }}>Découvrir la plateforme</Lien>
        </div>
        <div style={{ marginTop:30, textAlign:'center', display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Lien href="/conditions" style={{ color:'#8098b8', fontSize:13 }}>Conditions d'utilisation</Lien>
          <Lien href="/privacy" style={{ color:'#8098b8', fontSize:13 }}>Confidentialité</Lien>
        </div>
        <p style={{ color:'#b0c4d8', fontSize:12, textAlign:'center', marginTop:24 }}>
          Doniel Zik — Édité par BDE SARL · Abidjan, Côte d'Ivoire · doniel.art
        </p>
      </div>
    </div>
  );
}

function ConditionsPage() {
  return (
    <div style={{ ...S.bg, minHeight: '100vh' }}>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dce6f7', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <Logo size="sm" />
        <Lien href="/artiste" style={{ color: '#1a6bff', fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>← Retour</Lien>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: 26, fontWeight: 800, marginBottom: 8, color: '#1a6bff' }}>
          Conditions Générales d'Utilisation
        </h1>
        <p style={{ color: '#8098b8', fontSize: 13, marginBottom: 32, fontStyle: 'italic' }}>
          Distribution Non-Exclusive via QR Code — Plateforme DONIEL ZIK
        </p>

        {[
          {
            title: 'ARTICLE 1 — QUI SOMMES-NOUS',
            content: `Doniel Zik est une plateforme de distribution musicale numérique via QR Code. Notre rôle est de mettre votre musique à disposition de vos fans de manière simple, directe et sécurisée. Nous ne sommes pas un label. Nous sommes un distributeur technique.`
          },
          {
            title: "ARTICLE 2 — VOS DROITS D'AUTEUR",
            content: `Vous restez propriétaire à 100% de votre musique. En vous inscrivant sur Doniel Zik, vous ne cédez aucun droit sur vos œuvres. Doniel Zik ne peut en aucun cas revendiquer une quelconque propriété sur votre musique, la modifier, la redistribuer ou la sous-licencier sans votre accord explicite.`
          },
          {
            title: 'ARTICLE 3 — CE QUE DONIEL ZIK FAIT POUR VOUS',
            content: `En rejoignant la plateforme, vous bénéficiez de : la création de QR codes uniques liés à votre musique, l'hébergement sécurisé de vos fichiers audio et vidéo, un accès streaming et téléchargement pour vos fans, un tableau de bord en temps réel avec vos statistiques d'écoute, et un rapport trimestriel détaillé de vos revenus.`
          },
          {
            title: 'ARTICLE 4 — VOS REVENUS DE STREAMING',
            content: `Chaque écoute de 30 secondes ou plus sur notre plateforme génère un revenu pour vous.\n\nAujourd'hui : chaque écoute vous rapporte entre 0,03 et 0,10 FCFA selon le volume de trafic.\n\nTrès prochainement : l'intégration d'annonceurs locaux augmentera vos revenus à 1 – 4 FCFA par écoute.\n\nEn perspective : les abonnements mélomanes s'ajouteront à vos revenus de streaming.`
          },
          {
            title: 'ARTICLE 5 — CONDITIONS DE PAIEMENT',
            content: `Vos revenus sont versés tous les trois mois par Mobile Money (Orange Money, Wave, MTN MoMo) dès que votre cumul atteint 15 000 FCFA. En dessous du seuil, vos revenus sont conservés et reportés au trimestre suivant sans perte. Vous suivez tout en temps réel depuis votre tableau de bord.`
          },
          {
            title: 'ARTICLE 6 — VOS OBLIGATIONS',
            content: `En vous inscrivant, vous vous engagez à : être l'auteur ou détenir tous les droits sur la musique que vous déposez, fournir des fichiers audio de qualité originale, informer Doniel Zik de tout changement de coordonnées Mobile Money, et ne pas partager vos accès avec des tiers.`
          },
          {
            title: 'ARTICLE 7 — RÉSILIATION',
            content: `Vous pouvez quitter la plateforme à tout moment en nous contactant. Vos fichiers seront supprimés dans un délai de 30 jours. Les revenus accumulés et non encore versés vous seront payés dans ce même délai.`
          },
          {
            title: 'ARTICLE 8 — MODIFICATION DES CONDITIONS',
            content: `Doniel Zik se réserve le droit de modifier les présentes conditions. Vous serez informé de tout changement par notification sur votre tableau de bord avant son entrée en vigueur.`
          },
        ].map((section, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 16 }}>
            <p style={{ color: '#1a6bff', fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>{section.title}</p>
            <p style={{ color: '#5a7090', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{section.content}</p>
          </div>
        ))}

        <div style={{ background: '#eaf1ff', border: '1px solid #1a6bff', borderRadius: 12, padding: 20, textAlign: 'center', marginTop: 8 }}>
          <p style={{ color: '#5a7090', fontSize: 12, fontStyle: 'italic', lineHeight: 1.7 }}>
            En cochant la case d'acceptation lors de votre inscription, vous confirmez avoir lu et accepté l'intégralité des présentes conditions.
          </p>
          <p style={{ color: '#1a6bff', fontWeight: 800, marginTop: 12, fontSize: 14 }}>
            DONIEL ZIK — La Musique. Un Scan. Un Monde.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE ANNONCEURS — nouvelle version
// Tarif unique : 1 000 FCFA = 1 000 vues
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ANNONCEURS PAGE — inscription + dashboard
// ─────────────────────────────────────────────
function AnnonceursPage() {
  const [user, setUser] = useState<any>(null);
  const [annonceur, setAnnonceur] = useState<any>(null);
  const [view, setView] = useState<'login'|'register'|'dashboard'>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Vérifier si annonceur validé
        const snap = await getDocs(query(collection(db,'annonceurs'), where('email','==',u.email), where('status','==','valide')));
        if (!snap.empty) { setAnnonceur({id:snap.docs[0].id,...snap.docs[0].data()}); setView('dashboard'); }
        else setView('login');
      } else setView('login');
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Chargement...</p></div>;

  if (view === 'register') return <AnnonceurRegister onBack={() => setView('login')} />;
  if (view === 'dashboard' && annonceur) return <AnnonceurDashboard annonceur={annonceur} user={user} />;
  return <AnnonceurLogin onRegister={() => setView('register')} />;
}

function AnnonceurLogin({ onRegister }: { onRegister: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setMsg('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDocs(query(collection(db,'annonceurs'), where('email','==',cred.user.email), where('status','==','valide')));
      if (snap.empty) { await signOut(auth); setMsg('Compte non validé. Contactez-nous.'); }
    } catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}><Logo size="lg" />
          <p style={{ color:'#1a6bff', fontWeight:700, fontSize:14, marginTop:8 }}>Espace Annonceur</p>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key==='Enter' && login()} />
          {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
          <button style={{ ...S.btn, width:'100%', padding:14 }} onClick={login} disabled={loading}>{loading ? '...' : 'Se connecter'}</button>
          <button onClick={onRegister} style={{ width:'100%', padding:12, marginTop:10, borderRadius:10, border:'1px solid #dce6f7', background:'transparent', color:'#1a6bff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
            Créer mon espace annonceur
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnonceurRegister({ onBack }: { onBack: () => void }) {
  const [nomCommercial, setNomCommercial] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [typePub, setTypePub] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!nomCommercial || !email || !telephone || !password || !typePub) { setMsg('Tous les champs sont requis'); return; }
    setLoading(true); setMsg('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await addDoc(collection(db,'annonceurs'), {
        nomCommercial, email: email.trim().toLowerCase(), telephone, typePub,
        status: 'en_attente', createdAt: new Date().toISOString(),
      });
      setDone(true);
    } catch(e:any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  if (done) return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ ...S.card, maxWidth:380, textAlign:'center' }}>
        <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:8 }}>Demande envoyée !</h2>
        <p style={{ color:'#5a7090', fontSize:14, lineHeight:1.7 }}>Votre espace sera activé après validation. Vous serez contacté au {telephone}.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}><Logo size="lg" />
          <p style={{ color:'#1a6bff', fontWeight:700, fontSize:14, marginTop:8 }}>Créer mon espace annonceur</p>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Nom commercial *</label>
          <input style={S.inp} value={nomCommercial} onChange={e => setNomCommercial(e.target.value)} placeholder="Nom de votre entreprise ou activité" />
          <label style={S.lbl}>Email *</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          <label style={S.lbl}>Téléphone *</label>
          <input style={S.inp} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+225 07 00 00 00 00" />
          <label style={S.lbl}>Mot de passe *</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choisissez un mot de passe" />
          <label style={S.lbl}>Type de publicité souhaitée *</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {['Image', 'Vidéo', 'Événement', 'Promotion'].map(t => (
              <button key={t} onClick={() => setTypePub(t)}
                style={{ padding:'10px 8px', borderRadius:10, border:`2px solid ${typePub===t?'#1a6bff':'#dce6f7'}`, background:typePub===t?'#eaf1ff':'#fff', color:typePub===t?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {t}
              </button>
            ))}
          </div>
          {msg && <p style={{ color:'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
          <button style={{ ...S.btn, width:'100%', padding:14 }} onClick={submit} disabled={loading}>{loading ? '...' : 'Créer mon espace'}</button>
          <button onClick={onBack} style={{ width:'100%', padding:10, marginTop:8, borderRadius:10, border:'none', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>Retour</button>
        </div>
      </div>
    </div>
  );
}

function AnnonceurDashboard({ annonceur, user }: { annonceur: any, user: any }) {
  const [tab, setTab] = useState<'campagnes'|'nouvelle'>('campagnes');
  const [campagnes, setCampagnes] = useState<any[]>([]);
  const [form, setForm] = useState({ budget:'', typePub:'image', description:'' });
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'pubs'), where('annonceurEmail','==',user.email), orderBy('createdAt','desc')),
      snap => setCampagnes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [user.email]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('resource_type', 'auto');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method:'POST', body:fd });
    const d = await r.json();
    setImageUrl(d.secure_url || '');
    setUploading(false);
  };

  const soumettre = async () => {
    if (!form.budget || !imageUrl) { setMsg('Ajoutez votre visuel et votre budget'); return; }
    try {
      await addDoc(collection(db,'pubs'), {
        titre: annonceur.nomCommercial,
        sousTitre: form.description,
        imageUrl,
        mediaType: form.typePub,
        lien: annonceur.telephone,
        lienType: 'tel',
        btnLabel: 'Contacter',
        active: false,
        annonceurEmail: user.email,
        budget: parseInt(form.budget),
        vues: 0, clics: 0,
        status: 'en_attente_paiement',
        // Répartition CA pub : Artiste 50% / Entreprise 40% / Commercial 10%
        partArtiste: Math.round(parseInt(form.budget) * 0.50),
        partEntreprise: Math.round(parseInt(form.budget) * 0.40),
        partCommercial: Math.round(parseInt(form.budget) * 0.10),
        createdAt: new Date().toISOString(),
      });
      setMsg('Campagne soumise ! Effectuez votre paiement pour activation.');
      setForm({ budget:'', typePub:'image', description:'' });
      setImageUrl('');
      setTab('campagnes');
    } catch(e:any) { setMsg('Erreur: ' + e.message); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4fb', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #dce6f7', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
        <Logo size="sm" />
        <p style={{ fontWeight:700, fontSize:14, color:'#1a2340' }}>{annonceur.nomCommercial}</p>
        <button onClick={() => signOut(auth)} style={{ background:'none', border:'none', color:'#8098b8', cursor:'pointer', fontSize:13 }}>Déconnexion</button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:'1px solid #dce6f7', background:'#fff', display:'flex' }}>
        {[['campagnes','Mes campagnes'],['nouvelle','Nouvelle campagne']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ padding:'12px 20px', border:'none', background:'transparent', color:tab===t?'#1a6bff':'#8098b8', fontWeight:tab===t?700:400, fontSize:13, cursor:'pointer', borderBottom:`2px solid ${tab===t?'#1a6bff':'transparent'}` }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', padding:'20px 16px' }}>
        {msg && <p style={{ color: msg.startsWith('')?'#1a6bff':'#f04a6a', fontSize:13, marginBottom:12 }}>{msg}</p>}

        {/* Campagnes */}
        {tab === 'campagnes' && (
          <div>
            {campagnes.length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14 }}>Aucune campagne pour l'instant</p>
                <button onClick={() => setTab('nouvelle')} style={{ ...S.btn, marginTop:12, padding:'10px 24px' }}>Créer ma première campagne</button>
              </div>
            ) : campagnes.map(c => (
              <div key={c.id} style={{ ...S.card, marginBottom:12 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  {c.imageUrl && <img src={c.imageUrl} style={{ width:60, height:60, borderRadius:8, objectFit:'cover' }} alt="" />}
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:14, margin:'0 0 4px' }}>{c.titre}</p>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                      <span style={{ background: c.active?'#eaffea':'#fff8e6', border:`1px solid ${c.active?'#4dff9a':'#f0b84a'}`, borderRadius:99, padding:'2px 10px', fontSize:11, color:c.active?'#00a040':'#b07a00', fontWeight:700 }}>
                        {c.active ? 'Active' : c.status === 'en_attente_paiement' ? 'En attente paiement' : 'En attente validation'}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:16 }}>
                      <span style={{ color:'#5a7090', fontSize:12 }}>{(c.vues||0).toLocaleString()} vues</span>
                      <span style={{ color:'#5a7090', fontSize:12 }}>{(c.clics||0).toLocaleString()} clics</span>
                      <span style={{ color:'#5a7090', fontSize:12 }}>{(c.budget||0).toLocaleString()} FCFA</span>
                    </div>
                    {c.status === 'en_attente_paiement' && (
                      <p style={{ color:'#1a6bff', fontSize:11, marginTop:6 }}>
                        Payez {(c.budget||0).toLocaleString()} FCFA sur Wave/Orange au +225 05 02 10 14 52 pour activer
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nouvelle campagne */}
        {tab === 'nouvelle' && (
          <div style={S.card}>
            <h2 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:16 }}>Nouvelle campagne</h2>

            <label style={S.lbl}>Visuel publicitaire *</label>
            <input type="file" accept="image/*,video/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
              style={{ marginBottom:12 }} />
            {uploading && <p style={{ color:'#1a6bff', fontSize:12, marginBottom:8 }}>Upload en cours...</p>}
            {imageUrl && <img src={imageUrl} alt="preview" style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8, marginBottom:12 }} />}

            <label style={S.lbl}>Budget (FCFA) *</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12 }}>
              {['1000','5000','10000','50000'].map(b => (
                <button key={b} onClick={() => setForm(f => ({...f,budget:b}))}
                  style={{ padding:'8px 4px', borderRadius:8, border:`2px solid ${form.budget===b?'#1a6bff':'#dce6f7'}`, background:form.budget===b?'#eaf1ff':'#fff', color:form.budget===b?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                  {parseInt(b).toLocaleString()}F
                </button>
              ))}
            </div>

            <label style={S.lbl}>Description (optionnel)</label>
            <input style={S.inp} value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Décrivez votre offre" />

            <button onClick={soumettre} style={{ ...S.btn, width:'100%', padding:14 }}>Soumettre ma campagne</button>

            <div style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:10, padding:'10px 14px', marginTop:12 }}>
              <p style={{ color:'#b07a00', fontSize:11, lineHeight:1.7, margin:0 }}>
                Après soumission, effectuez votre paiement sur Wave/Orange Money au +225 05 02 10 14 52. Votre campagne sera activée après confirmation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE PRODUCTION MUSICALE — /production
// Comment ça marche + offre + inscription + contrat signé
// ─────────────────────────────────────────────
function ProductionPage() {
  const [user, setUser] = useState<any>(null);
  const [etape, setEtape] = useState<'presentation'|'formulaire'|'contrat'|'fait'>('presentation');
  // Formulaire
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [emailArt, setEmailArt] = useState('');
  const [projet, setProjet] = useState('');
  const [msg, setMsg] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // Contrat
  const [lu, setLu] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [aSigne, setASigne] = useState(false);
  const dessine = useRef(false);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setEmailArt(u.email || ''); setNom(u.displayName || ''); }
    });
  }, []);

  // ── Signature dessinée (canvas) ──
  const posCanvas = (e: any) => {
    const c = canvasRef.current; if (!c) return { x:0, y:0 };
    const r = c.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - r.left) * (c.width / r.width), y: (clientY - r.top) * (c.height / r.height) };
  };
  const debutTrait = (e: any) => {
    e.preventDefault(); dessine.current = true;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = posCanvas(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const traitEnCours = (e: any) => {
    if (!dessine.current) return;
    e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = posCanvas(e);
    ctx.lineTo(x, y); ctx.strokeStyle = '#0D1526'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    setASigne(true);
  };
  const finTrait = () => { dessine.current = false; };
  const effacerSignature = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setASigne(false);
  };

  // ── Envoyer l'inscription (étape formulaire) ──
  const validerFormulaire = () => {
    if (!nom.trim()) { setMsg('Indiquez votre nom d\'artiste'); return; }
    if (!tel.trim()) { setMsg('Indiquez votre numéro de téléphone'); return; }
    if (!emailArt.trim()) { setMsg('Indiquez votre email'); return; }
    setMsg('');
    setEtape('contrat');
  };

  // ── Signer et enregistrer le dossier ──
  const signerEtEnvoyer = async () => {
    if (!lu) { setMsg('Veuillez cocher « J\'ai lu et j\'accepte »'); return; }
    if (!aSigne) { setMsg('Veuillez dessiner votre signature'); return; }
    setEnvoi(true); setMsg('');
    try {
      const signatureImg = canvasRef.current?.toDataURL('image/png') || '';
      const now = new Date();
      await addDoc(collection(db, 'demandes_production'), {
        nom: nom.trim(),
        tel: tel.trim(),
        email: emailArt.trim(),
        projet: projet.trim(),
        uid: user?.uid || '',
        // Preuve de signature
        signatureImg,
        contratAccepte: true,
        contratVersion: 'production-v1',
        dateSignature: now.toISOString(),
        heureSignature: now.toLocaleTimeString('fr-FR'),
        statut: 'nouveau',
        createdAt: now.toISOString(),
      });
      // Notifier l'admin
      await envoyerNotification({
        to: 'bdonaldservices@gmail.com', type: 'production',
        text: `Nouvelle demande de production musicale : ${nom.trim()} (${tel.trim()}). Contrat signé en ligne.`,
        createdAt: now.toISOString(),      });
      envoyerEmailNotif('bdonaldservices@gmail.com', 'Nouvelle demande de production Doniel Zik',
        `${nom.trim()} vient de s'inscrire pour une production musicale et a signé le contrat en ligne. Téléphone : ${tel.trim()}, Email : ${emailArt.trim()}.`);
      setEtape('fait');
    } catch (e: any) {
      setMsg('Erreur lors de l\'enregistrement. Réessayez.');
      console.error(e);
    }
    setEnvoi(false);
  };

  const ETAPES_OFFRE = [
    { icone: '', titre: 'Single studio', desc: 'Votre titre enregistré et mixé en studio professionnel.' },
    { icone: '', titre: '100 pochettes QR', desc: '100 pochettes physiques avec QR code pour partager votre musique partout.' },
    { icone: '', titre: 'Publication', desc: 'Votre single publié sur la plateforme Doniel Zik.' },
    { icone: '', titre: 'Clip vidéo', desc: 'Un clip pour donner vie à votre chanson.' },
    { icone: '', titre: 'Promotion télé', desc: 'Une action de promotion à la télévision.' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:60 }}>
      {/* En-tête */}
      <div style={{ background:'rgba(22,27,39,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <Lien href="/" style={{ color:C.text, fontSize:20, textDecoration:'none' }}>←</Lien>
        <p style={{ fontWeight:800, fontSize:15, color:C.gold, margin:0 }}>Production musicale</p>
        <span style={{ width:20 }} />
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 16px' }}>

        {/* ── ÉTAPE PRÉSENTATION : Comment ça marche + offre ── */}
        {etape === 'presentation' && (
          <>
            <h1 style={{ fontSize:24, fontWeight:900, margin:'0 0 8px', color:C.text }}>Faites produire votre musique</h1>
            <p style={{ color:C.textSoft, fontSize:14, lineHeight:1.6, margin:'0 0 24px' }}>
              Doniel Zik produit votre single de A à Z et le fait vivre sur la plateforme. Enregistrez-vous, signez votre contrat en ligne, et notre équipe vous recontacte.
            </p>

            {/* Ce que comprend l'offre */}
            <p style={{ color:C.gold, fontSize:12, fontWeight:800, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px' }}>Ce que comprend la production</p>
            <div style={{ marginBottom:26 }}>
              {ETAPES_OFFRE.map((o, i) => (
                <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'13px 15px', marginBottom:9 }}>
                  <span style={{ fontSize:22 }}>{o.icone}</span>
                  <div>
                    <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:'0 0 2px' }}>{o.titre}</p>
                    <p style={{ color:C.textSoft, fontSize:12, lineHeight:1.5, margin:0 }}>{o.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment ça marche */}
            <p style={{ color:C.gold, fontSize:12, fontWeight:800, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px' }}>Comment ça marche</p>
            <div style={{ marginBottom:26 }}>
              {[
                { n:'1', t:'Vous vous enregistrez', d:'Remplissez le formulaire avec vos informations et votre projet.' },
                { n:'2', t:'Vous signez le contrat en ligne', d:'Lisez et signez votre contrat de production directement sur votre téléphone.' },
                { n:'3', t:'Notre équipe vous recontacte', d:'Nous convenons ensemble des détails et du règlement, en dehors de la plateforme.' },
                { n:'4', t:'On produit votre single', d:'Studio, pochettes, clip, publication et promotion télé.' },
                { n:'5', t:'Votre musique prend vie', d:'Les mélomanes écoutent, réalisent des challenges sur votre titre et le partagent sur les réseaux sociaux.' },
              ].map((s, i) => (
                <div key={i} style={{ display:'flex', gap:12, marginBottom:14 }}>
                  <div style={{ flexShrink:0, width:30, height:30, borderRadius:99, background:'rgba(30,111,255,0.2)', border:'1px solid rgba(90,176,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', color:'#5BB0FF', fontWeight:800, fontSize:14 }}>{s.n}</div>
                  <div style={{ flex:1 }}>
                    <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:'0 0 2px' }}>{s.t}</p>
                    <p style={{ color:C.textSoft, fontSize:12, lineHeight:1.5, margin:0 }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Encart rémunération (nouveauté challenges) */}
            <div style={{ background:'rgba(245,200,76,0.08)', border:'1px solid rgba(245,200,76,0.25)', borderRadius:14, padding:'16px 18px', marginBottom:26 }}>
              <p style={{ color:C.gold, fontSize:14, fontWeight:800, margin:'0 0 8px' }}>Votre musique vous rapporte</p>
              <p style={{ color:C.textSoft, fontSize:13, lineHeight:1.6, margin:0 }}>
                Sur Doniel Zik, votre single ne dort jamais. Les mélomanes réalisent des <b style={{ color:C.text }}>challenges</b> sur votre musique et la partagent sur TikTok, Facebook et WhatsApp. À chaque fois que votre titre est utilisé et qu'un challenge reçoit des cadeaux, <b style={{ color:C.text }}>vous êtes rémunéré</b>. Plus votre musique circule, plus vous gagnez.
              </p>
            </div>

            <button onClick={() => setEtape('formulaire')}
              style={{ width:'100%', padding:16, borderRadius:14, border:'none', background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:16, cursor:'pointer' }}>
              Je m'inscris
            </button>
          </>
        )}

        {/* ── ÉTAPE FORMULAIRE ── */}
        {etape === 'formulaire' && (
          <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 6px' }}>Vos informations</h2>
            <p style={{ color:C.textSoft, fontSize:13, margin:'0 0 20px' }}>Renseignez vos coordonnées pour que notre équipe vous recontacte.</p>

            <label style={{ color:C.textSoft, fontSize:12, fontWeight:700, display:'block', marginBottom:6 }}>Nom d'artiste *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom d'artiste"
              style={{ width:'100%', padding:13, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, marginBottom:14, boxSizing:'border-box' }} />

            <label style={{ color:C.textSoft, fontSize:12, fontWeight:700, display:'block', marginBottom:6 }}>Téléphone (WhatsApp) *</label>
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Ex : 07 00 00 00 00" type="tel"
              style={{ width:'100%', padding:13, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, marginBottom:14, boxSizing:'border-box' }} />

            <label style={{ color:C.textSoft, fontSize:12, fontWeight:700, display:'block', marginBottom:6 }}>Email *</label>
            <input value={emailArt} onChange={e => setEmailArt(e.target.value)} placeholder="votre@email.com" type="email"
              style={{ width:'100%', padding:13, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, marginBottom:14, boxSizing:'border-box' }} />

            <label style={{ color:C.textSoft, fontSize:12, fontWeight:700, display:'block', marginBottom:6 }}>Votre projet (facultatif)</label>
            <textarea value={projet} onChange={e => setProjet(e.target.value)} placeholder="Parlez-nous de votre single, votre style, vos idées..." rows={3}
              style={{ width:'100%', padding:13, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:C.text, fontSize:14, marginBottom:18, boxSizing:'border-box', resize:'vertical' }} />

            {msg && <p style={{ color:'#f04a6a', fontSize:13, margin:'0 0 12px' }}>{msg}</p>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEtape('presentation')}
                style={{ flex:1, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:C.textSoft, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Retour
              </button>
              <button onClick={validerFormulaire}
                style={{ flex:2, padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                Continuer vers le contrat
              </button>
            </div>
          </>
        )}

        {/* ── ÉTAPE CONTRAT ── */}
        {etape === 'contrat' && (
          <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 6px' }}>Contrat de production</h2>
            <p style={{ color:C.textSoft, fontSize:13, margin:'0 0 18px' }}>Lisez attentivement, cochez votre accord et signez ci-dessous.</p>

            {/* Articles du contrat */}
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'16px 18px', marginBottom:18, maxHeight:320, overflowY:'auto' }}>
              {CONTRAT_PRODUCTION.map((a, i) => (
                <div key={i} style={{ marginBottom:14 }}>
                  <p style={{ color:C.gold, fontSize:13, fontWeight:800, margin:'0 0 4px' }}>{a.t}</p>
                  <p style={{ color:C.textSoft, fontSize:12.5, lineHeight:1.6, margin:0 }}>{a.c}</p>
                </div>
              ))}
            </div>

            {/* Case J'ai lu et j'accepte */}
            <label style={{ display:'flex', gap:10, alignItems:'flex-start', cursor:'pointer', marginBottom:18 }}>
              <input type="checkbox" checked={lu} onChange={e => setLu(e.target.checked)} style={{ marginTop:3, width:18, height:18, accentColor:'#1a6bff', flexShrink:0 }} />
              <span style={{ color:C.text, fontSize:13, lineHeight:1.5 }}>J'ai lu et j'accepte les conditions du contrat de production musicale de Doniel Zik.</span>
            </label>

            {/* Signature dessinée */}
            <p style={{ color:C.textSoft, fontSize:12, fontWeight:700, margin:'0 0 8px' }}>Votre signature (dessinez avec le doigt)</p>
            <div style={{ position:'relative', marginBottom:8 }}>
              <canvas ref={canvasRef} width={480} height={160}
                onMouseDown={debutTrait} onMouseMove={traitEnCours} onMouseUp={finTrait} onMouseLeave={finTrait}
                onTouchStart={debutTrait} onTouchMove={traitEnCours} onTouchEnd={finTrait}
                style={{ width:'100%', height:160, background:'#fff', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', touchAction:'none', display:'block' }} />
              {!aSigne && <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#c0c8d8', fontSize:13, pointerEvents:'none' }}>Signez ici</span>}
            </div>
            <button onClick={effacerSignature}
              style={{ background:'none', border:'none', color:C.textSoft, fontSize:12, cursor:'pointer', marginBottom:18, textDecoration:'underline' }}>
              Effacer la signature
            </button>

            {msg && <p style={{ color:'#f04a6a', fontSize:13, margin:'0 0 12px' }}>{msg}</p>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEtape('formulaire')}
                style={{ flex:1, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:C.textSoft, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Retour
              </button>
              <button onClick={signerEtEnvoyer} disabled={envoi}
                style={{ flex:2, padding:14, borderRadius:12, border:'none', background: envoi ? 'rgba(30,111,255,0.5)' : 'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:14, cursor: envoi ? 'default' : 'pointer' }}>
                {envoi ? 'Enregistrement...' : 'Signer et envoyer'}
              </button>
            </div>
          </>
        )}

        {/* ── ÉTAPE FAIT ── */}
        {etape === 'fait' && (
          <div style={{ textAlign:'center', padding:'40px 10px' }}>
            <div style={{ width:70, height:70, borderRadius:99, background:'rgba(0,200,83,0.15)', border:'1px solid rgba(0,200,83,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:34 }}>✓</div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 10px' }}>Demande enregistrée !</h2>
            <p style={{ color:C.textSoft, fontSize:14, lineHeight:1.6, margin:'0 0 24px' }}>
              Votre contrat est signé et votre demande de production est bien enregistrée. Notre équipe vous recontacte très vite au {tel} pour la suite.
            </p>
            <Lien href="/decouvrir" style={{ display:'inline-block', padding:'14px 28px', borderRadius:99, background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none' }}>
              Découvrir la plateforme
            </Lien>
          </div>
        )}

      </div>
    </div>
  );
}

function DzStudioPage() {
  const [view, setView] = useState<'login'|'register'|'dashboard'>('login');
  const [user, setUser] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<'campagne'|'admin'|'leads'|'chat'>('campagne');

  // Campagne
  const [campagnes, setCampagnes] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Chat admin
  const [adminMsgs, setAdminMsgs] = useState<any[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [adminSending, setAdminSending] = useState(false);
  const [unreadAdmin, setUnreadAdmin] = useState(0);

  // Leads & chat leads
  const [leads, setLeads] = useState<any[]>([]);
  const [chatLeadId, setChatLeadId] = useState<string|null>(null);
  const [leadMsgs, setLeadMsgs] = useState<any[]>([]);
  const [leadInput, setLeadInput] = useState('');
  const [leadSending, setLeadSending] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setView('dashboard'); }
      else { setView('login'); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Campagnes de cet annonceur (par email ou uid)
    const q1 = query(collection(db, 'annonceurs'), where('uid', '==', user.uid));
    const u1 = onSnapshot(q1, snap => setCampagnes(snap.docs.map(d => ({id:d.id,...d.data()}))));
    // Leads de ses campagnes
    const q2 = query(collection(db, 'leads'), where('annonceurId','==',user.uid), orderBy('createdAt','desc'));
    const u2 = onSnapshot(q2, snap => setLeads(snap.docs.map(d => ({id:d.id,...d.data()}))));
    // Messages admin → annonceur
    const q3 = query(collection(db, 'adminChats'), where('annonceurId','==',user.uid), orderBy('ts','asc'));
    const u3 = onSnapshot(q3, snap => {
      const msgs = snap.docs.map(d => ({id:d.id,...d.data()}));
      setAdminMsgs(msgs);
      setUnreadAdmin(msgs.filter((m:any) => m.from === 'admin' && !m.read).length);
    });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  // Messages du lead sélectionné
  useEffect(() => {
    if (!chatLeadId) return;
    const q = query(collection(db, 'leadMessages'), where('leadId','==',chatLeadId), orderBy('ts','asc'));
    const unsub = onSnapshot(q, snap => setLeadMsgs(snap.docs.map(d => ({id:d.id,...d.data()}))));
    return unsub;
  }, [chatLeadId]);

  const doLoginGoogle = async () => {
    setLoginLoading(true); setLoginMsg('');
    try { const p = new GoogleAuthProvider(); await signInWithPopup(auth, p); }
    catch (e:any) { setLoginMsg('Erreur: ' + e.message); }
    setLoginLoading(false);
  };

  const doLoginEmail = async () => {
    setLoginLoading(true); setLoginMsg('');
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPass); }
    catch { setLoginMsg('Email ou mot de passe incorrect'); }
    setLoginLoading(false);
  };

  const doRegister = async () => {
    if (!regName) { setLoginMsg('Entrez votre nom'); return; }
    setLoginLoading(true); setLoginMsg('');
    try {
      const r = await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
      await updateProfile(r.user, { displayName: regName });
    } catch (e:any) { setLoginMsg('Erreur: ' + e.message); }
    setLoginLoading(false);
  };

  // Upload visuel d'une campagne
  const uploadVisuel = async (campagneId: string, file: File) => {
    setUploading(true); setUploadMsg('Upload en cours...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      fd.append('resource_type', 'auto');
      fd.append('public_id', 'pubs/' + campagneId + '_visual');
      const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method:'POST', body:fd });
      const d = await r.json();
      await updateDoc(doc(db, 'annonceurs', campagneId), {
        visualUrl: d.secure_url,
        visualType: file.type.startsWith('video') ? 'video' : 'image',
      });
      setUploadMsg('Visuel uploadé !');
      // Notifier l'admin via adminChats
      await addDoc(collection(db, 'adminChats'), {
        annonceurId: campagneId, from: 'annonceur',
        text: 'Visuel uploadé — campagne prête pour validation.',
        ts: new Date().toISOString(), read: false,
      });
    } catch(e:any) { setUploadMsg('Erreur: ' + e.message); }
    setUploading(false);
  };

  // Envoyer message à l'admin
  const sendAdminMsg = async () => {
    if (!adminInput.trim() || !user) return;
    setAdminSending(true);
    // On utilise l'id de la première campagne comme identifiant de conversation
    const campId = campagnes[0]?.id || user.uid;
    await addDoc(collection(db, 'adminChats'), {
      annonceurId: campId, from: 'annonceur',
      text: adminInput.trim(), ts: new Date().toISOString(), read: false,
    });
    // Marquer les messages admin comme lus
    adminMsgs.filter((m:any) => m.from === 'admin' && !m.read).forEach(m =>
      updateDoc(doc(db, 'adminChats', m.id), { read: true })
    );
    setAdminInput(''); setAdminSending(false);
  };

  // Envoyer message à un lead
  const sendLeadMsg = async () => {
    if (!leadInput.trim() || !chatLeadId || !user) return;
    setLeadSending(true);
    await addDoc(collection(db, 'leadMessages'), {
      leadId: chatLeadId, annonceurId: user.uid,
      from: 'annonceur', text: leadInput.trim(), ts: new Date().toISOString(),
    });
    setLeadInput(''); setLeadSending(false);
  };

  const selectedLead = leads.find(l => l.id === chatLeadId);
  const pendingCamp = campagnes.filter(c => c.status === 'pending').length;
  const activeCamp = campagnes.filter(c => c.status === 'active').length;

  // ── Styles communs ──
  const darkInp: React.CSSProperties = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' };

  // ── LOGIN ──
  if (view !== 'dashboard') return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ width:'100%', maxWidth:380, animation:'fadeUp .35s ease' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Logo size="md" />
          <p style={{ color:'#ffd700', fontWeight:800, fontSize:16, marginTop:10 }}>DZ Studio</p>
          <p style={{ color:'#4a5878', fontSize:12, marginTop:4 }}>Dashboard Annonceur</p>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:'24px 20px' }}>
          <button onClick={doLoginGoogle} disabled={loginLoading}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, width:'100%', padding:'14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:14 }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuer avec Google
          </button>
          <div style={{ textAlign:'center', color:'#4a5878', fontSize:11, marginBottom:14 }}>— ou —</div>
          {view === 'register' && (
            <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Votre nom / entreprise" style={darkInp} />
          )}
          <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" type="email" style={darkInp} />
          <input value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Mot de passe" type="password" style={{ ...darkInp, marginBottom:14 }}
            onKeyDown={e => e.key==='Enter' && (view==='login' ? doLoginEmail() : doRegister())} />
          {loginMsg && <p style={{ color: loginMsg.startsWith('') ? '#4dff9a' : '#f04a6a', fontSize:12, marginBottom:10 }}>{loginMsg}</p>}
          <button onClick={view==='login' ? doLoginEmail : doRegister} disabled={loginLoading}
            style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#ff9500)', color:'#000', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
            {loginLoading ? '...' : view==='login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
          {view === 'login' && (
            <button onClick={async () => {
              if (!loginEmail) { setLoginMsg('Entrez votre email d\'abord'); return; }
              try {
                await demanderResetPassword(loginEmail);
                setLoginMsg('Email de réinitialisation envoyé à ' + loginEmail);
              } catch(e:any) {
                setLoginMsg('Email introuvable');
              }
            }}
              style={{ width:'100%', padding:'8px', background:'transparent', border:'none', color:'#4a5878', cursor:'pointer', fontSize:12, textDecoration:'underline', marginBottom:6 }}>
              Mot de passe oublié ?
            </button>
          )}
          <button onClick={() => { setView(view==='login'?'register':'login'); setLoginMsg(''); }}
            style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', cursor:'pointer', fontSize:13 }}>
            {view==='login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
        <p style={{ textAlign:'center', marginTop:16 }}>
          <Lien href="/annonceurs" style={{ color:'#4a5878', fontSize:12, textDecoration:'none' }}>← Soumettre une nouvelle campagne</Lien>
        </p>
      </div>
    </div>
  );

  // ── DASHBOARD ──
  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .lead-row:hover{background:rgba(255,200,0,0.06)!important}
        .dz-inp{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;}
        .dz-inp:focus{border-color:rgba(255,200,0,0.4)}
        .dz-inp::placeholder{color:rgba(255,255,255,0.3)}
      `}</style>

      {/* HEADER */}
      <div style={{ background:'rgba(6,8,15,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Logo size="sm" />
          <div>
            <p style={{ fontWeight:800, fontSize:13, color:'#ffd700', margin:0 }}>DZ Studio</p>
            <p style={{ color:'#4a5878', fontSize:10, margin:0 }}>{user?.displayName || user?.email}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {(pendingCamp > 0) && (
            <span style={{ background:'rgba(255,200,0,0.15)', border:'1px solid rgba(255,200,0,0.4)', borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700, color:'#ffd700' }}>
              {pendingCamp} en attente
            </span>
          )}
          <button onClick={() => signOut(auth)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', color:'#8098b8', cursor:'pointer', fontSize:11 }}>Déco</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px', display:'flex', background:'rgba(6,8,15,0.9)', overflowX:'auto' }}>
        {([
          ['campagne', 'Campagnes'],
          ['admin', `Admin${unreadAdmin > 0 ? ` (${unreadAdmin})` : ''}`],
          ['leads', `Leads${leads.length > 0 ? ` (${leads.length})` : ''}`],
          ['chat', 'Chat leads'],
        ] as [string,string][]).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            style={{ padding:'12px 14px', border:'none', background:'transparent', color: tab===t ? '#ffd700' : '#4a5878', cursor:'pointer', fontSize:12, fontWeight: tab===t ? 700 : 400, borderBottom:`2px solid ${tab===t?'#ffd700':'transparent'}`, whiteSpace:'nowrap', flexShrink:0 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'20px 16px' }}>

        {/* ── CAMPAGNES ── */}
        {tab === 'campagne' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            {/* Statut global */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
              {[
                { label:'Actives', val:activeCamp, icon:'', color:'#4dff9a' },
                { label:'En attente', val:pendingCamp, icon:'', color:'#ffd700' },
                { label:'Leads total', val:leads.length, icon:'', color:'#4da6ff' },
              ].map((s,i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:20, marginBottom:4 }}>{s.icon}</p>
                  <p style={{ fontWeight:900, fontSize:22, color:s.color, margin:0 }}>{s.val}</p>
                  <p style={{ color:'#4a5878', fontSize:10, margin:'3px 0 0' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {campagnes.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', background:'rgba(255,255,255,0.03)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color:'#4a5878', fontSize:13, marginBottom:14 }}>Aucune campagne pour l'instant</p>
                <Lien href="/annonceurs" style={{ display:'inline-block', padding:'12px 24px', borderRadius:12, background:'linear-gradient(135deg,#ffd700,#ff9500)', color:'#000', fontWeight:800, fontSize:14, textDecoration:'none' }}>
                  Créer ma première campagne →
                </Lien>
              </div>
            ) : campagnes.map(c => (
              <div key={c.id} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${c.status==='active'?'rgba(77,255,154,0.3)':c.status==='rejected'?'rgba(240,74,106,0.3)':'rgba(255,200,0,0.25)'}`, borderRadius:16, padding:16, marginBottom:14 }}>
                {/* Status + nom */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <p style={{ fontWeight:700, fontSize:15, color:'#fff', margin:0 }}>{c.entreprise || c.nom}</p>
                    <p style={{ color:'#4a5878', fontSize:11, margin:'3px 0 0' }}>{c.format} · {c.objectif} · {(c.vues||0).toLocaleString()} vues · {(c.cout||0).toLocaleString()} FCFA</p>
                  </div>
                  <span style={{
                    background: c.status==='active'?'rgba(77,255,154,0.12)':c.status==='rejected'?'rgba(240,74,106,0.12)':'rgba(255,200,0,0.12)',
                    border: `1px solid ${c.status==='active'?'rgba(77,255,154,0.4)':c.status==='rejected'?'rgba(240,74,106,0.4)':'rgba(255,200,0,0.4)'}`,
                    borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700,
                    color: c.status==='active'?'#4dff9a':c.status==='rejected'?'#f04a6a':'#ffd700',
                  }}>
                    {c.status==='active'?'● Actif':c.status==='rejected'?'✕ Rejeté':'En attente'}
                  </span>
                </div>

                {/* Métriques live */}
                {c.status === 'active' && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                    {[
                      { label:'Vues', val:(c.vuesLive||0).toLocaleString(), color:'#ffd700' },
                      { label:'Clics', val:(c.clics||0).toLocaleString(), color:'#4da6ff' },
                      { label:'Leads', val:(c.leads||0).toLocaleString(), color:'#4dff9a' },
                    ].map((s,i) => (
                      <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                        <p style={{ fontWeight:900, fontSize:18, color:s.color, margin:0 }}>{s.val}</p>
                        <p style={{ color:'#4a5878', fontSize:9, margin:'2px 0 0' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visuel uploadé */}
                {c.visualUrl ? (
                  <div style={{ marginBottom:12, borderRadius:10, overflow:'hidden' }}>
                    {c.visualType === 'video' ? (
                      <video src={c.visualUrl} controls style={{ width:'100%', maxHeight:180, background:'#000' }} />
                    ) : (
                      <img src={c.visualUrl} alt="visuel" style={{ width:'100%', maxHeight:180, objectFit:'cover' }} />
                    )}
                  </div>
                ) : (
                  /* Zone upload visuel */
                  <div style={{ border:'2px dashed rgba(255,200,0,0.3)', borderRadius:12, padding:16, textAlign:'center', marginBottom:12 }}>
                    <p style={{ color:'#4a5878', fontSize:12, marginBottom:10 }}>
                      {c.status === 'active' ? 'Uploadez votre visuel pour activer la diffusion' : 'Uploadez votre visuel (image ou vidéo)'}
                    </p>
                    <input type="file" accept="image/*,video/*" id={'vis-'+c.id} style={{ display:'none' }}
                      onChange={async e => { if (e.target.files?.[0]) await uploadVisuel(c.id, e.target.files[0]); }} />
                    <label htmlFor={'vis-'+c.id}
                      style={{ display:'inline-block', padding:'10px 20px', borderRadius:10, background:'rgba(255,200,0,0.15)', border:'1px solid rgba(255,200,0,0.4)', color:'#ffd700', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                      {uploading ? uploadMsg : '⬆ Choisir un fichier'}
                    </label>
                    {uploadMsg && !uploading && <p style={{ color:'#4dff9a', fontSize:11, marginTop:8 }}>{uploadMsg}</p>}
                  </div>
                )}

                {c.status === 'pending' && (
                  <div style={{ background:'rgba(255,200,0,0.08)', border:'1px solid rgba(255,200,0,0.2)', borderRadius:10, padding:'10px 14px' }}>
                    <p style={{ color:'#ffd700', fontSize:12, fontWeight:700, margin:'0 0 2px' }}>En attente de validation</p>
                    <p style={{ color:'#4a5878', fontSize:11, margin:0 }}>Notre équipe vérifie votre campagne. Vous recevrez une notification dans l'onglet Admin.</p>
                  </div>
                )}
                {c.status === 'rejected' && (
                  <div style={{ background:'rgba(240,74,106,0.08)', border:'1px solid rgba(240,74,106,0.2)', borderRadius:10, padding:'10px 14px' }}>
                    <p style={{ color:'#f04a6a', fontSize:12, fontWeight:700, margin:'0 0 4px' }}>✕ Campagne refusée</p>
                    <button onClick={() => setTab('admin')} style={{ background:'none', border:'none', color:'#4da6ff', cursor:'pointer', fontSize:12, padding:0, textDecoration:'underline' }}>
                      Voir les détails dans Admin chat →
                    </button>
                  </div>
                )}
              </div>
            ))}

            <Lien href="/annonceurs" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'14px', borderRadius:14, border:'1px solid rgba(255,200,0,0.25)', background:'rgba(255,200,0,0.06)', color:'#ffd700', textDecoration:'none', fontWeight:700, fontSize:14, boxSizing:'border-box' }}>
              Créer une nouvelle campagne
            </Lien>
          </div>
        )}

        {/* ── CHAT ADMIN ── */}
        {tab === 'admin' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <p style={{ color:'#4a5878', fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:14 }}>MESSAGERIE AVEC DONIEL ZIK</p>
            <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)', minHeight:300, maxHeight:440, overflowY:'auto', padding:14, marginBottom:12 }}>
              {adminMsgs.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#2a3a60', fontSize:13 }}>Pas encore de messages</p>
                  <p style={{ color:'#2a3a60', fontSize:11, marginTop:4 }}>Posez vos questions à l'équipe Doniel Zik ici</p>
                </div>
              ) : adminMsgs.map(m => (
                <div key={m.id} style={{ marginBottom:10, display:'flex', justifyContent: m.from==='annonceur' ? 'flex-end' : 'flex-start' }}>
                  <div>
                    {m.from === 'admin' && (
                      <p style={{ color:'#ffd700', fontSize:9, fontWeight:700, marginBottom:3, marginLeft:3 }}>DONIEL ZIK</p>
                    )}
                    <div style={{ maxWidth:'78%', padding:'10px 14px', borderRadius: m.from==='annonceur'?'14px 14px 4px 14px':'14px 14px 14px 4px', background: m.from==='annonceur'?'rgba(255,200,0,0.15)':'rgba(255,255,255,0.07)', border: m.from==='annonceur'?'1px solid rgba(255,200,0,0.3)':'1px solid rgba(255,255,255,0.1)' }}>
                      <p style={{ color:'#dde4f5', fontSize:14, margin:0, lineHeight:1.5 }}>{m.text}</p>
                      <p style={{ color:'#4a5878', fontSize:9, margin:'4px 0 0', textAlign:'right' }}>{new Date(m.ts).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="dz-inp" value={adminInput} onChange={e => setAdminInput(e.target.value)}
                onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendAdminMsg()}
                placeholder="Écrire à l'équipe Doniel Zik..." />
              <button onClick={sendAdminMsg} disabled={adminSending || !adminInput.trim()}
                style={{ width:44, height:44, borderRadius:10, border:'none', background: adminInput.trim()?'linear-gradient(135deg,#ffd700,#ff9500)':'rgba(255,255,255,0.08)', color: adminInput.trim()?'#000':'#4a5878', cursor: adminInput.trim()?'pointer':'default', fontSize:18, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                ➤
              </button>
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === 'leads' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <p style={{ color:'#4a5878', fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:12 }}>PROSPECTS INTÉRESSÉS PAR MA PUB</p>
            {leads.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', background:'rgba(255,255,255,0.03)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color:'#4a5878', fontSize:13 }}>Aucun lead pour l'instant</p>
                <p style={{ color:'#2a3a60', fontSize:11, marginTop:4 }}>Les prospects qui cliquent sur votre pub et laissent leur numéro apparaissent ici</p>
              </div>
            ) : leads.map(l => (
              <div key={l.id} className="lead-row"
                style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', marginBottom:10, cursor:'pointer', transition:'background .15s' }}
                onClick={() => { setChatLeadId(l.id); setTab('chat'); }}>
                <div style={{ width:40, height:40, borderRadius:99, background:'linear-gradient(135deg,rgba(255,200,0,0.2),rgba(255,100,0,0.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:14, color:'#dde4f5', margin:0 }}>{l.telephone}</p>
                  <p style={{ color:'#4a5878', fontSize:11, margin:'2px 0 0' }}>{new Date(l.createdAt).toLocaleDateString('fr')} · {l.campagneLabel||'Campagne'}</p>
                </div>
                <span style={{ color:'#4da6ff', fontSize:18 }}>→</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CHAT LEADS ── */}
        {tab === 'chat' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            {!chatLeadId ? (
              <div style={{ textAlign:'center', padding:'40px 20px', background:'rgba(255,255,255,0.03)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color:'#4a5878', fontSize:13 }}>Sélectionnez un prospect dans Leads</p>
                <button onClick={() => setTab('leads')} style={{ marginTop:12, padding:'10px 20px', borderRadius:10, border:'none', background:'rgba(255,200,0,0.15)', color:'#ffd700', cursor:'pointer', fontWeight:700, fontSize:13 }}>Voir mes leads</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, padding:'12px 14px', background:'rgba(255,255,255,0.04)', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setChatLeadId(null)} style={{ background:'none', border:'none', color:'#8098b8', cursor:'pointer', fontSize:18, padding:0 }}>←</button>
                  <div style={{ width:36, height:36, borderRadius:99, background:'linear-gradient(135deg,rgba(255,200,0,0.2),rgba(255,100,0,0.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                  <div>
                    <p style={{ fontWeight:700, fontSize:14, color:'#dde4f5', margin:0 }}>{selectedLead?.telephone}</p>
                    <p style={{ color:'#4dff9a', fontSize:10, margin:'1px 0 0' }}>● Prospect intéressé</p>
                  </div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)', minHeight:280, maxHeight:360, overflowY:'auto', padding:14, marginBottom:12 }}>
                  {leadMsgs.length === 0 ? (
                    <p style={{ textAlign:'center', color:'#2a3a60', fontSize:12, marginTop:60 }}>Démarrez la conversation</p>
                  ) : leadMsgs.map(m => (
                    <div key={m.id} style={{ marginBottom:10, display:'flex', justifyContent: m.from==='annonceur'?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'75%', padding:'10px 14px', borderRadius: m.from==='annonceur'?'14px 14px 4px 14px':'14px 14px 14px 4px', background: m.from==='annonceur'?'rgba(255,200,0,0.15)':'rgba(255,255,255,0.06)', border: m.from==='annonceur'?'1px solid rgba(255,200,0,0.3)':'1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ color:'#dde4f5', fontSize:14, margin:0, lineHeight:1.5 }}>{m.text}</p>
                        <p style={{ color:'#4a5878', fontSize:9, margin:'4px 0 0', textAlign:'right' }}>{new Date(m.ts).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="dz-inp" value={leadInput} onChange={e => setLeadInput(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendLeadMsg()}
                    placeholder="Écrire au prospect..." />
                  <button onClick={sendLeadMsg} disabled={leadSending || !leadInput.trim()}
                    style={{ width:44, height:44, borderRadius:10, border:'none', background: leadInput.trim()?'linear-gradient(135deg,#ffd700,#ff9500)':'rgba(255,255,255,0.08)', color: leadInput.trim()?'#000':'#4a5878', cursor: leadInput.trim()?'pointer':'default', fontSize:18, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WIDGET PUB — affiché dans FanPage/PublicStreamPage
// Le fan voit la pub et peut laisser son numéro
// ─────────────────────────────────────────────
function PubWidget({ annonceurId, campagneId, campagneLabel }: { annonceurId:string, campagneId:string, campagneLabel:string }) {
  const [showForm, setShowForm] = useState(false);
  const [tel, setTel] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!tel || !accepted) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'leads'), {
        annonceurId, campagneId, campagneLabel,
        telephone: tel, createdAt: new Date().toISOString(),
      });
      // Incrémenter leads sur la campagne
      await updateDoc(doc(db, 'annonceurs', campagneId), { leads: 1 }); // simplifié
      setSent(true);
    } catch(e) { console.error(e); }
    setSending(false);
  };

  if (sent) return (
    <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(77,255,154,0.1)', border:'1px solid rgba(77,255,154,0.3)', display:'flex', alignItems:'center', gap:10 }}>
            <p style={{ color:'#4dff9a', fontSize:13, fontWeight:700, margin:0 }}>L'annonceur va vous contacter !</p>
    </div>
  );

  return (
    <div style={{ background:'rgba(255,200,0,0.06)', border:'1px solid rgba(255,200,0,0.2)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ background:'rgba(255,200,0,0.15)', borderRadius:6, padding:'3px 7px', fontSize:9, fontWeight:700, color:'#ffd700' }}>PUB</span>
          <p style={{ color:'#dde4f5', fontSize:13, fontWeight:600, margin:0 }}>{campagneLabel}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ background:'rgba(255,200,0,0.15)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:8, padding:'6px 12px', color:'#ffd700', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            En savoir plus
          </button>
        )}
      </div>
      {showForm && (
        <div style={{ padding:'0 16px 14px', borderTop:'1px solid rgba(255,200,0,0.15)' }}>
          <p style={{ color:'#6a88aa', fontSize:12, marginBottom:10 }}>Laissez votre numéro pour être contacté</p>
          <input value={tel} onChange={e => setTel(e.target.value)} placeholder="+225 07 00 00 00 00" type="tel"
            style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' }} />
          <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:12 }}>
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} id="cgu-pub" style={{ marginTop:2, flexShrink:0 }} />
            <label htmlFor="cgu-pub" style={{ color:'#4a5878', fontSize:11, lineHeight:1.5 }}>
              J'accepte d'être contacté par l'annonceur via WhatsApp ou appel téléphonique.
            </label>
          </div>
          <button onClick={submit} disabled={!tel||!accepted||sending}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background: tel&&accepted?'linear-gradient(135deg,#ffd700,#ff9500)':'rgba(255,255,255,0.08)', color: tel&&accepted?'#000':'#4a5878', fontWeight:700, fontSize:14, cursor: tel&&accepted?'pointer':'default' }}>
            {sending ? '...' : 'Je suis intéressé'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE D'ACCUEIL
// ─────────────────────────────────────────────
function HomePage() {
  const [activeNote, setActiveNote] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setActiveNote(n => (n + 1) % 8), 600);
    const t2 = setInterval(() => setWavePhase(p => (p + 1) % 100), 50);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const etapes = [
    { num: '01', icon: '', title: "L'artiste crée son QR", desc: "Il s'inscrit sur Doniel Zik, uploade sa musique et reçoit un QR code unique lié à sa pochette." },
    { num: '02', icon: '', title: 'Il imprime sur sa pochette', desc: 'Le QR code est imprimé sur la pochette physique que l\'artiste vend directement à ses fans.' },
    { num: '03', icon: '', title: 'Le fan scanne', desc: 'Le fan scanne la pochette avec son téléphone. La musique s\'ouvre instantanément, sans appli.' },
    { num: '04', icon: '', title: 'Il écoute et télécharge', desc: 'Streaming gratuit illimité. Téléchargement des fichiers originaux en qualité maximale.' },
  ];

  const notes = ['','','','','','','',''];

  return (
    <div style={{ minHeight: '100vh', background: `${GLOW_TOP}, ${C.bgDeep}`, color: C.text, fontFamily: "'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(0.95)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes wave{0%{transform:scaleY(0.3)}50%{transform:scaleY(1)}100%{transform:scaleY(0.3)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px #1a6bff66}50%{box-shadow:0 0 60px #1a6bffcc, 0 0 100px #1a6bff44}}
        @keyframes colorShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes noteFloat{0%{opacity:0;transform:translateY(0) rotate(0deg)}50%{opacity:1}100%{opacity:0;transform:translateY(-80px) rotate(20deg)}}
        .nav-link:hover{color:#1a6bff !important;transform:translateY(-2px)}
        .btn-glow:hover{transform:translateY(-3px);box-shadow:0 8px 40px #1a6bff66 !important}
        .card-hover:hover{transform:translateY(-6px);border-color:#1a6bff66 !important}
      `}</style>

      {/* NAVBAR */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,13,40,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(26,107,255,0.2)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size="sm" />
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 15, background: 'linear-gradient(90deg, #1a6bff, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DONIEL ZIK</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['Artistes','/artiste'],['Annonceurs','/annonceurs'],['Zikothèque','/ziko']].map(([l,h]) => (
            <a key={h} href={h} className="nav-link" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8, transition: 'all .2s' }}>{l}</a>
          ))}
          <Lien href="/artiste" className="btn-glow" style={{ background: 'linear-gradient(135deg, #1a6bff, #0050d0)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 99, boxShadow: '0 4px 20px #1a6bff44', transition: 'all .2s' }}>Démarrer →</Lien>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', padding: '80px 24px 60px', textAlign: 'center', maxWidth: 860, margin: '0 auto', overflow: 'hidden' }}>
        {/* Cercles lumineux de fond */}
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,107,255,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 50, left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 100, right: '5%', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,200,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Notes flottantes */}
        {notes.map((n, i) => (
          <span key={i} style={{ position: 'absolute', fontSize: 20, top: `${20 + (i * 12) % 60}%`, left: `${5 + (i * 13) % 90}%`, animation: `noteFloat ${2 + (i * 0.4)}s ease-in-out ${i * 0.3}s infinite`, opacity: 0, pointerEvents: 'none' }}>{n}</span>
        ))}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(26,107,255,0.15)', border: '1px solid rgba(26,107,255,0.5)', borderRadius: 99, padding: '6px 16px', marginBottom: 28, animation: 'fadeUp .5s ease', maxWidth: '90%' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#1a6bff', animation: 'pulse 1.5s infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#1a6bff', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>DISTRIBUTION MUSICALE NOUVELLE GÉNÉRATION</span>
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 7vw, 68px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 24, animation: 'fadeUp .6s ease .1s both' }}>
          Ta Musique.<br />
          <span style={{ background: 'linear-gradient(90deg, #1a6bff, #ffd700, #1a6bff)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'colorShift 3s linear infinite' }}>Un Scan.</span>
          {' '}Un Monde.
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, lineHeight: 1.9, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px', animation: 'fadeUp .6s ease .2s both', fontFamily: "'DM Sans', sans-serif" }}>
          Doniel Zik connecte les artistes africains à leurs fans via des QR codes sur pochettes physiques. Distribution simple. Revenus réels. Droits conservés à 100%.
        </p>

        {/* ONDES SONORES ANIMÉES */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 5, height: 50, marginBottom: 40, animation: 'fadeUp .6s ease .3s both' }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} style={{ width: 5, borderRadius: 99, background: `linear-gradient(180deg, #1a6bff, #ffd700)`, animation: `wave ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.08}s infinite`, height: `${20 + Math.sin(i + wavePhase * 0.1) * 15 + 15}px`, opacity: activeNote === i % 8 ? 1 : 0.5, transition: 'opacity .3s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp .6s ease .4s both', padding: '0 16px' }}>
          <Lien href="/artiste" className="btn-glow" style={{ background: 'linear-gradient(135deg, #1a6bff, #0050d0)', color: '#fff', textDecoration: 'none', padding: '16px 28px', fontSize: 16, borderRadius: 99, fontWeight: 700, boxShadow: '0 6px 30px #1a6bff55', transition: 'all .25s', display: 'inline-block' }}>
            Je suis artiste
          </Lien>
          <Lien href="/annonceurs" style={{ textDecoration: 'none', padding: '16px 28px', fontSize: 16, borderRadius: 99, border: '2px solid rgba(255,255,255,0.25)', color: '#fff', background: 'rgba(255,255,255,0.05)', display: 'inline-block', fontWeight: 600, transition: 'all .25s', backdropFilter: 'blur(10px)' }}>
            Je veux annoncer
          </Lien>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '20px 24px 48px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { val: '100+', label: 'Artistes', icon: '', color: '#1a6bff' },
            { val: '5 000+', label: 'QR codes', icon: '', color: '#ffd700' },
            { val: '50 000+', label: 'Écoutes', icon: '', color: '#64c8ff' },
            { val: 'Abidjan', label: '& partout', icon: '', color: '#7fff64' },
          ].map((s, i) => (
            <div key={i} className="card-hover" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 12px', textAlign: 'center', transition: 'all .3s', cursor: 'default' }}>
              <p style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</p>
              <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 20, color: s.color, marginBottom: 3 }}>{s.val}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{ padding: '48px 24px', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#1a6bff', fontSize: 11, letterSpacing: 4, fontWeight: 700, marginBottom: 10 }}>— FONCTIONNEMENT —</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900 }}>Comment ça marche ?</h2>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {etapes.map((e, i) => (
            <div key={i} className="card-hover" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '22px 24px', transition: 'all .3s' }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg, rgba(26,107,255,0.25), rgba(255,215,0,0.15))', border: '1px solid rgba(26,107,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{e.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ color: '#1a6bff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12 }}>{e.num}</span>
                  <p style={{ fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>{e.title}</p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.75 }}>{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 PROFILS */}
      <section style={{ padding: '48px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ color: '#1a6bff', fontSize: 11, letterSpacing: 4, fontWeight: 700, marginBottom: 10 }}>— POUR TOUT LE MONDE —</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900 }}>Vous êtes…</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '', title: 'Artiste', color: '#1a6bff', grad: 'rgba(26,107,255,0.12)', items: ['QR code sur ta pochette', 'Streaming & téléchargement', 'Revenus par écoute', 'Droits conservés à 100%'], cta: 'Créer mon QR', href: '/artiste' },
              { icon: '', title: 'Mélomane', color: '#64c8ff', grad: 'rgba(100,200,255,0.12)', items: ['Scanner la pochette', 'Écouter gratuitement', 'Télécharger la musique', 'Accéder à ta Zikothèque'], cta: 'Ma Zikothèque', href: '/ziko' },
              { icon: '', title: 'Annonceur', color: '#ffd700', grad: 'rgba(255,215,0,0.12)', items: ['Pub avant chaque écoute', 'Audience locale engagée', 'Stats de campagne', 'Budget flexible'], cta: 'Annoncer', href: '/annonceurs' },
            ].map((p, i) => (
              <div key={i} className="card-hover" style={{ background: p.grad, border: `1px solid ${p.color}33`, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', transition: 'all .3s' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>{p.icon}</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, marginBottom: 14, color: p.color }}>{p.title}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', flex: 1 }}>
                  {p.items.map((item, j) => (
                    <li key={j} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.9, display: 'flex', gap: 6 }}>
                      <span style={{ color: p.color }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
                <a href={p.href} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 12, border: `2px solid ${p.color}`, color: p.color, textDecoration: 'none', fontWeight: 700, fontSize: 13, transition: 'all .2s', background: `${p.color}11` }}>{p.cta} →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 14, background: 'linear-gradient(90deg, #1a6bff, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 10 }}>
          DONIEL ZIK — La Musique. Un Scan. Un Monde.
        </p>
        <p style={{ color: '#b0c4d8', fontSize: 11 }}>
          © 2025 ·{' '}
          <Lien href="/conditions" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'underline' }}>CGU</Lien> ·{' '}
          <Lien href="/annonceurs" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'underline' }}>Annonceurs</Lien> ·{' '}
          <Lien href="/admin" style={{ color: 'transparent', textDecoration: 'none', fontSize: 4, opacity: 0.05 }}>·</Lien>
        </p>
      </footer>
    </div>
  );
}


function PWAInstallBanner() {
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Déjà installé en mode standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true); return;
    }
    // Écouter l'événement d'installation disponible
    const onAvailable = () => { setCanInstall(true); setShow(true); };
    window.addEventListener('pwaInstallAvailable', onAvailable);
    if ((window as any).installPWA) onAvailable();
    // Afficher le bouton même sans l'événement après 3s
    const t = setTimeout(() => { if (!installed) setShow(true); }, 3000);
    return () => { window.removeEventListener('pwaInstallAvailable', onAvailable); clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showInstructions, setShowInstructions] = useState(false);

  const handleInstall = async () => {
    if ((window as any).installPWA) {
      await (window as any).installPWA();
      setInstalled(true); setShow(false);
    } else {
      setShowInstructions(true);
    }
  };

  if (installed || !show) return null;

  // Détecter Android
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <>
      <style>{`
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pulse2{0%,100%{box-shadow:0 0 0 0 rgba(30,111,255,0.4)}50%{box-shadow:0 0 0 8px rgba(30,111,255,0)}}
      `}</style>

      {/* Modal instructions */}
      {showInstructions && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowInstructions(false)}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'#dce6f7', margin:'0 auto 20px' }} />
            <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', marginBottom:6 }}>Installer Doniel Zik</p>
            <p style={{ color:'#8098b8', fontSize:13, marginBottom:20 }}>Choisissez votre méthode d'installation :</p>

            {/* Android — installation PWA (plus d'APK direct) */}
            {isAndroid && (
              <div style={{ background:'#f0f9ff', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'2px solid #1a6bff' }}>
                <p style={{ fontWeight:800, fontSize:14, color:'#1a2340', marginBottom:8 }}>Android — Installer l'application</p>
                <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.6, marginBottom:12 }}>
                  Installez Doniel Zik directement sur votre écran d'accueil, comme une vraie application.
                </p>
                <button onClick={() => { if ((window as any).installPWA) { (window as any).installPWA(); } else { alert('Ouvrez le menu de votre navigateur (⋮) puis appuyez sur "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".'); } }}
                  style={{ display:'block', width:'100%', padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', textAlign:'center' }}>
                  Installer l'application
                </button>
              </div>
            )}

            {/* iPhone */}
            {isIOS && (
              <div style={{ background:'#f5f8ff', borderRadius:12, padding:'12px 16px', marginBottom:10 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'#1a2340', marginBottom:6 }}>iPhone Safari</p>
                <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.7 }}>
                  1. Appuyez sur le bouton <strong>Partager ⬆</strong><br/>
                  2. Faites défiler et appuyez <strong>"Sur l'écran d'accueil"</strong><br/>
                  3. Appuyez <strong>"Ajouter"</strong>
                </p>
              </div>
            )}

            {/* Chrome Android PWA */}
            {isAndroid && (
              <div style={{ background:'#f5f8ff', borderRadius:12, padding:'12px 16px', marginBottom:10 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'#1a2340', marginBottom:6 }}>Ou via Chrome — PWA</p>
                <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.7 }}>
                  1. Appuyez sur les <strong>3 points ⋮</strong> en haut à droite<br/>
                  2. Appuyez sur <strong>"Ajouter à l'écran d'accueil"</strong><br/>
                  3. Confirmez en appuyant <strong>"Ajouter"</strong>
                </p>
              </div>
            )}

            {/* Autres navigateurs */}
            {!isAndroid && !isIOS && (
              <div style={{ background:'#f5f8ff', borderRadius:12, padding:'12px 16px', marginBottom:10 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'#1a2340', marginBottom:6 }}>Navigateur</p>
                <p style={{ color:'#5a7090', fontSize:13, lineHeight:1.7 }}>
                  Cliquez sur l'icône d'installation dans la barre d'adresse de votre navigateur.
                </p>
              </div>
            )}

            <button onClick={() => setShowInstructions(false)}
              style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', marginTop:8 }}>
              Compris
            </button>
          </div>
        </div>
      )}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9999, background:'#fff', borderTop:'2px solid #1a6bff', boxShadow:'0 -4px 24px rgba(26,107,255,0.2)', padding:'14px 20px', animation:'slideUp .4s ease', display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:'linear-gradient(135deg,#1a3a7e,#0a1535)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
            <text x="0" y="16" fontFamily="Arial Black,sans-serif" fontSize="18" fontWeight="900" fill="#1a6bff">D</text>
            <text x="13" y="16" fontFamily="Arial Black,sans-serif" fontSize="18" fontWeight="900" fill="#4da6ff">Z</text>
          </svg>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'#1a2340', marginBottom:2 }}>Installer Doniel Zik</p>
          <p style={{ color:'#8098b8', fontSize:12 }}>
            {isAndroid ? 'Accès rapide · Fonctionne hors-ligne' : 'Accès rapide · Fonctionne hors-ligne'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={() => setShow(false)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #dce6f7', background:'transparent', color:'#8098b8', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            Plus tard
          </button>
          {isAndroid ? (
            <button id="pwa-install-btn" onClick={handleInstall}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#1a6bff', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', animation:'pulse2 2s ease infinite' }}>
              Installer
            </button>
          ) : (
            <button id="pwa-install-btn" onClick={handleInstall}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#1a6bff', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', animation:'pulse2 2s ease infinite' }}>
              Installer
            </button>
          )}
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// OSCART PAY BUTTON — payer avec Oscart ou recharger
// ─────────────────────────────────────────────
// Incrémente le compteur de téléchargements d'un QR code de DUPLICATION physique
// (qrcodes.downloads/usedScans) — uniquement pour les téléchargements qui viennent
// réellement du scan d'un QR physique (page /fan/:qrId), jamais depuis Découvrir/
// streaming, pour ne pas fausser le compte de pochettes physiques vendues.
async function compterTelechargementQrcode(qrId: string) {
  if (!qrId) return;
  try {
    const snap = await getDocs(query(collection(db, 'qrcodes'), where('qrId', '==', qrId)));
    if (!snap.empty) {
      const ref0 = snap.docs[0];
      const d = ref0.data();
      await updateDoc(doc(db, 'qrcodes', ref0.id), {
        downloads: (d.downloads || 0) + 1,
        usedScans: (d.usedScans || 0) + 1,
      });
    }
  } catch (e) { console.error('compterTelechargementQrcode', e); }
}

// Incrémente le compteur de téléchargements d'un LIEN PUBLIC de monétisation
// (publicLinks.downloads) — pour tout ce qui vient de Découvrir/streaming, séparé
// à 100% du compteur des QR de duplication physique.
async function compterTelechargementLienPublic(publicLinkId: string) {
  if (!publicLinkId) return;
  try {
    const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', publicLinkId)));
    if (!snap.empty) {
      const ref0 = snap.docs[0];
      const d = ref0.data();
      await updateDoc(doc(db, 'publicLinks', ref0.id), { downloads: (d.downloads || 0) + 1 });
    }
  } catch (e) { console.error('compterTelechargementLienPublic', e); }
}

function OscartPayButton({ prix, qrId, albumLabel, artistEmail, files, source }: {
  prix: number, qrId: string, albumLabel: string, artistEmail: string, files: any[], source?: 'qr' | 'public'
}) {
  const [solde, setSolde] = useState(0);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [rechargeModal, setRechargeModal] = useState<{fcfa:number,oscart:number}|null>(null);
  const user = auth.currentUser;
  const prixOscart = Math.ceil(prix / 10);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db,'coins_solde'), where('uid','==',user.uid)),
      snap => setSolde(snap.empty ? 0 : snap.docs[0].data().solde || 0)
    );
    return unsub;
  }, [user]);

  const payer = async () => {
    if (!user || solde < prixOscart) return;
    setPaying(true);
    try {
      const kiffsGagnes = prixOscart * 250;
      const snap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      if (!snap.empty) {
        const curSolde = snap.docs[0].data();
        await updateDoc(doc(db,'coins_solde',snap.docs[0].id), {
          solde: solde - prixOscart,
          kiffsDispo: (curSolde.kiffsDispo || 0) + kiffsGagnes,
        });
      }
      logTx(user.uid, 'telechargement', -prixOscart, kiffsGagnes, 'Téléchargement');
      const artSnap = await getDocs(query(collection(db,'artists'), where('email','==',artistEmail)));
      const commercialEmail = artSnap.empty ? '' : (artSnap.docs[0].data().commercialEmail || '');
      await addDoc(collection(db,'ventes'), {
        qrId, artistEmail, albumLabel, prix, prixOscart,
        userId: user.uid,
        partArtiste: Math.round(prix * 0.70),
        partEntreprise: Math.round(prix * 0.20),
        partCommercial: Math.round(prix * 0.10),
        commercialEmail, dlActive: true,
        statut: 'paid', createdAt: new Date().toISOString(),
      });
      // en arrière-plan, ne bloque pas le téléchargement — compteur séparé selon
      // l'origine : QR de duplication physique VS lien public de monétisation
      if (source === 'public') compterTelechargementLienPublic(qrId);
      else compterTelechargementQrcode(qrId);
      setDone(true);
    } catch(e) { console.error(e); }
    setPaying(false);
  };

  // Téléchargement piste par piste (plus de ZIP — chaque fichier compte comme
  // un vrai téléchargement individuel, plus fiable pour le suivi).
  const [confirme, setConfirme] = useState(false);
  const telechargerFichier = (f: any) => {
    const a = document.createElement('a');
    a.href = f.url.replace('/upload/','/upload/fl_attachment/');
    a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setConfirme(true); setTimeout(() => setConfirme(false), 4000);
  };

  if (done) return (
    <>
      {(!files || files.length <= 1) ? (
        <button onClick={() => files?.[0] && telechargerFichier(files[0])}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#4dff9a,#00c060)', color:'#000', fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Télécharger maintenant
        </button>
      ) : (
        <div style={{ display:'grid', gap:8 }}>
          {files.map((f: any, i: number) => (
            <button key={i} onClick={() => telechargerFichier(f)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, border:'none', background:'rgba(0,212,154,0.12)', color:'#4dff9a', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'left' }}>
              <span style={{ fontSize:16 }}>⬇</span>
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(f.name || 'Piste ' + (i + 1)).replace(/\.[^/.]+$/, '')}</span>
            </button>
          ))}
        </div>
      )}
      {confirme && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)' }}>
          <span style={{ color:'#00d49a', fontSize:16 }}>✓</span>
          <p style={{ color:'#00d49a', fontSize:13, fontWeight:700, margin:0 }}>Téléchargement effectué</p>
        </div>
      )}
    </>
  );

  if (!user) return null; // géré par le bouton "Connectez-vous" de AchatWidget

  // Solde insuffisant : avant, le bouton disparaissait purement et simplement
  // (la fenêtre de recharge existait déjà dans le code mais rien ne la
  // déclenchait jamais). Oscart reste le moyen de paiement mis en avant —
  // plus fiable que le paiement direct — donc on propose de recharger
  // directement ici plutôt que de laisser le paiement direct comme seule
  // option visible.
  if (solde < prixOscart) {
    return (
      <div>
        {rechargeModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setRechargeModal(null)}>
            <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
              <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:16 }}>
                Recharger {rechargeModal.oscart} Oscart
              </p>
              <RechargeDeviseSelector fcfa={rechargeModal.fcfa} />
              <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
                Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
              </p>
              <button onClick={async () => {
                const err = await lancerPaiementGeniusPay(rechargeModal.oscart, rechargeModal.fcfa);
                if (err) alert(err);
              }}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                Payer {rechargeModal.fcfa.toLocaleString()} F CFA
              </button>
              <button onClick={() => setRechargeModal(null)}
                style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
        <button onClick={() => setRechargeModal({ oscart: prixOscart, fcfa: prixOscart * 10 })}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Recharger {prixOscart} Oscart pour télécharger
        </button>
        <p style={{ color:'#5a7090', fontSize:11, textAlign:'center', margin:'6px 0 0' }}>Solde actuel : {solde} Oscart</p>
      </div>
    );
  }

  return (
    <div>
      {/* Modal recharge intégré */}
      {rechargeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setRechargeModal(null)}>
          <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
            <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:16 }}>
              Recharger {rechargeModal.oscart} Oscart
            </p>
            <RechargeDeviseSelector fcfa={rechargeModal.fcfa} />
            <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
              Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
            </p>
            <button onClick={async () => {
              const err = await lancerPaiementGeniusPay(rechargeModal.oscart, rechargeModal.fcfa);
              if (err) alert(err);
            }}
              style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              Payer {rechargeModal.fcfa.toLocaleString()} F CFA
            </button>
            <button onClick={() => setRechargeModal(null)}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton paiement direct (utilisé dans le modal de AchatWidget) */}
      <button onClick={payer} disabled={paying || (user && solde < prixOscart)}
        style={{ width:'100%', padding:14, borderRadius:12, border:'none', background: (user && solde < prixOscart) ? 'rgba(255,215,0,0.3)' : 'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor: paying?'wait':'pointer' }}>
        {paying ? 'Traitement...' : (user && solde < prixOscart) ? `Solde insuffisant (${prixOscart} Oscart requis)` : `Télécharger pour ${prixOscart} Oscart`}
      </button>
    </div>
  );
}

// TÉLÉCHARGER WIDGET — paiement Wave automatique
// Flux : clic → session Wave créée côté serveur → redirection Wave → webhook → DL actif
// ─────────────────────────────────────────────
function AchatWidget({ qrId, albumLabel, artistEmail, prix, files, externalOpen, onExternalClose, hideButton, source }: {
  qrId: string; albumLabel: string; artistEmail: string; prix: number; files: any[];
  externalOpen?: boolean; onExternalClose?: () => void; hideButton?: boolean; source?: 'qr' | 'public';
}) {
  const [state, setState] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [dlActive, setDlActive] = useState(false);
  const [venteId, setVenteId] = useState('');
  const [confirmeDirect, setConfirmeDirect] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [showPubAfterPay, setShowPubAfterPay] = useState(false);
  const [devise, setDevise] = useState<'fcfa'|'eur'|'usd'>('fcfa');
  const user = auth.currentUser;
  const prixOscart = Math.ceil(prix / 10);
  const clePendante = 'dz_vente_pendante_' + qrId;

  // Reprendre l'écoute d'une vente en attente si l'utilisateur revient
  // d'une redirection de paiement (GeniusPay quitte puis recharge la page).
  useEffect(() => {
    if (venteId) return;
    try {
      const idSauve = localStorage.getItem(clePendante);
      if (idSauve) setVenteId(idSauve);
    } catch { /* ignore */ }
  }, []);

  // Écouter en temps réel si le paiement a été confirmé (via webhook GeniusPay)
  useEffect(() => {
    if (!venteId) return;
    const unsub = onSnapshot(doc(db, 'ventes', venteId), (d) => {
      if (d.exists() && d.data()?.dlActive) {
        setDlActive(true);
        setShowPubAfterPay(false);
        try { localStorage.removeItem(clePendante); } catch { /* ignore */ }
      }
    });
    return unsub;
  }, [venteId]);

  const handlePay = async () => {
    if (!user) return;
    if (state === 'loading') return;
    setState('loading');
    setErrMsg('');
    try {
      // 1. Créer la demande dans Firestore
      const artSnap = await getDocs(query(collection(db, 'artists'), where('email','==',artistEmail)));
      const artistId = artSnap.empty ? '' : (artSnap.docs[0].data().uid || artSnap.docs[0].id);
      const commercialEmail = artSnap.empty ? '' : (artSnap.docs[0].data().responsableEmail || artSnap.docs[0].data().commercialEmail || '');

      // Répartition : Artiste 70% / Entreprise 20% / Commercial 10%
      const partArtiste = Math.round(prix * 0.70);
      const partEntreprise = Math.round(prix * 0.20);
      const partCommercial = Math.round(prix * 0.10);

      const venteRef = await addDoc(collection(db, 'ventes'), {
        qrId, artistId, artistEmail, albumLabel, prix, prixOscart,
        partArtiste, partEntreprise, partCommercial,
        commercialEmail, userId: user.uid,
        statut: 'en_attente', dlActive: false,
        readByArtist: false, createdAt: new Date().toISOString(),
      });
      setVenteId(venteRef.id);
      try { localStorage.setItem(clePendante, venteRef.id); } catch { /* ignore */ }

      // 2. Appeler la Vercel Serverless Function pour créer le paiement GeniusPay
      const res = await fetch('/api/creer-paiement-telechargement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venteId: venteRef.id, prix, prixOscart, qrId, albumLabel, source: source || 'qr',
          uid: user.uid, email: user.email, nom: user.displayName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }

      const { url } = await res.json();

      // 3. Rediriger vers la page de paiement (Wave, Orange Money, MTN, carte...)
      // GeniusPay redirigera vers /fan/:qrId?paiement=succes après paiement
      window.location.href = url;

    } catch (e: any) {
      if (e.message?.includes('permissions')) {
        setErrMsg('Connexion Firestore refusée. Vérifiez les règles de sécurité.');
      } else if (e.message?.includes('fetch')) {
        setErrMsg('Service de paiement non disponible. Réessayez plus tard.');
      } else {
        setErrMsg(e.message || 'Erreur lors de la création du paiement');
      }
      setState('error');
    }
  };

  // Téléchargement piste par piste (plus de ZIP)
  const telechargerFichier = (f: any) => {
    const a = document.createElement('a');
    a.href = f.url.replace('/upload/','/upload/fl_attachment/');
    a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setConfirmeDirect(true); setTimeout(() => setConfirmeDirect(false), 4000);
  };

  // Téléchargement activé (après confirmation Wave webhook)
  if (dlActive) return (
    <div style={{ marginBottom:20 }}>
      {/* Pub après paiement confirmé */}
      {false && showPubAfterPay && (
        <PubOverlay trigger="download" onDone={() => setShowPubAfterPay(false)} />
      )}
      <p style={{ color:'#4a5878', fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10, textTransform:'uppercase' }}>⬇ Télécharger</p>
      <div style={{ background:'rgba(77,255,154,0.1)', border:'1px solid rgba(77,255,154,0.35)', borderRadius:14, padding:'16px 18px', marginBottom:12 }}>
        <p style={{ fontWeight:800, fontSize:15, color:'#4dff9a', margin:'0 0 4px' }}>Paiement confirmé !</p>
        <p style={{ color:'#6a88aa', fontSize:12, margin:'0 0 14px' }}>Wave a confirmé votre paiement. Votre téléchargement est prêt.</p>

        {(!files || files.length <= 1) ? (
          <button onClick={() => files?.[0] && telechargerFichier(files[0])}
            style={{ width:'100%', padding:'15px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#4dff9a,#00c060)', color:'#000', fontWeight:800, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⬇</span> Télécharger maintenant
          </button>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {files.map((f: any, i: number) => (
              <button key={i} onClick={() => telechargerFichier(f)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, border:'none', background:'rgba(77,255,154,0.15)', color:'#4dff9a', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:16 }}>⬇</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(f.name || 'Piste ' + (i + 1)).replace(/\.[^/.]+$/, '')}</span>
              </button>
            ))}
          </div>
        )}

        {confirmeDirect && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)' }}>
            <span style={{ color:'#00d49a', fontSize:16 }}>✓</span>
            <p style={{ color:'#00d49a', fontSize:13, fontWeight:700, margin:0 }}>Téléchargement effectué</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div id="zone-telecharger" style={{ marginBottom: hideButton ? 0 : 20 }}>
      {/* Modal détail prix (apparaît au clic ou depuis le lecteur) */}
      {(showDetail || externalOpen) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9992, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => { setShowDetail(false); onExternalClose?.(); }}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:'24px 24px 36px', width:'100%', maxWidth:480, textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)', margin:'0 auto 18px' }} />
            <p style={{ color:C.text, fontWeight:800, fontSize:17, margin:'0 0 12px' }}>Télécharger {albumLabel || ''}</p>

            {/* Prix affiché directement en devise (sélecteur F CFA / € / $) */}
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:10 }}>
              {(['fcfa','eur','usd'] as const).map(d => (
                <button key={d} onClick={() => setDevise(d)}
                  style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${devise===d?C.gold:C.border}`, background:devise===d?'rgba(255,215,0,0.15)':'transparent', color:devise===d?C.gold:C.textSoft, fontSize:11, cursor:'pointer' }}>
                  {d === 'fcfa' ? 'F CFA' : d === 'eur' ? '€' : '$'}
                </button>
              ))}
            </div>
            <p style={{ color:C.gold, fontWeight:800, fontSize:26, margin:'0 0 20px' }}>
              {devise === 'eur' ? `${(prix * 0.0015).toFixed(2)} €` : devise === 'usd' ? `${(prix * 0.0016).toFixed(2)} $` : `${prix.toLocaleString()} F CFA`}
            </p>

            {!user ? (
              <a href={`/ziko?retour=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                style={{ display:'block', width:'100%', padding:12, borderRadius:12, border:'none', background:C.blue, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
                Connectez-vous pour télécharger
              </a>
            ) : (
              <>
                {/* Oscart = moyen de paiement mis en avant (plus fiable que le
                    paiement direct, qui échoue parfois selon l'opérateur) */}
                <OscartPayButton prix={prix} qrId={qrId} albumLabel={albumLabel} artistEmail={artistEmail} files={files} source={source} />
                <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 10px' }}>
                  <div style={{ flex:1, height:1, background:C.border }} />
                  <span style={{ color:C.textSoft, fontSize:11 }}>ou</span>
                  <div style={{ flex:1, height:1, background:C.border }} />
                </div>
                {/* Paiement direct en devise — option secondaire, discrète */}
                <button onClick={handlePay} disabled={state === 'loading'}
                  style={{ width:'100%', padding:11, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontWeight:600, fontSize:13, cursor: state==='loading' ? 'wait' : 'pointer' }}>
                  {state === 'loading' ? 'Redirection en cours...' : `Payer ${devise === 'eur' ? `${(prix*0.0015).toFixed(2)} €` : devise === 'usd' ? `${(prix*0.0016).toFixed(2)} $` : `${prix.toLocaleString()} F CFA`} directement`}
                </button>
                {errMsg && <p style={{ color:'#ff5a5a', fontSize:12, margin:'8px 0 0' }}>{errMsg}</p>}
              </>
            )}

            <button onClick={() => { setShowDetail(false); onExternalClose?.(); }}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer', marginTop:10 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton Télécharger (masqué si déclenché depuis le lecteur) */}
      {!hideButton && (
        <button onClick={() => setShowDetail(true)}
          style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>⬇</span> Télécharger
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE STREAMING PUBLIC — /ecoute/:publicLinkId
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PAGE BIO PUBLIQUE ARTISTE — accessible à tous, indexable par Google.
// Pochette + bio pro + liste des titres publiés.
// ─────────────────────────────────────────────
function ArtisteBioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [artiste, setArtiste] = useState<any>(null);
  const [titres, setTitres] = useState<any[]>([]);
  const [statut, setStatut] = useState<'chargement'|'ok'|'introuvable'>('chargement');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db,'artists'), where('slug','==',slug)));
        if (snap.empty) { setStatut('introuvable'); return; }
        const data = snap.docs[0].data();
        setArtiste(data);
        if (data.email) {
          const decSnap = await getDocs(query(collection(db,'decouvrir'), where('artistEmail','==',data.email)));
          setTitres(decSnap.docs.map(d => ({ id:d.id, ...d.data() })).filter((t:any) => !t.masque));
        }
        setStatut('ok');
      } catch (e) { console.error(e); setStatut('introuvable'); }
    })();
  }, [slug]);

  if (statut === 'chargement') return (
    <div style={{ minHeight:'100vh', background:C.bgDeep, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:C.textSoft }}>Chargement...</p>
    </div>
  );
  if (statut === 'introuvable') return (
    <div style={{ minHeight:'100vh', background:C.bgDeep, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <p style={{ color:C.text, fontWeight:700, marginBottom:8 }}>Artiste introuvable</p>
      <Link to="/decouvrir" style={{ color:C.blueLite, fontSize:13 }}>← Retour à Découvrir</Link>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, color:C.text, fontFamily:"'DM Sans',sans-serif", paddingBottom:60 }}>
      <div style={{ padding:'14px 16px' }}>
        <Logo size="sm" />
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'0 20px' }}>
        {/* En-tête façon Wikipédia : pochette + identité */}
        <div style={{ display:'flex', gap:18, alignItems:'flex-start', marginBottom:24, flexWrap:'wrap' }}>
          {(artiste.bioPhotoUrl || artiste.coverUrl) ? (
            <img src={optimImg(artiste.bioPhotoUrl || artiste.coverUrl,500)} alt={artiste.artistName || artiste.nom}
              style={{ width:180, height:180, objectFit:'cover', borderRadius:16, border:'1px solid '+C.border, flexShrink:0 }} />
          ) : (
            <div style={{ width:180, height:180, borderRadius:16, background:'linear-gradient(135deg,#0d1535,#1a3a6e)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src={LOGO_B64} alt="" style={{ width:70, opacity:0.4 }} />
            </div>
          )}
          <div style={{ flex:1, minWidth:180 }}>
            <h1 style={{ fontFamily:'serif', fontSize:24, fontWeight:800, margin:'0 0 4px' }}>{artiste.bioFormulaire?.nom || artiste.artistName || artiste.nom}</h1>
            {artiste.bioFormulaire?.fonction && <p style={{ color:C.gold, fontSize:13, fontWeight:600, margin:'0 0 8px' }}>{artiste.bioFormulaire.fonction}</p>}
            <p style={{ color:C.textSoft, fontSize:12, margin:0 }}>
              {[artiste.bioFormulaire?.nationalite, artiste.bioFormulaire?.residence].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Bio */}
        {artiste.bioTexte ? (
          <div style={{ marginBottom:32 }}>
            {artiste.bioTexte.split('\n').filter((p:string) => p.trim()).map((p:string, i:number) => (
              <p key={i} style={{ color:C.text, fontSize:14, lineHeight:1.8, marginBottom:14, fontStyle: p.trim().startsWith('«') || p.trim().startsWith('"') ? 'italic' : 'normal' }}>{p}</p>
            ))}
          </div>
        ) : (
          <p style={{ color:C.textSoft, fontSize:13, marginBottom:32, fontStyle:'italic' }}>Cet artiste n'a pas encore publié sa bio.</p>
        )}

        {/* Titres publiés */}
        {titres.length > 0 && (
          <div>
            <p style={{ color:C.gold, fontSize:11, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase', marginBottom:14 }}>Titres publiés ({titres.length})</p>
            <div style={{ display:'grid', gap:10 }}>
              {titres.map((t) => (
                <Link key={t.id} to={`/ecoute/${t.publicLinkId}`}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, background:C.card, border:'1px solid '+C.border, textDecoration:'none' }}>
                  {t.coverUrl ? (
                    <img src={optimImg(t.coverUrl,120)} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                  ) : (
                    <div style={{ width:44, height:44, borderRadius:8, background:'linear-gradient(135deg,#0d1535,#1a3a6e)', flexShrink:0 }} />
                  )}
                  <p style={{ color:C.text, fontSize:13, fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.label}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicStreamPage() {
  const { publicLinkId } = useParams<{ publicLinkId: string }>();
  const location = useLocation();
  // Données passées directement au clic (affichage instantané, sans attendre Firebase)
  const preload = (location.state as any)?.contenu || null;
  const [data, setData] = useState<any>(preload);
  const [loading, setLoading] = useState(!preload); // si on a les données au clic, pas de chargement
  const [dlOpen, setDlOpen] = useState(false);
  const [zikoState, setZikoState] = useState<'idle' | 'modal' | 'adding' | 'done'>('idle');
  const [showTutoCascade, setShowTutoCascade] = useState(false);
  const [coverPlaying, setCoverPlaying] = useState(false);

  // Déclencher tuto cascade après play
  // (déclenché depuis recordPublicStream)
  // ── LECTURE ENCHAÎNÉE (playlists / file d'attente) ──
  const [fileAttente, setFileAttente] = useState<any[] | null>(null);
  const [idxFile, setIdxFile] = useState(0);
  const [cacheContenus, setCacheContenus] = useState<Map<string, any>>(new Map());
  const [autoStartIdx, setAutoStartIdx] = useState(0);
  const [autoStartCle, setAutoStartCle] = useState(0);
  const [enchainement, setEnchainement] = useState(true);
  const [finAtteinte, setFinAtteinte] = useState(false);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const fileInit = useRef('');

  const recordPublicStream = async (track: string, duration: number) => {
    if (!data) return;
    // Avec la lecture enchaînée, le lecteur peut jouer un contenu SUIVANT sans
    // changer d'URL → toujours utiliser l'id du contenu réellement joué.
    const cleContenu = data.publicLinkId || publicLinkId || '';
    try {
      await addDoc(collection(db, 'streams'), {
        publicLinkId: cleContenu, artist: data.artist || '', label: data.label || '',
        track, duration: Math.round(duration), valid: true,
        source: 'publicLink', ts: new Date().toISOString(),
      });
      // Signal de recommandation : écoute du fan connecté — 1 doc par fan+contenu,
      // incrémenté à chaque écoute. Alimente la section « Pour toi » de Découvrir.
      const uReco = auth.currentUser;
      if (uReco) {
        setDoc(doc(db, 'historique_ecoute', `${uReco.uid}__${cleContenu}`), {
          uid: uReco.uid, qrId: cleContenu, artist: data.artist || '', label: data.label || '',
          categorie: data.categorie || '', type: 'ecoute',
          nb: increment(1), ts: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
      // Incrémenter le compteur streams du LIEN PUBLIC (jamais celui d'un QR de
      // duplication physique — les deux compteurs restent strictement séparés).
      const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', cleContenu)));
      if (!snap.empty) {
        await updateDoc(doc(db, 'publicLinks', snap.docs[0].id), {
          streams: (snap.docs[0].data().streams || 0) + 1,
        });
      }
    } catch(e) { console.error('pubStream', e); }
    // Déclencher tuto cascade après premier play
    if (!localStorage.getItem('dz_tuto_seen_v4')) {
      setTimeout(() => setShowTutoCascade(true), 800);
    }
  };

  // Suggestion aléatoire (fin d'album sans playlist) : depuis la file transmise,
  // sinon depuis les suggestions mises en cache par Découvrir.
  const piocherSuggestion = (exclure?: string) => {
    try {
      const etat: any = (location.state as any) || {};
      const pool = (etat.fileAttente || []).filter((t: any) => t.publicLinkId && t.publicLinkId !== exclure);
      if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
    } catch { /* ignore */ }
    try {
      const brut = localStorage.getItem('dz_suggestions');
      if (brut) {
        const tous = JSON.parse(brut) as any[];
        const pool = tous.filter((t: any) => t.publicLinkId && t.publicLinkId !== exclure && t.label);
        if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
      }
    } catch { /* ignore */ }
    return null;
  };

  // Init de la file d'attente (venue du Profil « Écouter la playlist ») — une
  // seule fois par contenu affiché.
  useEffect(() => {
    if (!data) return;
    const cle = data.publicLinkId || publicLinkId || '';
    if (fileInit.current === cle) return;
    fileInit.current = cle;
    const st: any = (location.state as any) || {};
    if (st.fileAttente && st.fileAttente.length > 0) {
      const file = st.fileAttente;
      setFileAttente(file);
      const pos = Math.max(0, file.findIndex((t: any) => t.publicLinkId === cle));
      setIdxFile(pos);
      setAutoStartIdx(0);
      setAutoStartCle(Date.now());
    } else {
      setSuggestion(piocherSuggestion(cle));
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Précharge en arrière-plan les prochains contenus de la file → l'échange à
  // chaud se fait sans interruption à la fin d'un titre.
  const precharger = async (t: any) => {
    if (!t?.publicLinkId || cacheContenus.has(t.publicLinkId)) return;
    try {
      const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', t.publicLinkId)));
      if (!snap.empty) {
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setCacheContenus(prev => { const m = new Map(prev); m.set(d.publicLinkId, d); return m; });
      }
    } catch { /* ignore */ }
  };
  useEffect(() => {
    if (!fileAttente) return;
    [1, 2].forEach(offset => precharger(fileAttente[idxFile + offset]));
  }, [fileAttente, idxFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Récupère un contenu par publicLinkId (avec cache) — utilisé pour l'auto-
  // enchaînement si le préchargement n'a pas (encore) abouti.
  const fetchContenu = async (cle: string) => {
    if (cacheContenus.has(cle)) return cacheContenus.get(cle);
    try {
      const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', cle)));
      if (!snap.empty) {
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setCacheContenus(prev => { const m = new Map(prev); m.set(cle, d); return m; });
        return d;
      }
    } catch { /* ignore */ }
    return null;
  };

  // Fin du dernier titre de l'album : enchaîner sur le contenu suivant de la
  // playlist (échange à chaud du lecteur) ou afficher la suggestion.
  const finDeLecture = async () => {
    const suivant = enchainement && fileAttente ? fileAttente[idxFile + 1] : null;
    console.log('[DZ-CHAIN] fin album', { idx: idxFile, suivant: suivant?.publicLinkId, ench: enchainement });
    if (!suivant) { setFinAtteinte(true); return; }
    const docSuivant = await fetchContenu(suivant.publicLinkId);
    if (docSuivant) {
      setData(docSuivant);
      setIdxFile(i => i + 1);
      setAutoStartIdx(0);
      setAutoStartCle(Date.now());
      setFinAtteinte(false);
    } else {
      console.log('[DZ-CHAIN] contenu suivant introuvable dans publicLinks');
      setFinAtteinte(true);
    }
  };
  const lancerTitreSuivant = () => {
    if (!fileAttente) return;
    const suivant = fileAttente[idxFile + 1];
    if (suivant?.publicLinkId && cacheContenus.has(suivant.publicLinkId)) {
      setData(cacheContenus.get(suivant.publicLinkId));
      setIdxFile(i => i + 1);
      setAutoStartIdx(0);
      setAutoStartCle(Date.now());
      setFinAtteinte(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', publicLinkId)));
      if (!snap.empty) {
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setData((prev:any) => ({ ...(prev || {}), ...d })); // fusionne avec le preload (complète les infos manquantes)
        setLoading(false);
        // Compter le Buzz EN ARRIÈRE-PLAN
        updateDoc(doc(db, 'publicLinks', snap.docs[0].id), { visits: (d.visits || 0) + 1 }).catch(()=>{});
        getDocs(query(collection(db,'decouvrir'), where('publicLinkId','==',publicLinkId)))
          .then(dSnap => { if (!dSnap.empty) updateDoc(doc(db,'decouvrir',dSnap.docs[0].id),{ buzz:(dSnap.docs[0].data().buzz||0)+1 }).catch(()=>{}); })
          .catch(()=>{});
      } else {
        setLoading(false);
      }
    };
    load();
  }, [publicLinkId]);

  const doAddToZiko = async (uid: string) => {
    if (!data) return;
    setZikoState('adding');
    try {
      // Ce contenu vient de Découvrir/streaming → identifié par son publicLinkId,
      // et marqué source:'public' pour que les écoutes/téléchargements comptent
      // sur le lien public de monétisation, jamais sur un QR de duplication.
      const zikoData = {
        qrId: data.publicLinkId || publicLinkId,
        source: 'public',
        label: data.label || '',
        artist: data.artist || '',
        type: data.type || 'album',
        files: data.files || [],
        coverUrl: data.coverUrl || '',
        addedAt: new Date().toISOString(),
      };
      const existing = await getDocs(query(
        collection(db, 'zikotheque'),
        where('uid', '==', uid),
        where('qrId', '==', zikoData.qrId)
      ));
      if (existing.empty) {
        await addDoc(collection(db, 'zikotheque'), { uid, ...zikoData });
      }
      setZikoState('done');
    } catch(e) { console.error('ziko', e); setZikoState('idle'); }
  };

  const handleAddToZiko = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) { await doAddToZiko(currentUser.uid); }
    else { setZikoState('modal'); }
  };  if (loading) return (
    <div style={{ minHeight: '100vh', background: `${GLOW_TOP}, ${C.bgDeep}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 44, height: 44, border: '3px solid #1e6fff', borderTopColor: 'transparent', borderRadius: 99, animation: 'spin .8s linear infinite' }} />
    </div>
  );

  void lancerTitreSuivant; // utilisé dans la bannière de fin ci-dessous

  if (!data) return (
    <div style={{ minHeight: '100vh', background: `${GLOW_TOP}, ${C.bgDeep}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
      <div style={{ textAlign: 'center' }}><p style={{ color: '#4a5878' }}>Contenu non trouvé</p></div>
    </div>
  );

  const audioFiles = (data.files || []).filter((f: any) => estFichierAudio(f));
  const videoFiles = (data.files || []).filter((f: any) => f.name?.match(/\.(mp4|mov|avi|mkv|webm)$/i));

  return (
    <div style={{ minHeight: '100vh', background: C.bgDeep, color: C.text, fontFamily: "'DM Sans', sans-serif", paddingBottom: 40 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        .ps-row:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      {/* Bulles flottantes en bas à droite — ne prennent aucune place dans la
          mise en page et ne gênent jamais la pochette. */}
      <div style={{ position:'fixed', bottom:20, right:16, zIndex:60, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
        <Link to="/decouvrir" aria-label="Découvrir" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:99, background:'#1a2340', color:'#fff', textDecoration:'none', boxShadow:'0 4px 14px rgba(0,0,0,0.45)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </Link>
        <Link to="/profil" aria-label="Mon profil" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:99, background:'#1a2340', color:'#fff', textDecoration:'none', boxShadow:'0 4px 14px rgba(0,0,0,0.45)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </Link>
      </div>

      {/* PUB MAISON */}

      {/* ── TUTO CASCADE — bulles après Play ── */}
      {showTutoCascade && <TutoCascade onDone={() => { setShowTutoCascade(false); localStorage.setItem('dz_tuto_seen_v4','1'); }} />}

      {/* ── POCHETTE — zoom + flash lumineux qui dansent avec la musique ── */}
      <div style={{ position: 'relative', width: '100%', animation: 'fadeUp .35s ease', padding: '20px 16px 0', display:'flex', justifyContent:'center' }}>
        <div style={{ position:'relative', overflow:'visible', borderRadius:8, zIndex:2, width:'90%' }}>
          {data.coverUrl ? (
            <img
              id="cover-reactive"
              src={optimImg(data.coverUrl, 800)}
              alt={data.label}
              style={{ width: '100%', maxHeight: '54vh', objectFit: 'cover', display: 'block', borderRadius: 8,
                transition: 'transform .06s ease-out, box-shadow .06s ease-out, filter .06s ease-out', willChange: 'transform, box-shadow, filter' }}
            />
          ) : (
            <div style={{ width: '100%', height: 260, background: 'linear-gradient(135deg,#0d1535,#1a3a6e)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
              <img id="cover-reactive" src={LOGO_B64} alt="DZ" style={{ width: 100, opacity: 0.35, transition:'transform .06s ease-out', willChange:'transform' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── TITRE + ARTISTE ── */}
      <div style={{ padding: '20px 18px 0', marginBottom: 22 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.1 }}>{data.label}</h1>
        <p style={{ color: '#6a88aa', fontSize: 13 }}>par <strong style={{ color: '#4da6ff' }}>{data.artist}</strong></p>
      </div>

      <div style={{ padding: '0 16px', maxWidth: 500, margin: '0 auto' }}>

        {/* ── LECTEUR AUDIO ── */}
        {audioFiles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <AudioPlayer files={audioFiles} onStream={recordPublicStream}
              onPlayingChange={setCoverPlaying}
              autoStartIdx={autoStartIdx} autoStartCle={autoStartCle} onFinAlbum={finDeLecture}
              albumTitre={data.label || ''} albumArtiste={data.artist || ''} albumCover={data.coverUrl || ''}
              onPlay={() => { if (!localStorage.getItem('dz_tuto_seen_v4')) setTimeout(() => setShowTutoCascade(true), 800); }} />
          </div>
        )}

        {/* ── LECTURE ENCHAÎNÉE — bannière de fin (titre suivant manuel ou suggestion) ── */}
        {finAtteinte && (
          <div style={{ marginBottom:20, padding:'14px 16px', borderRadius:14, background:'rgba(245,200,76,0.07)', border:'1px solid rgba(245,200,76,0.35)' }}>
            <p style={{ color:C.gold, fontWeight:800, fontSize:13, margin:'0 0 10px' }}>🎵 Album terminé</p>
            {fileAttente && fileAttente[idxFile + 1] ? (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {fileAttente[idxFile + 1].coverUrl
                  ? <img src={optimImg(fileAttente[idxFile + 1].coverUrl, 80)} alt="" style={{ width:42, height:42, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:42, height:42, borderRadius:8, background:'linear-gradient(135deg,#0a1535,#1e3a6e)', flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:C.text, fontSize:12.5, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileAttente[idxFile + 1].label}</p>
                  <p style={{ color:'#4da6ff', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileAttente[idxFile + 1].artist}</p>
                </div>
                <button onClick={lancerTitreSuivant}
                  style={{ padding:'9px 16px', borderRadius:99, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
                  ▶ Lancer
                </button>
              </div>
            ) : suggestion ? (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {suggestion.coverUrl
                  ? <img src={optimImg(suggestion.coverUrl, 80)} alt="" style={{ width:42, height:42, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:42, height:42, borderRadius:8, background:'linear-gradient(135deg,#0a1535,#1e3a6e)', flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:C.text, fontSize:12.5, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>À suivre : {suggestion.label}</p>
                  <p style={{ color:'#4da6ff', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{suggestion.artist}</p>
                </div>
                <Lien href={`/ecoute/${suggestion.publicLinkId}`} state={{ contenu: suggestion }}
                  style={{ padding:'9px 16px', borderRadius:99, background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0, textDecoration:'none' }}>
                  ▶ Écouter
                </Lien>
              </div>
            ) : null}
            {fileAttente && fileAttente.length > 1 && (
              <label style={{ display:'flex', alignItems:'center', gap:7, marginTop:12, color:C.textSoft, fontSize:11.5, cursor:'pointer' }}>
                <input type="checkbox" checked={enchainement} onChange={e => setEnchainement(e.target.checked)} />
                Enchaîner automatiquement le titre suivant
              </label>
            )}
          </div>
        )}

        {/* ── BARRE ACTIONS — Kiff · Commenter · Kiffement · Buzz ── */}
        <ActionBar
          qrId={data.publicLinkId || publicLinkId || ''}
          artistEmail={data.artistEmail || ''}
          buzz={(data.visits||0)+(data.streams||0)}
          tutoStep={0}
          onTutoNext={() => {}}
          source="public"
        />
        <div id="zone-telecharger">
        {(() => {
          // QR privé (duplication) = totalScans défini ET pas de publicLinkId → téléchargement GRATUIT
          // QR public (lien partagé) → téléchargement PAYANT via AchatWidget
          const isPrivateQR = (data.totalScans > 0) && !data.publicLinkId;
          const dlsRestants = (data.totalScans || 0) - (data.usedScans || 0);
          const dlsEpuises = isPrivateQR && dlsRestants <= 0;

          if (isPrivateQR && !dlsEpuises) {
            // Téléchargement GRATUIT (QR privé)
            return (
              <div style={{ marginBottom: 20 }}>
                <a href={(data.files?.[0]?.url || '').replace('/upload/','/upload/fl_attachment/')} download target="_blank" rel="noreferrer"
                  style={{ width:'100%', boxSizing:'border-box', padding:'14px 18px', borderRadius:14, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, textDecoration:'none', boxShadow:'0 4px 18px rgba(10,132,255,0.45)' }}>
                  <span style={{ fontSize:18 }}>⬇</span>
                  Télécharger gratuitement
                </a>
                <p style={{ color:C.textSoft, fontSize:11, textAlign:'center', margin:'8px 0 0' }}>{dlsRestants} téléchargement{dlsRestants>1?'s':''} gratuit{dlsRestants>1?'s':''} restant{dlsRestants>1?'s':''}</p>
              </div>
            );
          }
          // Téléchargement PAYANT (QR public) — bouton masqué, ouvert depuis le lecteur
          return (data.price > 0 || data.files?.length > 0) && (
            <AchatWidget
              qrId={data.publicLinkId || publicLinkId || ''}
              albumLabel={data.label || ''}
              artistEmail={data.artistEmail || ''}
              prix={data.price || 0}
              files={data.files || []}
              hideButton={true}
              externalOpen={dlOpen}
              onExternalClose={() => setDlOpen(false)}
              source="public"
            />
          );
        })()}
        </div>

        {/* ── VIDÉOS ── */}
        {videoFiles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#4a5878', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>Vidéos</p>
            <VideoPlayer files={videoFiles} onPlay={() => { if (!localStorage.getItem('dz_tuto_seen_v4')) setTimeout(() => setShowTutoCascade(true), 800); }} />
          </div>
        )}

        {/* ── Bouton Télécharger seul — les titres sont déjà visibles via le
            hamburger du lecteur, pas besoin de les lister une seconde fois ici ── */}
        {(data.files || []).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => setDlOpen(true)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px 16px', borderRadius:14, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
              Télécharger{data.files.length > 1 ? ` (${data.files.length} titres)` : ''}
            </button>
          </div>
        )}

        {/* ── AJOUTER À MA ZIKOTHÈQUE ── */}
        {zikoState === 'done' ? (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:14, background:'rgba(30,200,100,0.1)', border:'1px solid rgba(30,200,100,0.3)', marginBottom:24 }}>
                        <div>
              <p style={{ fontWeight:700, fontSize:14, color:'#4dff9a', margin:0 }}>Ajouté à ta Zikothèque !</p>
              <a href="/ziko" style={{ color:'#4da6ff', fontSize:12, textDecoration:'none' }}>Voir ma Zikothèque →</a>
            </div>
          </div>
        ) : (
          <button onClick={handleAddToZiko} disabled={zikoState === 'adding'}
            style={{ width:'100%', padding:'15px 20px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:15, cursor: zikoState === 'adding' ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:12, marginBottom:24, opacity: zikoState === 'adding' ? 0.7 : 1, boxShadow:'0 4px 20px rgba(124,58,237,0.4)' }}>
            <span style={{ fontSize:22, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'4px 8px' }}>
              {zikoState === 'adding' ? '' : ''}
            </span>
            <div style={{ textAlign:'left' }}>
              <p style={{ margin:0, fontWeight:800 }}>{zikoState === 'adding' ? 'Ajout en cours...' : 'Ajouter à ma Zikothèque'}</p>
              <p style={{ margin:0, fontSize:11, opacity:0.7 }}>Retrouvez cet album à tout moment</p>
            </div>
          </button>
        )}

        {/* MODAL CONNEXION RAPIDE */}
        {zikoState === 'modal' && (
          <ZikoLoginModal
            onSuccess={(uid) => doAddToZiko(uid)}
            onClose={() => setZikoState('idle')}
          />
        )}

        {/* FOOTER */}
        <div style={{ textAlign: 'center' }}>
          <img src={LOGO_B64} alt="DZ" style={{ width: 36, opacity: 0.35, display: 'block', margin: '0 auto 6px' }} />
          <p style={{ color: 'rgba(100,140,200,0.2)', fontSize: 9, letterSpacing: 2, marginBottom: 14 }}>LA MUSIQUE. UN SCAN. UN MONDE.</p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:10 }}>
            <Lien href="/apropos" style={{ color:'#8098b8', fontSize:12, textDecoration:'none' }}>À propos</Lien>
            <Lien href="/conditions" style={{ color:'#8098b8', fontSize:12, textDecoration:'none' }}>Conditions d'utilisation</Lien>
            <Lien href="/privacy" style={{ color:'#8098b8', fontSize:12, textDecoration:'none' }}>Confidentialité</Lien>
          </div>
          <p style={{ color:'rgba(100,140,200,0.3)', fontSize:11 }}>© 2026 Doniel Zik — BDE SARL · Abidjan, Côte d'Ivoire</p>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// PRIVACY PAGE — politique de confidentialité
// ─────────────────────────────────────────────
function PrivacyPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#f5f8ff', fontFamily:"'DM Sans',sans-serif", padding:'40px 20px' }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <Lien href="/" style={{ color:'#1a6bff', fontSize:13, textDecoration:'none', display:'block', marginBottom:24 }}>← Retour</Lien>
        <h1 style={{ fontFamily:'serif', fontSize:26, fontWeight:900, color:'#1a2340', marginBottom:8 }}>Politique de confidentialité</h1>
        <p style={{ color:'#8098b8', fontSize:12, marginBottom:32 }}>Dernière mise à jour : juin 2026 · BDE SARL · doniel.art</p>

        {[
          { titre:'1. Présentation', texte:'Doniel Zik est une plateforme numérique de distribution et monétisation de contenus créatifs, opérée par BDE SARL, RCCM CI-ABJ-2017-B-15187, Abidjan, Côte d\'Ivoire.' },
          { titre:'2. Données collectées', texte:'Nom, adresse email, numéro de téléphone lors de la création de votre compte. Contenus écoutés, téléchargés, Oscart envoyés, commentaires publiés. Type d\'appareil, système d\'exploitation, adresse IP, données de connexion.' },
          { titre:'3. Utilisation des données', texte:'Créer et gérer votre compte. Vous permettre d\'accéder aux contenus. Traiter vos paiements et Oscart. Vous envoyer des notifications. Améliorer nos services. Respecter nos obligations légales.' },
          { titre:'4. Partage des données', texte:'Vos données personnelles ne sont jamais vendues. Elles peuvent être partagées uniquement avec nos prestataires techniques — Firebase (Google), Cloudinary — ou les autorités compétentes sur demande légale.' },
          { titre:'5. Sécurité', texte:'Vos données sont stockées de manière sécurisée sur les serveurs Firebase de Google. Nous mettons en œuvre toutes les mesures nécessaires contre tout accès non autorisé.' },
          { titre:'6. Conservation', texte:'Vos données sont conservées tant que votre compte est actif. En cas de suppression, vos données sont effacées sous 30 jours.' },
          { titre:'7. Vos droits', texte:'Droit d\'accès, de rectification, de suppression et d\'opposition. Pour exercer ces droits : bdonaldservices@gmail.com' },
          { titre:'8. Cookies', texte:'Doniel Zik utilise uniquement des cookies techniques nécessaires au bon fonctionnement. Aucun cookie publicitaire tiers.' },
          { titre:'9. Contact', texte:'BDE SARL · bdonaldservices@gmail.com · +225 05 02 10 14 52 · doniel.art · Abidjan, Côte d\'Ivoire' },
        ].map((s,i) => (
          <div key={i} style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#1a2340', marginBottom:8 }}>{s.titre}</h2>
            <p style={{ color:'#5a7090', fontSize:14, lineHeight:1.8 }}>{s.texte}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  void progress; // la barre de progression est gérée par le splash HTML désormais
  const [permNotifGlobal, setPermNotifGlobal] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [bannièreFermée, setBannièreFermée] = useState(false);

  // Redemande le statut à chaque fois que l'app revient au premier plan —
  // utile si la personne a changé le réglage depuis les paramètres du téléphone
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && typeof Notification !== 'undefined') setPermNotifGlobal(Notification.permission); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Notifications système : prévient l'utilisateur connecté dès qu'une notif arrive (même app en arrière-plan)
  usePushNotifications(user?.email);

  // Notifications éducatives AUTO (façon A) : à l'ouverture, si la dernière éducative
  // date de plus de 3 jours, on en envoie une nouvelle (pioche dans une liste). Sans serveur.
  useEffect(() => {
    if (!user) return;
    const MESSAGES_EDU = [
      // 1. Rechercher son artiste
      "Cherche ton artiste préféré ! Tape son nom dans la barre de recherche et retrouve toute sa musique sur Doniel Zik.",
      // 2. Découvrir tout le contenu
      "Doniel Zik, ce n'est pas que la musique ! Découvre l'humour, les clips et les vidéos de tes créateurs préférés.",
      // 3. C'est quoi un kiffement
      "Un kiffement, c'est un cadeau que tu offres à ton artiste pour le soutenir. Plus tu en envoies, plus tu l'aides à réussir !",
      // 4. Recharger ses Oscart
      "Pour soutenir tes artistes, recharge tes Oscart ! Va dans ta Zikothèque, choisis ta recharge et obtiens-les en quelques secondes.",
      // 5. Recharger et télécharger
      "Recharge tes Oscart et télécharge la musique de tes artistes préférés pour l'écouter partout, même hors connexion !",
      // 6. Recharger et offrir des kiffements
      "Recharge tes Oscart puis offre des kiffements à ton artiste : c'est le meilleur moyen de le soutenir et de le faire grandir.",
      // 7. Gagner des kiffs
      "Offre des kiffements à ton artiste : à chaque cadeau, tu gagnes aussi des kiffs et augmentes tes chances de récompenses exclusives !",
      // 8. Les signatures
      "Envoie un maximum de kiffements et reçois une signature exclusive : dédicace vidéo, ou ton nom chanté dans sa prochaine musique (Signature Spot) !",
      // 9. Réserver / pré-télécharger
      "Ne rate aucune sortie ! Réserve ou pré-télécharge la prochaine musique de ton artiste avant tout le monde.",
      // 10. Devenir artiste
      "Tu as un talent ? Publie ton contenu sur Doniel Zik et obtiens le maximum de visibilité et de revenus. Qu'attends-tu ?",
    ];
    const verifierEtEnvoyer = async () => {
      try {
        // Combien de messages éducatifs sont déjà partis aujourd'hui, et quand le dernier ?
        const debutJour = new Date(); debutJour.setHours(0,0,0,0);
        const q = query(collection(db,'notifications'), where('to','==','all'), where('type','==','educative'), orderBy('createdAt','desc'), limit(15));
        const snap = await getDocs(q);
        const aujourdhui = snap.docs.filter(d => new Date(d.data().createdAt).getTime() >= debutJour.getTime());
        const dejaEnvoyesAuj = aujourdhui.length;
        // Si les 10 du jour sont déjà partis, on ne fait rien
        if (dejaEnvoyesAuj >= MESSAGES_EDU.length) return;
        // Espacer : au moins ~2h entre deux messages éducatifs
        if (!snap.empty) {
          const dernier = new Date(snap.docs[0].data().createdAt).getTime();
          if (Date.now() - dernier < 2 * 3600 * 1000) return; // pas encore l'heure du suivant
        }
        // Envoyer le message suivant dans l'ordre (index = nombre déjà envoyés aujourd'hui)
        const idx = dejaEnvoyesAuj % MESSAGES_EDU.length;
        await envoyerNotification({
          to: 'all', type:'educative', text: MESSAGES_EDU[idx],
          ordre: idx + 1,
        });
      } catch(e) { console.error('edu auto', e); }
    };
    // Vérification immédiate à l'ouverture, PUIS toutes les 30 min tant que
    // l'app reste ouverte — avant, ça ne se vérifiait qu'une seule fois à
    // l'ouverture, donc rien ne se déclenchait si personne ne rouvrait l'app
    // assez souvent dans la journée.
    verifierEtEnvoyer();
    const intervalle = setInterval(verifierEtEnvoyer, 30 * 60 * 1000);
    return () => clearInterval(intervalle);
  }, [user]);

  // Notifications TUTO pour l'ARTISTE (B2) : si l'utilisateur est un artiste, on lui envoie
  // de temps en temps (1 tous les 3 jours) un conseil pour faire grandir sa communauté.
  useEffect(() => {
    if (!user || !user.email) return;
    const MESSAGES_TUTO_ARTISTE = [
      "Conseil : publiez régulièrement votre contenu sur Doniel Zik pour gagner en visibilité et toucher plus de fans !",
      "Astuce : programmez une sortie officielle et invitez votre communauté à la réserver à l'avance. L'attente crée l'engouement !",
      "Incitez votre communauté à télécharger votre musique : plus de téléchargements, plus de revenus pour vous.",
      "Demandez à vos fans de vous envoyer un maximum de kiffs : c'est le carburant de votre réussite sur Doniel Zik !",
      "Vos fans peuvent vous offrir des kiffements. Encouragez-les : chaque kiffement vous rapproche de vos objectifs.",
      "N'oubliez pas : vous pouvez offrir des signatures (dédicaces) à vos fans les plus fidèles pour les récompenser et les fidéliser !",
    ];
    const verifierEtEnvoyer = async () => {
      try {
        // Vérifier que l'utilisateur est bien un artiste
        const artSnap = await getDocs(query(collection(db,'artists'), where('email','==',user.email.toLowerCase())));
        if (artSnap.empty) return;
        // Dernière notif tuto envoyée à cet artiste
        const q = query(collection(db,'notifications'), where('to','==',user.email), where('type','==','tuto_artiste'), orderBy('createdAt','desc'), limit(1));
        const snap = await getDocs(q);
        let envoyer = snap.empty;
        if (!snap.empty) {
          const derniere = new Date(snap.docs[0].data().createdAt).getTime();
          if (Date.now() - derniere > 24 * 3600 * 1000) envoyer = true; // > 1 jour
        }
        if (envoyer) {
          const texte = MESSAGES_TUTO_ARTISTE[Math.floor(Math.random() * MESSAGES_TUTO_ARTISTE.length)];
          await envoyerNotification({
            to: user.email, role:'artiste', type:'tuto_artiste', text: texte,
          });
        }
      } catch(e) { console.error('tuto artiste', e); }
    };
    // Vérification immédiate + toutes les 30 min tant que l'app reste ouverte
    // (même raison que pour les notifications éducatives ci-dessus).
    verifierEtEnvoyer();
    const intervalle = setInterval(verifierEtEnvoyer, 30 * 60 * 1000);
    return () => clearInterval(intervalle);
  }, [user]);

  useEffect(() => {
    // (la barre animée est dans le splash HTML index.html)
    const t = setInterval(() => { setProgress(p => (p < 90 ? p + 15 : p)); }, 300);

    const unsub = onAuthStateChanged(auth, (u) => {
      // On affiche l'app IMMÉDIATEMENT dès que l'auth répond (pas d'attente réseau supplémentaire)
      setUser(u);
      setProgress(100);
      setAuthLoading(false);
      (window as any).__hideSplash?.();

      // Liaison du portefeuille unique : faite EN ARRIÈRE-PLAN, sans bloquer l'affichage
      if (u && u.email) {
        (async () => {
          try {
            const byUid = await getDocs(query(collection(db,'coins_solde'), where('uid','==',u.uid)));
            if (byUid.empty) {
              const byEmail = await getDocs(query(collection(db,'coins_solde'), where('email','==',u.email!.toLowerCase())));
              if (!byEmail.empty) {
                await updateDoc(doc(db,'coins_solde',byEmail.docs[0].id), { uid: u.uid });
              }
            }
          } catch(e) { console.error('lien uid solde', e); }
        })();
      }
    });
    return () => { unsub(); clearInterval(t); };
  }, []);

  // Filet : si authLoading repasse false plus tard, on s'assure que le splash est caché
  useEffect(() => {
    if (!authLoading) (window as any).__hideSplash?.();
  }, [authLoading]);

  // Pendant le chargement initial, on n'affiche PAS de loader React :
  // le splash HTML (index.html) reste seul visible → un seul écran de démarrage, pas de superposition.
  if (authLoading) return null;

  return (
    <BrowserRouter>
      <PWAInstallBanner />
      <Routes>
        <Route path="/" element={
user ? <ZikothequePage user={user} /> : <LandingPage />
        } />
        <Route path="/fan/:qrId" element={<FanPage />} />
        <Route path="/ecoute/:publicLinkId" element={<PublicStreamPage />} />
        <Route path="/ziko" element={
          authLoading ? (
            <div style={{ minHeight:'100vh', background:`${GLOW_TOP}, ${C.bgDeep}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:48, height:48, border:'3px solid #1e6fff', borderTopColor:'transparent', borderRadius:99, animation:'spin .8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : user ? <ZikothequePage user={user} /> : <UserAuthPage />
        } />
        <Route path="/ziko/login" element={<UserAuthPage />} />
        <Route path="/artiste" element={<ArtistPage />} />
        <Route path="/artiste/login" element={<ArtistPage />} />
        <Route path="/artiste-bio/:slug" element={<ArtisteBioPage />} />
        <Route path="/annonceurs" element={<AnnonceursPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/decouvrir" element={<DecouvrirPage />} />
        <Route path="/challenge" element={<MesChallengesPage />} />
        <Route path="/profil" element={<ProfilPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/studio" element={<DzStudioPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/commercial" element={<CommercialPage />} />
        <Route path="/responsable" element={<ResponsablePage />} />
        <Route path="/conditions" element={<ConditionsPage />} />
        <Route path="/apropos" element={<AProposPage />} />
        <Route path="/rejoindre" element={<RejoindrePage />} />
        <Route path="/about" element={<AProposPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/*" element={
          authLoading ? null : user ? <ZikothequePage user={user} /> : <LandingPage />
        } />
      </Routes>

      {/* Bannière d'activation des notifications — visible sur TOUTE l'app tant
          que ce n'est pas activé, pas seulement sur la page Notifications, pour
          que ce soit vraiment impossible à manquer. */}
      {user && permNotifGlobal === 'default' && !bannièreFermée && (
        <div style={{ position:'fixed', left:12, right:12, bottom:84, zIndex:9999, background:'#12213f', border:'1px solid rgba(93,132,255,0.4)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 8px 28px rgba(0,0,0,0.5)', maxWidth:460, margin:'0 auto' }}>
          <span style={{ fontSize:22, flexShrink:0 }}>🔔</span>
          <div style={{ flex:1 }}>
            <p style={{ color:'#fff', fontSize:13, fontWeight:700, margin:'0 0 2px' }}>Activez les notifications</p>
            <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>Pour ne rien manquer : kiffs, commentaires, cadeaux...</p>
          </div>
          <button onClick={() => { activerNotificationsPush(user.email).then(p => setPermNotifGlobal(p)); }}
            style={{ padding:'8px 14px', borderRadius:99, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            Activer
          </button>
          <button onClick={() => setBannièreFermée(true)} aria-label="Fermer"
            style={{ background:'transparent', border:'none', color:'#5a7090', fontSize:18, cursor:'pointer', flexShrink:0, padding:0, lineHeight:1 }}>
            ×
          </button>
        </div>
      )}
      {user && permNotifGlobal === 'denied' && !bannièreFermée && (
        <div style={{ position:'fixed', left:12, right:12, bottom:84, zIndex:9999, background:'rgba(255,100,124,0.15)', border:'1px solid rgba(255,100,124,0.4)', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 28px rgba(0,0,0,0.5)', maxWidth:460, margin:'0 auto' }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🔕</span>
          <p style={{ color:'#ff647c', fontSize:11, margin:0, flex:1, lineHeight:1.5 }}>Notifications bloquées — réglages du téléphone → Applications → Doniel Zik → Notifications.</p>
          <button onClick={() => setBannièreFermée(true)} aria-label="Fermer"
            style={{ background:'transparent', border:'none', color:'#ff647c', fontSize:18, cursor:'pointer', flexShrink:0, padding:0, lineHeight:1 }}>
            ×
          </button>
        </div>
      )}
    </BrowserRouter>
  );
}
