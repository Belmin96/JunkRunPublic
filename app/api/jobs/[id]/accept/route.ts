/**
 * POST /api/jobs/[id]/accept
 * Customer accepts one contractor's estimate. Body: { estimateId }
 *
 * This is also where the payment hold happens: the customer's verified
 * payment method is charged as an authorization (manual capture — no money
 * moves yet) for the accepted amount. All other estimates on the job are
 * marked DECLINED and their contractors notified.
 */
import { NextRequest, NextResponse } from 'next/server'
import { stripe, splitPayment } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { estimateId } = await req.json()
  if (!estimateId) return NextResponse.json({ error: 'estimateId required' }, { status: 400 })

  const job = await db.job.findFirst({ where: { id, customerId: user.id } })
  if (!job) return NextResponse.json({ error: 'Job not found or not yours' }, { status: 404 })
  if (!['POSTED', 'BIDDING'].includes(job.status)) {
    return NextResponse.json({ error: 'Job is not open for estimates anymore' }, { status: 409 })
  }

  const estimate = await db.estimate.findFirst({ where: { id: estimateId, jobId: id }, include: { hauler: true } })
  if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  if (!user.stripeCustomerId || !user.paymentMethodId) {
    return NextResponse.json({ error: 'Add a verified payment method before accepting an estimate' }, { status: 402 })
  }

  const { platformFeeCents, haulerPayoutCents } = splitPayment(estimate.amountCents)

  let paymentIntentId: string
  try {
    const intent = await stripe.paymentIntents.create({
      amount: estimate.amountCents,
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: user.paymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'manual',
      metadata: { jobId: job.id, jobNumber: job.jobNumber, estimateId: estimate.id },
      description: `JunkRun job ${job.jobNumber} — ${job.pickupAddress}`,
    })
    paymentIntentId = intent.id
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Card authorization failed'
    return NextResponse.json(
      { error: `We couldn't place a hold on your card: ${message}. Update your payment method and try again.` },
      { status: 402 }
    )
  }

  const [updatedJob] = await db.$transaction([
    db.job.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        haulerId: estimate.haulerId,
        priceCents: estimate.amountCents,
        platformFeeCents,
        haulerPayoutCents,
        stripePaymentIntentId: paymentIntentId,
        paymentStatus: 'AUTHORIZED',
        authorizedAt: new Date(),
        acceptedAt: new Date(),
      },
    }),
    db.estimate.update({ where: { id: estimate.id }, data: { status: 'ACCEPTED' } }),
    db.estimate.updateMany({
      where: { jobId: id, id: { not: estimate.id } },
      data: { status: 'DECLINED' },
    }),
  ])

  await notifyUser({
    userId: estimate.hauler.userId,
    type: 'JOB_ASSIGNED',
    title: 'Your estimate was accepted!',
    body: `You're assigned to ${job.jobNumber}. Check the job for pickup details.`,
    jobId: job.id,
    url: `/hauler/jobs/${job.id}`,
  })

  const otherEstimates = await db.estimate.findMany({
    where: { jobId: id, id: { not: estimate.id } },
    include: { hauler: true },
  })
  await Promise.all(
    otherEstimates.map((e) =>
      notifyUser({
        userId: e.hauler.userId,
        type: 'ESTIMATE_DECLINED',
        title: 'Job went to another contractor',
        body: `The customer picked a different estimate for ${job.jobNumber}.`,
        jobId: job.id,
        url: `/hauler/loads`,
      })
    )
  )

  return NextResponse.json(updatedJob)
}
