import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { hasAcceptedLegal, CUSTOMER_LEGAL } from '@/lib/legal'

const CUSTOMER_REASONS = ['CUSTOMER_CHANGED_MIND', 'SCHEDULE_CHANGE', 'NO_LONGER_NEEDED', 'CONTRACTOR_ISSUE', 'OTHER'] as const

type Reason = typeof CUSTOMER_REASONS[number]

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Only customers can cancel jobs' }, { status: 403 })
  if (!(await hasAcceptedLegal(user.id, CUSTOMER_LEGAL))) return NextResponse.json({ error: 'Legal acceptance is required before cancelling a job', code: 'LEGAL_ACCEPTANCE_REQUIRED' }, { status: 428 })

  let body: unknown = {}
  try { body = await req.json() } catch {}
  const reason = typeof body === 'object' && body !== null && 'reason' in body ? (body as { reason?: unknown }).reason : undefined
  if (typeof reason !== 'string' || !CUSTOMER_REASONS.includes(reason as Reason)) return NextResponse.json({ error: 'A valid cancellation reason is required', allowedReasons: CUSTOMER_REASONS }, { status: 422 })

  const job = await db.job.findUnique({ where: { id } })
  if (!job || job.customerId !== user.id) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) return NextResponse.json({ error: 'Job is already closed' }, { status: 409 })
  if (['IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'PENDING_PAYOUT', 'DISPUTED'].includes(job.status)) return NextResponse.json({ error: 'This job cannot be cancelled after work has started. Use the dispute process instead.' }, { status: 409 })

  const cancelledAt = new Date()
  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.job.updateMany({
      where: { id, customerId: user.id, status: { in: ['POSTED', 'ASSIGNING', 'ASSIGNED'] } },
      data: { status: 'CANCELLED', cancellationReason: reason, cancelledAt, cancelledByUserId: user.id, haulerId: null, pickupDeadlineAt: null, completionNonce: null, completionStartedAt: null, pickupWarningSentAt: null, pickupReminderSentAt: null },
    })
    if (!claimed.count) return null
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_CANCELLED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ reason, cancelledAt: cancelledAt.toISOString(), paymentReviewRequired: job.paymentStatus === 'AUTHORIZED' }) } })
    return tx.job.findUnique({ where: { id } })
  })
  if (!updated) return NextResponse.json({ error: 'Job could not be cancelled because its status changed. Refresh and try again.' }, { status: 409 })

  if (job.haulerId) {
    const hauler = await db.haulerProfile.findUnique({ where: { id: job.haulerId } })
    if (hauler) await notifyUser({ userId: hauler.userId, type: 'JOB_AUTO_RETURNED', title: 'Job cancelled', body: `${job.jobNumber} was cancelled by the customer. Any payment handling will follow the applicable refund/payment policy.`, jobId: id, url: `/hauler/jobs/${id}` })
  }
  return NextResponse.json({ job: updated, refundStatus: job.paymentStatus === 'AUTHORIZED' ? 'REVIEW_REQUIRED' : 'NO_AUTOMATIC_REFUND_CONFIRMED' })
}
