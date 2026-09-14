/**
 * GET/POST /api/jobs/[id]/estimates
 * A contractor views the job photo + questionnaire and names their price —
 * this is the "estimation system" the customer later chooses between.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { z } from 'zod'

const EstimateSchema = z.object({
  amountCents: z.number().int().min(2500),
  arrival: z.string().optional(),
  message: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const estimates = await db.estimate.findMany({
    where: { jobId: id },
    orderBy: { amountCents: 'asc' },
    include: { hauler: true },
  })
  return NextResponse.json(estimates)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can submit estimates' }, { status: 403 })

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!haulerProfile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  const job = await db.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['POSTED', 'BIDDING'].includes(job.status)) {
    return NextResponse.json({ error: 'Job is no longer accepting estimates' }, { status: 409 })
  }

  const parsed = EstimateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const estimate = await db.estimate.upsert({
    where: { jobId_haulerId: { jobId: id, haulerId: haulerProfile.id } },
    update: {
      amountCents: parsed.data.amountCents,
      message: parsed.data.message ?? null,
      arrival: parsed.data.arrival ?? null,
      status: 'PENDING',
    },
    create: {
      jobId: id,
      haulerId: haulerProfile.id,
      amountCents: parsed.data.amountCents,
      message: parsed.data.message ?? null,
      arrival: parsed.data.arrival ?? null,
    },
  })

  if (job.status === 'POSTED') {
    await db.job.update({ where: { id }, data: { status: 'BIDDING' } })
  }

  notifyUser({
    userId: job.customerId,
    type: 'ESTIMATE_RECEIVED',
    title: 'New estimate on your job',
    body: `${haulerProfile.companyName} quoted you for ${job.jobNumber}`,
    jobId: job.id,
    url: `/customer/jobs/${job.id}`,
  }).catch((err) => console.error('notifyUser failed:', err))

  return NextResponse.json(estimate, { status: 201 })
}
