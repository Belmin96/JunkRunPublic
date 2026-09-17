import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { disputeWindowEnd } from '@/lib/stripe'
import { notifyUser } from '@/lib/notify'
import { z } from 'zod'

const DataUrlSchema = z.string().regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(5_000_000)
const BodySchema = z.object({
  afterPhotoUrl: DataUrlSchema,
  completionNonce: z.string().regex(/^[a-f0-9]{48}$/),
  capturedAt: z.string().datetime({ offset: true }),
  captureLatitude: z.number().finite().min(-90).max(90).optional(),
  captureLongitude: z.number().finite().min(-180).max(180).optional(),
  captureAccuracyMeters: z.number().finite().min(0).max(100000).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A live camera photo and valid completion session are required' }, { status: 422 })

  const capturedAt = new Date(parsed.data.capturedAt)
  const now = new Date()
  if (Math.abs(now.getTime() - capturedAt.getTime()) > 2 * 60 * 1000) {
    return NextResponse.json({ error: 'The after photo must be captured now at the job site. Please retake it.' }, { status: 409 })
  }

  const hauler = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!hauler) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  const job = await db.job.findFirst({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce } })
  if (!job || !job.completionStartedAt || Date.now() - job.completionStartedAt.getTime() > 10 * 60 * 1000) return NextResponse.json({ error: 'Completion session expired. Start again at the job site.' }, { status: 409 })
  if (job.pickupDeadlineAt && now >= job.pickupDeadlineAt) return NextResponse.json({ error: 'The 45-minute pickup window has expired. The job must be returned to the HaulBoard.' }, { status: 409 })

  const updated = await db.job.updateMany({
    where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce, pickupDeadlineAt: { gt: now } },
    data: {
      afterPhotoUrl: parsed.data.afterPhotoUrl,
      completionNonce: null,
      completionStartedAt: null,
      status: 'PENDING_PAYOUT',
      evidenceSubmittedAt: now,
      verifiedAt: now,
      disputeWindowEnd: disputeWindowEnd(),
    },
  })
  if (updated.count !== 1) return NextResponse.json({ error: 'Job completion was already submitted or the pickup window expired' }, { status: 409 })

  await db.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_EVIDENCE_SUBMITTED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ capturedAt: capturedAt.toISOString(), captureLatitude: parsed.data.captureLatitude ?? null, captureLongitude: parsed.data.captureLongitude ?? null, captureAccuracyMeters: parsed.data.captureAccuracyMeters ?? null, cameraCapture: true }) } })
  await notifyUser({ userId: job.customerId, type: 'JOB_COMPLETED', title: 'Your job is done!', body: `${job.jobNumber} was completed. Review the after photo within the dispute window.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
  return NextResponse.json({ success: true })
}
