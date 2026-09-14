/**
 * POST /api/payments/release
 * Called by admin or automatically after dispute window expires.
 * 1. Captures the Stripe PaymentIntent (charges the customer card).
 * 2. Transfers haulerPayoutCents to the hauler's Stripe Connect account.
 * 3. Updates job status to COMPLETED.
 *
 * Body: { jobId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'
import { formatCents } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = ['ADMIN', 'OWNER'].includes(user.role)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { hauler: true },
  })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'].includes(job.status)) {
    return NextResponse.json({ error: 'Job is not eligible for payout release' }, { status: 409 })
  }
  if (!job.stripePaymentIntentId) {
    return NextResponse.json({ error: 'No payment intent on record' }, { status: 422 })
  }

  const haulerStripeAccount = job.hauler?.stripeAccountId
  if (!haulerStripeAccount) {
    return NextResponse.json({ error: 'Hauler has no Stripe Connect account' }, { status: 422 })
  }

  // Step 1: Capture the payment from the customer
  const captured = await stripe.paymentIntents.capture(job.stripePaymentIntentId)
  if (captured.status !== 'succeeded') {
    return NextResponse.json({ error: 'Stripe capture did not succeed', status: captured.status }, { status: 502 })
  }

  // Step 2: Transfer hauler payout (platform keeps the fee)
  const transfer = await stripe.transfers.create({
    amount: job.haulerPayoutCents,
    currency: 'usd',
    destination: haulerStripeAccount,
    transfer_group: job.jobNumber,
    metadata: {
      jobId: job.id,
      jobNumber: job.jobNumber,
    },
  })

  // Step 3: Mark job as completed
  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      paymentStatus: 'TRANSFERRED',
      stripeTransferId: transfer.id,
      completedAt: new Date(),
    },
  })

  await db.haulerProfile.update({
    where: { id: job.haulerId! },
    data: { jobCount: { increment: 1 } },
  })

  if (job.hauler) {
    await notifyUser({
      userId: job.hauler.userId,
      type: 'PAYOUT_RELEASED',
      title: 'Payment released 💸',
      body: `${formatCents(job.haulerPayoutCents)} for ${job.jobNumber} is on its way to your bank.`,
      jobId: job.id,
      url: `/hauler/jobs/${job.id}/receipt`,
    })
  }
  await notifyUser({
    userId: job.customerId,
    type: 'PAYOUT_RELEASED',
    title: 'Job complete — receipt ready',
    body: `${job.jobNumber} is fully wrapped up. Your receipt is ready to view.`,
    jobId: job.id,
    url: `/customer/jobs/${job.id}/receipt`,
  })

  return NextResponse.json({ success: true, transferId: transfer.id })
}
