import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { distanceMeters, isWithinArrivalGeofence } from '@/lib/pickup'
import { ARRIVAL_GEOFENCE_METERS, PICKUP_REMINDER_MINUTES } from '@/lib/constants'
import { z } from 'zod'

const ArrivalSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().min(0).max(10000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user || user.role !== 'HAULER') return NextResponse.json({ error: 'Contractor access required' }, { status: 403 })
  const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const parsed = ArrivalSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { latitude, longitude, accuracyMeters } = parsed.data

  const job = await db.job.findUnique({ where: { id }, include: { hauler: true } })
  if (!job || job.haulerId !== profile.id) return NextResponse.json({ error: 'Assigned job not found' }, { status: 404 })
  if (!['ASSIGNED', 'IN_PROGRESS'].includes(job.status)) return NextResponse.json({ error: 'Job is not awaiting arrival' }, { status: 409 })
  if (job.arrivalVerifiedAt) return NextResponse.json({ verified: true, distanceMeters: 0 })
  if (job.pickupLatitude == null || job.pickupLongitude == null) return NextResponse.json({ error: 'Pickup GPS coordinates are not configured for this job' }, { status: 409 })
  if (accuracyMeters > ARRIVAL_GEOFENCE_METERS) return NextResponse.json({ error: 'GPS accuracy is too low. Move to an area with a stronger location signal and try again.', accuracyMeters }, { status: 422 })

  const now = new Date()
  const arrivalWindowOpensAt = new Date(job.scheduledAt.getTime() - PICKUP_REMINDER_MINUTES * 60000)
  if (now < arrivalWindowOpensAt) {
    return NextResponse.json({ error: 'Arrival verification is not available yet.', availableAt: arrivalWindowOpensAt }, { status: 409 })
  }
  const deadline = new Date(job.scheduledAt.getTime() + 45 * 60000)
  if (now > deadline) return NextResponse.json({ error: 'The pickup window has expired. This job will be handled by the missed-pickup process.', deadline }, { status: 409 })

  const distance = distanceMeters(latitude, longitude, job.pickupLatitude, job.pickupLongitude)
  if (!isWithinArrivalGeofence(distance)) return NextResponse.json({ error: 'You are not close enough to the pickup location yet.', distanceMeters: Math.round(distance), requiredWithinMeters: ARRIVAL_GEOFENCE_METERS }, { status: 422 })

  const updated = await db.$transaction(async (tx) => {
    const locked = await tx.job.findUnique({ where: { id } })
    if (!locked || locked.haulerId !== profile.id || !['ASSIGNED', 'IN_PROGRESS'].includes(locked.status) || locked.arrivalVerifiedAt) return locked
    const result = await tx.job.update({ where: { id }, data: { status: 'IN_PROGRESS', inProgressAt: locked.inProgressAt ?? now, arrivalVerifiedAt: now, arrivalLatitude: latitude, arrivalLongitude: longitude, arrivalAccuracyMeters: accuracyMeters } })
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'ARRIVAL_GPS_VERIFIED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ distanceMeters: Math.round(distance), accuracyMeters }) } })
    return result
  })

  if (!updated) return NextResponse.json({ error: 'Job no longer available' }, { status: 409 })
  await notifyUser({ userId: job.customerId, type: 'ARRIVAL_VERIFIED', title: 'Contractor has arrived', body: `${job.jobNumber} arrival was verified by GPS.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
  return NextResponse.json({ verified: true, distanceMeters: Math.round(distance), arrivalVerifiedAt: updated.arrivalVerifiedAt })
}
