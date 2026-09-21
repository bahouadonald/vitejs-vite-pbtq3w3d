// api/sitemap.js
// Génère un sitemap.xml à la volée, à partir de tout ce qui est publié sur
// Découvrir (collection 'decouvrir') — c'est ce qui permet à Google de
// découvrir et indexer les pages de chaque artiste/titre, au lieu de se
// limiter à la page d'accueil.

export default async function handler(req, res) {
  try {
    const PROJECT = process.env.FIREBASE_PROJECT_ID;
    const KEY = process.env.FIREBASE_API_KEY;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

    const urls = [
      { loc: 'https://doniel.art/', freq: 'daily', priority: '1.0' },
      { loc: 'https://doniel.art/decouvrir', freq: 'daily', priority: '0.9' },
      { loc: 'https://doniel.art/ziko', freq: 'weekly', priority: '0.5' },
      { loc: 'https://doniel.art/artiste', freq: 'weekly', priority: '0.5' },
    ];

    if (PROJECT && KEY) {
      const reponse = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'decouvrir' }],
            limit: 1000,
          },
        }),
      });
      const resultats = await reponse.json();
      const docs = Array.isArray(resultats) ? resultats.filter(r => r.document).map(r => r.document) : [];
      for (const doc of docs) {
        const f = doc.fields || {};
        const publicLinkId = f.publicLinkId?.stringValue || '';
        const masque = f.masque?.booleanValue || false;
        if (publicLinkId && !masque) {
          urls.push({ loc: `https://doniel.art/ecoute/${publicLinkId}`, freq: 'weekly', priority: '0.7' });
        }
      }

      // Pages bio artiste (celles qui ont une bio publiée)
      const reponseArtistes = await fetch(`${baseUrl}:runQuery?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: { from: [{ collectionId: 'artists' }], limit: 1000 },
        }),
      });
      const resultatsArtistes = await reponseArtistes.json();
      const docsArtistes = Array.isArray(resultatsArtistes) ? resultatsArtistes.filter(r => r.document).map(r => r.document) : [];
      for (const doc of docsArtistes) {
        const f = doc.fields || {};
        const slug = f.slug?.stringValue || '';
        const bioTexte = f.bioTexte?.stringValue || '';
        if (slug && bioTexte) {
          urls.push({ loc: `https://doniel.art/artiste-bio/${slug}`, freq: 'monthly', priority: '0.8' });
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send('Erreur sitemap');
  }
}
