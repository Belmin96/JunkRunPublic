import { NextRequest, NextResponse } from 'next/server'
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

  try {
    // AUTHORIZED -> CAPTURED. If a webhook already confirmed capture, do not
    // call capture again.
    let paymentStatus = job.paymentStatus
    if (paymentStatus === 'AUTHORIZED') {
      const captured = await stripe.paymentIntents.capture(
        job.stripePaymentIntentId,
        undefined,
        { idempotencyKey: 'job-capture:' + job.id },
      )
      if (captured.status !== 'succeeded') throw new Error('Payment capture did not succeed')

      await db.job.updateMany({
        where: { id: job.id, status: 'PAYOUT_PROCESSING' },
        data: { paymentStatus: 'CAPTURED' },
      })
      paymentStatus = 'CAPTURED'
    }

    if (paymentStatus !== 'CAPTURED') throw new Error('Payment is not captured')

    // CAPTURED -> TRANSFERRED. The idempotency key makes a retry safe if the
    // transfer succeeded but the database update was interrupted.
    const transfer = await stripe.transfers.create(
      {
        amount: job.haulerPayoutCents,
        currency: 'usd',
        destination: job.hauler.stripeAccountId,
        transfer_group: job.jobNumber,
        metadata: { jobId: job.id, jobNumber: job.jobNumber },
      },
      { idempotencyKey: 'job-transfer:' + job.id },
    )

    const completed = await db.$transaction(async (tx) => {
      const current = await tx.job.findUnique({
        where: { id: job.id },
        select: { status: true, paymentStatus: true, stripeTransferId: true },
      })
      if (!current || current.status !== 'PAYOUT_PROCESSING' || current.paymentStatus !== 'CAPTURED') {
        throw new Error('JOB_STATE_CHANGED')
      }

      const result = await tx.job.updateMany({
        where: { id: job.id, status: 'PAYOUT_PROCESSING', paymentStatus: 'CAPTURED' },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'TRANSFERRED',
          stripeTransferId: transfer.id,
          completedAt: new Date(),
        },
      })
      if (result.count !== 1) throw new Error('Job state changed during payout')

      await tx.haulerProfile.update({
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
            paymentIntentId: job.stripePaymentIntentId,
            transferId: transfer.id,
            payoutCents: job.haulerPayoutCents,
            paymentState: 'TRANSFERRED',
          }),
        },
      })
      return result
    })

    if (!completed.count) throw new Error('Payout state update failed')

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

    return NextResponse.json({ success: true, transferId: transfer.id, paymentStatus: 'TRANSFERRED' })
  } catch (err) {
    console.error('Payout release failed', err)

    // If capture succeeded, deliberately keep CAPTURED so a retry resumes at
    // the transfer step instead of trying to capture the PaymentIntent again.
    const recoveryStatus = job.paymentStatus === 'AUTHORIZED' ? 'AUTHORIZED' : 'CAPTURED'
    await db.job.updateMany({
      where: { id: job.id, status: 'PAYOUT_PROCESSING' },
      data: { status: job.status, paymentStatus: recoveryStatus },
    })

    return NextResponse.json({
      error: 'Payout could not be completed. The payment state was preserved so the operation can be safely retried.',
    }, { status: 502 })
  }
}
