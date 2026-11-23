// ─────────────────────────────────────────────
// SIGNATURE SONORE — tout ce que l'artiste écoute AVANT de payer porte la
// signature « Doniel Zik » (au début, puis toutes les 20 secondes).
// Le mixage se fait dans le navigateur de l'admin au moment du dépôt : le
// fichier propre est gardé à part et ne se débloque qu'après paiement.
// ─────────────────────────────────────────────
import { Mp3Encoder } from '@breezystack/lamejs';

const TAUX = 44100;
const INTERVALLE = 20; // secondes entre deux signatures

function contexte(): AudioContext {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  return new Ctx();
}

async function decoder(donnees: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = contexte();
  try { return await ctx.decodeAudioData(donnees); }
  finally { ctx.close().catch(() => {}); }
}

// Signature par défaut (si aucune signature enregistrée) : trois notes brillantes
async function signatureParDefaut(): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.round(TAUX * 1.6), TAUX);
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const o = off.createOscillator(); const g = off.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    const t = i * 0.28;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(off.destination);
    o.start(t); o.stop(t + 1);
  });
  return off.startRendering();
}

function versMp3(tampon: AudioBuffer): Blob {
  const canaux = Math.min(2, tampon.numberOfChannels);
  const enc = new Mp3Encoder(canaux, tampon.sampleRate, 128);
  const conv = (f: Float32Array) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    return out;
  };
  const g = conv(tampon.getChannelData(0));
  const d = canaux > 1 ? conv(tampon.getChannelData(1)) : g;
  const morceaux: BlobPart[] = [];
  const bloc = 1152;
  for (let i = 0; i < g.length; i += bloc) {
    const m = canaux > 1 ? enc.encodeBuffer(g.subarray(i, i + bloc), d.subarray(i, i + bloc)) : enc.encodeBuffer(g.subarray(i, i + bloc));
    if (m.length) morceaux.push(new Uint8Array(m));
  }
  const fin = enc.flush();
  if (fin.length) morceaux.push(new Uint8Array(fin));
  return new Blob(morceaux, { type: 'audio/mpeg' });
}

// Renvoie une copie MP3 du fichier avec la signature sonore posée dessus
export async function avecSignature(fichier: Blob, signatureUrl?: string): Promise<Blob> {
  const musique = await decoder(await fichier.arrayBuffer());
  let signature: AudioBuffer;
  try {
    signature = signatureUrl ? await decoder(await (await fetch(signatureUrl)).arrayBuffer()) : await signatureParDefaut();
  } catch { signature = await signatureParDefaut(); }

  const longueur = Math.ceil(musique.duration * TAUX);
  const off = new OfflineAudioContext(2, longueur, TAUX);

  // Musique, baissée pendant chaque signature pour qu'on l'entende bien
  const src = off.createBufferSource(); src.buffer = musique;
  const volume = off.createGain(); volume.gain.value = 1;
  src.connect(volume).connect(off.destination);
  src.start(0);

  const dureeSig = signature.duration;
  for (let t = 2; t < musique.duration - 1; t += INTERVALLE) {
    volume.gain.setValueAtTime(1, t);
    volume.gain.linearRampToValueAtTime(0.35, t + 0.15);
    volume.gain.setValueAtTime(0.35, t + dureeSig);
    volume.gain.linearRampToValueAtTime(1, t + dureeSig + 0.3);
    const s = off.createBufferSource(); s.buffer = signature;
    const gs = off.createGain(); gs.gain.value = 1;
    s.connect(gs).connect(off.destination);
    s.start(t);
  }
  const rendu = await off.startRendering();
  return versMp3(rendu);
}
