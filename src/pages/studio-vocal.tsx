// ─────────────────────────────────────────────
// STUDIO DONIEL ZIK — un vrai studio, en ligne (site doniel.art et appli).
//
// Production complète (12 000 FCFA) :
//   style → voix témoin → l'équipe livre 2 propositions (démo voix IA + instru
//   avec chœurs) en écoute seule, signées → l'artiste choisit et paie →
//   l'instru propre se débloque → prise de voix finale → arrangement final.
// Sur ton beat / Remastering / Remixage (6 000 FCFA) :
//   envoi → l'équipe prépare le titre → aperçu signé → paiement → téléchargement.
//
// Collections Firestore :
//   studio_projets/{id}    — un projet = un titre (aperçus signés uniquement)
//   studio_livrables/{id}  — fichiers PROPRES, lisibles seulement après paiement
//   studio_priorite/{uid}  — Pack Priorité (écrit par le serveur)
//   studio_config/signature — signature sonore choisie par l'admin
// ─────────────────────────────────────────────
import { Fragment, useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy, where, getDoc, setDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile,
} from 'firebase/auth';
import {
  C, S, ADMIN_EMAIL, envoyerNotification, envoyerEmailNotif,
  CLOUDINARY_CLOUD, CLOUDINARY_UPLOAD_PRESET,
} from '../lib/utils';
import { avecSignature } from '../lib/signature-audio';
import { NavBas, BoutonProfil } from '../components/shared';

// ── Services (le montant réellement facturé est recalculé côté serveur) ──
export const SERVICES_STUDIO = {
  production: { label: 'Production complète', fcfa: 12000, desc: 'Tu chantes, on crée ton instru et tes chœurs, tu poses ta voix finale' },
  beat:       { label: 'Sur ton beat',        fcfa: 6000,  desc: 'Tu chantes sur ton instru, on fait l\'arrangement final' },
  remaster:   { label: 'Remastering',         fcfa: 6000,  desc: 'Son plus fort et plus propre, prêt pour les plateformes' },
  remix:      { label: 'Remixage',            fcfa: 6000,  desc: 'Nouvel arrangement autour de ta chanson' },
} as const;
export type ServiceStudio = keyof typeof SERVICES_STUDIO;
export type ServiceTitre = 'remaster' | 'remix';
export const SERVICES_TITRE = { remaster: SERVICES_STUDIO.remaster, remix: SERVICES_STUDIO.remix };
export const libelleService = (s?: string) => (s && s in SERVICES_STUDIO) ? SERVICES_STUDIO[s as ServiceStudio].label : 'Production';


// Pack d'ouverture : priorité (réponse sous 48 h) pendant 3 mois, payé une seule fois
export const PACK_PRIORITE = { label: 'Pack Priorité', fcfa: 1500, mois: 3 };
export const DELAI_PRIORITE = '48 h';
export const DELAI_NORMAL = '7 jours et plus';
// « Réponse sous 48 h » / « Réponse en 7 jours et plus »
export const delai = (prio: boolean) => prio ? `sous ${DELAI_PRIORITE}` : `en ${DELAI_NORMAL}`;

export const STYLES_MUSIQUE = ['Gospel', 'Zouglou', 'Afrobeat', 'Coupé-décalé', 'Rumba', 'Rap', 'R&B', 'Reggae', 'Variété', 'Autre'];

// Version des Conditions du Studio (à changer si le texte change)
export const VERSION_CONDITIONS = '2026-11-23';

export const TYPES_PISTE: { id: string, label: string }[] = [
  { id: 'lead',     label: 'Voix lead' },
  { id: 'choeur',   label: 'Chœurs (voix 1)' },
  { id: 'choeur2',  label: 'Chœurs (voix 2)' },
  { id: 'choeur3',  label: 'Chœurs (voix 3)' },
  { id: 'choeur4',  label: 'Chœurs (voix 4)' },
  { id: 'doublage', label: 'Doublage' },
  { id: 'cri',      label: 'Cris / ad-libs' },
  { id: 'autre',    label: 'Autre' },
];
const labelPiste = (t: string) => TYPES_PISTE.find(x => x.id === t)?.label || t;

export const STATUTS_STUDIO: Record<string, { label: string, couleur: string }> = {
  envoye:             { label: 'Reçu par le studio',    couleur: '#5BB0FF' },
  en_production:      { label: 'En production',         couleur: '#F5C84C' },
  propositions_dispo: { label: 'Propositions prêtes',   couleur: '#00D49A' },
  instru_debloquee:   { label: 'À toi de chanter',      couleur: '#FF8A3D' },
  voix_finale:        { label: 'Voix finale reçue',     couleur: '#b388ff' },
  finalisation:       { label: 'Finalisation',          couleur: '#b388ff' },
  extrait_dispo:      { label: 'Aperçu disponible',     couleur: '#00D49A' },
  paye:               { label: 'Payé — finalisation',   couleur: '#b388ff' },
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
function BadgeStatut({ statut, clair }: { statut: string, clair?: boolean }) {
  const s = STATUTS_STUDIO[statut] || { label: statut, couleur: '#8098b8' };
  return (
    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800,
      color: clair ? '#fff' : s.couleur, background: clair ? s.couleur : s.couleur + '22', border: '1px solid ' + s.couleur + '66' }}>
      {s.label}
    </span>
  );
}

export function CarteProjetArtiste({ p, onChanter }: { p: any, onChanter?: (p: any, instruUrl: string) => void }) {
  const [chargement, setChargement] = useState('');
  const [erreur, setErreur] = useState('');
  const [livrable, setLivrable] = useState<any>(null);
  const debloque = ['instru_debloquee', 'voix_finale', 'finalisation', 'livre'].includes(p.statut);

  // Fichiers propres : lisibles seulement après paiement
  useEffect(() => {
    if (!debloque) { setLivrable(null); return; }
    getDoc(doc(db, 'studio_livrables', p.id)).then(d => setLivrable(d.exists() ? d.data() : null)).catch(() => setLivrable(null));
  }, [p.id, p.statut]); // eslint-disable-line react-hooks/exhaustive-deps

  const payer = async () => {
    setErreur(''); setChargement('payer');
    try {
      const u = auth.currentUser; if (!u) throw new Error('Reconnecte-toi pour payer.');
      const r = await fetch('/api/studio-paiement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId: p.id, idToken: await u.getIdToken() }),
      });
      const d = await r.json();
      if (d.ok && d.url) { window.location.href = d.url; return; }
      throw new Error(d.error || 'Erreur, réessaie.');
    } catch (e: any) { setErreur(e.message || 'Erreur, réessaie.'); }
    setChargement('');
  };
  const choisir = async (i: number) => {
    setErreur('');
    try { await updateDoc(doc(db, 'studio_projets', p.id), { choix: i, majLe: new Date().toISOString() }); }
    catch { setErreur('Impossible d\'enregistrer ton choix, réessaie.'); }
  };
  const annuler = async () => {
    if (!confirm('Annuler ce projet ? Le studio ne le produira pas.')) return;
    try { await updateDoc(doc(db, 'studio_projets', p.id), { statut: 'annule', annuleLe: new Date().toISOString() }); }
    catch { setErreur('Impossible d\'annuler : le studio a peut-être déjà commencé.'); }
  };

  const prix = (p.service && p.service in SERVICES_STUDIO) ? SERVICES_STUDIO[p.service as ServiceStudio].fcfa : 12000;
  const ecouteSeule = { controlsList: 'nodownload noplaybackrate', onContextMenu: (e: any) => e.preventDefault() } as any;
  const instruChoisie = livrable?.propositions?.[p.choix ?? 0]?.instruUrl || '';
  const finalUrl = livrable?.finalUrl || p.finalUrl || '';
  const lienTelecharger = (u: string) => u.replace('/upload/', '/upload/fl_attachment/');
  const boutonPayer = (texte: string) => (
    <button disabled={!!chargement} onClick={payer}
      style={{ ...bouton3D(C.blue, '#0050d0'), width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
      <span>{chargement ? 'Redirection...' : texte}</span><span>{fcfa(prix)}</span>
    </button>
  );

  return (
    <div style={carte3D}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: C.text, fontWeight: 900, fontSize: 16, overflowWrap: 'anywhere' }}>{p.titre || 'Sans titre'}</p>
          <p style={{ margin: '3px 0 0', color: C.textSoft, fontSize: 12 }}>
            {p.prioritaire && <span style={{ color: C.gold, fontWeight: 900 }}>⚡ Priorité · </span>}
            {libelleService(p.service)}{p.style ? ' · ' + p.style : ''} · {dateCourte(p.createdAt)}
          </p>
        </div>
        <BadgeStatut statut={p.statut} />
      </div>

      {(p.statut === 'envoye' || p.statut === 'en_production') && (
        <p style={{ margin: '6px 0 0', color: C.textSoft, fontSize: 13, lineHeight: 1.6 }}>
          Le studio travaille sur ta musique. Réponse {delai(!!p.prioritaire)}, tu seras notifié.
        </p>
      )}
      {p.statut === 'envoye' && <button style={{ ...boutonDiscret, marginTop: 10, fontSize: 12 }} onClick={annuler}>Annuler ce projet</button>}

      {/* Production : les propositions, en écoute seule (signées) */}
      {p.statut === 'propositions_dispo' && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 10px', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>Tes propositions sont prêtes. Écoute et choisis :</p>
          {(p.propositions || []).map((pr: any, i: number) => {
            const actif = p.choix === i;
            return (
              <div key={i} style={{ padding: 12, borderRadius: 14, marginBottom: 10, border: '1px solid ' + (actif ? '#00D49A' : C.border),
                background: actif ? 'rgba(0,212,154,0.1)' : 'rgba(8,20,45,0.45)' }}>
                <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 900, fontSize: 14 }}>Proposition {i + 1}</p>
                {pr.demoApercu && <><p style={{ margin: '0 0 4px', color: C.textSoft, fontSize: 11, fontWeight: 800 }}>DÉMO (VOIX IA)</p>
                  <audio src={pr.demoApercu} controls {...ecouteSeule} style={{ width: '100%', marginBottom: 8 }} /></>}
                {pr.instruApercu && <><p style={{ margin: '0 0 4px', color: C.textSoft, fontSize: 11, fontWeight: 800 }}>INSTRU + CHŒURS</p>
                  <audio src={pr.instruApercu} controls {...ecouteSeule} style={{ width: '100%', marginBottom: 8 }} /></>}
                <button onClick={() => choisir(i)}
                  style={{ ...boutonDiscret, width: '100%', fontSize: 13, color: actif ? '#00D49A' : C.text, borderColor: actif ? '#00D49A' : C.border }}>
                  {actif ? '✓ Proposition choisie' : 'Je choisis celle-ci'}
                </button>
              </div>
            );
          })}
          <p style={{ margin: '0 0 8px', color: C.textSoft, fontSize: 11 }}>Écoute seule, avec la signature Doniel Zik. Après paiement, tu reçois l'instru propre.</p>
          {typeof p.choix === 'number' ? boutonPayer('Payer et débloquer mon instru') : <p style={{ margin: 0, color: C.gold, fontSize: 12, fontWeight: 800 }}>Choisis une proposition pour continuer.</p>}
        </div>
      )}

      {/* Instru débloquée : prise de voix finale */}
      {p.statut === 'instru_debloquee' && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 10px', color: '#ffd2b0', fontSize: 13, fontWeight: 800 }}>Ton instru est débloquée. Entraîne-toi, puis enregistre ta voix finale.</p>
          {instruChoisie ? (
            <>
              <audio src={instruChoisie} controls style={{ width: '100%', marginBottom: 10 }} />
              <button style={{ ...bouton3D('#ff2d4d', '#a50f29'), width: '100%', marginBottom: 10 }} onClick={() => onChanter?.(p, instruChoisie)}>
                🎙 Chanter sur l'instru
              </button>
              <a href={lienTelecharger(instruChoisie)} target="_blank" rel="noopener noreferrer"
                style={{ ...boutonDiscret, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Télécharger l'instru</a>
            </>
          ) : <p style={{ color: C.textSoft, fontSize: 12 }}>Chargement de ton instru...</p>}
        </div>
      )}
      {(p.statut === 'voix_finale' || p.statut === 'finalisation' || p.statut === 'paye') && (
        <p style={{ margin: '6px 0 0', color: C.textSoft, fontSize: 13, lineHeight: 1.6 }}>
          Le studio fait l'arrangement final de ton titre. Tu seras notifié dès qu'il est prêt.
        </p>
      )}

      {/* Beat, remastering, remixage : aperçu signé puis paiement */}
      {p.statut === 'extrait_dispo' && (p.apercuUrl || p.extraitUrl) && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>Ton titre est prêt. Écoute l'aperçu :</p>
          <audio src={p.apercuUrl || p.extraitUrl} controls {...ecouteSeule} style={{ width: '100%', marginBottom: 6 }} />
          <p style={{ margin: '0 0 10px', color: C.textSoft, fontSize: 11 }}>Aperçu avec la signature Doniel Zik. Après paiement, tu télécharges le titre propre.</p>
          {boutonPayer('Payer et télécharger')}
        </div>
      )}

      {p.statut === 'livre' && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', color: '#bff5e3', fontSize: 13, fontWeight: 800 }}>Ton titre est prêt.</p>
          {finalUrl ? (
            <>
              <audio src={finalUrl} controls style={{ width: '100%', marginBottom: 10 }} />
              <a href={lienTelecharger(finalUrl)} target="_blank" rel="noopener noreferrer"
                style={{ ...bouton3D('#00D49A', '#009a70'), display: 'block', textAlign: 'center', textDecoration: 'none' }}>Télécharger mon titre</a>
            </>
          ) : <p style={{ color: C.textSoft, fontSize: 12 }}>Chargement...</p>}
        </div>
      )}

      {erreur && <p style={{ margin: '10px 0 0', color: C.alert, fontSize: 13 }}>{erreur}</p>}
    </div>
  );
}

