import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hauler = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!hauler) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  const job = await db.job.findFirst({ where: { id, haulerId: hauler.id, status: 'IN_PROGRESS' } })
  if (!job) return NextResponse.json({ error: 'Job not found or not in progress' }, { status: 404 })
  const nonce = randomBytes(24).toString('hex')
  await db.job.update({ where: { id }, data: { completionNonce: nonce, completionStartedAt: new Date() } })
  return NextResponse.json({ completionNonce: nonce, expiresInSeconds: 600 })
}
