// ─────────────────────────────────────────────
// ACHAT / TÉLÉCHARGEMENT (étape 6) — OscartPayButton, AchatWidget et les
// compteurs associés. Utilisé par FanPage, ZikothequePage et
// PublicStreamPage pour le téléchargement payant.
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, where, getDocs,
} from 'firebase/firestore';
import { C, logTx, lancerPaiementGeniusPay } from '../lib/utils';
import { RechargeDeviseSelector } from './shared';
import { PubOverlay } from '../pages/admin';

// Incrémente le compteur de téléchargements d'un QR code de DUPLICATION physique
// (qrcodes.downloads/usedScans) — uniquement pour les téléchargements qui viennent
// réellement du scan d'un QR physique (page /fan/:qrId), jamais depuis Découvrir/
// streaming, pour ne pas fausser le compte de pochettes physiques vendues.
export async function compterTelechargementQrcode(qrId: string) {
  if (!qrId) return;
  try {
    const snap = await getDocs(query(collection(db, 'qrcodes'), where('qrId', '==', qrId)));
    if (!snap.empty) {
      const ref0 = snap.docs[0];
      const d = ref0.data();
      await updateDoc(doc(db, 'qrcodes', ref0.id), {
        downloads: (d.downloads || 0) + 1,
        usedScans: (d.usedScans || 0) + 1,
      });
    }
  } catch (e) { console.error('compterTelechargementQrcode', e); }
}

// Incrémente le compteur de téléchargements d'un LIEN PUBLIC de monétisation
// (publicLinks.downloads) — pour tout ce qui vient de Découvrir/streaming, séparé
// à 100% du compteur des QR de duplication physique.
export async function compterTelechargementLienPublic(publicLinkId: string) {
  if (!publicLinkId) return;
  try {
    const snap = await getDocs(query(collection(db, 'publicLinks'), where('publicLinkId', '==', publicLinkId)));
    if (!snap.empty) {
      const ref0 = snap.docs[0];
      const d = ref0.data();
      await updateDoc(doc(db, 'publicLinks', ref0.id), { downloads: (d.downloads || 0) + 1 });
    }
  } catch (e) { console.error('compterTelechargementLienPublic', e); }
}

