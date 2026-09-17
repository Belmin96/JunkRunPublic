import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

const OUTCOMES = ['CUSTOMER_REFUND', 'PARTIAL_REFUND', 'NO_REFUND', 'CONTRACTOR_REMEDY'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'OWNER'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const b = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const outcome = b.outcome
  const notes = typeof b.notes === 'string' ? b.notes.trim().normalize('NFC') : ''
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as typeof OUTCOMES[number])) return NextResponse.json({ error: 'Invalid dispute outcome', allowedOutcomes: OUTCOMES }, { status: 422 })
  if (notes.length > 1000) return NextResponse.json({ error: 'Notes must be 1000 characters or fewer' }, { status: 422 })

  const now = new Date()
  const updated = await db.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id } })
    if (!job || job.status !== 'DISPUTED') return null
    const nextPaymentStatus = outcome === 'NO_REFUND' || outcome === 'CONTRACTOR_REMEDY' ? job.paymentStatus : 'REFUNDED'
    const next = await tx.job.update({ where: { id }, data: { status: 'COMPLETED', disputeOutcome: outcome, disputeResolvedAt: now, paymentStatus: nextPaymentStatus } })
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'DISPUTE_RESOLVED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ outcome, notes, resolvedAt: now.toISOString(), paymentActionRequired: outcome === 'CUSTOMER_REFUND' || outcome === 'PARTIAL_REFUND' }) } })
    return next
  })
  if (!updated) return NextResponse.json({ error: 'Dispute not found or already resolved' }, { status: 409 })

  return NextResponse.json({ job: updated, outcome, paymentActionRequired: outcome === 'CUSTOMER_REFUND' || outcome === 'PARTIAL_REFUND' })
}
