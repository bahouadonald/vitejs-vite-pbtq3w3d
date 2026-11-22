// ─────────────────────────────────────────────
// STUDIO VOCAL — l'artiste enregistre ses voix (lead, chœurs, doublages,
// cris...), a cappella ou sur son propre beat. L'équipe Doniel Zik produit la
// musique autour de sa voix, dépose un extrait sous 48 h, l'artiste valide et
// paie, puis reçoit son titre mixé et masterisé.
//
//   StudioVocalArtiste — onglet « Studio vocal » du tableau de bord artiste
//   StudioVocalAdmin   — onglet « Studio vocal » du panneau admin
//
// Collections Firestore :
//   studio_projets/{id}   — un projet = un titre
//   studio_credits/{uid}  — titres restants d'un pack (écrit côté serveur)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy, where,
} from 'firebase/firestore';
import {
  C, S, ADMIN_EMAIL, envoyerNotification, envoyerEmailNotif,
  CLOUDINARY_CLOUD, CLOUDINARY_UPLOAD_PRESET,
} from '../lib/utils';

// ── Tarifs (le montant réellement facturé est recalculé côté serveur) ──
export const STUDIO_FORMULES = {
  titre:  { label: '1 titre',            titres: 1,  fcfa: 12000, usd: 20 },
  pack8:  { label: 'Pack 8 titres',      titres: 8,  fcfa: 60000, usd: 100 },
  pack12: { label: 'Pack 8 à 12 titres', titres: 12, fcfa: 90000, usd: 150 },
} as const;
export type FormuleStudio = keyof typeof STUDIO_FORMULES;

export const TYPES_PISTE: { id: string, label: string }[] = [
  { id: 'lead',     label: 'Voix lead' },
  { id: 'choeur',   label: 'Chœurs' },
  { id: 'doublage', label: 'Doublage' },
  { id: 'cri',      label: 'Cris / ad-libs' },
  { id: 'autre',    label: 'Autre' },
];
const labelPiste = (t: string) => TYPES_PISTE.find(x => x.id === t)?.label || t;

export const STATUTS_STUDIO: Record<string, { label: string, couleur: string }> = {
  envoye:        { label: 'Reçu par le studio',   couleur: '#5BB0FF' },
  en_production: { label: 'En production',        couleur: '#F5C84C' },
  extrait_dispo: { label: 'Extrait disponible',   couleur: '#00D49A' },
  paye:          { label: 'Payé — finalisation',  couleur: '#b388ff' },
  livre:         { label: 'Titre livré',          couleur: '#00D49A' },
  annule:        { label: 'Annulé',               couleur: '#FF647C' },
};

const fcfa = (n: number) => n.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA';
const duree = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dateCourte = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// Envoie un fichier audio sur Cloudinary (même compte que le reste du site)
async function envoyerAudio(fichier: Blob, nom: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', fichier, nom);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: fd });
  const d = await r.json();
  if (!d.secure_url) throw new Error(d?.error?.message || 'Échec de l\'envoi du fichier');
  return d.secure_url;
}

// Choisit le format d'enregistrement que le navigateur sait produire
// (webm/opus sur Android et ordinateur, mp4/aac sur iPhone)
function formatEnregistrement(): { mime: string, ext: string } {
  const candidats = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/aac', ext: 'aac' },
  ];
  const MR: any = (window as any).MediaRecorder;
  for (const c of candidats) if (MR?.isTypeSupported?.(c.mime)) return c;
  return { mime: '', ext: 'webm' };
}

