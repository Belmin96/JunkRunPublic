import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

const REASONS = ['INCOMPLETE_WORK', 'PROPERTY_DAMAGE', 'WRONG_SERVICE', 'SAFETY_ISSUE', 'OTHER'] as const
const MAX_REASON_LENGTH = 500

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Only customers can open a customer dispute' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const b = body as Record<string, unknown>
  const reason = b.reason
  const details = typeof b.details === 'string' ? b.details.trim().normalize('NFC') : ''
  if (typeof reason !== 'string' || !REASONS.includes(reason as typeof REASONS[number])) return NextResponse.json({ error: 'A valid dispute reason is required', allowedReasons: REASONS }, { status: 422 })
  if (!details || details.length > MAX_REASON_LENGTH) return NextResponse.json({ error: `Dispute details are required and must be ${MAX_REASON_LENGTH} characters or fewer` }, { status: 422 })

  const job = await db.job.findUnique({ where: { id }, include: { hauler: true } })
  if (!job || job.customerId !== user.id) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['PENDING_PAYOUT', 'COMPLETED'].includes(job.status)) return NextResponse.json({ error: 'This job is not currently eligible for a customer dispute' }, { status: 409 })
  if (job.status === 'COMPLETED') return NextResponse.json({ error: 'The job has already been finalized. Contact support if you believe an exception applies.' }, { status: 409 })

  const now = new Date()
  if (job.disputeWindowEnd && now > job.disputeWindowEnd) return NextResponse.json({ error: 'The dispute window has expired' }, { status: 409 })

  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.job.updateMany({ where: { id, customerId: user.id, status: 'PENDING_PAYOUT', disputedAt: null }, data: { status: 'DISPUTED', disputeReason: `${reason}: ${details}`, disputedAt: now, disputeSubmittedById: user.id } })
    if (!claimed.count) return null
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_DISPUTED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ reason, details, disputedAt: now.toISOString() }) } })
    return tx.job.findUnique({ where: { id } })
  })
  if (!updated) return NextResponse.json({ error: 'A dispute was already opened or the job changed state. Refresh and try again.' }, { status: 409 })

  if (job.hauler) await notifyUser({ userId: job.hauler.userId, type: 'DISPUTE', title: 'Customer opened a dispute', body: `A dispute was opened for ${job.jobNumber}. JunkRun will review the job evidence.`, jobId: id, url: `/hauler/jobs/${id}` })
  return NextResponse.json({ job: updated, status: 'DISPUTED' })
}
