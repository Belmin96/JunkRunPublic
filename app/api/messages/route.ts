import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
const MessageSchema = z.object({ jobId: z.string().min(1), text: z.string().trim().min(1).max(2000) })

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)
  if (!isAdmin) {
    const job = await db.job.findFirst({ where: { id: jobId, OR: [{ customerId: dbUser.id }, { hauler: { userId: dbUser.id } }] } })
    if (!job) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const messages = await db.message.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' }, take: 200, include: { sender: { select: { id: true, name: true, role: true, haulerProfile: { select: { companyName: true } } } } } })
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const parsed = MessageSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 422 })
  const { jobId, text } = parsed.data
  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)
  const job = await db.job.findFirst({ where: { id: jobId }, include: { hauler: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!isAdmin && job.customerId !== dbUser.id && job.hauler?.userId !== dbUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const senderRole = isAdmin ? 'ADMIN' : dbUser.role
  const message = await db.message.create({ data: { jobId, senderId: dbUser.id, senderRole, text }, include: { sender: { select: { id: true, name: true, role: true, haulerProfile: { select: { companyName: true } } } } } })
  const recipientId = senderRole === 'CUSTOMER' ? job.hauler?.userId : job.customerId
  if (recipientId && recipientId !== dbUser.id) {
    await db.notification.create({ data: { userId: recipientId, type: 'MESSAGE', title: 'New message', body: `${dbUser.name ?? 'Someone'}: ${text.slice(0, 80)}`, jobId } }).catch(() => undefined)
  }
  return NextResponse.json({ message })
}