// ── Styles « 3D » (relief, brillance, profondeur) ──
const carte3D: CSSProperties = {
  background: `linear-gradient(160deg, ${C.cardHi} 0%, ${C.card} 55%, ${C.bgSecond} 100%)`,
  border: '1px solid rgba(150,185,235,0.25)', borderRadius: 18, padding: 18, marginBottom: 16,
  boxShadow: '0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
};
const bouton3D = (couleur = C.blue, fonce = '#0050d0'): CSSProperties => ({
  padding: '12px 18px', borderRadius: 14, border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 14,
  background: `linear-gradient(180deg, ${couleur} 0%, ${fonce} 100%)`,
  boxShadow: `0 6px 0 ${fonce}, 0 10px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
});
const boutonDiscret: CSSProperties = {
  padding: '9px 14px', borderRadius: 12, border: '1px solid ' + C.border, background: 'rgba(255,255,255,0.05)',
  color: C.textSoft, fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const champ: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, marginBottom: 12,
  border: '1px solid ' + C.border, background: 'rgba(8,20,45,0.55)', color: C.text, fontSize: 14, outline: 'none',
  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)',
};
const etiquette: CSSProperties = { display: 'block', color: C.textSoft, fontSize: 12, fontWeight: 700, marginBottom: 6 };

type Prise = { id: string, type: string, blob: Blob, url: string, ext: string, secondes: number, importe?: boolean, nomFichier?: string };

// ═════════════════════════════════════════════
// CÔTÉ ARTISTE
// ═════════════════════════════════════════════
export function StudioVocalArtiste({ user, artistName }: { user: any, artistName: string }) {
  const [projets, setProjets] = useState<any[]>([]);
  const [credits, setCredits] = useState(0);
  const [creation, setCreation] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const u1 = onSnapshot(query(collection(db, 'studio_projets'), where('uid', '==', user.uid)), snap => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      liste.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setProjets(liste);
    }, () => {});
    const u2 = onSnapshot(doc(db, 'studio_credits', user.uid), d => setCredits(d.exists() ? (d.data().credits || 0) : 0), () => {});
    return () => { u1(); u2(); };
  }, [user?.uid]);

  // Retour de la page de paiement GeniusPay
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('paiement');
    if (p === 'succes') setInfo('Paiement reçu ! Ton titre passe en finalisation (mixage et mastering). Tu seras notifié dès qu\'il est prêt.');
    if (p === 'echec') setInfo('Le paiement n\'a pas abouti. Tu peux réessayer depuis ton projet.');
  }, []);

  if (creation) return <NouveauProjet user={user} artistName={artistName} onFini={(m) => { setCreation(false); setInfo(m); }} onAnnuler={() => setCreation(false)} />;

  return (
    <div>
      {/* EN-TÊTE */}
      <div style={{ ...carte3D, background: 'linear-gradient(150deg,#2a5db0 0%,#1A4179 45%,#3a1f8a 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }} />
        <p style={{ margin: 0, color: '#cfe2ff', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Studio vocal</p>
        <h2 style={{ margin: '6px 0 8px', color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>Ta voix, notre production</h2>
        <p style={{ margin: '0 0 14px', color: '#dbe8ff', fontSize: 13, lineHeight: 1.6 }}>
          Enregistre ta voix (lead, chœurs, doublages, cris) a cappella ou sur ton beat. Nous construisons la musique autour de ta voix,
          tu reçois un extrait sous 48 h, et tu paies seulement si ça te plaît.
        </p>
        <button style={bouton3D('#00D49A', '#009a70')} onClick={() => { setInfo(''); setCreation(true); }}>+ Nouveau projet</button>
      </div>

      {info && (
        <div style={{ ...carte3D, padding: 14, borderColor: 'rgba(0,212,154,0.45)', color: '#bff5e3', fontSize: 13, lineHeight: 1.6 }}>
          {info} <span style={{ float: 'right', cursor: 'pointer' }} onClick={() => setInfo('')}>✕</span>
        </div>
      )}

      {/* TARIFS */}
      <div style={carte3D}>
        <p style={{ margin: '0 0 10px', color: C.text, fontWeight: 800, fontSize: 15 }}>Tarifs</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {(Object.keys(STUDIO_FORMULES) as FormuleStudio[]).map(k => (
            <div key={k} style={{ borderRadius: 14, padding: 12, background: 'rgba(8,20,45,0.45)', border: '1px solid ' + C.border, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <p style={{ margin: 0, color: C.textSoft, fontSize: 12, fontWeight: 700 }}>{STUDIO_FORMULES[k].label}</p>
              <p style={{ margin: '4px 0 0', color: C.gold, fontSize: 17, fontWeight: 900 }}>{fcfa(STUDIO_FORMULES[k].fcfa)}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', color: C.textSoft, fontSize: 12, lineHeight: 1.6 }}>
          Arrangement complet, mixage et mastering inclus. La musique est produite par notre équipe avec des outils d'intelligence artificielle, autour de ta vraie voix.
        </p>
        {credits > 0 && (
          <p style={{ margin: '10px 0 0', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>
            Il te reste {credits} titre{credits > 1 ? 's' : ''} dans ton pack.
          </p>
        )}
      </div>

      {/* MES PROJETS */}
      <p style={{ color: C.text, fontWeight: 800, fontSize: 16, margin: '22px 0 10px' }}>Mes projets ({projets.length})</p>
      {projets.length === 0 && (
        <div style={{ ...carte3D, textAlign: 'center', color: C.textSoft, fontSize: 13 }}>
          Aucun projet pour l'instant. Appuie sur « Nouveau projet » pour enregistrer ta première voix.
        </div>
      )}
      {projets.map(p => <CarteProjetArtiste key={p.id} p={p} credits={credits} />)}
    </div>
  );
}

function BadgeStatut({ statut, clair }: { statut: string, clair?: boolean }) {
  const s = STATUTS_STUDIO[statut] || { label: statut, couleur: '#8098b8' };
  return (
    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800,
      color: clair ? '#fff' : s.couleur, background: clair ? s.couleur : s.couleur + '22', border: '1px solid ' + s.couleur + '66' }}>
      {s.label}
    </span>
  );
}

export function CarteProjetArtiste({ p, credits }: { p: any, credits: number }) {
  const [chargement, setChargement] = useState<string>('');
  const [erreur, setErreur] = useState('');

  const payer = async (formule: FormuleStudio) => {
    setErreur(''); setChargement(formule);
    try {
      const u = auth.currentUser; if (!u) throw new Error('Reconnecte-toi pour payer.');
      const idToken = await u.getIdToken();
      const r = await fetch('/api/studio-paiement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId: p.id, formule, idToken }),
      });
      const d = await r.json();
      if (d.ok && d.url) { window.location.href = d.url; return; }
      throw new Error(d.error || 'Erreur, réessaie.');
    } catch (e: any) { setErreur(e.message || 'Erreur, réessaie.'); }
    setChargement('');
  };

  const utiliserCredit = async () => {
    setErreur(''); setChargement('credit');
    try {
      const u = auth.currentUser; if (!u) throw new Error('Reconnecte-toi.');
      const idToken = await u.getIdToken();
      const r = await fetch('/api/studio-utiliser-credit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId: p.id, idToken }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Erreur, réessaie.');
    } catch (e: any) { setErreur(e.message || 'Erreur, réessaie.'); }
    setChargement('');
  };

  const annuler = async () => {
    if (!confirm('Annuler ce projet ? Le studio ne le produira pas.')) return;
    try { await updateDoc(doc(db, 'studio_projets', p.id), { statut: 'annule', annuleLe: new Date().toISOString() }); }
    catch { setErreur('Impossible d\'annuler : le studio a peut-être déjà commencé.'); }
  };

  return (
    <div style={carte3D}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: C.text, fontWeight: 900, fontSize: 16, overflowWrap: 'anywhere' }}>{p.titre || 'Sans titre'}</p>
          <p style={{ margin: '3px 0 0', color: C.textSoft, fontSize: 12 }}>
            {p.style ? p.style + ' · ' : ''}{(p.pistes || []).length} piste{(p.pistes || []).length > 1 ? 's' : ''} · {dateCourte(p.createdAt)}
          </p>
        </div>
        <BadgeStatut statut={p.statut} />
      </div>

      {(p.statut === 'envoye' || p.statut === 'en_production') && (
        <p style={{ margin: '6px 0 0', color: C.textSoft, fontSize: 13, lineHeight: 1.6 }}>
          Le studio travaille sur ta musique. Ton extrait arrive sous 48 h — tu recevras une notification.
        </p>
      )}
      {p.statut === 'envoye' && (
        <button style={{ ...boutonDiscret, marginTop: 10, fontSize: 12 }} onClick={annuler}>Annuler ce projet</button>
      )}

      {p.statut === 'extrait_dispo' && p.extraitUrl && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>Ton extrait est prêt. Écoute-le :</p>
          <audio src={p.extraitUrl} controls controlsList="nodownload noplaybackrate" onContextMenu={e => e.preventDefault()} style={{ width: '100%', marginBottom: 12 }} />
          <p style={{ margin: '0 0 10px', color: C.text, fontSize: 13, fontWeight: 700 }}>Ça te plaît ? Valide et reçois le titre complet mixé et masterisé :</p>
          {credits > 0 && (
            <button disabled={!!chargement} style={{ ...bouton3D('#00D49A', '#009a70'), width: '100%', marginBottom: 12 }} onClick={utiliserCredit}>
              {chargement === 'credit' ? 'Validation...' : `Valider avec mon pack (${credits} titre${credits > 1 ? 's' : ''} restant${credits > 1 ? 's' : ''})`}
            </button>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {(Object.keys(STUDIO_FORMULES) as FormuleStudio[]).map(k => (
              <button key={k} disabled={!!chargement} style={{ ...bouton3D(k === 'titre' ? C.blue : '#7c4dff', k === 'titre' ? '#0050d0' : '#4b23c8'), width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8 }}
                onClick={() => payer(k)}>
                <span>{chargement === k ? 'Redirection...' : k === 'titre' ? 'Payer ce titre' : STUDIO_FORMULES[k].label}</span>
                <span>{fcfa(STUDIO_FORMULES[k].fcfa)}</span>
              </button>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', color: C.textSoft, fontSize: 11, lineHeight: 1.6 }}>
            Avec un pack, ce titre est validé tout de suite et les titres restants sont gardés pour tes prochains projets.
          </p>
        </div>
      )}

      {p.statut === 'paye' && (
        <p style={{ margin: '6px 0 0', color: C.textSoft, fontSize: 13, lineHeight: 1.6 }}>
          Paiement reçu. Le studio fait le mixage et le mastering final — tu seras notifié dès que ton titre est prêt.
        </p>
      )}

      {p.statut === 'livre' && p.finalUrl && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>Ton titre est prêt, prêt à la duplication.</p>
          <audio src={p.finalUrl} controls style={{ width: '100%', marginBottom: 10 }} />
          <a href={p.finalUrl.replace('/upload/', '/upload/fl_attachment/')} target="_blank" rel="noopener noreferrer"
            style={{ ...bouton3D('#00D49A', '#009a70'), display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Télécharger mon titre
          </a>
        </div>
      )}

      {erreur && <p style={{ margin: '10px 0 0', color: C.alert, fontSize: 13 }}>{erreur}</p>}
    </div>
  );
}

// ── Création d'un projet : infos + beat + prises de voix ──
function NouveauProjet({ user, artistName, onFini, onAnnuler }: { user: any, artistName: string, onFini: (msg: string) => void, onAnnuler: () => void }) {
  const [titre, setTitre] = useState('');
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [beat, setBeat] = useState<{ file: File, url: string } | null>(null);
  const [prises, setPrises] = useState<Prise[]>([]);
  const [typePiste, setTypePiste] = useState('lead');
  const [envoi, setEnvoi] = useState('');
  const [erreur, setErreur] = useState('');

  // Enregistrement
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const minuterieRef = useRef<any>(null);
  const debutRef = useRef<number>(0);
  const formatRef = useRef(formatEnregistrement());
  const typeEnCoursRef = useRef('lead');

  const MAX_SECONDES = 8 * 60;

  const libererMicro = () => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(minuterieRef.current);
    fluxRef.current?.getTracks().forEach(t => t.stop());
    fluxRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setNiveau(0);
  };
  useEffect(() => () => { libererMicro(); beatAudioRef.current?.pause(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const demarrer = async () => {
    setErreur('');
    if (!navigator.mediaDevices?.getUserMedia || !(window as any).MediaRecorder) {
      setErreur('Ton navigateur ne permet pas d\'enregistrer. Utilise Chrome (Android/ordinateur) ou Safari (iPhone) à jour.');
      return;
    }
    try {
      // Pas de traitement automatique : on veut la voix brute, la plus fidèle possible
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any,
      });
      fluxRef.current = flux;

      // Indicateur de niveau du micro
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        ctxRef.current = ctx;
        const analyseur = ctx.createAnalyser();
        analyseur.fftSize = 512;
        ctx.createMediaStreamSource(flux).connect(analyseur);
        const tampon = new Uint8Array(analyseur.fftSize);
        const boucle = () => {
          analyseur.getByteTimeDomainData(tampon);
          let max = 0;
          for (let i = 0; i < tampon.length; i++) max = Math.max(max, Math.abs(tampon[i] - 128));
          setNiveau(Math.min(1, max / 100));
          rafRef.current = requestAnimationFrame(boucle);
        };
        boucle();
      } catch { /* l'indicateur est un plus, pas indispensable */ }

      const fmt = formatRef.current;
      const rec = new MediaRecorder(flux, fmt.mime ? { mimeType: fmt.mime, audioBitsPerSecond: 192000 } : undefined);
      morceauxRef.current = [];
      typeEnCoursRef.current = typePiste;
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) morceauxRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(morceauxRef.current, { type: rec.mimeType || fmt.mime || 'audio/webm' });
        const sec = Math.round((Date.now() - debutRef.current) / 1000);
        libererMicro();
        if (blob.size > 0) {
          setPrises(ps => [...ps, { id: Math.random().toString(36).slice(2), type: typeEnCoursRef.current, blob, url: URL.createObjectURL(blob), ext: fmt.ext, secondes: sec }]);
        }
      };
      recRef.current = rec;

      // Le beat démarre en même temps que l'enregistrement
      if (beat && beatAudioRef.current) {
        beatAudioRef.current.currentTime = 0;
        await beatAudioRef.current.play().catch(() => {});
      }
      rec.start(1000);
      debutRef.current = Date.now();
      setSecondes(0);
      setEnregistre(true);
      minuterieRef.current = setInterval(() => {
        const s = Math.round((Date.now() - debutRef.current) / 1000);
        setSecondes(s);
        if (s >= MAX_SECONDES) arreter();
      }, 250);
    } catch (e: any) {
      libererMicro();
      setErreur(e?.name === 'NotAllowedError'
        ? 'Accès au micro refusé. Autorise le micro pour ce site dans les réglages de ton navigateur, puis réessaie.'
        : 'Impossible d\'accéder au micro : ' + (e?.message || 'erreur inconnue'));
    }
  };

  const arreter = () => {
    beatAudioRef.current?.pause();
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setEnregistre(false);
  };

  const importerPiste = (f: File) => {
    const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
    setPrises(ps => [...ps, { id: Math.random().toString(36).slice(2), type: typePiste, blob: f, url: URL.createObjectURL(f), ext, secondes: 0, importe: true, nomFichier: f.name }]);
  };

  const supprimerPrise = (id: string) => setPrises(ps => ps.filter(p => p.id !== id));
  const changerTypePrise = (id: string, type: string) => setPrises(ps => ps.map(p => p.id === id ? { ...p, type } : p));

  const envoyer = async () => {
    setErreur('');
    if (!titre.trim()) { setErreur('Donne un titre à ton morceau.'); return; }
    if (prises.length === 0) { setErreur('Enregistre ou importe au moins une piste de voix.'); return; }
    if (enregistre) { setErreur('Arrête d\'abord l\'enregistrement en cours.'); return; }
    try {
      let beatUrl = '';
      if (beat) {
        setEnvoi('Envoi du beat...');
        beatUrl = await envoyerAudio(beat.file, beat.file.name);
      }
      const pistes: any[] = [];
      for (let i = 0; i < prises.length; i++) {
        const pr = prises[i];
        setEnvoi(`Envoi des voix... ${i + 1}/${prises.length}`);
        const nom = `${(artistName || 'artiste').replace(/[^a-z0-9]+/gi, '_')}_${pr.type}_${i + 1}.${pr.ext}`;
        const url = await envoyerAudio(pr.blob, nom);
        pistes.push({ type: pr.type, url, secondes: pr.secondes, importe: !!pr.importe, nom });
      }
      setEnvoi('Enregistrement du projet...');
      const maintenant = new Date().toISOString();
      await addDoc(collection(db, 'studio_projets'), {
        uid: user.uid, email: (user.email || '').toLowerCase(), nomArtiste: artistName || user.displayName || '',
        titre: titre.trim(), style: style.trim(), notes: notes.trim(),
        beatUrl, pistes, statut: 'envoye', createdAt: maintenant, majLe: maintenant,
      });
      // Alerte l'admin (notification + push + email)
      const texte = `Studio vocal — ${artistName || user.email} a envoyé « ${titre.trim()} » (${pistes.length} piste${pistes.length > 1 ? 's' : ''}${beatUrl ? ', avec beat' : ', a cappella'}).`;
      envoyerNotification({ to: ADMIN_EMAIL, type: 'studio_admin', text: texte, lien: '/admin?tab=studiovocal' });
      envoyerEmailNotif(ADMIN_EMAIL, 'Studio vocal : nouveau projet', texte + '\n\nOuvre l\'admin Doniel Zik → onglet Studio vocal.');
      prises.forEach(p => URL.revokeObjectURL(p.url));
      onFini('Projet envoyé au studio ! Ton extrait arrive sous 48 h, tu seras notifié.');
    } catch (e: any) {
      setErreur('Échec de l\'envoi : ' + (e?.message || 'vérifie ta connexion et réessaie.'));
    }
    setEnvoi('');
  };

  return (
    <div>
      <button style={{ ...boutonDiscret, marginBottom: 14 }} onClick={() => { if (enregistre) arreter(); onAnnuler(); }}>← Retour</button>

      <div style={carte3D}>
        <p style={{ margin: '0 0 12px', color: C.text, fontWeight: 900, fontSize: 17 }}>Nouveau projet</p>
        <label style={etiquette}>Titre du morceau *</label>
        <input style={champ} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Merci Seigneur" maxLength={80} />
        <label style={etiquette}>Style musical souhaité</label>
        <input style={champ} value={style} onChange={e => setStyle(e.target.value)} placeholder="Ex : gospel, zouglou, afrobeat, coupé-décalé..." maxLength={80} />
        <label style={etiquette}>Instructions pour le studio</label>
        <textarea style={{ ...champ, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Tempo, ambiance, instruments, artistes de référence..." maxLength={1500} />
      </div>

      {/* BEAT */}
      <div style={carte3D}>
        <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 800, fontSize: 15 }}>Beat (facultatif)</p>
        <p style={{ margin: '0 0 12px', color: C.textSoft, fontSize: 12, lineHeight: 1.6 }}>
          Tu as déjà un beat ? Importe-le : il jouera pendant que tu chantes. Sinon, chante a cappella et nous construisons la musique autour de ta voix.
        </p>
        {beat ? (
          <div>
            <audio ref={beatAudioRef} src={beat.url} controls style={{ width: '100%', marginBottom: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.textSoft, fontSize: 12, overflowWrap: 'anywhere' }}>{beat.file.name}</span>
              <button style={boutonDiscret} disabled={enregistre} onClick={() => { URL.revokeObjectURL(beat.url); setBeat(null); }}>Retirer</button>
            </div>
          </div>
        ) : (
          <label style={{ ...boutonDiscret, display: 'inline-block' }}>
            Importer mon beat
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setBeat({ file: f, url: URL.createObjectURL(f) }); e.target.value = ''; }} />
          </label>
        )}
      </div>

      {/* ENREGISTREMENT */}
      <div style={carte3D}>
        <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 800, fontSize: 15 }}>Tes voix</p>
        <div style={{ borderRadius: 12, padding: '10px 12px', marginBottom: 12, background: 'rgba(245,200,76,0.12)', border: '1px solid rgba(245,200,76,0.35)', color: '#ffe7a3', fontSize: 12, lineHeight: 1.6 }}>
          Mets tes écouteurs{beat ? ' (obligatoire avec un beat, sinon il s\'entend dans ta voix)' : ''}. Choisis un endroit calme, téléphone à une main de ta bouche.
        </div>

        <label style={etiquette}>Type de piste</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {TYPES_PISTE.map(t => (
            <button key={t.id} disabled={enregistre} onClick={() => setTypePiste(t.id)}
              style={{ padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                border: '1px solid ' + (typePiste === t.id ? 'transparent' : C.border),
                background: typePiste === t.id ? 'linear-gradient(180deg,#3d9bff,#0a6be0)' : 'rgba(255,255,255,0.04)',
                color: typePiste === t.id ? '#fff' : C.textSoft,
                boxShadow: typePiste === t.id ? '0 4px 0 #0050b0, inset 0 1px 0 rgba(255,255,255,0.35)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Gros bouton d'enregistrement */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '6px 0 8px' }}>
          <button onClick={enregistre ? arreter : demarrer} disabled={!!envoi}
            aria-label={enregistre ? 'Arrêter l\'enregistrement' : 'Enregistrer'}
            style={{ width: 96, height: 96, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: enregistre ? 'radial-gradient(circle at 35% 30%, #ff8fa0, #e0213f 60%, #9e0f26)' : 'radial-gradient(circle at 35% 30%, #ff7a8c, #ff2d4d 55%, #b3122d)',
              boxShadow: enregistre
                ? `0 0 0 ${6 + Math.round(niveau * 16)}px rgba(255,45,77,0.25), 0 8px 0 #7d0a1d, 0 16px 30px rgba(0,0,0,0.45)`
                : '0 8px 0 #7d0a1d, 0 16px 30px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'box-shadow .08s' }}>
            {enregistre
              ? <span style={{ width: 30, height: 30, borderRadius: 6, background: '#fff' }} />
              : <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z"/></svg>}
          </button>
          <p style={{ margin: 0, color: enregistre ? '#ffb3bf' : C.textSoft, fontSize: 13, fontWeight: 800 }}>
            {enregistre ? `Enregistrement ${labelPiste(typeEnCoursRef.current)} — ${duree(secondes)}` : `Appuie pour enregistrer : ${labelPiste(typePiste)}`}
          </p>
          {enregistre && (
            <div style={{ width: '100%', maxWidth: 280, height: 8, borderRadius: 99, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
              <div style={{ width: Math.round(niveau * 100) + '%', height: '100%', borderRadius: 99, background: niveau > 0.9 ? C.alert : 'linear-gradient(90deg,#00D49A,#F5C84C)', transition: 'width .08s' }} />
            </div>
          )}
          {enregistre && niveau > 0.9 && <p style={{ margin: 0, color: C.alert, fontSize: 12, fontWeight: 700 }}>Trop fort : éloigne un peu le téléphone</p>}
        </div>

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <label style={{ ...boutonDiscret, display: 'inline-block', fontSize: 12 }}>
            Ou importer un audio déjà enregistré
            <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={enregistre}
              onChange={e => { const f = e.target.files?.[0]; if (f) importerPiste(f); e.target.value = ''; }} />
          </label>
        </div>

        {/* Liste des prises */}
        {prises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={{ margin: '0 0 8px', color: C.text, fontWeight: 800, fontSize: 14 }}>Pistes ({prises.length})</p>
            {prises.map((pr, i) => (
              <div key={pr.id} style={{ borderRadius: 14, padding: 12, marginBottom: 10, background: 'rgba(8,20,45,0.5)', border: '1px solid ' + C.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <select value={pr.type} onChange={e => changerTypePrise(pr.id, e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid ' + C.border, background: C.bgSecond, color: C.text, fontSize: 13, fontWeight: 700 }}>
                    {TYPES_PISTE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <span style={{ color: C.textSoft, fontSize: 12 }}>
                    Piste {i + 1}{pr.secondes ? ' · ' + duree(pr.secondes) : ''}{pr.importe ? ' · importée' : ''}
                  </span>
                  <button style={{ ...boutonDiscret, padding: '6px 10px', fontSize: 12, color: '#ffb3bf' }} disabled={!!envoi} onClick={() => supprimerPrise(pr.id)}>Supprimer</button>
                </div>
                <audio src={pr.url} controls style={{ width: '100%' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {erreur && <p style={{ color: C.alert, fontSize: 13, margin: '0 0 12px' }}>{erreur}</p>}
      <button style={{ ...bouton3D('#00D49A', '#009a70'), width: '100%', marginBottom: 30, opacity: envoi ? 0.7 : 1 }} disabled={!!envoi || enregistre} onClick={envoyer}>
        {envoi || 'Envoyer au studio'}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════
// CÔTÉ ADMIN
// ═════════════════════════════════════════════
export function StudioVocalAdmin() {
  const [projets, setProjets] = useState<any[]>([]);
  const [filtre, setFiltre] = useState<string>('a_traiter');

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'studio_projets'), orderBy('createdAt', 'desc')),
      snap => setProjets(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return u;
  }, []);

  const groupes: Record<string, (p: any) => boolean> = {
    a_traiter: p => ['envoye', 'en_production', 'paye'].includes(p.statut),
    extrait_dispo: p => p.statut === 'extrait_dispo',
    livre: p => p.statut === 'livre',
    tous: () => true,
  };
  const libelles: Record<string, string> = { a_traiter: 'À traiter', extrait_dispo: 'En attente de paiement', livre: 'Livrés', tous: 'Tous' };
  const liste = projets.filter(groupes[filtre]);

  return (
    <div>
      <div style={S.card}>
        <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Studio vocal</h2>
        <p style={{ color: '#5a7090', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Les artistes envoient leurs voix. Produis la musique, dépose l'extrait (30 à 45 s) sous 48 h, puis le titre final une fois payé.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.keys(groupes).map(k => {
          const n = projets.filter(groupes[k]).length;
          return (
            <button key={k} onClick={() => setFiltre(k)}
              style={{ ...S.btn2, fontWeight: 700, background: filtre === k ? '#1a6bff' : '#fff', color: filtre === k ? '#fff' : '#5a7090', borderColor: filtre === k ? '#1a6bff' : '#c8d8ef' }}>
              {libelles[k]} ({n})
            </button>
          );
        })}
      </div>
      {liste.length === 0 && <div style={{ ...S.card, color: '#8098b8', fontSize: 13, textAlign: 'center' }}>Aucun projet ici.</div>}
      {liste.map(p => <CarteProjetAdmin key={p.id} p={p} />)}
    </div>
  );
}

export function CarteProjetAdmin({ p }: { p: any }) {
  const [envoi, setEnvoi] = useState('');
  const [erreur, setErreur] = useState('');
  const ref = doc(db, 'studio_projets', p.id);

  const maj = async (champs: any) => { await updateDoc(ref, { ...champs, majLe: new Date().toISOString() }); };

  const deposer = async (f: File, quoi: 'extrait' | 'final') => {
    setErreur(''); setEnvoi(quoi === 'extrait' ? 'Envoi de l\'extrait...' : 'Envoi du titre final...');
    try {
      const url = await envoyerAudio(f, `${p.titre || 'titre'}_${quoi}.${(f.name.split('.').pop() || 'mp3')}`);
      const maintenant = new Date().toISOString();
      if (quoi === 'extrait') {
        await maj({ extraitUrl: url, statut: p.statut === 'paye' || p.statut === 'livre' ? p.statut : 'extrait_dispo', extraitLe: maintenant });
        if (p.statut !== 'paye' && p.statut !== 'livre') {
          envoyerNotification({ to: p.email, role: 'artiste', type: 'studio', lien: '/artiste?tab=studio', text: `Ton extrait de « ${p.titre} » est disponible ! Écoute-le dans ton Studio vocal et valide pour recevoir le titre complet.` });
          envoyerEmailNotif(p.email, 'Ton extrait est disponible', `Bonne nouvelle ! L'extrait de « ${p.titre} » est prêt.\n\nÉcoute-le sur https://doniel.art/artiste?tab=studio et valide pour recevoir ton titre mixé et masterisé.`);
        }
      } else {
        await maj({ finalUrl: url, statut: 'livre', livreLe: maintenant });
        envoyerNotification({ to: p.email, role: 'artiste', type: 'studio', lien: '/artiste?tab=studio', text: `Ton titre « ${p.titre} » est prêt, mixé et masterisé ! Télécharge-le dans ton Studio vocal.` });
        envoyerEmailNotif(p.email, 'Ton titre est prêt', `Ton titre « ${p.titre} » est mixé, masterisé et prêt à la duplication.\n\nTélécharge-le sur https://doniel.art/artiste?tab=studio`);
      }
    } catch (e: any) { setErreur(e?.message || 'Échec de l\'envoi'); }
    setEnvoi('');
  };

  const marquerPaye = async () => {
    if (!confirm('Confirmer que cet artiste a payé hors ligne (espèces, Mobile Money direct) ?')) return;
    await maj({ statut: 'paye', payeLe: new Date().toISOString(), formule: 'hors_ligne' });
  };

  const telecharger = (url: string) => url.replace('/upload/', '/upload/fl_attachment/');
  const s = STATUTS_STUDIO[p.statut] || { label: p.statut, couleur: '#8098b8' };

  return (
    <div style={{ ...S.card, borderLeft: '4px solid ' + s.couleur }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, overflowWrap: 'anywhere' }}>{p.titre}</p>
          <p style={{ margin: '3px 0 0', color: '#5a7090', fontSize: 12 }}>{p.nomArtiste} · {p.email} · {dateCourte(p.createdAt)}</p>
        </div>
        <BadgeStatut statut={p.statut} clair />
      </div>
      {p.style && <p style={{ margin: '0 0 4px', fontSize: 13 }}><b>Style :</b> {p.style}</p>}
      {p.notes && <p style={{ margin: '0 0 8px', fontSize: 13, whiteSpace: 'pre-wrap', color: '#1a2340' }}><b>Instructions :</b> {p.notes}</p>}
      {p.formule && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#5a7090' }}>Formule : {STUDIO_FORMULES[p.formule as FormuleStudio]?.label || p.formule}{p.montant ? ' · ' + fcfa(p.montant) : ''}</p>}

      {p.beatUrl && (
        <div style={{ background: '#f5f8ff', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ fontSize: 13 }}>Beat de l'artiste</b>
            <a href={telecharger(p.beatUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#1a6bff' }}>Télécharger</a>
          </div>
          <audio src={p.beatUrl} controls style={{ width: '100%' }} />
        </div>
      )}
      {(p.pistes || []).map((pi: any, i: number) => (
        <div key={i} style={{ background: '#f5f8ff', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <b style={{ fontSize: 13 }}>{i + 1}. {labelPiste(pi.type)}{pi.secondes ? ' · ' + duree(pi.secondes) : ''}{pi.importe ? ' · importée' : ''}</b>
            <a href={telecharger(pi.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#1a6bff' }}>Télécharger</a>
          </div>
          <audio src={pi.url} controls style={{ width: '100%' }} />
        </div>
      ))}

      {p.extraitUrl && (
        <div style={{ marginTop: 6 }}>
          <b style={{ fontSize: 13 }}>Extrait déposé</b>
          <audio src={p.extraitUrl} controls style={{ width: '100%', marginTop: 4 }} />
        </div>
      )}
      {p.finalUrl && (
        <div style={{ marginTop: 6 }}>
          <b style={{ fontSize: 13 }}>Titre final</b>
          <audio src={p.finalUrl} controls style={{ width: '100%', marginTop: 4 }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {p.statut === 'envoye' && <button style={S.btn2} onClick={() => maj({ statut: 'en_production' })}>Passer en production</button>}
        {['envoye', 'en_production', 'extrait_dispo'].includes(p.statut) && (
          <label style={{ ...S.btn, display: 'inline-block', opacity: envoi ? 0.6 : 1 }}>
            {p.extraitUrl ? 'Remplacer l\'extrait' : 'Déposer l\'extrait'}
            <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={!!envoi}
              onChange={e => { const f = e.target.files?.[0]; if (f) deposer(f, 'extrait'); e.target.value = ''; }} />
          </label>
        )}
        {p.statut === 'extrait_dispo' && <button style={S.btn2} onClick={marquerPaye}>Marquer payé (hors ligne)</button>}
        {(p.statut === 'paye' || p.statut === 'livre') && (
          <label style={{ ...S.btn, display: 'inline-block', background: '#00a070', opacity: envoi ? 0.6 : 1 }}>
            {p.finalUrl ? 'Remplacer le titre final' : 'Déposer le titre final'}
            <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={!!envoi}
              onChange={e => { const f = e.target.files?.[0]; if (f) deposer(f, 'final'); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {envoi && <p style={{ margin: '8px 0 0', color: '#1a6bff', fontSize: 13 }}>{envoi}</p>}
      {erreur && <p style={{ margin: '8px 0 0', color: '#e04060', fontSize: 13 }}>{erreur}</p>}
    </div>
  );
}
