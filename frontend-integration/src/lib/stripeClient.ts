import { loadStripe, Stripe } from '@stripe/stripe-js';

// Loaded once and reused - loadStripe() caches internally too, but this
// avoids re-triggering the script-injection check on every render.
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripePromise = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn(
        'VITE_STRIPE_PUBLISHABLE_KEY is not set - deposit form will not be able to load Stripe.'
      );
    }
    stripePromise = loadStripe(key || '');
  }
  return stripePromise;
};
