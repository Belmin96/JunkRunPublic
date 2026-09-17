/**
 * GET/POST /api/jobs/[id]/estimates
 * Contractors submit estimates. Customers choose one estimate to accept or decline.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { z } from 'zod'

const ArrivalSchema = z.enum(['SET_TIME', 'ANYTIME'])

const EstimateSchema = z.object({
  amountCents: z.number().int().min(2500),
  // Arrival is a controlled scheduling choice, not free-form text.
  arrival: ArrivalSchema,
  message: z.string().trim().max(2000).optional(),
})

const ESTIMATE_SELECT = {
  id: true,
  jobId: true,
  haulerId: true,
  amountCents: true,
  arrival: true,
  message: true,
  status: true,
  createdAt: true,
  hauler: { select: { id: true, companyName: true, bio: true, vehicleType: true, rating: true, jobCount: true, verified: true } },
} as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await db.job.findUnique({ where: { id }, select: { id: true, customerId: true, haulerId: true, status: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const haulerProfile = user.role === 'HAULER' ? await db.haulerProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : null
  const isAdmin = ['ADMIN', 'OWNER'].includes(user.role)
  const isCustomerOwner = user.role === 'CUSTOMER' && job.customerId === user.id
  const isAssignedHauler = user.role === 'HAULER' && job.haulerId === haulerProfile?.id
  const isOpenHauler = user.role === 'HAULER' && job.status === 'POSTED'

  if (!isAdmin && !isCustomerOwner && !isAssignedHauler && !isOpenHauler) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const estimates = await db.estimate.findMany({
    where: isOpenHauler && !isAssignedHauler ? { jobId: id, haulerId: haulerProfile!.id } : { jobId: id },
    orderBy: [{ status: 'asc' }, { amountCents: 'asc' }],
    select: ESTIMATE_SELECT,
  })
  return NextResponse.json(estimates)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can submit estimates' }, { status: 403 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id }, select: { id: true, companyName: true } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const job = await db.job.findUnique({ where: { id }, select: { id: true, customerId: true, status: true, arrivalType: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'POSTED') return NextResponse.json({ error: 'Job is no longer accepting estimates' }, { status: 409 })

  const excluded = await db.jobHaulerExclusion.findUnique({ where: { jobId_haulerId: { jobId: id, haulerId: haulerProfile.id } }, select: { id: true } })
  if (excluded) return NextResponse.json({ error: 'You are not eligible to estimate this reposted job' }, { status: 403 })

  const parsed = EstimateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Contractors must honor the customer's selected arrival mode; they cannot
  // change a timed pickup into an anytime pickup or vice versa.
  if (parsed.data.arrival !== job.arrivalType) {
    return NextResponse.json({ error: `Arrival must be ${job.arrivalType}` }, { status: 422 })
  }

  const estimate = await db.estimate.upsert({
    where: { jobId_haulerId: { jobId: id, haulerId: haulerProfile.id } },
    update: { amountCents: parsed.data.amountCents, message: parsed.data.message ?? null, arrival: parsed.data.arrival, status: 'PENDING' },
    create: { jobId: id, haulerId: haulerProfile.id, amountCents: parsed.data.amountCents, message: parsed.data.message ?? null, arrival: parsed.data.arrival },
    select: ESTIMATE_SELECT,
  })

  notifyUser({ userId: job.customerId, type: 'ESTIMATE_RECEIVED', title: 'New estimate on your job', body: `${haulerProfile.companyName} sent an estimate for your JunkRun job.`, jobId: job.id, url: `/customer/jobs/${job.id}` }).catch((err) => console.error('notifyUser failed:', err))
  return NextResponse.json(estimate, { status: 201 })
}
