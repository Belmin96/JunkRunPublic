/**
 * POST /api/webhooks/stripe
 * Receives Stripe webhook events and updates job state.
 *
 * Key events handled:
 *   payment_intent.succeeded        — capture confirmed; noop (we track via release endpoint)
 *   payment_intent.payment_failed   — mark job payment as failed
 *   transfer.created                — hauler payout dispatched
 *
 * Webhook signature is verified with STRIPE_WEBHOOK_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing webhook signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook verification failed'
    console.error('Stripe webhook verification failed:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const jobId = pi.metadata.jobId
        if (jobId) {
          await db.job.updateMany({
            where: { id: jobId, paymentStatus: 'AUTHORIZED' },
            data: { paymentStatus: 'CAPTURED' },
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const jobId = pi.metadata.jobId
        if (jobId) {
          await db.job.updateMany({
            where: { id: jobId },
            data: { status: 'CANCELLED', paymentStatus: 'PENDING' },
          })
        }
        break
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const jobNumber = transfer.transfer_group
        if (jobNumber) {
          await db.job.updateMany({
            where: { jobNumber: String(jobNumber), status: { not: 'COMPLETED' } },
            data: { paymentStatus: 'TRANSFERRED', stripeTransferId: transfer.id },
          })
        }
        break
      }

      default:
        // Unhandled event — log and move on
        console.log(`Unhandled Stripe event: ${event.type}`)
    }
  } catch (err) {
    console.error(`Error processing Stripe event ${event.type}:`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
