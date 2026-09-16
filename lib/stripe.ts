import Stripe from 'stripe'
import { db } from './db'

const secret = process.env.STRIPE_SECRET_KEY
if (!secret) throw new Error('STRIPE_SECRET_KEY is not set')

export const stripe = new Stripe(secret, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

const fee = Number(process.env.PLATFORM_FEE_PERCENT ?? 10)
if (!Number.isFinite(fee) || fee < 0 || fee > 100) throw new Error('PLATFORM_FEE_PERCENT must be between 0 and 100')
export const PLATFORM_FEE_PERCENT = fee

export function splitPayment(priceCents: number) {
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error('Invalid price')
  const platformFeeCents = Math.round(priceCents * (PLATFORM_FEE_PERCENT / 100))
  return { platformFeeCents, haulerPayoutCents: priceCents - platformFeeCents }
}

const disputeHours = Number(process.env.DISPUTE_WINDOW_HOURS ?? 24)
if (!Number.isFinite(disputeHours) || disputeHours < 0 || disputeHours > 168) throw new Error('DISPUTE_WINDOW_HOURS must be 0-168')
export const DISPUTE_WINDOW_HOURS = disputeHours
export function disputeWindowEnd(): Date {
  return new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000)
}

export async function getOrCreateStripeCustomer(user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe.customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userId: user.id } },
    { idempotencyKey: `customer:${user.id}` },
  )
  const updated = await db.user.updateMany({
    where: { id: user.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  })
  if (updated.count === 0) {
    const current = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } })
    if (current?.stripeCustomerId) return current.stripeCustomerId
  }
  return customer.id
}
