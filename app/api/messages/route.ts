import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { CLOSED_JOB_STATUSES } from '@/lib/constants'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 1000
const MAX_MESSAGES_PER_MINUTE = 8
const MAX_MESSAGES_PER_HOUR = 50

const MessageSchema = z.object({
  jobId: z.string().trim().min(1).max(100),
  text: z.string().transform((value) =>
    value
      .normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r\n?/g, '\n')
      .trim(),
  ),
}).superRefine((value, ctx) => {
  if (!value.text) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['text'], message: 'Message cannot be empty' })
  } else if (value.text.length > MAX_MESSAGE_LENGTH) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['text'], message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` })
  }
})

async function isRateLimited(userId: string) {
  const now = Date.now()
  const minuteAgo = new Date(now - 60_000)
  const hourAgo = new Date(now - 3_600_000)

  const [minuteCount, hourCount] = await Promise.all([
    db.message.count({ where: { senderId: userId, createdAt: { gte: minuteAgo } } }),
    db.message.count({ where: { senderId: userId, createdAt: { gte: hourAgo } } }),
  ])

  return minuteCount >= MAX_MESSAGES_PER_MINUTE || hourCount >= MAX_MESSAGES_PER_HOUR
}

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')?.trim()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)
  if (!isAdmin) {
    const job = await db.job.findFirst({
      where: {
        id: jobId,
        OR: [{ customerId: dbUser.id }, { hauler: { userId: dbUser.id } }],
      },
      select: { id: true },
    })
    if (!job) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messages = await db.message.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          haulerProfile: { select: { companyName: true } },
        },
      },
    },
  })

  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 422 })
  }

  const { jobId, text } = parsed.data
  const isAdmin = ['ADMIN', 'OWNER'].includes(dbUser.role)

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      customerId: true,
      status: true,
      hauler: { select: { userId: true } },
    },
  })

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Admin/Owner access is explicit and always records senderRole as ADMIN/OWNER;
  // an admin can never be recorded as a customer or hauler.
  const isCustomer = job.customerId === dbUser.id
  const isAssignedHauler = job.hauler?.userId === dbUser.id
  if (!isAdmin && !isCustomer && !isAssignedHauler) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (CLOSED_JOB_STATUSES.includes(job.status as (typeof CLOSED_JOB_STATUSES)[number])) {
    return NextResponse.json({ error: 'Messaging is closed for this job' }, { status: 409 })
  }

  if (await isRateLimited(dbUser.id)) {
    return NextResponse.json(
      { error: 'Too many messages. Please wait before sending another message.' },
      { status: 429 },
    )
  }

  const senderRole = isAdmin ? dbUser.role : isCustomer ? 'CUSTOMER' : 'HAULER'
  const message = await db.message.create({
    data: {
      jobId,
      senderId: dbUser.id,
      senderRole,
      text,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          haulerProfile: { select: { companyName: true } },
        },
      },
    },
  })

  const recipientId = senderRole === 'CUSTOMER' ? job.hauler?.userId : job.customerId
  if (recipientId && recipientId !== dbUser.id) {
    await db.notification.create({
      data: {
        userId: recipientId,
        type: 'MESSAGE',
        title: 'New message',
        body: `${dbUser.name ?? 'Someone'}: ${text.slice(0, 80)}`,
        jobId,
      },
    }).catch(() => undefined)
  }

  return NextResponse.json({ message })
}
