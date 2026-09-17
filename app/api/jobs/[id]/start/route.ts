/**
 * POST /api/jobs/[id]/start
 * Contractor marks the job In Progress after required legal acceptance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { hasAcceptedLegal, CONTRACTOR_LEGAL } from '@/lib/legal'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can start jobs' }, { status: 403 })
  if (!(await hasAcceptedLegal(user.id, CONTRACTOR_LEGAL))) return NextResponse.json({ error: 'Required contractor agreements must be accepted before starting jobs', code: 'LEGAL_ACCEPTANCE_REQUIRED', redirect: '/legal/accept' }, { status: 451 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  const job = await db.job.findFirst({ where: { id, haulerId: haulerProfile.id, status: 'ASSIGNED' } })
  if (!job) return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 })

  const now = new Date()
  if (job.pickupDeadlineAt && now >= job.pickupDeadlineAt) {
    const windowLabel = job.arrivalType === 'ANYTIME' ? '24-hour' : '45-minute'
    return NextResponse.json({ error: `The ${windowLabel} pickup window has expired. This job is being returned to the HaulBoard.` }, { status: 409 })
  }
  const updated = await db.job.updateMany({ where: { id, haulerId: haulerProfile.id, status: 'ASSIGNED', pickupDeadlineAt: { gt: now } }, data: { status: 'IN_PROGRESS', inProgressAt: now } })
  if (updated.count !== 1) return NextResponse.json({ error: 'The pickup window expired or the job changed. Refresh the job.' }, { status: 409 })
  return NextResponse.json(await db.job.findUniqueOrThrow({ where: { id } }))
}
