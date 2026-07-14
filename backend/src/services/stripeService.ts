import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

// Lazily instantiate so the app can still boot (e.g. for local dev without
// Stripe keys set up yet) and only throws when a payment route is actually hit.
export const getStripe = (): Stripe => {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to your .env (test mode key: sk_test_...)');
  }

  // Pinned to the API version this SDK version's types expect. If you
  // upgrade the `stripe` package later, TypeScript will flag a mismatch
  // here again - bump this string to match the new required literal.
  stripeClient = new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
  return stripeClient;
};
