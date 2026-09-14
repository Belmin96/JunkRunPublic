import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

// ── Platform fee helpers ──────────────────────────────────────────────────────

export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 10)

/** Given a total price in cents, compute the platform fee and hauler payout. */
export function splitPayment(priceCents: number) {
  const platformFeeCents = Math.round(priceCents * (PLATFORM_FEE_PERCENT / 100))
  const haulerPayoutCents = priceCents - platformFeeCents
  return { platformFeeCents, haulerPayoutCents }
}

// ── Dispute window ────────────────────────────────────────────────────────────

export const DISPUTE_WINDOW_HOURS = Number(process.env.DISPUTE_WINDOW_HOURS ?? 24)

export function disputeWindowEnd(): Date {
  const d = new Date()
  d.setHours(d.getHours() + DISPUTE_WINDOW_HOURS)
  return d
}

// ── Payment verification (customer must add a card before posting a job) ─────

import { db } from './db'

/** Get this user's Stripe Customer, creating one on first use. */
export async function getOrCreateStripeCustomer(user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  })
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } })
  return customer.id
}
