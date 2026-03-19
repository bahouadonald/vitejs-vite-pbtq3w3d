import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

const ADMIN_EMAIL = 'admin@securedrop.com';
const CLOUDINARY_CLOUD = 'drjp8ht84';
const CLOUDINARY_UPLOAD_PRESET = 'securedrop_unsigned';
const BASE_URL = 'https://vitejs-vite-pbtq3w3d-sza3.vercel.app';
export default function App() {
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
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMsg('');
    } catch {
      setMsg('Email ou mot de passe incorrect');
    }
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
    if (!newLabel || !newArtist || !newPrice || !newScans) {
      setMsg('Remplis tous les champs');
      return;
    }
    setLoading(true);
    setMsg('Preparation upload...');
    try {
      const files = selectedFiles ? Array.from(selectedFiles) : [];
      const uploadedFiles: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await uploadToCloudinary(files[i], i, files.length);
        uploadedFiles.push(result);
      }
      setUploadProgress(100);
      const qrId = Math.random().toString(36).slice(2, 10).toUpperCase();
      const qrUrl = BASE_URL + '/fan/' + qrId;
      await addDoc(collection(db, 'qrcodes'), {
        qrId,
        label: newLabel,
        artist: newArtist,
        type: newType,
        price: parseInt(newPrice),
        totalScans: parseInt(newScans),
        usedScans: 0,
        downloads: 0,
        files: uploadedFiles,
        fileCount: uploadedFiles.length,
        status: 'active',
        createdAt: new Date().toISOString(),
        url: qrUrl,
      });
      setNewLabel(''); setNewArtist(''); setNewPrice('');
      setNewScans(''); setSelectedFiles(null); setUploadProgress(0);
      setMsg('QR Code cree avec ' + uploadedFiles.length + ' fichier(s) !');
    } catch (e: any) {
      console.error(e);
      setMsg('Erreur: ' + (e.message || 'Verifie le upload preset Cloudinary'));
    }
    setLoading(false);
  };

  const toggleQR = async (id: string, status: string) => {
    await updateDoc(doc(db, 'qrcodes', id), { status: status === 'active' ? 'locked' : 'active' });
  };

  const verifyPayment = async (p: any) => {
    await updateDoc(doc(db, 'payments', p.id), { status: 'verified' });
    const qr = qrcodes.find(q => q.id === p.qrDocId);
    if (qr) await updateDoc(doc(db, 'qrcodes', p.qrDocId), { status: 'active', totalScans: (qr.totalScans || 0) + 10 });
    setMsg('Paiement valide, QR reactive !');
  };

  const downloadQR = (q: any) => {
    const canvas = document.getElementById('qr-' + q.id) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = q.label + '-QR.png';
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const bg: React.CSSProperties = { minHeight: '100vh', background: '#07080f', color: '#e8eaf2', fontFamily: 'sans-serif' };
  const card: React.CSSProperties = { background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 16, padding: 24, marginBottom: 16 };
  const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#c8f04a', color: '#07080f', fontWeight: 700, cursor: 'pointer', fontSize: 14 };
  const btn2: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: '1px solid #1c1f2e', background: 'transparent', color: '#8890b0', cursor: 'pointer', fontSize: 13 };
  const inp: React.CSSProperties = { width: '100%', background: '#0a0b12', border: '1px solid #252840', borderRadius: 10, padding: '11px 14px', color: '#e8eaf2', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', color: '#8890b0', fontSize: 12, marginBottom: 6 };
  const tabStyle = (a: boolean): React.CSSProperties => ({ padding: '10px 18px', border: 'none', background: 'transparent', color: a ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 13, fontWeight: a ? 700 : 400, borderBottom: '2px solid ' + (a ? '#c8f04a' : 'transparent') });
  const badge = (s: string): React.CSSProperties => {
    const m: any = { active: ['#0d2e1a','#4af09a'], locked: ['#2e1a0d','#f0b84a'], pending: ['#2e1a0d','#f0b84a'], verified: ['#0d2e1a','#4af09a'], rejected: ['#2e0d14','#f04a6a'] };
    const [bg2, c] = m[s] || ['#1c1f2e','#8890b0'];
    return { fontSize: 11, padding: '3px 10px', borderRadius: 99, background: bg2, color: c, fontWeight: 700 };
  };

  // ── LOGIN ──
  if (view === 'login') return (
    <div style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#c8f04a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>◈</div>
          <h1 style={{ fontFamily: 'serif', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>SecureDrop</h1>
          <p style={{ color: '#5a6080', fontSize: 12 }}>Plateforme de distribution securisee</p>
        </div>
        <div style={card}>
          <label style={lbl}>Email</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@securedrop.com" onKeyDown={e => e.key === 'Enter' && login()} />
          <label style={lbl}>Mot de passe</label>
          <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && login()} />
          {msg && <p style={{ color: '#f04a6a', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
          <button style={{ ...btn, width: '100%', padding: 14 }} onClick={login} disabled={loading}>{loading ? 'Connexion...' : 'Se connecter →'}</button>
        </div>
      </div>
    </div>
  );

  const pendingPay = payments.filter(p => p.status === 'pending');

  return (
    <div style={bg}>

      {/* QR MODAL */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0e1018', border: '1px solid #1c1f2e', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <p style={{ color: '#8890b0', fontSize: 12, marginBottom: 4 }}>{qrModal.artist}</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 24 }}>{qrModal.label}</h3>

            {/* QR Canvas (téléchargeable) */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 12 }}>
                <QRCodeCanvas
                  id={'qr-' + qrModal.id}
                  value={qrModal.url}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#07080f"
                  level="H"
                />
              </div>
            </div>

            <p style={{ color: '#5a6080', fontSize: 11, marginBottom: 20, wordBreak: 'break-all' }}>{qrModal.url}</p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn, flex: 2 }} onClick={() => downloadQR(qrModal)}>
                Telecharger QR (PNG)
              </button>
              <button style={{ ...btn2, flex: 1 }} onClick={() => setQrModal(null)}>Fermer</button>
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
          {pendingPay.length > 0 && <span style={{ ...badge('pending'), padding: '6px 12px', fontSize: 12 }}>{pendingPay.length} paiement(s) en attente</span>}
          <button style={btn2} onClick={logout}>Deconnexion</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: '1px solid #1c1f2e', padding: '0 24px', display: 'flex', background: '#0e1018' }}>
        <button style={tabStyle(tab === 'qrcodes')} onClick={() => setTab('qrcodes')}>QR Codes</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Paiements</button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {msg && (
          <div style={{ background: msg.startsWith('Erreur') ? '#2e0d14' : '#0d2e1a', border: '1px solid ' + (msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a'), borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: msg.startsWith('Erreur') ? '#f04a6a' : '#4af09a', fontSize: 13 }}>
            {msg}
          </div>
        )}

        {tab === 'qrcodes' && (
          <>
            {/* CREATE FORM */}
            <div style={card}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Nouveau QR Code</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Nom de l'album / contenu</label>
                  <input style={inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1 2026" />
                </div>
                <div>
                  <label style={lbl}>Nom de l'artiste</label>
                  <input style={inp} value={newArtist} onChange={e => setNewArtist(e.target.value)} placeholder="Ex: DJ Lamine" />
                </div>
                <div>
                  <label style={lbl}>Prix (FCFA)</label>
                  <input style={inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500" />
                </div>
                <div>
                  <label style={lbl}>Nombre de scans autorises</label>
                  <input style={inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['album','Album'],['single','Single'],['video','Video'],['mix','Mix']].map(([t,l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid ' + (newType === t ? '#c8f04a' : '#252840'), background: newType === t ? '#1a2a0a' : 'transparent', color: newType === t ? '#c8f04a' : '#5a6080', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={lbl}>Fichiers audio/video</label>
              <div style={{ border: '2px dashed #252840', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center', background: '#0a0b12' }}>
                <input type="file" accept="audio/*,video/*" multiple onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="fileInput" />
                <input type="file" accept="audio/*,video/*" onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="folderInput" {...{ webkitdirectory: '', directory: '' } as any} />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
                  <label htmlFor="fileInput" style={{ ...btn, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Selectionner fichiers</label>
                  <label htmlFor="folderInput" style={{ ...btn2, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Selectionner dossier</label>
                </div>
                {selectedFiles && selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ color: '#4af09a', fontWeight: 700, marginBottom: 8 }}>{selectedFiles.length} fichier(s) selectionne(s)</p>
                    <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                      {Array.from(selectedFiles).map((f, i) => (
                        <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i + 1}. {f.name} ({formatSize(f.size)})</p>
                      ))}
                    </div>
                  </div>
                ) : <p style={{ color: '#5a6080', fontSize: 13 }}>Aucun fichier selectionne</p>}
              </div>
              {loading && uploadProgress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8890b0', marginBottom: 6 }}>
                    <span>Upload en cours...</span>
                    <span style={{ color: '#c8f04a', fontWeight: 700 }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1c1f2e', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: uploadProgress + '%', background: '#c8f04a', borderRadius: 99, transition: 'width .3s ease' }} />
                  </div>
                </div>
              )}
              <button style={{ ...btn, width: '100%', padding: 14, fontSize: 15 }} onClick={createQR} disabled={loading}>
                {loading ? (msg || 'Creation...') : 'Generer QR Code'}
              </button>
            </div>

            {/* QR LIST */}
            {qrcodes.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#5a6080', padding: 40 }}>Aucun QR code — cree le premier ci-dessus</div>
            ) : qrcodes.map(q => (
              <div key={q.id} style={{ ...card, borderColor: q.status === 'locked' ? '#3a2a00' : '#1c1f2e' }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* QR Preview */}
                  <div style={{ background: 'white', padding: 10, borderRadius: 12, flexShrink: 0, cursor: 'pointer' }} onClick={() => setQrModal(q)}>
                    <QRCodeSVG value={q.url} size={90} bgColor="#ffffff" fgColor="#07080f" />
                    <p style={{ color: '#07080f', fontSize: 10, textAlign: 'center', marginTop: 6, fontWeight: 600 }}>Cliquer pour DL</p>
                  </div>
                  {/* INFO */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{q.label}</span>
                      <span style={badge(q.status)}>{q.status === 'active' ? 'Actif' : 'Bloque'}</span>
                    </div>
                    <p style={{ color: '#8890b0', fontSize: 13, marginBottom: 4 }}>{q.artist} · {q.type} · {(q.price || 0).toLocaleString()} FCFA</p>
                    <p style={{ color: '#5a6080', fontSize: 12, marginBottom: 12 }}>{q.fileCount || 0} fichier(s) · {q.usedScans || 0}/{q.totalScans || 0} scans · {q.downloads || 0} telechargements</p>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ height: 4, background: '#1c1f2e', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans || 0) / (q.totalScans || 1)) * 100)) + '%', background: (q.usedScans || 0) >= (q.totalScans || 1) ? '#f04a6a' : '#c8f04a', borderRadius: 99, transition: 'width .5s ease' }} />
                      </div>
                    </div>
                    {q.files && q.files.length > 0 && (
                      <div style={{ background: '#0a0b12', borderRadius: 8, padding: '8px 12px' }}>
                        {q.files.map((f: any, i: number) => (
                          <p key={i} style={{ color: '#8890b0', fontSize: 12, marginBottom: 2 }}>{i + 1}. {f.name} {f.size ? '(' + formatSize(f.size) + ')' : ''}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* ACTIONS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button style={{ ...btn, padding: '8px 16px', fontSize: 12 }} onClick={() => setQrModal(q)}>
                      Telecharger QR
                    </button>
                    <button style={q.status === 'active' ? { ...btn2, color: '#f04a6a', borderColor: '#f04a6a' } : { ...btn2, color: '#4af09a', borderColor: '#4af09a' }} onClick={() => toggleQR(q.id, q.status)}>
                      {q.status === 'active' ? 'Bloquer' : 'Activer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'payments' && (
          <>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, fontFamily: 'serif' }}>Historique des paiements</p>
            {payments.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#5a6080', padding: 40 }}>Aucun paiement pour l'instant</div>
            ) : payments.map(p => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.note}</p>
                    <p style={{ color: '#5a6080', fontSize: 12 }}>{p.method} · {p.phone} · {p.date}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#c8f04a', fontWeight: 800, fontSize: 18 }}>{(p.amount || 0).toLocaleString()} FCFA</span>
                    <span style={badge(p.status)}>{p.status}</span>
                    {p.status === 'pending' && (
                      <button style={{ ...btn, padding: '8px 14px', fontSize: 12 }} onClick={() => verifyPayment(p)}>Valider et Activer</button>
                    )}
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
