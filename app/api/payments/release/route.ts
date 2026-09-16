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
  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  const job = await db.job.findUnique({ where: { id: parsed.data.jobId }, include: { hauler: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'].includes(job.status)) return NextResponse.json({ error: 'Job is not eligible for payout release' }, { status: 409 })
  if (!job.stripePaymentIntentId || !job.hauler?.stripeAccountId) return NextResponse.json({ error: 'Payment or contractor payout setup is incomplete' }, { status: 422 })

  const locked = await db.job.updateMany({ where: { id: job.id, status: { in: ['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'] }, paymentStatus: { not: 'TRANSFERRED' } }, data: { status: 'PAYOUT_PROCESSING' } })
  if (locked.count !== 1) return NextResponse.json({ error: 'Payout is already being processed' }, { status: 409 })

  try {
    const captured = await stripe.paymentIntents.capture(job.stripePaymentIntentId, undefined, { idempotencyKey: `job-capture:${job.id}` })
    if (captured.status !== 'succeeded') throw new Error('Payment capture did not succeed')
    const transfer = await stripe.transfers.create({ amount: job.haulerPayoutCents, currency: 'usd', destination: job.hauler.stripeAccountId, transfer_group: job.jobNumber, metadata: { jobId: job.id, jobNumber: job.jobNumber } }, { idempotencyKey: `job-transfer:${job.id}` })
    const completed = await db.$transaction(async (tx) => {
      const result = await tx.job.updateMany({ where: { id: job.id, status: 'PAYOUT_PROCESSING' }, data: { status: 'COMPLETED', paymentStatus: 'TRANSFERRED', stripeTransferId: transfer.id, completedAt: new Date() } })
      if (result.count !== 1) throw new Error('Job state changed during payout')
      await tx.haulerProfile.update({ where: { id: job.haulerId! }, data: { jobCount: { increment: 1 } } })
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'PAYOUT_RELEASED', entityType: 'JOB', entityId: job.id, jobId: job.id, metadata: JSON.stringify({ paymentIntentId: job.stripePaymentIntentId, transferId: transfer.id, payoutCents: job.haulerPayoutCents }) } })
      return result
    })
    if (!completed.count) throw new Error('Payout state update failed')
    await notifyUser({ userId: job.hauler.userId, type: 'PAYOUT_RELEASED', title: 'Payment released', body: `${formatCents(job.haulerPayoutCents)} for ${job.jobNumber} is on its way.`, jobId: job.id, url: `/hauler/jobs/${job.id}/receipt` })
    await notifyUser({ userId: job.customerId, type: 'PAYOUT_RELEASED', title: 'Job complete — receipt ready', body: `${job.jobNumber} is complete.`, jobId: job.id, url: `/customer/jobs/${job.id}/receipt` })
    return NextResponse.json({ success: true, transferId: transfer.id })
  } catch (err) {
    console.error('Payout release failed', err)
    await db.job.updateMany({ where: { id: job.id, status: 'PAYOUT_PROCESSING' }, data: { status: job.status } })
    return NextResponse.json({ error: 'Payout could not be completed. No duplicate payout will be created on retry.' }, { status: 502 })
  }
}
