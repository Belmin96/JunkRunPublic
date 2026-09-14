/**
 * POST /api/jobs/[id]/decline
 * A contractor explicitly passes on a HaulBoard job — it disappears from
 * their board and the customer is notified that a contractor declined.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can decline jobs' }, { status: 403 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const job = await db.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await db.jobDecline.upsert({
    where: { jobId_haulerId: { jobId: id, haulerId: haulerProfile.id } },
    update: {},
    create: { jobId: id, haulerId: haulerProfile.id },
  })

  notifyUser({
    userId: job.customerId,
    type: 'JOB_DECLINED',
    title: 'A contractor passed on your job',
    body: `Don't worry — ${job.jobNumber} is still open for other estimates.`,
    jobId: job.id,
    url: `/customer/jobs/${job.id}`,
  }).catch((err) => console.error('notifyUser failed:', err))

  return NextResponse.json({ success: true })
}
