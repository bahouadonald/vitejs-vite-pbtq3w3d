import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
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
const BASE_URL = 'https://vitejs-vite-pbtq3w3d-sza3.vercel.app';

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
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
    active: ['#0d2e1a','#4af09a'], locked: ['#2e1a0d','#f0b84a'],
    pending: ['#2e1a0d','#f0b84a'], verified: ['#0d2e1a','#4af09a'],
    rejected: ['#2e0d14','#f04a6a']
  };
  const [bg, c] = m[s] || ['#1c1f2e','#8890b0'];
  return { fontSize: 11, padding: '3px 10px', borderRadius: 99, background: bg, color: c, fontWeight: 700 };
};

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// ─────────────────────────────────────────────
// FAN PAGE
// ─────────────────────────────────────────────
function FanPage() {
  const { qrId } = useParams<{ qrId: string }>();
  const [step, setStep] = useState<'loading'|'ready'|'locked'|'paying'|'paid'|'done'>('loading');
  const [qrData, setQrData] = useState<any>(null);
  const [method, setMethod] = useState('Wave');
  const [phone, setPhone] = useState('');
  const [dlProgress, setDlProgress] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'qrcodes'), where('qrId', '==', qrId));
      const snap = await getDocs(q);
      if (snap.empty) { setStep('locked'); return; }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      setQrData(data);
      if (data.status === 'locked' || data.usedScans >= data.totalScans) {
        setStep('locked');
      } else {
        setStep('ready');
      }
    };
    load();
  }, [qrId]);

  const submitPayment = async () => {
    if (!phone) { setMsg('Entre ton numero'); return; }
    setStep('paying');
    await addDoc(collection(db, 'payments'), {
      qrDocId: qrData.id,
      qrId: qrData.qrId,
      artistId: qrData.artistId || '',
      amount: qrData.price,
      method,
      phone,
      note: 'Reactivation — ' + qrData.label,
      date: new Date().toLocaleString('fr-FR'),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    setTimeout(() => {
      setMsg('Paiement envoye ! En attente de validation par SecureDrop.');
      setStep('locked');
    }, 2000);
  };

  const startDownload = async () => {
    if (!qrData || !qrData.files || qrData.files.length === 0) return;
    setStep('done');
    await updateDoc(doc(db, 'qrcodes', qrData.id), {
      usedScans: (qrData.usedScans || 0) + 1,
      downloads: (qrData.downloads || 0) + 1,
      status: (qrData.usedScans + 1) >= qrData.totalScans ? 'locked' : 'active',
    });
    let p = 0;
    const timer = setInterval(() => {
      p += Math.random() * 20;
      if (p >= 100) { p = 100; clearInterval(timer); }
      setDlProgress(Math.round(p));
    }, 150);
    for (const file of qrData.files) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.target = '_blank';
      a.click();
      await new Promise(r => setTimeout(r, 800));
    }
  };

  return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 10px' }}>◈</div>
        <p style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800 }}>SecureDrop</p>
        <p style={{ color: '#5a6080', fontSize: 11 }}>Distribution securisee</p>
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #c8f04a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ color: '#8890b0' }}>Verification en cours...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* READY */}
        {step === 'ready' && qrData && (
          <div style={{ ...S.card, border: '1px solid #1a3a1a' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: '#0d2e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>✓</div>
              <p style={{ color: '#4af09a', fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>ACCES AUTORISE</p>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, marginBottom: 4 }}>{qrData.label}</h2>
              <p style={{ color: '#8890b0', fontSize: 13 }}>par {qrData.artist}</p>
            </div>
            <div style={{ background: '#0a0b12', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#c8f04a', fontWeight: 800, fontSize: 20 }}>{qrData.totalScans - qrData.usedScans}</p>
                <p style={{ color: '#5a6080', fontSize: 10 }}>scans restants</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: 20 }}>{qrData.fileCount || 0}</p>
                <p style={{ color: '#5a6080', fontSize: 10 }}>fichier(s)</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: 20 }}>{(qrData.price || 0).toLocaleString()}</p>
                <p style={{ color: '#5a6080', fontSize: 10 }}>FCFA</p>
              </div>
            </div>
            {qrData.files && qrData.files.length > 0 && (
              <div style={{ background: '#0a0b12', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                {qrData.files.map((f: any, i: number) => (
                  <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i + 1}. {f.name}</p>
                ))}
              </div>
            )}
            <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, padding: 10, marginBottom: 16, textAlign: 'center', fontSize: 12, color: '#4af09a' }}>
              Ce lien expire apres 1 telechargement
            </div>
            <button style={{ ...S.btn, width: '100%', padding: 16, fontSize: 16 }} onClick={startDownload}>
              Telecharger maintenant
            </button>
          </div>
        )}

        {/* LOCKED */}
        {step === 'locked' && (
          <div style={{ ...S.card, border: '1px solid #3a1a1a' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: '#2e0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔒</div>
              <p style={{ color: '#f04a6a', fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>ACCES BLOQUE</p>
              <h2 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 8 }}>{qrData?.label || 'Contenu'}</h2>
              <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7 }}>
                Ce QR code a atteint son nombre maximum de scans. Effectuez un paiement pour debloquer l acces.
              </p>
            </div>
            {msg && (
              <div style={{ background: '#0d2e1a', border: '1px solid #4af09a', borderRadius: 8, padding: 12, marginBottom: 16, color: '#4af09a', fontSize: 13, textAlign: 'center' }}>
                {msg}
              </div>
            )}
            {!msg && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {['Wave', 'Orange Money'].map(m => (
                    <button key={m} onClick={() => setMethod(m)} style={{
                      flex: 1, padding: '10px', borderRadius: 10,
                      border: '1px solid ' + (method === m ? '#c8f04a' : '#252840'),
                      background: method === m ? '#1a2a0a' : 'transparent',
                      color: method === m ? '#c8f04a' : '#5a6080',
                      cursor: 'pointer', fontSize: 13
                    }}>{m === 'Wave' ? '🌊' : '🟠'} {m}</button>
                  ))}
                </div>
                <label style={S.lbl}>Ton numero {method}</label>
                <input style={S.inp} type="tel" placeholder="+221 77 000 00 00" value={phone} onChange={e => setPhone(e.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0b12', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <span style={{ color: '#8890b0', fontSize: 13 }}>Montant a payer</span>
                  <span style={{ color: '#c8f04a', fontWeight: 800, fontSize: 20 }}>{(qrData?.price || 0).toLocaleString()} FCFA</span>
                </div>
                <button style={{ ...S.btn, width: '100%', padding: 14, fontSize: 15 }} onClick={submitPayment}>
                  Payer via {method} →
                </button>
              </>
            )}
          </div>
        )}

        {/* PAYING */}
        {step === 'paying' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #f0b84a', borderTopColor: 'transparent', borderRadius: 99, margin: '0 auto 16px', animation: 'spin .8s linear infinite' }} />
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Envoi en cours...</p>
            <p style={{ color: '#8890b0', fontSize: 13 }}>Demande de paiement {method} envoyee</p>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ ...S.card, textAlign: 'center', padding: 36 }}>
            <p style={{ fontSize: 52, marginBottom: 16 }}>✅</p>
            <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Telechargement lance !</h2>
            {dlProgress < 100 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 6, background: '#1c1f2e', borderRadius: 99, marginBottom: 8 }}>
                  <div style={{ height: '100%', width: dlProgress + '%', background: '#c8f04a', borderRadius: 99, transition: 'width .15s' }} />
                </div>
                <p style={{ color: '#c8f04a', fontWeight: 800, fontSize: 24 }}>{dlProgress}%</p>
              </div>
            )}
            <p style={{ color: '#8890b0', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              Les fichiers se telechargent. Ce lien est maintenant expire.
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
  const [view, setView] = useState<'login'|'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qrcodes, setQrcodes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('qrcodes');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newLabel, setNewLabel] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newType, setNewType] = useState('album');
  const [newPrice, setNewPrice] = useState('');
  const [newScans, setNewScans] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList|null>(null);
  const [qrModal, setQrModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editScans, setEditScans] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);

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

  const uploadToCloudinary = async (file: File, index: number, total: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'auto');
    formData.append('folder', 'securedrop');
    setMsg('Upload ' + (index + 1) + '/' + total + ' — ' + file.name);
    setUploadProgress(Math.round((index / total) * 100));
    const response = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method: 'POST', body: formData });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || 'Upload failed'); }
    const data = await response.json();
    return { name: file.name, url: data.secure_url, size: file.size, publicId: data.public_id };
  };

  const createQR = async () => {
    if (!newLabel || !newArtist || !newPrice || !newScans) { setMsg('Remplis tous les champs'); return; }
    setLoading(true);
    setMsg('Preparation upload...');
    try {
      const files = selectedFiles ? Array.from(selectedFiles) : [];
      const uploadedFiles: any[] = [];
      for (let i = 0; i < files.length; i++) { uploadedFiles.push(await uploadToCloudinary(files[i], i, files.length)); }
      setUploadProgress(100);
      const qrId = Math.random().toString(36).slice(2, 10).toUpperCase();
      await addDoc(collection(db, 'qrcodes'), {
        qrId, label: newLabel, artist: newArtist, type: newType,
        price: parseInt(newPrice), totalScans: parseInt(newScans),
        usedScans: 0, downloads: 0, files: uploadedFiles,
        fileCount: uploadedFiles.length, status: 'active',
        createdAt: new Date().toISOString(),
        url: BASE_URL + '/fan/' + qrId,
      });
      setNewLabel(''); setNewArtist(''); setNewPrice(''); setNewScans('');
      setSelectedFiles(null); setUploadProgress(0);
      setMsg('QR Code cree avec ' + uploadedFiles.length + ' fichier(s) !');
    } catch (e: any) { setMsg('Erreur: ' + (e.message || 'Verifie Cloudinary')); }
    setLoading(false);
  };

  const toggleQR = async (id: string, status: string) => {
    await updateDoc(doc(db, 'qrcodes', id), { status: status === 'active' ? 'locked' : 'active' });
  };

  const deleteQR = async (id: string) => {
    await deleteDoc(doc(db, 'qrcodes', id));
    setConfirmDelete(null);
    setMsg('QR Code supprime !');
  };

  const deleteAllLocked = async () => {
    const locked = qrcodes.filter(q => q.status === 'locked');
    for (const q of locked) await deleteDoc(doc(db, 'qrcodes', q.id));
    setMsg(locked.length + ' QR code(s) supprimes !');
  };

  const saveEdit = async () => {
    if (!editModal) return;
    await updateDoc(doc(db, 'qrcodes', editModal.id), {
      price: parseInt(editPrice) || editModal.price,
      totalScans: parseInt(editScans) || editModal.totalScans,
    });
    setEditModal(null);
    setMsg('QR Code mis a jour !');
  };

  const verifyPayment = async (p: any) => {
    await updateDoc(doc(db, 'payments', p.id), { status: 'verified' });
    const qr = qrcodes.find(q => q.id === p.qrDocId);
    if (qr) await updateDoc(doc(db, 'qrcodes', p.qrDocId), { status: 'active', totalScans: (qr.totalScans || 0) + 10 });
    setMsg('Paiement valide, QR reactive !');
  };

  const deletePayment = async (id: string) => {
    await deleteDoc(doc(db, 'payments', id));
    setMsg('Paiement supprime !');
  };

  const downloadQR = (q: any) => {
    const canvas = document.getElementById('qr-dl-' + q.id) as HTMLCanvasElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = q.label + '-QR.png';
    a.click();
  };

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
  const lockedQRs = qrcodes.filter(q => q.status === 'locked');

  return (
    <div style={S.bg}>
      {/* QR MODAL */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 4 }}>{qrModal.artist}</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 24 }}>{qrModal.label}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 12 }}>
                <QRCodeCanvas id={'qr-dl-' + qrModal.id} value={qrModal.url} size={200} bgColor="#ffffff" fgColor="#07080f" level="H" />
              </div>
            </div>
            <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 20, wordBreak: 'break-all' }}>{qrModal.url}</p>
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
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 24 }}>Modifier — {editModal.label}</h3>
            <label style={S.lbl}>Nouveau prix (FCFA)</label>
            <input style={S.inp} type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder={'Actuel: ' + editModal.price} />
            <label style={S.lbl}>Nouveau nombre de scans total</label>
            <input style={S.inp} type="number" value={editScans} onChange={e => setEditScans(e.target.value)} placeholder={'Actuel: ' + editModal.totalScans} />
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
          <div><p style={{ fontWeight: 800, fontSize: 15 }}>SecureDrop</p><p style={{ color: '#5a6080', fontSize: 10 }}>ADMIN</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingPay.length > 0 && <span style={{ ...badgeStyle('pending'), padding: '6px 12px', fontSize: 12 }}>{pendingPay.length} paiement(s) en attente</span>}
          <button style={S.btn2} onClick={logout}>Deconnexion</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', background: '#0e1018' }}>
        <button style={tabStyle(tab === 'qrcodes')} onClick={() => setTab('qrcodes')}>QR Codes ({qrcodes.length})</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Paiements ({payments.length})</button>
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
                <div><label style={S.lbl}>Nom du contenu</label><input style={S.inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1" /></div>
                <div><label style={S.lbl}>Artiste</label><input style={S.inp} value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="DJ Lamine" /></div>
                <div><label style={S.lbl}>Prix (FCFA)</label><input style={S.inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500" /></div>
                <div><label style={S.lbl}>Nb scans</label><input style={S.inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['album','Album'],['single','Single'],['video','Video'],['mix','Mix']].map(([t,l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + (newType === t ? '#c8f04a' : '#252840'), background: newType === t ? '#1a2a0a' : 'transparent', color: newType === t ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={S.lbl}>Fichiers</label>
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
                      {Array.from(selectedFiles).map((f, i) => <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i+1}. {f.name} ({formatSize(f.size)})</p>)}
                    </div>
                  </div>
                ) : <p style={{ color: '#5a6080', fontSize: 13 }}>Aucun fichier</p>}
              </div>
              {loading && uploadProgress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8890b0', marginBottom: 6 }}>
                    <span>{msg}</span><span style={{ color: '#c8f04a', fontWeight: 700 }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1c1f2e', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: uploadProgress + '%', background: '#c8f04a', borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                </div>
              )}
              <button style={{ ...S.btn, width: '100%', padding: 14, fontSize: 15 }} onClick={createQR} disabled={loading}>
                {loading ? 'Creation...' : 'Generer QR Code'}
              </button>
            </div>

            {qrcodes.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: '#5a6080', padding: 40 }}>Aucun QR code</div>
            ) : qrcodes.map(q => (
              <div key={q.id} style={{ ...S.card, borderColor: q.status === 'locked' ? '#3a2a00' : '#1c1f2e' }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ background: 'white', padding: 10, borderRadius: 12, flexShrink: 0, cursor: 'pointer' }} onClick={() => setQrModal(q)}>
                    <QRCodeSVG value={q.url} size={90} bgColor="#ffffff" fgColor="#07080f" />
                    <p style={{ color: '#07080f', fontSize: 10, textAlign: 'center', marginTop: 6 }}>Cliquer pour DL</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{q.label}</span>
                      <span style={badgeStyle(q.status)}>{q.status === 'active' ? 'Actif' : 'Bloque'}</span>
                    </div>
                    <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 4 }}>{q.artist} · {q.type} · {(q.price||0).toLocaleString()} FCFA</p>
                    <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 12 }}>{q.fileCount||0} fichier(s) · {q.usedScans||0}/{q.totalScans||0} scans</p>
                    <div style={{ height: 4, background: '#1c1f2e', borderRadius: 99, marginBottom: 12 }}>
                      <div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans||0)/(q.totalScans||1))*100))+'%', background: (q.usedScans||0)>=(q.totalScans||1)?'#f04a6a':'#c8f04a', borderRadius: 99 }} />
                    </div>
                    {q.files && q.files.length > 0 && (
                      <div style={{ background: '#0a0b12', borderRadius: 8, padding: '8px 12px' }}>
                        {q.files.map((f: any, i: number) => <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i+1}. {f.name}</p>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <button style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }} onClick={() => setQrModal(q)}>QR PNG</button>
                    <button style={{ ...S.btn2, fontSize: 12 }} onClick={() => { setEditModal(q); setEditPrice(String(q.price)); setEditScans(String(q.totalScans)); }}>✏️ Modifier</button>
                    <button style={q.status==='active' ? { ...S.btn2, color:'#f0b84a', borderColor:'#f0b84a', fontSize:12 } : { ...S.btn2, color:'#4af09a', borderColor:'#4af09a', fontSize:12 }} onClick={() => toggleQR(q.id, q.status)}>
                      {q.status==='active' ? '🔒 Bloquer' : '🔓 Activer'}
                    </button>
                    <button style={{ ...S.btnRed, fontSize: 12 }} onClick={() => setConfirmDelete(q.id)}>🗑️ Supprimer</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

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
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: '#c8f04a', fontWeight: 800, fontSize: 18 }}>{(p.amount||0).toLocaleString()} FCFA</span>
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

// ─────────────────────────────────────────────
// APP ROOT WITH ROUTING
// ─────────────────────────────────────────────
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
