// ─────────────────────────────────────────────
// PAGES MÉLOMANE PRINCIPALES (étape 6b) — FanPage (duplication physique),
// LandingPage, UserAuthPage, ZikothequePage + petits utilitaires associés
// (ScannerQR, IconeScannerBouton, generatePochettes).
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile,
  RecaptchaVerifier, signInWithPhoneNumber,
} from 'firebase/auth';
import {
  estFichierAudio, C, GLOW_TOP, ADMIN_EMAIL, demanderResetPassword, envoyerNotification,
  BASE_URL, optimImg, notifierActiviteCommunaute, APP_NAME, LOGO_B64,
  isIOS, isAndroid, isSafari, isChromeiOS, isMobileDevice, S,
} from '../lib/utils';
import { formatTime, Logo, Lien, BadgeNotif } from '../components/shared';
import {
  Travailleurs, ActionBar, AudioPlayer, TutoCascade, VideoPlayer, ZikoLoginModal,
} from '../components/player';
import { AchatWidget } from '../components/achat';
import { PubOverlay, AdminPage } from './admin';

export function FanPage() {
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
export async function generatePochettes(qrcodes: any[], templateFile: File, onProgress: (p: number) => void): Promise<void> {
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
export function ScannerQR({ onClose }: { onClose: () => void }) {
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
export function IconeScannerBouton({ onClick }: { onClick: () => void }) {
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

export function LandingPage() {
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

export function UserAuthPage() {
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
export function ZikothequePage({ user }: { user: any }) {
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
