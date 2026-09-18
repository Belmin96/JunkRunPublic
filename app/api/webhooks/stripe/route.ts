import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const STALE_PROCESSING_MS = 5 * 60 * 1000

async function claimEvent(event: Stripe.Event): Promise<'CLAIMED' | 'DUPLICATE' | 'RETRY'> {
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } })

  if (!existing) {
    try {
      await db.stripeEvent.create({
        data: { id: event.id, type: event.type, status: 'PROCESSING' },
      })
      return 'CLAIMED'
    } catch {
      // Another request may have inserted the same event concurrently.
    }
  }

  const current = await db.stripeEvent.findUnique({ where: { id: event.id } })
  if (!current) return 'RETRY'
  if (current.status === 'PROCESSED') return 'DUPLICATE'

  const stale = current.updatedAt.getTime() < Date.now() - STALE_PROCESSING_MS
  if (!stale) return 'DUPLICATE'

  const reclaimed = await db.stripeEvent.updateMany({
    where: {
      id: event.id,
      status: { not: 'PROCESSED' },
      updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
    },
    data: { status: 'PROCESSING', lastError: null },
  })
  return reclaimed.count === 1 ? 'CLAIMED' : 'DUPLICATE'
}

async function markProcessed(eventId: string) {
  await db.stripeEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
  })
}

async function markFailed(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown webhook processing error'
  await db.stripeEvent.updateMany({
    where: { id: eventId },
    data: { status: 'FAILED', lastError: message.slice(0, 2000) },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const claim = await claimEvent(event)
    if (claim === 'DUPLICATE') return NextResponse.json({ received: true, duplicate: true })
    if (claim === 'RETRY') return NextResponse.json({ error: 'Please retry webhook' }, { status: 500 })

    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) {
          await db.job.updateMany({
            where: { id: pi.metadata.jobId, stripePaymentIntentId: pi.id, paymentStatus: 'AUTHORIZED' },
            data: { authorizedAt: new Date(pi.created * 1000), paymentStatus: 'AUTHORIZED' },
          })
        }
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) {
          await db.job.updateMany({
            where: { id: pi.metadata.jobId, stripePaymentIntentId: pi.id },
            data: { paymentStatus: 'CAPTURED' },
          })
        }
        break
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) {
          await db.job.updateMany({
            where: {
              id: pi.metadata.jobId,
              stripePaymentIntentId: pi.id,
              status: { in: ['ASSIGNED', 'ASSIGNING'] },
            },
            data: { status: 'CANCELLED', paymentStatus: 'PENDING' },
          })
        }
        break
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const jobId = transfer.metadata.jobId
        if (jobId) {
          await db.job.updateMany({
            where: { id: jobId, stripeTransferId: null },
            data: { stripeTransferId: transfer.id },
          })
        }
        break
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer
        const jobId = transfer.metadata.jobId
        if (jobId) {
          await db.job.updateMany({
            where: { id: jobId, stripeTransferId: transfer.id },
            data: { paymentStatus: 'TRANSFER_REVERSED' },
          })
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id
        if (piId) {
          await db.job.updateMany({
            where: { stripePaymentIntentId: piId },
            data: { paymentStatus: 'REFUNDED' },
          })
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const onboardingComplete = !!account.details_submitted && !!account.payouts_enabled
        await db.haulerProfile.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeOnboardingDone: onboardingComplete },
        })
        break
      }

      case 'payout.failed':
      case 'payout.canceled': {
        // These are connected-account bank-payout events. They do not mean
        // the platform transfer itself failed, so keep the job transfer state
        // unchanged and retain the Stripe event for reconciliation/audit.
        break
      }

      default:
        break
    }

    await markProcessed(event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`Stripe webhook processing failed: ${event.id}`, err)
    await markFailed(event.id, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
