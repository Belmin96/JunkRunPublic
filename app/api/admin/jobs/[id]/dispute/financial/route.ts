import { NextRequest, NextResponse } from 'next/server'
import { stripe, splitPayment } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
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
  if (job.status !== 'DISPUTED' || !job.disputeResolvedAt || !job.disputeOutcome) {
    return NextResponse.json({ error: 'The dispute must be resolved by an admin before financial processing.' }, { status: 409 })
  }
  if (job.disputeFinancialStatus === 'REFUNDED' || job.disputeFinancialStatus === 'PARTIALLY_REFUNDED' || job.disputeFinancialStatus === 'NO_REFUND') {
    return NextResponse.json({ success: true, financialStatus: job.disputeFinancialStatus, alreadyResolved: true })
  }
  if (job.disputeOutcome === 'CONTRACTOR_REMEDY') {
    return NextResponse.json({ error: 'Contractor remedy must be completed before financial processing.', financialStatus: 'REMEDY_PENDING' }, { status: 409 })
  }
  if (!job.stripePaymentIntentId) return NextResponse.json({ error: 'Payment intent is missing' }, { status: 422 })

  const locked = await db.job.updateMany({
    where: {
      id: job.id,
      status: 'DISPUTED',
      disputeFinancialStatus: { in: ['NONE', 'PROCESSING'] },
    },
    data: { disputeFinancialStatus: 'PROCESSING' },
  })
  if (!locked.count) return NextResponse.json({ error: 'Financial resolution is already being processed.' }, { status: 409 })

  try {
    const pi = await stripe.paymentIntents.retrieve(job.stripePaymentIntentId)

    if (job.disputeOutcome === 'CUSTOMER_REFUND') {
      let refundId: string | null = job.stripeRefundId
      if (pi.status === 'requires_capture') {
        await stripe.paymentIntents.cancel(pi.id, undefined, { idempotencyKey: 'job-dispute-cancel:' + job.id })
      } else if (pi.status === 'succeeded') {
        if (!refundId) {
          const refund = await stripe.refunds.create(
            { payment_intent: pi.id, amount: job.priceCents ?? undefined, metadata: { jobId: job.id, reason: 'CUSTOMER_REFUND' } },
            { idempotencyKey: 'job-dispute-refund:' + job.id },
          )
          refundId = refund.id
        }
      } else if (pi.status !== 'canceled') {
        throw new Error('PaymentIntent is not refundable or cancelable in its current state: ' + pi.status)
      }

      await db.job.updateMany({
        where: { id: job.id, status: 'DISPUTED', disputeFinancialStatus: 'PROCESSING' },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'REFUNDED',
          disputeFinancialStatus: 'REFUNDED',
          refundAmountCents: job.priceCents,
          stripeRefundId: refundId,
        },
      })
      await db.auditLog.create({
        data: {
          actorUserId: user.id, action: 'DISPUTE_FINANCIAL_RESOLVED', entityType: 'JOB',
          entityId: job.id, jobId: job.id,
          metadata: JSON.stringify({ outcome: job.disputeOutcome, financialStatus: 'REFUNDED', refundAmountCents: job.priceCents, stripeRefundId: refundId }),
        },
      })
      return NextResponse.json({ success: true, financialStatus: 'REFUNDED', refundId })
    }

    if (job.disputeOutcome === 'PARTIAL_REFUND') {
      const refundAmount = job.refundAmountCents ?? 0
      if (refundAmount <= 0 || refundAmount >= (job.priceCents ?? 0)) {
        throw new Error('Partial refund amount must be greater than zero and less than the job price')
      }

      if (pi.status === 'requires_capture') {
        await stripe.paymentIntents.capture(pi.id, undefined, { idempotencyKey: 'job-dispute-capture:' + job.id })
      } else if (pi.status !== 'succeeded') {
        throw new Error('PaymentIntent is not captured and cannot be partially refunded: ' + pi.status)
      }

      let refundId = job.stripeRefundId
      if (!refundId) {
        const refund = await stripe.refunds.create(
          { payment_intent: pi.id, amount: refundAmount, metadata: { jobId: job.id, reason: 'PARTIAL_REFUND' } },
          { idempotencyKey: 'job-dispute-refund:' + job.id },
        )
        refundId = refund.id
      }

      const netCents = (job.priceCents ?? 0) - refundAmount
      const { platformFeeCents, haulerPayoutCents } = splitPayment(netCents)
      if (!job.hauler?.stripeAccountId) throw new Error('Contractor Stripe account is missing')

      const transfer = job.stripeTransferId
        ? { id: job.stripeTransferId }
        : await stripe.transfers.create(
            {
              amount: haulerPayoutCents,
              currency: 'usd',
              destination: job.hauler.stripeAccountId,
              transfer_group: job.jobNumber,
              metadata: { jobId: job.id, jobNumber: job.jobNumber, dispute: 'PARTIAL_REFUND' },
            },
            { idempotencyKey: 'job-dispute-transfer:' + job.id },
          )

      await db.$transaction(async tx => {
        const result = await tx.job.updateMany({
          where: { id: job.id, status: 'DISPUTED', disputeFinancialStatus: 'PROCESSING' },
          data: {
            status: 'COMPLETED',
            paymentStatus: 'TRANSFERRED',
            disputeFinancialStatus: 'PARTIALLY_REFUNDED',
            stripeRefundId: refundId,
            stripeTransferId: transfer.id,
            platformFeeCents,
            haulerPayoutCents,
            completedAt: new Date(),
          },
        })
        if (!result.count) throw new Error('Job state changed during dispute processing')
        await tx.haulerProfile.update({ where: { id: job.haulerId! }, data: { jobCount: { increment: 1 } } })
        await tx.auditLog.create({
          data: {
            actorUserId: user.id, action: 'DISPUTE_FINANCIAL_RESOLVED', entityType: 'JOB',
            entityId: job.id, jobId: job.id,
            metadata: JSON.stringify({ outcome: job.disputeOutcome, financialStatus: 'PARTIALLY_REFUNDED', refundAmountCents: refundAmount, stripeRefundId: refundId, transferId: transfer.id, payoutCents: haulerPayoutCents }),
          },
        })
      })
      return NextResponse.json({ success: true, financialStatus: 'PARTIALLY_REFUNDED', refundId, transferId: transfer.id })
    }

    if (job.disputeOutcome === 'NO_REFUND') {
      if (!job.hauler?.stripeAccountId) throw new Error('Contractor Stripe account is missing')
      if (pi.status === 'requires_capture') {
        await stripe.paymentIntents.capture(pi.id, undefined, { idempotencyKey: 'job-dispute-capture:' + job.id })
      } else if (pi.status !== 'succeeded') {
        throw new Error('PaymentIntent cannot be released in its current state: ' + pi.status)
      }

      const transfer = job.stripeTransferId
        ? { id: job.stripeTransferId }
        : await stripe.transfers.create(
            {
              amount: job.haulerPayoutCents,
              currency: 'usd',
              destination: job.hauler.stripeAccountId,
              transfer_group: job.jobNumber,
              metadata: { jobId: job.id, jobNumber: job.jobNumber, dispute: 'NO_REFUND' },
            },
            { idempotencyKey: 'job-dispute-transfer:' + job.id },
          )

      await db.$transaction(async tx => {
        const result = await tx.job.updateMany({
          where: { id: job.id, status: 'DISPUTED', disputeFinancialStatus: 'PROCESSING' },
          data: { status: 'COMPLETED', paymentStatus: 'TRANSFERRED', disputeFinancialStatus: 'NO_REFUND', stripeTransferId: transfer.id, completedAt: new Date() },
        })
        if (!result.count) throw new Error('Job state changed during dispute processing')
        await tx.haulerProfile.update({ where: { id: job.haulerId! }, data: { jobCount: { increment: 1 } } })
        await tx.auditLog.create({
          data: {
            actorUserId: user.id, action: 'DISPUTE_FINANCIAL_RESOLVED', entityType: 'JOB',
            entityId: job.id, jobId: job.id,
            metadata: JSON.stringify({ outcome: job.disputeOutcome, financialStatus: 'NO_REFUND', transferId: transfer.id, payoutCents: job.haulerPayoutCents }),
          },
        })
      })
      return NextResponse.json({ success: true, financialStatus: 'NO_REFUND', transferId: transfer.id })
    }

    throw new Error('Unsupported dispute outcome')
  } catch (err) {
    console.error('Dispute financial processing failed', err)
    await db.job.updateMany({
      where: { id: job.id, status: 'DISPUTED', disputeFinancialStatus: 'PROCESSING' },
      data: { disputeFinancialStatus: 'NONE' },
    })
    return NextResponse.json({ error: 'Financial resolution failed safely. No completed state was recorded; retry is allowed.' }, { status: 502 })
  }
}
