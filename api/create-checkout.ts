import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, oscart, email, userId } = req.body;

  if (!amount || !oscart || !userId) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${oscart} Oscart — Doniel Zik`,
            description: `Recharge de ${oscart} Oscart sur Doniel Zik`,
          },
          unit_amount: Math.round(amount * 0.0015 * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://doniel.art/recharge-success?oscart=${oscart}&userId=${encodeURIComponent(userId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://doniel.art/ziko`,
      customer_email: email || undefined,
      metadata: {
        oscart: String(oscart),
        userId: String(userId),
        amount: String(amount),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
