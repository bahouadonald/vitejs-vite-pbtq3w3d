// api/generer-bio.js
// Génère une bio professionnelle d'artiste à partir des réponses du
// formulaire, dans le style d'une vraie bio pro (identité, parcours,
// inspiration, ambition, une citation qui résume l'artiste).
// Nécessite la variable d'environnement ANTHROPIC_API_KEY sur Vercel.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { form } = req.body || {};
    if (!form || !form.nom) return res.status(400).json({ error: 'Formulaire manquant ou incomplet' });

    const prompt = `Tu es un rédacteur spécialisé dans les biographies professionnelles d'artistes musicaux africains. Rédige une bio professionnelle en français, dans le style d'un communiqué de presse artistique — chaleureux, valorisant, fluide, jamais robotique ni sous forme de liste. Structure : un court paragraphe d'ouverture (identité + genre musical), puis le parcours et la découverte de la passion, puis l'inspiration et l'ambition, et termine par une courte citation en italique qui résume l'artiste (une phrase inventée dans son esprit, crédible, pas cliché). Longueur : 4 à 6 paragraphes courts. N'invente aucun fait qui ne soit pas dans les informations fournies ci-dessous — si une information manque, ne la mentionne simplement pas, ne comble jamais les vides par des suppositions.

Informations fournies par l'artiste :
- Nom de scène : ${form.nom || ''}
- Fonction / spécialité : ${form.fonction || ''}
- Nationalité : ${form.nationalite || ''}
- Lieu de résidence : ${form.residence || ''}
- Découverte de la passion : ${form.passionDecouverte || ''}
- Source de motivation : ${form.sourceMotivation || ''}
- Inspiration : ${form.inspiration || ''}
- Expertise : ${form.expertise || ''}
- Impact souhaité : ${form.impact || ''}
- Vision / ambition : ${form.vision || ''}
- Background / parcours : ${form.background || ''}

Réponds UNIQUEMENT avec le texte de la bio, sans titre, sans guillemets autour du texte entier, sans commentaire avant ou après.`;

    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!reponse.ok) {
      const err = await reponse.text();
      throw new Error('Erreur API Anthropic : ' + err);
    }
    const data = await reponse.json();
    const bio = (data.content || []).map(b => b.text || '').join('').trim();
    if (!bio) throw new Error('Réponse vide de l\'IA');

    return res.status(200).json({ bio });
  } catch (e) {
    console.error('generer-bio', e);
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
