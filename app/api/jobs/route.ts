import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyHaulersOfNewJob } from '@/lib/notify'
import { JOB_TYPES } from '@/lib/constants'
import { z } from 'zod'

const CreateJobSchema = z.object({
  jobTypes: z.array(z.enum(JOB_TYPES)).min(1, 'Pick at least one job type'),
  whatToExpect: z.string().optional(),
  numStories: z.number().int().min(1).max(10),
  pickupAddress: z.string().min(5),
  city: z.string().min(2),
  zipCode: z.string().min(5),
  arrivalType: z.enum(['SET_TIME', 'ANYTIME']),
  date: z.string().min(6),
  time: z.string().optional(),
  beforePhotoUrl: z.string().min(10, 'A before photo is required'),
})

/**
 * GET /api/jobs?tab=available|mine|all
 *  - customer: always their own loads ("My Loads")
 *  - hauler:   "available" = open HaulBoard jobs, "mine" = assigned/active/past
 *  - admin:    "all" = every job on the platform
 */
export async function GET(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab')

  if (user.role === 'CUSTOMER') {
    const jobs = await db.job.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { estimates: true } } },
    })
    return NextResponse.json(jobs)
  }

  if (user.role === 'HAULER') {
    const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
    if (!haulerProfile) return NextResponse.json([])

    if (tab === 'mine') {
      const jobs = await db.job.findMany({
        where: { haulerId: haulerProfile.id },
        orderBy: { updatedAt: 'desc' },
      })
      return NextResponse.json(jobs)
    }

    // "available" — the HaulBoard: open jobs this hauler hasn't already declined
    const declines = await db.jobDecline.findMany({ where: { haulerId: haulerProfile.id }, select: { jobId: true } })
    const jobs = await db.job.findMany({
      where: {
        status: { in: ['POSTED', 'BIDDING'] },
        id: { notIn: declines.map((d) => d.jobId) },
      },
      orderBy: { createdAt: 'desc' },
      include: { estimates: { where: { haulerId: haulerProfile.id } } },
    })
    return NextResponse.json(jobs)
  }

  // ADMIN / OWNER — "All Loads"
  const jobs = await db.job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { estimates: true } } },
  })
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Only customers can post jobs' }, { status: 403 })
  }
  if (!user.paymentVerified) {
    return NextResponse.json(
      { error: 'Add a verified payment method before posting a job', code: 'PAYMENT_UNVERIFIED' },
      { status: 402 }
    )
  }

  const body = await req.json()
  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const data = parsed.data
  if (data.arrivalType === 'SET_TIME' && !data.time) {
    return NextResponse.json({ error: 'A pickup time is required unless you choose Anytime' }, { status: 422 })
  }

  const scheduledAt =
    data.arrivalType === 'SET_TIME' ? new Date(`${data.date}T${data.time}`) : new Date(`${data.date}T23:59:59`)

  const count = await db.job.count()
  const jobNumber = `JR-${String(count + 1).padStart(4, '0')}`

  const job = await db.job.create({
    data: {
      jobNumber,
      customerId: user.id,
      jobTypes: JSON.stringify(data.jobTypes),
      whatToExpect: data.whatToExpect || null,
      numStories: data.numStories,
      pickupAddress: data.pickupAddress,
      city: data.city,
      zipCode: data.zipCode,
      arrivalType: data.arrivalType,
      date: data.date,
      time: data.arrivalType === 'SET_TIME' ? data.time! : null,
      scheduledAt,
      beforePhotoUrl: data.beforePhotoUrl,
      status: 'POSTED',
      paymentStatus: 'PENDING',
    },
  })

  notifyHaulersOfNewJob({
    id: job.id,
    jobNumber: job.jobNumber,
    city: job.city,
    typesLabel: data.jobTypes.slice(0, 2).join(', ') + (data.jobTypes.length > 2 ? '…' : ''),
  }).catch((err) => console.error('notifyHaulersOfNewJob failed:', err))

  return NextResponse.json({ jobId: job.id, jobNumber: job.jobNumber }, { status: 201 })
}