export function OscartPayButton({ prix, qrId, albumLabel, artistEmail, files, source }: {
  prix: number, qrId: string, albumLabel: string, artistEmail: string, files: any[], source?: 'qr' | 'public'
}) {
  const [solde, setSolde] = useState(0);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [rechargeModal, setRechargeModal] = useState<{fcfa:number,oscart:number}|null>(null);
  const user = auth.currentUser;
  const prixOscart = Math.ceil(prix / 10);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db,'coins_solde'), where('uid','==',user.uid)),
      snap => setSolde(snap.empty ? 0 : snap.docs[0].data().solde || 0)
    );
    return unsub;
  }, [user]);

  const payer = async () => {
    if (!user || solde < prixOscart) return;
    setPaying(true);
    try {
      const kiffsGagnes = prixOscart * 250;
      const snap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      if (!snap.empty) {
        const curSolde = snap.docs[0].data();
        await updateDoc(doc(db,'coins_solde',snap.docs[0].id), {
          solde: solde - prixOscart,
          kiffsDispo: (curSolde.kiffsDispo || 0) + kiffsGagnes,
        });
      }
      logTx(user.uid, 'telechargement', -prixOscart, kiffsGagnes, 'Téléchargement');
      const artSnap = await getDocs(query(collection(db,'artists'), where('email','==',artistEmail)));
      const commercialEmail = artSnap.empty ? '' : (artSnap.docs[0].data().commercialEmail || '');
      await addDoc(collection(db,'ventes'), {
        qrId, artistEmail, albumLabel, prix, prixOscart,
        userId: user.uid,
        partArtiste: Math.round(prix * 0.70),
        partEntreprise: Math.round(prix * 0.20),
        partCommercial: Math.round(prix * 0.10),
        commercialEmail, dlActive: true,
        statut: 'paid', createdAt: new Date().toISOString(),
      });
      // en arrière-plan, ne bloque pas le téléchargement — compteur séparé selon
      // l'origine : QR de duplication physique VS lien public de monétisation
      if (source === 'public') compterTelechargementLienPublic(qrId);
      else compterTelechargementQrcode(qrId);
      setDone(true);
    } catch(e) { console.error(e); }
    setPaying(false);
  };

  // Téléchargement piste par piste (plus de ZIP — chaque fichier compte comme
  // un vrai téléchargement individuel, plus fiable pour le suivi).
  const [confirme, setConfirme] = useState(false);
  const telechargerFichier = (f: any) => {
    const a = document.createElement('a');
    a.href = f.url.replace('/upload/','/upload/fl_attachment/');
    a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setConfirme(true); setTimeout(() => setConfirme(false), 4000);
  };

  if (done) return (
    <>
      {(!files || files.length <= 1) ? (
        <button onClick={() => files?.[0] && telechargerFichier(files[0])}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#4dff9a,#00c060)', color:'#000', fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Télécharger maintenant
        </button>
      ) : (
        <div style={{ display:'grid', gap:8 }}>
          {files.map((f: any, i: number) => (
            <button key={i} onClick={() => telechargerFichier(f)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, border:'none', background:'rgba(0,212,154,0.12)', color:'#4dff9a', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'left' }}>
              <span style={{ fontSize:16 }}>⬇</span>
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(f.name || 'Piste ' + (i + 1)).replace(/\.[^/.]+$/, '')}</span>
            </button>
          ))}
        </div>
      )}
      {confirme && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)' }}>
          <span style={{ color:'#00d49a', fontSize:16 }}>✓</span>
          <p style={{ color:'#00d49a', fontSize:13, fontWeight:700, margin:0 }}>Téléchargement effectué</p>
        </div>
      )}
    </>
  );

  if (!user) return null; // géré par le bouton "Connectez-vous" de AchatWidget

  // Solde insuffisant : avant, le bouton disparaissait purement et simplement
  // (la fenêtre de recharge existait déjà dans le code mais rien ne la
  // déclenchait jamais). Oscart reste le moyen de paiement mis en avant —
  // plus fiable que le paiement direct — donc on propose de recharger
  // directement ici plutôt que de laisser le paiement direct comme seule
  // option visible.
  if (solde < prixOscart) {
    return (
      <div>
        {rechargeModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setRechargeModal(null)}>
            <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
              <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:16 }}>
                Recharger {rechargeModal.oscart} Oscart
              </p>
              <RechargeDeviseSelector fcfa={rechargeModal.fcfa} />
              <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
                Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
              </p>
              <button onClick={async () => {
                const err = await lancerPaiementGeniusPay(rechargeModal.oscart, rechargeModal.fcfa);
                if (err) alert(err);
              }}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
                Payer {rechargeModal.fcfa.toLocaleString()} F CFA
              </button>
              <button onClick={() => setRechargeModal(null)}
                style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
        <button onClick={() => setRechargeModal({ oscart: prixOscart, fcfa: prixOscart * 10 })}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Recharger {prixOscart} Oscart pour télécharger
        </button>
        <p style={{ color:'#5a7090', fontSize:11, textAlign:'center', margin:'6px 0 0' }}>Solde actuel : {solde} Oscart</p>
      </div>
    );
  }

  return (
    <div>
      {/* Modal recharge intégré */}
      {rechargeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setRechargeModal(null)}>
          <div style={{ background:'#1e2540', borderRadius:'20px 20px 0 0', padding:'24px 24px 40px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', margin:'0 auto 20px' }} />
            <p style={{ fontWeight:800, fontSize:17, color:'#ffd700', textAlign:'center', marginBottom:16 }}>
              Recharger {rechargeModal.oscart} Oscart
            </p>
            <RechargeDeviseSelector fcfa={rechargeModal.fcfa} />
            <p style={{ color:'#8098b8', fontSize:12, textAlign:'center', margin:'0 0 14px' }}>
              Paiement sécurisé via Wave, Orange Money, MTN, Moov ou carte bancaire
            </p>
            <button onClick={async () => {
              const err = await lancerPaiementGeniusPay(rechargeModal.oscart, rechargeModal.fcfa);
              if (err) alert(err);
            }}
              style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:10 }}>
              Payer {rechargeModal.fcfa.toLocaleString()} F CFA
            </button>
            <button onClick={() => setRechargeModal(null)}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8098b8', fontSize:13, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton paiement direct (utilisé dans le modal de AchatWidget) */}
      <button onClick={payer} disabled={paying || (user && solde < prixOscart)}
        style={{ width:'100%', padding:14, borderRadius:12, border:'none', background: (user && solde < prixOscart) ? 'rgba(255,215,0,0.3)' : 'linear-gradient(135deg,#ffd700,#f0a500)', color:'#1a2340', fontWeight:800, fontSize:15, cursor: paying?'wait':'pointer' }}>
        {paying ? 'Traitement...' : (user && solde < prixOscart) ? `Solde insuffisant (${prixOscart} Oscart requis)` : `Télécharger pour ${prixOscart} Oscart`}
      </button>
    </div>
  );
}

