import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { formatCents } from '@/lib/utils'
import { z } from 'zod'

const BodySchema = z.object({ jobId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'OWNER'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const job = await db.job.findUnique({ where: { id: parsed.data.jobId }, include: { hauler: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'].includes(job.status)) return NextResponse.json({ error: 'Job is not eligible for payout release' }, { status: 409 })
  if (!job.stripePaymentIntentId || !job.hauler?.stripeAccountId) return NextResponse.json({ error: 'Payment or contractor payout setup is incomplete' }, { status: 422 })

  const locked = await db.job.updateMany({
    where: {
      id: job.id,
      status: { in: ['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'] },
      paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] },
    },
    data: { status: 'PAYOUT_PROCESSING' },
  })
  if (locked.count !== 1) return NextResponse.json({ error: 'Payout is already being processed or payment is not in a releasable state' }, { status: 409 })

  let transfer: Stripe.Transfer | null = null

  try {
    // Re-read after locking so a webhook that won a race with this request is
    // respected. Never trust the pre-lock snapshot for an external payment state.
    let current = await db.job.findUnique({ where: { id: job.id } })
    if (!current || current.status !== 'PAYOUT_PROCESSING') throw new Error('JOB_STATE_CHANGED')

    if (!current.stripePaymentIntentId) throw new Error('PAYMENT_INTENT_MISSING')

    // Reconcile the PaymentIntent before deciding whether capture is needed.
    // This makes the operation recoverable if Stripe succeeded but our DB write
    // was interrupted.
    let paymentIntent = await stripe.paymentIntents.retrieve(current.stripePaymentIntentId)
    if (paymentIntent.status === 'succeeded') {
      await db.job.updateMany({
        where: { id: job.id, status: 'PAYOUT_PROCESSING', paymentStatus: { in: ['AUTHORIZED', 'CAPTURED'] } },
        data: { paymentStatus: 'CAPTURED' },
      })
    } else if (paymentIntent.status === 'requires_capture') {
      paymentIntent = await stripe.paymentIntents.capture(
        current.stripePaymentIntentId,
        undefined,
        { idempotencyKey: 'job-capture:' + job.id },
      )
      if (paymentIntent.status !== 'succeeded') throw new Error('Payment capture did not succeed')
      await db.job.updateMany({
        where: { id: job.id, status: 'PAYOUT_PROCESSING' },
        data: { paymentStatus: 'CAPTURED' },
      })
    } else {
      throw new Error('PaymentIntent is not capturable: ' + paymentIntent.status)
    }

    current = await db.job.findUnique({ where: { id: job.id } })
    if (!current || current.status !== 'PAYOUT_PROCESSING' || current.paymentStatus !== 'CAPTURED') {
      throw new Error('PAYMENT_DB_STATE_NOT_CAPTURED')
    }

    // The idempotency key is stable for the job. If Stripe created the transfer
    // and the DB write failed, the same request on retry returns the same transfer.
    transfer = await stripe.transfers.create(
      {
        amount: current.haulerPayoutCents,
        currency: 'usd',
        destination: job.hauler.stripeAccountId,
        transfer_group: job.jobNumber,
        metadata: { jobId: job.id, jobNumber: job.jobNumber },
      },
      { idempotencyKey: 'job-transfer:' + job.id },
    )

    const finalized = await db.$transaction(async (tx) => {
      const result = await tx.job.updateMany({
        where: {
          id: job.id,
          status: 'PAYOUT_PROCESSING',
          paymentStatus: 'CAPTURED',
          OR: [{ stripeTransferId: null }, { stripeTransferId: transfer!.id }],
        },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'TRANSFERRED',
          stripeTransferId: transfer!.id,
          completedAt: new Date(),
        },
      })

      if (result.count !== 1) {
        const already = await tx.job.findUnique({ where: { id: job.id }, select: { status: true, paymentStatus: true, stripeTransferId: true } })
        if (already?.status === 'COMPLETED' && already.paymentStatus === 'TRANSFERRED' && already.stripeTransferId === transfer!.id) {
          return { count: 0, alreadyFinalized: true }
        }
        throw new Error('JOB_STATE_CHANGED')
      }

      await tx.haulerProfile.updateMany({
        where: { id: job.haulerId! },
        data: { jobCount: { increment: 1 } },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'PAYOUT_RELEASED',
          entityType: 'JOB',
          entityId: job.id,
          jobId: job.id,
          metadata: JSON.stringify({
            paymentIntentId: current!.stripePaymentIntentId,
            transferId: transfer!.id,
            payoutCents: current!.haulerPayoutCents,
            paymentState: 'TRANSFERRED',
          }),
        },
      })
      return { count: result.count, alreadyFinalized: false }
    })

    await notifyUser({
      userId: job.hauler.userId,
      type: 'PAYOUT_RELEASED',
      title: 'Payment released',
      body: formatCents(job.haulerPayoutCents) + ' for ' + job.jobNumber + ' is on its way.',
      jobId: job.id,
      url: '/hauler/jobs/' + job.id + '/receipt',
    })
    await notifyUser({
      userId: job.customerId,
      type: 'PAYOUT_RELEASED',
      title: 'Job complete — receipt ready',
      body: job.jobNumber + ' is complete.',
      jobId: job.id,
      url: '/customer/jobs/' + job.id + '/receipt',
    })

    return NextResponse.json({ success: true, transferId: transfer.id, paymentStatus: 'TRANSFERRED', alreadyFinalized: finalized.alreadyFinalized })
  } catch (err) {
    console.error('Payout release failed', err)

    // Reconcile Stripe before changing the database back. If Stripe captured the
    // payment, keep CAPTURED. If a transfer was created, persist its ID and leave
    // the job recoverable for the webhook/retry path instead of rolling it back.
    try {
      const pi = job.stripePaymentIntentId ? await stripe.paymentIntents.retrieve(job.stripePaymentIntentId) : null
      const stripeCaptured = pi?.status === 'succeeded'
      const transferId = transfer?.id ?? null

      if (transferId) {
        await db.job.updateMany({
          where: { id: job.id, status: 'PAYOUT_PROCESSING' },
          data: { paymentStatus: stripeCaptured ? 'CAPTURED' : 'CAPTURED', stripeTransferId: transferId },
        })
      } else if (stripeCaptured) {
        await db.job.updateMany({
          where: { id: job.id, status: 'PAYOUT_PROCESSING' },
          data: { paymentStatus: 'CAPTURED' },
        })
      } else {
        await db.job.updateMany({
          where: { id: job.id, status: 'PAYOUT_PROCESSING' },
          data: { status: job.status, paymentStatus: 'AUTHORIZED' },
        })
      }
    } catch (reconcileErr) {
      console.error('Stripe/DB reconciliation failed after payout error', reconcileErr)
      // Leave PAYOUT_PROCESSING intact. A webhook or a later retry can safely
      // reconcile the external Stripe state without risking a duplicate charge.
    }

    return NextResponse.json({
      error: 'Payout could not be completed. Stripe and database state was preserved for safe retry/reconciliation.',
    }, { status: 502 })
  }
}
