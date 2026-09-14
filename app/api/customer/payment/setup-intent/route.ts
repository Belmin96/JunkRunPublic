/**
 * POST /api/customer/payment/setup-intent
 * Kicks off adding/replacing a verified payment method — Stripe collects the
 * card client-side against this SetupIntent's client secret. Nothing is
 * charged; this only verifies the card is valid and stores it on file.
 */
import { NextResponse } from 'next/server'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe'
import { getOrCreateDbUser } from '@/lib/auth'

export async function POST() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = await getOrCreateStripeCustomer(user)

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
