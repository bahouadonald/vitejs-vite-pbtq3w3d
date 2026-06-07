import Stripe from 'stripe';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';

// Init Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  });
}
const db = getFirestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const config = { api: { bodyParser: false } };

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { oscart, userId } = session.metadata!;

    // Créditer les Oscart dans Firestore
    const snap = await db.collection('coins_solde').where('uid', '==', userId).get();
    if (snap.empty) {
      await db.collection('coins_solde').add({
        uid: userId,
        solde: parseInt(oscart),
        createdAt: new Date().toISOString(),
      });
    } else {
      const current = snap.docs[0].data().solde || 0;
      await snap.docs[0].ref.update({ solde: current + parseInt(oscart) });
    }

    // Enregistrer la transaction
    await db.collection('recharges').add({
      userId,
      oscart: parseInt(oscart),
      stripeSessionId: session.id,
      montantEur: session.amount_total! / 100,
      statut: 'completed',
      createdAt: new Date().toISOString(),
    });
  }

  res.json({ received: true });
}