// ── Création d'un projet : infos + beat + prises de voix ──

// ═════════════════════════════════════════════
// CÔTÉ ADMIN
// ═════════════════════════════════════════════
export function StudioVocalAdmin() {
  const [projets, setProjets] = useState<any[]>([]);
  const [filtre, setFiltre] = useState<string>('a_traiter');
  const [, setTic] = useState(0);
  useEffect(() => { const t = setInterval(() => setTic(x => x + 1), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'studio_projets'), orderBy('createdAt', 'desc')),
      snap => setProjets(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return u;
  }, []);

  const groupes: Record<string, (p: any) => boolean> = {
    a_traiter: p => ['envoye', 'en_production', 'voix_finale', 'finalisation', 'paye'].includes(p.statut),
    attente: p => ['propositions_dispo', 'extrait_dispo', 'instru_debloquee'].includes(p.statut),
    livre: p => p.statut === 'livre',
    tous: () => true,
  };
  const libelles: Record<string, string> = { a_traiter: 'À traiter', attente: 'Chez l\'artiste', livre: 'Livrés', tous: 'Tous' };
  // Les projets prioritaires en attente passent en tête de liste
  const enAttente = (p: any) => p.prioritaire && ['envoye', 'en_production'].includes(p.statut);
  const liste = projets.filter(groupes[filtre]).sort((a, b) => Number(enAttente(b)) - Number(enAttente(a)));

  return (
    <div>
      <div style={S.card}>
        <h2 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Studio</h2>
        <p style={{ color: '#5a7090', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Tu déposes toujours des fichiers PROPRES : la signature sonore est ajoutée automatiquement sur ce que l'artiste écoute avant de payer.
          ⚡ FAST : sous 48 h. FREE : 7 jours et plus.
        </p>
      </div>
      <SignatureSonoreAdmin />
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

// Réglage de la signature sonore (un court son « Doniel Zik » enregistré par l'équipe)
function SignatureSonoreAdmin() {
  const [url, setUrl] = useState('');
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    const u = onSnapshot(doc(db, 'studio_config', 'signature'), d => setUrl(d.exists() ? (d.data().url || '') : ''), () => {});
    return u;
  }, []);
  const deposer = async (f: File) => {
    setEnvoi(true);
    try { const u = await envoyerAudio(f, 'signature_doniel_zik.' + (f.name.split('.').pop() || 'mp3')); await setDoc(doc(db, 'studio_config', 'signature'), { url: u, majLe: new Date().toISOString() }); }
    catch (e: any) { alert('Échec : ' + (e?.message || 'réessaie')); }
    setEnvoi(false);
  };
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <b style={{ fontSize: 14 }}>Signature sonore</b>
        <p style={{ margin: '2px 0 6px', color: '#5a7090', fontSize: 12 }}>
          {url ? 'Posée au début puis toutes les 20 s sur chaque aperçu.' : 'Aucune encore : un petit carillon est utilisé. Enregistre « Doniel Zik » (2 à 3 s) et dépose-le.'}
        </p>
        {url && <audio src={url} controls style={{ width: '100%', maxWidth: 320 }} />}
      </div>
      <label style={{ ...S.btn2, display: 'inline-block', opacity: envoi ? 0.6 : 1 }}>
        {envoi ? 'Envoi...' : url ? 'Changer' : 'Déposer la signature'}
        <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={envoi}
          onChange={e => { const f = e.target.files?.[0]; if (f) deposer(f); e.target.value = ''; }} />
      </label>
    </div>
  );
}

// Dépose un fichier propre + crée son aperçu signé. Renvoie les deux adresses.
async function deposerAvecApercu(f: File, nom: string, etape: (t: string) => void): Promise<{ propre: string, apercu: string }> {
  etape('Envoi du fichier propre...');
  const propre = await envoyerAudio(f, `${nom}.${f.name.split('.').pop() || 'mp3'}`);
  etape('Ajout de la signature sonore...');
  let sig = '';
  try { const d = await getDoc(doc(db, 'studio_config', 'signature')); sig = d.exists() ? (d.data().url || '') : ''; } catch { /* carillon */ }
  const signe = await avecSignature(f, sig || undefined);
  etape('Envoi de l\'aperçu signé...');
  const apercu = await envoyerAudio(signe, `${nom}_apercu.mp3`);
  return { propre, apercu };
}

export function CarteProjetAdmin({ p }: { p: any }) {
  const [envoi, setEnvoi] = useState('');
  const [erreur, setErreur] = useState('');
  const [demo, setDemo] = useState<File | null>(null);
  const [instru, setInstru] = useState<File | null>(null);
  const [livrable, setLivrable] = useState<any>(null);
  const ref = doc(db, 'studio_projets', p.id);
  const refLivrable = doc(db, 'studio_livrables', p.id);
  const service = p.service || 'production';
  const base = (p.titre || 'titre').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);

  useEffect(() => {
    const u = onSnapshot(refLivrable, d => setLivrable(d.exists() ? d.data() : null), () => {});
    return u;
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = async (champs: any) => { await updateDoc(ref, { ...champs, majLe: new Date().toISOString() }); };
  const prevenir = (texte: string, sujet: string) => {
    envoyerNotification({ to: p.email, type: 'studio', lien: '/studio-vocal?vue=projets', text: texte });
    envoyerEmailNotif(p.email, sujet, texte + '\n\nOuvre le Studio dans l\'appli Doniel Zik.');
  };

  // Production : publier une proposition (démo voix IA + instru avec chœurs)
  const publierProposition = async () => {
    if (!demo && !instru) { setErreur('Ajoute au moins la démo ou l\'instru.'); return; }
    setErreur('');
    try {
      const n = (p.propositions || []).length + 1;
      const pr: any = {}, prPropre: any = {};
      if (demo) { const r = await deposerAvecApercu(demo, `${base}_prop${n}_demo`, setEnvoi); pr.demoApercu = r.apercu; prPropre.demoUrl = r.propre; }
      if (instru) { const r = await deposerAvecApercu(instru, `${base}_prop${n}_instru`, setEnvoi); pr.instruApercu = r.apercu; prPropre.instruUrl = r.propre; }
      setEnvoi('Publication...');
      await setDoc(refLivrable, { uid: p.uid, propositions: [...(livrable?.propositions || []), prPropre] }, { merge: true });
      await maj({ propositions: [...(p.propositions || []), pr], statut: 'propositions_dispo', propositionsLe: new Date().toISOString() });
      if (n === 1) prevenir(`Tes propositions pour « ${p.titre} » sont prêtes ! Écoute-les et choisis ta préférée.`, 'Tes propositions sont prêtes');
      setDemo(null); setInstru(null);
    } catch (e: any) { setErreur(e?.message || 'Échec de l\'envoi'); }
    setEnvoi('');
  };

  // Beat / remaster / remix : titre fini (propre) + aperçu signé
  const deposerTitreFini = async (f: File) => {
    setErreur('');
    try {
      const r = await deposerAvecApercu(f, `${base}_final`, setEnvoi);
      await setDoc(refLivrable, { uid: p.uid, finalUrl: r.propre }, { merge: true });
      await maj({ apercuUrl: r.apercu, statut: 'extrait_dispo', apercuLe: new Date().toISOString() });
      prevenir(`Ton titre « ${p.titre} » est prêt ! Écoute l'aperçu et débloque-le.`, 'Ton titre est prêt');
    } catch (e: any) { setErreur(e?.message || 'Échec de l\'envoi'); }
    setEnvoi('');
  };

  // Production : titre final après la prise de voix finale (déjà payé → livré directement)
  const deposerFinal = async (f: File) => {
    setErreur(''); setEnvoi('Envoi du titre final...');
    try {
      const url = await envoyerAudio(f, `${base}_final.${f.name.split('.').pop() || 'mp3'}`);
      await setDoc(refLivrable, { uid: p.uid, finalUrl: url }, { merge: true });
      await maj({ statut: 'livre', livreLe: new Date().toISOString() });
      prevenir(`Ton titre « ${p.titre} » est terminé ! Télécharge-le dans le Studio.`, 'Ton titre est terminé');
    } catch (e: any) { setErreur(e?.message || 'Échec de l\'envoi'); }
    setEnvoi('');
  };

  const marquerPaye = async () => {
    if (!confirm('Confirmer que cet artiste a payé hors ligne (espèces, Mobile Money direct) ?')) return;
    const maintenant = new Date().toISOString();
    if (service === 'production') await maj({ statut: 'instru_debloquee', payeLe: maintenant, formule: 'hors_ligne', choix: p.choix ?? 0 });
    else await maj({ statut: 'livre', payeLe: maintenant, livreLe: maintenant, formule: 'hors_ligne' });
  };

  const telecharger = (url: string) => url.replace('/upload/', '/upload/fl_attachment/');
  const s = STATUTS_STUDIO[p.statut] || { label: p.statut, couleur: '#8098b8' };
  let rebours = '';
  if (p.prioritaire && ['envoye', 'en_production', 'voix_finale'].includes(p.statut)) {
    const depart = p.statut === 'voix_finale' ? p.voixFinaleLe : p.createdAt;
    if (depart) {
      const reste = new Date(depart).getTime() + 48 * 3600 * 1000 - Date.now();
      const h = Math.floor(Math.abs(reste) / 3600000), m = Math.floor((Math.abs(reste) % 3600000) / 60000);
      rebours = reste >= 0 ? `reste ${h} h ${String(m).padStart(2, '0')}` : `en retard de ${h} h ${String(m).padStart(2, '0')}`;
    }
  }
  const blocAudio = (titre: string, url: string) => (
    <div key={titre + url} style={{ background: '#f5f8ff', borderRadius: 10, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <b style={{ fontSize: 13 }}>{titre}</b>
        <a href={telecharger(url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#1a6bff' }}>Télécharger</a>
      </div>
      <audio src={url} controls style={{ width: '100%' }} />
    </div>
  );
  const champFichier = (label: string, f: File | null, set: (f: File | null) => void) => (
    <label style={{ ...S.btn2, display: 'inline-block', background: f ? '#e8fff6' : '#fff' }}>
      {f ? '✓ ' + f.name.slice(0, 24) : label}
      <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { set(e.target.files?.[0] || null); e.target.value = ''; }} />
    </label>
  );

  return (
    <div style={{ ...S.card, borderLeft: '4px solid ' + (p.prioritaire ? '#F5C84C' : s.couleur) }}>
      {p.prioritaire && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, margin: '-4px 0 10px', padding: '6px 10px', borderRadius: 10,
          background: rebours.startsWith('en retard') ? '#ffe3e8' : '#fff6da', color: rebours.startsWith('en retard') ? '#c0183a' : '#8a6400', fontSize: 12, fontWeight: 900 }}>
          <span>⚡ PRIORITÉ — sous 48 h</span>{rebours && <span>{rebours}</span>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, overflowWrap: 'anywhere' }}>{p.titre}</p>
          <p style={{ margin: '3px 0 0', color: '#5a7090', fontSize: 12 }}>{p.nomArtiste} · {p.email} · {dateCourte(p.createdAt)}</p>
        </div>
        <BadgeStatut statut={p.statut} clair />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}><b>Service :</b> {libelleService(p.service)}</p>
      {p.style && <p style={{ margin: '0 0 4px', fontSize: 13 }}><b>Style :</b> {p.style}</p>}
      {p.notes && <p style={{ margin: '0 0 8px', fontSize: 13, whiteSpace: 'pre-wrap', color: '#1a2340' }}><b>Instructions :</b> {p.notes}</p>}
      {p.montant ? <p style={{ margin: '0 0 8px', fontSize: 12, color: '#5a7090' }}>Payé : {fcfa(p.montant)}{p.formule === 'hors_ligne' ? ' (hors ligne)' : ''}</p> : null}
      {p.paiementEnTrop && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#c0183a', fontWeight: 800 }}>Attention : paiement en double (réf. {p.paiementEnTrop})</p>}

      {p.fichierUrl && blocAudio(`Titre envoyé (${libelleService(p.service)})`, p.fichierUrl)}
      {p.beatUrl && blocAudio('Beat de l\'artiste', p.beatUrl)}
      {(p.pistes || []).map((pi: any, i: number) => blocAudio(`${service === 'production' ? 'Voix témoin' : 'Voix'} ${i + 1} · ${labelPiste(pi.type)}${pi.secondes ? ' · ' + duree(pi.secondes) : ''}`, pi.url))}

      {(livrable?.propositions || []).map((pr: any, i: number) => (
        <div key={'pr' + i} style={{ border: '1px solid ' + (p.choix === i ? '#00a070' : '#dbe6f5'), borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <b style={{ fontSize: 13 }}>Proposition {i + 1}{p.choix === i ? ' — CHOISIE par l\'artiste' : ''}</b>
          {pr.demoUrl && blocAudio('Démo voix IA (propre)', pr.demoUrl)}
          {pr.instruUrl && blocAudio('Instru + chœurs (propre)', pr.instruUrl)}
        </div>
      ))}
      {(p.pistesFinales || []).map((pi: any, i: number) => blocAudio(`VOIX FINALE ${i + 1} · ${labelPiste(pi.type)}${pi.secondes ? ' · ' + duree(pi.secondes) : ''}`, pi.url))}
      {p.notesFinales && <p style={{ margin: '0 0 8px', fontSize: 13 }}><b>Note de l'artiste :</b> {p.notesFinales}</p>}
      {(livrable?.finalUrl || p.finalUrl) && blocAudio('Titre final (propre)', livrable?.finalUrl || p.finalUrl)}
      {p.apercuUrl && blocAudio('Aperçu signé (ce que l\'artiste écoute)', p.apercuUrl)}
      {p.extraitUrl && blocAudio('Extrait (ancien parcours)', p.extraitUrl)}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        {p.statut === 'envoye' && <button style={S.btn2} onClick={() => maj({ statut: 'en_production' })}>Passer en production</button>}

        {service === 'production' && ['envoye', 'en_production', 'propositions_dispo'].includes(p.statut) && (
          <div style={{ width: '100%', background: '#f5f8ff', borderRadius: 12, padding: 10 }}>
            <b style={{ fontSize: 13 }}>{(p.propositions || []).length ? 'Ajouter une autre proposition' : 'Publier une proposition'}</b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
              {champFichier('Démo voix IA', demo, setDemo)}
              {champFichier('Instru + chœurs', instru, setInstru)}
            </div>
            <button style={{ ...S.btn, opacity: envoi ? 0.6 : 1 }} disabled={!!envoi} onClick={publierProposition}>Publier (avec signature)</button>
          </div>
        )}

        {service !== 'production' && ['envoye', 'en_production', 'extrait_dispo'].includes(p.statut) && (
          <label style={{ ...S.btn, display: 'inline-block', opacity: envoi ? 0.6 : 1 }}>
            {p.apercuUrl ? 'Remplacer le titre fini' : 'Déposer le titre fini (propre)'}
            <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={!!envoi}
              onChange={e => { const f = e.target.files?.[0]; if (f) deposerTitreFini(f); e.target.value = ''; }} />
          </label>
        )}

        {p.statut === 'voix_finale' && <button style={S.btn2} onClick={() => maj({ statut: 'finalisation' })}>Commencer l'arrangement final</button>}
        {(['voix_finale', 'finalisation', 'paye'].includes(p.statut) || (p.statut === 'livre' && service === 'production')) && (
          <label style={{ ...S.btn, display: 'inline-block', background: '#00a070', opacity: envoi ? 0.6 : 1 }}>
            {(livrable?.finalUrl || p.finalUrl) ? 'Remplacer le titre final' : 'Déposer le titre final'}
            <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={!!envoi}
              onChange={e => { const f = e.target.files?.[0]; if (f) deposerFinal(f); e.target.value = ''; }} />
          </label>
        )}

        {['propositions_dispo', 'extrait_dispo'].includes(p.statut) && <button style={S.btn2} onClick={marquerPaye}>Marquer payé (hors ligne)</button>}
      </div>
      {envoi && <p style={{ margin: '8px 0 0', color: '#1a6bff', fontSize: 13 }}>{envoi}</p>}
      {erreur && <p style={{ margin: '8px 0 0', color: '#e04060', fontSize: 13 }}>{erreur}</p>}
    </div>
  );
}

// ═════════════════════════════════════════════
// STUDIO — console d'enregistrement, ouverte à tous.
// Chrono, onde en direct, pistes colorées (Beat, Voix lead, Chœurs, Doublage,
// Cris), gros bouton rouge, « Envoyer au studio ». Le compte n'est demandé
// qu'au moment de l'envoi. Tarifs et Projets s'ouvrent à part.
// ═════════════════════════════════════════════
const PISTES_CONSOLE = [
  { id: 'lead',     label: 'Voix lead', court: 'Lead',     couleur: '#5BB0FF' },
  { id: 'choeur',   label: 'Chœurs',    court: 'Chœurs',   couleur: '#b388ff' },
  { id: 'choeur2',  label: 'Chœur 2',   court: 'Chœur 2',  couleur: '#d4b8ff' },
  { id: 'choeur3',  label: 'Chœur 3',   court: 'Chœur 3',  couleur: '#9466ff' },
  { id: 'choeur4',  label: 'Chœur 4',   court: 'Chœur 4',  couleur: '#e6d6ff' },
  { id: 'doublage', label: 'Doublage',  court: 'Doublage', couleur: '#00D49A' },
  { id: 'cri',      label: 'Cris',      court: 'Cris',     couleur: '#FF8A3D' },
];
const couleurPiste = (t: string) => PISTES_CONSOLE.find(p => p.id === t)?.couleur || '#A9BEDC';
const chrono = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Calcule la forme d'onde d'un enregistrement (pour dessiner la piste)
async function formeOnde(blob: Blob, barres = 40): Promise<number[]> {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const tampon = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close().catch(() => {});
    const d = tampon.getChannelData(0);
    const pas = Math.max(1, Math.floor(d.length / barres));
    const pics: number[] = [];
    for (let i = 0; i < barres; i++) {
      let max = 0;
      for (let j = i * pas; j < Math.min(d.length, (i + 1) * pas); j += 16) max = Math.max(max, Math.abs(d[j]));
      pics.push(max);
    }
    const haut = Math.max(...pics, 0.01);
    return pics.map(p => Math.max(0.08, p / haut));
  } catch {
    return Array.from({ length: barres }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
  }
}

function MiniOnde({ pics, couleur }: { pics: number[], couleur: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 26, flex: 1, minWidth: 0 }}>
      {pics.map((p, i) => <span key={i} style={{ flex: 1, height: Math.round(p * 100) + '%', borderRadius: 2, background: couleur, opacity: 0.95 }} />)}
    </div>
  );
}

const cssConsole = `
.dz-console{--fond:#0b1a33}
.dz-console *{box-sizing:border-box}
@keyframes dzRec{0%,100%{opacity:1}50%{opacity:.25}}
.dz-rec-point{animation:dzRec 1s infinite}
.dz-piste:active{transform:scale(.99)}
`;

export function StudioConsole({ user, artistName, pleinePage }: { user: any, artistName: string, pleinePage?: boolean }) {
  const [vue, setVue] = useState<'console' | 'projets'>(() =>
    new URLSearchParams(window.location.search).get('vue') === 'projets' || new URLSearchParams(window.location.search).get('paiement') ? 'projets' : 'console');
  const [tarifsOuverts, setTarifsOuverts] = useState(false);
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [projets, setProjets] = useState<any[]>([]);
  const [info, setInfo] = useState('');
  // Prise de voix finale sur l'instru débloquée d'un projet
  const [projetFinal, setProjetFinal] = useState<{ id: string, titre: string } | null>(null);
  const [envoiFinal, setEnvoiFinal] = useState('');
  const ecouteursOk = useRef(false);

  const [beat, setBeat] = useState<{ file: File, url: string, pics: number[] } | null>(null);
  const [prises, setPrises] = useState<(Prise & { pics: number[] })[]>([]);
  const [arme, setArme] = useState('lead');
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const [lecture, setLecture] = useState('');
  const [erreur, setErreur] = useState('');
  const [mode, setMode] = useState<'chanter' | 'existant'>('chanter');
  const [style, setStyle] = useState('');
  const [styleAutre, setStyleAutre] = useState('');
  const [nbChoeurs, setNbChoeurs] = useState(1);
  const [service, setService] = useState<ServiceTitre>('remaster');
  const [titreExistant, setTitreExistant] = useState<{ file: File, url: string, pics: number[] } | null>(null);
  const [prioriteJusqu, setPrioriteJusqu] = useState(0);
  const prioritaire = prioriteJusqu > Date.now();

  const recRef = useRef<MediaRecorder | null>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const lecteurRef = useRef<HTMLAudioElement | null>(null);
  // Lecture par Web Audio : plus fiable sur Android (casques Bluetooth compris)
  // et permet d'entendre tout ce qui est déjà enregistré pendant une nouvelle prise.
  const audioRef = useRef<AudioContext | null>(null);
  const tamponsRef = useRef<Map<string, AudioBuffer>>(new Map());
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const [preparation, setPreparation] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const minuterieRef = useRef<any>(null);
  const debutRef = useRef<number>(0);
  const formatRef = useRef(formatEnregistrement());
  const armeEnCoursRef = useRef('lead');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historiqueRef = useRef<number[]>([]);
  const MAX_SECONDES = 8 * 60;

  // Projets et crédits du compte connecté
  useEffect(() => {
    if (!user?.uid) { setProjets([]); return; }
    const u1 = onSnapshot(query(collection(db, 'studio_projets'), where('uid', '==', user.uid)), snap => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      liste.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setProjets(liste);
    }, () => {});
    const u3 = onSnapshot(doc(db, 'studio_priorite', user.uid), d => setPrioriteJusqu(d.exists() ? (d.data().jusquAuMs || 0) : 0), () => {});
    return () => { u1(); u3(); };
  }, [user?.uid]);

  // Retour de la page de paiement
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('paiement');
    if (p === 'succes') setInfo('Paiement reçu ! Ton projet est débloqué ci-dessous (quelques secondes peuvent être nécessaires).');
    if (p === 'echec') setInfo('Le paiement n\'a pas abouti. Tu peux réessayer.');
  }, []);

  // Onde en direct (dessinée en continu sur le canvas)
  const dessiner = () => {
    const cv = canvasRef.current; if (!cv) return;
    const g = cv.getContext('2d'); if (!g) return;
    const L = cv.width, H = cv.height, h = historiqueRef.current;
    g.clearRect(0, 0, L, H);
    const n = 64, larg = L / n;
    for (let i = 0; i < n; i++) {
      const v = h[h.length - n + i] ?? 0;
      const bh = Math.max(3, v * H * 0.92);
      const grad = g.createLinearGradient(0, H / 2 - bh / 2, 0, H / 2 + bh / 2);
      grad.addColorStop(0, v > 0.9 ? '#ff647c' : couleurPiste(armeEnCoursRef.current));
      grad.addColorStop(1, v > 0.9 ? '#ff2d4d' : '#ffffff55');
      g.fillStyle = grad;
      g.fillRect(i * larg + 1, H / 2 - bh / 2, larg - 2, bh);
    }
  };
  useEffect(() => { historiqueRef.current = []; dessiner(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const libererMicro = () => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(minuterieRef.current);
    fluxRef.current?.getTracks().forEach(t => t.stop());
    fluxRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setNiveau(0);
  };
  const contexteLecture = (): AudioContext => {
    if (!audioRef.current || audioRef.current.state === 'closed') {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new Ctx();
    }
    if (audioRef.current!.state === 'suspended') audioRef.current!.resume().catch(() => {});
    return audioRef.current!;
  };
  const tampon = async (cle: string, url: string): Promise<AudioBuffer> => {
    const deja = tamponsRef.current.get(cle); if (deja) return deja;
    const ctx = contexteLecture();
    const donnees = await (await fetch(url)).arrayBuffer();
    const buf = await new Promise<AudioBuffer>((ok, ko) => { const r = ctx.decodeAudioData(donnees, ok, ko); if (r && (r as any).then) (r as any).then(ok, ko); });
    tamponsRef.current.set(cle, buf);
    return buf;
  };
  const couperLecture = () => {
    sourcesRef.current.forEach(s => { try { s.onended = null; s.stop(); } catch { /* déjà arrêtée */ } });
    sourcesRef.current = [];
    lecteurRef.current?.pause();
  };
  // Joue plusieurs pistes ensemble, calées au même départ
  const jouerEnsemble = (bufs: AudioBuffer[], quandFini?: () => void) => {
    const ctx = contexteLecture();
    const depart = ctx.currentTime + 0.08;
    let plusLongue: AudioBufferSourceNode | null = null, duree = 0;
    bufs.forEach(b => {
      const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(depart);
      sourcesRef.current.push(src);
      if (b.duration > duree) { duree = b.duration; plusLongue = src; }
    });
    if (plusLongue && quandFini) (plusLongue as AudioBufferSourceNode).onended = quandFini;
  };
  useEffect(() => () => { libererMicro(); couperLecture(); audioRef.current?.close().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const demarrer = async () => {
    setErreur('');
    if (!projetFinal && !styleFinal) {
      setErreur('Choisis d\'abord ton style de musique.');
      document.getElementById('dz-style')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const accompagnement = [...(beat ? [{ cle: 'beat:' + beat.url, url: beat.url }] : []), ...prises.map(p => ({ cle: p.id, url: p.url }))];
    if (accompagnement.length && !ecouteursOk.current) {
      if (!confirm('Mets tes écouteurs (filaires de préférence, Bluetooth possible) : tu vas entendre ce qui est déjà enregistré pendant que tu chantes. C\'est fait ?')) return;
      ecouteursOk.current = true;
    }
    couperLecture(); setLecture('');
    // Prépare le retour casque avant d'ouvrir le micro
    let bufsAccomp: AudioBuffer[] = [];
    if (accompagnement.length) {
      setPreparation(true);
      try { bufsAccomp = await Promise.all(accompagnement.map(a => tampon(a.cle, a.url))); }
      catch { bufsAccomp = []; }
      setPreparation(false);
    }
    if (!navigator.mediaDevices?.getUserMedia || !(window as any).MediaRecorder) {
      setErreur('Ce navigateur ne permet pas d\'enregistrer. Utilise Chrome ou Safari à jour.');
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any,
      });
      fluxRef.current = flux;
      historiqueRef.current = [];
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        ctxRef.current = ctx;
        const analyseur = ctx.createAnalyser();
        analyseur.fftSize = 512;
        ctx.createMediaStreamSource(flux).connect(analyseur);
        const tampon = new Uint8Array(analyseur.fftSize);
        let image = 0;
        const boucle = () => {
          analyseur.getByteTimeDomainData(tampon);
          let max = 0;
          for (let i = 0; i < tampon.length; i++) max = Math.max(max, Math.abs(tampon[i] - 128));
          const v = Math.min(1, max / 100);
          if (++image % 3 === 0) { historiqueRef.current.push(v); if (historiqueRef.current.length > 200) historiqueRef.current.shift(); setNiveau(v); }
          dessiner();
          rafRef.current = requestAnimationFrame(boucle);
        };
        boucle();
      } catch { /* l'onde est un plus */ }

      const fmt = formatRef.current;
      const rec = new MediaRecorder(flux, fmt.mime ? { mimeType: fmt.mime, audioBitsPerSecond: 192000 } : undefined);
      morceauxRef.current = [];
      armeEnCoursRef.current = arme;
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) morceauxRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(morceauxRef.current, { type: rec.mimeType || fmt.mime || 'audio/webm' });
        const sec = Math.round((Date.now() - debutRef.current) / 1000);
        libererMicro();
        if (blob.size > 0) {
          const id = Math.random().toString(36).slice(2);
          const type = armeEnCoursRef.current;
          setPrises(ps => [...ps, { id, type, blob, url: URL.createObjectURL(blob), ext: fmt.ext, secondes: sec, pics: [] }]);
          const pics = await formeOnde(blob);
          setPrises(ps => ps.map(p => p.id === id ? { ...p, pics } : p));
        }
      };
      recRef.current = rec;
      // Le beat et les prises déjà faites jouent dans le casque pendant la nouvelle prise
      if (bufsAccomp.length) jouerEnsemble(bufsAccomp);
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
        ? 'Micro refusé. Autorise le micro pour doniel.art dans les réglages, puis réessaie.'
        : 'Micro indisponible : ' + (e?.message || 'erreur inconnue'));
    }
  };

  const arreter = () => {
    couperLecture();
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setEnregistre(false);
  };

  const ecouter = async (id: string, url: string) => {
    if (enregistre) return;
    couperLecture();
    if (lecture === id) { setLecture(''); return; }
    contexteLecture(); // débloqué par le toucher (iPhone)
    setLecture(id);
    try {
      const buf = await tampon(id === 'beat' || id === 'titre' ? id + ':' + url : id, url);
      jouerEnsemble([buf], () => setLecture(l => l === id ? '' : l));
    } catch {
      // Secours : lecteur classique
      const a = lecteurRef.current; if (!a) { setLecture(''); return; }
      a.src = url; a.currentTime = 0; a.onended = () => setLecture('');
      a.play().catch(() => setLecture(''));
    }
  };
  // Tout écouter ensemble (beat + toutes les prises)
  const toutEcouter = async () => {
    if (enregistre) return;
    couperLecture();
    if (lecture === 'tout') { setLecture(''); return; }
    contexteLecture(); setLecture('tout');
    try {
      const pistes = [...(beat ? [{ cle: 'beat:' + beat.url, url: beat.url }] : []), ...prises.map(p => ({ cle: p.id, url: p.url }))];
      const bufs = await Promise.all(pistes.map(p => tampon(p.cle, p.url)));
      jouerEnsemble(bufs, () => setLecture(l => l === 'tout' ? '' : l));
    } catch { setLecture(''); }
  };

  const importerVoix = async (f: File) => {
    const id = Math.random().toString(36).slice(2);
    const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
    setPrises(ps => [...ps, { id, type: arme, blob: f, url: URL.createObjectURL(f), ext, secondes: 0, importe: true, nomFichier: f.name, pics: [] }]);
    const pics = await formeOnde(f);
    setPrises(ps => ps.map(p => p.id === id ? { ...p, pics } : p));
  };
  const importerBeat = async (f: File) => {
    const url = URL.createObjectURL(f);
    setBeat({ file: f, url, pics: [] });
    const pics = await formeOnde(f, 60);
    setBeat(b => b && b.url === url ? { ...b, pics } : b);
  };
  const importerTitreExistant = async (f: File) => {
    if (titreExistant) URL.revokeObjectURL(titreExistant.url);
    const url = URL.createObjectURL(f);
    setTitreExistant({ file: f, url, pics: [] });
    const pics = await formeOnde(f, 60);
    setTitreExistant(t => t && t.url === url ? { ...t, pics } : t);
  };
  const styleFinal = style === 'Autre' ? styleAutre.trim() : style;
  const styleRequis = !projetFinal && (mode === 'chanter' || service === 'remix');
  const serviceActuel: ServiceStudio = mode === 'existant' ? service : (beat ? 'beat' : 'production');

  const chanterSurInstru = async (p: any, instruUrl: string) => {
    setErreur(''); setInfo('');
    try {
      const blob = await (await fetch(instruUrl)).blob();
      const f = new File([blob], 'instru.mp3', { type: blob.type || 'audio/mpeg' });
      prises.forEach(x => URL.revokeObjectURL(x.url)); setPrises([]);
      if (beat) URL.revokeObjectURL(beat.url);
      setMode('chanter'); setProjetFinal({ id: p.id, titre: p.titre || 'Ton titre' }); setVue('console');
      await importerBeat(f);
    } catch { setInfo('Impossible de charger ton instru. Vérifie ta connexion et réessaie.'); }
  };
  const quitterPriseFinale = () => {
    if (prises.length && !confirm('Quitter la prise finale ? Tes prises non envoyées seront perdues.')) return;
    prises.forEach(x => URL.revokeObjectURL(x.url)); setPrises([]);
    if (beat) URL.revokeObjectURL(beat.url);
    setBeat(null); setProjetFinal(null);
  };
  const envoyerVoixFinale = async () => {
    if (!projetFinal || !prises.length) return;
    if (!confirm(`Envoyer ${prises.length} prise${prises.length > 1 ? 's' : ''} comme voix finale de « ${projetFinal.titre} » ?`)) return;
    setErreur('');
    try {
      const pistes: any[] = [];
      for (let i = 0; i < prises.length; i++) {
        const pr = prises[i];
        setEnvoiFinal(`Envoi des voix ${i + 1}/${prises.length}...`);
        const nomF = `${(artistName || 'artiste').replace(/[^a-z0-9]+/gi, '_')}_finale_${pr.type}_${i + 1}.${pr.ext}`;
        pistes.push({ type: pr.type, url: await envoyerAudio(pr.blob, nomF), secondes: pr.secondes, nom: nomF });
      }
      const maintenant = new Date().toISOString();
      await updateDoc(doc(db, 'studio_projets', projetFinal.id), { statut: 'voix_finale', pistesFinales: pistes, voixFinaleLe: maintenant, majLe: maintenant });
      const texte = `Studio${prioritaire ? ' ⚡ PRIORITÉ' : ''} — voix finale reçue pour « ${projetFinal.titre} » (${pistes.length} piste${pistes.length > 1 ? 's' : ''}). À arranger.`;
      envoyerNotification({ to: ADMIN_EMAIL, type: 'studio_admin', text: texte, lien: '/admin?tab=studiovocal' });
      envoyerEmailNotif(ADMIN_EMAIL, 'Studio : voix finale reçue', texte);
      prises.forEach(x => URL.revokeObjectURL(x.url)); setPrises([]);
      if (beat) URL.revokeObjectURL(beat.url);
      setBeat(null); setProjetFinal(null);
      setInfo('Voix finale envoyée ! Le studio fait l\'arrangement final, tu seras notifié.');
      setVue('projets');
    } catch (e: any) { setErreur(e?.message || 'Échec de l\'envoi, réessaie.'); }
    setEnvoiFinal('');
  };
  const ouvrirEnvoi = () => {
    setErreur('');
    if (styleRequis && !styleFinal) { setErreur('Choisis ton style de musique.'); return; }
    setEnvoiOuvert(true);
  };

  const supprimerPrise = (id: string) => {
    if (lecture === id || lecture === 'tout') { couperLecture(); setLecture(''); }
    setPrises(ps => { const p = ps.find(x => x.id === id); if (p) URL.revokeObjectURL(p.url); return ps.filter(x => x.id !== id); });
  };

  // ── Écran Projets ──
  if (vue === 'projets') {
    return (
      <div className="dz-console" style={{ color: C.text }}>
        <style>{cssConsole}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button style={boutonDiscret} onClick={() => { setVue('console'); setInfo(''); }}>← Console</button>
          <span style={{ fontWeight: 900, fontSize: 18 }}>Mes projets</span>
        </div>
        {info && <div style={{ ...carte3D, padding: 12, color: '#bff5e3', fontSize: 13 }}>{info}</div>}
        {!user && <div style={{ ...carte3D, textAlign: 'center', color: C.textSoft, fontSize: 13 }}>Connecte-toi pour voir tes projets.</div>}
        {user && projets.length === 0 && <div style={{ ...carte3D, textAlign: 'center', color: C.textSoft, fontSize: 13 }}>Aucun projet pour l'instant.</div>}
        {projets.map(p => <CarteProjetArtiste key={p.id} p={p} onChanter={chanterSurInstru} />)}
      </div>
    );
  }

  const pret = mode === 'chanter' ? prises.length > 0 && !enregistre : !!titreExistant;
  const infoService = projetFinal ? null : SERVICES_STUDIO[serviceActuel];
  const pistesVisibles = PISTES_CONSOLE.filter(pi => !/^choeur[2-4]$/.test(pi.id) || Number(pi.id.slice(-1)) <= nbChoeurs);

  return (
    <div className="dz-console" style={{ color: C.text, paddingBottom: pleinePage ? 0 : 20 }}>
      <style>{cssConsole}</style>
      <audio ref={lecteurRef} style={{ display: 'none' }} />

      {/* Barre du haut */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, minHeight: 40 }}>
        <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: 3, color: '#cfe2ff' }}>STUDIO</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...boutonDiscret, padding: '7px 12px', fontSize: 12 }} onClick={() => setTarifsOuverts(true)}>Tarifs</button>
          <button style={{ ...boutonDiscret, padding: '7px 12px', fontSize: 12, position: 'relative' }} onClick={() => setVue('projets')}>
            Projets
            {projets.length > 0 && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, background: C.blue, color: '#fff', fontSize: 11 }}>{projets.length}</span>}
          </button>
          {pleinePage && <BoutonProfil />}
        </div>
      </div>

      {projetFinal && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', marginBottom: 12, borderRadius: 16,
          background: 'linear-gradient(150deg,#6b2a10,#2d1206)', border: '1px solid rgba(255,138,61,0.5)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: '#ffd2b0', fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>PRISE DE VOIX FINALE</p>
            <p style={{ margin: '2px 0 0', color: '#fff', fontWeight: 900, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projetFinal.titre}</p>
          </div>
          <button style={{ ...boutonDiscret, padding: '6px 12px', fontSize: 12 }} disabled={enregistre || !!envoiFinal} onClick={quitterPriseFinale}>Quitter</button>
        </div>
      )}

      {/* Chanter / Titre existant */}
      {!projetFinal && <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, marginBottom: 12, background: 'rgba(0,0,0,0.3)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)' }}>
        {([['chanter', 'Chanter'], ['existant', 'Titre existant']] as const).map(([k, l]) => (
          <button key={k} disabled={enregistre} onClick={() => { setMode(k); setErreur(''); couperLecture(); setLecture(''); }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 13,
              background: mode === k ? 'linear-gradient(180deg,#3d9bff,#0a6be0)' : 'transparent', color: mode === k ? '#fff' : C.textSoft,
              boxShadow: mode === k ? '0 3px 0 #0040a0, inset 0 1px 0 rgba(255,255,255,0.3)' : 'none' }}>{l}</button>
        ))}
      </div>}

      {/* Service et prix (Production complète ou Sur ton beat selon qu'un beat est importé) */}
      {infoService && mode === 'chanter' && (
        <p style={{ margin: '0 0 12px', color: C.textSoft, fontSize: 12, lineHeight: 1.5 }}>
          <b style={{ color: '#fff' }}>{infoService.label}</b> · <span style={{ color: C.gold, fontWeight: 900 }}>{fcfa(infoService.fcfa)}</span>
          <br />{beat ? 'Tu chantes sur ton beat, on fait l\'arrangement final.' : 'Chante ta voix témoin : on crée ton instru et tes chœurs, puis tu poses ta voix finale.'}
        </p>
      )}

      {/* Style de musique */}
      {styleRequis && (
        <div id="dz-style" style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', color: styleFinal ? C.textSoft : C.gold, fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>{styleFinal ? 'STYLE SOUHAITÉ' : '1. CHOISIS TON STYLE'}</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {STYLES_MUSIQUE.map(st => (
              <button key={st} onClick={() => { setStyle(st); setErreur(''); }}
                style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                  border: '1px solid ' + (style === st ? 'transparent' : C.border),
                  background: style === st ? 'linear-gradient(180deg,#ffd76a,#e0a915)' : 'rgba(255,255,255,0.05)',
                  color: style === st ? '#3a2a00' : C.textSoft,
                  boxShadow: style === st ? '0 3px 0 #9a7200, inset 0 1px 0 rgba(255,255,255,0.5)' : 'none' }}>{st}</button>
            ))}
          </div>
          {style === 'Autre' && <input style={{ ...champ, marginTop: 8, marginBottom: 0 }} value={styleAutre} onChange={e => setStyleAutre(e.target.value)} placeholder="Précise le style" maxLength={60} />}
        </div>
      )}


      {mode === 'chanter' && <>
      {/* Écran de la console : chrono + onde */}
      <div style={{
        borderRadius: 20, padding: '14px 14px 12px', marginBottom: 14,
        background: 'linear-gradient(180deg,#06122a 0%,#0b1d3d 100%)',
        border: '1px solid rgba(120,170,255,0.25)',
        boxShadow: 'inset 0 2px 14px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: enregistre ? '#ff647c' : '#5f7aa8' }}>
            <span className={enregistre ? 'dz-rec-point' : ''} style={{ width: 9, height: 9, borderRadius: '50%', background: enregistre ? '#ff2d4d' : '#33476b', boxShadow: enregistre ? '0 0 10px #ff2d4d' : 'none' }} />
            {enregistre ? 'REC' : 'PRÊT'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: couleurPiste(enregistre ? armeEnCoursRef.current : arme) }}>
            {PISTES_CONSOLE.find(p => p.id === (enregistre ? armeEnCoursRef.current : arme))?.label}
          </span>
        </div>
        <div style={{ textAlign: 'center', fontFamily: "'DM Mono','SF Mono',Menlo,monospace", fontSize: 46, fontWeight: 700, letterSpacing: 2,
          color: enregistre ? '#fff' : '#9fb6da', textShadow: enregistre ? '0 0 18px rgba(255,80,110,0.55)' : '0 0 14px rgba(90,150,255,0.35)', margin: '4px 0 6px' }}>
          {chrono(enregistre ? secondes : 0)}
        </div>
        <canvas ref={canvasRef} width={640} height={90} style={{ width: '100%', height: 64, display: 'block' }} />
        {enregistre && niveau > 0.9 && <p style={{ margin: '4px 0 0', textAlign: 'center', color: '#ff647c', fontSize: 11, fontWeight: 800 }}>Trop fort, recule un peu</p>}
      </div>

      {/* Pistes */}
      <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, border: '1px solid rgba(120,170,255,0.18)',
        background: 'linear-gradient(180deg,rgba(20,45,90,0.65),rgba(10,26,55,0.65))', boxShadow: '0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        {/* Beat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(120,170,255,0.12)' }}>
          <span style={{ width: 102, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900, color: C.gold }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: C.gold }} />Beat
          </span>
          {beat ? (
            <>
              <button onClick={() => ecouter('beat', beat.url)} disabled={enregistre}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: lecture === 'beat' ? 'rgba(245,200,76,0.28)' : 'rgba(245,200,76,0.12)' }}>
                <span style={{ color: C.gold, fontSize: 12 }}>{lecture === 'beat' ? '❚❚' : '▶'}</span>
                <MiniOnde pics={beat.pics.length ? beat.pics : Array(40).fill(0.15)} couleur={C.gold} />
              </button>
              <button onClick={() => { if (lecture === 'beat' || lecture === 'tout') { couperLecture(); setLecture(''); } URL.revokeObjectURL(beat.url); setBeat(null); }} disabled={enregistre}
                style={{ background: 'none', border: 'none', color: '#8aa0c4', fontSize: 18, cursor: 'pointer', padding: 4 }} aria-label="Retirer le beat">×</button>
            </>
          ) : (
            <label style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px dashed rgba(245,200,76,0.45)', color: '#e9cf86', fontSize: 12, fontWeight: 800, cursor: 'pointer', textAlign: 'center' }}>
              + Importer un beat
              <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importerBeat(f); e.target.value = ''; }} />
            </label>
          )}
        </div>

        {/* Pistes de voix : on touche une piste pour l'armer */}
        {pistesVisibles.map(pi => {
          const estArmee = arme === pi.id;
          const dernierChoeur = pi.id === (nbChoeurs === 1 ? 'choeur' : 'choeur' + nbChoeurs);
          const clips = prises.filter(p => p.type === pi.id);
          return (
            <Fragment key={pi.id}>
            <div className="dz-piste" onClick={() => { if (!enregistre) setArme(pi.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: enregistre ? 'default' : 'pointer',
                borderBottom: '1px solid rgba(120,170,255,0.12)',
                background: estArmee ? `linear-gradient(90deg, ${pi.couleur}26, transparent 70%)` : 'transparent', transition: 'background .2s' }}>
              <span style={{ width: 102, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', color: estArmee ? '#fff' : pi.couleur }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: estArmee ? '#ff2d4d' : 'transparent', border: '2px solid ' + (estArmee ? '#ff2d4d' : pi.couleur),
                  boxShadow: estArmee ? '0 0 8px #ff2d4d' : 'none' }} />
                {pi.id === 'choeur' && nbChoeurs > 1 ? 'Chœur 1' : pi.court}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', minHeight: 36, alignItems: 'center' }}>
                {clips.map((c, i) => (
                  <div key={c.id} onClick={e => { e.stopPropagation(); ecouter(c.id, c.url); }}
                    style={{ flexShrink: 0, width: 118, height: 36, borderRadius: 9, padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 5, position: 'relative', cursor: 'pointer',
                      background: `linear-gradient(180deg, ${pi.couleur}55, ${pi.couleur}22)`, border: '1px solid ' + pi.couleur + (lecture === c.id ? '' : '88'),
                      boxShadow: lecture === c.id ? `0 0 10px ${pi.couleur}` : 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: 10, color: '#fff', fontWeight: 900, width: 12 }}>{lecture === c.id ? '❚❚' : i + 1}</span>
                    <MiniOnde pics={c.pics.length ? c.pics : Array(24).fill(0.2)} couleur="#fff" />
                    <span onClick={e => { e.stopPropagation(); if (!enregistre) supprimerPrise(c.id); }}
                      style={{ position: 'absolute', top: -7, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#0b1a33', border: '1px solid ' + pi.couleur,
                        color: '#fff', fontSize: 12, lineHeight: '15px', textAlign: 'center' }} aria-label="Supprimer">×</span>
                  </div>
                ))}
                {enregistre && armeEnCoursRef.current === pi.id && (
                  <div style={{ flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 9, display: 'flex', alignItems: 'center', border: '1px dashed #ff2d4d', color: '#ff8fa0', fontSize: 11, fontWeight: 900 }}>
                    ● {chrono(secondes)}
                  </div>
                )}
              </div>
            </div>
            {dernierChoeur && nbChoeurs < 4 && !enregistre && (
              <button onClick={() => { setNbChoeurs(n => n + 1); setArme('choeur' + (nbChoeurs + 1)); }}
                style={{ display: 'block', width: 'calc(100% - 24px)', margin: '8px 12px', padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                  border: '1.5px dashed #b388ff', background: 'rgba(179,136,255,0.12)', color: '#e3d4ff', fontSize: 13, fontWeight: 900 }}>
                + Ajouter une voix de chœur ({nbChoeurs + 1}/4)
              </button>
            )}
            </Fragment>
          );
        })}
      </div>

      {(prises.length + (beat ? 1 : 0)) >= 2 && !enregistre && (
        <button onClick={toutEcouter}
          style={{ ...boutonDiscret, width: '100%', marginBottom: 14, fontSize: 13, color: lecture === 'tout' ? '#00D49A' : C.text, borderColor: lecture === 'tout' ? '#00D49A' : C.border }}>
          {lecture === 'tout' ? '❚❚ Arrêter l\'écoute' : '▶ Tout écouter ensemble'}
        </button>
      )}
      {preparation && <p style={{ margin: '0 0 10px', textAlign: 'center', color: C.gold, fontSize: 12, fontWeight: 800 }}>Préparation du retour casque...</p>}

      {/* Transport : importer · enregistrer · écouteurs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 8 }}>
        <label title="Importer une voix déjà enregistrée"
          style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: enregistre ? 'default' : 'pointer',
            background: 'linear-gradient(180deg,#2a4f8a,#173563)', boxShadow: '0 5px 0 #0c2147, 0 10px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)', opacity: enregistre ? 0.4 : 1 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe2ff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
          <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={enregistre} onChange={e => { const f = e.target.files?.[0]; if (f) importerVoix(f); e.target.value = ''; }} />
        </label>

        <button onClick={enregistre ? arreter : demarrer} aria-label={enregistre ? 'Arrêter' : 'Enregistrer'}
          style={{ width: 92, height: 92, borderRadius: '50%', border: '4px solid #2a3d62', cursor: 'pointer',
            background: 'radial-gradient(circle at 35% 30%, #ff8fa0, #ff2d4d 52%, #a50f29)',
            boxShadow: enregistre
              ? `0 0 0 ${6 + Math.round(niveau * 18)}px rgba(255,45,77,0.22), 0 7px 0 #6d0818, 0 16px 30px rgba(0,0,0,0.5)`
              : '0 7px 0 #6d0818, 0 16px 30px rgba(0,0,0,0.5), inset 0 3px 0 rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'box-shadow .08s' }}>
          {enregistre
            ? <span style={{ width: 28, height: 28, borderRadius: 6, background: '#fff' }} />
            : <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15)' }} />}
        </button>

        <span title="Mets tes écouteurs" style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: beat ? 'linear-gradient(180deg,#6a5413,#3f320b)' : 'linear-gradient(180deg,#2a4f8a,#173563)',
          boxShadow: '0 5px 0 #0c2147, 0 10px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={beat ? '#F5C84C' : '#cfe2ff'} strokeWidth="2.2" strokeLinecap="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>
        </span>
      </div>
      <p style={{ textAlign: 'center', margin: '0 0 16px', color: '#7f97bf', fontSize: 11, fontWeight: 700 }}>
        {beat || prises.length ? 'Écouteurs obligatoires : tu entends tes pistes en chantant' : 'Voix lead : pas besoin d\'écouteurs'}
      </p>

      </>}

      {mode === 'existant' && (
        <div style={{ marginBottom: 14 }}>
          {(Object.keys(SERVICES_TITRE) as ServiceTitre[]).map(k => {
            const actif = service === k;
            return (
              <button key={k} onClick={() => setService(k)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', marginBottom: 10, borderRadius: 16, cursor: 'pointer',
                  border: '1px solid ' + (actif ? '#5BB0FF' : 'rgba(120,170,255,0.18)'),
                  background: actif ? 'linear-gradient(160deg,#2a5db0,#173563)' : 'linear-gradient(160deg,rgba(26,65,121,0.7),rgba(11,26,51,0.7))',
                  boxShadow: actif ? '0 0 0 2px rgba(91,176,255,0.35), 0 8px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' : '0 6px 14px rgba(0,0,0,0.25)' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: '2px solid ' + (actif ? '#fff' : '#5f7aa8'),
                  background: actif ? 'radial-gradient(circle,#fff 0 35%,transparent 40%)' : 'transparent' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', color: '#fff', fontWeight: 900, fontSize: 15 }}>{SERVICES_TITRE[k].label}</span>
                  <span style={{ display: 'block', color: C.textSoft, fontSize: 12, marginTop: 2 }}>{SERVICES_TITRE[k].desc}</span>
                </span>
                <span style={{ color: C.gold, fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{fcfa(SERVICES_TITRE[k].fcfa)}</span>
              </button>
            );
          })}
          {titreExistant ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 16, background: 'rgba(8,20,45,0.6)', border: '1px solid rgba(120,170,255,0.25)' }}>
              <button onClick={() => ecouter('titre', titreExistant.url)} aria-label="Écouter"
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', color: '#fff', flexShrink: 0,
                  background: 'linear-gradient(180deg,#3d9bff,#0a6be0)', boxShadow: '0 3px 0 #0040a0' }}>{lecture === 'titre' ? '❚❚' : '▶'}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', color: C.text, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titreExistant.file.name}</p>
                <MiniOnde pics={titreExistant.pics.length ? titreExistant.pics : Array(60).fill(0.15)} couleur="#5BB0FF" />
              </div>
              <button onClick={() => { if (lecture === 'titre') { couperLecture(); setLecture(''); } URL.revokeObjectURL(titreExistant.url); setTitreExistant(null); }}
                style={{ background: 'none', border: 'none', color: '#8aa0c4', fontSize: 20, cursor: 'pointer' }} aria-label="Retirer">×</button>
            </div>
          ) : (
            <label style={{ display: 'block', padding: '22px 14px', borderRadius: 16, border: '2px dashed rgba(91,176,255,0.5)', textAlign: 'center', cursor: 'pointer',
              background: 'rgba(91,176,255,0.06)', color: '#cfe2ff', fontWeight: 900, fontSize: 14 }}>
              + Importer ton titre
              <span style={{ display: 'block', color: C.textSoft, fontSize: 11, fontWeight: 600, marginTop: 4 }}>MP3, WAV, M4A</span>
              <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importerTitreExistant(f); e.target.value = ''; }} />
            </label>
          )}
        </div>
      )}

      {/* Délai : FREE (gratuit, 7 jours et plus) ou FAST (Pack Priorité, 48 h) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { cle: 'free', actif: !prioritaire, titre: 'FREE', ligne1: 'Gratuit', ligne2: DELAI_NORMAL, couleur: '#5BB0FF' },
          { cle: 'fast', actif: prioritaire, titre: '⚡ FAST', ligne1: prioritaire ? 'Actif' : `${fcfa(PACK_PRIORITE.fcfa)} · ${PACK_PRIORITE.mois} mois`, ligne2: DELAI_PRIORITE, couleur: C.gold },
        ].map(o => (
          <button key={o.cle} onClick={() => { if (o.cle === 'fast' && !prioritaire) setTarifsOuverts(true); }}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 16, cursor: o.cle === 'fast' && !prioritaire ? 'pointer' : 'default', textAlign: 'left',
              border: '1.5px solid ' + (o.actif ? o.couleur : C.border),
              background: o.actif ? (o.cle === 'fast' ? 'linear-gradient(160deg,#6a5413,#2d2306)' : 'linear-gradient(160deg,#1d4a8f,#0d2a5a)') : 'rgba(8,20,45,0.45)',
              boxShadow: o.actif ? `0 0 0 2px ${o.couleur}33, 0 8px 18px rgba(0,0,0,0.3)` : 'none', opacity: o.actif ? 1 : 0.8 }}>
            <span style={{ display: 'block', color: o.couleur, fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>{o.titre}</span>
            <span style={{ display: 'block', color: '#fff', fontWeight: 900, fontSize: 18, margin: '2px 0' }}>{o.ligne2}</span>
            <span style={{ display: 'block', color: C.textSoft, fontSize: 11, fontWeight: 700 }}>{o.ligne1}</span>
          </button>
        ))}
      </div>

      {erreur && <p style={{ color: C.alert, fontSize: 13, margin: '0 0 12px', textAlign: 'center' }}>{erreur}</p>}

      {projetFinal ? (
        <button disabled={!prises.length || enregistre || !!envoiFinal} onClick={envoyerVoixFinale}
          style={{ ...bouton3D('#00D49A', '#009a70'), width: '100%', fontSize: 16, padding: '15px 18px', opacity: prises.length && !envoiFinal ? 1 : 0.4 }}>
          {envoiFinal || `Envoyer ma voix finale${prises.length ? ` · ${prises.length} prise${prises.length > 1 ? 's' : ''}` : ''}`}
        </button>
      ) : (
        <button disabled={!pret} onClick={ouvrirEnvoi}
          style={{ ...bouton3D('#00D49A', '#009a70'), width: '100%', fontSize: 16, padding: '15px 18px', opacity: pret ? 1 : 0.4, cursor: pret ? 'pointer' : 'default' }}>
          Envoyer au studio{mode === 'chanter' && prises.length ? ` · ${prises.length} prise${prises.length > 1 ? 's' : ''}` : ''}
        </button>
      )}

      {tarifsOuverts && <FeuilleTarifs user={user} prioriteJusqu={prioriteJusqu} onFermer={() => setTarifsOuverts(false)} />}
      {envoiOuvert && (
        <FeuilleEnvoi user={user} artistName={artistName} beat={mode === 'chanter' ? beat : null} prises={mode === 'chanter' ? prises : []}
          service={serviceActuel} fichier={mode === 'existant' ? titreExistant?.file || null : null}
          style={styleRequis ? styleFinal : ''} prioritaire={prioritaire}
          onFermer={() => setEnvoiOuvert(false)}
          onFini={() => {
            prises.forEach(p => URL.revokeObjectURL(p.url));
            if (mode === 'existant' && titreExistant) { URL.revokeObjectURL(titreExistant.url); setTitreExistant(null); }
            else setPrises([]);
            setEnvoiOuvert(false);
            setInfo(`Projet envoyé. Réponse du studio ${delai(prioritaire)}, tu seras notifié.`);
            setVue('projets');
          }} />
      )}
    </div>
  );
}

// Feuille qui monte du bas de l'écran
function Feuille({ titre, onFermer, children }: { titre: string, onFermer: () => void, children: any }) {
  return (
    <div onClick={onFermer} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(2,8,20,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any,
        borderRadius: '22px 22px 0 0', padding: '10px 18px 28px', color: C.text, textAlign: 'left',
        background: `linear-gradient(180deg, ${C.cardHi}, ${C.bgDeep})`, boxShadow: '0 -12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.25)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 900, fontSize: 18 }}>{titre}</span>
          <button onClick={onFermer} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 24, cursor: 'pointer' }} aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FeuilleTarifs({ user, prioriteJusqu, onFermer }: { user: any, prioriteJusqu: number, onFermer: () => void }) {
  const [achat, setAchat] = useState(false);
  const [erreur, setErreur] = useState('');
  const actif = prioriteJusqu > Date.now();
  const acheter = async () => {
    setErreur(''); setAchat(true);
    try {
      const u = auth.currentUser; if (!u) throw new Error('Connecte-toi d\'abord (icône Profil en haut).');
      const r = await fetch('/api/studio-paiement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formule: 'priorite', idToken: await u.getIdToken() }),
      });
      const d = await r.json();
      if (d.ok && d.url) { window.location.href = d.url; return; }
      throw new Error(d.error || 'Erreur, réessaie.');
    } catch (e: any) { setErreur(e.message || 'Erreur, réessaie.'); }
    setAchat(false);
  };
  const ligne = (label: string, prix: number) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: 8, borderRadius: 14,
      background: 'rgba(8,20,45,0.5)', border: '1px solid ' + C.border, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      <span style={{ fontWeight: 800, fontSize: 14 }}>{label}</span>
      <span style={{ color: C.gold, fontWeight: 900, fontSize: 14 }}>{fcfa(prix)}</span>
    </div>
  );
  const titreSection = (t: string) => <p style={{ margin: '16px 0 8px', color: C.textSoft, fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>{t}</p>;
  return (
    <Feuille titre="Tarifs" onFermer={onFermer}>
      {/* Pack Priorité */}
      <div style={{ padding: 16, borderRadius: 18, background: 'linear-gradient(150deg,#6a5413,#2d2306)', border: '1px solid rgba(245,200,76,0.5)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 16, color: '#ffe7a3' }}>⚡ {PACK_PRIORITE.label}</span>
          <span style={{ fontWeight: 900, fontSize: 16, color: C.gold }}>{fcfa(PACK_PRIORITE.fcfa)}</span>
        </div>
        <p style={{ margin: '6px 0 12px', color: '#f3e2b0', fontSize: 12, lineHeight: 1.5 }}>
          Réponse du studio sous {DELAI_PRIORITE} au lieu de {DELAI_NORMAL}, à chaque étape et pour tous tes projets, pendant {PACK_PRIORITE.mois} mois. Payé une seule fois.
        </p>
        {actif ? (
          <p style={{ margin: 0, color: C.gold, fontWeight: 900, fontSize: 13 }}>Actif jusqu'au {new Date(prioriteJusqu).toLocaleDateString('fr-FR')}</p>
        ) : (
          <button disabled={achat} onClick={acheter}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 14, color: '#3a2a00',
              background: 'linear-gradient(180deg,#ffd76a,#e0a915)', boxShadow: '0 5px 0 #9a7200, inset 0 1px 0 rgba(255,255,255,0.5)' }}>
            {achat ? 'Redirection...' : user ? 'Activer la priorité' : 'Activer (connexion requise)'}
          </button>
        )}
        {erreur && <p style={{ margin: '8px 0 0', color: '#ffb3bf', fontSize: 12 }}>{erreur}</p>}
      </div>

      {titreSection('CHANTER')}
      {ligne(SERVICES_STUDIO.production.label, SERVICES_STUDIO.production.fcfa)}
      <p style={{ margin: '-2px 2px 10px', color: C.textSoft, fontSize: 11, lineHeight: 1.5 }}>Voix témoin → 2 propositions (démo voix IA + instru avec chœurs) → tu paies → tu poses ta voix finale.</p>
      {ligne(SERVICES_STUDIO.beat.label, SERVICES_STUDIO.beat.fcfa)}

      {titreSection('TITRE EXISTANT')}
      {ligne(SERVICES_STUDIO.remaster.label, SERVICES_STUDIO.remaster.fcfa)}
      {ligne(SERVICES_STUDIO.remix.label, SERVICES_STUDIO.remix.fcfa)}

      <p style={{ color: C.textSoft, fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }}>
        Tu écoutes avant de payer (avec la signature Doniel Zik). Après paiement, tu reçois les fichiers propres. Le titre final t'appartient.
      </p>
    </Feuille>
  );
}

