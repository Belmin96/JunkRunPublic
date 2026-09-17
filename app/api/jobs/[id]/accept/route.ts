import { NextRequest, NextResponse } from 'next/server'
import { stripe, splitPayment, disputeWindowEnd } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { PICKUP_DEADLINE_MINUTES } from '@/lib/constants'
import { hasAcceptedLegal, CUSTOMER_LEGAL } from '@/lib/legal'
import { z } from 'zod'

const BodySchema = z.object({ estimateId: z.string().min(1) })
const ANYTIME_PICKUP_WINDOW_MINUTES = 24 * 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Only customers can approve estimates' }, { status: 403 })
  if (!(await hasAcceptedLegal(user.id, CUSTOMER_LEGAL))) return NextResponse.json({ error: 'Required JunkRun policies must be accepted before approving an estimate', code: 'LEGAL_ACCEPTANCE_REQUIRED', redirect: '/legal/accept' }, { status: 451 })
  let body: unknown; try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const estimate = await db.estimate.findFirst({ where: { id: parsed.data.estimateId, jobId: id, status: 'PENDING' }, include: { hauler: true, job: { select: { id: true, customerId: true, status: true, jobNumber: true, arrivalType: true, scheduledAt: true } } } })
  if (!estimate) return NextResponse.json({ error: 'Estimate not found or no longer available' }, { status: 404 })
  if (estimate.job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer who posted the job can approve an estimate' }, { status: 403 })
  if (estimate.job.status !== 'POSTED') return NextResponse.json({ error: 'Job is no longer accepting estimate approvals' }, { status: 409 })
  if (!estimate.hauler.verified || !estimate.hauler.stripeAccountId) return NextResponse.json({ error: 'Contractor is not eligible for assignment' }, { status: 409 })

  // Do not trust only the database flag. Confirm the connected account is
  // actually enabled for payouts before authorizing the customer's payment.
  try {
    const connectedAccount = await stripe.accounts.retrieve(estimate.hauler.stripeAccountId)
    if (!connectedAccount.details_submitted || !connectedAccount.payouts_enabled) {
      return NextResponse.json({ error: 'Contractor has not completed Stripe payout onboarding' }, { status: 409 })
    }
    if (!estimate.hauler.stripeOnboardingDone) {
      await db.haulerProfile.updateMany({
        where: { id: estimate.hauler.id, stripeAccountId: estimate.hauler.stripeAccountId },
        data: { stripeOnboardingDone: true },
      })
    }
  } catch (error) {
    console.error('Stripe Connect account verification failed', error)
    return NextResponse.json({ error: 'Unable to verify contractor payout setup' }, { status: 502 })
  }
  if (!user.stripeCustomerId || !user.paymentMethodId || !user.paymentVerified) return NextResponse.json({ error: 'Add a verified payment method before accepting an estimate' }, { status: 402 })

  const { platformFeeCents, haulerPayoutCents } = splitPayment(estimate.amountCents)
  const now = new Date()

  // SET_TIME: the contractor gets 45 minutes starting at the scheduled pickup time.
  // ANYTIME: the contractor gets 24 hours starting when the estimate is accepted.
  const pickupWindowMinutes = estimate.job.arrivalType === 'ANYTIME'
    ? ANYTIME_PICKUP_WINDOW_MINUTES
    : PICKUP_DEADLINE_MINUTES
  const pickupWindowStart = estimate.job.arrivalType === 'SET_TIME'
    ? estimate.job.scheduledAt
    : now
  const pickupDeadlineAt = new Date(pickupWindowStart.getTime() + pickupWindowMinutes * 60 * 1000)

  // A timed job cannot be accepted after its pickup window has already expired.
  if (estimate.job.arrivalType === 'SET_TIME' && pickupDeadlineAt <= now) {
    return NextResponse.json({ error: 'This scheduled pickup window has already expired and cannot be assigned.' }, { status: 409 })
  }

  const locked = await db.job.updateMany({ where: { id, customerId: user.id, status: 'POSTED' }, data: { status: 'ASSIGNING', haulerId: estimate.haulerId, priceCents: estimate.amountCents, platformFeeCents, haulerPayoutCents, acceptedAt: now, pickupDeadlineAt, pickupReminderSentAt: null, autoReturnedAt: null, missedPickupAt: null, repostedAt: null } })
  if (locked.count !== 1) return NextResponse.json({ error: 'Job was already accepted or changed' }, { status: 409 })

  let intent: Awaited<ReturnType<typeof stripe.paymentIntents.create>>
  try { intent = await stripe.paymentIntents.create({ amount: estimate.amountCents, currency: 'usd', customer: user.stripeCustomerId, payment_method: user.paymentMethodId, off_session: true, confirm: true, capture_method: 'manual', metadata: { jobId: id, jobNumber: estimate.job.jobNumber, estimateId: estimate.id }, description: `JunkRun job ${id}` }, { idempotencyKey: `job-authorization:${id}:${estimate.id}` }) }
  catch (err) { await db.job.updateMany({ where: { id, status: 'ASSIGNING' }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, acceptedAt: null, pickupDeadlineAt: null } }); console.error('Stripe authorization failed', err); return NextResponse.json({ error: "We couldn't authorize the payment method. Please update it and try again." }, { status: 402 }) }

  try {
    const updated = await db.$transaction(async (tx) => {
      const currentJob = await tx.job.findUnique({ where: { id }, select: { status: true, customerId: true, haulerId: true } })
      if (!currentJob || currentJob.status !== 'ASSIGNING' || currentJob.customerId !== user.id || currentJob.haulerId !== estimate.haulerId) throw new Error('JOB_STATE_CHANGED')
      const currentEstimate = await tx.estimate.findUnique({ where: { id: estimate.id }, select: { status: true } })
      if (!currentEstimate || currentEstimate.status !== 'PENDING') throw new Error('ESTIMATE_NO_LONGER_PENDING')
      const job = await tx.job.update({ where: { id, status: 'ASSIGNING' }, data: { status: 'ASSIGNED', stripePaymentIntentId: intent.id, paymentStatus: 'AUTHORIZED', authorizedAt: now, disputeWindowEnd: disputeWindowEnd() } })
      await tx.estimate.update({ where: { id: estimate.id }, data: { status: 'ACCEPTED' } })
      await tx.estimate.updateMany({ where: { jobId: id, id: { not: estimate.id }, status: 'PENDING' }, data: { status: 'DECLINED' } })
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'ESTIMATE_ACCEPTED', entityType: 'ESTIMATE', entityId: estimate.id, jobId: id, metadata: JSON.stringify({ estimateId: estimate.id, amountCents: estimate.amountCents, pickupDeadlineAt: pickupDeadlineAt.toISOString(), pickupWindowStart: pickupWindowStart.toISOString(), pickupWindowMinutes, arrivalType: estimate.job.arrivalType }) } })
      return job
    })
    const windowLabel = estimate.job.arrivalType === 'ANYTIME' ? '24-hour' : '45-minute'
    await notifyUser({ userId: estimate.hauler.userId, type: 'JOB_ASSIGNED', title: 'Your estimate was accepted!', body: `You're assigned to ${estimate.job.jobNumber}. You have a ${windowLabel} pickup window ending at ${pickupDeadlineAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}.`, jobId: id, url: `/hauler/jobs/${id}` })
    return NextResponse.json(updated)
  } catch (err) {
    await stripe.paymentIntents.cancel(intent.id).catch((cancelErr) => console.error('Failed to cancel orphan authorization', cancelErr))
    await db.job.updateMany({ where: { id, status: 'ASSIGNING' }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, acceptedAt: null, pickupDeadlineAt: null } })
    if (err instanceof Error && err.message === 'ESTIMATE_NO_LONGER_PENDING') return NextResponse.json({ error: 'Estimate is no longer available' }, { status: 409 })
    if (err instanceof Error && err.message === 'JOB_STATE_CHANGED') return NextResponse.json({ error: 'Job was already accepted or changed' }, { status: 409 })
    console.error('Estimate acceptance transaction failed', err); return NextResponse.json({ error: 'Unable to accept estimate' }, { status: 500 })
  }
}
