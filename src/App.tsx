import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { db, auth } from './firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, getDocs
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

const ADMIN_EMAIL = 'admin@securedrop.com';
const CLOUDINARY_CLOUD = 'drjp8ht84';
const CLOUDINARY_UPLOAD_PRESET = 'securedrop_unsigned';
const BASE_URL = 'https://securedrop-ci.vercel.app';

const isSafari = () => {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
};
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isChromeiOS = () => /CriOS/.test(navigator.userAgent);

const S = {
  bg: { minHeight: '100vh', background: '#07080f', color: '#e8eaf2', fontFamily: 'sans-serif' } as React.CSSProperties,
  card: { background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 16, padding: 24, marginBottom: 16 } as React.CSSProperties,
  btn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#c8f04a', color: '#07080f', fontWeight: 700, cursor: 'pointer', fontSize: 14 } as React.CSSProperties,
  btn2: { padding: '8px 16px', borderRadius: 8, border: '1px solid #1c1f2e', background: 'transparent', color: '#8890b0', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  btnRed: { padding: '8px 14px', borderRadius: 8, border: '1px solid #f04a6a', background: '#2e0d14', color: '#f04a6a', cursor: 'pointer', fontSize: 12, fontWeight: 700 } as React.CSSProperties,
  inp: { width: '100%', background: '#0a0b12', border: '1px solid #252840', borderRadius: 10, padding: '11px 14px', color: '#e8eaf2', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' } as React.CSSProperties,
  lbl: { display: 'block', color: '#8890b0', fontSize: 12, marginBottom: 6 } as React.CSSProperties,
};

const tabStyle = (a: boolean): React.CSSProperties => ({
  padding: '10px 18px', border: 'none', background: 'transparent',
  color: a ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 13,
  fontWeight: a ? 700 : 400, borderBottom: '2px solid ' + (a ? '#c8f04a' : 'transparent')
});

const badgeStyle = (s: string): React.CSSProperties => {
  const m: any = {
    active: ['#0d2e1a', '#4af09a'], locked: ['#2e1a0d', '#f0b84a'],
    pending: ['#2e1a0d', '#f0b84a'], verified: ['#0d2e1a', '#4af09a'],
    rejected: ['#2e0d14', '#f04a6a']
  };
  const [bg, c] = m[s] || ['#1c1f2e', '#8890b0'];
  return { fontSize: 11, padding: '3px 10px', borderRadius: 99, background: bg, color: c, fontWeight: 700 };
};

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const cleanName = (name: string) =>
  name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

const formatTime = (t: number) => {
  if (!t || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
};

// ─────────────────────────────────────────────
// AUDIO PLAYER
// ─────────────────────────────────────────────
function AudioPlayer({ files }: { files: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const current = files[currentIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
      if (isPlaying) audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentIndex]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const onEnded = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(i => i + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const prev = () => { if (currentIndex > 0) { setCurrentIndex(i => i - 1); setIsPlaying(true); } };
  const next = () => { if (currentIndex < files.length - 1) { setCurrentIndex(i => i + 1); setIsPlaying(true); } };

  if (!files || files.length === 0) return null;

  return (
    <div style={{ background: '#0a0b12', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <audio ref={audioRef} src={current?.url} onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata} onEnded={onEnded} preload="metadata" />

      {/* NOW PLAYING */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 99, background: 'linear-gradient(135deg, #c8f04a, #4af09a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 10px' }}>
          🎵
        </div>
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: '#e8eaf2' }}>
          {current?.name?.replace(/\.[^/.]+$/, '') || 'Piste ' + (currentIndex + 1)}
        </p>
        <p style={{ color: '#5a6080', fontSize: 12 }}>{currentIndex + 1} / {files.length}</p>
      </div>

      {/* PROGRESS */}
      <div onClick={seek} style={{ height: 6, background: '#1c1f2e', borderRadius: 99, marginBottom: 8, cursor: 'pointer' }}>
        <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #c8f04a, #4af09a)', borderRadius: 99, transition: 'width .1s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5a6080', marginBottom: 16 }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <button onClick={prev} disabled={currentIndex === 0} style={{ background: 'none', border: 'none', color: currentIndex === 0 ? '#2a2a3a' : '#8890b0', fontSize: 22, cursor: currentIndex === 0 ? 'default' : 'pointer' }}>⏮</button>
        <button onClick={togglePlay} style={{ width: 56, height: 56, borderRadius: 99, border: 'none', background: '#c8f04a', color: '#07080f', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={next} disabled={currentIndex === files.length - 1} style={{ background: 'none', border: 'none', color: currentIndex === files.length - 1 ? '#2a2a3a' : '#8890b0', fontSize: 22, cursor: currentIndex === files.length - 1 ? 'default' : 'pointer' }}>⏭</button>
      </div>

      {/* PLAYLIST */}
      {files.length > 1 && (
        <div style={{ marginTop: 16, borderTop: '1px solid #1c1f2e', paddingTop: 14 }}>
          {files.map((f, i) => (
            <div key={i} onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: i === currentIndex ? '#1a2a0a' : 'transparent', marginBottom: 4 }}>
              <span style={{ color: i === currentIndex ? '#c8f04a' : '#5a6080', fontSize: 13, fontWeight: 700, minWidth: 20 }}>
                {i === currentIndex && isPlaying ? '▶' : (i + 1)}
              </span>
              <span style={{ fontSize: 13, color: i === currentIndex ? '#c8f04a' : '#8890b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
// IPHONE DOWNLOAD COMPONENT
// ─────────────────────────────────────────────
function IPhoneDownload({ files, label, currentUrl }: { files: any[], label: string, currentUrl: string }) {
  const [showInstructions, setShowInstructions] = useState(false);

  // Try to open current page in Chrome iOS
  const openInChrome = () => {
    const chromeUrl = currentUrl.replace('https://', 'googlechrome://');
    window.location.href = chromeUrl;
    // Fallback after 2s if Chrome not installed
    setTimeout(() => {
      window.open('https://apps.apple.com/app/google-chrome/id535886823', '_blank');
    }, 2000);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* OPEN IN CHROME — Primary action */}
      <button onClick={openInChrome} style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16, marginBottom: 12, background: '#4285f4', borderRadius: 12 }}>
        🌐 Ouvrir dans Chrome pour telecharger
      </button>

      {/* ALTERNATIVE — Manual instructions */}
      <button onClick={() => setShowInstructions(!showInstructions)} style={{ ...S.btn2, width: '100%', padding: 12, fontSize: 13, textAlign: 'center' }}>
        {showInstructions ? 'Masquer les instructions' : 'Telecharger manuellement sur Safari →'}
      </button>

      {showInstructions && (
        <div style={{ background: '#0a0b12', borderRadius: 12, padding: 18, marginTop: 12 }}>
          <p style={{ color: '#f0b84a', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
            Instructions pour Safari iPhone :
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 99, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#07080f', flexShrink: 0 }}>1</div>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.6 }}>Appuyez <strong style={{ color: '#f9fafb' }}>longuement</strong> sur le lien du fichier ci-dessous</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 99, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#07080f', flexShrink: 0 }}>2</div>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.6 }}>Selectionnez <strong style={{ color: '#f9fafb' }}>"Telecharger le fichier lie"</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 99, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#07080f', flexShrink: 0 }}>3</div>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.6 }}>Le fichier sera dans vos <strong style={{ color: '#f9fafb' }}>Fichiers → Telechargements</strong></p>
          </div>

          {/* File links */}
          <div style={{ borderTop: '1px solid #1c1f2e', paddingTop: 14 }}>
            <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>APPUYEZ LONGUEMENT SUR CHAQUE FICHIER</p>
            {files.map((f, i) => (
              <a key={i} href={f.url.replace('/upload/', '/upload/fl_attachment/')} download={f.name} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 10, padding: '12px 16px', marginBottom: 10, textDecoration: 'none', color: '#e8eaf2' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🎵</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name?.replace(/\.[^/.]+$/, '') || 'Fichier ' + (i + 1)}
                  </p>
                  <p style={{ fontSize: 11, color: '#5a6080' }}>Appuyer longuement → Telecharger</p>
                </div>
                <span style={{ color: '#c8f04a', fontSize: 18, flexShrink: 0 }}>⬇</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FAN PAGE
// ─────────────────────────────────────────────
function FanPage() {
  const { qrId } = useParams<{ qrId: string }>();
  const [step, setStep] = useState<'loading' | 'ready' | 'locked' | 'zipping' | 'done'>('loading');
  const [qrData, setQrData] = useState<any>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');
  const [copied, setCopied] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const currentUrl = window.location.href;

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'qrcodes'), where('qrId', '==', qrId));
      const snap = await getDocs(q);
      if (snap.empty) { setStep('locked'); return; }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      setQrData(data);
      if (data.status === 'locked' || (data.usedScans || 0) >= (data.totalScans || 0)) {
        setStep('locked');
      } else {
        setStep('ready');
      }
    };
    load();
  }, [qrId]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const markAsDownloaded = async () => {
    if (!qrData || downloaded) return;
    setDownloaded(true);
    const newUsed = (qrData.usedScans || 0) + 1;
    await updateDoc(doc(db, 'qrcodes', qrData.id), {
      usedScans: newUsed,
      downloads: (qrData.downloads || 0) + 1,
      status: newUsed >= qrData.totalScans ? 'locked' : 'active',
    });
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
        const dlUrl = files[0].url.replace('/upload/', '/upload/fl_attachment/');
        const a = document.createElement('a');
        a.href = dlUrl; a.download = files[0].name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setDlProgress(100); setStep('done'); return;
      }
      const zip = new JSZip();
      const folder = zip.folder(qrData.label || 'SecureDrop') as JSZip;
      for (let i = 0; i < files.length; i++) {
        setDlStatus('Preparation ' + (i + 1) + '/' + files.length + ' — ' + files[i].name);
        setDlProgress(Math.round((i / files.length) * 70));
        try {
          const dlUrl = files[i].url.replace('/upload/', '/upload/fl_attachment/');
          const response = await fetch(dlUrl);
          const blob = await response.blob();
          folder.file(files[i].name, blob);
        } catch (e) { console.error(e); }
      }
      setDlStatus('Compression...');
      setDlProgress(80);
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => { setDlProgress(80 + Math.round(meta.percent * 0.2)); }
      );
      setDlProgress(100);
      const zipName = (qrData.label || 'SecureDrop').replace(/[^a-zA-Z0-9_-]/g, '_') + '.zip';
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = zipName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStep('done');
    } catch (e: any) {
      setDlStatus('Erreur: ' + (e.message || 'Echec'));
      setStep('done');
    }
  };

  const onSafari = isSafari() && isIOS() && !isChromeiOS();

  return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 8px' }}>◈</div>
        <p style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800 }}>SecureDrop</p>
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ color: '#8890b0' }}>Chargement...</p>
          </div>
        )}

        {/* READY */}
        {step === 'ready' && qrData && (
          <div style={{ animation: 'fadeUp .4s ease' }}>

            {/* HEADER + DOWNLOAD */}
            <div style={{ ...S.card, border: '1px solid #1a3a1a' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ color: '#4af09a', fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>CONTENU EXCLUSIF</p>
                <h1 style={{ fontFamily: 'serif', fontSize: 24, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>{qrData.label}</h1>
                <p style={{ color: '#8890b0', fontSize: 14 }}>par <strong style={{ color: '#e8eaf2' }}>{qrData.artist}</strong></p>
              </div>

              {/* DOWNLOAD — Priority */}
              {!downloaded ? (
                onSafari ? (
                  /* iPhone Safari — special handling */
                  <IPhoneDownload
                    files={qrData.files || []}
                    label={qrData.label}
                    currentUrl={currentUrl}
                  />
                ) : (
                  <button onClick={startDownload} style={{ ...S.btn, width: '100%', padding: 18, fontSize: 17, borderRadius: 12, marginBottom: 8 }}>
                    ⬇ {(qrData.files?.length || 0) > 1 ? 'Telecharger l album complet' : 'Telecharger'}
                  </button>
                )
              ) : (
                <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 12, padding: 14, textAlign: 'center', marginBottom: 8 }}>
                  <p style={{ color: '#4af09a', fontWeight: 700, fontSize: 14 }}>✓ Telechargement effectue</p>
                  <p style={{ color: '#5a6080', fontSize: 12, marginTop: 4 }}>Vous pouvez continuer a ecouter</p>
                </div>
              )}

              {/* Safari notice */}
              {onSafari && !downloaded && (
                <p style={{ color: '#5a6080', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  💡 Chrome est recommande pour un telechargement automatique
                </p>
              )}
            </div>

            {/* AUDIO PLAYER */}
            {qrData.files && qrData.files.length > 0 && (
              <div style={S.card}>
                <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 14, letterSpacing: 1 }}>LECTEUR AUDIO — STREAMING GRATUIT</p>
                <AudioPlayer files={qrData.files} />
              </div>
            )}
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
          <div style={{ ...S.card, border: '1px solid #3a1a1a', animation: 'fadeUp .4s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: '#2e0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔒</div>
              <p style={{ color: '#f04a6a', fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>ACCES BLOQUE</p>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, marginBottom: 4 }}>{qrData?.label || 'Contenu protege'}</h2>
              <p style={{ color: '#8890b0', fontSize: 13 }}>par {qrData?.artist || '—'}</p>
            </div>

            <div style={{ background: '#1a1000', border: '1px solid #3a2a00', borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: '#f0b84a', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                Nombre de telechargements atteint
              </p>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.8 }}>
                Contactez l artiste <strong style={{ color: '#f9fafb' }}>{qrData?.artist}</strong> avec la reference ci-dessous.
              </p>
            </div>

            <div style={{ background: '#0a0b12', borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 10, letterSpacing: 2 }}>VOTRE REFERENCE</p>
              <p style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 32, color: '#c8f04a', letterSpacing: 6, marginBottom: 14 }}>
                {qrData?.qrId || qrId}
              </p>
              <button onClick={() => copy(qrData?.qrId || qrId || '', 'qrid')} style={{ ...S.btn, padding: '10px 28px' }}>
                {copied === 'qrid' ? '✓ Copie !' : 'Copier la reference'}
              </button>
            </div>

            <div style={{ background: '#0a0b12', borderRadius: 10, padding: 16 }}>
              <p style={{ color: '#5a6080', fontSize: 10, marginBottom: 12, letterSpacing: 2 }}>ETAPES</p>
              {[
                ['1', 'Copiez la reference ' + (qrData?.qrId || qrId)],
                ['2', 'Contactez l artiste ' + (qrData?.artist || '') + ' et envoyez la reference avec votre paiement'],
                ['3', 'Apres activation, rescannez ce QR code'],
              ].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 99, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#07080f', flexShrink: 0 }}>{n}</div>
                  <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.6 }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36, animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 52, marginBottom: 16 }}>{dlStatus.startsWith('Erreur') ? '❌' : '✅'}</p>
            <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {dlStatus.startsWith('Erreur') ? 'Erreur' : 'Telechargement termine !'}
            </h2>
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              {dlStatus.startsWith('Erreur') ? dlStatus : 'Votre fichier est dans vos telechargements.'}
            </p>
            <div style={{ background: '#0a0b12', borderRadius: 8, padding: 10, fontSize: 11, color: '#5a6080' }}>
              LIEN REVOQUE — ACCES DESACTIVE
            </div>
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setView('dashboard'); }
      else { setUser(null); setView('login'); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, 'qrcodes'), orderBy('createdAt', 'desc'));
    const q2 = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setQrcodes(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(q2, s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [user]);

  const login = async () => {
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); setMsg(''); }
    catch { setMsg('Email ou mot de passe incorrect'); }
    setLoading(false);
  };

  const logout = async () => { await signOut(auth); };

  const uploadToCloudinary = async (file: File, index: number, total: number, qrId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'auto');
    const publicId = 'securedrop/' + qrId + '/' + cleanName(file.name);
    formData.append('public_id', publicId);
    setUploadMsg('Upload ' + (index + 1) + '/' + total + ' — ' + file.name);
    setUploadProgress(Math.round((index / total) * 100));
    const response = await fetch(
      'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload',
      { method: 'POST', body: formData }
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Upload failed');
    }
    const data = await response.json();
    return { name: file.name, url: data.secure_url, size: file.size, publicId: data.public_id };
  };

  const createQR = async () => {
    if (!newLabel || !newArtist || !newPrice || !newScans) { setMsg('Remplis tous les champs'); return; }
    setLoading(true); setMsg('');
    try {
      const qrId = Math.random().toString(36).slice(2, 10).toUpperCase();
      const files = selectedFiles ? Array.from(selectedFiles) : [];
      const uploadedFiles: any[] = [];
      for (let i = 0; i < files.length; i++) {
        uploadedFiles.push(await uploadToCloudinary(files[i], i, files.length, qrId));
      }
      setUploadProgress(100);
      await addDoc(collection(db, 'qrcodes'), {
        qrId, label: newLabel, artist: newArtist, type: newType,
        price: parseInt(newPrice), totalScans: parseInt(newScans),
        usedScans: 0, downloads: 0, files: uploadedFiles,
        fileCount: uploadedFiles.length, status: 'active',
        createdAt: new Date().toISOString(),
        url: BASE_URL + '/fan/' + qrId,
      });
      setNewLabel(''); setNewArtist(''); setNewPrice(''); setNewScans('');
      setSelectedFiles(null); setUploadProgress(0); setUploadMsg('');
      setMsg('QR ' + qrId + ' cree avec ' + uploadedFiles.length + ' fichier(s) !');
    } catch (e: any) {
      setMsg('Erreur: ' + (e.message || 'Verifie Cloudinary'));
    }
    setLoading(false);
  };

  const toggleQR = async (id: string, status: string) => {
    await updateDoc(doc(db, 'qrcodes', id), { status: status === 'active' ? 'locked' : 'active' });
  };

  const deleteQR = async (id: string) => {
    await deleteDoc(doc(db, 'qrcodes', id));
    setConfirmDelete(null); setMsg('QR supprime !');
  };

  const deleteAllLocked = async () => {
    const locked = qrcodes.filter(q => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1));
    for (const q of locked) await deleteDoc(doc(db, 'qrcodes', q.id));
    setMsg(locked.length + ' QR code(s) supprimes !');
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const newTotal = parseInt(editScans) || editModal.totalScans;
    const newPrice2 = parseInt(editPrice) || editModal.price;
    const isNowActive = (editModal.usedScans || 0) < newTotal;
    await updateDoc(doc(db, 'qrcodes', editModal.id), {
      price: newPrice2, totalScans: newTotal,
      status: isNowActive ? 'active' : 'locked',
    });
    setEditModal(null); setMsg('QR mis a jour !');
  };

  const verifyPayment = async (p: any) => {
    await updateDoc(doc(db, 'payments', p.id), { status: 'verified' });
    const qr = qrcodes.find(q => q.id === p.qrDocId);
    if (qr) await updateDoc(doc(db, 'qrcodes', p.qrDocId), {
      status: 'active', totalScans: (qr.totalScans || 0) + 10
    });
    setMsg('Paiement valide, QR reactive !');
  };

  const deletePayment = async (id: string) => {
    await deleteDoc(doc(db, 'payments', id)); setMsg('Paiement supprime !');
  };

  const downloadQR = (q: any) => {
    const canvas = document.getElementById('qr-dl-' + q.id) as HTMLCanvasElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = q.label + '-' + q.qrId + '.png';
    a.click();
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

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Modifier / Reactiver</h3>
            <p style={{ color: '#c8f04a', fontFamily: 'monospace', fontWeight: 700, marginBottom: 8 }}>{editModal.qrId} — {editModal.label}</p>
            <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 16 }}>
              Scans : {editModal.usedScans || 0}/{editModal.totalScans}
              {(editModal.usedScans || 0) >= editModal.totalScans && (
                <span style={{ color: '#f0b84a', marginLeft: 8 }}>— Augmentez pour reactiver</span>
              )}
            </p>
            <label style={S.lbl}>Nouveau prix (FCFA)</label>
            <input style={S.inp} type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder={'Actuel: ' + editModal.price} />
            <label style={S.lbl}>Nombre de scans total</label>
            <input style={S.inp} type="number" value={editScans} onChange={e => setEditScans(e.target.value)} placeholder={'Actuel: ' + editModal.totalScans} />
            {parseInt(editScans) > (editModal.usedScans || 0) && (
              <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#4af09a' }}>
                ✓ Ce QR sera reactive automatiquement
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => setEditModal(null)}>Annuler</button>
              <button style={{ ...S.btn, flex: 2 }} onClick={saveEdit}>Sauvegarder</button>
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
              <button style={{ ...S.btnRed, flex: 1, padding: '10px 20px' }} onClick={() => deleteQR(confirmDelete)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: '#0e1018', borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>◈</div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15 }}>SecureDrop</p>
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
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>
          Paiements {pendingPay.length > 0 ? '(' + pendingPay.length + ' en attente)' : '(' + payments.length + ')'}
        </button>
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
                <p style={{ color: '#f0b84a', fontSize: 13 }}>🔒 {lockedQRs.length} QR code(s) bloque(s)</p>
                <button style={S.btnRed} onClick={deleteAllLocked}>🗑️ Supprimer tous les bloques</button>
              </div>
            )}

            <div style={S.card}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Nouveau QR Code</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.lbl}>Nom du contenu *</label><input style={S.inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1" /></div>
                <div><label style={S.lbl}>Artiste *</label><input style={S.inp} value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="DJ Lamine" /></div>
                <div><label style={S.lbl}>Prix (FCFA) *</label><input style={S.inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500" /></div>
                <div><label style={S.lbl}>Nb scans *</label><input style={S.inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['album', 'Album'], ['single', 'Single'], ['video', 'Video'], ['mix', 'Mix']].map(([t, l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + (newType === t ? '#c8f04a' : '#252840'), background: newType === t ? '#1a2a0a' : 'transparent', color: newType === t ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={S.lbl}>Fichiers audio/video</label>
              <div style={{ border: '2px dashed #252840', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center', background: '#0a0b12' }}>
                <input type="file" accept="audio/*,video/*" multiple onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="fileInput" />
                <input type="file" accept="audio/*,video/*" onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="folderInput" {...{ webkitdirectory: '', directory: '' } as any} />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
                  <label htmlFor="fileInput" style={{ ...S.btn, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Fichiers</label>
                  <label htmlFor="folderInput" style={{ ...S.btn2, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Dossier</label>
                </div>
                {selectedFiles && selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ color: '#4af09a', fontWeight: 700, marginBottom: 8 }}>{selectedFiles.length} fichier(s)</p>
                    <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                      {Array.from(selectedFiles).map((f, i) => <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i + 1}. {f.name} ({formatSize(f.size)})</p>)}
                    </div>
                  </div>
                ) : <p style={{ color: '#5a6080', fontSize: 13 }}>Aucun fichier selectionne</p>}
              </div>
              {loading && uploadProgress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8890b0', marginBottom: 6 }}>
                    <span>{uploadMsg}</span><span style={{ color: '#c8f04a', fontWeight: 700 }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1c1f2e', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: uploadProgress + '%', background: '#c8f04a', borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                </div>
              )}
              <button style={{ ...S.btn, width: '100%', padding: 14, fontSize: 15 }} onClick={createQR} disabled={loading}>
                {loading ? (uploadMsg || 'Creation...') : 'Generer QR Code'}
              </button>
            </div>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Rechercher par nom, artiste ou reference..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

            {filteredQRs.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: '#5a6080', padding: 40 }}>
                {searchTerm ? 'Aucun resultat' : 'Aucun QR code'}
              </div>
            ) : filteredQRs.map(q => {
              const isLocked = q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1);
              return (
                <div key={q.id} style={{ ...S.card, borderColor: isLocked ? '#3a2a00' : '#1c1f2e' }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ background: 'white', padding: 10, borderRadius: 12, flexShrink: 0, cursor: 'pointer' }} onClick={() => setQrModal(q)}>
                      <QRCodeSVG value={q.url} size={80} bgColor="#ffffff" fgColor="#07080f" />
                      <p style={{ color: '#07080f', fontSize: 9, textAlign: 'center', marginTop: 4, fontWeight: 700 }}>{q.qrId}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{q.label}</span>
                        <span style={badgeStyle(isLocked ? 'locked' : 'active')}>{isLocked ? 'Bloque' : 'Actif'}</span>
                        <span style={{ fontFamily: 'monospace', color: '#c8f04a', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{q.qrId}</span>
                      </div>
                      <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 4 }}>{q.artist} · {q.type} · {(q.price || 0).toLocaleString()} FCFA</p>
                      <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 8 }}>{q.fileCount || 0} fichier(s) · {q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} DL</p>
                      <div style={{ height: 4, background: '#1c1f2e', borderRadius: 99, marginBottom: 8 }}>
                        <div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans || 0) / (q.totalScans || 1)) * 100)) + '%', background: isLocked ? '#f04a6a' : '#c8f04a', borderRadius: 99 }} />
                      </div>
                      {q.files && q.files.length > 0 && (
                        <div style={{ background: '#0a0b12', borderRadius: 6, padding: '6px 10px' }}>
                          {q.files.map((f: any, i: number) => <p key={i} style={{ color: '#5a6080', fontSize: 11, marginBottom: 1 }}>{i + 1}. {f.name}</p>)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <button style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }} onClick={() => setQrModal(q)}>QR PNG</button>
                      <button style={{ ...S.btn2, fontSize: 12 }} onClick={() => { setEditModal(q); setEditPrice(String(q.price)); setEditScans(String(q.totalScans)); }}>
                        {isLocked ? '🔓 Reactiver' : '✏️ Modifier'}
                      </button>
                      <button style={isLocked ? { ...S.btn2, color: '#4af09a', borderColor: '#4af09a', fontSize: 12 } : { ...S.btn2, color: '#f0b84a', borderColor: '#f0b84a', fontSize: 12 }} onClick={() => toggleQR(q.id, q.status)}>
                        {isLocked ? '🔓 Activer' : '🔒 Bloquer'}
                      </button>
                      <button style={{ ...S.btnRed, fontSize: 12 }} onClick={() => setConfirmDelete(q.id)}>🗑️ Supprimer</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'payments' && (
          <>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Historique des paiements</p>
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
                    <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => deletePayment(p.id)}>🗑️</button>
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
        <Route path="/*" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