function FeuilleEnvoi({ user, artistName, beat, prises, service, fichier, style, prioritaire, onFermer, onFini }: {
  user: any, artistName: string, beat: { file: File } | null, prises: Prise[],
  service: ServiceStudio, fichier: File | null, style: string, prioritaire: boolean,
  onFermer: () => void, onFini: () => void,
}) {
  const [titre, setTitre] = useState(fichier ? fichier.name.replace(/\.[^.]+$/, '').slice(0, 80) : '');
  const [notes, setNotes] = useState('');
  const [accepte, setAccepte] = useState(false);
  const [modeCompte, setModeCompte] = useState<'creer' | 'connexion'>('creer');
  const [nom, setNom] = useState(artistName || '');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [envoi, setEnvoi] = useState('');
  const [erreur, setErreur] = useState('');

  const compte = async (): Promise<any> => {
    if (auth.currentUser) return auth.currentUser;
    const em = email.trim().toLowerCase();
    if (!em || mdp.length < 6) throw new Error('Email et mot de passe (6 caractères minimum) requis.');
    if (modeCompte === 'creer') {
      if (!nom.trim()) throw new Error('Indique ton nom d\'artiste.');
      try {
        const r = await createUserWithEmailAndPassword(auth, em, mdp);
        await updateProfile(r.user, { displayName: nom.trim() }).catch(() => {});
        return r.user;
      } catch (e: any) {
        if (e?.code === 'auth/email-already-in-use') throw new Error('Cet email a déjà un compte : choisis « J\'ai un compte ».');
        throw e;
      }
    }
    try { return (await signInWithEmailAndPassword(auth, em, mdp)).user; }
    catch { throw new Error('Email ou mot de passe incorrect.'); }
  };

  const google = async () => {
    setErreur('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e: any) { setErreur('Connexion Google impossible ici. Utilise ton email.'); }
  };

  const envoyer = async () => {
    setErreur('');
    if (!titre.trim()) { setErreur('Donne un titre à ton morceau.'); return; }
    if (!accepte) { setErreur('Accepte les conditions du Studio pour envoyer.'); return; }
    try {
      setEnvoi('Connexion...');
      const u = await compte();
      const nomArtiste = artistName || u.displayName || nom.trim() || '';
      let beatUrl = '';
      if (beat) { setEnvoi('Envoi du beat...'); beatUrl = await envoyerAudio(beat.file, beat.file.name); }
      let fichierUrl = '';
      if (fichier) { setEnvoi('Envoi de ton titre...'); fichierUrl = await envoyerAudio(fichier, fichier.name); }
      const pistes: any[] = [];
      for (let i = 0; i < prises.length; i++) {
        const pr = prises[i];
        setEnvoi(`Envoi des voix ${i + 1}/${prises.length}...`);
        const nomF = `${(nomArtiste || 'artiste').replace(/[^a-z0-9]+/gi, '_')}_${pr.type}_${i + 1}.${pr.ext}`;
        const url = await envoyerAudio(pr.blob, nomF);
        pistes.push({ type: pr.type, url, secondes: pr.secondes, importe: !!pr.importe, nom: nomF });
      }
      setEnvoi('Enregistrement du projet...');
      const maintenant = new Date().toISOString();
      await addDoc(collection(db, 'studio_projets'), {
        uid: u.uid, email: (u.email || '').toLowerCase(), nomArtiste,
        titre: titre.trim(), style: style.trim(), notes: notes.trim(), service,
        beatUrl, pistes, ...(fichierUrl ? { fichierUrl } : {}),
        // La priorité n'est valable que si le compte avait déjà un Pack Priorité actif
        prioritaire: !!(prioritaire && user && u.uid === user.uid),
        conditionsStudio: { version: VERSION_CONDITIONS, accepteLe: maintenant },
        statut: 'envoye', createdAt: maintenant, majLe: maintenant,
      });
      const detail = service === 'production' || service === 'beat'
        ? `${pistes.length} piste${pistes.length > 1 ? 's' : ''}${beatUrl ? ', avec beat' : ', a cappella'}`
        : libelleService(service);
      const texte = `Studio${prioritaire ? ' ⚡ PRIORITÉ 48 h' : ''} — ${nomArtiste || 'Un utilisateur'} a envoyé « ${titre.trim()} » (${detail}${style ? ', ' + style : ''}).`;
      envoyerNotification({ to: ADMIN_EMAIL, type: 'studio_admin', text: texte, lien: '/admin?tab=studiovocal' });
      envoyerEmailNotif(ADMIN_EMAIL, 'Studio : nouveau projet', texte + '\n\nOuvre l\'admin Doniel Zik → onglet Studio vocal.');
      setEnvoi('');
      onFini();
    } catch (e: any) {
      setErreur(e?.message || 'Échec de l\'envoi. Vérifie ta connexion et réessaie.');
      setEnvoi('');
    }
  };

  const onglet = (actif: boolean): CSSProperties => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
    background: actif ? 'linear-gradient(180deg,#3d9bff,#0a6be0)' : 'transparent', color: actif ? '#fff' : C.textSoft,
  });

  return (
    <Feuille titre="Envoyer au studio" onFermer={() => { if (!envoi) onFermer(); }}>
      <p style={{ margin: '0 0 14px', color: C.textSoft, fontSize: 12 }}>
        {service === 'production' || service === 'beat'
          ? `${prises.length} prise${prises.length > 1 ? 's' : ''}${beat ? ' + beat' : ' · a cappella'}`
          : libelleService(service)}{style ? ' · ' + style : ''}{prioritaire ? ' · ⚡ 48 h' : ''}
      </p>
      <input style={champ} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du morceau *" maxLength={80} />
      <textarea style={{ ...champ, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Consignes (facultatif) : tempo, ambiance, références..." maxLength={1500} />

      {!user && (
        <div style={{ marginTop: 6, padding: 14, borderRadius: 16, background: 'rgba(8,20,45,0.5)', border: '1px solid ' + C.border }}>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14 }}>Ton compte</p>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(0,0,0,0.25)', marginBottom: 12 }}>
            <button style={onglet(modeCompte === 'creer')} onClick={() => setModeCompte('creer')}>Créer un compte</button>
            <button style={onglet(modeCompte === 'connexion')} onClick={() => setModeCompte('connexion')}>J'ai un compte</button>
          </div>
          {modeCompte === 'creer' && <input style={champ} value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom d'artiste" maxLength={60} />}
          <input style={champ} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />
          <input style={{ ...champ, marginBottom: 10 }} type="password" value={mdp} onChange={e => setMdp(e.target.value)} placeholder="Mot de passe" autoComplete={modeCompte === 'creer' ? 'new-password' : 'current-password'} />
          <button style={{ ...boutonDiscret, width: '100%' }} onClick={google}>Continuer avec Google</button>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, cursor: 'pointer', color: C.text, fontSize: 13, lineHeight: 1.5 }}>
        <input type="checkbox" checked={accepte} onChange={e => setAccepte(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: '#00D49A', flexShrink: 0 }} />
        <span>J'accepte les <a href="/conditions-studio" target="_blank" rel="noopener noreferrer" style={{ color: '#5BB0FF', fontWeight: 800 }}>conditions du Studio</a></span>
      </label>

      {erreur && <p style={{ color: C.alert, fontSize: 13, margin: '12px 0 0' }}>{erreur}</p>}
      <button style={{ ...bouton3D('#00D49A', '#009a70'), width: '100%', marginTop: 16, fontSize: 15, opacity: envoi || !accepte ? 0.6 : 1 }} disabled={!!envoi} onClick={envoyer}>
        {envoi || 'Envoyer'}
      </button>
      <p style={{ margin: '10px 0 0', color: C.textSoft, fontSize: 11, textAlign: 'center' }}>
        Réponse {delai(prioritaire)}. Tu écoutes avant de payer.
      </p>
    </Feuille>
  );
}

