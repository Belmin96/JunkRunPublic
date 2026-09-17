import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { disputeWindowEnd } from '@/lib/stripe'
import { notifyUser } from '@/lib/notify'
import { z } from 'zod'

const BodySchema = z.object({ afterPhotoUrl: z.string().url().max(2048), completionNonce: z.string().regex(/^[a-f0-9]{48}$/) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'A valid after photo and completion session are required' }, { status: 422 })
  const hauler = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!hauler) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  const job = await db.job.findFirst({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce } })
  const now = new Date()
  if (!job || !job.completionStartedAt || Date.now() - job.completionStartedAt.getTime() > 10 * 60 * 1000) return NextResponse.json({ error: 'Completion session expired. Start again at the job site.' }, { status: 409 })
  if (job.pickupDeadlineAt && now >= job.pickupDeadlineAt) return NextResponse.json({ error: 'The 45-minute pickup window has expired. The job must be returned to the HaulBoard.' }, { status: 409 })
  const updated = await db.job.updateMany({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce, pickupDeadlineAt: { gt: now } }, data: { afterPhotoUrl: parsed.data.afterPhotoUrl, completionNonce: null, completionStartedAt: null, status: 'PENDING_PAYOUT', evidenceSubmittedAt: now, verifiedAt: now, disputeWindowEnd: disputeWindowEnd() } })
  if (updated.count !== 1) return NextResponse.json({ error: 'Job completion was already submitted or the pickup window expired' }, { status: 409 })
  await db.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_EVIDENCE_SUBMITTED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ photoUrl: parsed.data.afterPhotoUrl }) } })
  await notifyUser({ userId: job.customerId, type: 'JOB_COMPLETED', title: 'Your job is done!', body: `${job.jobNumber} was completed. Review the after photo within the dispute window.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
  return NextResponse.json({ success: true })
}
