import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await db.job.findUnique({
    where: { id },
    include: {
      estimates: { include: { hauler: true }, orderBy: { amountCents: 'asc' } },
      hauler: true,
    },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const haulerProfile = user.role === 'HAULER' ? await db.haulerProfile.findUnique({ where: { userId: user.id } }) : null
  const isOwner = job.customerId === user.id || job.haulerId === haulerProfile?.id
  const isAdmin = ['ADMIN', 'OWNER'].includes(user.role)
  const isOpenForHaulers = user.role === 'HAULER' && ['POSTED', 'BIDDING'].includes(job.status)
  if (!isOwner && !isAdmin && !isOpenForHaulers) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(job)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = ['ADMIN', 'OWNER'].includes(user.role)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowedFields = ['status', 'disputeOutcome', 'disputeResolvedAt']
  const update: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key]
  }

  const job = await db.job.update({ where: { id }, data: update })
  return NextResponse.json(job)
}
