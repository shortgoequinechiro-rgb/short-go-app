import Stripe from 'stripe'

// Lazily instantiated so the build doesn't crash when STRIPE_SECRET_KEY
// isn't set in the environment yet (e.g. Vercel before keys are configured).
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}
