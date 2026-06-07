import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, oscart, email, userId } = req.body;

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
          unit_amount: Math.round(amount * 0.0015 * 100), // FCFA → EUR → centimes
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://doniel.art/recharge-success?oscart=${oscart}&userId=${userId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://doniel.art/ziko`,
      customer_email: email,
      metadata: { oscart: String(oscart), userId, amount: String(amount) },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