// Compatibilité : l'onglet Studio du tableau de bord artiste
export function StudioVocalArtiste({ user, artistName }: { user: any, artistName: string }) {
  return <StudioConsole user={user} artistName={artistName} />;
}

// Page /studio-vocal : la console, pour tout le monde (connecté ou non)
export function StudioVocalPresentation() {
  const [user, setUser] = useState<any>(auth.currentUser);
  useEffect(() => auth.onAuthStateChanged(u => setUser(u)), []);
  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at 50% -10%, #2a5db0 0%, ${C.bgDeep} 55%)`, color: C.text, fontFamily: "'DM Sans',sans-serif", padding: '18px 14px 110px', textAlign: 'left' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <StudioConsole user={user} artistName={user?.displayName || ''} pleinePage />
      </div>
      <NavBas />
    </div>
  );
}

// ═════════════════════════════════════════════
// PAGE /conditions-studio — conditions acceptées avant chaque envoi
// ═════════════════════════════════════════════
export function ConditionsStudioPage() {
  const sections: [string, string[]][] = [
    ['1. Le service', [
      'Production complète : tu enregistres une voix témoin, l\'équipe crée ton instru et tes chœurs et te fait des propositions. Après paiement, tu reçois l\'instru, tu enregistres ta voix finale, et l\'équipe réalise l\'arrangement final.',
      'Sur ton beat, remastering, remixage : l\'équipe prépare ton titre, tu l\'écoutes, puis tu paies pour le télécharger.',
      'Le Studio s\'utilise sur doniel.art et dans l\'application Doniel Zik.',
    ]],
    ['2. Ta voix et tes paroles', [
      'Tu garantis que les voix envoyées sont les tiennes, ou celles de personnes qui t\'ont donné leur accord.',
      'Tu garantis être l\'auteur des paroles et de la musique envoyées, ou avoir l\'autorisation de les utiliser.',
    ]],
    ['3. Reprises et droits d\'auteur', [
      'Reprendre la chanson d\'un autre artiste demande l\'accord de ses ayants droit (en Côte d\'Ivoire : le BURIDA). Cette démarche est sous ta responsabilité.',
      'Doniel Zik peut refuser un projet qui semble utiliser l\'œuvre d\'un tiers sans autorisation.',
    ]],
    ['4. Intelligence artificielle', [
      'La musique est produite par notre équipe avec l\'aide d\'outils d\'intelligence artificielle, autour de ta vraie voix.',
    ]],
    ['5. À qui appartient le titre', [
      'Le titre final t\'appartient entièrement, une fois payé.',
      'Doniel Zik n\'utilise pas ton titre sans ton accord écrit. Nous gardons les fichiers uniquement pour réaliser et te livrer le service.',
      'Avant paiement, tout ce que tu écoutes porte la signature sonore Doniel Zik. Après paiement, tu reçois les fichiers sans signature.',
    ]],
    ['6. Délais', [
      'FAST (Pack Priorité) : réponse du studio sous 48 h à chaque étape. FREE (sans le pack) : 7 jours et plus.',
      'Ces délais sont indicatifs et peuvent être dépassés en cas de force majeure (panne, coupure, événement imprévu).',
      'Le Pack Priorité est payé une seule fois et dure 3 mois à partir du paiement. Il n\'est pas remboursable.',
    ]],
    ['7. Paiement', [
      'Les prix sont ceux affichés dans le Studio au moment du paiement. Le paiement se fait en ligne, à l\'unité, après écoute.',
      'Une fois le titre final livré, le paiement n\'est pas remboursable.',
    ]],
    ['8. Contenus refusés', [
      'Nous refusons les contenus haineux, injurieux, violents, à caractère sexuel, ou qui imitent la voix d\'une personne sans son accord.',
    ]],
    ['9. Tes fichiers', [
      'Tes enregistrements servent uniquement à réaliser ton projet. Tu peux demander leur suppression à tout moment.',
    ]],
  ];
  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at 50% -10%, #2a5db0 0%, ${C.bgDeep} 55%)`, color: C.text, fontFamily: "'DM Sans',sans-serif", padding: '24px 18px 60px', textAlign: 'left' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <a href="/studio-vocal" style={{ color: C.textSoft, fontSize: 13, textDecoration: 'none' }}>← Studio</a>
        <h1 style={{ margin: '18px 0 4px', fontSize: 26, fontWeight: 900, letterSpacing: 0, color: '#fff' }}>Conditions du Studio</h1>
        <p style={{ margin: '0 0 20px', color: C.textSoft, fontSize: 12 }}>Version du {new Date(VERSION_CONDITIONS).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {sections.map(([t, ps]) => (
          <div key={t} style={{ ...carte3D, padding: 16, marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 15, color: '#fff' }}>{t}</p>
            {ps.map((p, i) => <p key={i} style={{ margin: i ? '8px 0 0' : 0, color: '#dbe8ff', fontSize: 13, lineHeight: 1.65 }}>{p}</p>)}
          </div>
        ))}
        <p style={{ color: C.textSoft, fontSize: 12, lineHeight: 1.6, marginTop: 16 }}>
          Une question ? Écris-nous depuis la page Contact de Doniel Zik.
        </p>
      </div>
    </div>
  );
}
