// ─────────────────────────────────────────────
// ÉCOSYSTÈME DU LECTEUR (étape 5 du découpage) — composants partagés par
// plusieurs pages mélomane : Kiff, Commentaire, ActionBar, AudioPlayer,
// VideoPlayer, tuto, connexion rapide...
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, updateProfile,
} from 'firebase/auth';
import {
  C, S, ADMIN_EMAIL, demanderResetPassword, envoyerNotification, notifierAdminEnregistrement,
  optimImg, logTx, lancerPaiementGeniusPay, notifierActiviteCommunaute, donnerKiff, KIFFEMENTS,
  COIN_OSCART_SYMBOLE, RECHARGES,
} from '../lib/utils';
import {
  formatTime, LoginModal, RechargeDeviseSelector, SignatureShowcase, useDeviseLocale,
} from './shared';

export function KiffementSection({ qrId, artistEmail, compact, autoOpen, onClose, source = 'qr' }: { qrId: string, artistEmail?: string, compact?: boolean, autoOpen?: boolean, onClose?: () => void, source?: 'qr' | 'public' }) {
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
export function CommentSection({ qrId, artistEmail, compact, autoOpen, onClose, source = 'qr' }: { qrId: string, artistEmail?: string, compact?: boolean, autoOpen?: boolean, onClose?: () => void, source?: 'qr' | 'public' }) {
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
export const MESSAGES_HONORIFIQUES = [
  "Merci infiniment pour ton soutien, tu es un vrai Travailleur !",
  "Ton kiffement me touche profondément, que Dieu te bénisse !",
  "Tu es la raison pour laquelle je continue à créer. Merci !",
  "Un grand merci à toi, mon fidèle Travailleur !",
  "Ton soutien me donne de l'énergie. Je te dédie cette musique !",
];

export function Travailleurs({ qrId, artistEmail }: { qrId: string, artistEmail?: string }) {
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
export const TUTO_STEPS = [
  { id:'btn-play', label:'Écoutez', desc:'Appuyez sur Play pour écouter la musique de votre artiste', color:'#1a6bff' },
  { id:'btn-download', label:'Téléchargez', desc:'Téléchargez ce contenu sur votre téléphone', color:'#1a6bff' },
  { id:'btn-like', label:'Kiffez', desc:'Appuyez sur Kiff pour soutenir votre artiste', color:'#f04a6a' },
  { id:'btn-kiffement', label:'Kiffement', desc:'Envoyez un kiffement — 70% va directement à l\'artiste', color:'#ffd700' },
  { id:'btn-ziko', label:'Zikothèque', desc:'Ajoutez à votre Zikothèque pour retrouver ce contenu partout', color:'#7c3aed' },
  { id:'pwa-install-btn', label:'Installer l\'app', desc:'Installez Doniel Zik pour accéder à votre musique partout', color:'#1a6bff' },
];

export function TutoPointer({ step, onNext, onSkip }: { step: number, onNext: () => void, onSkip: () => void }) {
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
export function ActionBar({ qrId, artistEmail, buzz, tutoStep, onTutoNext, source = 'qr' }: {
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
export function LikeButton({ qrId, compact, artistEmail, source = 'qr' }: { qrId: string, compact?: boolean, artistEmail?: string, source?: 'qr' | 'public' }) {
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
export function AudioPlayer({ files, onStream, onPlay, onDownload, onPlayingChange, autoStartIdx, autoStartCle, onFinAlbum, albumTitre, albumArtiste, albumCover }: { files: any[], onStream?: (track: string, duration: number) => void, onPlay?: () => void, onDownload?: () => void, onPlayingChange?: (playing: boolean) => void, autoStartIdx?: number, autoStartCle?: number, onFinAlbum?: () => void, albumTitre?: string, albumArtiste?: string, albumCover?: string }) {
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
export const TUTO_BUBBLES = [
  { id:'btn-like', text:'Kiffez la musique\nde votre artiste', color:'#f04a6a', side:'right' },
  { id:'btn-comment', text:'Commentez', color:'#1a6bff', side:'left' },
  { id:'btn-kiffement', text:'Faites un kiffement\nà votre artiste', color:'#ffd700', side:'right' },
  { id:'btn-ziko', text:'Ajoutez à votre\nZikothèque', color:'#7c3aed', side:'left' },
  { id:'btn-download', text:'Téléchargez\nla musique', color:'#00c853', side:'right' },
];

export function TutoCascade({ onDone }: { onDone: () => void }) {
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
export function VideoPlayer({ files, onPlay }: { files: any[], onPlay?: () => void }) {
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
export function MediaPlayers({ files, onStream, onSafari, downloaded, onMarkDownloaded, onPlay }:
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
export function ZikoLoginModal({ onSuccess, onClose }: { onSuccess: (uid: string) => void, onClose: () => void }) {
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
