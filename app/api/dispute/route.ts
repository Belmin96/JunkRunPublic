/**
 * POST /api/dispute
 * Customer files a dispute before the dispute window closes.
 * Body: { jobId: string, reason: string }
 * Moves job to DISPUTED status and freezes payout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId, reason } = await req.json()
  if (!jobId || !reason) {
    return NextResponse.json({ error: 'jobId and reason are required' }, { status: 400 })
  }

  const job = await db.job.findFirst({
    where: { id: jobId, customerId: user.id, status: 'PENDING_PAYOUT' },
  })
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found, not yours, or not in a disputable state' },
      { status: 404 }
    )
  }

  // Check dispute window
  if (job.disputeWindowEnd && new Date() > job.disputeWindowEnd) {
    return NextResponse.json(
      { error: 'Dispute window has closed. Contact support directly.' },
      { status: 409 }
    )
  }

  const updated = await db.job.update({
    where: { id: jobId },
    data: {
      status: 'DISPUTED',
      disputeReason: reason,
      disputedAt: new Date(),
    },
    include: { hauler: true },
  })

  if (updated.hauler) {
    await notifyUser({
      userId: updated.hauler.userId,
      type: 'DISPUTE',
      title: 'A dispute was filed',
      body: `The customer flagged an issue with ${updated.jobNumber}. Payout is on hold pending review.`,
      jobId: updated.id,
      url: `/hauler/jobs/${updated.id}`,
    })
  }

  return NextResponse.json(updated)
}
