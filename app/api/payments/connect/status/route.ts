import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function GET() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can view payout status' }, { status: 403 })

  const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  if (!profile.stripeAccountId) return NextResponse.json({ connected: false, onboardingComplete: false, payoutsEnabled: false, chargesEnabled: false })

  try {
    const account = await stripe.accounts.retrieve(profile.stripeAccountId)
    const onboardingComplete = !!account.details_submitted && !!account.payouts_enabled
    await db.haulerProfile.update({
      where: { id: profile.id },
      data: { stripeOnboardingDone: onboardingComplete },
    })
    return NextResponse.json({
      connected: true,
      onboardingComplete,
      payoutsEnabled: !!account.payouts_enabled,
      chargesEnabled: !!account.charges_enabled,
      detailsSubmitted: !!account.details_submitted,
      requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
      requirementsPastDue: account.requirements?.past_due ?? [],
    })
  } catch (error) {
    console.error('Stripe Connect status check failed', error)
    return NextResponse.json({ error: 'Unable to check Stripe payout status right now.' }, { status: 502 })
  }
}
