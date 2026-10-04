// ─────────────────────────────────────────────
// COMPOSANTS PARTAGÉS (étape 2 du découpage) — petits composants autonomes
// et éléments associés (modales, textes juridiques, hooks de devise...).
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, onSnapshot, query, where, limit,
} from 'firebase/firestore';
import {
  GoogleAuthProvider, signInWithPopup, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { C, S, LOGO_B64, demanderResetPassword } from '../lib/utils';

// Lien WhatsApp cliquable réutilisable
export function WhatsAppLink({ numero, size = 11 }: { numero: string, size?: number }) {
  if (!numero) return null;
  const clean = (numero || '').replace(/[^0-9]/g, '');
  return (
    <a href={`https://wa.me/${clean}`} target="_blank" rel="noopener noreferrer"
      style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#25D366', fontSize:size, fontWeight:700, textDecoration:'none' }}>
      <svg width={size+2} height={size+2} viewBox="0 0 24 24" fill="#25D366"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.961z"/></svg>
      {numero}
    </a>
  );
}

// ─────────────────────────────────────────────
// TEXTES JURIDIQUES
// ─────────────────────────────────────────────
export const CONTRAT_COMMERCIAL = [
  { t: "Article 1 — Objet", c: "Le présent contrat définit les conditions dans lesquelles l'Apporteur fait la promotion de la plateforme Doniel Zik et recrute des artistes et des annonceurs, en ligne et sur le terrain." },
  { t: "Article 2 — Statut", c: "L'Apporteur agit en qualité d'apporteur d'affaires indépendant. Le présent contrat ne crée aucun lien de subordination ni de salariat. L'Apporteur n'est pas un employé de la Société et organise librement son activité." },
  { t: "Article 3 — Mission", c: "L'Apporteur présente la plateforme aux artistes et les enregistre avec leur contenu, recrute des annonceurs pour la publicité, et accompagne les artistes recrutés afin qu'ils deviennent actifs." },
  { t: "Article 4 — Rémunération", c: "La rémunération est exclusivement basée sur les résultats : 10 000 FCFA par artiste actif (au moins 5 000 vues, 30 téléchargements, 2 000 cadeaux ou 1 000 partages) ; 10 % du chiffre d'affaires publicité des annonceurs recrutés ; et une prime résiduelle mensuelle sur l'activité continue des artistes recrutés, tant qu'ils restent actifs, selon les conditions en vigueur." },
  { t: "Article 5 — Conditions de paiement", c: "Les sommes dues sont calculées et versées selon les modalités et la périodicité définies par la Société. Aucun paiement n'est dû pour un artiste qui n'atteint pas le statut d'actif." },
  { t: "Article 6 — Obligations", c: "L'Apporteur s'engage à représenter la plateforme avec honnêteté, à ne faire aucune promesse mensongère, à ne recruter que de vrais artistes et annonceurs, et à respecter l'image de la Société." },
  { t: "Article 7 — Confidentialité", c: "L'Apporteur s'engage à ne divulguer aucune information interne, méthode, donnée ou outil de la Société. Les QR codes de duplication et données privées restent strictement confidentiels." },
  { t: "Article 8 — Durée et résiliation", c: "Le contrat prend effet à la validation du compte et reste valable tant que l'activité se poursuit. Chaque partie peut y mettre fin à tout moment. Les commissions acquises avant la rupture restent dues." },
  { t: "Article 9 — Droit applicable", c: "Le présent contrat est régi par le droit en vigueur en Côte d'Ivoire." },
];

// Contrat de production musicale (single) — 10 articles
export const CONTRAT_PRODUCTION = [
  { t: "Article 1 — Objet", c: "Le présent contrat définit les conditions dans lesquelles la Société Doniel Zik (BDE SARL) réalise la production d'un single musical au profit de l'Artiste, comprenant l'enregistrement studio, la création de pochettes, la publication et la promotion." },
  { t: "Article 2 — Contenu de la prestation", c: "La production comprend : l'enregistrement d'un single en studio, la fourniture de 100 pochettes physiques avec QR code, la publication du titre sur la plateforme Doniel Zik, la réalisation d'un clip et une action de promotion télévisée." },
  { t: "Article 3 — Engagement de l'Artiste", c: "L'Artiste s'engage à être présent aux séances d'enregistrement et de tournage convenues, à fournir les éléments nécessaires (paroles, mélodies, éléments visuels) et à collaborer de bonne foi à la bonne réalisation de la production." },
  { t: "Article 4 — Modalités financières", c: "Le montant et les modalités de paiement de la production sont convenus séparément entre l'Artiste et la Société, en dehors de la plateforme. La présente inscription en ligne vaut engagement et sert au suivi du dossier ; elle ne constitue pas un paiement." },
  { t: "Article 5 — Droits sur l'œuvre", c: "L'Artiste conserve la propriété de son œuvre. Il autorise la Société à publier, diffuser et promouvoir le single produit sur la plateforme Doniel Zik et ses canaux de promotion, dans le cadre de la présente production." },
  { t: "Article 6 — Activités de valorisation", c: "L'Artiste est informé que la plateforme propose des activités de valorisation de sa musique, notamment les challenges réalisés par les mélomanes et le partage sur les réseaux sociaux, qui contribuent à la diffusion et à la rémunération de son œuvre." },
  { t: "Article 7 — Rémunération de l'Artiste", c: "L'Artiste perçoit une rémunération lorsque sa musique est utilisée sur la plateforme, y compris lorsqu'un mélomane réalise un challenge sur son titre et que ce challenge reçoit des cadeaux (kiffements), selon les conditions de répartition en vigueur." },
  { t: "Article 8 — Délais", c: "Les délais de réalisation de chaque étape (enregistrement, pochettes, clip, publication, promotion) sont communiqués à l'Artiste et peuvent varier selon les disponibilités techniques et la collaboration de l'Artiste." },
  { t: "Article 9 — Obligations de la Société", c: "La Société s'engage à réaliser la production avec sérieux et professionnalisme, à tenir l'Artiste informé de l'avancement, et à respecter l'intégrité artistique de l'œuvre." },
  { t: "Article 10 — Durée et droit applicable", c: "Le présent contrat prend effet à sa signature et court jusqu'à la livraison complète de la production. Il est régi par le droit en vigueur en Côte d'Ivoire. Tout litige sera réglé à l'amiable en priorité." },
];

export const CONDITIONS_ARTISTE = [
  { t: "1. Votre contenu vous appartient", c: "Vous déclarez être l'auteur ou le détenteur des droits du contenu enregistré. Vous devez figurer dans ce contenu (featuring accepté). Tout contenu plagié ou ne vous appartenant pas est interdit et sera retiré." },
  { t: "2. Autorisation de diffusion", c: "Vous autorisez Doniel Zik à héberger, diffuser, faire écouter, télécharger et promouvoir votre contenu sur la plateforme et via les liens et QR codes publics générés." },
  { t: "3. Revenus et répartition", c: "Votre contenu vous rapporte selon les règles de la plateforme : sur chaque téléchargement, une part vous revient et une part revient à la plateforme ; sur chaque cadeau (kiffement), une part vous revient et une part revient à la plateforme ; vous percevez une part des revenus publicitaires liés aux vues. Les pourcentages appliqués sont ceux en vigueur." },
  { t: "4. Validation et modération", c: "Tout contenu enregistré est soumis à validation avant publication. La plateforme se réserve le droit de refuser ou retirer tout contenu non conforme (qualité, plagiat, contenu interdit)." },
  { t: "5. Monnaie Oscart", c: "Les transactions sur la plateforme utilisent l'Oscart. En tant qu'artiste, vos revenus sont comptés en Oscart : vous pouvez les utiliser sur la plateforme (notamment pour enregistrer vos contenus) ou demander leur retrait selon les modalités en vigueur. L'Oscart ne peut pas être transféré entre membres." },
  { t: "6. QR codes", c: "Vous recevez un lien public et un QR code public à partager. Les QR codes de duplication à scan limité restent gérés par la plateforme." },
  { t: "7. Comportement", c: "Doniel Zik est une plateforme professionnelle, pas un réseau social. Tout usage détourné, frauduleux ou nuisible entraîne la suspension du compte." },
  { t: "8. Droit applicable", c: "Les présentes conditions sont régies par le droit en vigueur en Côte d'Ivoire." },
];

// Modal d'affichage d'un document juridique
export function DocumentLegalModal({ titre, articles, onClose }: { titre: string, articles: {t:string,c:string}[], onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9995, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:16, maxWidth:560, width:'100%', maxHeight:'85vh', overflowY:'auto', padding:24 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily:'serif', fontSize:19, fontWeight:800, color:'#1a2340', marginBottom:16 }}>{titre}</h2>
        {articles.map((a,i) => (
          <div key={i} style={{ marginBottom:14 }}>
            <p style={{ fontWeight:700, fontSize:13, color:'#1a6bff', margin:'0 0 4px' }}>{a.t}</p>
            <p style={{ fontSize:13, color:'#3a4860', lineHeight:1.6, margin:0 }}>{a.c}</p>
          </div>
        ))}
        <button onClick={onClose} style={{ ...S.btn, width:'100%', padding:12, marginTop:8 }}>Fermer</button>
      </div>
    </div>
  );
}

