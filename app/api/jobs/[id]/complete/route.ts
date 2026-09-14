/**
 * POST /api/jobs/[id]/complete
 * Body: { afterPhotoUrl }
 * Contractor captures the after photo and marks the job done. That's the
 * evidence checklist in full: before (customer, at posting) + after
 * (contractor, here) → job enters the 24h dispute window → payment released.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { disputeWindowEnd } from '@/lib/stripe'
import { notifyUser } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { afterPhotoUrl } = await req.json()
  if (!afterPhotoUrl) return NextResponse.json({ error: 'An after photo is required to complete the job' }, { status: 400 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const job = await db.job.findFirst({ where: { id, haulerId: haulerProfile.id, status: 'IN_PROGRESS' } })
  if (!job) return NextResponse.json({ error: 'Job not found or not in progress' }, { status: 404 })

  const windowEnd = disputeWindowEnd()

  const updated = await db.job.update({
    where: { id },
    data: {
      afterPhotoUrl,
      status: 'PENDING_PAYOUT',
      evidenceSubmittedAt: new Date(),
      verifiedAt: new Date(),
      disputeWindowEnd: windowEnd,
    },
  })

  await notifyUser({
    userId: job.customerId,
    type: 'JOB_COMPLETED',
    title: 'Your job is done!',
    body: `${job.jobNumber} was completed. Review the after photo — you have 24h to flag an issue before payment releases.`,
    jobId: job.id,
    url: `/customer/jobs/${job.id}`,
  })

  return NextResponse.json(updated)
}
