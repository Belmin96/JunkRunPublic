/** POST /api/estimates/[id]/decline — customer rejects one contractor's quote without necessarily picking another. */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const estimate = await db.estimate.findUnique({ where: { id }, include: { job: true, hauler: true } })
  if (!estimate || estimate.job.customerId !== user.id) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  }
  if (estimate.status !== 'PENDING') {
    return NextResponse.json({ error: 'Estimate already resolved' }, { status: 409 })
  }

  const updated = await db.estimate.update({ where: { id }, data: { status: 'DECLINED' } })

  await notifyUser({
    userId: estimate.hauler.userId,
    type: 'ESTIMATE_DECLINED',
    title: 'Estimate declined',
    body: `The customer passed on your quote for ${estimate.job.jobNumber}.`,
    jobId: estimate.jobId,
    url: '/hauler/loads',
  })

  return NextResponse.json(updated)
}
