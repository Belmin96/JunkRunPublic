/**
 * GET  /api/messages?jobId=<id>   — fetch messages for a job (customer or hauler)
 * POST /api/messages              — send a message on a job
 *
 * Access: customer who owns the job OR hauler assigned to the job.
 * Admins can read all via /api/admin/messages.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // Verify the user is a party to this job (or admin)
  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)
  if (!isAdmin) {
    const job = await db.job.findFirst({
      where: {
        id: jobId,
        OR: [
          { customerId: dbUser.id },
          { hauler: { userId: dbUser.id } },
        ],
      },
    })
    if (!job) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messages = await db.message.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true, role: true, haulerProfile: { select: { companyName: true } } } } },
  })

  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { jobId, text } = await req.json()
  if (!jobId || !text?.trim()) return NextResponse.json({ error: 'jobId and text required' }, { status: 400 })

  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)

  // Verify the user is a party to this job
  if (!isAdmin) {
    const job = await db.job.findFirst({
      where: {
        id: jobId,
        OR: [
          { customerId: dbUser.id },
          { hauler: { userId: dbUser.id } },
        ],
      },
    })
    if (!job) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const senderRole = isAdmin ? 'ADMIN' : dbUser.role // "CUSTOMER" | "HAULER" | "ADMIN"

  const message = await db.message.create({
    data: {
      jobId,
      senderId: dbUser.id,
      senderRole,
      text: text.trim(),
    },
    include: { sender: { select: { id: true, name: true, role: true, haulerProfile: { select: { companyName: true } } } } },
  })

  // Create in-app notification for the other party
  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { hauler: { include: { user: true } } },
    })
    if (job) {
      const recipientId = senderRole === 'CUSTOMER' ? job.hauler?.userId : job.customerId
      if (recipientId && recipientId !== dbUser.id) {
        await db.notification.create({
          data: {
            userId: recipientId,
            type: 'MESSAGE',
            title: 'New message',
            body: `${dbUser.name ?? 'Someone'}: ${text.trim().slice(0, 80)}`,
            jobId,
          },
        })
      }
    }
  } catch {
    // Non-fatal — message still delivered
  }

  return NextResponse.json({ message })
}