// Option 3 : l'admin envoie un lien de réinitialisation à un utilisateur
export function BoutonResetAdmin({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false);
  if (!email) return null;
  return (
    <button onClick={async (e) => {
      e.stopPropagation();
      try { const r = await demanderResetPassword(email); if (r.ok) { setSent(true); setErr(false); } else { setErr(true); } }
      catch { setErr(true); }
    }} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:8, border:`1px solid ${sent?'#00a040':err?'#f04a6a':'#dce6f7'}`, background: sent?'#eafff2':'#fff', color: sent?'#00a040':err?'#f04a6a':'#5a7090', fontSize:11, fontWeight:600, cursor:'pointer', marginTop:6 }}>
      {sent ? 'Lien envoyé' : err ? 'Erreur' : 'Réinitialiser mot de passe'}
    </button>
  );
}

// Option 2 : l'utilisateur connecté change son propre mot de passe
export function ChangerMotDePasse() {
  const [open, setOpen] = useState(false);
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirme, setConfirme] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const changer = async () => {
    setMsg('');
    if (nouveau.length < 6) { setMsg('Le nouveau mot de passe doit faire au moins 6 caractères'); return; }
    if (nouveau !== confirme) { setMsg('Les deux mots de passe ne correspondent pas'); return; }
    const u = auth.currentUser;
    if (!u || !u.email) { setMsg('Vous devez être connecté'); return; }
    setLoading(true);
    try {
      // Ré-authentifier avec l'ancien mot de passe (exigé par Firebase)
      const cred = EmailAuthProvider.credential(u.email, ancien);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, nouveau);
      setMsg('Mot de passe modifié avec succès');
      setAncien(''); setNouveau(''); setConfirme('');
      setTimeout(() => setOpen(false), 1500);
    } catch(e:any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') setMsg('Ancien mot de passe incorrect');
      else setMsg('Erreur : ' + (e.message || e.code));
    }
    setLoading(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid #dce6f7', background:'#fff', color:'#1a6bff', fontWeight:700, fontSize:13, cursor:'pointer', marginTop:10 }}>
      Changer mon mot de passe
    </button>
  );

  return (
    <div style={{ background:'#f5f8ff', border:'1px solid #dce6f7', borderRadius:12, padding:16, marginTop:10 }}>
      <p style={{ fontWeight:700, fontSize:14, color:'#1a2340', margin:'0 0 12px' }}>Changer mon mot de passe</p>
      <input type="password" placeholder="Mot de passe actuel" value={ancien} onChange={e => setAncien(e.target.value)} style={S.inp} />
      <input type="password" placeholder="Nouveau mot de passe (min. 6 caractères)" value={nouveau} onChange={e => setNouveau(e.target.value)} style={S.inp} />
      <input type="password" placeholder="Confirmer le nouveau mot de passe" value={confirme} onChange={e => setConfirme(e.target.value)} style={S.inp} />
      {msg && <p style={{ color: msg.startsWith('') ? '#00a040' : '#f04a6a', fontSize:12, margin:'8px 0' }}>{msg}</p>}
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button onClick={changer} disabled={loading} style={{ ...S.btn, flex:2, padding:11 }}>{loading ? '...' : 'Valider'}</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} style={{ ...S.btn2, flex:1, padding:11 }}>Annuler</button>
      </div>
    </div>
  );
}
export const cleanName = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
export const formatTime = (t: number) => { if (!t || isNaN(t)) return '0:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

// ─────────────────────────────────────────────
// LOGO COMPONENT
// ─────────────────────────────────────────────
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { img: 38 }, md: { img: 54 }, lg: { img: 100 } };
  const d = sizes[size];
  return (
    <div style={{ textAlign: 'center' }}>
      <img src={LOGO_B64} alt="Doniel Zik" style={{ width: d.img, height: d.img, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
      {size === 'lg' && <p style={{ color: '#3a6090', fontSize: 11, marginTop: 4, letterSpacing: 3, fontWeight: 600 }}>La Musique. Un Scan. Un Monde.</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// SPECTROGRAMME CSS PUR — 7 barres animées
// S'anime quand playing=true, s'immobilise sinon
// ─────────────────────────────────────────────
export function Spectrogram({ playing }: { playing: boolean }) {
  // 7 barres avec durées et délais différents pour un rendu organique
  const bars = [
    { anim: 'sp1', dur: '0.55s', delay: '0s' },
    { anim: 'sp2', dur: '0.40s', delay: '0.08s' },
    { anim: 'sp3', dur: '0.70s', delay: '0.16s' },
    { anim: 'sp4', dur: '0.45s', delay: '0.05s' },
    { anim: 'sp5', dur: '0.60s', delay: '0.20s' },
    { anim: 'sp6', dur: '0.38s', delay: '0.12s' },
    { anim: 'sp7', dur: '0.52s', delay: '0.03s' },
  ];
  return (
    <>
      <style>{`
        @keyframes sp1{0%,100%{height:6px}50%{height:32px}}
        @keyframes sp2{0%,100%{height:18px}50%{height:6px}}
        @keyframes sp3{0%,100%{height:28px}25%{height:8px}75%{height:38px}}
        @keyframes sp4{0%,100%{height:10px}40%{height:36px}80%{height:5px}}
        @keyframes sp5{0%,100%{height:22px}30%{height:5px}70%{height:30px}}
        @keyframes sp6{0%,100%{height:8px}50%{height:40px}}
        @keyframes sp7{0%,100%{height:30px}25%{height:6px}75%{height:18px}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 44 }}>
        {bars.map((b, i) => (
          <div key={i} style={{
            width: 5,
            borderRadius: 99,
            background: 'linear-gradient(to top, #1e6fff, #7dc8ff)',
            minHeight: 5,
            maxHeight: 44,
            height: playing ? undefined : 5,
            animation: playing ? `${b.anim} ${b.dur} ease-in-out ${b.delay} infinite alternate` : 'none',
            opacity: playing ? 1 : 0.25,
            transition: 'opacity 0.3s',
            boxShadow: playing ? '0 0 6px rgba(30,111,255,0.6)' : 'none',
          }} />
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// LOGIN MODAL — connexion rapide depuis FanPage
// ─────────────────────────────────────────────
export function LoginModal({ onClose, message }: { onClose: () => void, message: string }) {
  const loginGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch(e:any) {
      if (e.code !== 'auth/popup-closed-by-user') alert('Erreur connexion');
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480, animation:'tutoSlide .3s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:40, height:4, borderRadius:99, background:'#dce6f7', margin:'0 auto 20px' }} />
        <p style={{ fontWeight:800, fontSize:17, color:'#1a2340', textAlign:'center', marginBottom:8 }}>{message}</p>
        <p style={{ color:'#8098b8', fontSize:13, textAlign:'center', marginBottom:24, lineHeight:1.6 }}>
          Créez votre Zikothèque gratuite pour interagir avec vos artistes préférés.
        </p>
        <button onClick={loginGoogle}
          style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid #dce6f7', background:'#fff', color:'#1a2340', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuer avec Google
        </button>
        <a href="/ziko" style={{ display:'block', width:'100%', padding:12, borderRadius:12, border:'1px solid #dce6f7', background:'transparent', color:'#1a6bff', fontWeight:600, fontSize:14, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
          Créer mon compte avec email
        </a>
      </div>
    </div>
  );
}

// Sélecteur devise pour la recharge
export function RechargeDeviseSelector({ fcfa }: { fcfa: number }) {
  const [devise, setDevise] = useState<'fcfa'|'eur'|'usd'>('fcfa');
  const montant = devise === 'fcfa' ? `${fcfa.toLocaleString()} F CFA`
    : devise === 'eur' ? `${(fcfa * 0.0015).toFixed(2)} €`
    : `${(fcfa * 0.0016).toFixed(2)} $`;
  return (
    <>
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:12 }}>
        {(['fcfa','eur','usd'] as const).map(d => (
          <button key={d} onClick={() => setDevise(d)}
            style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${devise===d?'#ffd700':'rgba(255,255,255,0.1)'}`, background:devise===d?'rgba(255,215,0,0.15)':'transparent', color:devise===d?'#ffd700':'rgba(255,255,255,0.4)', fontSize:11, cursor:'pointer' }}>
            {d === 'fcfa' ? 'F CFA' : d === 'eur' ? '€' : '$'}
          </button>
        ))}
      </div>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, textAlign:'center', marginBottom:20 }}>
        Montant : <strong style={{ color:'#ffd700' }}>{montant}</strong>
      </p>
    </>
  );
}

