import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { Html5Qrcode } from 'html5-qrcode';
import { db, auth } from './firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, query, orderBy, where, getDocs, arrayUnion
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

const ADMIN_EMAIL = 'admin@securedrop.com';
const CLOUDINARY_CLOUD = 'drjp8ht84';
const CLOUDINARY_UPLOAD_PRESET = 'securedrop_unsigned';
const BASE_URL = 'https://securedrop-ci.vercel.app';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = () => { const ua = navigator.userAgent; return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua); };
const isChromeiOS = () => /CriOS/.test(navigator.userAgent);

const S = {
  bg: { minHeight: '100vh', background: '#07080f', color: '#e8eaf2', fontFamily: 'sans-serif' } as React.CSSProperties,
  card: { background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 16, padding: 24, marginBottom: 16 } as React.CSSProperties,
  btn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#c8f04a', color: '#07080f', fontWeight: 700, cursor: 'pointer', fontSize: 14 } as React.CSSProperties,
  btn2: { padding: '8px 16px', borderRadius: 8, border: '1px solid #1c1f2e', background: 'transparent', color: '#8890b0', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  btnRed: { padding: '8px 14px', borderRadius: 8, border: '1px solid #f04a6a', background: '#2e0d14', color: '#f04a6a', cursor: 'pointer', fontSize: 12, fontWeight: 700 } as React.CSSProperties,
  btnGoogle: { padding: '12px 20px', borderRadius: 10, border: '1px solid #374151', background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' } as React.CSSProperties,
  inp: { width: '100%', background: '#0a0b12', border: '1px solid #252840', borderRadius: 10, padding: '11px 14px', color: '#e8eaf2', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' } as React.CSSProperties,
  lbl: { display: 'block', color: '#8890b0', fontSize: 12, marginBottom: 6 } as React.CSSProperties,
};

const tabStyle = (a: boolean): React.CSSProperties => ({ padding: '10px 18px', border: 'none', background: 'transparent', color: a ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 13, fontWeight: a ? 700 : 400, borderBottom: '2px solid ' + (a ? '#c8f04a' : 'transparent') });
const badgeStyle = (s: string): React.CSSProperties => { const m: any = { active: ['#0d2e1a', '#4af09a'], locked: ['#2e1a0d', '#f0b84a'], pending: ['#2e1a0d', '#f0b84a'], verified: ['#0d2e1a', '#4af09a'], rejected: ['#2e0d14', '#f04a6a'] }; const [bg, c] = m[s] || ['#1c1f2e', '#8890b0']; return { fontSize: 11, padding: '3px 10px', borderRadius: 99, background: bg, color: c, fontWeight: 700 }; };
const formatSize = (bytes: number) => { if (!bytes) return ''; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };
const cleanName = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
const formatTime = (t: number) => { if (!t || isNaN(t)) return '0:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.2-2.7-.4-4z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.6 26.9 36.5 24 36.5c-5.2 0-9.7-3.3-11.3-8L6 33.8C9.5 39.8 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.8 44 30.3 44 24c0-1.3-.2-2.7-.4-4z"/>
  </svg>
);

// ─────────────────────────────────────────────
// QR SCANNER COMPONENT
// ─────────────────────────────────────────────
function QRScanner({ onScan, onClose }: { onScan: (qrId: string) => void, onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Extract qrId from URL or use directly
        let qrId = decodedText;
        if (decodedText.includes('/fan/')) {
          qrId = decodedText.split('/fan/').pop() || decodedText;
        }
        scanner.stop().then(() => onScan(qrId.trim().toUpperCase()));
      },
      () => {}
    ).then(() => setScanning(true)).catch((e: any) => {
      setError('Impossible d acces a la camera: ' + e.message);
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,8,15,.95)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: 17 }}>Scanner un QR code</p>
            <p style={{ color: '#8890b0', fontSize: 13 }}>Pointez vers le QR code de la pochette</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 99, border: '1px solid #1c1f2e', background: 'transparent', color: '#8890b0', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {error ? (
          <div style={{ background: '#2e0d14', border: '1px solid #f04a6a', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <p style={{ color: '#f04a6a', fontSize: 14, marginBottom: 16 }}>{error}</p>
            <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 16 }}>Ou entrez la reference manuellement :</p>
            <input
              id="manual-qr"
              style={{ ...S.inp, marginBottom: 12, textAlign: 'center', letterSpacing: 3, fontFamily: 'monospace', fontSize: 16, textTransform: 'uppercase' }}
              placeholder="Ex: TFHM63TN"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (document.getElementById('manual-qr') as HTMLInputElement)?.value;
                  if (val) onScan(val.trim().toUpperCase());
                }
              }}
            />
            <button onClick={() => {
              const val = (document.getElementById('manual-qr') as HTMLInputElement)?.value;
              if (val) onScan(val.trim().toUpperCase());
            }} style={{ ...S.btn, width: '100%' }}>Acceder →</button>
          </div>
        ) : (
          <div>
            <div id="qr-reader" style={{ borderRadius: 16, overflow: 'hidden', border: '2px solid #c8f04a' }} />
            {!scanning && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 8px', animation: 'spin .8s linear infinite' }} />
                <p style={{ color: '#8890b0', fontSize: 13 }}>Initialisation camera...</p>
              </div>
            )}
            <div style={{ marginTop: 16, background: '#0e1018', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 10 }}>Ou entrez la reference manuellement :</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="manual-qr2"
                  style={{ ...S.inp, marginBottom: 0, flex: 1, textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'monospace' }}
                  placeholder="TFHM63TN"
                />
                <button onClick={() => {
                  const val = (document.getElementById('manual-qr2') as HTMLInputElement)?.value;
                  if (val) onScan(val.trim().toUpperCase());
                }} style={{ ...S.btn, padding: '10px 16px' }}>→</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// AUDIO PLAYER