// TÉLÉCHARGER WIDGET — paiement Wave automatique
// Flux : clic → session Wave créée côté serveur → redirection Wave → webhook → DL actif
// ─────────────────────────────────────────────
export function AchatWidget({ qrId, albumLabel, artistEmail, prix, files, externalOpen, onExternalClose, hideButton, source }: {
  qrId: string; albumLabel: string; artistEmail: string; prix: number; files: any[];
  externalOpen?: boolean; onExternalClose?: () => void; hideButton?: boolean; source?: 'qr' | 'public';
}) {
  const [state, setState] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [dlActive, setDlActive] = useState(false);
  const [venteId, setVenteId] = useState('');
  const [confirmeDirect, setConfirmeDirect] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [showPubAfterPay, setShowPubAfterPay] = useState(false);
  const [devise, setDevise] = useState<'fcfa'|'eur'|'usd'>('fcfa');
  const user = auth.currentUser;
  const prixOscart = Math.ceil(prix / 10);
  const clePendante = 'dz_vente_pendante_' + qrId;

  // Reprendre l'écoute d'une vente en attente si l'utilisateur revient
  // d'une redirection de paiement (GeniusPay quitte puis recharge la page).
  useEffect(() => {
    if (venteId) return;
    try {
      const idSauve = localStorage.getItem(clePendante);
      if (idSauve) setVenteId(idSauve);
    } catch { /* ignore */ }
  }, []);

  // Écouter en temps réel si le paiement a été confirmé (via webhook GeniusPay)
  useEffect(() => {
    if (!venteId) return;
    const unsub = onSnapshot(doc(db, 'ventes', venteId), (d) => {
      if (d.exists() && d.data()?.dlActive) {
        setDlActive(true);
        setShowPubAfterPay(false);
        try { localStorage.removeItem(clePendante); } catch { /* ignore */ }
      }
    });
    return unsub;
  }, [venteId]);

  const handlePay = async () => {
    if (!user) return;
    if (state === 'loading') return;
    setState('loading');
    setErrMsg('');
    try {
      // 1. Créer la demande dans Firestore
      const artSnap = await getDocs(query(collection(db, 'artists'), where('email','==',artistEmail)));
      const artistId = artSnap.empty ? '' : (artSnap.docs[0].data().uid || artSnap.docs[0].id);
      const commercialEmail = artSnap.empty ? '' : (artSnap.docs[0].data().responsableEmail || artSnap.docs[0].data().commercialEmail || '');

      // Répartition : Artiste 70% / Entreprise 20% / Commercial 10%
      const partArtiste = Math.round(prix * 0.70);
      const partEntreprise = Math.round(prix * 0.20);
      const partCommercial = Math.round(prix * 0.10);

      const venteRef = await addDoc(collection(db, 'ventes'), {
        qrId, artistId, artistEmail, albumLabel, prix, prixOscart,
        partArtiste, partEntreprise, partCommercial,
        commercialEmail, userId: user.uid,
        statut: 'en_attente', dlActive: false,
        readByArtist: false, createdAt: new Date().toISOString(),
      });
      setVenteId(venteRef.id);
      try { localStorage.setItem(clePendante, venteRef.id); } catch { /* ignore */ }

      // 2. Appeler la Vercel Serverless Function pour créer le paiement GeniusPay
      const res = await fetch('/api/creer-paiement-telechargement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venteId: venteRef.id, prix, prixOscart, qrId, albumLabel, source: source || 'qr',
          uid: user.uid, email: user.email, nom: user.displayName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }

      const { url } = await res.json();

      // 3. Rediriger vers la page de paiement (Wave, Orange Money, MTN, carte...)
      // GeniusPay redirigera vers /fan/:qrId?paiement=succes après paiement
      window.location.href = url;

    } catch (e: any) {
      if (e.message?.includes('permissions')) {
        setErrMsg('Connexion Firestore refusée. Vérifiez les règles de sécurité.');
      } else if (e.message?.includes('fetch')) {
        setErrMsg('Service de paiement non disponible. Réessayez plus tard.');
      } else {
        setErrMsg(e.message || 'Erreur lors de la création du paiement');
      }
      setState('error');
    }
  };

  // Téléchargement piste par piste (plus de ZIP)
  const telechargerFichier = (f: any) => {
    const a = document.createElement('a');
    a.href = f.url.replace('/upload/','/upload/fl_attachment/');
    a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setConfirmeDirect(true); setTimeout(() => setConfirmeDirect(false), 4000);
  };

  // Téléchargement activé (après confirmation Wave webhook)
  if (dlActive) return (
    <div style={{ marginBottom:20 }}>
      {/* Pub après paiement confirmé */}
      {false && showPubAfterPay && (
        <PubOverlay trigger="download" onDone={() => setShowPubAfterPay(false)} />
      )}
      <p style={{ color:'#4a5878', fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10, textTransform:'uppercase' }}>⬇ Télécharger</p>
      <div style={{ background:'rgba(77,255,154,0.1)', border:'1px solid rgba(77,255,154,0.35)', borderRadius:14, padding:'16px 18px', marginBottom:12 }}>
        <p style={{ fontWeight:800, fontSize:15, color:'#4dff9a', margin:'0 0 4px' }}>Paiement confirmé !</p>
        <p style={{ color:'#6a88aa', fontSize:12, margin:'0 0 14px' }}>Wave a confirmé votre paiement. Votre téléchargement est prêt.</p>

        {(!files || files.length <= 1) ? (
          <button onClick={() => files?.[0] && telechargerFichier(files[0])}
            style={{ width:'100%', padding:'15px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#4dff9a,#00c060)', color:'#000', fontWeight:800, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⬇</span> Télécharger maintenant
          </button>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {files.map((f: any, i: number) => (
              <button key={i} onClick={() => telechargerFichier(f)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, border:'none', background:'rgba(77,255,154,0.15)', color:'#4dff9a', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:16 }}>⬇</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(f.name || 'Piste ' + (i + 1)).replace(/\.[^/.]+$/, '')}</span>
              </button>
            ))}
          </div>
        )}

        {confirmeDirect && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(0,212,154,0.1)', border:'1px solid rgba(0,212,154,0.3)' }}>
            <span style={{ color:'#00d49a', fontSize:16 }}>✓</span>
            <p style={{ color:'#00d49a', fontSize:13, fontWeight:700, margin:0 }}>Téléchargement effectué</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div id="zone-telecharger" style={{ marginBottom: hideButton ? 0 : 20 }}>
      {/* Modal détail prix (apparaît au clic ou depuis le lecteur) */}
      {(showDetail || externalOpen) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9992, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => { setShowDetail(false); onExternalClose?.(); }}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:'24px 24px 36px', width:'100%', maxWidth:480, textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)', margin:'0 auto 18px' }} />
            <p style={{ color:C.text, fontWeight:800, fontSize:17, margin:'0 0 12px' }}>Télécharger {albumLabel || ''}</p>

            {/* Prix affiché directement en devise (sélecteur F CFA / € / $) */}
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:10 }}>
              {(['fcfa','eur','usd'] as const).map(d => (
                <button key={d} onClick={() => setDevise(d)}
                  style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${devise===d?C.gold:C.border}`, background:devise===d?'rgba(255,215,0,0.15)':'transparent', color:devise===d?C.gold:C.textSoft, fontSize:11, cursor:'pointer' }}>
                  {d === 'fcfa' ? 'F CFA' : d === 'eur' ? '€' : '$'}
                </button>
              ))}
            </div>
            <p style={{ color:C.gold, fontWeight:800, fontSize:26, margin:'0 0 20px' }}>
              {devise === 'eur' ? `${(prix * 0.0015).toFixed(2)} €` : devise === 'usd' ? `${(prix * 0.0016).toFixed(2)} $` : `${prix.toLocaleString()} F CFA`}
            </p>

            {!user ? (
              <a href={`/ziko?retour=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                style={{ display:'block', width:'100%', padding:12, borderRadius:12, border:'none', background:C.blue, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
                Connectez-vous pour télécharger
              </a>
            ) : (
              <>
                {/* Oscart = moyen de paiement mis en avant (plus fiable que le
                    paiement direct, qui échoue parfois selon l'opérateur) */}
                <OscartPayButton prix={prix} qrId={qrId} albumLabel={albumLabel} artistEmail={artistEmail} files={files} source={source} />
                <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 10px' }}>
                  <div style={{ flex:1, height:1, background:C.border }} />
                  <span style={{ color:C.textSoft, fontSize:11 }}>ou</span>
                  <div style={{ flex:1, height:1, background:C.border }} />
                </div>
                {/* Paiement direct en devise — option secondaire, discrète */}
                <button onClick={handlePay} disabled={state === 'loading'}
                  style={{ width:'100%', padding:11, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontWeight:600, fontSize:13, cursor: state==='loading' ? 'wait' : 'pointer' }}>
                  {state === 'loading' ? 'Redirection en cours...' : `Payer ${devise === 'eur' ? `${(prix*0.0015).toFixed(2)} €` : devise === 'usd' ? `${(prix*0.0016).toFixed(2)} $` : `${prix.toLocaleString()} F CFA`} directement`}
                </button>
                {errMsg && <p style={{ color:'#ff5a5a', fontSize:12, margin:'8px 0 0' }}>{errMsg}</p>}
              </>
            )}

            <button onClick={() => { setShowDetail(false); onExternalClose?.(); }}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer', marginTop:10 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton Télécharger (masqué si déclenché depuis le lecteur) */}
      {!hideButton && (
        <button onClick={() => setShowDetail(true)}
          style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>⬇</span> Télécharger
        </button>
      )}
    </div>
  );
}

