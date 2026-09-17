import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await db.job.findUnique({
    where: { id },
    select: { id: true, customerId: true, haulerId: true },
  })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  let authorized = user.role === 'ADMIN' || user.role === 'OWNER' || job.customerId === user.id
  if (!authorized && user.role === 'HAULER') {
    const profile = await db.haulerProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
    authorized = !!profile && profile.id === job.haulerId
  }
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const photos = await db.jobPhoto.findMany({
    where: { jobId: id },
    orderBy: { capturedAt: 'asc' },
    select: {
      id: true,
      kind: true,
      photoUrl: true,
      capturedAt: true,
      latitude: true,
      longitude: true,
      accuracyMeters: true,
      captureSource: true,
      completionNonce: true,
      createdAt: true,
      userId: true,
    },
  })

  return NextResponse.json(photos)
}