// ─────────────────────────────────────────────
// SIGNATURES ARTISTE — ce que l'artiste peut offrir
// ─────────────────────────────────────────────
export const SIGNATURES = [
  { id:"dedicace", label:"Dédicace vidéo", desc:"Une vidéo personnalisée rien que pour vous", color:"#f04a6a", image:"/signatures/dedicace.png", detail:"L'artiste enregistre une vidéo personnalisée où il cite votre nom, vous remercie pour votre soutien et vous adresse un message rien que pour vous." },
  { id:"vip", label:"Accès VIP", desc:"Entrée gratuite, coulisses et rencontre avec l'artiste", color:"#ffd700", image:"/signatures/vip.png", detail:"Vous bénéficiez d'une entrée gratuite à un concert ou une prestation de l'artiste, avec un accès aux coulisses et une rencontre en personne avec lui." },
  { id:"clip", label:"Dans son clip", desc:"Vous intégrez le clip de l'artiste", color:"#00c853", image:"/signatures/clip.png", detail:"Vous intégrez le clip de l'artiste : votre présence, votre danse ou votre challenge sont intégrés dans son prochain clip ou vidéo." },
  { id:"spot", label:"Signature Spot", desc:"Votre nom chanté dans une prochaine musique", color:"#F5C84C", image:"/signatures/spot.png", detail:"Votre nom est cité et chanté dans une prochaine musique de l'artiste. Vous entrez dans son œuvre, réservée à ceux qui offrent le plus de kiffements." },
];

