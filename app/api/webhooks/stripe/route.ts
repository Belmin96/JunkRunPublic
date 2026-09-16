import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 })
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(body, sig, secret) } catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) }

  try {
    const inserted = await db.stripeEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true })
    if (inserted.count === 0) return NextResponse.json({ received: true, duplicate: true })

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) await db.job.updateMany({ where: { id: pi.metadata.jobId, stripePaymentIntentId: pi.id }, data: { paymentStatus: 'CAPTURED' } })
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) await db.job.updateMany({ where: { id: pi.metadata.jobId, stripePaymentIntentId: pi.id, status: { in: ['ASSIGNED', 'ASSIGNING'] } }, data: { status: 'CANCELLED', paymentStatus: 'PENDING' } })
        break
      }
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata.jobId) await db.job.updateMany({ where: { id: pi.metadata.jobId, stripePaymentIntentId: pi.id, status: { in: ['ASSIGNED', 'ASSIGNING'] } }, data: { status: 'CANCELLED', paymentStatus: 'PENDING' } })
        break
      }
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const jobId = transfer.metadata.jobId
        if (jobId) await db.job.updateMany({ where: { id: jobId, stripeTransferId: transfer.id }, data: { paymentStatus: 'TRANSFERRED' } })
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (piId) await db.job.updateMany({ where: { stripePaymentIntentId: piId }, data: { paymentStatus: 'REFUNDED' } })
        break
      }
      default:
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`Stripe webhook processing failed: ${event.id}`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