// ─────────────────────────────────────────────
function AudioPlayer({ files }: { files: any[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [ct, setCt] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  const cur = files[idx];

  useEffect(() => { if (ref.current) { ref.current.pause(); ref.current.load(); if (playing) ref.current.play().catch(() => setPlaying(false)); } }, [idx]);

  const toggle = () => { if (!ref.current) return; if (playing) { ref.current.pause(); setPlaying(false); } else { ref.current.play().catch(() => setPlaying(false)); setPlaying(true); } };

  if (!files || files.length === 0) return null;

  return (
    <div style={{ background: '#0a0b12', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <audio ref={ref} src={cur?.url}
        onTimeUpdate={() => { if (ref.current) { setCt(ref.current.currentTime); setProgress((ref.current.currentTime / ref.current.duration) * 100 || 0); } }}
        onLoadedMetadata={() => { if (ref.current) setDur(ref.current.duration); }}
        onEnded={() => { if (idx < files.length - 1) { setIdx(i => i + 1); setPlaying(true); } else { setPlaying(false); } }}
        preload="metadata" />
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, background: 'linear-gradient(135deg, #c8f04a, #4af09a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 8px' }}>🎵</div>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{cur?.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (idx + 1)}</p>
        <p style={{ color: '#5a6080', fontSize: 11 }}>{idx + 1} / {files.length}</p>
      </div>
      <div onClick={(e) => { if (!ref.current) return; const r = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.clientX - r.left) / r.width) * ref.current.duration; }} style={{ height: 5, background: '#1c1f2e', borderRadius: 99, marginBottom: 6, cursor: 'pointer' }}>
        <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .1s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#5a6080', marginBottom: 12 }}><span>{formatTime(ct)}</span><span>{formatTime(dur)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <button onClick={() => { if (idx > 0) { setIdx(i => i - 1); setPlaying(true); } }} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#2a2a3a' : '#8890b0', fontSize: 20, cursor: idx === 0 ? 'default' : 'pointer' }}>⏮</button>
        <button onClick={toggle} style={{ width: 50, height: 50, borderRadius: 99, border: 'none', background: '#c8f04a', color: '#07080f', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{playing ? '⏸' : '▶'}</button>
        <button onClick={() => { if (idx < files.length - 1) { setIdx(i => i + 1); setPlaying(true); } }} disabled={idx === files.length - 1} style={{ background: 'none', border: 'none', color: idx === files.length - 1 ? '#2a2a3a' : '#8890b0', fontSize: 20, cursor: idx === files.length - 1 ? 'default' : 'pointer' }}>⏭</button>
      </div>
      {files.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1c1f2e', paddingTop: 10 }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { setIdx(i); setPlaying(true); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: i === idx ? '#1a2a0a' : 'transparent', marginBottom: 2 }}>
              <span style={{ color: i === idx ? '#c8f04a' : '#5a6080', fontSize: 12, fontWeight: 700, minWidth: 16 }}>{i === idx && playing ? '▶' : (i + 1)}</span>
              <span style={{ fontSize: 12, color: i === idx ? '#c8f04a' : '#8890b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (i + 1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FAN AUTH MODAL
// ─────────────────────────────────────────────
function FanAuthModal({ qrData, onClose, onSuccess }: { qrData: any, onClose: () => void, onSuccess: () => void }) {
  const [mode, setMode] = useState<'choice' | 'email'>('choice');
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const albumEntry = {
    qrId: qrData.qrId, label: qrData.label, artist: qrData.artist,
    type: qrData.type, files: qrData.files || [], fileCount: qrData.fileCount || 0,
    addedAt: new Date().toISOString(), url: qrData.url,
  };

  const save = async (uid: string) => {
    const ref = doc(db, 'fans', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data().playlist || [];
      if (!existing.find((a: any) => a.qrId === qrData.qrId)) {
        await updateDoc(ref, { playlist: arrayUnion(albumEntry) });
      }
    } else {
      await setDoc(ref, { playlist: [albumEntry], createdAt: new Date().toISOString() });
    }
    onSuccess();
  };

  const handleGoogle = async () => {
    setLoading(true);
    try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); await save(r.user.uid); }
    catch (e: any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  const handleEmail = async () => {
    if (!email || !password) { setMsg('Remplis tous les champs'); return; }
    setLoading(true);
    try {
      let uid = '';
      if (isLogin) { uid = (await signInWithEmailAndPassword(auth, email, password)).user.uid; }
      else { uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid; }
      await save(uid);
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,8,15,.92)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420 }}>
        {mode === 'choice' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🎵</p>
              <h3 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sauvegarde dans ta playlist !</h3>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: '#c8f04a' }}>{qrData.label}</strong> sera ajoute a ta playlist. Ecoute-le quand tu veux !</p>
            </div>
            <button onClick={handleGoogle} style={{ ...S.btnGoogle, marginBottom: 12 }} disabled={loading}><GoogleIcon />Continuer avec Google</button>
            <button onClick={() => setMode('email')} style={{ ...S.btn, width: '100%', marginBottom: 12 }}>Continuer avec Email</button>
            <button onClick={onClose} style={{ ...S.btn2, width: '100%', textAlign: 'center' as const }}>Non merci</button>
          </>
        )}
        {mode === 'email' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', color: '#8890b0', cursor: 'pointer', fontSize: 20 }}>←</button>
              <h3 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800 }}>{isLogin ? 'Se connecter' : 'Creer un compte'}</h3>
            </div>
            <label style={S.lbl}>Email</label>
            <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" />
            <label style={S.lbl}>Mot de passe</label>
            <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            {msg && <p style={{ color: '#f04a6a', fontSize: 12, marginBottom: 12 }}>{msg}</p>}
            <button onClick={handleEmail} style={{ ...S.btn, width: '100%', marginBottom: 12 }} disabled={loading}>{loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Creer mon compte'}</button>
            <p style={{ textAlign: 'center', color: '#5a6080', fontSize: 12, cursor: 'pointer' }} onClick={() => { setIsLogin(!isLogin); setMsg(''); }}>{isLogin ? 'Pas encore de compte ?' : 'Deja un compte ?'}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLAYLIST PAGE
// ─────────────────────────────────────────────
function PlaylistPage() {
  const [fanUser, setFanUser] = useState<any>(null);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAlbum, setActiveAlbum] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Listen to auth state — session persists automatically
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.email !== ADMIN_EMAIL) {
        setFanUser(u);
        const snap = await getDoc(doc(db, 'fans', u.uid));
        if (snap.exists()) setPlaylist(snap.data().playlist || []);
      } else if (!u) {
        setFanUser(null);
        setPlaylist([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleGoogle = async () => {
    try {
      const r = await signInWithPopup(auth, new GoogleAuthProvider());
      const snap = await getDoc(doc(db, 'fans', r.user.uid));
      if (snap.exists()) setPlaylist(snap.data().playlist || []);
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
  };

  const handleEmail = async () => {
    if (!email || !password) { setMsg('Remplis tous les champs'); return; }
    try {
      let uid = '';
      if (authMode === 'login') { uid = (await signInWithEmailAndPassword(auth, email, password)).user.uid; }
      else { uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid; }
      const snap = await getDoc(doc(db, 'fans', uid));
      if (snap.exists()) setPlaylist(snap.data().playlist || []);
    } catch (e: any) { setMsg(e.message); }
  };

  const handleScan = (qrId: string) => {
    setShowScanner(false);
    navigate('/fan/' + qrId);
  };

  if (loading) return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 44, height: 44, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, animation: 'spin .8s linear infinite' }} />
    </div>
  );

  if (!fanUser) return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 10px' }}>◈</div>
          <p style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800 }}>SecureDrop</p>
          <p style={{ color: '#5a6080', fontSize: 12, marginTop: 4 }}>Ma Playlist</p>
        </div>
        <div style={S.card}>
          <h3 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>Acces a ma playlist</h3>
          <p style={{ color: '#8890b0', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>Connecte-toi pour acceder a tes albums</p>
          <button onClick={handleGoogle} style={{ ...S.btnGoogle, marginBottom: 14 }}><GoogleIcon />Continuer avec Google</button>
          <div style={{ borderTop: '1px solid #1c1f2e', paddingTop: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setAuthMode('login')} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid ' + (authMode === 'login' ? '#c8f04a' : '#1c1f2e'), background: authMode === 'login' ? '#1a2a0a' : 'transparent', color: authMode === 'login' ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>Se connecter</button>
              <button onClick={() => setAuthMode('register')} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid ' + (authMode === 'register' ? '#c8f04a' : '#1c1f2e'), background: authMode === 'register' ? '#1a2a0a' : 'transparent', color: authMode === 'register' ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>Creer un compte</button>
            </div>
            <label style={S.lbl}>Email</label>
            <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" onKeyDown={e => e.key === 'Enter' && handleEmail()} />
            <label style={S.lbl}>Mot de passe</label>
            <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleEmail()} />
            {msg && <p style={{ color: '#f04a6a', fontSize: 12, marginBottom: 10 }}>{msg}</p>}
            <button onClick={handleEmail} style={{ ...S.btn, width: '100%' }}>{authMode === 'login' ? 'Se connecter' : 'Creer mon compte'}</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.bg}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* HEADER */}
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>◈</div>
          <div><p style={{ fontWeight: 800, fontSize: 14 }}>SecureDrop</p><p style={{ color: '#5a6080', fontSize: 10 }}>MA PLAYLIST</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ color: '#8890b0', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fanUser.displayName || fanUser.email?.split('@')[0]}</p>
          <button style={S.btn2} onClick={() => signOut(auth)}>Deconnexion</button>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>

        {/* ACTIVE PLAYER */}
        {activeAlbum && (
          <div style={{ ...S.card, border: '1px solid #1a3a1a', animation: 'fadeUp .3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div><p style={{ fontWeight: 800, fontSize: 15 }}>{activeAlbum.label}</p><p style={{ color: '#8890b0', fontSize: 12 }}>par {activeAlbum.artist}</p></div>
              <button onClick={() => setActiveAlbum(null)} style={{ background: 'none', border: 'none', color: '#5a6080', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <AudioPlayer files={activeAlbum.files || []} />
          </div>
        )}

        {/* SCAN BUTTON */}
        <div style={{ ...S.card, background: 'linear-gradient(135deg, #1a2a0a, #0d2e1a)', border: '1px solid #2a4a1a', textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📱</p>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Ajouter un album</p>
          <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 16 }}>Scanne le QR code d une nouvelle pochette</p>
          <button onClick={() => setShowScanner(true)} style={{ ...S.btn, padding: '14px 32px', fontSize: 15 }}>
            Scanner un nouvel album
          </button>
        </div>

        {/* PLAYLIST */}
        <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, fontFamily: 'serif' }}>Mes Albums ({playlist.length})</p>

        {playlist.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🎵</p>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ta playlist est vide</p>
            <p style={{ color: '#8890b0', fontSize: 13 }}>Scanne une pochette pour commencer !</p>
          </div>
        ) : playlist.map((album, i) => (
          <div key={i} style={{ ...S.card, borderColor: activeAlbum?.qrId === album.qrId ? '#1a3a1a' : '#1c1f2e', animation: 'fadeUp .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg, #c8f04a22, #4af09a22)', border: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {album.type === 'video' ? '🎬' : '🎵'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.label}</p>
                <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{album.artist}</p>
                <p style={{ color: '#5a6080', fontSize: 11 }}>{album.fileCount || 0} piste(s)</p>
              </div>
              <button onClick={() => setActiveAlbum(activeAlbum?.qrId === album.qrId ? null : album)}
                style={{ width: 44, height: 44, borderRadius: 99, border: 'none', background: activeAlbum?.qrId === album.qrId ? '#1a2a0a' : '#c8f04a', color: activeAlbum?.qrId === album.qrId ? '#4af09a' : '#07080f', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {activeAlbum?.qrId === album.qrId ? '⏸' : '▶'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FAN PAGE
// ─────────────────────────────────────────────
function FanPage() {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<'loading' | 'ready' | 'locked' | 'zipping' | 'done'>('loading');
  const [qrData, setQrData] = useState<any>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');
  const [copied, setCopied] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [showFanAuth, setShowFanAuth] = useState(false);
  const [savedToPlaylist, setSavedToPlaylist] = useState(false);
  const [fanUser, setFanUser] = useState<any>(null);
  const currentUrl = window.location.href;
  const onSafari = isSafari() && isIOS() && !isChromeiOS();

  useEffect(() => {
    onAuthStateChanged(auth, (u) => { if (u && u.email !== ADMIN_EMAIL) setFanUser(u); });
    const load = async () => {
      const q = query(collection(db, 'qrcodes'), where('qrId', '==', qrId));
      const snap = await getDocs(q);
      if (snap.empty) { setStep('locked'); return; }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      setQrData(data);
      if (data.status === 'locked' || (data.usedScans || 0) >= (data.totalScans || 0)) setStep('locked');
      else setStep('ready');
    };
    load();
  }, [qrId]);

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); };

  const markAsDownloaded = async () => {
    if (!qrData || downloaded) return;
    setDownloaded(true);
    const newUsed = (qrData.usedScans || 0) + 1;
    await updateDoc(doc(db, 'qrcodes', qrData.id), { usedScans: newUsed, downloads: (qrData.downloads || 0) + 1, status: newUsed >= qrData.totalScans ? 'locked' : 'active' });
  };

  const startDownload = async () => {
    if (!qrData || downloaded) return;
    await markAsDownloaded();
    const files = qrData.files || [];
    setStep('zipping');
    try {
      if (files.length === 0) { setDlStatus('Aucun fichier'); setStep('done'); return; }
      if (files.length === 1) {
        setDlProgress(50);
        const a = document.createElement('a'); a.href = files[0].url.replace('/upload/', '/upload/fl_attachment/'); a.download = files[0].name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setDlProgress(100); setStep('done'); return;
      }
      const zip = new JSZip();
      const folder = zip.folder(qrData.label || 'SecureDrop') as JSZip;
      for (let i = 0; i < files.length; i++) {
        setDlStatus('Preparation ' + (i + 1) + '/' + files.length); setDlProgress(Math.round((i / files.length) * 70));
        try { const r = await fetch(files[i].url.replace('/upload/', '/upload/fl_attachment/')); folder.file(files[i].name, await r.blob()); } catch (e) { console.error(e); }
      }
      setDlStatus('Compression...'); setDlProgress(80);
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (m) => setDlProgress(80 + Math.round(m.percent * 0.2)));
      setDlProgress(100);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a'); a.href = url; a.download = (qrData.label || 'SecureDrop').replace(/[^a-zA-Z0-9_-]/g, '_') + '.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setStep('done');
    } catch (e: any) { setDlStatus('Erreur: ' + e.message); setStep('done'); }
  };

  // Auto-save to playlist if fan already logged in
  const saveIfLoggedIn = async () => {
    if (!fanUser || !qrData || savedToPlaylist) return;
    const albumEntry = { qrId: qrData.qrId, label: qrData.label, artist: qrData.artist, type: qrData.type, files: qrData.files || [], fileCount: qrData.fileCount || 0, addedAt: new Date().toISOString(), url: qrData.url };
    const ref = doc(db, 'fans', fanUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) { const ex = snap.data().playlist || []; if (!ex.find((a: any) => a.qrId === qrData.qrId)) await updateDoc(ref, { playlist: arrayUnion(albumEntry) }); }
    else await setDoc(ref, { playlist: [albumEntry], createdAt: new Date().toISOString() });
    setSavedToPlaylist(true);
  };

  return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {showFanAuth && qrData && (
        <FanAuthModal qrData={qrData} onClose={() => setShowFanAuth(false)} onSuccess={() => { setShowFanAuth(false); setSavedToPlaylist(true); }} />
      )}

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 8px' }}>◈</div>
        <p style={{ fontFamily: 'serif', fontSize: 17, fontWeight: 800 }}>SecureDrop</p>
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {step === 'loading' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ color: '#8890b0' }}>Chargement...</p>
          </div>
        )}

        {step === 'ready' && qrData && (
          <div style={{ animation: 'fadeUp .4s ease' }}>
            <div style={{ ...S.card, border: '1px solid #1a3a1a' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ color: '#4af09a', fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>CONTENU EXCLUSIF</p>
                <h1 style={{ fontFamily: 'serif', fontSize: 24, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>{qrData.label}</h1>
                <p style={{ color: '#8890b0', fontSize: 14 }}>par <strong style={{ color: '#e8eaf2' }}>{qrData.artist}</strong></p>
              </div>

              {!downloaded ? (
                onSafari ? (
                  <div>
                    <button onClick={() => { const iframe = document.createElement('iframe'); iframe.style.display = 'none'; iframe.src = currentUrl.replace('https://', 'googlechromes://'); document.body.appendChild(iframe); setTimeout(() => { document.body.removeChild(iframe); window.location.href = 'https://apps.apple.com/app/google-chrome/id535886823'; }, 2500); }}
                      style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16, background: '#4285f4', borderRadius: 12, marginBottom: 8 }}>
                      🌐 Ouvrir dans Chrome
                    </button>
                    <p style={{ color: '#5a6080', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>ou appuyez longuement sur les fichiers ci-dessous</p>
                  </div>
                ) : (
                  <button onClick={startDownload} style={{ ...S.btn, width: '100%', padding: 18, fontSize: 17, borderRadius: 12, marginBottom: 8 }}>
                    ⬇ {(qrData.files?.length || 0) > 1 ? 'Telecharger l album complet' : 'Telecharger'}
                  </button>
                )
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 10 }}>
                    <p style={{ color: '#4af09a', fontWeight: 700, fontSize: 13 }}>✓ Telechargement effectue</p>
                  </div>
                  {!savedToPlaylist ? (
                    fanUser ? (
                      <button onClick={saveIfLoggedIn} style={{ ...S.btn, width: '100%', padding: 13, fontSize: 14, borderRadius: 10 }}>
                        🎵 Ajouter a ma playlist
                      </button>
                    ) : (
                      <button onClick={() => setShowFanAuth(true)} style={{ ...S.btn, width: '100%', padding: 13, fontSize: 14, borderRadius: 10 }}>
                        🎵 Sauvegarder dans ma playlist
                      </button>
                    )
                  ) : (
                    <button onClick={() => navigate('/playlist')} style={{ ...S.btn, width: '100%', padding: 13, fontSize: 14, borderRadius: 10, background: '#4af09a' }}>
                      ✓ Voir ma playlist →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* AUDIO PLAYER */}
            {qrData.files && qrData.files.length > 0 && (
              <div style={S.card}>
                <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>LECTEUR — STREAMING GRATUIT</p>
                <AudioPlayer files={qrData.files} />
                {/* Safari links */}
                {onSafari && !downloaded && (
                  <div style={{ borderTop: '1px solid #1c1f2e', paddingTop: 12, marginTop: 4 }}>
                    <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>APPUYEZ LONGUEMENT POUR TELECHARGER</p>
                    {qrData.files.map((f: any, i: number) => (
                      <a key={i} href={f.url.replace('/upload/', '/upload/fl_attachment/')} download={f.name} target="_blank" rel="noreferrer"
                        onClick={i === 0 ? () => markAsDownloaded() : undefined}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a0b12', border: '1px solid #1c1f2e', borderRadius: 10, padding: '10px 14px', marginBottom: 8, textDecoration: 'none', color: '#e8eaf2' }}>
                        <span>🎵</span>
                        <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name?.replace(/\.[^/.]+$/, '')}</span>
                        <span style={{ color: '#c8f04a' }}>⬇</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Link to playlist */}
            <button onClick={() => navigate('/playlist')} style={{ ...S.btn2, width: '100%', textAlign: 'center' as const, padding: 12 }}>
              🎵 Ma playlist
            </button>
          </div>
        )}

        {step === 'zipping' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36 }}>
            <div style={{ width: 48, height: 48, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Preparation...</p>
            <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 20 }}>{dlStatus}</p>
            <div style={{ height: 8, background: '#1c1f2e', borderRadius: 99, marginBottom: 12 }}>
              <div style={{ height: '100%', width: dlProgress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .3s' }} />
            </div>
            <p style={{ color: '#c8f04a', fontWeight: 800, fontSize: 28 }}>{dlProgress}%</p>
            <p style={{ color: '#5a6080', fontSize: 11, marginTop: 12 }}>Ne fermez pas cette page</p>
          </div>
        )}

        {step === 'locked' && (
          <div style={{ ...S.card, border: '1px solid #3a1a1a', animation: 'fadeUp .4s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: '#2e0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔒</div>
              <p style={{ color: '#f04a6a', fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>ACCES BLOQUE</p>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, marginBottom: 4 }}>{qrData?.label || 'Contenu protege'}</h2>
              <p style={{ color: '#8890b0', fontSize: 13 }}>par {qrData?.artist || '—'}</p>
            </div>
            <div style={{ background: '#1a1000', border: '1px solid #3a2a00', borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: '#f0b84a', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Nombre de telechargements atteint</p>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.8 }}>Contactez l artiste <strong style={{ color: '#f9fafb' }}>{qrData?.artist}</strong> avec la reference ci-dessous.</p>
            </div>
            <div style={{ background: '#0a0b12', borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 10, letterSpacing: 2 }}>VOTRE REFERENCE</p>
              <p style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 32, color: '#c8f04a', letterSpacing: 6, marginBottom: 14 }}>{qrData?.qrId || qrId}</p>
              <button onClick={() => copy(qrData?.qrId || qrId || '', 'qrid')} style={{ ...S.btn, padding: '10px 28px' }}>{copied === 'qrid' ? '✓ Copie !' : 'Copier la reference'}</button>
            </div>
            <div style={{ background: '#0a0b12', borderRadius: 10, padding: 16, marginBottom: 14 }}>
              {[['1', 'Copiez la reference ' + (qrData?.qrId || qrId)], ['2', 'Contactez l artiste ' + (qrData?.artist || '') + ' et envoyez la reference avec votre paiement'], ['3', 'Apres activation, rescannez ce QR code']].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 99, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#07080f', flexShrink: 0 }}>{n}</div>
                  <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.6 }}>{t}</p>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/playlist')} style={{ ...S.btn2, width: '100%', textAlign: 'center' as const }}>🎵 Ma playlist</button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36, animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 52, marginBottom: 16 }}>{dlStatus.startsWith('Erreur') ? '❌' : '✅'}</p>
            <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{dlStatus.startsWith('Erreur') ? 'Erreur' : 'Telechargement termine !'}</h2>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>{dlStatus.startsWith('Erreur') ? dlStatus : 'Votre fichier est dans vos telechargements.'}</p>
            {!savedToPlaylist ? (
              fanUser ? (
                <button onClick={saveIfLoggedIn} style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10 }}>🎵 Ajouter a ma playlist</button>
              ) : (
                <button onClick={() => setShowFanAuth(true)} style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10 }}>🎵 Sauvegarder dans ma playlist</button>
              )
            ) : (
              <button onClick={() => navigate('/playlist')} style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10, background: '#4af09a' }}>✓ Voir ma playlist →</button>
            )}
            <div style={{ background: '#0a0b12', borderRadius: 8, padding: 10, fontSize: 11, color: '#5a6080' }}>LIEN REVOQUE — ACCES DESACTIVE</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────────
function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qrcodes, setQrcodes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('qrcodes');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newType, setNewType] = useState('album');
  const [newPrice, setNewPrice] = useState('');
  const [newScans, setNewScans] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [qrModal, setQrModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editScans, setEditScans] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editFiles, setEditFiles] = useState<any[]>([]);
  const [addFiles, setAddFiles] = useState<FileList | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadMsg, setEditUploadMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { onAuthStateChanged(auth, (u) => { if (u && u.email === ADMIN_EMAIL) { setUser(u); setView('dashboard'); } else if (!u) { setUser(null); setView('login'); } }); }, []);
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db, 'qrcodes'), orderBy('createdAt', 'desc')), s => setQrcodes(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [user]);

  const login = async () => { setLoading(true); try { await signInWithEmailAndPassword(auth, email, password); setMsg(''); } catch { setMsg('Email ou mot de passe incorrect'); } setLoading(false); };
  const logout = async () => { await signOut(auth); };

  const uploadFile = async (file: File, qrId: string, i: number, total: number, setProgress: (s: string, p: number) => void) => {
    const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); fd.append('resource_type', 'auto'); fd.append('public_id', 'securedrop/' + qrId + '/' + cleanName(file.name));
    setProgress('Upload ' + (i + 1) + '/' + total + ' — ' + file.name, Math.round((i / total) * 100));
    const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'Failed'); }
    const d = await r.json(); return { name: file.name, url: d.secure_url, size: file.size, publicId: d.public_id };
  };

  const createQR = async () => {
    if (!newLabel || !newArtist || !newPrice || !newScans) { setMsg('Remplis tous les champs'); return; }
    setLoading(true); setMsg('');
    try {
      const qrId = Math.random().toString(36).slice(2, 10).toUpperCase();
      const files = selectedFiles ? Array.from(selectedFiles) : [];
      const uploaded: any[] = [];
      for (let i = 0; i < files.length; i++) uploaded.push(await uploadFile(files[i], qrId, i, files.length, (s, p) => { setUploadMsg(s); setUploadProgress(p); }));
      setUploadProgress(100);
      await addDoc(collection(db, 'qrcodes'), { qrId, label: newLabel, artist: newArtist, type: newType, price: parseInt(newPrice), totalScans: parseInt(newScans), usedScans: 0, downloads: 0, files: uploaded, fileCount: uploaded.length, status: 'active', createdAt: new Date().toISOString(), url: BASE_URL + '/fan/' + qrId });
      setNewLabel(''); setNewArtist(''); setNewPrice(''); setNewScans(''); setSelectedFiles(null); setUploadProgress(0); setUploadMsg('');
      setMsg('QR ' + qrId + ' cree avec ' + uploaded.length + ' fichier(s) !');
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  const openEdit = (q: any) => { setEditModal(q); setEditPrice(String(q.price)); setEditScans(String(q.totalScans)); setEditFiles(q.files || []); setAddFiles(null); setEditUploadMsg(''); };

  const uploadEditFiles = async () => {
    if (!addFiles || !editModal) return;
    setEditUploading(true); const uploaded: any[] = [];
    for (let i = 0; i < addFiles.length; i++) {
      setEditUploadMsg('Upload ' + (i + 1) + '/' + addFiles.length);
      try { uploaded.push(await uploadFile(addFiles[i], editModal.qrId, i, addFiles.length, (s) => setEditUploadMsg(s))); } catch (e) { console.error(e); }
    }
    setEditFiles(f => [...f, ...uploaded]); setAddFiles(null); setEditUploadMsg(uploaded.length + ' fichier(s) ajoute(s) !'); setEditUploading(false);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const newTotal = parseInt(editScans) || editModal.totalScans;
    await updateDoc(doc(db, 'qrcodes', editModal.id), { price: parseInt(editPrice) || editModal.price, totalScans: newTotal, files: editFiles, fileCount: editFiles.length, status: (editModal.usedScans || 0) < newTotal ? 'active' : 'locked' });
    setEditModal(null); setMsg('QR mis a jour !');
  };

  const verifyPayment = async (p: any) => {
    await updateDoc(doc(db, 'payments', p.id), { status: 'verified' });
    const qr = qrcodes.find(q => q.id === p.qrDocId);
    if (qr) await updateDoc(doc(db, 'qrcodes', p.qrDocId), { status: 'active', totalScans: (qr.totalScans || 0) + 10 });
    setMsg('Paiement valide !');
  };

  const downloadQR = (q: any) => { const c = document.getElementById('qr-dl-' + q.id) as HTMLCanvasElement; if (!c) return; const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = q.label + '-' + q.qrId + '.png'; a.click(); };

  const filteredQRs = qrcodes.filter(q => q.label?.toLowerCase().includes(searchTerm.toLowerCase()) || q.artist?.toLowerCase().includes(searchTerm.toLowerCase()) || q.qrId?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (view === 'login') return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>◈</div>
          <h1 style={{ fontFamily: 'serif', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>SecureDrop</h1>
          <p style={{ color: '#5a6080', fontSize: 12 }}>Plateforme de distribution securisee</p>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@securedrop.com" onKeyDown={e => e.key === 'Enter' && login()} />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && login()} />
          {msg && <p style={{ color: '#f04a6a', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
          <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={login} disabled={loading}>{loading ? 'Connexion...' : 'Se connecter →'}</button>
        </div>
      </div>
    </div>
  );

  const pendingPay = payments.filter(p => p.status === 'pending');
  const lockedQRs = qrcodes.filter(q => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1));

  return (
    <div style={S.bg}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Modifier</h3>
            <p style={{ color: '#c8f04a', fontFamily: 'monospace', fontWeight: 700, marginBottom: 20 }}>{editModal.qrId} — {editModal.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              <div><label style={S.lbl}>Prix (FCFA)</label><input style={S.inp} type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} /></div>
              <div><label style={S.lbl}>Nb scans total</label><input style={S.inp} type="number" value={editScans} onChange={e => setEditScans(e.target.value)} /></div>
            </div>
            {parseInt(editScans) > (editModal.usedScans || 0) && (editModal.usedScans || 0) >= editModal.totalScans && <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#4af09a' }}>✓ QR sera reactive</div>}
            <label style={{ ...S.lbl, marginBottom: 10 }}>Fichiers ({editFiles.length})</label>
            <div style={{ background: '#0a0b12', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              {editFiles.length === 0 ? <p style={{ color: '#5a6080', fontSize: 13, textAlign: 'center' }}>Aucun fichier</p> :
                editFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < editFiles.length - 1 ? '1px solid #1c1f2e' : 'none' }}>
                    <span>🎵</span>
                    <p style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                    <button onClick={() => setEditFiles(f => f.filter((_, j) => j !== i))} style={{ ...S.btnRed, padding: '4px 8px', fontSize: 11 }}>🗑️</button>
                  </div>
                ))}
            </div>
            <div style={{ border: '2px dashed #252840', borderRadius: 10, padding: 14, textAlign: 'center', background: '#0a0b12', marginBottom: 14 }}>
              <input type="file" accept="audio/*,video/*" multiple onChange={e => setAddFiles(e.target.files)} style={{ display: 'none' }} id="editFileInput" />
              <label htmlFor="editFileInput" style={{ ...S.btn, fontSize: 12, padding: '8px 14px', cursor: 'pointer', display: 'inline-block' }}>➕ Ajouter fichiers</label>
              {addFiles && addFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ color: '#4af09a', fontSize: 12, marginBottom: 6 }}>{addFiles.length} fichier(s)</p>
                  {!editUploading && <button onClick={uploadEditFiles} style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }}>⬆ Uploader</button>}
                  {editUploading && <p style={{ color: '#8890b0', fontSize: 12 }}>{editUploadMsg}</p>}
                </div>
              )}
              {editUploadMsg && !editUploading && <p style={{ color: '#4af09a', fontSize: 12, marginTop: 8 }}>{editUploadMsg}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => setEditModal(null)}>Annuler</button>
              <button style={{ ...S.btn, flex: 2 }} onClick={saveEdit}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420, textAlign: 'center' }}>
            <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{qrModal.artist}</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>{qrModal.label}</h3>
            <p style={{ fontFamily: 'monospace', color: '#c8f04a', fontWeight: 800, fontSize: 20, marginBottom: 20, letterSpacing: 4 }}>{qrModal.qrId}</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 12 }}>
                <QRCodeCanvas id={'qr-dl-' + qrModal.id} value={qrModal.url} size={200} bgColor="#ffffff" fgColor="#07080f" level="H" />
              </div>
            </div>
            <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 20, wordBreak: 'break-all' }}>{qrModal.url}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn, flex: 2 }} onClick={() => downloadQR(qrModal)}>Telecharger QR (PNG)</button>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => setQrModal(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #f04a6a', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🗑️</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 12 }}>Supprimer ce QR code ?</h3>
            <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 24 }}>Cette action est irreversible.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button style={{ ...S.btnRed, flex: 1, padding: '10px 20px' }} onClick={async () => { await deleteDoc(doc(db, 'qrcodes', confirmDelete)); setConfirmDelete(null); setMsg('QR supprime !'); }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>◈</div>
          <div><p style={{ fontWeight: 800, fontSize: 15 }}>SecureDrop</p><p style={{ color: '#5a6080', fontSize: 10 }}>ADMIN</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingPay.length > 0 && <span style={{ ...badgeStyle('pending'), padding: '6px 12px', fontSize: 12 }}>{pendingPay.length} en attente</span>}
          <button style={S.btn2} onClick={logout}>Deconnexion</button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', background: '#0e1018' }}>
        <button style={tabStyle(tab === 'qrcodes')} onClick={() => setTab('qrcodes')}>QR Codes ({qrcodes.length})</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Paiements {pendingPay.length > 0 ? '(' + pendingPay.length + ')' : ''}</button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {msg && <div style={{ background: msg.startsWith('Erreur') ? '#2e0d14' : '#0d2e1a', border: '1px solid ' + (msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a'), borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a', fontSize: 13 }}>{msg} <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setMsg('')}>✕</span></div>}

        {tab === 'qrcodes' && (
          <>
            {lockedQRs.length > 0 && <div style={{ background: '#1a1500', border: '1px solid #3a3000', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ color: '#f0b84a', fontSize: 13 }}>🔒 {lockedQRs.length} QR bloque(s)</p>
              <button style={S.btnRed} onClick={async () => { for (const q of lockedQRs) await deleteDoc(doc(db, 'qrcodes', q.id)); setMsg(lockedQRs.length + ' supprimes !'); }}>🗑️ Supprimer les bloques</button>
            </div>}

            <div style={S.card}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Nouveau QR Code</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.lbl}>Nom du contenu *</label><input style={S.inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1" /></div>
                <div><label style={S.lbl}>Artiste *</label><input style={S.inp} value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="DJ Lamine" /></div>
                <div><label style={S.lbl}>Prix (FCFA) *</label><input style={S.inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500" /></div>
                <div><label style={S.lbl}>Nb scans *</label><input style={S.inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['album','Album'],['single','Single'],['video','Video'],['mix','Mix']].map(([t,l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + (newType === t ? '#c8f04a' : '#252840'), background: newType === t ? '#1a2a0a' : 'transparent', color: newType === t ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={S.lbl}>Fichiers</label>
              <div style={{ border: '2px dashed #252840', borderRadius: 12, padding: 18, marginBottom: 14, textAlign: 'center', background: '#0a0b12' }}>
                <input type="file" accept="audio/*,video/*" multiple onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="fileInput" />
                <input type="file" accept="audio/*,video/*" onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="folderInput" {...{ webkitdirectory: '', directory: '' } as any} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
                  <label htmlFor="fileInput" style={{ ...S.btn, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Fichiers</label>
                  <label htmlFor="folderInput" style={{ ...S.btn2, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Dossier</label>
                </div>
                {selectedFiles && selectedFiles.length > 0 ? (
                  <div><p style={{ color: '#4af09a', fontWeight: 700, marginBottom: 6 }}>{selectedFiles.length} fichier(s)</p>
                    <div style={{ maxHeight: 80, overflowY: 'auto' }}>{Array.from(selectedFiles).map((f, i) => <p key={i} style={{ color: '#8890b0', fontSize: 11, marginBottom: 1 }}>{i + 1}. {f.name} ({formatSize(f.size)})</p>)}</div>
                  </div>
                ) : <p style={{ color: '#5a6080', fontSize: 13 }}>Aucun fichier</p>}
              </div>
              {loading && uploadProgress > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8890b0', marginBottom: 5 }}><span>{uploadMsg}</span><span style={{ color: '#c8f04a' }}>{uploadProgress}%</span></div>
                  <div style={{ height: 5, background: '#1c1f2e', borderRadius: 99 }}><div style={{ height: '100%', width: uploadProgress + '%', background: '#c8f04a', borderRadius: 99, transition: 'width .3s' }} /></div>
                </div>
              )}
              <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={createQR} disabled={loading}>{loading ? (uploadMsg || 'Creation...') : 'Generer QR Code'}</button>
            </div>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

            {filteredQRs.map(q => {
              const isLocked = q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1);
              return (
                <div key={q.id} style={{ ...S.card, borderColor: isLocked ? '#3a2a00' : '#1c1f2e' }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ background: 'white', padding: 8, borderRadius: 10, flexShrink: 0, cursor: 'pointer' }} onClick={() => setQrModal(q)}>
                      <QRCodeSVG value={q.url} size={76} bgColor="#ffffff" fgColor="#07080f" />
                      <p style={{ color: '#07080f', fontSize: 9, textAlign: 'center', marginTop: 3, fontWeight: 700 }}>{q.qrId}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{q.label}</span>
                        <span style={badgeStyle(isLocked ? 'locked' : 'active')}>{isLocked ? 'Bloque' : 'Actif'}</span>
                        <span style={{ fontFamily: 'monospace', color: '#c8f04a', fontSize: 11, fontWeight: 700 }}>{q.qrId}</span>
                      </div>
                      <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 4 }}>{q.artist} · {q.type} · {(q.price || 0).toLocaleString()} FCFA</p>
                      <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 8 }}>{q.fileCount || 0} fichier(s) · {q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} DL</p>
                      <div style={{ height: 3, background: '#1c1f2e', borderRadius: 99, marginBottom: 8 }}><div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans || 0) / (q.totalScans || 1)) * 100)) + '%', background: isLocked ? '#f04a6a' : '#c8f04a', borderRadius: 99 }} /></div>
                      {q.files && q.files.length > 0 && <div style={{ background: '#0a0b12', borderRadius: 6, padding: '5px 8px' }}>{q.files.map((f: any, i: number) => <p key={i} style={{ color: '#5a6080', fontSize: 10, marginBottom: 1 }}>{i + 1}. {f.name}</p>)}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
                      <button style={{ ...S.btn, padding: '7px 12px', fontSize: 11 }} onClick={() => setQrModal(q)}>QR PNG</button>
                      <button style={{ ...S.btn2, fontSize: 11 }} onClick={() => openEdit(q)}>{isLocked ? '🔓 Reactiver' : '✏️ Modifier'}</button>
                      <button style={isLocked ? { ...S.btn2, color: '#4af09a', borderColor: '#4af09a', fontSize: 11 } : { ...S.btn2, color: '#f0b84a', borderColor: '#f0b84a', fontSize: 11 }} onClick={() => updateDoc(doc(db, 'qrcodes', q.id), { status: q.status === 'active' ? 'locked' : 'active' })}>
                        {isLocked ? '🔓 Activer' : '🔒 Bloquer'}
                      </button>
                      <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => setConfirmDelete(q.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'payments' && (
          <>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Paiements</p>
            {payments.length === 0 ? <div style={{ ...S.card, textAlign: 'center', color: '#5a6080', padding: 40 }}>Aucun paiement</div> :
              payments.map(p => (
                <div key={p.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div><p style={{ fontWeight: 700, marginBottom: 4 }}>{p.note}</p><p style={{ color: '#5a6080', fontSize: 12 }}>{p.method} · {p.phone} · {p.date}</p>{p.qrId && <p style={{ color: '#c8f04a', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>Ref: {p.qrId}</p>}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: '#c8f04a', fontWeight: 800, fontSize: 18 }}>{(p.amount || 0).toLocaleString()} FCFA</span>
                      <span style={badgeStyle(p.status)}>{p.status}</span>
                      {p.status === 'pending' && <button style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }} onClick={() => verifyPayment(p)}>Valider</button>}
                      <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => deleteDoc(doc(db, 'payments', p.id)).then(() => setMsg('Supprime !'))}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/fan/:qrId" element={<FanPage />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        <Route path="/*" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
