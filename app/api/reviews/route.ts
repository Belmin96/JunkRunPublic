/**
 * POST /api/reviews
 * Body: { jobId, stars, note? }
 * Customers review the contractor; contractors review the customer. Only
 * allowed once per job per rater, and only after the job is COMPLETED.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { z } from 'zod'

const ReviewSchema = z.object({
  jobId: z.string(),
  stars: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = ReviewSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { jobId, stars, note } = parsed.data

  const job = await db.job.findUnique({ where: { id: jobId }, include: { hauler: true } })
  if (!job || job.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Job not found or not completed yet' }, { status: 409 })
  }

  const haulerProfile = user.role === 'HAULER' ? await db.haulerProfile.findUnique({ where: { userId: user.id } }) : null
  const isCustomer = job.customerId === user.id
  const isHauler = haulerProfile && job.haulerId === haulerProfile.id
  if (!isCustomer && !isHauler) return NextResponse.json({ error: 'Not a party to this job' }, { status: 403 })

  const review = await db.review.upsert({
    where: { jobId_raterId: { jobId, raterId: user.id } },
    update: { stars, note: note ?? null },
    create: {
      jobId,
      raterId: user.id,
      raterRole: isCustomer ? 'CUSTOMER' : 'HAULER',
      targetType: isCustomer ? 'HAULER' : 'CUSTOMER',
      haulerId: isCustomer ? job.haulerId : null,
      customerId: isCustomer ? null : job.customerId,
      stars,
      note: note ?? null,
    },
  })

  // Keep the contractor's aggregate rating fresh.
  if (isCustomer && job.haulerId) {
    const agg = await db.review.aggregate({
      where: { haulerId: job.haulerId, targetType: 'HAULER' },
      _avg: { stars: true },
    })
    await db.haulerProfile.update({
      where: { id: job.haulerId },
      data: { rating: Math.round((agg._avg.stars ?? 5) * 10) / 10 },
    })
  }

  return NextResponse.json(review, { status: 201 })
}
