import { NextRequest, NextResponse } from 'next/server'
import { stripe, splitPayment, disputeWindowEnd } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { z } from 'zod'
import { PICKUP_DEADLINE_MINUTES } from '@/lib/constants'

const BodySchema = z.object({ estimateId: z.string().min(1) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const estimate = await db.estimate.findFirst({ where: { id: parsed.data.estimateId, jobId: id, status: 'PENDING' }, include: { hauler: true } })
  if (!estimate) return NextResponse.json({ error: 'Estimate not found or no longer available' }, { status: 404 })
  if (!estimate.hauler.verified || !estimate.hauler.stripeAccountId) return NextResponse.json({ error: 'Contractor is not eligible for assignment' }, { status: 409 })
  if (!user.stripeCustomerId || !user.paymentMethodId || !user.paymentVerified) return NextResponse.json({ error: 'Add a verified payment method before accepting an estimate' }, { status: 402 })

  const { platformFeeCents, haulerPayoutCents } = splitPayment(estimate.amountCents)
  const now = new Date()
  const pickupAnchor = now
  const pickupDeadlineAt = new Date(pickupAnchor.getTime() + PICKUP_DEADLINE_MINUTES * 60 * 1000)
  const locked = await db.job.updateMany({
    where: { id, customerId: user.id, status: { in: ['POSTED', 'BIDDING'] } },
    data: { status: 'ASSIGNING', haulerId: estimate.haulerId, priceCents: estimate.amountCents, platformFeeCents, haulerPayoutCents, acceptedAt: now, pickupDeadlineAt, pickupReminderSentAt: null, autoReturnedAt: null, missedPickupAt: null, repostedAt: null },
  })
  if (locked.count !== 1) return NextResponse.json({ error: 'Job was already accepted or changed' }, { status: 409 })

  let intent: Awaited<ReturnType<typeof stripe.paymentIntents.create>>
  try {
    intent = await stripe.paymentIntents.create({ amount: estimate.amountCents, currency: 'usd', customer: user.stripeCustomerId, payment_method: user.paymentMethodId, off_session: true, confirm: true, capture_method: 'manual', metadata: { jobId: id, jobNumber: (await db.job.findUniqueOrThrow({ where: { id }, select: { jobNumber: true } })).jobNumber, estimateId: estimate.id }, description: `JunkRun job ${id}` }, { idempotencyKey: `job-authorization:${id}:${estimate.id}` })
  } catch (err) {
    await db.job.updateMany({ where: { id, status: 'ASSIGNING' }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, acceptedAt: null, pickupDeadlineAt: null } })
    console.error('Stripe authorization failed', err)
    return NextResponse.json({ error: "We couldn't authorize the payment method. Please update it and try again." }, { status: 402 })
  }

  const updated = await db.$transaction(async (tx) => {
    const job = await tx.job.update({ where: { id, status: 'ASSIGNING' }, data: { status: 'ASSIGNED', stripePaymentIntentId: intent.id, paymentStatus: 'AUTHORIZED', authorizedAt: now, disputeWindowEnd: disputeWindowEnd() } })
    await tx.estimate.update({ where: { id: estimate.id }, data: { status: 'ACCEPTED' } })
    await tx.estimate.updateMany({ where: { jobId: id, id: { not: estimate.id } }, data: { status: 'DECLINED' } })
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_ACCEPTED', entityType: 'JOB', entityId: id, jobId: id, metadata: JSON.stringify({ estimateId: estimate.id, amountCents: estimate.amountCents, pickupDeadlineAt: pickupDeadlineAt.toISOString() }) } })
    return job
  }).catch(async (err) => {
    await stripe.paymentIntents.cancel(intent.id).catch((cancelErr) => console.error('Failed to cancel orphan authorization', cancelErr))
    await db.job.updateMany({ where: { id, status: 'ASSIGNING' }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, acceptedAt: null, pickupDeadlineAt: null } })
    throw err
  })

  await notifyUser({ userId: estimate.hauler.userId, type: 'JOB_ASSIGNED', title: 'Your estimate was accepted!', body: `You're assigned to this JunkRun job. Your 45-minute pickup window ends at ${pickupDeadlineAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`, jobId: id, url: `/hauler/jobs/${id}` })
  return NextResponse.json(updated)
}
