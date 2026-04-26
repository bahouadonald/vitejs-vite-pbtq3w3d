import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { db, auth } from './firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, getDocs
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  RecaptchaVerifier, signInWithPhoneNumber, updateProfile,
} from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

const ADMIN_EMAIL = 'admin@securedrop.com';
const CLOUDINARY_CLOUD = 'drjp8ht84';
const CLOUDINARY_UPLOAD_PRESET = 'securedrop_unsigned';
const BASE_URL = 'https://securedrop-ci.vercel.app';
const APP_NAME = 'Doniel Zik';
const APP_TAGLINE = 'Votre musique. Votre revenu. Votre heritage.';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = () => { const ua = navigator.userAgent; return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua); };
const isChromeiOS = () => /CriOS/.test(navigator.userAgent);
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const S = {
  bg: { minHeight: '100vh', background: '#07080f', color: '#e8eaf2', fontFamily: 'sans-serif' } as React.CSSProperties,
  card: { background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 16, padding: 24, marginBottom: 16 } as React.CSSProperties,
  btn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#c8f04a', color: '#07080f', fontWeight: 700, cursor: 'pointer', fontSize: 14 } as React.CSSProperties,
  btn2: { padding: '8px 16px', borderRadius: 8, border: '1px solid #1c1f2e', background: 'transparent', color: '#8890b0', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  btnRed: { padding: '8px 14px', borderRadius: 8, border: '1px solid #f04a6a', background: '#2e0d14', color: '#f04a6a', cursor: 'pointer', fontSize: 12, fontWeight: 700 } as React.CSSProperties,
  inp: { width: '100%', background: '#0a0b12', border: '1px solid #252840', borderRadius: 10, padding: '11px 14px', color: '#e8eaf2', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' } as React.CSSProperties,
  lbl: { display: 'block', color: '#8890b0', fontSize: 12, marginBottom: 6 } as React.CSSProperties,
};

const tabStyle = (a: boolean): React.CSSProperties => ({ padding: '10px 18px', border: 'none', background: 'transparent', color: a ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 13, fontWeight: a ? 700 : 400, borderBottom: '2px solid ' + (a ? '#c8f04a' : 'transparent') });
const badgeStyle = (s: string): React.CSSProperties => { const m: any = { active: ['#0d2e1a', '#4af09a'], locked: ['#2e1a0d', '#f0b84a'], pending: ['#2e1a0d', '#f0b84a'], verified: ['#0d2e1a', '#4af09a'], rejected: ['#2e0d14', '#f04a6a'] }; const [bg, c] = m[s] || ['#1c1f2e', '#8890b0']; return { fontSize: 11, padding: '3px 10px', borderRadius: 99, background: bg, color: c, fontWeight: 700 }; };
const formatSize = (bytes: number) => { if (!bytes) return ''; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };
const cleanName = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
const formatTime = (t: number) => { if (!t || isNaN(t)) return '0:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

// ─────────────────────────────────────────────
// LOGO COMPONENT
// ─────────────────────────────────────────────
function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { box: 32, font: 16, name: 13, tag: 10 }, md: { box: 44, font: 22, name: 18, tag: 11 }, lg: { box: 60, font: 30, name: 24, tag: 12 } };
  const d = sizes[size];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: d.box, height: d.box, borderRadius: d.box * 0.25, background: 'linear-gradient(135deg, #c8f04a, #4af09a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: d.font, margin: '0 auto 6px', boxShadow: '0 4px 20px rgba(200,240,74,0.3)' }}>
        🎵
      </div>
      <p style={{ fontFamily: 'serif', fontSize: d.name, fontWeight: 800, letterSpacing: .5 }}>{APP_NAME}</p>
      {size === 'lg' && <p style={{ color: '#5a6080', fontSize: d.tag, marginTop: 4, fontStyle: 'italic' }}>{APP_TAGLINE}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// AUDIO PLAYER
// ─────────────────────────────────────────────
function AudioPlayer({ files, onStream }: { files: any[], onStream?: (track: string, duration: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [ct, setCt] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  const streamStart = useRef<number>(0);
  const cur = files[idx];

  useEffect(() => {
    if (ref.current) {
      ref.current.pause();
      ref.current.load();
      if (playing) ref.current.play().catch(() => setPlaying(false));
    }
  }, [idx]);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) {
      // Enregistrer la durée écoutée à la pause
      const elapsed = Date.now() / 1000 - streamStart.current;
      if (elapsed > 2 && onStream) onStream(cur?.name || 'Piste ' + (idx + 1), elapsed);
      ref.current.pause(); setPlaying(false);
    } else {
      streamStart.current = Date.now() / 1000;
      ref.current.play().catch(() => setPlaying(false)); setPlaying(true);
    }
  };

  if (!files || files.length === 0) return null;

  return (
    <div style={{ background: '#0a0b12', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <audio ref={ref} src={cur?.url}
        onTimeUpdate={() => { if (ref.current) { setCt(ref.current.currentTime); setProgress((ref.current.currentTime / ref.current.duration) * 100 || 0); } }}
        onLoadedMetadata={() => { if (ref.current) setDur(ref.current.duration); }}
        onEnded={() => {
          // Enregistrer stream complet
          if (onStream) onStream(cur?.name || 'Piste ' + (idx + 1), ref.current?.duration || 0);
          if (idx < files.length - 1) { setIdx(i => i + 1); setPlaying(true); streamStart.current = Date.now() / 1000; }
          else { setPlaying(false); }
        }}
        preload="metadata" />

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, background: 'linear-gradient(135deg, #c8f04a, #4af09a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 8px', animation: playing ? 'spin 3s linear infinite' : 'none' }}>🎵</div>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{cur?.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (idx + 1)}</p>
        <p style={{ color: '#5a6080', fontSize: 11 }}>{idx + 1} / {files.length}</p>
      </div>

      <div onClick={(e) => { if (!ref.current) return; const r = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.clientX - r.left) / r.width) * ref.current.duration; }}
        style={{ height: 5, background: '#1c1f2e', borderRadius: 99, marginBottom: 6, cursor: 'pointer' }}>
        <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .1s' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#5a6080', marginBottom: 12 }}>
        <span>{formatTime(ct)}</span><span>{formatTime(dur)}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <button onClick={() => { if (idx > 0) { setIdx(i => i - 1); setPlaying(true); streamStart.current = Date.now() / 1000; } }} disabled={idx === 0}
          style={{ background: 'none', border: 'none', color: idx === 0 ? '#2a2a3a' : '#8890b0', fontSize: 20, cursor: idx === 0 ? 'default' : 'pointer' }}>⏮</button>
        <button onClick={toggle}
          style={{ width: 50, height: 50, borderRadius: 99, border: 'none', background: '#c8f04a', color: '#07080f', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => { if (idx < files.length - 1) { setIdx(i => i + 1); setPlaying(true); streamStart.current = Date.now() / 1000; } }} disabled={idx === files.length - 1}
          style={{ background: 'none', border: 'none', color: idx === files.length - 1 ? '#2a2a3a' : '#8890b0', fontSize: 20, cursor: idx === files.length - 1 ? 'default' : 'pointer' }}>⏭</button>
      </div>

      {files.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1c1f2e', paddingTop: 10 }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { setIdx(i); setPlaying(true); streamStart.current = Date.now() / 1000; }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: i === idx ? '#1a2a0a' : 'transparent', marginBottom: 2 }}>
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
// FAN PAGE
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// VIDEO PLAYER
// ─────────────────────────────────────────────
function VideoPlayer({ files }: { files: any[] }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  if (!files || files.length === 0) return null;
  const cur = files[idx];

  return (
    <div style={{ background: '#0a0b12', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      {/* Lecteur vidéo */}
      <video
        ref={ref}
        key={cur?.url}
        src={cur?.url}
        controls
        style={{ width: '100%', maxHeight: 280, background: '#000', display: 'block' }}
        onEnded={() => { if (idx < files.length - 1) setIdx(i => i + 1); }}
      />
      {/* Titre */}
      <div style={{ padding: '12px 16px', borderBottom: files.length > 1 ? '1px solid #1c1f2e' : 'none' }}>
        <p style={{ fontWeight: 700, fontSize: 13 }}>{cur?.name?.replace(/\.[^/.]+$/, '') || 'Clip ' + (idx + 1)}</p>
        <p style={{ color: '#5a6080', fontSize: 11, marginTop: 2 }}>{idx + 1} / {files.length}</p>
      </div>
      {/* Liste clips */}
      {files.length > 1 && (
        <div style={{ padding: '8px 0' }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { setIdx(i); setTimeout(() => ref.current?.play(), 100); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', background: i === idx ? '#0d1a3a' : 'transparent' }}>
              <span style={{ color: i === idx ? '#c8f04a' : '#5a6080', fontSize: 14 }}>{i === idx ? '▶' : '○'}</span>
              <span style={{ fontSize: 12, color: i === idx ? '#c8f04a' : '#8890b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name?.replace(/\.[^/.]+$/, '') || 'Clip ' + (i + 1)}
              </span>
              <span style={{ fontSize: 10, color: '#3a4060' }}>🎬</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FanPage() {
  const { qrId } = useParams<{ qrId: string }>();
  const [step, setStep] = useState<'loading' | 'ready' | 'locked' | 'zipping' | 'done'>('loading');
  const [qrData, setQrData] = useState<any>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');
  const [copied, setCopied] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const currentUrl = window.location.href;
  const onSafari = isSafari() && isIOS() && !isChromeiOS();

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'qrcodes'), where('qrId', '==', qrId));
      const snap = await getDocs(q);
      if (snap.empty) { setStep('locked'); return; }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      setQrData(data);
      // ── Compteur de visites ──
      try {
        await addDoc(collection(db, 'visits'), {
          qrId, artistId: data.artist || '', label: data.label || '',
          ts: new Date().toISOString(), ua: navigator.userAgent.slice(0, 80),
        });
        await updateDoc(doc(db, 'qrcodes', snap.docs[0].id), {
          visits: (data.visits || 0) + 1,
        });
      } catch (e) { console.error('visit', e); }
      if (data.status === 'locked' || (data.usedScans || 0) >= (data.totalScans || 0)) setStep('locked');
      else setStep('ready');
    };
    load();
  }, [qrId]);

  // ── Enregistrer un stream ──
  const recordStream = async (trackName: string, duration: number) => {
    if (!qrData) return;
    const valid = duration >= 30;
    try {
      await addDoc(collection(db, 'streams'), {
        qrId, artist: qrData.artist || '', label: qrData.label || '',
        track: trackName, duration: Math.round(duration),
        valid, ts: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'qrcodes', qrData.id), {
        streams: (qrData.streams || 0) + 1,
        validStreams: valid ? (qrData.validStreams || 0) + 1 : (qrData.validStreams || 0),
      });
    } catch (e) { console.error('stream', e); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000);
  };

  const markAsDownloaded = async () => {
    if (!qrData || downloaded) return;
    setDownloaded(true);
    const newUsed = (qrData.usedScans || 0) + 1;
    await updateDoc(doc(db, 'qrcodes', qrData.id), {
      usedScans: newUsed, downloads: (qrData.downloads || 0) + 1,
      status: newUsed >= qrData.totalScans ? 'locked' : 'active',
    });
    // ── Sauvegarde dans Ma Zikothèque si utilisateur connecté ──
    try {
      const { getAuth } = await import('firebase/auth');
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        await addDoc(collection(db, 'zikotheque'), {
          uid: currentUser.uid,
          qrId: qrData.qrId || qrId,
          label: qrData.label || '',
          artist: qrData.artist || '',
          type: qrData.type || 'album',
          files: qrData.files || [],
          addedAt: new Date().toISOString(),
        });
      }
    } catch (e) { console.error('ziko', e); }
  };

  const startDownload = async () => {
    if (!qrData) return;
    const files = qrData.files || [];
    if (files.length === 0) return;

    setStep('zipping');

    // Mobile — direct file download one by one
    if (isMobileDevice()) {
      for (let i = 0; i < files.length; i++) {
        setDlStatus('Telechargement ' + (i + 1) + '/' + files.length);
        setDlProgress(Math.round(((i + 1) / files.length) * 100));
        const dlUrl = files[i].url.replace('/upload/', '/upload/fl_attachment/');
        const a = document.createElement('a');
        a.href = dlUrl; a.download = files[i].name; a.target = '_blank';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 2000));
      }
      setDlProgress(100);
      await markAsDownloaded();
      setStep('done');
      return;
    }

    // Desktop — ZIP
    try {
      const zip = new JSZip();
      const folder = zip.folder(qrData.label || APP_NAME) as JSZip;
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
      URL.revokeObjectURL(url);
      await markAsDownloaded();
      setStep('done');
    } catch (e: any) {
      setDlStatus('Erreur: ' + e.message);
      setStep('done');
    }
  };

  return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div style={{ marginBottom: 24 }}><Logo size="md" /></div>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ color: '#8890b0' }}>Verification en cours...</p>
          </div>
        )}

        {/* READY */}
        {step === 'ready' && qrData && (
          <div style={{ animation: 'fadeUp .4s ease' }}>
            <div style={{ ...S.card, border: '1px solid #1a3a1a' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ display: 'inline-block', background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 8, padding: '4px 12px', marginBottom: 12 }}>
                  <p style={{ color: '#4af09a', fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>CONTENU EXCLUSIF</p>
                </div>
                <h1 style={{ fontFamily: 'serif', fontSize: 24, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>{qrData.label}</h1>
                <p style={{ color: '#8890b0', fontSize: 14 }}>par <strong style={{ color: '#e8eaf2' }}>{qrData.artist}</strong></p>
              </div>

              {/* DOWNLOAD BUTTON */}
              {step === 'ready' && !downloaded ? (
                onSafari ? (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => { const iframe = document.createElement('iframe'); iframe.style.display = 'none'; iframe.src = currentUrl.replace('https://', 'googlechromes://'); document.body.appendChild(iframe); setTimeout(() => { document.body.removeChild(iframe); window.location.href = 'https://apps.apple.com/app/google-chrome/id535886823'; }, 2500); }}
                      style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16, background: '#4285f4', borderRadius: 12, marginBottom: 8 }}>
                      🌐 Ouvrir dans Chrome pour telecharger
                    </button>
                    <p style={{ color: '#5a6080', fontSize: 11, textAlign: 'center' }}>ou appuyez longuement sur les fichiers ci-dessous</p>
                  </div>
                ) : (
                  <button onClick={startDownload} style={{ ...S.btn, width: '100%', padding: 18, fontSize: 17, borderRadius: 12, marginBottom: 12, boxShadow: '0 4px 20px rgba(200,240,74,0.25)' }}>
                    ⬇ {(qrData.files?.length || 0) > 1 ? 'Telecharger l album complet' : 'Telecharger'}
                  </button>
                )
              ) : downloaded ? (
                <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 12 }}>
                  <p style={{ color: '#4af09a', fontWeight: 700, fontSize: 13 }}>✓ Telechargement effectue</p>
                  <p style={{ color: '#5a6080', fontSize: 11, marginTop: 4 }}>Profitez du streaming illimite ci-dessous</p>
                </div>
              ) : null}

              {/* INFO BOX */}
              <div style={{ background: '#0a0b12', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <p style={{ color: '#5a6080', fontSize: 11 }}>
                  {downloaded ? '🎵 Streaming illimite disponible' : '📱 Scannez. Telechargez. Profitez.'}
                </p>
              </div>
            </div>

            {/* AUDIO PLAYER */}
            {(() => {
              const isVideo = (f: any) => /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(f.name || '');
              const audioFiles = (qrData.files || []).filter((f: any) => !isVideo(f));
              const videoFiles = (qrData.files || []).filter((f: any) => isVideo(f));
              return (
                <>
                  {audioFiles.length > 0 && (
                    <div style={S.card}>
                      <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>🎵 LECTEUR AUDIO — STREAMING GRATUIT</p>
                      <AudioPlayer files={audioFiles} onStream={recordStream} />
                      {onSafari && !downloaded && (
                        <div style={{ borderTop: '1px solid #1c1f2e', paddingTop: 12 }}>
                          <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>APPUYEZ LONGUEMENT POUR TELECHARGER</p>
                          {audioFiles.map((f: any, i: number) => (
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
                  {videoFiles.length > 0 && (
                    <div style={S.card}>
                      <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>🎬 STREAMING VIDÉO — ACHETEURS UNIQUEMENT</p>
                      <VideoPlayer files={videoFiles} />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ZIPPING */}
        {step === 'zipping' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36 }}>
            <div style={{ width: 48, height: 48, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Preparation en cours...</p>
            <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 20 }}>{dlStatus}</p>
            <div style={{ height: 8, background: '#1c1f2e', borderRadius: 99, marginBottom: 12 }}>
              <div style={{ height: '100%', width: dlProgress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .3s' }} />
            </div>
            <p style={{ color: '#c8f04a', fontWeight: 800, fontSize: 28 }}>{dlProgress}%</p>
            <p style={{ color: '#5a6080', fontSize: 11, marginTop: 12 }}>Ne fermez pas cette page</p>
          </div>
        )}

        {/* LOCKED */}
        {step === 'locked' && (
          <div style={{ animation: 'fadeUp .4s ease' }}>
            {/* HEADER */}
            <div style={{ ...S.card, border: '1px solid #1c1f2e', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: '#0a0f1e', border: '1px solid #1c1f2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔒</div>
              <p style={{ color: '#f0b84a', fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>NOMBRE DE SCANS ATTEINT</p>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, marginBottom: 4 }}>{qrData?.label || 'Contenu protege'}</h2>
              <p style={{ color: '#8890b0', fontSize: 13 }}>par <strong style={{ color: '#e8eaf2' }}>{qrData?.artist || '—'}</strong></p>
            </div>

            {/* MESSAGE STREAMING */}
            <div style={{ ...S.card, background: '#080d1a', border: '1px solid #1c2a1a', marginBottom: 12 }}>
              <p style={{ color: '#4af09a', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>🎵 STREAMING GRATUIT DISPONIBLE</p>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
                Cet album est disponible en écoute streaming gratuite ci-dessous.
              </p>
              {qrData?.files && qrData.files.length > 0 && (
                <>
                  <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>🎵 LECTEUR AUDIO</p>
                  <AudioPlayer files={qrData.files} onStream={recordStream} />
                </>
              )}
            </div>

            {/* BOUTON TELECHARGER PAYANT */}
            <div style={{ ...S.card, border: '1px solid #252840', textAlign: 'center' }}>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                Pour télécharger les fichiers sur votre téléphone, vous pouvez acquérir l'accès au même prix que la pochette physique.
              </p>
              <button
                onClick={() => alert('Paiement en ligne disponible prochainement.')}
                style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16, borderRadius: 12, marginBottom: 8, opacity: 0.85 }}>
                ⬇️ Télécharger l'album <span style={{ fontSize: 12, fontWeight: 400 }}>(Accès payant)</span>
              </button>
              <p style={{ color: '#3a4060', fontSize: 11 }}>
                Paiement en ligne — Même prix que la pochette physique
              </p>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36, animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 52, marginBottom: 16 }}>{dlStatus.startsWith('Erreur') ? '❌' : '✅'}</p>
            <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {dlStatus.startsWith('Erreur') ? 'Erreur de telechargement' : 'Telechargement lance !'}
            </h2>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
              {dlStatus.startsWith('Erreur') ? dlStatus : 'Verifiez vos telechargements. Vous pouvez continuer a ecouter en streaming.'}
            </p>
            {!dlStatus.startsWith('Erreur') && (
              <>
                <button
                  onClick={() => setStep('ready')}
                  style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16, borderRadius: 12, marginBottom: 10, boxShadow: '0 4px 20px rgba(200,240,74,0.25)' }}>
                  🎵 Écouter en streaming
                </button>
                <a href="/ziko"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 20px', borderRadius: 12, background: '#0a0f1e', border: '1px solid #1c2a4a', color: '#5ab4ff', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxSizing: 'border-box', marginBottom: 12 }}>
                  📚 Voir Ma Zikothèque
                </a>
              </>
            )}
            <div style={{ background: '#0a0b12', borderRadius: 8, padding: 10, fontSize: 11, color: '#5a6080' }}>
              {APP_NAME} — Distribution musicale securisee
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ color: '#2a2a3a', fontSize: 10 }}>{APP_NAME} · {APP_TAGLINE}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ARTIST FOLDER COMPONENT
// ─────────────────────────────────────────────
function ArtistFolder({ artist, qrcodes, activeCount, lockedCount, onEdit, onQrModal, onBulk, onToggle, onDelete }:
  { artist: string, qrcodes: any[], activeCount: number, lockedCount: number,
    onEdit: (q: any) => void, onQrModal: (q: any) => void, onBulk: (q: any) => void,
    onToggle: (q: any) => void, onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* EN-TÊTE DOSSIER ARTISTE */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: open ? '12px 12px 0 0' : 12, background: '#0e1018', border: '1px solid #252840', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{open ? '📂' : '📁'}</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{artist}</p>
            <p style={{ color: '#5a6080', fontSize: 11, marginTop: 2 }}>
              {qrcodes.length} QR code{qrcodes.length > 1 ? 's' : ''} · 
              <span style={{ color: '#4af09a' }}> {activeCount} actif{activeCount > 1 ? 's' : ''}</span>
              {lockedCount > 0 && <span style={{ color: '#f0b84a' }}> · {lockedCount} bloqué{lockedCount > 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <span style={{ color: '#5a6080', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* LISTE QR CODES DU DOSSIER */}
      {open && (
        <div style={{ border: '1px solid #252840', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {qrcodes.map((q, i) => {
            const isLocked = q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1);
            return (
              <div key={q.id} style={{ padding: '16px 18px', borderTop: i === 0 ? 'none' : '1px solid #1c1f2e', background: isLocked ? '#0d0a00' : '#080d1a' }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* QR CODE IMAGE */}
                  <div style={{ background: 'white', padding: 7, borderRadius: 8, flexShrink: 0, cursor: 'pointer' }} onClick={() => onQrModal(q)}>
                    <QRCodeSVG value={q.url} size={68} bgColor="#ffffff" fgColor="#07080f" />
                    <p style={{ color: '#07080f', fontSize: 8, textAlign: 'center', marginTop: 2, fontWeight: 700 }}>{q.qrId}</p>
                  </div>
                  {/* INFOS */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{q.label}</span>
                      <span style={badgeStyle(isLocked ? 'locked' : 'active')}>{isLocked ? 'Bloqué' : 'Actif'}</span>
                      <span style={{ fontFamily: 'monospace', color: '#c8f04a', fontSize: 11, fontWeight: 700 }}>{q.qrId}</span>
                    </div>
                    <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 4 }}>{q.type} · {(q.price || 0).toLocaleString()} FCFA</p>
                    <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 6 }}>
                      {q.fileCount || 0} fichier(s) · {q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} DL · {q.visits || 0} visites
                    </p>
                    <div style={{ height: 3, background: '#1c1f2e', borderRadius: 99, marginBottom: 4 }}>
                      <div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans || 0) / (q.totalScans || 1)) * 100)) + '%', background: isLocked ? '#f04a6a' : '#c8f04a', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {q.streams > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#1a1500', color: '#f0b84a' }}>🎵 {q.streams} streams</span>}
                      {q.validStreams > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#0d2e1a', color: '#4af09a' }}>✅ {q.validStreams} validés</span>}
                    </div>
                  </div>
                  {/* ACTIONS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button style={{ ...S.btn, padding: '6px 10px', fontSize: 11 }} onClick={() => onQrModal(q)}>QR PNG</button>
                    <button style={{ background: '#1a1a2e', border: '1px solid #4a4af0', color: '#a0a0ff', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }} onClick={() => onBulk(q)}>🖨️ Masse</button>
                    <button style={{ ...S.btn2, fontSize: 11 }} onClick={() => onEdit(q)}>{isLocked ? '🔓 Réactiver' : '✏️ Modifier'}</button>
                    <button style={isLocked ? { ...S.btn2, color: '#4af09a', borderColor: '#4af09a', fontSize: 11 } : { ...S.btn2, color: '#f0b84a', borderColor: '#f0b84a', fontSize: 11 }}
                      onClick={() => onToggle(q)}>
                      {isLocked ? '🔓 Activer' : '🔒 Bloquer'}
                    </button>
                    <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => onDelete(q.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [qrModal, setQrModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editScans, setEditScans] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editFiles, setEditFiles] = useState<any[]>([]);
  const [addFiles, setAddFiles] = useState<FileList | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadMsg, setEditUploadMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkQr, setBulkQr] = useState<any>(null);
  const [bulkCount, setBulkCount] = useState('100');
  const [bulkScans, setBulkScans] = useState('1');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  useEffect(() => { onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setView('dashboard'); } else { setUser(null); setView('login'); } }); }, []);
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db, 'qrcodes'), orderBy('createdAt', 'desc')), s => setQrcodes(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [user]);

  const login = async () => { setLoading(true); try { await signInWithEmailAndPassword(auth, email, password); setMsg(''); } catch { setMsg('Email ou mot de passe incorrect'); } setLoading(false); };
  const logout = async () => { await signOut(auth); };

  const uploadFile = async (file: File, qrId: string, i: number, total: number, setProgress: (s: string, p: number) => void) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); fd.append('resource_type', 'auto');
    fd.append('public_id', 'securedrop/' + qrId + '/' + Date.now() + '_' + cleanName(file.name));
    setProgress('Upload ' + (i + 1) + '/' + total + ' — ' + file.name, Math.round((i / total) * 100));
    const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'Failed'); }
    const d = await r.json();
    return { name: file.name, url: d.secure_url, size: file.size, publicId: d.public_id };
  };

  const createQR = async () => {
    if (!newLabel || !newArtist || !newPrice || !newScans) { setMsg('Remplis tous les champs obligatoires'); return; }
    setLoading(true); setMsg('');
    try {
      const qrId = Math.random().toString(36).slice(2, 10).toUpperCase();
      const files = selectedFiles ? Array.from(selectedFiles) : [];
      const uploaded: any[] = [];
      for (let i = 0; i < files.length; i++) uploaded.push(await uploadFile(files[i], qrId, i, files.length, (s, p) => { setUploadMsg(s); setUploadProgress(p); }));
      setUploadProgress(100);
      await addDoc(collection(db, 'qrcodes'), {
        qrId, label: newLabel, artist: newArtist, type: newType,
        price: parseInt(newPrice), totalScans: parseInt(newScans),
        usedScans: 0, downloads: 0, files: uploaded, fileCount: uploaded.length,
        status: 'active', whatsapp: newWhatsapp,
        createdAt: new Date().toISOString(), url: BASE_URL + '/fan/' + qrId,
      });
      setNewLabel(''); setNewArtist(''); setNewPrice(''); setNewScans(''); setNewWhatsapp('');
      setSelectedFiles(null); setUploadProgress(0); setUploadMsg('');
      setMsg('QR ' + qrId + ' cree avec ' + uploaded.length + ' fichier(s) !');
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  const openEdit = (q: any) => {
    setEditModal(q); setEditPrice(String(q.price)); setEditScans(String(q.totalScans));
    setEditWhatsapp(q.whatsapp || ''); setEditFiles(q.files || []); setAddFiles(null); setEditUploadMsg('');
  };

  const uploadEditFiles = async () => {
    if (!addFiles || !editModal) return;
    setEditUploading(true); const uploaded: any[] = [];
    for (let i = 0; i < addFiles.length; i++) {
      try { uploaded.push(await uploadFile(addFiles[i], editModal.qrId, i, addFiles.length, (s) => setEditUploadMsg(s))); } catch (e) { console.error(e); }
    }
    setEditFiles(f => [...f, ...uploaded]); setAddFiles(null);
    setEditUploadMsg(uploaded.length + ' fichier(s) ajoute(s) !'); setEditUploading(false);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const newTotal = parseInt(editScans) || editModal.totalScans;
    await updateDoc(doc(db, 'qrcodes', editModal.id), {
      price: parseInt(editPrice) || editModal.price, totalScans: newTotal,
      files: editFiles, fileCount: editFiles.length, whatsapp: editWhatsapp,
      status: (editModal.usedScans || 0) < newTotal ? 'active' : 'locked',
    });
    setEditModal(null); setMsg('QR mis a jour !');
  };

  const generateBulkQRs = async () => {
    if (!bulkQr || !bulkCount || !bulkScans) return;
    const count = parseInt(bulkCount); const scans = parseInt(bulkScans);
    if (count < 1 || count > 5000) { setMsg('Entre 1 et 5000 QR codes'); return; }
    setBulkLoading(true); setBulkProgress(0);
    const qrIds: string[] = [];
    for (let i = 0; i < count; i++) qrIds.push(Math.random().toString(36).slice(2, 10).toUpperCase());
    const batchSize = 20;
    for (let i = 0; i < qrIds.length; i += batchSize) {
      await Promise.all(qrIds.slice(i, i + batchSize).map(qrId =>
        addDoc(collection(db, 'qrcodes'), {
          qrId, label: bulkQr.label, artist: bulkQr.artist, type: bulkQr.type,
          price: bulkQr.price, totalScans: scans, usedScans: 0, downloads: 0,
          files: bulkQr.files || [], fileCount: bulkQr.fileCount || 0,
          status: 'active', whatsapp: bulkQr.whatsapp || '',
          createdAt: new Date().toISOString(), url: BASE_URL + '/fan/' + qrId,
          bulk: true, bulkParent: bulkQr.qrId,
        })
      ));
      setBulkProgress(Math.round(((i + batchSize) / count) * 50));
    }
    setBulkProgress(55);
    const QRCode = (await import('qrcode')).default;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 6; const rows = 5; const perPage = cols * rows; const qrSize = 27;
    const marginX = (210 - cols * qrSize) / (cols + 1);
    const marginY = (297 - rows * qrSize) / (rows + 1);
    for (let i = 0; i < qrIds.length; i++) {
      if (i > 0 && i % perPage === 0) pdf.addPage();
      const pos = i % perPage;
      const x = marginX + (pos % cols) * (qrSize + marginX);
      const y = marginY + Math.floor(pos / cols) * (qrSize + marginY);
      try {
        const dataUrl = await QRCode.toDataURL(BASE_URL + '/fan/' + qrIds[i], { width: 200, margin: 1, errorCorrectionLevel: 'H' });
        pdf.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize);
      } catch (e) { console.error(e); }
      if (i % 5 === 0) setBulkProgress(55 + Math.round((i / qrIds.length) * 40));
    }
    setBulkProgress(100);
    pdf.save(bulkQr.label.replace(/[^a-zA-Z0-9]/g, '_') + '_' + count + '_QRcodes.pdf');
    setBulkLoading(false); setShowBulk(false); setBulkQr(null);
    setMsg('✅ ' + count + ' QR codes generes ! PDF telecharge.');
  };

  const verifyPayment = async (p: any) => {
    await updateDoc(doc(db, 'payments', p.id), { status: 'verified' });
    const qr = qrcodes.find(q => q.id === p.qrDocId);
    if (qr) await updateDoc(doc(db, 'qrcodes', p.qrDocId), { status: 'active', totalScans: (qr.totalScans || 0) + 10 });
    setMsg('Paiement valide !');
  };

  const downloadQR = (q: any) => {
    const c = document.getElementById('qr-dl-' + q.id) as HTMLCanvasElement;
    if (!c) return;
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = q.label + '-' + q.qrId + '.png'; a.click();
  };

  const filteredQRs = qrcodes.filter(q =>
    q.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.artist?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.qrId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (view === 'login') return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@securedrop.com" onKeyDown={e => e.key === 'Enter' && login()} />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && login()} />
          {msg && <p style={{ color: '#f04a6a', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
          <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={login} disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter →'}
          </button>
        </div>
      </div>
    </div>
  );
 const pendingPay = payments.filter(p => p.status === 'pending');
  const lockedQRs = qrcodes.filter(q => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1));

  return (
    <div style={S.bg}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* BULK MODAL */}
      {showBulk && bulkQr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Generation en masse</h3>
            <p style={{ color: '#c8f04a', fontFamily: 'monospace', fontWeight: 700, marginBottom: 4 }}>{bulkQr.label}</p>
            <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 20 }}>par {bulkQr.artist}</p>
            <div style={{ background: '#0a0b12', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 4 }}>Chaque QR code = 1 pochette unique</p>
              <p style={{ color: '#5a6080', fontSize: 11 }}>30 QR codes par page A4 → PDF imprimable</p>
            </div>
            <label style={S.lbl}>Nombre de QR codes</label>
            <input style={S.inp} type="number" value={bulkCount} onChange={e => setBulkCount(e.target.value)} placeholder="100" min="1" max="5000" />
            <label style={S.lbl}>Scans par QR code</label>
            <input style={S.inp} type="number" value={bulkScans} onChange={e => setBulkScans(e.target.value)} placeholder="1" min="1" />
            <div style={{ background: '#1a2a0a', border: '1px solid #2a4a1a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ color: '#4af09a', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📄 {Math.ceil(parseInt(bulkCount || '0') / 30)} page(s) A4</p>
              <p style={{ color: '#8890b0', fontSize: 12 }}>{bulkCount} QR × {bulkScans} scan(s) = {parseInt(bulkCount || '0') * parseInt(bulkScans || '0')} telechargements</p>
            </div>
            {bulkLoading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8890b0', marginBottom: 6 }}>
                  <span>{bulkProgress < 55 ? 'Creation des QR codes...' : 'Generation du PDF...'}</span>
                  <span style={{ color: '#c8f04a', fontWeight: 700 }}>{bulkProgress}%</span>
                </div>
                <div style={{ height: 8, background: '#1c1f2e', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: bulkProgress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .3s' }} />
                </div>
                <p style={{ color: '#5a6080', fontSize: 11, marginTop: 8, textAlign: 'center' }}>Ne fermez pas cette page...</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => { setShowBulk(false); setBulkQr(null); }} disabled={bulkLoading}>Annuler</button>
              <button style={{ ...S.btn, flex: 2 }} onClick={generateBulkQRs} disabled={bulkLoading}>
                {bulkLoading ? 'Generation...' : '🖨️ Generer ' + bulkCount + ' QR codes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Modifier</h3>
            <p style={{ color: '#c8f04a', fontFamily: 'monospace', fontWeight: 700, marginBottom: 20 }}>{editModal.qrId} — {editModal.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.lbl}>Prix (FCFA)</label><input style={S.inp} type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} /></div>
              <div><label style={S.lbl}>Nb scans total</label><input style={S.inp} type="number" value={editScans} onChange={e => setEditScans(e.target.value)} /></div>
            </div>
            {parseInt(editScans) > (editModal.usedScans || 0) && (editModal.usedScans || 0) >= editModal.totalScans && (
              <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#4af09a' }}>✓ QR sera reactive</div>
            )}
            <label style={S.lbl}>💬 WhatsApp de l artiste</label>
            <input style={{ ...S.inp, marginBottom: 14 }} value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} placeholder="+225 07 00 00 00 00" />
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
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #c8f04a, #4af09a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎵</div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{APP_NAME}</p>
            <p style={{ color: '#5a6080', fontSize: 10 }}>ADMIN</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingPay.length > 0 && <span style={{ ...badgeStyle('pending'), padding: '6px 12px', fontSize: 12 }}>{pendingPay.length} en attente</span>}
          <button style={S.btn2} onClick={logout}>Deconnexion</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', background: '#0e1018' }}>
        <button style={tabStyle(tab === 'qrcodes')} onClick={() => setTab('qrcodes')}>QR Codes ({qrcodes.length})</button>
        <button style={tabStyle(tab === 'pochettes')} onClick={() => setTab('pochettes')}>Pochettes</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Paiements {pendingPay.length > 0 ? '(' + pendingPay.length + ')' : ''}</button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {msg && (
          <div style={{ background: msg.startsWith('Erreur') ? '#2e0d14' : '#0d2e1a', border: '1px solid ' + (msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a'), borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a', fontSize: 13 }}>
            {msg} <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setMsg('')}>✕</span>
          </div>
        )}

        {tab === 'qrcodes' && (
          <>
            {lockedQRs.length > 0 && (
              <div style={{ background: '#1a1500', border: '1px solid #3a3000', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <p style={{ color: '#f0b84a', fontSize: 13 }}>🔒 {lockedQRs.length} QR bloque(s)</p>
                <button style={S.btnRed} onClick={async () => { for (const q of lockedQRs) await deleteDoc(doc(db, 'qrcodes', q.id)); setMsg(lockedQRs.length + ' supprimes !'); }}>🗑️ Supprimer les bloques</button>
              </div>
            )}

            {/* CREATE FORM */}
            <div style={S.card}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Nouveau QR Code</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.lbl}>Nom du contenu *</label><input style={S.inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1" /></div>
                <div><label style={S.lbl}>Artiste *</label><input style={S.inp} value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="DJ Lamine" /></div>
                <div><label style={S.lbl}>Prix (FCFA) *</label><input style={S.inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500" /></div>
                <div><label style={S.lbl}>Nb scans *</label><input style={S.inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[['album','Album'],['single','Single'],['video','Video'],['mix','Mix']].map(([t,l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + (newType === t ? '#c8f04a' : '#252840'), background: newType === t ? '#1a2a0a' : 'transparent', color: newType === t ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={S.lbl}>💬 WhatsApp de l artiste</label>
              <input style={{ ...S.inp, marginBottom: 14 }} value={newWhatsapp} onChange={e => setNewWhatsapp(e.target.value)} placeholder="+225 07 00 00 00 00" />
              <label style={S.lbl}>Fichiers audio/video</label>
              <div style={{ border: '2px dashed #252840', borderRadius: 12, padding: 18, marginBottom: 14, textAlign: 'center', background: '#0a0b12' }}>
                <input type="file" accept="audio/*,video/*" multiple onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="fileInput" />
                <input type="file" accept="audio/*,video/*" onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="folderInput" {...{ webkitdirectory: '', directory: '' } as any} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
                  <label htmlFor="fileInput" style={{ ...S.btn, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Fichiers</label>
                  <label htmlFor="folderInput" style={{ ...S.btn2, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Dossier</label>
                </div>
                {selectedFiles && selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ color: '#4af09a', fontWeight: 700, marginBottom: 6 }}>{selectedFiles.length} fichier(s)</p>
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
              <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={createQR} disabled={loading}>
                {loading ? (uploadMsg || 'Creation...') : 'Generer QR Code'}
              </button>
            </div>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

            {filteredQRs.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: '#5a6080', padding: 40 }}>
                {searchTerm ? 'Aucun resultat' : 'Aucun QR code — cree le premier ci-dessus'}
              </div>
            ) : (() => {
              // Grouper par artiste
              const groups: Record<string, any[]> = {};
              filteredQRs.forEach(q => {
                const artist = q.artist || 'Sans artiste';
                if (!groups[artist]) groups[artist] = [];
                groups[artist].push(q);
              });
              return Object.entries(groups).map(([artist, qs]) => {
                const totalQrs = qs.length;
                const lockedCount = qs.filter(q => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1)).length;
                const activeCount = totalQrs - lockedCount;
                return (
                  <ArtistFolder key={artist} artist={artist} qrcodes={qs} activeCount={activeCount} lockedCount={lockedCount}
                    onEdit={openEdit} onQrModal={setQrModal} onBulk={(q: any) => { setBulkQr(q); setBulkCount('100'); setBulkScans('1'); setShowBulk(true); }}
                    onToggle={(q: any) => updateDoc(doc(db, 'qrcodes', q.id), { status: q.status === 'active' ? 'locked' : 'active' })}
                    onDelete={(id: string) => setConfirmDelete(id)} />
                );
              });
            })()}
          </>
        )}

        {tab === 'pochettes' && <PochettesTab qrcodes={qrcodes} />}

        {tab === 'payments' && (
          <>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Paiements</p>
            {payments.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: '#5a6080', padding: 40 }}>Aucun paiement</div>
            ) : payments.map(p => (
              <div key={p.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.note}</p>
                    <p style={{ color: '#5a6080', fontSize: 12 }}>{p.method} · {p.phone} · {p.date}</p>
                    {p.qrId && <p style={{ color: '#c8f04a', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>Ref: {p.qrId}</p>}
                  </div>
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
// ─────────────────────────────────────────────
// POCHETTES TAB
// ─────────────────────────────────────────────
function PochettesTab({ qrcodes }: { qrcodes: any[] }) {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string>('');
  const [selectedQr, setSelectedQr] = useState<string>('');
  const [genProgress, setGenProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  const handleTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setTemplateFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setTemplatePreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleGenerate = async () => {
    if (!templateFile) { setMsg('Veuillez uploader une image de pochette'); return; }
    const targets = selectedQr ? qrcodes.filter(q => q.qrId === selectedQr) : qrcodes.filter(q => q.status === 'active');
    if (targets.length === 0) { setMsg('Aucun QR code disponible'); return; }
    setGenerating(true); setMsg(''); setGenProgress(0);
    try {
      await generatePochettes(targets, templateFile, setGenProgress);
      setMsg('✅ ' + targets.length + ' pochette(s) générée(s) et téléchargées !');
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
    setGenerating(false);
  };

  const activeQrcodes = qrcodes.filter(q => q.status === 'active');

  return (
    <>
      <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Génération de Pochettes</p>

      <div style={S.card}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>1. Template de la pochette</p>
        <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 16 }}>Uploadez le recto de la pochette en format carré (JPG ou PNG)</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 12, border: '2px dashed #252840', cursor: 'pointer', marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>🖼️</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{templateFile ? templateFile.name : 'Choisir une image'}</p>
            <p style={{ color: '#5a6080', fontSize: 11 }}>Format carré · JPG ou PNG</p>
          </div>
          <input type="file" accept="image/*" onChange={handleTemplate} style={{ display: 'none' }} />
        </label>
        {templatePreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <img src={templatePreview} alt="preview" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 10, border: '1px solid #252840' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, width: 30, height: 30, border: '2px solid #c8f04a', borderRadius: 4, background: 'rgba(200,240,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 8, color: '#c8f04a' }}>QR</span>
            </div>
            <p style={{ color: '#5a6080', fontSize: 10, marginTop: 4 }}>Le QR code sera placé en bas à gauche</p>
          </div>
        )}
      </div>

      <div style={S.card}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>2. QR codes à générer</p>
        <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 12 }}>Laissez vide pour générer toutes les pochettes actives ({activeQrcodes.length} QR codes)</p>
        <label style={S.lbl}>Ou choisir un QR code spécifique</label>
        <select value={selectedQr} onChange={e => setSelectedQr(e.target.value)} style={{ ...S.inp, marginBottom: 0 }}>
          <option value="">— Tous les QR codes actifs —</option>
          {activeQrcodes.map(q => (
            <option key={q.id} value={q.qrId}>{q.label} · {q.artist} · {q.qrId}</option>
          ))}
        </select>
      </div>

      <div style={S.card}>
        <p style={{ fontWeight: 700, marginBottom: 16 }}>3. Générer les pochettes</p>
        {generating && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 8, background: '#1c1f2e', borderRadius: 99, marginBottom: 8 }}>
              <div style={{ height: '100%', width: genProgress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .3s' }} />
            </div>
            <p style={{ color: '#8890b0', fontSize: 12, textAlign: 'center' }}>{genProgress}% — Génération en cours...</p>
          </div>
        )}
        {msg && <p style={{ color: msg.startsWith('✅') ? '#4af09a' : '#f04a6a', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
        <button style={{ ...S.btn, width: '100%', padding: 14, fontSize: 15 }} onClick={handleGenerate} disabled={generating || !templateFile}>
          {generating ? '⏳ Génération...' : '🖨️ Générer et télécharger les pochettes'}
        </button>
        <p style={{ color: '#5a6080', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          ZIP téléchargé · QR code 15% · Position bas gauche · Texte "Scannez et Téléchargez"
        </p>
      </div>
    </>
  );
}
// ─────────────────────────────────────────────
// ARTIST PAGE
// ─────────────────────────────────────────────
function ArtistPage() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [artistName, setArtistName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({ visits: 0, streams: 0, validStreams: 0, downloads: 0, qrcodes: [] });

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setView('dashboard'); loadStats(u.email || ''); }
      else { setUser(null); setView('login'); }
    });
  }, []);

  const loadStats = async (email: string) => {
    // Trouver l'artiste lié à cet email
    const snap = await getDocs(query(collection(db, 'artists'), where('email', '==', email)));
    if (snap.empty) return;
    const artistData = snap.docs[0].data();
    const artistName = artistData.name;
    // QR codes de cet artiste
    const qrSnap = await getDocs(query(collection(db, 'qrcodes'), where('artist', '==', artistName)));
    const qrList = qrSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const totalVisits = qrList.reduce((s: number, q: any) => s + (q.visits || 0), 0);
    const totalStreams = qrList.reduce((s: number, q: any) => s + (q.streams || 0), 0);
    const totalValidStreams = qrList.reduce((s: number, q: any) => s + (q.validStreams || 0), 0);
    const totalDl = qrList.reduce((s: number, q: any) => s + (q.downloads || 0), 0);
    setStats({ visits: totalVisits, streams: totalStreams, validStreams: totalValidStreams, downloads: totalDl, qrcodes: qrList, artistName });
  };

  const register = async () => {
    if (!artistName || !email || !password) { setMsg('Remplis tous les champs'); return; }
    setLoading(true); setMsg('');
    try {
      // Vérifier que l'artiste est dans la base
      const snap = await getDocs(query(collection(db, 'qrcodes'), where('artist', '==', artistName)));
      if (snap.empty) { setMsg("Nom d'artiste non reconnu. Vous devez avoir fait une duplication chez Doniel Zik."); setLoading(false); return; }
      // Créer le compte Firebase Auth
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      await createUserWithEmailAndPassword(auth, email, password);
      // Enregistrer dans collection artists
      await addDoc(collection(db, 'artists'), { name: artistName, email, createdAt: new Date().toISOString() });
      setMsg('Compte cree !');
    } catch (e: any) { setMsg('Erreur: ' + (e.message || 'Impossible de creer le compte')); }
    setLoading(false);
  };

  const login = async () => {
    setLoading(true); setMsg('');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  const logout = async () => { await signOut(auth); };

  if (view === 'dashboard' && user) return (
    <div style={{ ...S.bg, minHeight: '100vh' }}>
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8890b0', fontSize: 13 }}>{stats.artistName || user.email}</span>
          <button style={S.btn2} onClick={logout}>Déconnexion</button>
        </div>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <h2 style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Mon tableau de bord</h2>

        {/* STATS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Visites totales', value: stats.visits, icon: '👁️', color: '#4285f4' },
            { label: 'Téléchargements', value: stats.downloads, icon: '⬇️', color: '#c8f04a' },
            { label: 'Streams totaux', value: stats.streams, icon: '🎵', color: '#f0b84a' },
            { label: 'Streams +30s', value: stats.validStreams, icon: '✅', color: '#4af09a' },
          ].map((s, i) => (
            <div key={i} style={{ ...S.card, textAlign: 'center', padding: 20 }}>
              <p style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</p>
              <p style={{ color: '#5a6080', fontSize: 11 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* QR CODES */}
        <h3 style={{ fontFamily: 'serif', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Mes pochettes ({stats.qrcodes.length})</h3>
        {stats.qrcodes.map((q: any) => (
          <div key={q.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{q.label}</p>
                <p style={{ color: '#5a6080', fontSize: 12 }}>{q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} DL · {q.streams || 0} streams</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4af09a' }}>✅ {q.validStreams || 0} validés</span>
                <span style={badgeStyle(q.status)}>{q.status}</span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Visites', val: q.visits || 0, color: '#4285f4' },
                { label: 'Streams', val: q.streams || 0, color: '#f0b84a' },
                { label: 'DL', val: q.downloads || 0, color: '#c8f04a' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#0a0b12', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                  <p style={{ color: s.color, fontWeight: 800, fontSize: 18 }}>{s.val}</p>
                  <p style={{ color: '#5a6080', fontSize: 10 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}><Logo size="lg" /></div>
        <div style={S.card}>
          <h2 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>
            {view === 'register' ? 'Créer mon compte artiste' : 'Espace artiste'}
          </h2>
          <p style={{ color: '#5a6080', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            {view === 'register' ? 'Réservé aux artistes Doniel Zik' : 'Connectez-vous à votre tableau de bord'}
          </p>
          {view === 'register' && (
            <>
              <label style={S.lbl}>Nom d'artiste (tel qu'enregistré chez nous)</label>
              <input style={S.inp} value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Ex: Élite Doniel" />
            </>
          )}
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          {msg && <p style={{ color: msg.includes('Erreur') || msg.includes('incorrect') || msg.includes('non reconnu') ? '#f04a6a' : '#4af09a', fontSize: 12, marginBottom: 10 }}>{msg}</p>}
          <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={view === 'register' ? register : login} disabled={loading}>
            {loading ? 'Chargement...' : view === 'register' ? 'Créer mon compte' : 'Se connecter'}
          </button>
          <button style={{ ...S.btn2, width: '100%', marginTop: 10, textAlign: 'center' }}
            onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMsg(''); }}>
            {view === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
// ARTIST PAGE
// ─────────────────────────────────────────────
function ArtistPage() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [artistName, setArtistName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({ visits: 0, streams: 0, validStreams: 0, downloads: 0, qrcodes: [] });

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setView('dashboard'); loadStats(u.email || ''); }
      else { setUser(null); setView('login'); }
    });
  }, []);

  const loadStats = async (email: string) => {
    // Trouver l'artiste lié à cet email
    const snap = await getDocs(query(collection(db, 'artists'), where('email', '==', email)));
    if (snap.empty) return;
    const artistData = snap.docs[0].data();
    const artistName = artistData.name;
    // QR codes de cet artiste
    const qrSnap = await getDocs(query(collection(db, 'qrcodes'), where('artist', '==', artistName)));
    const qrList = qrSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const totalVisits = qrList.reduce((s: number, q: any) => s + (q.visits || 0), 0);
    const totalStreams = qrList.reduce((s: number, q: any) => s + (q.streams || 0), 0);
    const totalValidStreams = qrList.reduce((s: number, q: any) => s + (q.validStreams || 0), 0);
    const totalDl = qrList.reduce((s: number, q: any) => s + (q.downloads || 0), 0);
    setStats({ visits: totalVisits, streams: totalStreams, validStreams: totalValidStreams, downloads: totalDl, qrcodes: qrList, artistName });
  };

  const register = async () => {
    if (!artistName || !email || !password) { setMsg('Remplis tous les champs'); return; }
    setLoading(true); setMsg('');
    try {
      // Vérifier que l'artiste est dans la base
      const snap = await getDocs(query(collection(db, 'qrcodes'), where('artist', '==', artistName)));
      if (snap.empty) { setMsg("Nom d'artiste non reconnu. Vous devez avoir fait une duplication chez Doniel Zik."); setLoading(false); return; }
      // Créer le compte Firebase Auth
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      await createUserWithEmailAndPassword(auth, email, password);
      // Enregistrer dans collection artists
      await addDoc(collection(db, 'artists'), { name: artistName, email, createdAt: new Date().toISOString() });
      setMsg('Compte cree !');
    } catch (e: any) { setMsg('Erreur: ' + (e.message || 'Impossible de creer le compte')); }
    setLoading(false);
  };

  const login = async () => {
    setLoading(true); setMsg('');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  const logout = async () => { await signOut(auth); };

  if (view === 'dashboard' && user) return (
    <div style={{ ...S.bg, minHeight: '100vh' }}>
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8890b0', fontSize: 13 }}>{stats.artistName || user.email}</span>
          <button style={S.btn2} onClick={logout}>Déconnexion</button>
        </div>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <h2 style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Mon tableau de bord</h2>

        {/* STATS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Visites totales', value: stats.visits, icon: '👁️', color: '#4285f4' },
            { label: 'Téléchargements', value: stats.downloads, icon: '⬇️', color: '#c8f04a' },
            { label: 'Streams totaux', value: stats.streams, icon: '🎵', color: '#f0b84a' },
            { label: 'Streams +30s', value: stats.validStreams, icon: '✅', color: '#4af09a' },
          ].map((s, i) => (
            <div key={i} style={{ ...S.card, textAlign: 'center', padding: 20 }}>
              <p style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</p>
              <p style={{ color: '#5a6080', fontSize: 11 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* QR CODES */}
        <h3 style={{ fontFamily: 'serif', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Mes pochettes ({stats.qrcodes.length})</h3>
        {stats.qrcodes.map((q: any) => (
          <div key={q.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{q.label}</p>
                <p style={{ color: '#5a6080', fontSize: 12 }}>{q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} DL · {q.streams || 0} streams</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4af09a' }}>✅ {q.validStreams || 0} validés</span>
                <span style={badgeStyle(q.status)}>{q.status}</span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Visites', val: q.visits || 0, color: '#4285f4' },
                { label: 'Streams', val: q.streams || 0, color: '#f0b84a' },
                { label: 'DL', val: q.downloads || 0, color: '#c8f04a' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#0a0b12', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                  <p style={{ color: s.color, fontWeight: 800, fontSize: 18 }}>{s.val}</p>
                  <p style={{ color: '#5a6080', fontSize: 10 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}><Logo size="lg" /></div>
        <div style={S.card}>
          <h2 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>
            {view === 'register' ? 'Créer mon compte artiste' : 'Espace artiste'}
          </h2>
          <p style={{ color: '#5a6080', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            {view === 'register' ? 'Réservé aux artistes Doniel Zik' : 'Connectez-vous à votre tableau de bord'}
          </p>
          {view === 'register' && (
            <>
              <label style={S.lbl}>Nom d'artiste (tel qu'enregistré chez nous)</label>
              <input style={S.inp} value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Ex: Élite Doniel" />
            </>
          )}
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          {msg && <p style={{ color: msg.includes('Erreur') || msg.includes('incorrect') || msg.includes('non reconnu') ? '#f04a6a' : '#4af09a', fontSize: 12, marginBottom: 10 }}>{msg}</p>}
          <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={view === 'register' ? register : login} disabled={loading}>
            {loading ? 'Chargement...' : view === 'register' ? 'Créer mon compte' : 'Se connecter'}
          </button>
          <button style={{ ...S.btn2, width: '100%', marginTop: 10, textAlign: 'center' }}
            onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMsg(''); }}>
            {view === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const QR_SIZE = Math.round(SIZE * 0.15); // 15% de la largeur
  const QR_X = Math.round(SIZE * 0.03); // bas gauche
  const QR_Y = SIZE - QR_SIZE - Math.round(SIZE * 0.03);

  const zip = (await import('jszip')).default ? new ((await import('jszip')).default)() : new JSZip();
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
    ctx.fillText('Scannez et', QR_X + QR_SIZE + 8, QR_Y + QR_SIZE * 0.4);
    ctx.fillStyle = '#1e6fff';
    ctx.fillText('Téléchargez', QR_X + QR_SIZE + 8, QR_Y + QR_SIZE * 0.65);
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
function UserAuthPage() {
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
  const [user, setUser] = useState<any>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onAuthStateChanged(auth, u => { setUser(u); });
  }, []);

  // ── Google ──
  const loginGoogle = async () => {
    setLoading(true); setMsg('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) { setMsg('Erreur Google: ' + e.message); }
    setLoading(false);
  };

  // ── Téléphone ──
  const sendSMS = async () => {
    if (!phone) { setMsg('Entrez votre numéro'); return; }
    setLoading(true); setMsg('');
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current!, { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
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

  // ── Dashboard si connecté ──
  if (user) return <ZikothequePage user={user} />;

  return (
    <div style={{ ...S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}><Logo size="lg" /></div>

        <div style={S.card}>
          {mode === 'choose' && (
            <>
              <h2 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>Ma Zikothèque</h2>
              <p style={{ color: '#5a6080', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>Connectez-vous pour accéder à votre bibliothèque musicale</p>

              {/* Google */}
              <button onClick={loginGoogle} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '14px 20px', borderRadius: 12, border: '1px solid #252840', background: '#0e1018', color: '#e8eaf2', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </button>

              {/* Téléphone */}
              <button onClick={() => setMode('phone')} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '14px 20px', borderRadius: 12, border: '1px solid #252840', background: '#0e1018', color: '#e8eaf2', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
                📱 Continuer avec le téléphone
              </button>

              {/* Email */}
              <button onClick={() => setMode('email')} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '14px 20px', borderRadius: 12, border: '1px solid #252840', background: '#0e1018', color: '#e8eaf2', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
                ✉️ Continuer avec l'email
              </button>

              <p style={{ color: '#3a4060', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Votre compte vous permet d'accéder à Ma Zikothèque — votre bibliothèque musicale personnelle
              </p>
            </>
          )}

          {mode === 'phone' && (
            <>
              <button onClick={() => { setMode('choose'); setMsg(''); setStep('input'); }} style={{ background: 'none', border: 'none', color: '#5a6080', cursor: 'pointer', marginBottom: 12, fontSize: 13 }}>← Retour</button>
              <h2 style={{ fontFamily: 'serif', fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Connexion par téléphone</h2>
              {step === 'input' ? (
                <>
                  <label style={S.lbl}>Numéro de téléphone</label>
                  <input style={S.inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" type="tel" />
                  <div ref={recaptchaRef} />
                  {msg && <p style={{ color: msg.includes('envoyé') ? '#4af09a' : '#f04a6a', fontSize: 12, marginBottom: 8 }}>{msg}</p>}
                  <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={sendSMS} disabled={loading}>
                    {loading ? 'Envoi...' : 'Envoyer le code SMS'}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ color: '#4af09a', fontSize: 13, marginBottom: 12 }}>✅ Code envoyé au {phone}</p>
                  <label style={S.lbl}>Code reçu par SMS</label>
                  <input style={S.inp} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" type="number" maxLength={6} />
                  {msg && <p style={{ color: '#f04a6a', fontSize: 12, marginBottom: 8 }}>{msg}</p>}
                  <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={verifyCode} disabled={loading}>
                    {loading ? 'Vérification...' : 'Confirmer'}
                  </button>
                </>
              )}
            </>
          )}

          {(mode === 'email' || mode === 'register') && (
            <>
              <button onClick={() => { setMode('choose'); setMsg(''); }} style={{ background: 'none', border: 'none', color: '#5a6080', cursor: 'pointer', marginBottom: 12, fontSize: 13 }}>← Retour</button>
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
              {msg && <p style={{ color: '#f04a6a', fontSize: 12, marginBottom: 8 }}>{msg}</p>}
              <button style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10 }}
                onClick={mode === 'register' ? registerEmail : loginEmail} disabled={loading}>
                {loading ? 'Chargement...' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
              </button>
              <button style={{ ...S.btn2, width: '100%', textAlign: 'center' }}
                onClick={() => { setMode(mode === 'email' ? 'register' : 'email'); setMsg(''); }}>
                {mode === 'email' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
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
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'zikotheque'), where('uid', '==', user.uid), orderBy('addedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const logout = async () => { await signOut(auth); };

  return (
    <div style={{ ...S.bg, minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#8890b0', fontSize: 12 }}>{user.displayName || user.phoneNumber || user.email}</span>
          <button style={S.btn2} onClick={logout}>Déconnexion</button>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🎵 Ma Zikothèque</h2>
          <p style={{ color: '#5a6080', fontSize: 13 }}>{items.length} album{items.length > 1 ? 's' : ''} · Streaming gratuit</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 12px', animation: 'spin .8s linear infinite' }} />
            <p style={{ color: '#5a6080' }}>Chargement...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🎵</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 18, marginBottom: 8 }}>Votre Zikothèque est vide</h3>
            <p style={{ color: '#5a6080', fontSize: 13, lineHeight: 1.7 }}>
              Scannez une pochette musicale et téléchargez un album pour qu'il apparaisse ici automatiquement.
            </p>
          </div>
        ) : items.map(item => (
          <div key={item.id} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{item.label}</p>
                <p style={{ color: '#8890b0', fontSize: 12 }}>par {item.artist} · {item.type}</p>
                <p style={{ color: '#3a4060', fontSize: 11, marginTop: 2 }}>{item.files?.length || 0} titre{(item.files?.length || 0) > 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: '#0d2e1a', color: '#4af09a', fontWeight: 700 }}>🎵 Streaming gratuit</span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: '#1c1f2e', color: '#5a6080' }}>
                  🔒 Téléchargement Premium
                </span>
              </div>
            </div>

            {/* Lecteur audio */}
            {item.files && item.files.length > 0 && (
              playing?.id === item.id ? (
                <>
                  <button onClick={() => setPlaying(null)} style={{ ...S.btn2, fontSize: 11, marginBottom: 10 }}>▼ Fermer le lecteur</button>
                  <AudioPlayer files={item.files} />
                </>
              ) : (
                <button onClick={() => setPlaying(item)} style={{ ...S.btn, width: '100%', padding: 12, fontSize: 14 }}>
                  ▶ Écouter — {item.label}
                </button>
              )
            )}
          </div>
        ))}

        {/* Info Premium */}
        {items.length > 0 && (
          <div style={{ background: '#0a0f1e', border: '1px solid #1c2a4a', borderRadius: 12, padding: 16, textAlign: 'center', marginTop: 8 }}>
            <p style={{ color: '#5a6080', fontSize: 12, lineHeight: 1.7 }}>
              🔒 Le téléchargement depuis Ma Zikothèque sera disponible avec l'abonnement <strong style={{ color: '#c8f04a' }}>Premium</strong> — bientôt disponible.
            </p>
          </div>
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
        <Route path="/ziko" element={<UserAuthPage />} />
        <Route path="/ziko/login" element={<UserAuthPage />} />
        <Route path="/artiste" element={<ArtistPage />} />
        <Route path="/artiste/login" element={<ArtistPage />} />
        <Route path="/*" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
