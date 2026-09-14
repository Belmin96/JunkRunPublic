/**
 * POST /api/customer/payment/confirm
 * Body: { paymentMethodId }
 * Called right after Stripe.js confirms the SetupIntent client-side. Sets
 * the card as the customer's default payment method and flips
 * User.paymentVerified — this is the gate that unlocks job posting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.stripeCustomerId) return NextResponse.json({ error: 'No Stripe customer on file' }, { status: 400 })

  const { paymentMethodId } = await req.json()
  if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId required' }, { status: 400 })

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  if (pm.customer !== user.stripeCustomerId) {
    return NextResponse.json({ error: 'Payment method does not belong to this account' }, { status: 403 })
  }

  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      paymentMethodId,
      cardBrand: pm.card?.brand ?? null,
      cardLast4: pm.card?.last4 ?? null,
      paymentVerified: true,
      paymentVerifiedAt: new Date(),
    },
  })

  await notifyUser({
    userId: user.id,
    type: 'VERIFICATION',
    title: 'Payment method verified ✓',
    body: 'You can now post jobs on JunkRun.',
    url: '/customer/book',
  })

  return NextResponse.json({
    paymentVerified: updated.paymentVerified,
    cardBrand: updated.cardBrand,
    cardLast4: updated.cardLast4,
  })
}
