import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { disputeWindowEnd } from '@/lib/stripe'
import { notifyUser } from '@/lib/notify'
import { hasAcceptedLegal, CONTRACTOR_LEGAL } from '@/lib/legal'
import { z } from 'zod'

const DataUrlSchema = z.string().regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(5_000_000)
const BodySchema = z.object({ afterPhotoUrl: DataUrlSchema, completionNonce: z.string().regex(/^[a-f0-9]{48}$/), capturedAt: z.string().datetime({ offset: true }), captureLatitude: z.number().finite().min(-90).max(90).optional(), captureLongitude: z.number().finite().min(-180).max(180).optional(), captureAccuracyMeters: z.number().finite().min(0).max(100000).nullable().optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can complete jobs' }, { status: 403 })
  if (!(await hasAcceptedLegal(user.id, CONTRACTOR_LEGAL))) return NextResponse.json({ error: 'Required contractor agreements must be accepted before completing jobs', code: 'LEGAL_ACCEPTANCE_REQUIRED', redirect: '/legal/accept' }, { status: 451 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A live camera photo and valid completion session are required' }, { status: 422 })
  const capturedAt = new Date(parsed.data.capturedAt)
  const now = new Date()
  if (Math.abs(now.getTime() - capturedAt.getTime()) > 2 * 60 * 1000) return NextResponse.json({ error: 'The after photo must be captured now at the job site. Please retake it.' }, { status: 409 })

  const hauler = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!hauler) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  const job = await db.job.findFirst({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce } })
  if (!job || !job.completionStartedAt || Date.now() - job.completionStartedAt.getTime() > 10 * 60 * 1000) return NextResponse.json({ error: 'Completion session expired. Start again at the job site.' }, { status: 409 })
  if (job.pickupDeadlineAt && now >= job.pickupDeadlineAt) {
    const windowLabel = job.arrivalType === 'ANYTIME' ? '24-hour' : '45-minute'
    return NextResponse.json({ error: `The ${windowLabel} pickup window has expired. The job must be returned to the HaulBoard.` }, { status: 409 })
  }

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS', completionNonce: parsed.data.completionNonce, pickupDeadlineAt: { gt: now } }, data: { afterPhotoUrl: parsed.data.afterPhotoUrl, completionNonce: null, completionStartedAt: null, status: 'PENDING_PAYOUT', evidenceSubmittedAt: now, verifiedAt: now, disputeWindowEnd: disputeWindowEnd() } })
    if (updated.count !== 1) return null
    const photo = await tx.jobPhoto.create({ data: { jobId: id, userId: user.id, kind: 'AFTER_CONTRACTOR', photoUrl: parsed.data.afterPhotoUrl, capturedAt, latitude: parsed.data.captureLatitude, longitude: parsed.data.captureLongitude, accuracyMeters: parsed.data.captureAccuracyMeters ?? null, captureSource: 'LIVE_CAMERA_WEB', completionNonce: parsed.data.completionNonce } })
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_EVIDENCE_SUBMITTED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ jobPhotoId: photo.id, capturedAt: capturedAt.toISOString(), captureLatitude: parsed.data.captureLatitude ?? null, captureLongitude: parsed.data.captureLongitude ?? null, captureAccuracyMeters: parsed.data.captureAccuracyMeters ?? null, cameraCapture: true, captureSource: 'LIVE_CAMERA_WEB' }) } })
    return photo
  })
  if (!result) return NextResponse.json({ error: 'Job completion was already submitted or the pickup window expired' }, { status: 409 })
  await notifyUser({ userId: job.customerId, type: 'JOB_COMPLETED', title: 'Your job is done!', body: `${job.jobNumber} was completed. Review the after photo within the dispute window.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
  return NextResponse.json({ success: true, evidenceId: result.id })
}
