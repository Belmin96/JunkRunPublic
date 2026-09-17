import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

const OUTCOMES = ['CUSTOMER_REFUND', 'PARTIAL_REFUND', 'NO_REFUND', 'CONTRACTOR_REMEDY'] as const
type Outcome = typeof OUTCOMES[number]

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
  const refundAmountCents = b.refundAmountCents === undefined ? null : Number(b.refundAmountCents)

  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as Outcome)) return NextResponse.json({ error: 'Invalid dispute outcome', allowedOutcomes: OUTCOMES }, { status: 422 })
  if (!notes || notes.length > 2000) return NextResponse.json({ error: 'Resolution notes are required and must be 2000 characters or fewer' }, { status: 422 })
  if (outcome === 'PARTIAL_REFUND' && (!Number.isInteger(refundAmountCents) || refundAmountCents <= 0)) return NextResponse.json({ error: 'A positive refundAmountCents is required for a partial refund' }, { status: 422 })
  if (outcome !== 'PARTIAL_REFUND' && refundAmountCents !== null) return NextResponse.json({ error: 'refundAmountCents is only valid for PARTIAL_REFUND' }, { status: 422 })

  const now = new Date()
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id } })
    if (!job) return { kind: 'NOT_FOUND' as const }
    if (job.status !== 'DISPUTED' || job.disputeResolvedAt) return { kind: 'ALREADY_RESOLVED' as const }
    if (outcome === 'PARTIAL_REFUND' && refundAmountCents! > (job.priceCents ?? 0)) return { kind: 'INVALID_AMOUNT' as const }

    const claimed = await tx.job.updateMany({
      where: { id, status: 'DISPUTED', disputeResolvedAt: null },
      data: {
        // A dispute decision is not the same thing as payment completion.
        // Keep DISPUTED until the separate payment/refund workflow confirms movement of funds.
        disputeOutcome: outcome,
        disputeResolvedAt: now,
      },
    })
    if (!claimed.count) return { kind: 'ALREADY_RESOLVED' as const }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'DISPUTE_RESOLVED',
        entityType: 'JOB',
        entityId: id,
        jobId: id,
        metadata: JSON.stringify({
          outcome,
          notes,
          refundAmountCents: outcome === 'PARTIAL_REFUND' ? refundAmountCents : outcome === 'CUSTOMER_REFUND' ? job.priceCents : null,
          paymentActionRequired: true,
          resolvedAt: now.toISOString(),
        }),
      },
    })
    return { kind: 'OK' as const, jobId: id, outcome }
  })

  if (result.kind === 'NOT_FOUND') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (result.kind === 'INVALID_AMOUNT') return NextResponse.json({ error: 'Refund amount cannot exceed the job price' }, { status: 422 })
  if (result.kind === 'ALREADY_RESOLVED') return NextResponse.json({ error: 'Dispute not found or already resolved' }, { status: 409 })

  return NextResponse.json({
    ok: true,
    jobId: result.jobId,
    outcome: result.outcome,
    paymentActionRequired: true,
    message: 'Dispute decision recorded. The job remains DISPUTED until the separate payment/refund workflow is completed.',
  })
}
