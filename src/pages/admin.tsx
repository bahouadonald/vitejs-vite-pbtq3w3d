// ─────────────────────────────────────────────
// PANNEAU ADMIN (étape 3 du découpage) — tous les onglets admin + AdminPage.
// ArtistPage reste dans App.tsx pour l'instant (dépend de composants
// définis plus bas dans le fichier, pas encore extraits).
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { auth, db } from '../firebase';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDocs, onSnapshot, query, orderBy, where, limit,
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  C, S, ADMIN_EMAIL, estSuperAdmin, estAdmin, demanderResetPassword, envoyerNotification,
  notifierAdminEnregistrement, CLOUDINARY_CLOUD, CLOUDINARY_UPLOAD_PRESET, BASE_URL, optimImg,
  logTx, lancerPaiementGeniusPay, MSG_INVIT_ARTISTE, tabStyle, badgeStyle, formatSize,
  COIN_OSCART_SYMBOLE, KIFFEMENTS, CATEGORIES_AUDIO, CATEGORIES_VIDEO, PRIX_PUBLICATION,
} from '../lib/utils';
import {
  WhatsAppLink, BoutonResetAdmin, ChangerMotDePasse, cleanName, Logo, SIGNATURES, Lien,
  OSCART_TO_FCFA, OSCART_TO_EUR, OSCART_TO_USD, PALIERS_CONCOURS_DEFAUT,
} from '../components/shared';

