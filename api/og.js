// api/og.js
// Sert une page HTML minimale avec des balises Open Graph propres à un
// contenu précis (titre, artiste, pochette), pour que WhatsApp/TikTok/
// Facebook/etc. affichent une vraie carte de partage au lieu de la carte
// générique du site. N'est jamais vu par un vrai visiteur humain : Vercel ne
// route ici que les requêtes des robots de partage (voir vercel.json), les
// navigateurs classiques reçoivent directement l'application normale.

export default async function handler(req, res) {
  try {
    const { type, id } = req.query;

    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    const estEcoute = type === 'ecoute';
    const champ = estEcoute ? 'publicLinkId' : 'qrId';
    const collectionId = estEcoute ? 'publicLinks' : 'qrcodes';
    const chemin = estEcoute ? 'ecoute' : 'fan';

    let titre = 'Doniel Zik';
    let description = "L'écosystème des créateurs africains. Musique, cinéma, humour, publicité.";
    let image = 'https://doniel.art/icons/icon-512x512.png';
    const urlFinale = `https://doniel.art/${chemin}/${id || ''}`;

    if (id && PROJECT && KEY) {
      const reponse = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: { fieldFilter: { field: { fieldPath: champ }, op: 'EQUAL', value: { stringValue: id } } },
            limit: 1,
          },
        }),
      });
      const resultats = await reponse.json();
      const docTrouve = (Array.isArray(resultats) ? resultats.find(r => r.document) : null)?.document;
      if (docTrouve) {
        const f = docTrouve.fields || {};
        const label = f.label?.stringValue || '';
        const artist = f.artist?.stringValue || '';
        const cover = f.coverUrl?.stringValue || '';
        if (label) titre = artist ? `${label} — ${artist} | Doniel Zik` : `${label} | Doniel Zik`;
        if (label) description = artist
          ? `Écoutez et téléchargez "${label}" de ${artist} sur Doniel Zik.`
          : `Écoutez et téléchargez "${label}" sur Doniel Zik.`;
        if (cover) image = cover;
      }
    }

    const echapper = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}" />
<meta property="og:title" content="${echapper(titre)}" />
<meta property="og:description" content="${echapper(description)}" />
<meta property="og:image" content="${echapper(image)}" />
<meta property="og:url" content="${echapper(urlFinale)}" />
<meta property="og:type" content="music.song" />
<meta property="og:site_name" content="Doniel Zik" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${echapper(titre)}" />
<meta name="twitter:description" content="${echapper(description)}" />
<meta name="twitter:image" content="${echapper(image)}" />
<meta http-equiv="refresh" content="0;url=${echapper(urlFinale)}" />
</head>
<body>
<p><a href="${echapper(urlFinale)}">${echapper(titre)}</a></p>
</body>
</html>`);
  } catch (e) {
    res.status(500).send('Erreur');
  }
}