export function SignatureShowcase({ onClose }: { onClose: () => void }) {
  const [selSig, setSelSig] = useState<typeof SIGNATURES[0] | null>(null);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9995 }}
      onClick={onClose}>
      <div style={{ position:'fixed', left:'50%', bottom:90, transform:'translateX(-50%)', background:C.bgSecond, border:'1px solid '+C.border, borderRadius:18, padding:'16px 16px 18px', width:'92%', maxWidth:440, maxHeight:'62vh', overflowY:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.6)', animation:'bandUp .25s ease-out' }}
        onClick={e => e.stopPropagation()}>
        <style>{`@keyframes bandUp{0%{opacity:0;transform:translate(-50%,20px)}100%{opacity:1;transform:translate(-50%,0)}} @keyframes sigFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes sigPageIn{0%{opacity:0;transform:scale(0.95)}100%{opacity:1;transform:scale(1)}}`}</style>
        <p style={{ fontWeight:900, fontSize:16, color:C.text, textAlign:'center', marginBottom:4 }}>
          Envoyez des kiffements
        </p>
        <p style={{ color:C.textSoft, fontSize:12, textAlign:'center', marginBottom:16 }}>
          Votre artiste peut vous offrir une signature en retour — appuyez pour découvrir
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
          {SIGNATURES.map((s, si) => (
            <div key={s.id} onClick={() => setSelSig(s)} style={{
              background:`linear-gradient(135deg,${s.color}22,${s.color}11)`,
              border:`1px solid ${s.color}44`,
              borderRadius:14, padding:'12px 6px', textAlign:'center', cursor:'pointer',
            }}>
              <div style={{ marginBottom:6, animation:`sigFloat 3s ease-in-out ${si*0.2}s infinite` }}><img src={s.image} alt={s.label} style={{ width:44, height:44, objectFit:'contain' }} /></div>
              <p style={{ fontWeight:800, fontSize:11, color:C.text, margin:'0 0 2px' }}>{s.label}</p>
              <p style={{ color:C.textSoft, fontSize:9, lineHeight:1.4, margin:0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ background:'rgba(10,132,255,0.12)', border:'1px solid rgba(10,132,255,0.3)', borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
          <p style={{ color:C.blueLite, fontSize:12, fontWeight:600, textAlign:'center', margin:0 }}>
            Plus vous envoyez de kiffements, plus vos chances d'obtenir une signature augmentent
          </p>
        </div>
        <button onClick={onClose}
          style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
          Envoyer un kiffement maintenant
        </button>
      </div>

      {/* GRANDE PAGE 9:16 — détail d'une signature au clic */}
      {selSig && (
        <div onClick={() => setSelSig(null)}
          style={{ position:'fixed', inset:0, background:'rgba(5,12,28,0.92)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position:'relative', width:'100%', maxWidth:380, aspectRatio:'9/16', maxHeight:'90vh', borderRadius:24, overflow:'hidden', background:`linear-gradient(165deg, ${selSig.color}33 0%, ${C.bgDeep} 55%, ${C.bgDeep} 100%)`, border:`1px solid ${selSig.color}55`, boxShadow:`0 20px 60px rgba(0,0,0,0.7), 0 0 80px ${selSig.color}22`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', animation:'sigPageIn .3s ease-out' }}>
            {/* Bouton fermer */}
            <button onClick={() => setSelSig(null)}
              style={{ position:'absolute', top:14, right:14, width:34, height:34, borderRadius:99, border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>

            {/* Glow + illustration */}
            <div style={{ position:'relative', marginBottom:28 }}>
              <div style={{ position:'absolute', inset:'-30%', background:`radial-gradient(circle, ${selSig.color}55, transparent 70%)`, filter:'blur(20px)' }} />
              <img src={selSig.image} alt={selSig.label} style={{ position:'relative', width:170, height:170, objectFit:'contain', filter:`drop-shadow(0 10px 30px ${selSig.color}88)` }} />
            </div>

            {/* Titre */}
            <p style={{ color:'#fff', fontWeight:900, fontSize:26, textAlign:'center', margin:'0 0 6px', letterSpacing:0.5 }}>{selSig.label}</p>
            <div style={{ width:50, height:3, borderRadius:99, background:selSig.color, marginBottom:18 }} />

            {/* Texte explicatif */}
            <p style={{ color:C.text, fontSize:15, lineHeight:1.6, textAlign:'center', margin:0, opacity:0.95 }}>{selSig.detail}</p>

            {/* Bas : comment l'obtenir */}
            <div style={{ marginTop:'auto', paddingTop:24, width:'100%' }}>
              <div style={{ background:'rgba(245,200,76,0.12)', border:'1px solid rgba(245,200,76,0.3)', borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
                <p style={{ color:C.gold, fontSize:13, fontWeight:700, margin:0 }}>
                  Envoyez un maximum de kiffements à votre artiste pour avoir la chance de recevoir cette signature !
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SYSTÈME COINS — recharge + kiffements
// ─────────────────────────────────────────────

// Helper Cloudinary — optimisation automatique
export const optimizeCloudinaryUrl = (url: string, opts = 'f_auto,q_auto,w_400') => {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', '/upload/' + opts + '/');
};

// 1 Oscart = 10 F CFA = 0.015 € = 0.016 $
export const OSCART_TO_FCFA = 10;
export const OSCART_TO_EUR = 0.015;
export const OSCART_TO_USD = 0.016;

// ── DEVISES LOCALES (affichage indicatif à la recharge) ──
// FCFA est la base : 1 Oscart = 10 FCFA. Les autres devises sont converties via le taux du jour.
export const DEVISE_PAR_PAYS: Record<string, string> = {
  CI:'XOF', SN:'XOF', BF:'XOF', ML:'XOF', NE:'XOF', TG:'XOF', BJ:'XOF', GW:'XOF',
  CM:'XAF', GA:'XAF', CG:'XAF', TD:'XAF', CF:'XAF', GQ:'XAF',
  GH:'GHS', NG:'NGN', KE:'KES', ZA:'ZAR', MA:'MAD', DZ:'DZD', TN:'TND', EG:'EGP',
  CD:'CDF', GN:'GNF', RW:'RWF', UG:'UGX', TZ:'TZS', ET:'ETB', AO:'AOA',
  FR:'EUR', BE:'EUR', DE:'EUR', ES:'EUR', IT:'EUR', PT:'EUR',
  US:'USD', CA:'CAD', GB:'GBP', CH:'CHF',
};
export const INFO_DEVISE: Record<string, { sym: string, dec: number }> = {
  XOF:{ sym:'F CFA', dec:0 }, XAF:{ sym:'FCFA', dec:0 }, GHS:{ sym:'GH', dec:2 },
  NGN:{ sym:'', dec:0 }, KES:{ sym:'KSh', dec:0 }, ZAR:{ sym:'R', dec:2 },
  MAD:{ sym:'DH', dec:2 }, DZD:{ sym:'DA', dec:0 }, TND:{ sym:'DT', dec:2 }, EGP:{ sym:'E', dec:2 },
  CDF:{ sym:'FC', dec:0 }, GNF:{ sym:'FG', dec:0 }, RWF:{ sym:'FRw', dec:0 }, UGX:{ sym:'USh', dec:0 },
  TZS:{ sym:'TSh', dec:0 }, ETB:{ sym:'Br', dec:2 }, AOA:{ sym:'Kz', dec:0 },
  EUR:{ sym:'', dec:2 }, USD:{ sym:'$', dec:2 }, CAD:{ sym:'C$', dec:2 }, GBP:{ sym:'', dec:2 }, CHF:{ sym:'CHF', dec:2 },
};

// ── RÉMUNÉRATION KIFS — paliers de récompenses par défaut (configurables depuis l'admin) ──
// Règle : 100 kifs = 1 FCFA. Cette rémunération s'ajoute aux autres revenus de l'artiste.
export const PALIERS_CONCOURS_DEFAUT = [
  { kifs: 10000000,   type: 'cash', valeur: 100000,   label: '100 000 F CFA',   icone: '' },
  { kifs: 50000000,   type: 'cash', valeur: 500000,   label: '500 000 F CFA',   icone: '' },
  { kifs: 100000000,  type: 'cash', valeur: 1000000,  label: '1 000 000 F CFA', icone: '' },
  { kifs: 500000000,  type: 'cash', valeur: 5000000,  label: '5 000 000 F CFA', icone: '' },
  { kifs: 1000000000, type: 'cash', valeur: 10000000, label: '10 000 000 F CFA', icone: '' },
];

export const formatOscart = (oscart: number, devise: 'fcfa'|'eur'|'usd' = 'fcfa') => {
  if (devise === 'eur') return `${(oscart * OSCART_TO_EUR).toFixed(2)} €`;
  if (devise === 'usd') return `${(oscart * OSCART_TO_USD).toFixed(2)} $`;
  return `${(oscart * OSCART_TO_FCFA).toLocaleString()} F CFA`;
};

// ── Détection de la devise locale (IP) + taux de change du jour ──
// Mondial : on utilise la devise renvoyée directement par l'API selon le pays.
export function useDeviseLocale() {
  const [codeDevise, setCodeDevise] = useState<string>(() => {
    try { return localStorage.getItem('dz_devise') || ''; } catch { return ''; }
  });
  const [pays, setPays] = useState<string>(() => {
    try { return localStorage.getItem('dz_pays') || ''; } catch { return ''; }
  });
  const [taux, setTaux] = useState<number>(1); // 1 XOF = `taux` unités de la devise locale

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        let dev = codeDevise;
        // 1. Détecter le pays ET sa devise par IP (mondial)
        if (!dev) {
          const r = await fetch('https://ipapi.co/json/');
          const d = await r.json();
          const cc = (d && d.country_code) ? d.country_code : 'CI';
          // L'API renvoie directement la devise du pays ; secours via notre table puis XOF
          dev = (d && d.currency) ? d.currency : (DEVISE_PAR_PAYS[cc] || 'XOF');
          if (!annule) {
            setCodeDevise(dev); setPays(cc);
            try { localStorage.setItem('dz_devise', dev); localStorage.setItem('dz_pays', cc); } catch {}
          }
        }
        // 2. Récupérer le taux XOF -> devise locale (sauf zone FCFA)
        if (dev && dev !== 'XOF' && dev !== 'XAF') {
          const rt = await fetch('https://open.er-api.com/v6/latest/XOF');
          const dt = await rt.json();
          if (dt && dt.rates && dt.rates[dev] && !annule) setTaux(dt.rates[dev]);
        } else if (!annule) {
          setTaux(1);
        }
      } catch { /* secours : on reste en FCFA */ }
    })();
    return () => { annule = true; };
  }, [codeDevise]);

  const changerPays = (cc: string) => {
    const dev = DEVISE_PAR_PAYS[cc] || 'XOF';
    setCodeDevise(dev); setPays(cc); setTaux(1);
    try { localStorage.setItem('dz_devise', dev); localStorage.setItem('dz_pays', cc); } catch {}
  };

  // Formate un montant dans la devise locale. Utilise Intl (connaît toutes les devises du monde),
  // avec secours sur notre table de symboles pour les devises africaines mal gérées par Intl.
  const formaterDevise = (montant: number, code: string): string => {
    const info = INFO_DEVISE[code];
    try {
      return new Intl.NumberFormat('fr', { style: 'currency', currency: code, maximumFractionDigits: info ? info.dec : 2 }).format(montant);
    } catch {
      const sym = info ? info.sym : code;
      const dec = info ? info.dec : 2;
      return `${montant.toLocaleString('fr', { minimumFractionDigits: dec, maximumFractionDigits: dec })} ${sym}`;
    }
  };

  // Convertit un montant FCFA en libellé local indicatif (ex: "≈ 230 GHS")
  const enLocal = (fcfa: number): string => {
    if (!codeDevise || codeDevise === 'XOF' || codeDevise === 'XAF') return '';
    const montant = fcfa * taux;
    if (!montant || !isFinite(montant)) return '';
    return `≈ ${formaterDevise(montant, codeDevise)}`;
  };

  return { codeDevise, pays, enLocal, changerPays };
}

// ── Notifications système du navigateur (B) ──
// Écoute les nouvelles notifications de l'utilisateur connecté et affiche une notification
// système (même si l'app est en arrière-plan). Demande la permission au premier usage.
// Compte les notifications non lues du mélomane (perso + générales) pour le badge de la barre.
export function useNotifsNonLues(userEmail?: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userEmail) { setCount(0); return; }
    let perso = 0, gen = 0;
    const maj = () => setCount(perso + gen);
    const unsubP = onSnapshot(
      query(collection(db,'notifications'), where('to','==',userEmail)),
      snap => { perso = snap.docs.filter(d => d.data().role !== 'artiste' && d.data().lu !== true).length; maj(); }
    );
    const unsubG = onSnapshot(
      query(collection(db,'notifications'), where('to','==','all')),
      snap => { gen = snap.docs.filter(d => d.data().lu !== true).length; maj(); }
    );
    return () => { unsubP(); unsubG(); };
  }, [userEmail]);
  return count;
}

// Lien interne à navigation instantanée (sans rechargement de page).
// S'utilise comme une balise <a> : <Lien href="/decouvrir">...</Lien>
export function Lien({ href, children, style, className, onClick, state }: { href: string, children?: any, style?: any, className?: string, onClick?: (e:any)=>void, state?: any }) {
  const navigate = useNavigate();
  return (
    <a href={href} className={className} style={style}
      onClick={(e) => {
        if (onClick) onClick(e);
        // Navigation instantanée pour les liens internes (pas de nouvel onglet / touche spéciale)
        if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigate(href, state ? { state } : undefined);
        }
      }}>
      {children}
    </a>
  );
}

// Petite vignette vidéo EN DIRECT (flux caméra réel) avec un filtre CSS appliqué —
// façon Snapchat/TikTok : on voit vraiment son propre visage avec l'effet dessus,
// pas une icône abstraite. Plusieurs <video> peuvent partager le même flux caméra
// sans coût supplémentaire de décodage (juste un affichage différent chacune).
export function VignetteFiltreEnDirect({ stream, css, miroir }: { stream: MediaStream | null; css: string; miroir: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(()=>{}); }
  }, [stream]);
  return (
    <video ref={ref} muted playsInline
      style={{ width:'100%', height:'100%', objectFit:'cover', filter: css === 'none' ? 'none' : css, transform: miroir ? 'scaleX(-1)' : 'none', background:'#222' }} />
  );
}

// Petite scène illustrée (dessinée, pas une photo) utilisée comme base des
// vignettes de filtres — le filtre CSS s'applique dessus pour qu'on voie
// vraiment son effet (couleurs de peau, ciel, verdure), au lieu d'un simple
// dégradé plat qui n'illustre rien de concret.