// ─────────────────────────────────────────────
// SIGNATURES ARTISTE TAB — voir donateurs + offrir signature
// ─────────────────────────────────────────────
export function SignaturesArtisteTab({ artistEmail }: { artistEmail: string }) {
  const [donateurs, setDonateurs] = useState<any[]>([]);
  const [offreModal, setOffreModal] = useState<any>(null);
  const [sent, setSent] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState<any>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image'|'video'>('image');
  const [uploadingSig, setUploadingSig] = useState(false);
  const [sigMsg, setSigMsg] = useState('');
  // Champs spécifiques selon le type de signature
  const [sigDate, setSigDate] = useState('');        // Accès VIP / Dans son clip présentiel
  const [sigDetails, setSigDetails] = useState('');  // Infos (lieu, précisions...)
  const [clipMode, setClipMode] = useState<'presentiel'|'challenge'>('presentiel'); // Dans son clip

  useEffect(() => {
    // Récupérer tous les kiffements reçus, groupés par donateur
    const unsub = onSnapshot(
      query(collection(db,'cadeaux'), where('artistEmail','==',artistEmail)),
      snap => {
        const parDonateur: any = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const key = data.userId || data.userName;
          if (!parDonateur[key]) {
            parDonateur[key] = { userId: data.userId, userName: data.userName || 'Fan', userEmail: data.userEmail || '', totalOscart: 0, count: 0, byType: {} };
          }
          parDonateur[key].totalOscart += (data.coins || 0);
          parDonateur[key].count += 1;
          const kid = data.kiffementId; if (kid) parDonateur[key].byType[kid] = (parDonateur[key].byType[kid] || 0) + 1;
        });
        setDonateurs(Object.values(parDonateur).sort((a:any,b:any) => b.totalOscart - a.totalOscart));
      }
    );
    return unsub;
  }, [artistEmail]);

  const uploadSignature = async (f: File) => {
    setUploadingSig(true); setSigMsg('');
    const isVid = f.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${isVid?'video':'image'}/upload`, { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) { setMediaUrl(data.secure_url); setSigMsg('Contenu prêt.'); }
      else setSigMsg('Erreur upload.');
    } catch { setSigMsg('Erreur upload.'); }
    setUploadingSig(false);
  };

  const offrirSignature = async () => {
    if (!offreModal || !typeChoisi) return;
    const t = typeChoisi.id;
    // Validation selon le type
    if (t === 'dedicace' && !mediaUrl) { setSigMsg('Enregistrez ou ajoutez votre vidéo'); return; }
    if (t === 'vip' && (!sigDate || !sigDetails.trim())) { setSigMsg('Indiquez la date et les infos de l\'événement'); return; }
    if (t === 'clip' && clipMode === 'presentiel' && !sigDate) { setSigMsg('Indiquez la date du tournage'); return; }
    if (t === 'clip' && clipMode === 'challenge' && !sigDetails.trim()) { setSigMsg('Décrivez le challenge à réaliser'); return; }

    // Récupérer le nom de l'artiste
    let artistName = artistEmail.split('@')[0];
    try {
      const aSnap = await getDocs(query(collection(db,'artists'), where('email','==',artistEmail)));
      if (!aSnap.empty) artistName = aSnap.docs[0].data().name || artistName;
    } catch {}

    // Sous-type pour "Dans son clip"
    const sousType = t === 'clip' ? clipMode : '';

    // 1. Notification PERSONNELLE au fan (mène à Profil → Mes signatures)
    await envoyerNotification({
      to: offreModal.userEmail || offreModal.userId,
      type: 'signature',
      text: `${artistName} vous a offert une signature : ${typeChoisi.label} ! Retrouvez-la dans votre profil.`,
      createdAt: new Date().toISOString(),    });
    // 2. Notification GÉNÉRALE
    await envoyerNotification({
      to: 'all', type: 'generale',
      text: `${artistName} offre "${typeChoisi.label}" à ${offreModal.userName}.`,
      createdAt: new Date().toISOString(),    });
    // 3. Publier dans le Mood UNIQUEMENT pour la dédicace vidéo (contenu visible)
    if (t === 'dedicace') {
      await addDoc(collection(db,'mots_artiste'), {
        artistEmail, artistName,
        texte: `offre une dédicace vidéo à ${offreModal.userName}.`,
        videoUrl: mediaType === 'video' ? mediaUrl : '',
        imageUrl: mediaType === 'image' ? mediaUrl : '',
        estSignature: true, typeSignature: t,
        statut: 'valide',
        createdAt: new Date().toISOString(),
      });
    }
    // 4. Enregistrer la signature (avec les infos spécifiques + statut pour le formulaire Spot)
    await addDoc(collection(db,'signatures'), {
      artistEmail, artistName,
      donateurId: offreModal.userId,
      donateurName: offreModal.userName,
      donateurEmail: offreModal.userEmail || '',
      type: t, label: typeChoisi.label,
      mediaUrl: t === 'dedicace' ? mediaUrl : '',
      mediaType: t === 'dedicace' ? mediaType : '',
      date: sigDate || '',
      details: sigDetails || '',
      sousType,
      // Signature Spot : en attente que le fan remplisse nom + slogan
      statutSpot: t === 'spot' ? 'en_attente_fan' : '',
      spotNom: '', spotSlogan: '',
      // Challenge : en attente que le fan réalise sa vidéo
      statutChallenge: (t === 'clip' && clipMode === 'challenge') ? 'a_faire' : '',
      createdAt: new Date().toISOString(),
    });
    setSent(true);
    setTimeout(() => {
      setSent(false); setOffreModal(null); setTypeChoisi(null);
      setMediaUrl(''); setSigMsg(''); setSigDate(''); setSigDetails(''); setClipMode('presentiel');
    }, 2000);
  };

  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <h3 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:8, color:C.text }}>Vos donateurs</h3>
      <p style={{ color:C.textSoft, fontSize:13, marginBottom:20 }}>
        Récompensez vos fans qui vous envoient des kiffements en leur offrant une signature exclusive.
      </p>

      {donateurs.length === 0 ? (
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, textAlign:'center', padding:40 }}>
          <p style={{ color:C.textSoft, fontSize:14 }}>Aucun kiffement reçu pour l'instant.</p>
        </div>
      ) : donateurs.map((d, i) => (
        <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:16, padding:20, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:99, background:'linear-gradient(135deg,'+C.gold+',#f0a500)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#1a2340', fontSize:18 }}>
                {d.userName[0]?.toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:14, margin:'0 0 2px', color:C.text }}>{d.userName}</p>
                <p style={{ color:C.gold, fontSize:12, margin:0 }}>{d.totalOscart} Oscart · {d.count} kiffement{d.count>1?'s':''}</p>
              </div>
            </div>
            <button onClick={() => setOffreModal(d)}
              style={{ padding:'8px 14px', borderRadius:99, border:'1px solid '+C.blue, background:'rgba(93,132,255,0.12)', color:C.blueLite, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              Offrir une signature
            </button>
          </div>
          {/* Détail des kiffements envoyés par ce donateur (image + nombre) */}
          {KIFFEMENTS.some(k => d.byType?.[k.id]) && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12, paddingTop:12, borderTop:'1px solid '+C.border }}>
              {KIFFEMENTS.filter(k => d.byType?.[k.id]).map(k => (
                <div key={k.id} title={k.label} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px 4px 4px', borderRadius:99, background:'rgba(245,200,76,0.1)', border:'1px solid rgba(245,200,76,0.25)' }}>
                  <img src={k.image} alt={k.label} style={{ width:24, height:24, objectFit:'contain' }} />
                  <span style={{ color:C.gold, fontSize:12, fontWeight:800 }}>×{d.byType[k.id]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Modal offrir signature */}
      {offreModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9990, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => !sent && !uploadingSig && (setOffreModal(null), setTypeChoisi(null), setMediaUrl(''), setSigMsg(''))}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto', border:'1px solid '+C.border, borderBottom:'none' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)', margin:'0 auto 20px' }} />
            {sent ? (
              <div style={{ textAlign:'center', padding:20 }}>
                <p style={{ fontWeight:800, fontSize:16, color:C.text }}>Signature offerte à {offreModal.userName} !</p>
                <p style={{ color:C.textSoft, fontSize:13, marginTop:6 }}>Publiée dans Actu & Mood.</p>
              </div>
            ) : !typeChoisi ? (
              <>
                <p style={{ fontWeight:800, fontSize:17, color:C.text, marginBottom:4 }}>Offrir à {offreModal.userName}</p>
                <p style={{ color:C.textSoft, fontSize:13, marginBottom:20 }}>Choisissez ce que vous offrez. Vous ferez ensuite une photo ou vidéo pour l'annoncer.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {SIGNATURES.map(s => (
                    <button key={s.id} onClick={() => { setTypeChoisi(s); setSigMsg(''); }}
                      style={{ padding:'14px 10px', borderRadius:14, border:`1px solid ${s.color}55`, background:`${s.color}18`, cursor:'pointer', textAlign:'center' }}>
                      <div style={{ marginBottom:6 }}><img src={s.image} alt={s.label} style={{ width:40, height:40, objectFit:'contain' }} /></div>
                      <p style={{ fontWeight:800, fontSize:12, color:C.text, margin:'0 0 2px' }}>{s.label}</p>
                      <p style={{ color:C.textSoft, fontSize:10, lineHeight:1.4, margin:0 }}>{s.desc}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => (setOffreModal(null), setMediaUrl(''))}
                  style={{ width:'100%', marginTop:16, padding:12, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer' }}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                <p style={{ fontWeight:800, fontSize:17, color:C.text, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}><img src={typeChoisi.image} alt="" style={{ width:24, height:24, objectFit:'contain' }} /> {typeChoisi.label}</p>
                <p style={{ color:C.textSoft, fontSize:13, marginBottom:16 }}>Pour <strong style={{ color:C.text }}>{offreModal.userName}</strong>.</p>

                {/* DÉDICACE VIDÉO → upload d'une vidéo */}
                {typeChoisi.id === 'dedicace' && (
                  <>
                    <p style={{ color:C.textSoft, fontSize:12, marginBottom:10 }}>Enregistrez ou ajoutez une vidéo où vous citez {offreModal.userName}.</p>
                    <label style={{ display:'block', padding:'20px', borderRadius:14, border:'2px dashed '+C.border, background:'rgba(255,255,255,0.04)', textAlign:'center', cursor:'pointer', marginBottom:14 }}>
                      {mediaUrl ? (
                        <video src={mediaUrl} controls playsInline style={{ width:'100%', borderRadius:10, maxHeight:200 }} />
                      ) : (
                        <span style={{ color:C.blueLite, fontSize:13, fontWeight:600 }}>{uploadingSig ? 'Upload en cours...' : 'Toucher pour ajouter votre vidéo'}</span>
                      )}
                      <input type="file" accept="video/*" style={{ display:'none' }}
                        onChange={e => e.target.files?.[0] && uploadSignature(e.target.files[0])} />
                    </label>
                  </>
                )}

                {/* SIGNATURE SPOT → l'artiste confirme, le fan remplira nom+slogan */}
                {typeChoisi.id === 'spot' && (
                  <div style={{ background:'rgba(245,200,76,0.08)', border:'1px solid rgba(245,200,76,0.3)', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
                    <p style={{ color:C.gold, fontSize:13, lineHeight:1.6, margin:0 }}>
                      Vous vous engagez à citer et chanter {offreModal.userName} dans une prochaine musique. Après validation, {offreModal.userName} recevra un formulaire pour vous indiquer le nom et le slogan à chanter.
                    </p>
                  </div>
                )}

                {/* ACCÈS VIP → date + infos événement */}
                {typeChoisi.id === 'vip' && (
                  <>
                    <label style={{ display:'block', color:C.textSoft, fontSize:12, fontWeight:700, marginBottom:6 }}>Date de l'événement</label>
                    <input className="art-inp" type="date" value={sigDate} onChange={e => setSigDate(e.target.value)} />
                    <label style={{ display:'block', color:C.textSoft, fontSize:12, fontWeight:700, marginBottom:6 }}>Infos (lieu, comment accéder...)</label>
                    <textarea className="art-inp" value={sigDetails} onChange={e => setSigDetails(e.target.value)}
                      placeholder="Ex : Concert au Palais de la Culture, présentez-vous à l'entrée VIP avec ce message."
                      style={{ minHeight:70, resize:'none' }} />
                  </>
                )}

                {/* DANS SON CLIP → présentiel (date) OU challenge (description) */}
                {typeChoisi.id === 'clip' && (
                  <>
                    <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                      <button onClick={() => setClipMode('presentiel')}
                        style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${clipMode==='presentiel'?C.blue:C.border}`, background: clipMode==='presentiel'?'rgba(93,132,255,0.15)':'transparent', color: clipMode==='presentiel'?C.blueLite:C.textSoft, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                        Tournage en présentiel
                      </button>
                      <button onClick={() => setClipMode('challenge')}
                        style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${clipMode==='challenge'?C.blue:C.border}`, background: clipMode==='challenge'?'rgba(93,132,255,0.15)':'transparent', color: clipMode==='challenge'?C.blueLite:C.textSoft, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                        Challenge à réaliser
                      </button>
                    </div>
                    {clipMode === 'presentiel' ? (
                      <>
                        <label style={{ display:'block', color:C.textSoft, fontSize:12, fontWeight:700, marginBottom:6 }}>Date du tournage</label>
                        <input className="art-inp" type="date" value={sigDate} onChange={e => setSigDate(e.target.value)} />
                        <textarea className="art-inp" value={sigDetails} onChange={e => setSigDetails(e.target.value)}
                          placeholder="Lieu et précisions du tournage (optionnel)."
                          style={{ minHeight:60, resize:'none' }} />
                      </>
                    ) : (
                      <>
                        <label style={{ display:'block', color:C.textSoft, fontSize:12, fontWeight:700, marginBottom:6 }}>Décrivez le challenge à réaliser</label>
                        <textarea className="art-inp" value={sigDetails} onChange={e => setSigDetails(e.target.value)}
                          placeholder="Ex : Fais une vidéo sur ma chanson en reprenant ce pas de danse. Les meilleures seront dans mon clip !"
                          style={{ minHeight:80, resize:'none' }} />
                      </>
                    )}
                  </>
                )}

                {sigMsg && <p style={{ color: sigMsg.includes('prêt') ? C.success : C.alert, fontSize:12, margin:'0 0 12px' }}>{sigMsg}</p>}

                <button onClick={offrirSignature} disabled={uploadingSig}
                  style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,'+C.blue+',#0050d0)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer' }}>
                  {uploadingSig ? 'Envoi...' : 'Offrir cette signature'}
                </button>
                <button onClick={() => { setTypeChoisi(null); setMediaUrl(''); setSigMsg(''); setSigDate(''); setSigDetails(''); setClipMode('presentiel'); }}
                  style={{ width:'100%', marginTop:10, padding:12, borderRadius:12, border:'1px solid '+C.border, background:'transparent', color:C.textSoft, fontSize:13, cursor:'pointer' }}>
                  Retour
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PRODUCTION TAB — demandes de production
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// SOUMISSIONS TAB — écouter & valider les contenus soumis par les artistes
// ─────────────────────────────────────────────
export function SoumissionsTab({ canValidate, canDelete }: { canValidate?: boolean, canDelete?: boolean }) {
  const [soumissions, setSoumissions] = useState<any[]>([]);
  const [mots, setMots] = useState<any[]>([]);
  const [scansModal, setScansModal] = useState<any>(null);
  const [nbScans, setNbScans] = useState('1');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'soumissions'), orderBy('createdAt','desc')),
      snap => setSoumissions(snap.docs.map(d => ({id:d.id,...d.data()})).filter((s:any) => !s.estSortie))
    );
    const unsubMots = onSnapshot(
      query(collection(db,'mots_artiste'), orderBy('createdAt','desc')),
      snap => setMots(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { unsub(); unsubMots(); };
  }, []);

  const validerMot = async (m: any) => {
    try {
      await updateDoc(doc(db,'mots_artiste',m.id), { statut:'valide' });
      // Notification perso à l'artiste
      await envoyerNotification({
        to: m.artistEmail, role:'artiste', type:'mot_valide',
        text: `Votre message est validé et publié dans "Actu & Mood Artistique".`,
        createdAt: new Date().toISOString(),      });
      // Notification GÉNÉRALE à tous
      await envoyerNotification({
        to: 'all', type:'generale',
        text: `${m.artistName} a quelque chose à vous dire. Allez voir dans Découvrir !`,
        createdAt: new Date().toISOString(),      });
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };
  const refuserMot = async (m: any) => {
    if (!window.confirm('Refuser ce message ?')) return;
    await updateDoc(doc(db,'mots_artiste',m.id), { statut:'refuse' });
    await envoyerNotification({
      to: m.artistEmail, role:'artiste', type:'mot_refuse',
      text: `Votre message n'a pas été validé car il ne correspond pas à nos conditions (uniquement professionnel).`,
      createdAt: new Date().toISOString(),    });
  };
  // Suppression d'UN SEUL mood déjà publié (contrairement à "Nettoyer le fil"
  // qui les supprime tous). Utile quand un artiste publie un mood alors que son
  // compte n'a pas encore de musique enregistrée, par exemple.
  const supprimerMotUnique = async (m: any) => {
    if (!window.confirm(`Supprimer définitivement ce mood de ${m.artistName} ?`)) return;
    try {
      await deleteDoc(doc(db,'mots_artiste',m.id));
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };
  const motsEnAttente = mots.filter(m => m.statut === 'en_attente');
  const motsValides = mots.filter(m => m.statut === 'valide');

  const valider = async (s: any) => {
    // Générer un publicLinkId et un QR public pour l'artiste
    const publicLinkId = 'pl_' + Math.random().toString(36).substr(2, 12);
    const scans = parseInt(nbScans) || 1;
    try {
      // Lien public (visible par l'artiste)
      await setDoc(doc(db,'publicLinks',publicLinkId), {
        artist: s.artistName, artistEmail: s.artistEmail,
        label: s.titre, categorie: s.categorie,
        fileUrl: s.fileUrl, type: s.type, coverUrl: s.pochetteUrl || '',
        createdAt: new Date().toISOString(),
      });
      // QR privé à scan limité (visible ADMIN uniquement)
      await addDoc(collection(db,'qrcodes'), {
        artist: s.artistName, artistEmail: s.artistEmail,
        label: s.titre, categorie: s.categorie,
        totalScans: scans, usedScans: 0, status:'active',
        publicLinkId, fileUrl: s.fileUrl, coverUrl: s.pochetteUrl || '',
        createdAt: new Date().toISOString(),
      });
      // Ajouter à Découvrir
      await addDoc(collection(db,'decouvrir'), {
        publicLinkId, artist: s.artistName, artistEmail: s.artistEmail,
        label: s.titre, categorie: s.categorie, coverUrl: s.pochetteUrl || '',
        files: [{ url: s.fileUrl, name: s.fileUrl }],
        publishedAt: new Date().toISOString(),
      });
      // Marquer la soumission validée
      await updateDoc(doc(db,'soumissions',s.id), { statut:'valide', publicLinkId, totalScans: scans });
      // Notifier l'artiste — félicitations
      await envoyerNotification({
        to: s.artistEmail, type:'validation',
        text: `Félicitations ! Votre contenu "${s.titre}" est validé et publié. Votre lien et votre QR public sont disponibles. Partagez-les à vos fans !`,
        createdAt: new Date().toISOString(),      });
      // Notif GÉNÉRALE : nouvelle publication, visible par tous les mélomanes
      await envoyerNotification({
        to: 'all', type:'generale',
        text: `Nouveau sur Doniel Zik : "${s.titre}" de ${s.artistName} est disponible ! Allez l'écouter et soutenez l'artiste.`,
        createdAt: new Date().toISOString(),      });
      setScansModal(null); setNbScans('1');
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const validerSortie = async (s: any) => {
    if (!window.confirm(`Valider la sortie programmée "${s.titre}" (sortie le ${s.dateSortie}) ?`)) return;
    try {
      // Créer l'entrée dans la rubrique Bientôt
      await addDoc(collection(db,'sorties'), {
        artistEmail: s.artistEmail, artistName: s.artistName,
        titre: s.titre, type: s.type, categorie: s.categorie,
        teaserUrl: s.fileUrl,           // l'extrait découpé (public avant le jour J)
        fichierComplet: s.fichierComplet || '',  // le fichier complet, gardé pour le jour J
        teaserDebut: s.teaserDebut || 0, teaserDuree: s.teaserDuree || 30,
        pochetteUrl: s.pochetteUrl || '', description: s.description || '',
        fichierOfficiel: '',            // sera renseigné le jour J (depuis fichierComplet)
        dateSortie: s.dateSortie,
        objTelech: s.objTelech || 0,
        objCadeaux: s.objCadeaux || 0,
        cadeauxRecus: 0,
        prixMusique: s.prixMusique,
        prixOscart: s.prixOscart,
        reservations: 0,
        statut: 'a_venir',              // a_venir -> sortie
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db,'soumissions',s.id), { statut:'valide' });
      await envoyerNotification({
        to: s.artistEmail, type:'validation',
        text: `Votre sortie "${s.titre}" est validée et publiée dans "Sortie officielle" ! Les fans peuvent réserver dès maintenant. Le jour J, uploadez votre fichier officiel.`,
        createdAt: new Date().toISOString(),      });
      // Notif GÉNÉRALE : nouvelle sortie officielle à venir, visible par tous les mélomanes
      await envoyerNotification({
        to: 'all', type:'generale',
        text: `Sortie officielle à venir : "${s.titre}" de ${s.artistName}, le ${new Date(s.dateSortie).toLocaleDateString('fr', { day:'numeric', month:'long' })}. Réservez et envoyez des kiffements pour soutenir l'artiste !`,
        createdAt: new Date().toISOString(),      });
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const refuser = async (s: any) => {
    if (!window.confirm(`Refuser "${s.titre}" ?`)) return;
    await updateDoc(doc(db,'soumissions',s.id), { statut:'refuse' });
    await envoyerNotification({
      to: s.artistEmail, type:'refus',
      text: `Votre contenu "${s.titre}" n'a pas pu être validé car il ne correspond pas à nos conditions. Contactez-nous pour plus d'informations.`,
      createdAt: new Date().toISOString(),    });
  };

  const enAttente = soumissions.filter(s => s.statut === 'en_attente');
  const traitees = soumissions.filter(s => s.statut !== 'en_attente');

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:6 }}>Soumissions de contenus</h2>
      <p style={{ color:'#8098b8', fontSize:13, marginBottom:12 }}>
        Écoutez chaque contenu via son lien secret avant de valider. Seul le super admin peut supprimer.
      </p>

      {/* NETTOYER LES MOODS */}
      {mots.length > 0 && canDelete && (
        <button onClick={async () => {
          if (!window.confirm(`Supprimer TOUS les moods (${mots.length}) du fil Actu & Mood ? Cette action est définitive.`)) return;
          try {
            for (const m of mots) { await deleteDoc(doc(db,'mots_artiste',m.id)); }
            alert('Tous les moods ont été supprimés.');
          } catch(e:any) { alert('Erreur : ' + e.message); }
        }} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid #f04a6a', background:'rgba(240,74,106,0.06)', color:'#f04a6a', fontSize:12, fontWeight:700, cursor:'pointer', marginBottom:16 }}>
          Nettoyer le fil ({mots.length} moods)
        </button>
      )}

      {/* MOTS D'ARTISTES À VALIDER */}
      {motsEnAttente.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontWeight:700, fontSize:15, marginBottom:12, color:'#b07a00' }}>Mots d'artistes à valider ({motsEnAttente.length})</h3>
          {motsEnAttente.map(m => (
            <div key={m.id} style={{ ...S.card, marginBottom:10, borderLeft:'3px solid #f0b84a' }}>
              <p style={{ color:'#1a6bff', fontSize:12, fontWeight:700, margin:'0 0 4px' }}>{m.artistName}</p>
              {m.texte && <p style={{ fontSize:13, margin:'0 0 8px', color:'#1a2340' }}>{m.texte}</p>}
              {m.videoUrl && (
                <a href={m.videoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', textAlign:'center', padding:8, borderRadius:8, background:'#eaf1ff', color:'#1a6bff', textDecoration:'none', fontSize:12, fontWeight:700, marginBottom:8 }}>
                  ▶ Voir la vidéo
                </a>
              )}
              {canValidate && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => validerMot(m)} style={{ flex:2, padding:8, borderRadius:8, border:'none', background:'#00a040', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Valider & publier</button>
                  <button onClick={() => refuserMot(m)} style={{ flex:1, padding:8, borderRadius:8, border:'1px solid #f04a6a', background:'transparent', color:'#f04a6a', fontWeight:700, fontSize:12, cursor:'pointer' }}>Refuser</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MOTS DÉJÀ PUBLIÉS — suppression individuelle (contrairement à "Nettoyer
          le fil" qui supprime tout d'un coup). Utile pour retirer un mood précis,
          par exemple un artiste qui a publié un mood avant d'avoir de la musique
          enregistrée sur son compte. */}
      {motsValides.length > 0 && canDelete && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontWeight:700, fontSize:15, marginBottom:12, color:'#00a040' }}>Moods publiés ({motsValides.length})</h3>
          {motsValides.map(m => (
            <div key={m.id} style={{ ...S.card, marginBottom:10, borderLeft:'3px solid #00a040' }}>
              <p style={{ color:'#1a6bff', fontSize:12, fontWeight:700, margin:'0 0 4px' }}>{m.artistName}</p>
              {m.texte && <p style={{ fontSize:13, margin:'0 0 8px', color:'#1a2340' }}>{m.texte}</p>}
              {m.videoUrl && (
                <a href={m.videoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', textAlign:'center', padding:8, borderRadius:8, background:'#eaf1ff', color:'#1a6bff', textDecoration:'none', fontSize:12, fontWeight:700, marginBottom:8 }}>
                  ▶ Voir la vidéo
                </a>
              )}
              <button onClick={() => supprimerMotUnique(m)}
                style={{ width:'100%', padding:8, borderRadius:8, border:'1px solid #f04a6a', background:'transparent', color:'#f04a6a', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                Supprimer ce mood
              </button>
            </div>
          ))}
        </div>
      )}

      {enAttente.length === 0 ? (
        <div style={{ ...S.card, textAlign:'center', padding:30 }}>
          <p style={{ color:'#8098b8', fontSize:14 }}>Aucune soumission en attente.</p>
        </div>
      ) : enAttente.map(s => (
        <div key={s.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <p style={{ fontWeight:800, fontSize:15, margin:'0 0 2px' }}>{s.titre}</p>
              <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 2px' }}>{s.artistName}</p>
              <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{PRIX_PUBLICATION[s.type as keyof typeof PRIX_PUBLICATION]?.label || s.type} · {s.categorie}</p>
              {s.estSortie && <p style={{ color:'#b07a00', fontSize:11, margin:'2px 0 0', fontWeight:700 }}>SORTIE PROGRAMMÉE — le {s.dateSortie} · objectif {(s.objTelech||0).toLocaleString()} téléch. · {s.prixMusique} F</p>}
            </div>
            <span style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:99, padding:'3px 10px', fontSize:10, color:'#b07a00', fontWeight:700 }}>En attente</span>
          </div>

          {/* Lien secret pour écouter */}
          <a href={s.fileUrl} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', textAlign:'center', padding:'10px', borderRadius:8, background:'#eaf1ff', color:'#1a6bff', textDecoration:'none', fontSize:13, fontWeight:700, marginBottom:10 }}>
            ▶ Écouter / Visionner {s.estSortie ? 'le teaser' : 'le contenu'}
          </a>

          {canValidate && (
            <div style={{ display:'flex', gap:8 }}>
              {s.estSortie ? (
                <button onClick={() => validerSortie(s)}
                  style={{ flex:2, padding:10, borderRadius:8, border:'none', background:'#E0A82E', color:'#1a2340', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Valider la sortie
                </button>
              ) : (
                <button onClick={() => { setScansModal(s); setNbScans('1'); }}
                  style={{ flex:2, padding:10, borderRadius:8, border:'none', background:'#00a040', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Valider & générer QR
                </button>
              )}
              <button onClick={() => refuser(s)}
                style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #f04a6a', background:'transparent', color:'#f04a6a', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Refuser
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Soumissions traitées */}
      {traitees.length > 0 && (
        <div style={{ marginTop:24 }}>
          <h3 style={{ fontWeight:700, fontSize:14, marginBottom:12, color:'#8098b8' }}>Traitées ({traitees.length})</h3>
          {traitees.map(s => (
            <div key={s.id} style={{ ...S.card, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:700, fontSize:13, margin:0 }}>{s.titre}</p>
                <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{s.artistName}</p>
              </div>
              <span style={{ borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700,
                background: s.statut==='valide'?'#eaffea':'#ffecec', color: s.statut==='valide'?'#00a040':'#d32f2f' }}>
                {s.statut==='valide'?'Validé':'Refusé'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal nombre de scans */}
      {scansModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9990, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setScansModal(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, maxWidth:380, width:'100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'serif', fontSize:18, fontWeight:800, marginBottom:8 }}>Configurer le QR</h3>
            <p style={{ color:'#8098b8', fontSize:13, marginBottom:16 }}>
              "{scansModal.titre}" — définissez le nombre de scans autorisés pour le QR privé (duplication).
            </p>
            <label style={S.lbl}>Nombre de scans</label>
            <input style={S.inp} type="number" min="1" value={nbScans} onChange={e => setNbScans(e.target.value)} />
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={() => setScansModal(null)} style={{ ...S.btn2, flex:1 }}>Annuler</button>
              <button onClick={() => valider(scansModal)} style={{ ...S.btn, flex:2 }}>Générer & valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE ADMIN DÉDIÉE — SORTIES OFFICIELLES
// Validation des demandes + lancement le jour J
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PAGE ADMIN — GESTION DE DÉCOUVRIR
// Voir tout le contenu publié + supprimer
// ─────────────────────────────────────────────
export function DecouvrirAdminTab({ canDelete }: { canDelete?: boolean }) {
  const [contenus, setContenus] = useState<any[]>([]);
  const [recherche, setRecherche] = useState('');
  const [uploadingCoverId, setUploadingCoverId] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'decouvrir'), orderBy('publishedAt','desc')),
      snap => setContenus(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, []);

  // Resynchronise la pochette d'une fiche Découvrir (utile pour les sorties
  // officielles publiées avant que la pochette soit correctement enregistrée)
  // — met aussi à jour le QR code et le lien public liés, pour rester cohérent.
  const resyncPhoto = async (c: any, file: File) => {
    setUploadingCoverId(c.id);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload échoué');
      await updateDoc(doc(db,'decouvrir',c.id), { coverUrl: data.secure_url });
      // Découvrir = public → on ne synchronise que le lien public (publicLinks),
      // jamais les QR de duplication physique (qrcodes), qui sont un système
      // totalement séparé et privé, géré par l'artiste dans son tableau de bord.
      if (c.publicLinkId) {
        const plSnap = await getDocs(query(collection(db,'publicLinks'), where('publicLinkId','==',c.publicLinkId)));
        for (const d of plSnap.docs) await updateDoc(doc(db,'publicLinks',d.id), { coverUrl: data.secure_url });
      }
    } catch(e:any) { alert('Erreur : ' + e.message); }
    setUploadingCoverId('');
  };

  // Retire uniquement la fiche Découvrir — le lien public et le QR de
  // duplication physique de l'artiste restent intacts et continuent de
  // fonctionner (le lien public peut être partagé et monétisé indépendamment
  // de Découvrir, il ne doit jamais être supprimé automatiquement ici).
  const retirerDecouvrir = async (c: any) => {
    if (!window.confirm(`Retirer "${c.label}" de Découvrir ?\n\n(Le lien public et le QR de duplication de l'artiste restent intacts, le contenu disparaît juste du fil Découvrir)`)) return;
    try { await deleteDoc(doc(db,'decouvrir',c.id)); } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const filtres = contenus.filter(c => {
    if (!recherche.trim()) return true;
    const t = recherche.toLowerCase();
    return (c.label||'').toLowerCase().includes(t) || (c.artist||'').toLowerCase().includes(t) || (c.artistEmail||'').toLowerCase().includes(t);
  });

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:22, fontWeight:800, marginBottom:6 }}>Gestion de Découvrir</h2>
      <p style={{ color:'#8098b8', fontSize:13, marginBottom:16, lineHeight:1.6 }}>
        Tout le contenu publié sur la page Découvrir. Vous pouvez retirer un contenu du fil, ou le supprimer entièrement (avec son QR et son lien).
      </p>

      <input
        placeholder="Rechercher par titre, artiste ou email..."
        value={recherche} onChange={e => setRecherche(e.target.value)}
        style={{ ...S.inp, marginBottom:16 }}
      />

      <p style={{ color:'#8098b8', fontSize:12, marginBottom:12 }}>{filtres.length} contenu(s) publié(s)</p>

      {filtres.length === 0 ? (
        <p style={{ color:'#8098b8', fontSize:13 }}>Aucun contenu.</p>
      ) : filtres.map(c => {
        const aUnFichier = (c.files && c.files.length > 0 && (c.files[0]?.url || c.files[0]?.name)) || c.fileUrl;
        return (
        <div key={c.id} style={{ ...S.card, marginBottom:10, borderLeft:`3px solid ${aUnFichier ? '#00a040' : '#f04a6a'}` }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            {c.coverUrl ? (
              <img src={optimImg(c.coverUrl, 120)} alt={c.label} style={{ width:54, height:54, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
            ) : (
              <div style={{ width:54, height:54, borderRadius:8, background:'#eaf1ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{c.label || '(sans titre)'}</p>
              <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 2px' }}>{c.artist || c.artistEmail || '—'}</p>
              <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>
                {c.type || 'single'} · publié le {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString('fr') : '—'}
              </p>
              {!aUnFichier && <p style={{ color:'#f04a6a', fontSize:11, fontWeight:700, margin:'4px 0 0' }}>Pas de fichier audio/vidéo (fiche vide)</p>}
              {!c.coverUrl && <p style={{ color:'#b07a00', fontSize:11, fontWeight:700, margin:'4px 0 0' }}>Pas de pochette (image générique affichée au partage)</p>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
            {c.publicLinkId && (
              <a href={`/ecoute/${c.publicLinkId}`} target="_blank" rel="noopener noreferrer"
                style={{ padding:'6px 12px', borderRadius:8, background:'#eaf1ff', color:'#1a6bff', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                Voir la page fan
              </a>
            )}
            <label style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #1a6bff', background: uploadingCoverId===c.id ? '#dce6f7' : '#fff', color:'#1a6bff', fontSize:12, fontWeight:700, cursor: uploadingCoverId===c.id ? 'wait' : 'pointer' }}>
              {uploadingCoverId===c.id ? 'Envoi...' : (c.coverUrl ? 'Changer la pochette' : 'Ajouter une pochette')}
              <input type="file" accept="image/*" style={{ display:'none' }} disabled={uploadingCoverId===c.id}
                onChange={e => e.target.files?.[0] && resyncPhoto(c, e.target.files[0])} />
            </label>
            <button onClick={() => retirerDecouvrir(c)}
              style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #f0b84a', background:'#fff8e6', color:'#b07a00', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Retirer de Découvrir
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

export function SortiesAdminTab({ canValidate, canDelete }: { canValidate?: boolean, canDelete?: boolean }) {
  const [enAttente, setEnAttente] = useState<any[]>([]);
  const [sorties, setSorties] = useState<any[]>([]);
  const [uploadingSortie, setUploadingSortie] = useState('');

  useEffect(() => {
    // Demandes de sortie en attente de validation (soumissions estSortie)
    const u1 = onSnapshot(
      query(collection(db,'soumissions'), orderBy('createdAt','desc')),
      snap => setEnAttente(snap.docs.map(d => ({id:d.id,...d.data()})).filter((s:any) => s.estSortie && s.statut === 'en_attente'))
    );
    // Sorties validées (a_venir = en réservation, sortie = déjà lancée)
    const u2 = onSnapshot(
      query(collection(db,'sorties'), orderBy('createdAt','desc')),
      snap => setSorties(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { u1(); u2(); };
  }, []);

  const validerSortie = async (s: any) => {
    if (!window.confirm(`Valider et publier la sortie officielle "${s.titre}" (sortie le ${s.dateSortie}) ?`)) return;
    try {
      await addDoc(collection(db,'sorties'), {
        artistEmail: s.artistEmail, artistName: s.artistName,
        titre: s.titre, type: s.type, categorie: s.categorie,
        teaserUrl: s.fileUrl, pochetteUrl: s.pochetteUrl || '',
        description: s.description || '',
        fichierComplet: s.fichierComplet || '',
        teaserDebut: s.teaserDebut || 0, teaserDuree: s.teaserDuree || 30,
        fichierOfficiel: '', dateSortie: s.dateSortie,
        objTelech: s.objTelech || 0, objCadeaux: s.objCadeaux || 0,
        cadeauxRecus: 0,
        prixMusique: s.prixMusique, prixOscart: s.prixOscart,
        reservations: 0, statut: 'a_venir',
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db,'soumissions',s.id), { statut:'valide' });
      await envoyerNotification({
        to: s.artistEmail, type:'validation',
        text: `Votre sortie officielle "${s.titre}" est validée et publiée ! Les fans peuvent réserver. Le jour J, le fichier officiel sera mis en ligne.`,
        createdAt: new Date().toISOString(),      });
      alert('Sortie officielle validée et publiée !');
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const refuserSortie = async (s: any) => {
    if (!window.confirm(`Refuser la sortie "${s.titre}" ?`)) return;
    try {
      await updateDoc(doc(db,'soumissions',s.id), { statut:'refuse' });
      await envoyerNotification({
        to: s.artistEmail, type:'refus',
        text: `Votre demande de sortie officielle "${s.titre}" n'a pas été retenue. Contactez-nous pour plus d'informations.`,
        createdAt: new Date().toISOString(),      });
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  // Lancer la sortie en débloquant DIRECTEMENT le fichier complet déjà stocké (pas de re-upload)
  const lancerSortieAuto = async (sortie: any) => {
    const urlComplete = sortie.fichierComplet;
    if (!urlComplete) { alert('Aucun fichier complet stocké. Utilisez l\'upload manuel.'); return; }
    if (!window.confirm(`Lancer la sortie de "${sortie.titre}" maintenant ? Le fichier complet sera débloqué pour ceux qui ont réservé.`)) return;
    setUploadingSortie(sortie.id);
    try {
      await updateDoc(doc(db,'sorties',sortie.id), { fichierOfficiel: urlComplete, statut:'sortie', sortieLe: new Date().toISOString() });
      const resaSnap = await getDocs(query(collection(db,'reservations'), where('sortieId','==',sortie.id)));
      for (const r of resaSnap.docs) {
        await updateDoc(doc(db,'reservations',r.id), { statut:'disponible', fichierOfficiel: urlComplete });
        await envoyerNotification({
          to: r.data().userEmail, type:'sortie_dispo', sortieId: sortie.id,
          fichierUrl: urlComplete, titre: sortie.titre, artistName: sortie.artistName,
          text: `"${sortie.titre}" de ${sortie.artistName} est sorti ! Téléchargez votre contenu maintenant.`,
          boutonStatut:'vert', createdAt: new Date().toISOString(),        });
      }
      const publicLinkId = 'pl_' + Math.random().toString(36).substr(2, 12);
      await addDoc(collection(db,'decouvrir'), {
        publicLinkId, artist: sortie.artistName, artistEmail: sortie.artistEmail,
        label: sortie.titre, categorie: sortie.categorie, coverUrl: sortie.pochetteUrl || '',
        files: [{ url: urlComplete, name: urlComplete }],
        publishedAt: new Date().toISOString(),
      });
      alert(`Sortie lancée ! ${resaSnap.size} fan(s) notifié(s).`);
    } catch(e:any) { alert('Erreur : ' + e.message); }
    setUploadingSortie('');
  };

  const lancerSortie = async (sortie: any, f: File) => {
    setUploadingSortie(sortie.id);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) {
        await updateDoc(doc(db,'sorties',sortie.id), { fichierOfficiel: data.secure_url, statut:'sortie', sortieLe: new Date().toISOString() });
        const resaSnap = await getDocs(query(collection(db,'reservations'), where('sortieId','==',sortie.id)));
        for (const r of resaSnap.docs) {
          await updateDoc(doc(db,'reservations',r.id), { statut:'disponible', fichierOfficiel: data.secure_url });
          await envoyerNotification({
            to: r.data().userEmail, type:'sortie_dispo', sortieId: sortie.id,
            fichierUrl: data.secure_url, titre: sortie.titre, artistName: sortie.artistName,
            text: `"${sortie.titre}" de ${sortie.artistName} est sorti ! Téléchargez votre contenu maintenant.`,
            boutonStatut:'vert', createdAt: new Date().toISOString(),          });
        }
        const publicLinkId = 'pl_' + Math.random().toString(36).substr(2, 12);
        await addDoc(collection(db,'decouvrir'), {
          publicLinkId, artist: sortie.artistName, artistEmail: sortie.artistEmail,
          label: sortie.titre, categorie: sortie.categorie, coverUrl: sortie.pochetteUrl || '',
          files: [{ url: data.secure_url, name: data.secure_url }],
          publishedAt: new Date().toISOString(),
        });
        alert(`Sortie lancée ! ${resaSnap.size} fan(s) notifié(s), téléchargement débloqué.`);
      }
    } catch(e:any) { alert('Erreur : ' + e.message); }
    setUploadingSortie('');
  };

  const supprimerSortie = async (sortie: any) => {
    if (!window.confirm(`Supprimer la sortie "${sortie.titre}" ?`)) return;
    try { await deleteDoc(doc(db,'sorties',sortie.id)); } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  // Modifier une sortie existante (pochette + description) sans tout refaire
  const [editSortie, setEditSortie] = useState<any>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editPochette, setEditPochette] = useState('');
  const [editPochUploading, setEditPochUploading] = useState(false);
  const ouvrirEditSortie = (s: any) => {
    setEditSortie(s); setEditDesc(s.description || ''); setEditPochette(s.pochetteUrl || ''); setEditPochUploading(false);
  };
  const uploadEditPochette = async (f: File) => {
    // Aperçu local immédiat (ne dépend pas du réseau)
    try { setEditPochette(URL.createObjectURL(f)); } catch {}
    setEditPochUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const d = await r.json();
      console.log('EDIT POCHETTE réponse:', d);
      if (d.secure_url) setEditPochette(d.secure_url);
      else alert('Erreur upload : ' + (d?.error?.message || JSON.stringify(d).slice(0,120)));
    } catch(e:any) { alert('Erreur réseau : ' + (e?.message||'')); console.error(e); }
    setEditPochUploading(false);
  };
  const enregistrerEditSortie = async () => {
    if (!editSortie) return;
    if (editPochUploading) { alert('Patientez, la pochette est en cours d\'envoi...'); return; }
    if (editPochette.startsWith('blob:')) { alert('L\'image n\'a pas fini de s\'envoyer. Réessayez dans un instant.'); return; }
    try {
      await updateDoc(doc(db,'sorties',editSortie.id), { description: editDesc.trim(), pochetteUrl: editPochette });
      setEditSortie(null);
    } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const aVenir = sorties.filter(s => s.statut === 'a_venir');
  const lancees = sorties.filter(s => s.statut === 'sortie');

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:22, fontWeight:800, marginBottom:6 }}>Sorties officielles</h2>
      <p style={{ color:'#8098b8', fontSize:13, marginBottom:24, lineHeight:1.6 }}>
        Validez les demandes de sortie officielle des artistes (teaser, pochette, objectifs, prix). Le jour J, uploadez le fichier officiel pour débloquer les téléchargements réservés.
      </p>

      {/* EN ATTENTE DE VALIDATION */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:16, fontWeight:800, color:'#b07a00', marginBottom:14 }}>À valider ({enAttente.length})</h3>
        {enAttente.length === 0 ? (
          <p style={{ color:'#8098b8', fontSize:13 }}>Aucune demande de sortie en attente.</p>
        ) : enAttente.map(s => (
          <div key={s.id} style={{ ...S.card, marginBottom:12, borderLeft:'3px solid #E0A82E' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <p style={{ fontWeight:800, fontSize:16, margin:'0 0 2px' }}>{s.titre}</p>
                <p style={{ color:'#1a6bff', fontSize:13, margin:'0 0 2px' }}>{s.artistName}</p>
                <p style={{ color:'#8098b8', fontSize:12, margin:0 }}>
                  Sortie le {new Date(s.dateSortie).toLocaleDateString('fr')} · {s.prixMusique} F · objectif {(s.objTelech||0).toLocaleString()} téléch.
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
              <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#1a6bff', fontWeight:700 }}>Écouter le teaser</a>
              {s.pochetteUrl && <a href={s.pochetteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#1a6bff', fontWeight:700 }}>Voir la pochette</a>}
            </div>
            {s.pochetteUrl && <img src={optimImg(s.pochetteUrl, 200)} alt="pochette" style={{ width:90, height:90, objectFit:'cover', borderRadius:10, marginBottom:10 }} />}
            {canValidate && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => validerSortie(s)} style={{ flex:2, padding:10, borderRadius:8, border:'none', background:'#E0A82E', color:'#1a2340', fontWeight:700, fontSize:13, cursor:'pointer' }}>Valider et publier</button>
                <button onClick={() => refuserSortie(s)} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #f04a6a', background:'transparent', color:'#f04a6a', fontWeight:700, fontSize:13, cursor:'pointer' }}>Refuser</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* EN RÉSERVATION (à lancer le jour J) */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:16, fontWeight:800, color:'#1a6bff', marginBottom:14 }}>En réservation ({aVenir.length})</h3>
        {aVenir.length === 0 ? (
          <p style={{ color:'#8098b8', fontSize:13 }}>Aucune sortie en cours de réservation.</p>
        ) : aVenir.map(s => {
          const joursRestants = Math.ceil((new Date(s.dateSortie).getTime() - Date.now()) / (1000*60*60*24));
          return (
          <div key={s.id} style={{ ...S.card, marginBottom:12, borderLeft:'3px solid #1a6bff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <p style={{ fontWeight:800, fontSize:15, margin:'0 0 2px' }}>{s.titre}</p>
                <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 2px' }}>{s.artistName}</p>
                <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>Sortie le {new Date(s.dateSortie).toLocaleDateString('fr')} · {(s.reservations||0).toLocaleString()} réservation(s)</p>
              </div>
              <span style={{ background:'#eaf1ff', borderRadius:99, padding:'3px 10px', fontSize:10, color:'#1a6bff', fontWeight:700, whiteSpace:'nowrap' }}>
                {joursRestants > 0 ? `J-${joursRestants}` : 'Jour J'}
              </span>
            </div>
            <div style={{ background:'#fff8e6', borderRadius:8, padding:'10px 12px', marginTop:8 }}>
              <p style={{ color:'#b07a00', fontSize:12, fontWeight:700, margin:'0 0 8px' }}>Jour J : débloquez le fichier complet pour les téléchargements réservés.</p>
              {s.fichierComplet ? (
                <>
                  <button onClick={() => lancerSortieAuto(s)} disabled={uploadingSortie===s.id}
                    style={{ display:'block', width:'100%', padding:'10px 14px', borderRadius:8, background:'#00a040', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', border:'none', marginBottom:8 }}>
                    {uploadingSortie===s.id ? 'Lancement...' : 'Lancer maintenant (fichier déjà prêt)'}
                  </button>
                  <p style={{ color:'#5a7090', fontSize:10, margin:'0 0 8px' }}>Le fichier complet a été chargé par l'artiste : aucun nouvel upload nécessaire.</p>
                </>
              ) : (
                <label style={{ display:'inline-block', padding:'8px 14px', borderRadius:8, background:'#E0A82E', color:'#1a2340', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  {uploadingSortie===s.id ? 'Upload en cours...' : 'Lancer la sortie (uploader le fichier officiel)'}
                  <input type="file" accept="audio/*,video/*" style={{ display:'none' }} onChange={e => e.target.files?.[0] && lancerSortie(s, e.target.files[0])} />
                </label>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              <button onClick={() => ouvrirEditSortie(s)} style={{ ...S.btn2, fontSize:11, padding:'4px 12px' }}>Modifier pochette / description</button>
              {canDelete && <button onClick={() => supprimerSortie(s)} style={{ ...S.btnRed, fontSize:11, padding:'4px 10px' }}>Supprimer</button>}
            </div>
          </div>
          );
        })}
      </div>

      {/* DÉJÀ SORTIES */}
      {lancees.length > 0 && (
        <div>
          <h3 style={{ fontSize:16, fontWeight:800, color:'#00a040', marginBottom:14 }}>Déjà sorties ({lancees.length})</h3>
          {lancees.map(s => (
            <div key={s.id} style={{ ...S.card, marginBottom:10, borderLeft:'3px solid #00a040' }}>
              <p style={{ fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{s.titre} <span style={{ color:'#00a040', fontSize:11 }}>✓ sortie</span></p>
              <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{s.artistName} · {(s.reservations||0).toLocaleString()} téléchargement(s) réservé(s)</p>
            </div>
          ))}
        </div>
      )}

      {/* MODAL — modifier pochette / description d'une sortie */}
      {editSortie && (
        <div onClick={() => setEditSortie(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, padding:20, maxWidth:420, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
            <h3 style={{ fontFamily:'serif', fontSize:19, margin:'0 0 4px' }}>Modifier la sortie</h3>
            <p style={{ color:'#8098b8', fontSize:12, margin:'0 0 16px' }}>{editSortie.titre} — {editSortie.artistName}</p>

            <label style={S.lbl}>Pochette</label>
            <input type="file" accept="image/*" id="editSortiePoch" style={{ display:'none' }}
              onChange={e => e.target.files?.[0] && uploadEditPochette(e.target.files[0])} />
            <label htmlFor="editSortiePoch" style={{ display:'flex', alignItems:'center', gap:14, border:`2px dashed ${editPochette?'#00a040':'#1a6bff'}`, borderRadius:12, padding:12, background: editPochette?'#eafaf0':'#f0f6ff', cursor:'pointer', marginBottom:14 }}>
              {editPochette ? (
                <img src={editPochette} alt="pochette" style={{ width:64, height:64, objectFit:'cover', borderRadius:10, flexShrink:0 }} />
              ) : (
                <div style={{ width:64, height:64, borderRadius:10, background:'#dce6f7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:800, color:'#5a7090' }}>IMG</div>
              )}
              <span style={{ fontSize:13, fontWeight:700, color: editPochette?'#00a040':'#1a6bff' }}>
                {editPochUploading ? 'Upload...' : editPochette ? 'Changer limage' : 'Ajouter une pochette'}
              </span>
            </label>

            <label style={S.lbl}>Description</label>
            <textarea style={{ ...S.inp, minHeight:70, resize:'vertical' }} value={editDesc} onChange={e => setEditDesc(e.target.value)}
              placeholder="Description du titre..." />

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={enregistrerEditSortie} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'#00a040', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>Enregistrer</button>
              <button onClick={() => setEditSortie(null)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid #ccc', background:'transparent', color:'#666', fontWeight:700, fontSize:14, cursor:'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductionTab() {
  const [demandes, setDemandes] = useState<any[]>([]);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [uploadingCmd, setUploadingCmd] = useState('');
  const [sorties, setSorties] = useState<any[]>([]);
  const [uploadingSortie, setUploadingSortie] = useState('');
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'demandes_production'), orderBy('createdAt','desc')),
      snap => setDemandes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    const unsubCmd = onSnapshot(
      query(collection(db,'commandes_pochettes'), orderBy('createdAt','desc')),
      snap => setCommandes(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    const unsubSorties = onSnapshot(
      query(collection(db,'sorties'), orderBy('createdAt','desc')),
      snap => setSorties(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return () => { unsub(); unsubCmd(); unsubSorties(); };
  }, []);

  // Lancer la sortie en débloquant DIRECTEMENT le fichier complet déjà stocké (pas de re-upload)
  const lancerSortieAuto = async (sortie: any) => {
    const urlComplete = sortie.fichierComplet;
    if (!urlComplete) { alert('Aucun fichier complet stocké. Utilisez l\'upload manuel.'); return; }
    if (!window.confirm(`Lancer la sortie de "${sortie.titre}" maintenant ? Le fichier complet sera débloqué pour ceux qui ont réservé.`)) return;
    setUploadingSortie(sortie.id);
    try {
      await updateDoc(doc(db,'sorties',sortie.id), { fichierOfficiel: urlComplete, statut:'sortie', sortieLe: new Date().toISOString() });
      const resaSnap = await getDocs(query(collection(db,'reservations'), where('sortieId','==',sortie.id)));
      for (const r of resaSnap.docs) {
        await updateDoc(doc(db,'reservations',r.id), { statut:'disponible', fichierOfficiel: urlComplete });
        await envoyerNotification({
          to: r.data().userEmail, type:'sortie_dispo', sortieId: sortie.id,
          fichierUrl: urlComplete, titre: sortie.titre, artistName: sortie.artistName,
          text: `"${sortie.titre}" de ${sortie.artistName} est sorti ! Téléchargez votre contenu maintenant.`,
          boutonStatut:'vert', createdAt: new Date().toISOString(),        });
      }
      const publicLinkId = 'pl_' + Math.random().toString(36).substr(2, 12);
      await addDoc(collection(db,'decouvrir'), {
        publicLinkId, artist: sortie.artistName, artistEmail: sortie.artistEmail,
        label: sortie.titre, categorie: sortie.categorie, coverUrl: sortie.pochetteUrl || '',
        files: [{ url: urlComplete, name: urlComplete }],
        publishedAt: new Date().toISOString(),
      });
      alert(`Sortie lancée ! ${resaSnap.size} fan(s) notifié(s).`);
    } catch(e:any) { alert('Erreur : ' + e.message); }
    setUploadingSortie('');
  };

  // LE JOUR J : uploader le fichier officiel → débloque les téléchargements réservés
  const lancerSortie = async (sortie: any, f: File) => {
    setUploadingSortie(sortie.id);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) {
        // Marquer la sortie comme sortie (officielle) avec le fichier complet
        await updateDoc(doc(db,'sorties',sortie.id), { fichierOfficiel: data.secure_url, statut:'sortie', sortieLe: new Date().toISOString() });
        // Débloquer toutes les réservations + notifier (bouton vert)
        const resaSnap = await getDocs(query(collection(db,'reservations'), where('sortieId','==',sortie.id)));
        for (const r of resaSnap.docs) {
          await updateDoc(doc(db,'reservations',r.id), { statut:'disponible', fichierOfficiel: data.secure_url });
          await envoyerNotification({
            to: r.data().userEmail, type:'sortie_dispo', sortieId: sortie.id,
            fichierUrl: data.secure_url, titre: sortie.titre, artistName: sortie.artistName,
            text: `"${sortie.titre}" de ${sortie.artistName} est sorti ! Téléchargez votre contenu maintenant.`,
            boutonStatut:'vert', createdAt: new Date().toISOString(),          });
        }
        // Publier dans Découvrir (devient un contenu normal)
        const publicLinkId = 'pl_' + Math.random().toString(36).substr(2, 12);
        await addDoc(collection(db,'decouvrir'), {
          publicLinkId, artist: sortie.artistName, artistEmail: sortie.artistEmail,
          label: sortie.titre, categorie: sortie.categorie, coverUrl: sortie.pochetteUrl || '',
          files: [{ url: data.secure_url, name: data.secure_url }],
          publishedAt: new Date().toISOString(),
        });
        alert(`Sortie lancée ! ${resaSnap.size} fans notifiés, leur téléchargement est débloqué.`);
      }
    } catch(e:any) { alert('Erreur : ' + e.message); }
    setUploadingSortie('');
  };

  const uploadCrea = async (cmdId: string, f: File) => {
    setUploadingCmd(cmdId);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method:'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) {
        const cmd = commandes.find(c => c.id === cmdId);
        await updateDoc(doc(db,'commandes_pochettes',cmdId), { creaUrl: data.secure_url, statut:'livree' });
        // Notifier l'artiste
        if (cmd) await envoyerNotification({
          to: cmd.artistEmail, type:'pochette_livree',
          text: `Votre pochette est prête ! Téléchargez-la en PNG depuis l'onglet Pochettes.`,
          createdAt: new Date().toISOString(),        });
      }
    } catch {}
    setUploadingCmd('');
  };

  return (
    <div>
      {/* SORTIES PROGRAMMÉES */}
      {sorties.filter(s => s.statut === 'a_venir').length > 0 && (
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:16 }}>Sorties programmées</h2>
          {sorties.filter(s => s.statut === 'a_venir').map(s => {
            const joursRestants = Math.ceil((new Date(s.dateSortie).getTime() - Date.now()) / (1000*60*60*24));
            return (
            <div key={s.id} style={{ ...S.card, marginBottom:12, borderLeft:'3px solid #E0A82E' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <p style={{ fontWeight:800, fontSize:15, margin:'0 0 2px' }}>{s.titre}</p>
                  <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 2px' }}>{s.artistName}</p>
                  <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>Sortie le {new Date(s.dateSortie).toLocaleDateString('fr')} · {s.prixMusique} F · {(s.reservations||0).toLocaleString()} réservation(s)</p>
                </div>
                <span style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:99, padding:'3px 10px', fontSize:10, color:'#b07a00', fontWeight:700, whiteSpace:'nowrap' }}>
                  {joursRestants > 0 ? `J-${joursRestants}` : 'Jour J'}
                </span>
              </div>
              <a href={s.teaserUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', fontSize:12, color:'#1a6bff', marginBottom:10 }}>Écouter le teaser</a>
              <div style={{ background:'#fff8e6', borderRadius:8, padding:'10px 12px' }}>
                <p style={{ color:'#b07a00', fontSize:12, fontWeight:700, margin:'0 0 8px' }}>Le jour J : débloquez le fichier complet pour les téléchargements réservés.</p>
                {s.fichierComplet ? (
                  <>
                    <button onClick={() => lancerSortieAuto(s)} disabled={uploadingSortie===s.id}
                      style={{ display:'block', width:'100%', padding:'10px 14px', borderRadius:8, background:'#00a040', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', border:'none', marginBottom:8 }}>
                      {uploadingSortie===s.id ? 'Lancement...' : 'Lancer maintenant (fichier déjà prêt)'}
                    </button>
                    <p style={{ color:'#5a7090', fontSize:10, margin:0 }}>Le fichier complet a été chargé par l'artiste : aucun nouvel upload nécessaire.</p>
                  </>
                ) : (
                  <label style={{ display:'inline-block', padding:'8px 14px', borderRadius:8, background:'#E0A82E', color:'#1a2340', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    {uploadingSortie===s.id ? 'Upload en cours...' : 'Lancer la sortie (uploader le fichier officiel)'}
                    <input type="file" accept="audio/*,video/*" style={{ display:'none' }}
                      onChange={e => e.target.files?.[0] && lancerSortie(s, e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* COMMANDES DE POCHETTES */}
      {commandes.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:16 }}>Commandes de pochettes</h2>
          {commandes.map(c => (
            <div key={c.id} style={{ ...S.card, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{c.contenuTitre}</p>
                  <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 4px' }}>{c.artistName} · {c.artistEmail}</p>
                  <p style={{ color:'#5a7090', fontSize:12, margin:0 }}>
                    {c.nbPochettes} pochettes · {c.nbScans} scan(s)/pièce · QR {c.qrPosition}
                  </p>
                  {c.creaParNous && <p style={{ color:'#b07a00', fontSize:12, margin:'4px 0 0', fontWeight:700 }}>Conception demandée (+{(c.coutCrea||5000).toLocaleString()} F)</p>}
                  {c.infos && <p style={{ color:'#8098b8', fontSize:11, margin:'4px 0 0', lineHeight:1.5 }}>Infos : {c.infos}</p>}
                </div>
                <span style={{ background:c.statut==='livree'?'#eaffea':'#fff8e1', border:`1px solid ${c.statut==='livree'?'#4dff9a':'#ffd700'}`, borderRadius:99, padding:'3px 10px', fontSize:10, color:c.statut==='livree'?'#00a040':'#b07a00', fontWeight:700, whiteSpace:'nowrap' }}>
                  {c.statut==='livree'?'Livrée':c.statut==='en_cours'?'En cours':'Reçue'}
                </span>
              </div>
              {/* Photo fournie par l'artiste */}
              {c.photoUrl && (
                <a href={c.photoUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', marginBottom:10 }}>
                  <img src={c.photoUrl} style={{ width:60, height:60, borderRadius:8, objectFit:'cover' }} alt="" />
                </a>
              )}
              {/* Uploader la créa finale */}
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={() => updateDoc(doc(db,'commandes_pochettes',c.id), { statut:'en_cours' })}
                  style={{ ...S.btn2, fontSize:11, padding:'6px 12px' }}>Marquer en cours</button>
                <label style={{ ...S.btn, fontSize:11, padding:'6px 12px', cursor:'pointer', display:'inline-block' }}>
                  {uploadingCmd===c.id ? 'Upload...' : 'Livrer la créa (PNG)'}
                  <input type="file" accept="image/png,image/jpeg" style={{ display:'none' }}
                    onChange={e => e.target.files?.[0] && uploadCrea(c.id, e.target.files[0])} />
                </label>
                {c.creaUrl && <span style={{ color:'#00a040', fontSize:11, fontWeight:700 }}>Créa livrée ✓</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:20 }}>Demandes de production</h2>
      {demandes.length === 0 ? (
        <p style={{ color:'#8098b8', fontSize:13 }}>Aucune demande pour l'instant.</p>
      ) : demandes.map(d => (
        <div key={d.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:14, margin:'0 0 4px' }}>{d.nom}</p>
              <p style={{ color:'#1a6bff', fontSize:12, margin:'0 0 4px', textTransform:'capitalize' }}>{d.type}</p>
              <p style={{ color:'#5a7090', fontSize:12, margin:'0 0 4px', lineHeight:1.6 }}>{d.description}</p>
              <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>WhatsApp : {d.whatsapp}</p>
              {d.email && <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{d.email}</p>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ background:d.statut==='traite'?'#eaffea':'#fff8e1', border:`1px solid ${d.statut==='traite'?'#4dff9a':'#ffd700'}`, borderRadius:99, padding:'3px 10px', fontSize:10, color:d.statut==='traite'?'#00a040':'#b07a00', fontWeight:700 }}>
                {d.statut === 'traite' ? 'Traité' : 'En attente'}
              </span>
              <button onClick={() => updateDoc(doc(db,'demandes_production',d.id), { statut:'traite' })}
                style={{ ...S.btn, fontSize:10, padding:'4px 8px' }}>Marquer traité</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// RESPONSABLES TAB — créer comptes responsables commerciaux
// ─────────────────────────────────────────────
export function ResponsablesTab({ canDelete }: { canDelete?: boolean }) {
  const [responsables, setResponsables] = useState<any[]>([]);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'responsables'), orderBy('createdAt', 'desc')),
      snap => setResponsables(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const creerCompte = async () => {
    if (!nom || !email) { setMsg('Nom et email requis'); return; }
    setLoading(true); setMsg('');
    try {
      // Vérifier si déjà existant
      const existing = await getDocs(query(collection(db,'responsables'), where('email','==',email.trim().toLowerCase())));
      if (!existing.empty) { setMsg('Ce responsable existe déjà.'); setLoading(false); return; }
      // Enregistrer dans Firestore — il créera son mot de passe lui-même sur /responsable
      await addDoc(collection(db,'responsables'), {
        nom, email: email.trim().toLowerCase(), telephone,
        status: 'actif', createdAt: new Date().toISOString(),
        commerciauxCount: 0,
      });
      setMsg('Responsable enregistré ! Il peut maintenant créer son compte sur doniel.art/responsable');
      setNom(''); setEmail(''); setTelephone(''); setPassword('');
    } catch(e: any) {
      setMsg('Erreur : ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800, marginBottom:20 }}>Responsables commerciaux</h2>

      {/* Formulaire création */}
      <div style={{ ...S.card, marginBottom:24 }}>
        <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Enregistrer un responsable commercial</p>
        <label style={S.lbl}>Nom complet *</label>
        <input style={S.inp} value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" />
        <label style={S.lbl}>Email *</label>
        <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" />
        <label style={S.lbl}>Téléphone</label>
        <input style={S.inp} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+225 07 00 00 00 00" />
        {msg && <p style={{ color: msg.includes('') ? '#00a040' : '#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
        <button style={{ ...S.btn, width:'100%', padding:12 }} onClick={creerCompte} disabled={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer le responsable'}
        </button>
        <p style={{ color:'#8098b8', fontSize:11, marginTop:8, textAlign:'center' }}>
          Il créera son mot de passe sur doniel.art/responsable
        </p>
      </div>

      {/* Liste responsables */}
      {responsables.length === 0 ? (
        <p style={{ color:'#8098b8', fontSize:13 }}>Aucun responsable commercial créé.</p>
      ) : responsables.map(r => (
        <div key={r.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{r.nom}</p>
              <p style={{ color:'#8098b8', fontSize:12, margin:'2px 0' }}>{r.email}</p>
              {r.telephone && <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>{r.telephone}</p>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#eaffea', border:'1px solid #4dff9a', borderRadius:99, padding:'3px 12px', fontSize:11, color:'#00a040', fontWeight:700 }}>
                Actif
              </span>
              {canDelete && <button onClick={async () => { if (window.confirm('Supprimer ce responsable ?')) await deleteDoc(doc(db, 'responsables', r.id)); }}
                style={{ ...S.btnRed, fontSize:11, padding:'4px 8px' }}>
                Supprimer
              </button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMMERCIAUX TAB — validation des demandes
// ─────────────────────────────────────────────
export function CommerciauxtTab({ db, canDelete }: { db: any, canDelete?: boolean }) {
  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [responsableEmail, setResponsableEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'commerciaux'), orderBy('createdAt', 'desc')),
      snap => setCommerciaux(snap.docs.map(d => ({id:d.id,...d.data()})))
    );
    return unsub;
  }, [db]);

  const valider = async (c: any) => {
    await updateDoc(doc(db, 'commerciaux', c.id), {
      status: 'valide',
      responsableEmail: responsableEmail || '',
      validatedAt: new Date().toISOString(),
    });
    setMsg('' + c.nom + ' validé !');
  };

  const refuser = async (c: any) => {
    await updateDoc(doc(db, 'commerciaux', c.id), { status: 'refuse' });
  };

  const enAttente = commerciaux.filter(c => c.status === 'en_attente');
  const valides = commerciaux.filter(c => c.status === 'valide');

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800 }}>Commerciaux</h2>
        <div style={{ display:'flex', gap:8 }}>
          <span style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:99, padding:'3px 12px', fontSize:12, color:'#b07a00', fontWeight:700 }}>
            {enAttente.length} en attente
          </span>
          <span style={{ background:'#eaffea', border:'1px solid #4dff9a', borderRadius:99, padding:'3px 12px', fontSize:12, color:'#00a040', fontWeight:700 }}>
            {valides.length} validés
          </span>
        </div>
      </div>

      {msg && <p style={{ color:'#1a6bff', fontSize:13, marginBottom:12 }}>{msg}</p>}

      {/* Email responsable optionnel */}
      <div style={{ ...S.card, background:'#f5f8ff', marginBottom:20 }}>
        <label style={S.lbl}>Email du responsable commercial (optionnel)</label>
        <input style={S.inp} type="email" value={responsableEmail} onChange={e => setResponsableEmail(e.target.value)}
          placeholder="responsable@email.com" />
        <p style={{ color:'#8098b8', fontSize:11 }}>Si renseigné, le commercial sera lié à ce responsable</p>
      </div>

      {/* EN ATTENTE */}
      {enAttente.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <p style={{ fontWeight:700, fontSize:13, color:'#b07a00', marginBottom:12 }}>En attente de validation</p>
          {enAttente.map(c => (
            <div key={c.id} style={{ ...S.card, marginBottom:10, borderLeft:'3px solid #f0b84a' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{c.nom}</p>
                  <p style={{ color:'#8098b8', fontSize:12, margin:'2px 0' }}>{c.email}</p>
                  <p style={{ margin:'2px 0 0' }}><WhatsAppLink numero={c.telephone} /></p>
                  <p style={{ color:'#b0c4d8', fontSize:10, marginTop:4 }}>{new Date(c.createdAt).toLocaleDateString('fr')}</p>
                  {(c.methode || c.cible || c.objectif || c.commune) && (
                    <div style={{ background:'#f5f8ff', borderRadius:10, padding:'8px 10px', marginTop:8 }}>
                      {c.commune && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 3px' }}><strong>Commune :</strong> {c.commune}</p>}
                      {c.methode && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 3px' }}><strong>Prospection :</strong> {c.methode}</p>}
                      {c.cible && <p style={{ fontSize:11, color:'#5a7090', margin:'0 0 3px' }}><strong>Cibles :</strong> {c.cible}</p>}
                      {c.objectif && <p style={{ fontSize:11, color:'#5a7090', margin:0 }}><strong>Objectif/mois :</strong> {c.objectif} créateurs</p>}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:200 }}>
                  <input
                    placeholder="Email responsable (optionnel)"
                    style={{ ...S.inp, fontSize:11, padding:'6px 10px' }}
                    defaultValue={responsableEmail}
                    onChange={e => setResponsableEmail(e.target.value)}
                  />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => valider(c)} style={{ ...S.btn, fontSize:12, padding:'6px 14px' }}>Valider</button>
                    <button onClick={() => refuser(c)} style={{ ...S.btnRed, fontSize:12, padding:'6px 14px' }}>Refuser</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VALIDÉS */}
      {valides.length > 0 && (
        <div>
          <p style={{ fontWeight:700, fontSize:13, color:'#00a040', marginBottom:12 }}>Commerciaux validés</p>
          {valides.map(c => (
            <div key={c.id} style={{ ...S.card, marginBottom:10, borderLeft:'3px solid #4dff9a' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:14, margin:0 }}>{c.nom}</p>
                  <p style={{ color:'#8098b8', fontSize:12, margin:'2px 0' }}>{c.email}</p>
                  {c.telephone && <p style={{ margin:'2px 0' }}><WhatsAppLink numero={c.telephone} size={12} /></p>}
                  {c.responsableEmail && <p style={{ color:'#8098b8', fontSize:11, margin:0 }}>Responsable : {c.responsableEmail}</p>}
                  <p style={{ color:'#b0c4d8', fontSize:10, margin:'2px 0 0' }}>Validé le {new Date(c.validatedAt||c.createdAt).toLocaleDateString('fr')}</p>
                  <BoutonResetAdmin email={c.email} />
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ background:'#eaffea', border:'1px solid #4dff9a', borderRadius:99, padding:'3px 12px', fontSize:11, color:'#00a040', fontWeight:700 }}>
                    Validé
                  </span>
                  {canDelete && <button onClick={async () => {
                    if (window.confirm(`Supprimer ${c.nom} ? Cette action est irréversible.`)) {
                      await deleteDoc(doc(db, 'commerciaux', c.id));
                    }
                  }} style={{ ...S.btnRed, fontSize:11, padding:'4px 8px' }}>Supprimer</button>}
                  <button onClick={async () => {
                    await updateDoc(doc(db,'commerciaux',c.id),{ status:'suspendu' });
                  }} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #f0b84a', background:'rgba(240,184,74,0.1)', color:'#b07a00', fontSize:11, cursor:'pointer' }}>
                    Suspendre
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {commerciaux.length === 0 && (
        <div style={{ ...S.card, textAlign:'center', padding:40 }}>
          <p style={{ color:'#5a7090', fontSize:14 }}>Aucune demande pour l'instant</p>
        </div>
      )}
    </div>
  );
}

export function ArtistesTab({ db, qrcodes, canDelete }: { db: any, qrcodes: any[], canDelete?: boolean }) {
  const [artistes, setArtistes] = useState<any[]>([]);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artists'), orderBy('name', 'asc')),
      snap => setArtistes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [db]);

  const addArtiste = async () => {
    if (!nom.trim() || !email.trim()) { setMsg('Nom et email requis'); return; }
    setLoading(true); setMsg('');
    try {
      // Vérifier si email déjà enregistré
      const existing = await getDocs(query(collection(db, 'artists'), where('email','==', email.trim().toLowerCase())));
      if (!existing.empty) { setMsg('Cet email est déjà enregistré'); setLoading(false); return; }
      await addDoc(collection(db, 'artists'), {
        name: nom.trim(),
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
      });
      notifierAdminEnregistrement('Nouvel artiste', `${nom.trim()} (${email.trim().toLowerCase()})`);
      setMsg('Artiste enregistré ! Il peut maintenant créer son compte sur /artiste');
      setNom(''); setEmail('');
    } catch(e:any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  const filtered = artistes.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800 }}>Artistes enregistrés</h2>
        <span style={{ background:'#eaf1ff', border:'1px solid #c8d8ef', borderRadius:99, padding:'3px 12px', fontSize:12, color:'#1a6bff', fontWeight:700 }}>
          {artistes.length} artiste{artistes.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* FORMULAIRE AJOUT */}
      <div style={{ ...S.card, marginBottom:20, background:'#f5f8ff' }}>
        <p style={{ fontWeight:700, fontSize:14, marginBottom:14, color:'#1a2340' }}>Enregistrer un nouvel artiste</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div>
            <label style={S.lbl}>Nom d'artiste *</label>
            <input style={S.inp} value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex: Élite Doniel" onKeyDown={e => e.key==='Enter' && addArtiste()} />
          </div>
          <div>
            <label style={S.lbl}>Email *</label>
            <input style={{ ...S.inp, marginBottom:0 }} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="artiste@email.com" onKeyDown={e => e.key==='Enter' && addArtiste()} />
          </div>
        </div>
        {msg && <p style={{ color: msg.startsWith('')?'#1a6bff':'#f04a6a', fontSize:12, marginBottom:10 }}>{msg}</p>}
        <button style={{ ...S.btn, padding:'10px 24px' }} onClick={addArtiste} disabled={loading}>
          {loading ? '...' : 'Enregistrer'}
        </button>
        <p style={{ color:'#8098b8', fontSize:11, marginTop:10 }}>
          Après enregistrement, l'artiste peut aller sur <strong>/artiste</strong> et créer son compte avec cet email.
        </p>
      </div>

      {/* RECHERCHE */}
      <input style={{ ...S.inp, marginBottom:16 }} value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un artiste..." />

      {/* LISTE */}
      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign:'center', padding:40 }}>
          <p style={{ color:'#5a7090', fontSize:14 }}>Aucun artiste enregistré</p>
        </div>
      ) : filtered.map(a => {
        // Compter les QR codes de cet artiste
        const artistQRs = qrcodes.filter(q => q.artistEmail === a.email || q.artist === a.name);
        const totalStreams = artistQRs.reduce((s:number, q:any) => s + (q.streams||0), 0);
        const totalDL = artistQRs.reduce((s:number, q:any) => s + (q.downloads||q.usedScans||0), 0);

        return (
          <div key={a.id} style={{ ...S.card, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:99, background:'linear-gradient(135deg,#eaf1ff,#c8d8ef)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  
                </div>
                <div>
                  <p style={{ fontWeight:800, fontSize:15, marginBottom:2 }}>{a.name}</p>
                  <p style={{ color:'#8098b8', fontSize:12 }}>{a.email}</p>
                  {a.whatsapp && <p style={{ margin:'2px 0 0' }}><WhatsAppLink numero={a.whatsapp} size={12} /></p>}
                  <p style={{ color:'#b0c4d8', fontSize:10, marginTop:2 }}>
                    Enregistré le {new Date(a.createdAt).toLocaleDateString('fr')}
                    {a.uid && <span style={{ marginLeft:8, color:'#4dff9a', fontWeight:700 }}>Compte créé</span>}
                  </p>
                  <BoutonResetAdmin email={a.email} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {!a.uid && (
                  <span style={{ background:'#fff8e6', border:'1px solid #f0b84a', borderRadius:99, padding:'2px 10px', fontSize:10, color:'#b07a00', fontWeight:700 }}>
                    En attente
                  </span>
                )}
                {canDelete ? (
                  <>
                    <button onClick={async () => {
                      if (window.confirm(`BANNIR ${a.name} ?\n\nCela supprimera l'artiste ET tout son contenu (QR codes, liens publics, contenus Découvrir). Action irréversible.`)) {
                        const qrSnap = await getDocs(query(collection(db,'qrcodes'), where('artistEmail','==',a.email)));
                        for (const d of qrSnap.docs) await deleteDoc(doc(db,'qrcodes',d.id));
                        const plSnap = await getDocs(query(collection(db,'publicLinks'), where('artistEmail','==',a.email)));
                        for (const d of plSnap.docs) await deleteDoc(doc(db,'publicLinks',d.id));
                        const decSnap = await getDocs(query(collection(db,'decouvrir'), where('artistEmail','==',a.email)));
                        for (const d of decSnap.docs) await deleteDoc(doc(db,'decouvrir',d.id));
                        await deleteDoc(doc(db,'artists',a.id));
                        setMsg(`${a.name} et tout son contenu ont été bannis.`);
                      }
                    }} style={{ background:'#7a0000', color:'#fff', border:'none', borderRadius:8, fontSize:11, padding:'4px 10px', cursor:'pointer', fontWeight:700 }}>
                      Bannir
                    </button>
                    <button onClick={() => { if (window.confirm(`Supprimer ${a.name} de la liste (sans toucher au contenu) ?`)) deleteDoc(doc(db,'artists',a.id)); }}
                      style={{ ...S.btnRed, fontSize:11, padding:'4px 8px' }}>Retirer</button>
                  </>
                ) : (
                  <button onClick={async () => {
                    await addDoc(collection(db,'signalements'), {
                      type:'artiste', cible: a.email, nom: a.name,
                      signalePar: auth.currentUser?.email, createdAt: new Date().toISOString(), statut:'nouveau'
                    });
                    setMsg(`${a.name} signalé au super admin pour étude.`);
                  }} style={{ background:'#fff3e0', color:'#b07a00', border:'1px solid #f0b84a', borderRadius:8, fontSize:11, padding:'4px 10px', cursor:'pointer', fontWeight:700 }}>
                    Signaler
                  </button>
                )}
              </div>
            </div>

            {/* Stats rapides */}
            {artistQRs.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
                {[
                  { label:'QR codes', val:artistQRs.length, color:'#1a6bff' },
                  { label:'Streams', val:totalStreams, color:'#b07a00' },
                  { label:'Téléchargements', val:totalDL, color:'#1a6bff' },
                ].map((s,i) => (
                  <div key={i} style={{ background:'#f5f8ff', borderRadius:8, padding:'8px', textAlign:'center' }}>
                    <p style={{ fontWeight:800, fontSize:16, color:s.color, margin:0 }}>{s.val}</p>
                    <p style={{ color:'#8098b8', fontSize:9, margin:'2px 0 0' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ArtistFolder({ artist, qrcodes, activeCount, lockedCount, onEdit, onQrModal, onBulk, onToggle, onDelete }:
  { artist: string, qrcodes: any[], activeCount: number, lockedCount: number,
    onEdit: (q: any) => void, onQrModal: (q: any) => void, onBulk: (q: any) => void,
    onToggle: (q: any) => void, onDelete: (id: string) => void }) {
  // Fermé par défaut : un artiste avec des centaines/milliers de QR codes
  // (génération en masse) n'affiche plus tout d'un coup au chargement de la
  // page — il faut cliquer pour ouvrir son dossier.
  const [open, setOpen] = useState(false);
  // Dans un dossier ouvert, on n'affiche que les N premiers QR codes, avec un
  // bouton pour en charger plus — évite d'afficher 1000 lignes d'un coup.
  const [visibles, setVisibles] = useState(50);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* EN-TÊTE DOSSIER ARTISTE */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: open ? '12px 12px 0 0' : 12, background: '#ffffff', border: '1px solid #c8d8ef', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{open ? '' : ''}</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{artist}</p>
            <p style={{ color: '#8098b8', fontSize: 11, marginTop: 2 }}>
              {qrcodes.length} QR code{qrcodes.length > 1 ? 's' : ''} · 
              <span style={{ color: '#1a6bff' }}>{activeCount} actif{activeCount > 1 ? 's' : ''}</span>
              {lockedCount > 0 && <span style={{ color: '#b07a00' }}> · {lockedCount} bloqué{lockedCount > 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <span style={{ color: '#8098b8', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* LISTE QR CODES DU DOSSIER */}
      {open && (
        <div style={{ border: '1px solid #c8d8ef', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {qrcodes.slice(0, visibles).map((q, i) => {
            const isLocked = q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1);
            return (
              <div key={q.id} style={{ padding: '16px 18px', borderTop: i === 0 ? 'none' : '1px solid #dce6f7', background: isLocked ? '#fffdf5' : '#fafcff' }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* QR CODE IMAGE */}
                  <div style={{ background: 'white', padding: 7, borderRadius: 8, flexShrink: 0, cursor: 'pointer' }} onClick={() => onQrModal(q)}>
                    <QRCodeSVG value={q.url} size={68} bgColor="#ffffff" fgColor="#060a14" />
                    <p style={{ color: '#060a14', fontSize: 8, textAlign: 'center', marginTop: 2, fontWeight: 700 }}>{q.qrId}</p>
                  </div>
                  {/* INFOS */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{q.label}</span>
                      <span style={badgeStyle(isLocked ? 'locked' : 'active')}>{isLocked ? 'Bloqué' : 'Actif'}</span>
                      <span style={{ fontFamily: 'monospace', color: '#1a6bff', fontSize: 11, fontWeight: 700 }}>{q.qrId}</span>
                    </div>
                    <p style={{ color: '#5a7090', fontSize: 12, marginBottom: 4 }}>{q.type} · {(q.price || 0).toLocaleString()} FCFA</p>
                    <p style={{ color: '#8098b8', fontSize: 11, marginBottom: 6 }}>
                      {q.fileCount || 0} fichier(s) · {q.usedScans || 0}/{q.totalScans || 0} scans · {(q.downloads !== undefined ? q.downloads : (q.usedScans || 0))} DL · {q.visits || 0} visites · {q.streams || 0} streams
                    </p>
                    <div style={{ height: 3, background: '#dce6f7', borderRadius: 99, marginBottom: 4 }}>
                      <div style={{ height: '100%', width: Math.min(100, Math.round(((q.usedScans || 0) / (q.totalScans || 1)) * 100)) + '%', background: isLocked ? '#f04a6a' : '#1a6bff', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {q.streams > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f5f8ff', color: '#b07a00' }}>{q.streams} streams</span>}
                      {q.validStreams > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#eaf1ff', color: '#1a6bff' }}>{q.validStreams} validés</span>}
                    </div>
                  </div>
                  {/* ACTIONS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button style={{ ...S.btn, padding: '6px 10px', fontSize: 11 }} onClick={() => onQrModal(q)}>QR PNG</button>
                    <button style={{ background: '#1a1a2e', border: '1px solid #4a4af0', color: '#a0a0ff', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }} onClick={() => onBulk(q)}>Masse</button>
                    <button style={{ ...S.btn2, fontSize: 11 }} onClick={() => onEdit(q)}>{isLocked ? 'Réactiver' : '✏Modifier'}</button>
                    <button style={isLocked ? { ...S.btn2, color: '#1a6bff', borderColor: '#4da6ff', fontSize: 11 } : { ...S.btn2, color: '#b07a00', borderColor: '#f0b84a', fontSize: 11 }}
                      onClick={() => onToggle(q)}>
                      {isLocked ? 'Activer' : 'Bloquer'}
                    </button>
                    <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => onDelete(q.id)}></button>
                  </div>
                </div>
              </div>
            );
          })}
          {visibles < qrcodes.length && (
            <button onClick={() => setVisibles(v => v + 50)}
              style={{ width: '100%', padding: 12, border: 'none', borderTop: '1px solid #dce6f7', background: '#f5f8ff', color: '#1a6bff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Charger 50 de plus ({qrcodes.length - visibles} restants)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────
// HOOK — charger une pub active aléatoire
// ─────────────────────────────────────────────
export function useActivePub() {
  const [pub, setPub] = useState<any>(null);
  useEffect(() => {
    getDocs(query(collection(db, 'pubs'), where('active','==',true)))
      .then(snap => {
        if (snap.empty) return;
        const list = snap.docs.map(d => ({id:d.id,...d.data()}));
        setPub(list[Math.floor(Math.random()*list.length)]);
      }).catch(()=>{});
  }, []);
  return pub;
}

// ─────────────────────────────────────────────
// PUB OVERLAY — 2 pubs en séquence
// Règle Doniel Zik : bouton Passer après 8s toujours
// Durée pub : 30s — si pas de clic Passer, pub suivante automatique
// ─────────────────────────────────────────────
export function PubOverlay({ trigger, onDone, silent }: { trigger: 'page'|'play'|'download'|'track'|'audio_during', onDone: () => void, silent?: boolean }) {
  const [pubs, setPubs] = useState<any[]>([]);
  const [pubIndex, setPubIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0); // secondes écoulées sur la pub courante
  const [dismissed, setDismissed] = useState(false);

  const PUB_DURATION = 30; // durée totale par pub
  const SKIP_AFTER = 5;    // bouton Passer disponible après 5s — règle Doniel Zik

  // Charger 2 pubs actives
  useEffect(() => {
    getDocs(query(collection(db, 'pubs'), where('active','==',true)))
      .then(snap => {
        if (snap.empty) { onDone(); return; }
        const list = snap.docs.map(d => ({id:d.id,...d.data()}));
        const shuffled = list.sort(() => Math.random() - 0.5);
        setPubs(shuffled.slice(0, 2));
      }).catch(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pub = pubs[pubIndex];

  // Compter la vue
  // Précharger l'image dès le montage
  useEffect(() => {
    if (!pub) return;
    if (pub.imageUrl) {
      const img = new Image();
      img.src = pub.imageUrl;
    }
    updateDoc(doc(db,'pubs',pub.id),{vues:(pub.vues||0)+1}).catch(()=>{});
    setElapsed(0); // reset chrono à chaque nouvelle pub
  }, [pub?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chrono — 1 tick par seconde
  useEffect(() => {
    if (!pub || dismissed) return;
    if (elapsed >= PUB_DURATION) {
      // Pub terminée — passer à la suivante ou finir
      if (pubIndex < pubs.length - 1) {
        setPubIndex(i => i + 1);
      } else {
        onDone();
      }
      return;
    }
    const t = setTimeout(() => setElapsed(e => e + 1), 1000);
    return () => clearTimeout(t);
  }, [elapsed, pub, dismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = async () => {
    if (!pub) return;
    try { await updateDoc(doc(db,'pubs',pub.id),{clics:(pub.clics||0)+1}); } catch(e){}
    if (pub.lienType==='tel') window.location.href=`tel:${pub.lien}`;
    else if (pub.lienType==='whatsapp') window.open(`https://wa.me/${pub.lien.replace(/\D/g,'')}`, '_blank');
    else window.open(pub.lien, '_blank');
  };

  const handleSkip = () => {
    if (elapsed < SKIP_AFTER) return;
    if (pubIndex < pubs.length - 1) {
      setPubIndex(i => i + 1);
    } else {
      setDismissed(true);
      onDone();
    }
  };

  if (!pub || dismissed) return null;

  const canSkip = elapsed >= SKIP_AFTER;
  const isLastPub = pubIndex === pubs.length - 1;
  const remaining = PUB_DURATION - elapsed;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 16px' }}>
      <style>{`@keyframes pubIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Indicateur 1/2 · 2/2 */}
      {pubs.length > 1 && (
        <div style={{ display:'flex', gap:6, marginBottom:12, width:'100%', maxWidth:500 }}>
          {pubs.map((_,i) => (
            <div key={i} style={{ flex:1, height:3, borderRadius:99, background: i < pubIndex ? '#fff' : i === pubIndex ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)', position:'relative', overflow:'hidden' }}>
              {i === pubIndex && (
                <div style={{ position:'absolute', left:0, top:0, height:'100%', background:'#fff', width: (elapsed/PUB_DURATION*100)+'%', transition:'width 1s linear' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pub cliquable */}
      <div key={pubIndex} style={{ width:'100%', maxWidth:500, animation:'pubIn .3s ease', cursor:'pointer', position:'relative' }}
        onClick={handleClick}>
      {pub.imageUrl ? (
          pub.mediaType === 'video' ? (
            <video
              src={pub.imageUrl}
              autoPlay
              muted={silent || false}
              playsInline
              style={{ width:'100%', height:'75vh', display:'block', borderRadius:12, background:'#000', objectFit:'contain' }}
              onEnded={() => {
                if (pubIndex < pubs.length - 1) setPubIndex(i => i + 1);
                else onDone();
              }}
            />
          ) : (
            <img src={pub.imageUrl} alt={pub.titre||'Pub'} style={{ width:'100%', height:'75vh', objectFit:'contain', display:'block', borderRadius:12, background:'#000' }}
              onContextMenu={e => e.preventDefault()}
              draggable={false} />
          )
        ) : (
          <div style={{ width:'100%', height:240, borderRadius:12, background:'linear-gradient(135deg,#0d1535,#1a3a6e)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <p style={{ color:'rgba(255,255,255,0.3)', fontSize:14 }}>Publicité</p>
          </div>
        )}

        {/* Overlay texte */}
        {(pub.titre||pub.sousTitre) && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.85))', padding:'32px 16px 14px', borderRadius:'0 0 12px 12px' }}>
            {pub.titre && <p style={{ color:'#fff', fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{pub.titre}</p>}
            {pub.sousTitre && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12, margin:0 }}>{pub.sousTitre}</p>}
          </div>
        )}

        {/* Badge PUB */}
        <div style={{ position:'absolute', top:10, left:12, background:'transparent', border:'1px solid rgba(255,255,255,0.4)', borderRadius:4, padding:'2px 8px', display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:9, fontWeight:700, letterSpacing:1 }}>PUB</span>
          {pubs.length > 1 && <span style={{ color:'rgba(255,255,255,0.5)', fontSize:9 }}>{pubIndex+1}/{pubs.length}</span>}
        </div>

        {/* Bouton action */}
        {pub.lien && (
          <div style={{ position:'absolute', bottom:14, right:12 }}>
            <span style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'5px 12px', color:'#fff', fontSize:12, fontWeight:700 }}>
              {pub.lienType==='tel'?'Appeler':pub.lienType==='whatsapp'?'WhatsApp':'Voir'}
            </span>
          </div>
        )}
      </div>

      {/* Grand bouton d'action — apparaît à la fin des 30 secondes */}
      {elapsed >= PUB_DURATION && pub.lien && (
        <div style={{ width:'100%', maxWidth:500, marginTop:12 }}>
          <button onClick={handleClick}
            style={{ width:'100%', padding:'18px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#1a6bff,#0050d0)', color:'#fff', fontWeight:800, fontSize:17, cursor:'pointer', letterSpacing:0.5, boxShadow:'0 4px 20px rgba(30,111,255,0.5)', animation:'pubIn .4s ease' }}>
            {pub.btnLabel || (pub.lienType==='tel' ? 'Appeler maintenant' : pub.lienType==='whatsapp' ? 'Discuter maintenant' : 'Plus d\'infos')}
          </button>
        </div>
      )}

      {/* Bouton Passer / compteur */}
      <div style={{ marginTop:14, display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', maxWidth:500 }}>
        <span style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>{remaining}s</span>
        {!canSkip ? (
          <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:8, padding:'7px 16px' }}>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>Passer dans {SKIP_AFTER - elapsed}s</span>
          </div>
        ) : (
          <button onClick={handleSkip}
            style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'8px 18px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {isLastPub ? 'Ignorer et continuer' : 'Passer ›'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PUB BANNER — DÉSACTIVÉ (plus de pub ouverture/inactivité)
// ─────────────────────────────────────────────
export function PubBanner() {
  return null;
}


// ─────────────────────────────────────────────
// PUB OSCART — l'admin s'auto-crédite en Oscart pour la publicité
// (envoyer des cadeaux/kiffements aux artistes en démonstration)
// ─────────────────────────────────────────────
export function PubOscartTab({ user }: { user: any }) {
  const [montant, setMontant] = useState('');
  const [emailCible, setEmailCible] = useState('');
  const [solde, setSolde] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user?.email) setEmailCible(user.email); }, [user]);

  const chargerSolde = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
      if (!snap.empty) setSolde(snap.docs[0].data().solde || 0);
      else setSolde(0);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { chargerSolde(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const crediter = async () => {
    const m = parseInt(montant, 10);
    if (!m || m <= 0) { setMsg('Entrez un montant valide.'); return; }
    const cible = (emailCible || '').trim().toLowerCase();
    if (!cible) { setMsg('Entrez l email du compte a crediter.'); return; }
    if (!user) return;
    setLoading(true);
    setMsg('');
    try {
      const monCompte = cible === (user.email || '').toLowerCase();
      let docId: string | null = null;
      let cur: any = null;
      let uidCible: string | null = monCompte ? user.uid : null;
      let trouveVia = '';

      // 1. Mon propre compte : chercher par uid
      if (monCompte) {
        const s = await getDocs(query(collection(db,'coins_solde'), where('uid','==',user.uid)));
        if (!s.empty) { docId = s.docs[0].id; cur = s.docs[0].data(); trouveVia = 'uid'; }
      }
      // 2. Chercher coins_solde par email
      if (!docId) {
        const s = await getDocs(query(collection(db,'coins_solde'), where('email','==',cible)));
        if (!s.empty) { docId = s.docs[0].id; cur = s.docs[0].data(); trouveVia = 'email'; }
      }
      // 3. Retrouver l'uid via la fiche artiste, puis chercher coins_solde par uid
      if (!docId) {
        const art = await getDocs(query(collection(db,'artists'), where('email','==',cible)));
        if (!art.empty) {
          const uidArt = art.docs[0].data().uid;
          if (uidArt) {
            uidCible = uidArt;
            const s = await getDocs(query(collection(db,'coins_solde'), where('uid','==',uidArt)));
            if (!s.empty) { docId = s.docs[0].id; cur = s.docs[0].data(); trouveVia = 'artiste-uid'; }
          }
        }
      }

      // Mettre a jour le portefeuille existant, sinon en creer un (avec email + uid si connu)
      if (docId) {
        const maj: any = { solde: (cur?.solde || 0) + m, email: cur?.email || cible };
        if (uidCible && !cur?.uid) maj.uid = uidCible;
        await updateDoc(doc(db,'coins_solde',docId), maj);
      } else {
        const nouveau: any = { email: cible, solde: m, createdAt: new Date().toISOString() };
        if (uidCible) nouveau.uid = uidCible;
        await addDoc(collection(db,'coins_solde'), nouveau);
        trouveVia = uidCible ? 'nouveau-avec-uid' : 'nouveau-email-seul';
      }
      try { logTx(user.uid, 'pub_oscart_admin', m, 0, `Credit Oscart pub vers ${cible}`); } catch(_) {}
      const note = (trouveVia === 'nouveau-email-seul')
        ? ' (l artiste verra ses Oscart des sa prochaine connexion)'
        : '';
      setMsg(`${m.toLocaleString()} Oscart ajoutes au compte ${cible}.${note}`);
      setMontant('');
      chargerSolde();
    } catch(e: any) {
      console.error(e);
      setMsg('Erreur : ' + (e?.message || e?.code || 'credit impossible') + '. Verifiez que l email est correct.');
    }
    setLoading(false);
  };


  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 6px', color:'#1a2340', fontSize:18 }}>Oscart pour la publicite</h3>
      <p style={{ color:'#5a7090', fontSize:13, margin:'0 0 18px', lineHeight:1.5 }}>
        Creditez n importe quel compte (melomane ou artiste) en Oscart. Mettez l email du
        tableau de bord de l artiste pour qu il puisse publier ses contenus. Par defaut votre
        propre compte est pre-rempli.
      </p>

      <div style={{ background:'#eaf1ff', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
        <span style={{ color:'#5a7090', fontSize:12 }}>Votre solde actuel</span>
        <div style={{ color:'#1a6bff', fontWeight:800, fontSize:24 }}>
          {solde === null ? '...' : solde.toLocaleString()} <span style={{ fontSize:14, fontWeight:600 }}>Oscart</span>
        </div>
        <span style={{ color:'#8098b8', fontSize:11 }}>~ {solde === null ? '...' : (solde * 10).toLocaleString()} F CFA</span>
      </div>

      <label style={S.lbl}>Email du compte a crediter (melomane ou artiste)</label>
      <input style={S.inp} type="email" placeholder="email@exemple.com" value={emailCible} onChange={e => setEmailCible(e.target.value)} />

      <label style={S.lbl}>Montant a ajouter (en Oscart)</label>
      <input style={S.inp} type="number" min="1" placeholder="Ex : 5000" value={montant} onChange={e => setMontant(e.target.value)} />
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {[1000, 5000, 10000].map(v => (
          <button key={v} onClick={() => setMontant(String(v))} style={S.btn2}>+{v.toLocaleString()}</button>
        ))}
      </div>
      <button onClick={crediter} disabled={loading} style={{ ...S.btn, width:'100%', padding:13, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Credit en cours...' : 'Crediter ce compte'}
      </button>
      {msg && <p style={{ color: msg.startsWith('') ? '#1a6bff' : '#e04060', fontSize:13, marginTop:12, textAlign:'center' }}>{msg}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CONFIG CONCOURS — l'admin modifie les paliers de prix (sans coder)
// ─────────────────────────────────────────────
export function ConcoursConfigTab() {
  const [paliers, setPaliers] = useState(PALIERS_CONCOURS_DEFAUT);
  const [docId, setDocId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'config'), where('cle','==','concours_paliers')));
        if (!snap.empty) {
          setDocId(snap.docs[0].id);
          const data = snap.docs[0].data();
          if (Array.isArray(data.paliers) && data.paliers.length > 0) setPaliers(data.paliers);
        }
      } catch(e) { console.error(e); }
    })();
  }, []);

  const majPalier = (i: number, champ: string, valeur: any) => {
    setPaliers(prev => prev.map((p, idx) => idx === i ? { ...p, [champ]: valeur } : p));
  };
  const ajouterPalier = () => {
    setPaliers(prev => [...prev, { kifs: 0, type: 'cash', valeur: 0, label: '', icone: '' }]);
  };
  const supprimerPalier = (i: number) => {
    setPaliers(prev => prev.filter((_, idx) => idx !== i));
  };

  const enregistrer = async () => {
    setLoading(true);
    try {
      const tries = [...paliers].sort((a, b) => a.kifs - b.kifs);
      if (docId) {
        await updateDoc(doc(db, 'config', docId), { paliers: tries, maj: new Date().toISOString() });
      } else {
        const ref = await addDoc(collection(db, 'config'), { cle: 'concours_paliers', paliers: tries, maj: new Date().toISOString() });
        setDocId(ref.id);
      }
      setPaliers(tries);
      setMsg('Paliers enregistres. Ils sont maintenant visibles par les artistes.');
      setTimeout(() => setMsg(''), 4000);
    } catch(e) { console.error(e); setMsg('Erreur lors de l enregistrement.'); }
    setLoading(false);
  };

  const reset = () => setPaliers(PALIERS_CONCOURS_DEFAUT);

  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 6px', color:'#1a2340', fontSize:18 }}>Paliers de la Rémunération Kiffs</h3>
      <p style={{ color:'#5a7090', fontSize:13, margin:'0 0 18px', lineHeight:1.5 }}>
        Modifiez librement les paliers de kiffs et les prix associes. Les artistes voient ces recompenses
        dans leur tableau de bord. Type "cash" = montant en FCFA, Type "objet" = recompense physique.
      </p>

      {paliers.map((p, i) => (
        <div key={i} style={{ background:'#f7f9fc', borderRadius:12, padding:14, marginBottom:12, border:'1px solid #eef2f9' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a2340' }}>Palier {i + 1}</span>
            <button onClick={() => supprimerPalier(i)} style={S.btnRed}>Supprimer</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={S.lbl}>Icone</label>
              <input style={S.inp} value={p.icone} onChange={e => majPalier(i, 'icone', e.target.value)} placeholder="trophee" />
            </div>
            <div>
              <label style={S.lbl}>Nombre de kiffs</label>
              <input style={S.inp} type="number" value={p.kifs} onChange={e => majPalier(i, 'kifs', parseInt(e.target.value,10) || 0)} />
            </div>
            <div>
              <label style={S.lbl}>Type</label>
              <select style={S.inp} value={p.type} onChange={e => majPalier(i, 'type', e.target.value)}>
                <option value="cash">Cash (FCFA)</option>
                <option value="objet">Objet (voiture...)</option>
              </select>
            </div>
            <div>
              <label style={S.lbl}>Valeur (si cash, en FCFA)</label>
              <input style={S.inp} type="number" value={p.valeur} onChange={e => majPalier(i, 'valeur', parseInt(e.target.value,10) || 0)} />
            </div>
          </div>
          <label style={S.lbl}>Libelle affiche</label>
          <input style={S.inp} value={p.label} onChange={e => majPalier(i, 'label', e.target.value)} placeholder="Ex : 100 000 F CFA" />
        </div>
      ))}

      <button onClick={ajouterPalier} style={{ ...S.btn2, width:'100%', padding:12, marginBottom:12 }}>+ Ajouter un palier</button>

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={enregistrer} disabled={loading} style={{ ...S.btn, flex:1, padding:13, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Enregistrement...' : 'Enregistrer les paliers'}
        </button>
        <button onClick={reset} style={{ ...S.btn2, padding:13 }}>Reinitialiser</button>
      </div>
      {msg && <p style={{ color: msg.startsWith('') ? '#1a6bff' : '#e04060', fontSize:13, marginTop:12, textAlign:'center' }}>{msg}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// NOTIFICATIONS ÉDUCATIVES — l'admin envoie un message général à tous les mélomanes
// ─────────────────────────────────────────────
export function NotifsEducativesTab() {
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');

  // Messages éducatifs prêts à l'emploi (1 clic)
  const MODELES = [
    "Le savais-tu ? Un kiffement, c'est un cadeau que tu offres à ton artiste pour le soutenir. Plus tu en envoies, plus tu l'aides à réussir !",
    "Pour soutenir tes artistes, recharge tes Oscart ! Va dans ta Zikothèque, choisis ta recharge et obtiens tes Oscart en quelques secondes.",
    "Recharge tes Oscart et télécharge la musique de tes artistes préférés pour l'écouter partout, même hors connexion !",
    "Recharge tes Oscart puis offre des kiffements à ton artiste : c'est le meilleur moyen de le soutenir et de le faire grandir.",
    "Offre des kiffements à ton artiste : à chaque cadeau, tu gagnes aussi des kiffs et tu augmentes tes chances de récompenses exclusives !",
    "Ne rate aucune sortie ! Réserve ou pré-télécharge la prochaine musique de ton artiste avant tout le monde.",
    "Cherche ton artiste préféré ! Tape son nom dans la barre de recherche et retrouve toute sa musique sur Doniel Zik.",
    "Doniel Zik, ce n'est pas que la musique ! Découvre l'humour, les clips et les vidéos de tes créateurs préférés.",
    "Tu as un talent artistique ? Publie ton contenu sur Doniel Zik et obtiens le maximum de visibilité et de revenus. Qu'attends-tu ?",
  ];

  const envoyer = async (texte: string) => {
    if (!texte.trim()) { setMsg('Écrivez un message.'); return; }
    setEnvoi(true); setMsg('');
    try {
      await envoyerNotification({
        to: 'all', type:'educative',
        text: texte.trim(),
        createdAt: new Date().toISOString(),      });
      setMsg('Notification envoyée à tous les mélomanes.');
      setMessage('');
    } catch(e:any) { setMsg('Erreur : ' + (e?.message || '')); }
    setEnvoi(false);
  };

  const [effacement, setEffacement] = useState(false);
  const effacerToutesNotifs = async () => {
    if (!window.confirm('Effacer TOUTES les notifications de TOUS les comptes ? Cette action est définitive et ne peut pas être annulée.')) return;
    setEffacement(true); setMsg('');
    try {
      let total = 0;
      // On efface par lots jusqu'à ce qu'il ne reste plus rien
      while (true) {
        const snap = await getDocs(query(collection(db,'notifications'), limit(300)));
        if (snap.empty) break;
        for (const d of snap.docs) { await deleteDoc(doc(db,'notifications', d.id)); total++; }
        if (snap.size < 300) break;
      }
      setMsg(`${total} notification(s) effacée(s). Tout est propre.`);
    } catch(e:any) { setMsg('Erreur : ' + (e?.message || '')); }
    setEffacement(false);
  };

  return (
    <div>
      <h3 style={{ margin:'0 0 6px', color:'#1a2340', fontSize:18 }}>Notifications à tous</h3>
      <p style={{ color:'#5a7090', fontSize:13, marginBottom:16 }}>
        Envoyez un message à tous les mélomanes (encouragement à envoyer des kiffements, annonces...). Il apparaît dans l'onglet "Général" de leurs notifications.
      </p>

      <textarea value={message} onChange={e => setMessage(e.target.value)}
        placeholder="Écrivez votre message..."
        style={{ width:'100%', minHeight:90, background:'#fff', border:'1px solid #d0d8e8', borderRadius:10, padding:'12px 14px', color:'#1a2340', fontSize:14, boxSizing:'border-box' as any, resize:'none' as any, marginBottom:10 }} />
      <button onClick={() => envoyer(message)} disabled={envoi}
        style={{ width:'100%', padding:13, borderRadius:10, border:'none', background: envoi ? '#9bb' : '#1a6bff', color:'#fff', fontWeight:800, fontSize:14, cursor: envoi ? 'wait' : 'pointer', marginBottom:8 }}>
        {envoi ? 'Envoi...' : 'Envoyer à tous'}
      </button>
      {msg && <p style={{ color: msg.startsWith('Erreur') ? '#d04a6a' : '#00a050', fontSize:13, textAlign:'center', marginBottom:14 }}>{msg}</p>}

      <p style={{ color:'#5a7090', fontSize:12, fontWeight:700, margin:'18px 0 8px' }}>Messages prêts (1 clic) :</p>
      {MODELES.map((m, i) => (
        <div key={i} style={{ background:'#f4f7fc', border:'1px solid #e0e8f4', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
          <p style={{ color:'#3a4560', fontSize:13, lineHeight:1.5, margin:'0 0 8px' }}>{m}</p>
          <button onClick={() => envoyer(m)} disabled={envoi}
            style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
            Envoyer celui-ci
          </button>
        </div>
      ))}

      {/* Zone dangereuse : remise à zéro de toutes les notifications */}
      <div style={{ marginTop:24, paddingTop:18, borderTop:'1px solid #e0e8f4' }}>
        <p style={{ color:'#d04a6a', fontSize:12, fontWeight:800, margin:'0 0 6px' }}>Zone sensible</p>
        <p style={{ color:'#5a7090', fontSize:12, lineHeight:1.5, margin:'0 0 10px' }}>
          Efface TOUTES les notifications de tous les comptes (repart propre). Action définitive.
        </p>
        <button onClick={effacerToutesNotifs} disabled={effacement}
          style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid #d04a6a', background: effacement ? '#f5d0d8' : '#fff0f3', color:'#d04a6a', fontWeight:800, fontSize:13, cursor: effacement ? 'wait' : 'pointer' }}>
          {effacement ? 'Effacement en cours...' : 'Effacer toutes les notifications'}
        </button>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
export function InscriptionsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'inscriptions_artistes'), orderBy('createdAt', 'desc')),
      s => { setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const supprimer = async (id: string) => {
    if (!window.confirm('Supprimer cette inscription ?')) return;
    try { await deleteDoc(doc(db, 'inscriptions_artistes', id)); } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  const marquerTraite = async (id: string, statut: string) => {
    try { await updateDoc(doc(db, 'inscriptions_artistes', id), { statut }); } catch(e:any) { alert('Erreur : ' + e.message); }
  };

  if (loading) return <div style={S.card}><p style={{ color:'#5a7090', textAlign:'center' }}>Chargement...</p></div>;

  return (
    <div>
      <div style={{ ...S.card, marginBottom:12 }}>
        <h3 style={{ margin:'0 0 4px', color:'#1a2340', fontSize:18 }}>Inscriptions artistes</h3>
        <p style={{ color:'#5a7090', fontSize:13, margin:0 }}>{items.length} demande(s) recue(s) via la page /rejoindre</p>
      </div>

      {items.length === 0 ? (
        <div style={S.card}><p style={{ color:'#5a7090', textAlign:'center' }}>Aucune inscription pour le moment.</p></div>
      ) : items.map(it => (
        <div key={it.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div>
              <p style={{ color:'#1a2340', fontSize:16, fontWeight:800, margin:'0 0 2px' }}>{it.nom}</p>
              <p style={{ color:'#5a7090', fontSize:13, margin:0 }}>{it.typeContenu}{it.ville ? ' ' + it.ville : ''}</p>
            </div>
            <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99,
              background: it.statut === 'traite' ? '#eaf7ee' : '#fff4e0',
              color: it.statut === 'traite' ? '#1a9e54' : '#b07a00' }}>
              {it.statut === 'traite' ? 'Traite' : 'Nouveau'}
            </span>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <a href={`tel:+${(it.tel||'').replace(/[^0-9]/g,'')}`} style={{ ...S.btn2, textDecoration:'none', fontSize:13 }}>{it.tel}</a>
            <a href={`https://wa.me/${(it.tel||'').replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ background:'#25D366', color:'#fff', padding:'8px 14px', borderRadius:10, textDecoration:'none', fontSize:13, fontWeight:700 }}>WhatsApp</a>
          </div>

          {it.message && <p style={{ color:'#5a7090', fontSize:13, fontStyle:'italic', margin:'0 0 10px', padding:'8px 12px', background:'#f7f9fc', borderRadius:8 }}>{it.message} </p>}

          <p style={{ color:'#8098b8', fontSize:11, margin:'0 0 10px' }}>
            Engagements coches : {Array.isArray(it.engagements) ? it.engagements.filter((e:boolean)=>e).length : 0}/5
            {it.createdAt ? ' ' + new Date(it.createdAt).toLocaleDateString('fr-FR') : ''}
          </p>

          <div style={{ display:'flex', gap:8 }}>
            {it.statut !== 'traite'
              ? <button onClick={() => marquerTraite(it.id, 'traite')} style={{ ...S.btn, flex:1, padding:10, fontSize:13 }}>Marquer traite</button>
              : <button onClick={() => marquerTraite(it.id, 'nouveau')} style={{ ...S.btn2, flex:1, padding:10, fontSize:13 }}>Remettre nouveau</button>}
            <button onClick={() => supprimer(it.id)} style={{ ...S.btnRed, padding:10, fontSize:13 }}>Supprimer</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// MOTS DE PASSE — l'admin redéfinit le mot de passe d'un compte
// ─────────────────────────────────────────────
export function MotsDePasseTab({ user }: { user: any }) {
  const [emailCible, setEmailCible] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const genererMdp = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setNouveauMdp(p);
  };

  const definir = async () => {
    setMsg('');
    const cible = (emailCible || '').trim().toLowerCase();
    if (!cible) { setMsg('Entrez l email du compte.'); return; }
    if (!nouveauMdp || nouveauMdp.length < 6) { setMsg('Le mot de passe doit faire au moins 6 caracteres.'); return; }
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/admin-set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, targetEmail: cible, newPassword: nouveauMdp }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setMsg(`Mot de passe redefini pour ${cible}. Communiquez-lui : ${nouveauMdp}`);
        setEmailCible('');
      } else {
        setMsg(`Erreur (${resp.status}) : ` + (data.error || 'action impossible'));
      }
    } catch(e:any) {
      setMsg('Erreur : ' + (e?.message || 'reseau'));
    }
    setLoading(false);
  };

  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 6px', color:'#1a2340', fontSize:18 }}>Redefinir un mot de passe</h3>
      <p style={{ color:'#5a7090', fontSize:13, margin:'0 0 18px', lineHeight:1.5 }}>
        Definissez directement un nouveau mot de passe pour le compte d un utilisateur,
        puis communiquez-le lui. Reserve au super administrateur.
      </p>

      <label style={S.lbl}>Email du compte</label>
      <input style={S.inp} type="email" placeholder="email@exemple.com" value={emailCible} onChange={e => setEmailCible(e.target.value)} />

      <label style={S.lbl}>Nouveau mot de passe</label>
      <input style={S.inp} value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)} placeholder="Min. 6 caracteres" />
      <button onClick={genererMdp} style={{ ...S.btn2, marginBottom:12 }}>Generer un mot de passe</button>

      <button onClick={definir} disabled={loading} style={{ ...S.btn, width:'100%', padding:13, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'En cours...' : 'Redefinir le mot de passe'}
      </button>
      {msg && <p style={{ color: msg.startsWith('') ? '#1a6bff' : '#e04060', fontSize:13, marginTop:12, textAlign:'center', wordBreak:'break-word' }}>{msg}</p>}
    </div>
  );
}

export function AdminPage() {
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
  const [newCategorie, setNewCategorie] = useState('autres');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newArtistEmail, setNewArtistEmail] = useState('');
  const [newCommercialEmail, setNewCommercialEmail] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [qrModal, setQrModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editScans, setEditScans] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editFiles, setEditFiles] = useState<any[]>([]);
  const [editCover, setEditCover] = useState('');
  const [editCoverUploading, setEditCoverUploading] = useState(false);
  const [addFiles, setAddFiles] = useState<FileList | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadMsg, setEditUploadMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkQr, setBulkQr] = useState<any>(null);
  const [bulkCount, setBulkCount] = useState('100');
  const [bulkScans, setBulkScans] = useState('1');
  const [bulkFormat, setBulkFormat] = useState<'a4' | 'a3'>('a4');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [annonceurs, setAnnonceurs] = useState<any[]>([]);
  const [pubs, setPubs] = useState<any[]>([]);
  const [retraits, setRetraits] = useState<any[]>([]);
  const [pubModal, setPubModal] = useState(false);
  const [pubForm, setPubForm] = useState<{ titre:string; sousTitre:string; lien:string; lienType:string; btnLabel:string; imageUrl:string; mediaType:string; active:boolean }>({ titre:'', sousTitre:'', lien:'', lienType:'url', btnLabel:'', imageUrl:'', mediaType:'', active:true });
  const [pubUploading, setPubUploading] = useState(false);
  const [adminChatId, setAdminChatId] = useState<string|null>(null);
  const [adminChatMsgs, setAdminChatMsgs] = useState<any[]>([]);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [adminChatSending, setAdminChatSending] = useState(false);
  const [audienceStats, setAudienceStats] = useState({
    artistes: 0, melomanes: 0, annonceurs: 0,
    pochettes: 0, telecharements: 0, streams: 0,
    ventes: 0, kiffements: 0, visites: 0
  });
  const AUDIENCE_SEUILS = [1000, 5000, 10000, 20000, 50000, 100000];

  useEffect(() => {
    // Vérifier silencieusement si l'admin est déjà connecté au chargement
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && estAdmin(u.email)) {
        setUser(u); setView('dashboard');
      }
    });
    return unsub;
  }, []);

  const login = async () => {
    setLoading(true); setMsg('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!estAdmin(cred.user.email)) {
        await signOut(auth);
        setMsg('Accès refusé — compte non autorisé');
        setLoading(false);
        return;
      }
      setUser(cred.user);
      setView('dashboard');
      setMsg('');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        setMsg('Email ou mot de passe incorrect');
      } else {
        setMsg('Erreur: ' + e.message);
      }
    }
    setLoading(false);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null); setView('login');
  };

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db, 'qrcodes'), orderBy('createdAt', 'desc')), s => setQrcodes(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, 'annonceurs'), orderBy('createdAt', 'desc')), s => setAnnonceurs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, 'pubs'), orderBy('createdAt', 'desc')), s => setPubs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(query(collection(db, 'retraits'), orderBy('createdAt', 'desc')), s => setRetraits(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Stats audience globale en temps réel
    const uArtistes = onSnapshot(collection(db, 'artists'), s => {
      setAudienceStats(prev => ({ ...prev, artistes: s.size }));
    });
    const uMelomanes = onSnapshot(collection(db, 'zikotheque'), s => {
      // Compter les UIDs uniques = mélomanes actifs
      const uids = new Set(s.docs.map(d => d.data().uid));
      setAudienceStats(prev => ({ ...prev, melomanes: uids.size }));
    });
    const uStreams = onSnapshot(collection(db, 'streams'), s => {
      setAudienceStats(prev => ({ ...prev, streams: s.size }));
    });
    const uVentes = onSnapshot(collection(db, 'ventes'), s => {
      setAudienceStats(prev => ({ ...prev, telecharements: s.size }));
    });
    const uKiffements = onSnapshot(collection(db, 'cadeaux'), s => {
      setAudienceStats(prev => ({ ...prev, kiffements: s.size }));
    });
    const uVisites = onSnapshot(collection(db, 'visits'), s => {
      setAudienceStats(prev => ({ ...prev, visites: s.size }));
    });

    return () => { u1(); u2(); u3(); u4(); u5(); uArtistes(); uMelomanes(); uStreams(); uVentes(); uKiffements(); uVisites(); };
  }, [user]);

  // ── Chat admin ↔ annonceur ──
  useEffect(() => {
    if (!adminChatId) return;
    const q = query(collection(db, 'adminChats'), where('annonceurId','==',adminChatId), orderBy('ts','asc'));
    const unsub = onSnapshot(q, snap => setAdminChatMsgs(snap.docs.map(d => ({id:d.id,...d.data()}))));
    return unsub;
  }, [adminChatId]);

  const sendAdminMsg = async () => {
    if (!adminChatInput.trim() || !adminChatId) return;
    setAdminChatSending(true);
    await addDoc(collection(db, 'adminChats'), {
      annonceurId: adminChatId, from: 'admin',
      text: adminChatInput.trim(), ts: new Date().toISOString(), read: false,
    });
    setAdminChatInput(''); setAdminChatSending(false);
  };

  const validerCampagne = async (id: string) => {
    await updateDoc(doc(db, 'annonceurs', id), { status: 'active', activatedAt: new Date().toISOString() });
    // Notifier l'annonceur via adminChats
    await addDoc(collection(db, 'adminChats'), {
      annonceurId: id, from: 'admin',
      text: 'Votre campagne a été validée et est maintenant active ! Vous allez commencer à recevoir des vues.',
      ts: new Date().toISOString(), read: false,
    });
    setMsg('Campagne activée !');
  };

  const rejeterCampagne = async (id: string) => {
    await updateDoc(doc(db, 'annonceurs', id), { status: 'rejected' });
    await addDoc(collection(db, 'adminChats'), {
      annonceurId: id, from: 'admin',
      text: 'Votre campagne a été refusée. Contactez-nous pour plus d\'informations.',
      ts: new Date().toISOString(), read: false,
    });
    setMsg('Campagne rejetée.');
  };

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
      // Upload image de pochette
      let coverUrl = '';
      if (coverFile) {
        setUploadMsg('Upload pochette...');
        const fd = new FormData();
        fd.append('file', coverFile); fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        fd.append('public_id', 'covers/' + qrId + '_cover');
        const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: fd });
        const d = await r.json();
        coverUrl = d.secure_url || '';
      }
      setUploadProgress(100);
      // Générer un lien public unique pour cet album (basé sur le contenu uploadé)
      const publicLinkId = newArtist.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + newLabel.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
      await addDoc(collection(db, 'qrcodes'), {
        qrId, label: newLabel, artist: newArtist, type: newType,
        price: parseInt(newPrice), totalScans: parseInt(newScans), categorie: newCategorie || 'autres',
        usedScans: 0, downloads: 0, files: uploaded, fileCount: uploaded.length,
        status: 'active', whatsapp: newWhatsapp, coverUrl,
        artistEmail: newArtistEmail,
        commercialEmail: newCommercialEmail || '',
        publicLinkId,
        createdAt: new Date().toISOString(), url: BASE_URL + '/fan/' + qrId,
      });
      // Créer aussi la page publique de streaming
      await addDoc(collection(db, 'publicLinks'), {
        publicLinkId, label: newLabel, artist: newArtist, type: newType,
        files: uploaded, coverUrl, artistEmail: newArtistEmail,
        price: parseInt(newPrice) || 0, categorie: newCategorie || 'autres',
        createdAt: new Date().toISOString(),
      });
      // Enregistrer l'artiste dans la collection 'artists' si email fourni
      if (newArtistEmail) {
        const artistSnap = await getDocs(query(collection(db, 'artists'), where('email', '==', newArtistEmail)));
        if (artistSnap.empty) {
          await addDoc(collection(db, 'artists'), {
            name: newArtist, email: newArtistEmail,
            commercialEmail: newCommercialEmail || '',
            createdAt: new Date().toISOString(),
          });
          notifierAdminEnregistrement('Nouvel artiste', `${newArtist} (${newArtistEmail})`);
        }
      }
      setNewLabel(''); setNewArtist(''); setNewPrice(''); setNewScans('');
      setNewWhatsapp(''); setNewArtistEmail(''); setNewCommercialEmail('');
      setSelectedFiles(null); setCoverFile(null); setUploadProgress(0); setUploadMsg('');
      setMsg('QR ' + qrId + ' cree avec ' + uploaded.length + ' fichier(s) !');
    } catch (e: any) { setMsg('Erreur: ' + e.message); }
    setLoading(false);
  };

  const openEdit = (q: any) => {
    setEditModal(q); setEditPrice(String(q.price)); setEditScans(String(q.totalScans));
    setEditWhatsapp(q.whatsapp || ''); setEditFiles(q.files || []); setAddFiles(null); setEditUploadMsg('');
    setEditCover(q.coverUrl || ''); setEditCoverUploading(false);
  };

  // Upload d'une nouvelle image de pochette (change juste l'image, garde tout le reste)
  const uploadEditCover = async (file: File) => {
    if (!file) return;
    // Aperçu local immédiat (ne dépend pas du réseau)
    try { setEditCover(URL.createObjectURL(file)); } catch {}
    setEditCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: fd });
      const d = await r.json();
      console.log('EDIT COVER QR réponse:', d);
      if (d.secure_url) setEditCover(d.secure_url);
      else alert('Erreur upload : ' + (d?.error?.message || JSON.stringify(d).slice(0,120)));
    } catch(e:any) { console.error('cover', e); alert('Erreur réseau : ' + (e?.message||'')); }
    setEditCoverUploading(false);
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
    if (editCoverUploading) { alert('Patientez, l\'image est en cours d\'envoi...'); return; }
    if (editCover.startsWith('blob:')) { alert('L\'image n\'a pas fini de s\'envoyer. Réessayez dans un instant.'); return; }
    const newTotal = parseInt(editScans) || editModal.totalScans;
    const newPriceVal = parseInt(editPrice) || editModal.price;
    await updateDoc(doc(db, 'qrcodes', editModal.id), {
      price: newPriceVal, totalScans: newTotal,
      files: editFiles, fileCount: editFiles.length, whatsapp: editWhatsapp,
      coverUrl: editCover,
      status: (editModal.usedScans || 0) < newTotal ? 'active' : 'locked',
    });
    // Synchroniser prix, image ET fichier(s) dans publicLinks + decouvrir via
    // publicLinkId du qrcode — avant, un remplacement de fichier ne se
    // répercutait jamais sur Découvrir/le lien public, seuls prix et pochette
    // l'étaient.
    const pid = editModal.publicLinkId || editModal.qrId;
    if (pid) {
      const plSnap = await getDocs(query(collection(db,'publicLinks'), where('publicLinkId','==',pid)));
      for (const d of plSnap.docs) await updateDoc(doc(db,'publicLinks',d.id), { price: newPriceVal, coverUrl: editCover, files: editFiles });
      const dSnap = await getDocs(query(collection(db,'decouvrir'), where('publicLinkId','==',pid)));
      for (const d of dSnap.docs) await updateDoc(doc(db,'decouvrir',d.id), { price: newPriceVal, coverUrl: editCover, files: editFiles });
    }
    setEditModal(null); setMsg('QR mis à jour !');
  };

  const generateBulkQRs = async () => {
    if (!bulkQr || !bulkCount || !bulkScans) return;
    const count = parseInt(bulkCount); const scans = parseInt(bulkScans);
    if (count < 1 || count > 5000) { setMsg('Entre 1 et 5000 QR codes'); return; }
    setBulkLoading(true); setBulkProgress(0);
    const qrIds: string[] = [];
    for (let i = 0; i < count; i++) qrIds.push(Math.random().toString(36).slice(2, 10).toUpperCase());
    const batchSize = 20;
    let echecs = 0;
    // Chaque écriture a désormais une limite de 15s — avant, une seule requête
    // bloquée (réseau instable, etc.) figeait toute la génération au même
    // pourcentage indéfiniment. Maintenant on continue toujours, même si
    // certaines écritures échouent (comptées et signalées à la fin).
    const ecrireAvecDelai = (data: any) => Promise.race([
      addDoc(collection(db, 'qrcodes'), data),
      new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), 15000)),
    ]).catch(() => { echecs++; return null; });
    for (let i = 0; i < qrIds.length; i += batchSize) {
      await Promise.all(qrIds.slice(i, i + batchSize).map(qrId =>
        ecrireAvecDelai({
          qrId, label: bulkQr.label, artist: bulkQr.artist, type: bulkQr.type,
          price: bulkQr.price, totalScans: scans, usedScans: 0, downloads: 0,
          files: bulkQr.files || [], fileCount: bulkQr.fileCount || 0,
          status: 'active', whatsapp: bulkQr.whatsapp || '',
          coverUrl: bulkQr.coverUrl || '',
          artistEmail: bulkQr.artistEmail || '',
          publicLinkId: bulkQr.publicLinkId || '',
          createdAt: new Date().toISOString(), url: BASE_URL + '/fan/' + qrId,
          bulk: true, bulkParent: bulkQr.qrId,
        })
      ));
      setBulkProgress(Math.round(((i + batchSize) / count) * 50));
    }
    setBulkProgress(55);
    const QRCode = (await import('qrcode')).default;
    const { jsPDF } = await import('jspdf');
    // A3 garde les mêmes marges que l'A4 (juste sur une feuille plus grande),
    // donc plus de QR codes par page (56 au lieu de 30) sans les rapprocher.
    const pageW = bulkFormat === 'a3' ? 297 : 210;
    const pageH = bulkFormat === 'a3' ? 420 : 297;
    const cols = bulkFormat === 'a3' ? 8 : 6;
    const rows = bulkFormat === 'a3' ? 7 : 5;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: bulkFormat });
    const perPage = cols * rows; const qrSize = 27;
    const marginX = (pageW - cols * qrSize) / (cols + 1);
    const marginY = (pageH - rows * qrSize) / (rows + 1);
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
    // Laisse le temps au "100%" de s'afficher réellement avant que la
    // génération finale du PDF (lourde, bloquante) ne fige le navigateur —
    // sinon la fenêtre semblait disparaître d'un coup sans jamais montrer
    // la confirmation.
    await new Promise(r => setTimeout(r, 60));
    pdf.save(bulkQr.label.replace(/[^a-zA-Z0-9]/g, '_') + '_' + count + '_QRcodes_' + bulkFormat.toUpperCase() + '.pdf');
    setMsg('' + count + ' QR codes generes' + (echecs > 0 ? ` (${echecs} en échec, à régénérer)` : '') + ' ! PDF telecharge.');
    // Laisse le message de succès visible un instant avant de refermer la
    // fenêtre, pour que ce soit clair que c'est terminé.
    await new Promise(r => setTimeout(r, 1500));
    setBulkLoading(false); setShowBulk(false); setBulkQr(null);
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
    <div style={{ minHeight: '100vh', background: '#f0f4fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
          <p style={{ color:'#8098b8', fontSize:13, marginTop:8 }}>La Musique. Un Scan. Un Monde.</p>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@doniel.art" onKeyDown={e => e.key === 'Enter' && login()} />
          <label style={S.lbl}>Mot de passe</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && login()} />
          {msg && <p style={{ color: msg.startsWith('') ? '#1a6bff' : '#e04060', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
          <button style={{ ...S.btn, width: '100%', padding: 14, marginBottom: 10 }} onClick={login} disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter →'}
          </button>
          <button onClick={async () => {
            if (!email) { setMsg('Entrez votre email d\'abord'); return; }
            try {
              await demanderResetPassword(email);
              setMsg('Email de réinitialisation envoyé à ' + email);
            } catch(e:any) {
              setMsg('Erreur: ' + (e.code === 'auth/user-not-found' ? 'Email introuvable' : e.message));
            }
          }}
            style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'#8098b8', cursor:'pointer', fontSize:13, textDecoration:'underline' }}>
            Mot de passe oublié ?
          </button>
        </div>
      </div>
    </div>
  );
  
  const pendingPay = payments.filter(p => p.status === 'pending');
  const lockedQRs = qrcodes.filter(q => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1));

  // Grouper QR codes par artiste
  const groupedQRs = (() => {
    const groups: Record<string, any[]> = {};
    filteredQRs.forEach((q: any) => {
      const artist = q.artist || 'Sans artiste';
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(q);
    });
    return Object.entries(groups).map(([artist, qs]) => {
      const lockedCount = qs.filter((q: any) => q.status === 'locked' || (q.usedScans || 0) >= (q.totalScans || 1)).length;
      return { artist, qs, activeCount: qs.length - lockedCount, lockedCount };
    });
  })();

  return (
    <div style={S.bg}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bar1 { 0%,100%{height:8px} 50%{height:32px} }
        @keyframes bar2 { 0%,100%{height:18px} 50%{height:8px} }
        @keyframes bar3 { 0%,100%{height:28px} 25%{height:10px} 75%{height:38px} }
        @keyframes bar4 { 0%,100%{height:12px} 40%{height:36px} 80%{height:6px} }
        @keyframes bar5 { 0%,100%{height:22px} 30%{height:6px} 70%{height:30px} }
        @keyframes bar6 { 0%,100%{height:10px} 50%{height:40px} }
        @keyframes bar7 { 0%,100%{height:30px} 25%{height:8px} 75%{height:20px} }
      `}</style>

      {/* BULK MODAL */}
      {showBulk && bulkQr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#ffffff', border: '1px solid #dce6f7', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Generation en masse</h3>
            <p style={{ color: '#1a6bff', fontFamily: 'monospace', fontWeight: 700, marginBottom: 4, fontSize: 15 }}>{bulkQr.label}</p>
            <p style={{ color: '#5a7090', fontSize: 13, marginBottom: 20 }}>par {bulkQr.artist}</p>
            <div style={{ background: '#f5f8ff', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ color: '#8098b8', fontSize: 11, marginBottom: 4 }}>Chaque QR code = 1 pochette unique</p>
              <p style={{ color: '#8098b8', fontSize: 11 }}>30 QR/page en A4, 56 QR/page en A3 → PDF imprimable</p>
            </div>
            <label style={S.lbl}>Format papier</label>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[['a4','A4 · 30/page'],['a3','A3 · 56/page']].map(([k,l]) => (
                <button key={k} onClick={() => setBulkFormat(k as any)}
                  style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${bulkFormat===k?'#1a6bff':'#dce6f7'}`, background:bulkFormat===k?'#eaf1ff':'#fff', color:bulkFormat===k?'#1a6bff':'#8098b8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
            <label style={S.lbl}>Nombre de QR codes</label>
            <input style={S.inp} type="number" value={bulkCount} onChange={e => setBulkCount(e.target.value)} placeholder="100" min="1" max="5000" />
            <label style={S.lbl}>Scans par QR code</label>
            <input style={S.inp} type="number" value={bulkScans} onChange={e => setBulkScans(e.target.value)} placeholder="1" min="1" />
            <div style={{ background: '#eaf1ff', border: '1px solid #2a4a1a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ color: '#1a6bff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{Math.ceil(parseInt(bulkCount || '0') / (bulkFormat === 'a3' ? 56 : 30))} page(s) {bulkFormat.toUpperCase()}</p>
              <p style={{ color: '#5a7090', fontSize: 12 }}>{bulkCount} QR × {bulkScans} scan(s) = {parseInt(bulkCount || '0') * parseInt(bulkScans || '0')} telechargements</p>
            </div>
            {bulkLoading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5a7090', marginBottom: 6 }}>
                  <span>{bulkProgress < 55 ? 'Creation des QR codes...' : 'Generation du PDF...'}</span>
                  <span style={{ color: '#1a6bff', fontWeight: 700 }}>{bulkProgress}%</span>
                </div>
                <div style={{ height: 8, background: '#dce6f7', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: bulkProgress + '%', background: 'linear-gradient(90deg, #1a6bff, #4da6ff)', borderRadius: 99, transition: 'width .3s' }} />
                </div>
                <p style={{ color: '#8098b8', fontSize: 11, marginTop: 8, textAlign: 'center' }}>Ne fermez pas cette page...</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => { setShowBulk(false); setBulkQr(null); }} disabled={bulkLoading}>Annuler</button>
              <button style={{ ...S.btn, flex: 2 }} onClick={generateBulkQRs} disabled={bulkLoading}>
                {bulkLoading ? 'Generation...' : 'Generer ' + bulkCount + ' QR codes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #dce6f7', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>Modifier</h3>
            <p style={{ color: '#1a6bff', fontFamily: 'monospace', fontWeight: 700, marginBottom: 20 }}>{editModal.qrId} — {editModal.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.lbl}>Prix (FCFA)</label><input style={S.inp} type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} /></div>
              <div><label style={S.lbl}>Nb scans total</label><input style={S.inp} type="number" value={editScans} onChange={e => setEditScans(e.target.value)} /></div>
            </div>
            {parseInt(editScans) > (editModal.usedScans || 0) && (editModal.usedScans || 0) >= editModal.totalScans && (
              <div style={{ background: '#eaf1ff', border: '1px solid #4da6ff', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#1a6bff' }}>✓ QR sera reactive</div>
            )}

            {/* CHANGER L'IMAGE DE POCHETTE (sans rien supprimer d'autre) */}
            <label style={{ ...S.lbl, marginBottom: 8 }}>Image de la pochette</label>
            <div style={{ background: '#f5f8ff', borderRadius: 10, padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              {editCover ? (
                <img src={editCover} alt="pochette" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 70, height: 70, borderRadius: 10, background: '#dce6f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
              )}
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadEditCover(e.target.files[0])} style={{ display: 'none' }} id="editCoverInput" />
                <label htmlFor="editCoverInput" style={{ ...S.btn2, fontSize: 12, padding: '8px 14px', cursor: 'pointer', display: 'inline-block' }}>
                  {editCover ? 'Changer limage' : 'Ajouter une image'}
                </label>
                {editCoverUploading && <p style={{ color: '#1a6bff', fontSize: 12, marginTop: 6 }}>Envoi de limage...</p>}
              </div>
            </div>

            <label style={{ ...S.lbl, marginBottom: 10 }}>Fichiers ({editFiles.length})</label>
            <div style={{ background: '#f5f8ff', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              {editFiles.length === 0 ? <p style={{ color: '#8098b8', fontSize: 13, textAlign: 'center' }}>Aucun fichier</p> :
                editFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < editFiles.length - 1 ? '1px solid #dce6f7' : 'none' }}>
                                        <p style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                    <button onClick={() => setEditFiles(f => f.filter((_, j) => j !== i))} style={{ ...S.btnRed, padding: '4px 8px', fontSize: 11 }}></button>
                  </div>
                ))}
            </div>
            <div style={{ border: '2px dashed #b8cce8', borderRadius: 10, padding: 14, textAlign: 'center', background: '#f5f8ff', marginBottom: 14 }}>
              <input type="file" accept="audio/*,video/*" multiple onChange={e => setAddFiles(e.target.files)} style={{ display: 'none' }} id="editFileInput" />
              <label htmlFor="editFileInput" style={{ ...S.btn, fontSize: 12, padding: '8px 14px', cursor: 'pointer', display: 'inline-block' }}>Ajouter fichiers</label>
              {addFiles && addFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ color: '#1a6bff', fontSize: 12, marginBottom: 6 }}>{addFiles.length} fichier(s)</p>
                  {!editUploading && <button onClick={uploadEditFiles} style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }}>⬆ Uploader</button>}
                  {editUploading && <p style={{ color: '#5a7090', fontSize: 12 }}>{editUploadMsg}</p>}
                </div>
              )}
              {editUploadMsg && !editUploading && <p style={{ color: '#1a6bff', fontSize: 12, marginTop: 8 }}>{editUploadMsg}</p>}
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
          <div style={{ background: '#ffffff', border: '1px solid #dce6f7', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420, textAlign: 'center' }}>
            <p style={{ color: '#5a7090', fontSize: 12, marginBottom: 2 }}>{qrModal.artist}</p>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 4 }}>{qrModal.label}</h3>
            <p style={{ fontFamily: 'monospace', color: '#1a6bff', fontWeight: 800, fontSize: 20, marginBottom: 20, letterSpacing: 4 }}>{qrModal.qrId}</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 12 }}>
                <QRCodeCanvas id={'qr-dl-' + qrModal.id} value={qrModal.url} size={200} bgColor="#ffffff" fgColor="#060a14" level="H" />
              </div>
            </div>
            <p style={{ color: '#8098b8', fontSize: 10, marginBottom: 20, wordBreak: 'break-all', background: '#f5f8ff', padding: '8px 12px', borderRadius: 8 }}>{qrModal.url}</p>
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
          <div style={{ background: '#ffffff', border: '1px solid #f04a6a', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'serif', fontSize: 20, marginBottom: 12 }}>Supprimer ce QR code ?</h3>
            <p style={{ color: '#5a7090', fontSize: 13, marginBottom: 24 }}>Cette action est irreversible.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn2, flex: 1 }} onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button style={{ ...S.btnRed, flex: 1, padding: '10px 20px' }} onClick={async () => {
                try {
                  // Récupérer le publicLinkId du QR pour nettoyer partout
                  const qrDoc = qrcodes.find((q:any) => q.id === confirmDelete);
                  const plId = qrDoc?.publicLinkId;
                  // 1. Supprimer le QR
                  await deleteDoc(doc(db, 'qrcodes', confirmDelete));
                  // 2. Supprimer le contenu lié dans Découvrir + les liens publics
                  if (plId) {
                    const decSnap = await getDocs(query(collection(db,'decouvrir'), where('publicLinkId','==',plId)));
                    for (const d of decSnap.docs) await deleteDoc(doc(db,'decouvrir',d.id));
                    const plSnap = await getDocs(query(collection(db,'publicLinks'), where('publicLinkId','==',plId)));
                    for (const d of plSnap.docs) await deleteDoc(doc(db,'publicLinks',d.id));
                  }
                  setConfirmDelete(null); setMsg('QR et contenu supprimés partout !');
                } catch(e:any) { setMsg('Erreur : ' + e.message); setConfirmDelete(null); }
              }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dce6f7', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
           <Logo size="sm" />
           <p style={{ color: '#1a6bff', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ADMIN</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingPay.length > 0 && <span style={{ ...badgeStyle('pending'), padding: '6px 12px', fontSize: 12 }}>{pendingPay.length} en attente</span>}
          <button style={S.btn2} onClick={logout}>Deconnexion</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: '1px solid #dce6f7', padding: '0 12px', display: 'flex', background: '#ffffff', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        <button style={{...tabStyle(tab === 'qrcodes'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('qrcodes')}>QR Codes ({qrcodes.length})</button>
        <button style={{...tabStyle(tab === 'puboscart'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('puboscart')}>Pub Oscart</button>
        <button style={{...tabStyle(tab === 'concours'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('concours')}>Rémunération</button>
        <button style={{...tabStyle(tab === 'inscriptions'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('inscriptions')}>Inscriptions</button>
        <button style={{...tabStyle(tab === 'notifsedu'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('notifsedu')}>Notifs à tous</button>
        {estSuperAdmin(user?.email) && <button style={{...tabStyle(tab === 'motsdepasse'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('motsdepasse')}>Mots de passe</button>}
        <button style={{...tabStyle(tab === 'artistes'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('artistes')}>Artistes</button>
        <button style={{...tabStyle(tab === 'soumissions'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('soumissions')}>Soumissions</button>
        <button style={{...tabStyle(tab === 'sorties'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('sorties')}>Sorties officielles</button>
        <button style={{...tabStyle(tab === 'decouvrir'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('decouvrir')}>Découvrir</button>
        <button style={{...tabStyle(tab === 'commerciaux'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('commerciaux')}>Commerciaux</button>
        <button style={{...tabStyle(tab === 'responsables'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('responsables')}>Responsables</button>
        <button style={{...tabStyle(tab === 'audience'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('audience')}>
          Audience {audienceStats.melomanes > 0 ? `(${audienceStats.melomanes.toLocaleString()})` : ''}
        </button>
        <button style={{...tabStyle(tab === 'production'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('production')}>Productions</button>
        <button style={{...tabStyle(tab === 'payments'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('payments')}>Paiements {pendingPay.length > 0 ? '(' + pendingPay.length + ')' : ''}</button>
        <button style={{...tabStyle(tab === 'annonceurs'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('annonceurs')}>
          Annonceurs {annonceurs.filter(a => a.status === 'pending').length > 0 ? '(' + annonceurs.filter(a => a.status === 'pending').length + ')' : ''}
        </button>
        <button style={{...tabStyle(tab === 'pubs'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('pubs')}>
          Pubs {pubs.length > 0 ? `(${pubs.length})` : ''}
        </button>
        <button style={{...tabStyle(tab === 'retraits'), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setTab('retraits')}>
          Retraits {retraits.filter((r:any) => r.statut === 'en_attente').length > 0 ? `(${retraits.filter((r:any) => r.statut === 'en_attente').length})` : ''}
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {msg && (
          <div style={{ background: msg.startsWith('Erreur') ? '#fff0f3' : '#eaf1ff', border: '1px solid ' + (msg.startsWith('Erreur') ? '#e04060' : '#1a6bff'), borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: msg.startsWith('Erreur') ? '#e04060' : '#1a6bff', fontSize: 13 }}>
            {msg} <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setMsg('')}>✕</span>
          </div>
        )}

        {tab === 'artistes' && (
        <div style={{ ...S.card, background:'linear-gradient(135deg,#eef9f0,#dbeede)', marginBottom:16 }}>
          <p style={{ fontWeight:800, fontSize:15, color:'#1a2340', margin:'0 0 6px' }}>Lien d'inscription artiste (admin)</p>
          <p style={{ color:'#5a7090', fontSize:12, margin:'0 0 10px', lineHeight:1.5 }}>Envoyez ce lien a un artiste : il s'inscrit lui-même (plus besoin de saisir son email) et son 1er contenu est offert.</p>
          <div style={{ background:'#fff', border:'1px solid #c8d8ef', borderRadius:10, padding:'8px 12px', marginBottom:10 }}>
            <span style={{ fontSize:12, color:'#1a6bff', wordBreak:'break-all', fontWeight:600 }}>{BASE_URL}/artiste?ref=admin</span>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => { navigator.clipboard?.writeText(`${BASE_URL}/artiste?ref=admin`); setMsg('Lien copie !'); }}
              style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, border:'none', background:'#1a6bff', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Copier le lien
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=admin`)); setMsg('Message copie !'); }}
              style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, border:'1px solid #c8d8ef', background:'#fff', color:'#1a6bff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Copier le message
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(MSG_INVIT_ARTISTE(`${BASE_URL}/artiste?ref=admin`))}`} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, minWidth:110, padding:'10px', borderRadius:10, background:'#25D366', color:'#fff', fontWeight:700, fontSize:13, textAlign:'center', textDecoration:'none' }}>
              WhatsApp
            </a>
          </div>
        </div>
        )}

        {tab === 'qrcodes' && (
          <>
            {lockedQRs.length > 0 && estSuperAdmin(user?.email) && (
              <div style={{ background: '#f5f8ff', border: '1px solid #3a3000', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <p style={{ color: '#b07a00', fontSize: 13 }}>{lockedQRs.length} QR bloque(s)</p>
                <button style={S.btnRed} onClick={async () => { for (const q of lockedQRs) await deleteDoc(doc(db, 'qrcodes', q.id)); setMsg(lockedQRs.length + ' supprimes !'); }}>Supprimer les bloques</button>
              </div>
            )}

            {/* CREATE FORM */}
            <div style={S.card}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, color: '#1a2340' }}>Nouveau QR Code</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.lbl}>Nom du contenu *</label><input style={S.inp} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Album Vol.1" /></div>
                <div>
                  <label style={S.lbl}>Artiste *</label>
                  <input
                    style={S.inp}
                    value={newArtist}
                    onChange={e => setNewArtist(e.target.value)}
                    placeholder="Sélectionner ou saisir un artiste"
                    list="artistsList"
                    autoComplete="off"
                  />
                  <datalist id="artistsList">
                    {Array.from(new Set(qrcodes.map((q: any) => q.artist).filter(Boolean))).sort().map((a: any) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <div><label style={S.lbl}>Email de l'artiste</label><input style={S.inp} type="email" value={newArtistEmail} onChange={e => setNewArtistEmail(e.target.value)} placeholder="artiste@email.com" /></div>
                <div><label style={S.lbl}>Email du commercial (optionnel)</label><input style={S.inp} type="email" value={newCommercialEmail} onChange={e => setNewCommercialEmail(e.target.value)} placeholder="commercial@email.com" /></div>
                <div>
                  <label style={S.lbl}>Catégorie</label>
                  <select style={S.inp} value={newCategorie} onChange={e => setNewCategorie(e.target.value)}>
                    <optgroup label="Musique (Audio)">
                      {CATEGORIES_AUDIO.filter(c => c.id !== 'tous').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </optgroup>
                    <optgroup label="Vidéo">
                      {CATEGORIES_VIDEO.filter(c => c.id !== 'tous').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Prix en F CFA * <span style={{ color:'#8098b8', fontWeight:400 }}>(converti automatiquement en Oscart)</span></label>
                  <input style={S.inp} type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="1000" />
                  {newPrice && <p style={{ color:'#ffd700', fontSize:12, marginTop:4, fontWeight:700 }}>= {Math.ceil((parseInt(newPrice)||0)/10)} Oscart</p>}
                </div>
                <div><label style={S.lbl}>Nb scans *</label><input style={S.inp} type="number" value={newScans} onChange={e => setNewScans(e.target.value)} placeholder="100" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[['album','Album'],['single','Single'],['video','Vidéo'],['court-metrage','Court-métrage'],['contenu-humoristique','Contenu humoristique'],['mix','Mix']].map(([t,l]) => (
                  <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + (newType === t ? '#1a6bff' : '#c8d8ef'), background: newType === t ? '#eaf1ff' : 'transparent', color: newType === t ? '#1a6bff' : '#8098b8', cursor: 'pointer', fontSize: 12 }}>{l}</button>
                ))}
              </div>
              <label style={S.lbl}>Image de pochette (obligatoire)</label>
              <div style={{ border: '2px dashed #b8cce8', borderRadius: 12, padding: 18, marginBottom: 14, textAlign: 'center', background: '#f5f8ff' }}>
                <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} style={{ display: 'none' }} id="coverInput" />
                <label htmlFor="coverInput" style={{ ...S.btn2, fontSize: 12, padding: '8px 14px', cursor: 'pointer', display: 'inline-block', marginBottom: 10 }}>Choisir l'image</label>
                {coverFile ? (
                  <div>
                    <img src={URL.createObjectURL(coverFile)} alt="cover" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, marginTop: 8 }} />
                    <p style={{ color: '#1a6bff', fontSize: 11, marginTop: 6 }}>{coverFile.name}</p>
                  </div>
                ) : <p style={{ color: '#8098b8', fontSize: 13 }}>Aucune image</p>}
              </div>
              <label style={S.lbl}>Fichiers audio/video</label>
              <div style={{ border: '2px dashed #b8cce8', borderRadius: 12, padding: 18, marginBottom: 14, textAlign: 'center', background: '#f5f8ff' }}>
                <input type="file" accept="audio/*,video/*" multiple onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="fileInput" />
                <input type="file" accept="audio/*,video/*" onChange={e => setSelectedFiles(e.target.files)} style={{ display: 'none' }} id="folderInput" {...{ webkitdirectory: '', directory: '' } as any} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
                  <label htmlFor="fileInput" style={{ ...S.btn, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Fichiers</label>
                  <label htmlFor="folderInput" style={{ ...S.btn2, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>Dossier</label>
                </div>
                {selectedFiles && selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ color: '#1a6bff', fontWeight: 700, marginBottom: 6 }}>{selectedFiles.length} fichier(s)</p>
                    <div style={{ maxHeight: 80, overflowY: 'auto' }}>{Array.from(selectedFiles).map((f, i) => <p key={i} style={{ color: '#5a7090', fontSize: 11, marginBottom: 1 }}>{i + 1}. {f.name} ({formatSize(f.size)})</p>)}</div>
                  </div>
                ) : <p style={{ color: '#8098b8', fontSize: 13 }}>Aucun fichier</p>}
              </div>
              {loading && uploadProgress > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5a7090', marginBottom: 5 }}><span>{uploadMsg}</span><span style={{ color: '#1a6bff' }}>{uploadProgress}%</span></div>
                  <div style={{ height: 5, background: '#dce6f7', borderRadius: 99 }}><div style={{ height: '100%', width: uploadProgress + '%', background: '#1a6bff', borderRadius: 99, transition: 'width .3s' }} /></div>
                </div>
              )}
              <button style={{ ...S.btn, width: '100%', padding: 14 }} onClick={createQR} disabled={loading}>
                {loading ? (uploadMsg || 'Creation...') : 'Generer QR Code'}
              </button>
            </div>

            <input style={{ width: '100%', background: '#f5f8ff', border: '1px solid #c8d8ef', borderRadius: 10, padding: '11px 14px', color: '#1a2340', fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

            {filteredQRs.length === 0 ? (
              <div style={{ background: '#ffffff', border: '1px solid #dce6f7', borderRadius: 16, padding: 40, marginBottom: 16, boxShadow: '0 2px 12px rgba(26,107,255,0.06)', textAlign: 'center', color: '#8098b8' }}>
                {searchTerm ? 'Aucun résultat pour "' + searchTerm + '"' : 'Aucun QR code — créez le premier ci-dessus'}
              </div>
) : groupedQRs.map(({ artist, qs, activeCount, lockedCount }) => (
              <ArtistFolder key={artist} artist={artist} qrcodes={qs} activeCount={activeCount} lockedCount={lockedCount}
                onEdit={openEdit} onQrModal={setQrModal} onBulk={(q: any) => { setBulkQr(q); setBulkCount('100'); setBulkScans('1'); setBulkFormat('a4'); setShowBulk(true); }}
                onToggle={(q: any) => updateDoc(doc(db, 'qrcodes', q.id), { status: q.status === 'active' ? 'locked' : 'active' })}
                onDelete={(id: string) => {
                  if (estSuperAdmin(user?.email)) { setConfirmDelete(id); }
                  else {
                    addDoc(collection(db,'signalements'), { type:'qrcode', cible:id, signalePar: user?.email, createdAt:new Date().toISOString(), statut:'nouveau' });
                    setMsg('QR signalé au super admin (les admins ne peuvent pas supprimer).');
                  }
                }} />
            ))
            }
          </>
        )}

        {tab === 'commerciaux' && <CommerciauxtTab db={db} canDelete={estSuperAdmin(user?.email)} />}

        {tab === 'responsables' && <ResponsablesTab canDelete={estSuperAdmin(user?.email)} />}

        {/* ────────── ONGLET PRODUCTIONS ────────── */}
        {tab === 'production' && <ProductionTab />}

        {/* ────────── ONGLET AUDIENCE ────────── */}
        {tab === 'audience' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <h2 style={{ fontFamily:'serif', fontSize:22, fontWeight:800, marginBottom:20 }}>Audience</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'Visites du site', val:audienceStats.visites, color:'#ff8c00' },
                { label:'Artistes inscrits', val:audienceStats.artistes, color:'#1a6bff' },
                { label:'Mélomanes actifs', val:audienceStats.melomanes, color:'#7c3aed' },
                { label:'Écoutes totales', val:audienceStats.streams, color:'#00c853' },
                { label:'Téléchargements', val:audienceStats.telecharements, color:'#f04a6a' },
                { label:'Kiffements', val:audienceStats.kiffements, color:'#ffd700' },
                { label:'Annonceurs', val:annonceurs.length, color:'#4da6ff' },
              ].map((s,i) => (
                <div key={i} style={{ ...S.card, textAlign:'center', padding:20 }}>
                  <p style={{ fontSize:28, fontWeight:900, color:s.color, marginBottom:4 }}>{s.val.toLocaleString()}</p>
                  <p style={{ color:'#8098b8', fontSize:11 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'artistes' && <ArtistesTab db={db} qrcodes={qrcodes} canDelete={estSuperAdmin(user?.email)} />}

        {tab === 'puboscart' && <PubOscartTab user={user} />}
        {tab === 'concours' && <ConcoursConfigTab />}
        {tab === 'inscriptions' && <InscriptionsTab />}
        {tab === 'notifsedu' && <NotifsEducativesTab />}
        {tab === 'motsdepasse' && estSuperAdmin(user?.email) && <MotsDePasseTab user={user} />}

        {tab === 'soumissions' && <SoumissionsTab canValidate={estAdmin(user?.email)} canDelete={estSuperAdmin(user?.email)} />}
        {tab === 'sorties' && <SortiesAdminTab canValidate={estAdmin(user?.email)} canDelete={estSuperAdmin(user?.email)} />}
        {tab === 'decouvrir' && <DecouvrirAdminTab canDelete={estSuperAdmin(user?.email)} />}

        {tab === 'pubs' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontFamily:'serif', fontSize:20, fontWeight:800 }}>Mes publicités</h2>
              <button style={S.btn} onClick={() => setPubModal(true)}>+ Créer une pub</button>
            </div>

            {/* MODAL CRÉATION PUB */}
            {pubModal && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
                onClick={e => { if (e.target === e.currentTarget) setPubModal(false); }}>
                <div style={{ ...S.card, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                    <h3 style={{ fontFamily:'serif', fontSize:17, fontWeight:800 }}>Nouvelle publicité</h3>
                    <button onClick={() => setPubModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#8098b8' }}>✕</button>
                  </div>

                  <label style={S.lbl}>Titre de la pub *</label>
                  <input style={S.inp} value={pubForm.titre} onChange={e => setPubForm(f => ({...f, titre:e.target.value}))} placeholder="Ex: Votre publicité ici · Doniel Zik" />

                  <label style={S.lbl}>Sous-titre</label>
                  <input style={S.inp} value={pubForm.sousTitre} onChange={e => setPubForm(f => ({...f, sousTitre:e.target.value}))} placeholder="Ex: Contactez-nous pour diffuser votre pub" />

                  <label style={S.lbl}>Texte du bouton d'action</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                    {[
                      ['Acheter maintenant','#1a6bff'],
                      ['Souscrire maintenant','#1a6bff'],
                      ['Appeler maintenant','#00a040'],
                      ['Discuter maintenant','#1a6bff'],
                      ['Plus d\'infos','#5a7090'],
                    ].map(([label, color]) => (
                      <button key={label} onClick={() => setPubForm(f => ({...f, btnLabel:label}))}
                        style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${pubForm.btnLabel===label?'#1a6bff':'#c8d8ef'}`, background: pubForm.btnLabel===label?'#eaf1ff':'#fff', color: pubForm.btnLabel===label?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <label style={S.lbl}>Type d'action au clic</label>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    {[['url','Site web'],['whatsapp','WhatsApp'],['tel','Appel']].map(([type, label]) => (
                      <button key={type} onClick={() => setPubForm(f => ({...f, lienType:type}))}
                        style={{ flex:1, padding:'9px 6px', borderRadius:8, border:`1px solid ${pubForm.lienType===type?'#1a6bff':'#c8d8ef'}`, background: pubForm.lienType===type?'#eaf1ff':'#fff', color: pubForm.lienType===type?'#1a6bff':'#5a7090', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <label style={S.lbl}>
                    {pubForm.lienType==='url' ? 'URL du site' : pubForm.lienType==='whatsapp' ? 'Numéro WhatsApp (+225...)' : 'Numéro de téléphone'}
                  </label>
                  <input style={S.inp} value={pubForm.lien} onChange={e => setPubForm(f => ({...f, lien:e.target.value}))}
                    placeholder={pubForm.lienType==='url' ? 'https://...' : '+225 07 00 00 00 00'} />

                  <label style={S.lbl}>Visuel de la pub (image ou vidéo)</label>
                  <input type="file" accept="image/*,video/*" id="pub-img-upload" style={{ display:'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setPubUploading(true);
                      const isVideo = file.type.startsWith('video');
                      try {
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                        fd.append('public_id', 'pubs/pub_' + Date.now());
                        const endpoint = isVideo ? 'video' : 'image';
                        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${endpoint}/upload`, { method:'POST', body:fd });
                        const d = await r.json();
                        setPubForm(f => ({...f, imageUrl: d.secure_url, mediaType: isVideo ? 'video' : 'image'}));
                      } catch(e) { console.error(e); }
                      setPubUploading(false);
                    }} />
                  <label htmlFor="pub-img-upload"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'12px', borderRadius:10, border:'2px dashed #c8d8ef', background:'#f5f8ff', cursor:'pointer', marginBottom:12, boxSizing:'border-box' }}>
                    {pubUploading ? 'Upload...' : pubForm.imageUrl ? `${(pubForm as any).mediaType === 'video' ? 'Vidéo' : 'Image'} uploadée` : 'Choisir image ou vidéo'}
                  </label>
                  {pubForm.imageUrl && (
                    (pubForm as any).mediaType === 'video'
                      ? <video src={pubForm.imageUrl} controls style={{ width:'100%', height:120, borderRadius:8, marginBottom:12, background:'#000' }} />
                      : <img src={pubForm.imageUrl} alt="preview" style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8, marginBottom:12 }} />
                  )}

                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                    <input type="checkbox" checked={pubForm.active} onChange={e => setPubForm(f => ({...f, active:e.target.checked}))} id="pub-active" />
                    <label htmlFor="pub-active" style={{ color:'#5a7090', fontSize:13 }}>Activer immédiatement</label>
                  </div>

                  <button onClick={async () => {
                    if (!pubForm.titre || !pubForm.lien) { setMsg('Titre et lien requis'); return; }
                    try {
                      await addDoc(collection(db, 'pubs'), { 
                        titre: pubForm.titre,
                        sousTitre: pubForm.sousTitre,
                        lien: pubForm.lien,
                        lienType: pubForm.lienType,
                        btnLabel: pubForm.btnLabel || '',
                        imageUrl: pubForm.imageUrl,
                        mediaType: pubForm.mediaType || 'image',
                        active: pubForm.active,
                        vues:0, clics:0, createdAt:new Date().toISOString()
                      });
                      setPubModal(false);
                      setPubForm({ titre:'', sousTitre:'', lien:'', lienType:'url', btnLabel:'', imageUrl:'', mediaType:'', active:true });
                      setMsg('Pub publiée !');
                    } catch(e:any) {
                      setMsg('Erreur: ' + e.message);
                    }
                  }} style={{ ...S.btn, width:'100%', padding:14, fontSize:15 }}>
                    Publier la publicité
                  </button>
                </div>
              </div>
            )}

            {/* LISTE PUBS */}
            {pubs.length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <p style={{ color:'#5a7090', fontSize:14, marginBottom:16 }}>Aucune publicité créée</p>
                <p style={{ color:'#8098b8', fontSize:12 }}>Créez votre première pub maison pour promouvoir Doniel Zik, un artiste ou inviter des annonceurs.</p>
              </div>
            ) : pubs.map(p => (
              <div key={p.id} style={{ ...S.card, marginBottom:12 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  {p.imageUrl && <img src={p.imageUrl} alt={p.titre} style={{ width:100, height:60, objectFit:'cover', borderRadius:8, flexShrink:0 }} />}
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:6 }}>
                      <p style={{ fontWeight:700, fontSize:14 }}>{p.titre}</p>
                      <div style={{ display:'flex', gap:6 }}>
                        <span style={{ background: p.active?'#eaffea':'#fff5f5', border:`1px solid ${p.active?'#4dff9a':'#f04a6a'}`, borderRadius:99, padding:'2px 9px', fontSize:10, fontWeight:700, color:p.active?'#00a040':'#f04a6a' }}>
                          {p.active ? '● Actif' : '○ Inactif'}
                        </span>
                        <button onClick={() => updateDoc(doc(db,'pubs',p.id),{active:!p.active})}
                          style={{ ...S.btn2, fontSize:11, padding:'3px 8px' }}>{p.active?'Pause':'Activer'}</button>
                        {estSuperAdmin(user?.email) && <button onClick={() => { if (window.confirm('Supprimer cette pub ?')) import('firebase/firestore').then(({deleteDoc,doc:d})=>deleteDoc(d(db,'pubs',p.id))); }}
                          style={{ ...S.btnRed, fontSize:11, padding:'3px 8px' }}></button>}
                      </div>
                    </div>
                    <p style={{ color:'#8098b8', fontSize:11, marginBottom:8 }}>
                      {p.lienType==='whatsapp'?'':p.lienType==='tel'?'':''} {p.lien}
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[{label:'Vues',val:p.vues||0,color:'#1a6bff'},{label:'Clics',val:p.clics||0,color:'#b07a00'},{label:'CTR',val:p.vues>0?((p.clics||0)*100/(p.vues||1)).toFixed(1)+'%':'—',color:'#1a6bff'}].map((s,i)=>(
                        <div key={i} style={{ background:'#f5f8ff', borderRadius:8, padding:'8px', textAlign:'center' }}>
                          <p style={{ fontWeight:800, fontSize:16, color:s.color, margin:0 }}>{s.val}</p>
                          <p style={{ color:'#8098b8', fontSize:9, margin:'2px 0 0' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'retraits' && (
          <div>
            <h2 style={{ fontFamily:'serif', fontSize:22, fontWeight:800, marginBottom:6 }}>Demandes de retrait</h2>
            <p style={{ color:'#8098b8', fontSize:13, marginBottom:20 }}>{retraits.filter((r:any) => r.statut === 'en_attente').length} en attente sur {retraits.length} au total</p>
            {retraits.length === 0 && <p style={{ color:'#8098b8', textAlign:'center', padding:40 }}>Aucune demande de retrait pour l'instant.</p>}
            {retraits.map((r:any) => (
              <div key={r.id} style={{ background:'#fff', border:'1px solid '+(r.statut==='en_attente'?'#f0b84a':'#dce6f7'), borderRadius:14, padding:18, marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <p style={{ fontWeight:800, fontSize:16 }}>{r.montant?.toLocaleString()} F CFA</p>
                    <p style={{ color:'#5a7090', fontSize:12 }}>{r.artistEmail}</p>
                  </div>
                  <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                    background: r.statut==='en_attente' ? '#fff3dc' : r.statut==='paye' ? '#e6f9f0' : '#fde8ea',
                    color: r.statut==='en_attente' ? '#b07a00' : r.statut==='paye' ? '#00a876' : '#d0344c' }}>
                    {r.statut==='en_attente' ? 'En attente' : r.statut==='paye' ? 'Payé' : 'Rejeté'}
                  </span>
                </div>
                <div style={{ background:'#f5f8ff', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13 }}>
                  <p style={{ color:'#1a2340' }}><strong>Méthode :</strong> {r.methode}</p>
                  <p style={{ color:'#1a2340' }}><strong>Numéro / IBAN :</strong> {r.numero}</p>
                  <p style={{ color:'#8098b8', fontSize:11, marginTop:4 }}>{r.oscart} Oscart · {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR') : ''}</p>
                </div>
                {r.statut === 'en_attente' && (
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={async () => {
                      await updateDoc(doc(db,'retraits',r.id), { statut:'paye', traiteLe: new Date().toISOString() });
                      await envoyerNotification({ to: r.artistEmail, role:'artiste', type:'retrait_paye',
                        text: `Votre retrait de ${r.montant?.toLocaleString()} F CFA a été payé.` });
                    }} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#00c876', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                      ✓ Marquer payé
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm('Rejeter cette demande de retrait ?')) return;
                      await updateDoc(doc(db,'retraits',r.id), { statut:'rejete', traiteLe: new Date().toISOString() });
                      await envoyerNotification({ to: r.artistEmail, role:'artiste', type:'retrait_rejete',
                        text: `Votre demande de retrait de ${r.montant?.toLocaleString()} F CFA a été rejetée. Contactez le support pour plus d'infos.` });
                    }} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #f04a6a', background:'#fff', color:'#f04a6a', fontWeight:700, cursor:'pointer' }}>
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'annonceurs' && (
          <div style={{ display: 'grid', gridTemplateColumns: adminChatId ? '1fr 1fr' : '1fr', gap: 20 }}>

            {/* LISTE CAMPAGNES */}
            <div>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 16, color: '#1a2340' }}>
                Campagnes annonceurs
                {annonceurs.filter(a => a.status === 'pending').length > 0 && (
                  <span style={{ marginLeft: 10, background: '#fff8e6', border: '1px solid #f0b84a', borderRadius: 99, padding: '2px 10px', fontSize: 12, color: '#b07a00', fontWeight: 700 }}>
                    {annonceurs.filter(a => a.status === 'pending').length} en attente
                  </span>
                )}
              </p>
              {annonceurs.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', color: '#8098b8' }}>Aucune campagne reçue</div>
              ) : annonceurs.map(a => {
                const isPending = a.status === 'pending';
                const isActive = a.status === 'active';
                const isRejected = a.status === 'rejected';
                return (
                  <div key={a.id} style={{ ...S.card, marginBottom: 12, borderLeft: `4px solid ${isActive ? '#4dff9a' : isPending ? '#f0b84a' : '#f04a6a'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{a.entreprise || a.nom}</p>
                        <p style={{ color: '#5a7090', fontSize: 12 }}>{a.nom} · {a.telephone}</p>
                        {a.email && <p style={{ color: '#8098b8', fontSize: 11 }}>{a.email}</p>}
                      </div>
                      <span style={badgeStyle(isActive ? 'active' : isPending ? 'pending' : 'rejected')}>
                        {isActive ? '● Actif' : isPending ? 'En attente' : '✕ Rejeté'}
                      </span>
                    </div>

                    {/* Détails campagne */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'Format', val: a.format || '—' },
                        { label: 'Objectif', val: a.objectif || '—' },
                        { label: 'Vues', val: (a.vues || 0).toLocaleString() },
                        { label: 'Coût', val: (a.cout || 0).toLocaleString() + ' F' },
                        { label: 'Vues live', val: (a.vuesLive || 0).toLocaleString() },
                        { label: 'Leads', val: (a.leads || 0).toLocaleString() },
                      ].map((s, i) => (
                        <div key={i} style={{ background: '#f5f8ff', borderRadius: 8, padding: '7px 10px' }}>
                          <p style={{ color: '#8098b8', fontSize: 9, marginBottom: 2 }}>{s.label}</p>
                          <p style={{ fontWeight: 700, fontSize: 13, color: '#1a2340', margin: 0 }}>{s.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Visuel uploadé */}
                    {a.visualUrl && (
                      <div style={{ marginBottom: 10 }}>
                        {a.format === 'video' ? (
                          <video src={a.visualUrl} controls style={{ width: '100%', maxHeight: 160, borderRadius: 8, background: '#000' }} />
                        ) : (
                          <img src={a.visualUrl} alt="visuel" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {isPending && (
                        <>
                          <button onClick={() => validerCampagne(a.id)}
                            style={{ background: '#eaffea', border: '1px solid #4dff9a', borderRadius: 8, padding: '8px 14px', color: '#00a040', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            Valider
                          </button>
                          <button onClick={() => rejeterCampagne(a.id)}
                            style={{ ...S.btnRed, fontSize: 12 }}>
                            ✕ Rejeter
                          </button>
                        </>
                      )}
                      {isActive && (
                        <button onClick={() => updateDoc(doc(db, 'annonceurs', a.id), { status: 'pending' })}
                          style={{ ...S.btn2, fontSize: 12, color: '#b07a00', borderColor: '#f0b84a' }}>
                          ⏸ Suspendre
                        </button>
                      )}
                      <button
                        onClick={() => setAdminChatId(adminChatId === a.id ? null : a.id)}
                        style={{ ...S.btn, padding: '8px 14px', fontSize: 12, background: adminChatId === a.id ? '#0050d0' : '#1a6bff' }}>
                        {adminChatId === a.id ? 'Fermer chat' : 'Chat'}
                      </button>
                    </div>

                    <p style={{ color: '#8098b8', fontSize: 10, marginTop: 8 }}>
                      Soumis le {new Date(a.createdAt).toLocaleDateString('fr')} à {new Date(a.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* CHAT ADMIN ↔ ANNONCEUR */}
            {adminChatId && (() => {
              const ann = annonceurs.find(a => a.id === adminChatId);
              return (
                <div style={{ position: 'sticky', top: 84, height: 'fit-content' }}>
                  <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #dce6f7' }}>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Chat avec annonceur</p>
                        <p style={{ color: '#5a7090', fontSize: 12 }}>{ann?.entreprise || ann?.nom} · {ann?.telephone}</p>
                      </div>
                      <button onClick={() => setAdminChatId(null)} style={{ background: 'none', border: 'none', color: '#8098b8', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>

                    {/* Messages */}
                    <div style={{ background: '#f5f8ff', borderRadius: 10, minHeight: 220, maxHeight: 340, overflowY: 'auto', padding: 12, marginBottom: 12 }}>
                      {adminChatMsgs.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#8098b8', fontSize: 12, marginTop: 40 }}>Démarrez la conversation</p>
                      ) : adminChatMsgs.map(m => (
                        <div key={m.id} style={{ marginBottom: 8, display: 'flex', justifyContent: m.from === 'admin' ? 'flex-end' : 'flex-start' }}>
                          <div style={{ maxWidth: '78%', padding: '9px 13px', borderRadius: m.from === 'admin' ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: m.from === 'admin' ? '#1a6bff' : '#ffffff', border: m.from === 'admin' ? 'none' : '1px solid #dce6f7' }}>
                            <p style={{ color: m.from === 'admin' ? '#fff' : '#1a2340', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{m.text}</p>
                            <p style={{ color: m.from === 'admin' ? 'rgba(255,255,255,0.6)' : '#8098b8', fontSize: 9, margin: '3px 0 0', textAlign: 'right' }}>
                              {new Date(m.ts).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={adminChatInput} onChange={e => setAdminChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAdminMsg()}
                        placeholder="Message à l'annonceur..."
                        style={{ ...S.inp, marginBottom: 0, flex: 1 }} />
                      <button onClick={sendAdminMsg} disabled={adminChatSending || !adminChatInput.trim()}
                        style={{ ...S.btn, padding: '0 16px', fontSize: 18, opacity: adminChatInput.trim() ? 1 : 0.5 }}>➤</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'payments' && (
          <>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, color: '#1a2340' }}>Paiements</p>
            {payments.length === 0 ? (
              <div style={{ background: '#ffffff', border: '1px solid #dce6f7', borderRadius: 16, padding: 40, marginBottom: 16, boxShadow: '0 2px 12px rgba(26,107,255,0.06)', textAlign: 'center', color: '#8098b8' }}>Aucun paiement</div>
            ) : payments.map(p => (
              <div key={p.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.note}</p>
                    <p style={{ color: '#8098b8', fontSize: 12 }}>{p.method} · {p.phone} · {p.date}</p>
                    {p.qrId && <p style={{ color: '#1a6bff', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>Ref: {p.qrId}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: '#1a6bff', fontWeight: 800, fontSize: 18 }}>{(p.amount || 0).toLocaleString()} FCFA</span>
                    <span style={badgeStyle(p.status)}>{p.status}</span>
                    {p.status === 'pending' && <button style={{ ...S.btn, padding: '8px 14px', fontSize: 12 }} onClick={() => verifyPayment(p)}>Valider</button>}
                    {estSuperAdmin(user?.email) && <button style={{ ...S.btnRed, fontSize: 11 }} onClick={() => deleteDoc(doc(db, 'payments', p.id)).then(() => setMsg('Supprime !'))}></button>}
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
