/**
 * POST /api/jobs/[id]/start
 * Contractor marks the job In Progress. The before photo was already
 * captured by the customer at posting time, so there's nothing to gate here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const job = await db.job.findFirst({ where: { id, haulerId: haulerProfile.id, status: 'ASSIGNED' } })
  if (!job) return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 })

  const now = new Date()
  if (job.pickupDeadlineAt && now >= job.pickupDeadlineAt) {
    return NextResponse.json({ error: 'The 45-minute pickup window has expired. This job is being returned to the HaulBoard.' }, { status: 409 })
  }

  const updated = await db.job.updateMany({
    where: { id, haulerId: haulerProfile.id, status: 'ASSIGNED', pickupDeadlineAt: { gt: now } },
    data: { status: 'IN_PROGRESS', inProgressAt: now },
  })
  if (updated.count !== 1) return NextResponse.json({ error: 'The pickup window expired or the job changed. Refresh the job.' }, { status: 409 })
  return NextResponse.json(await db.job.findUniqueOrThrow({ where: { id } }))
}
