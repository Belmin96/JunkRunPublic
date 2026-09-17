import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function GET() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can view payout onboarding status' }, { status: 403 })

  const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
  if (!profile.stripeAccountId) {
    return NextResponse.json({ connected: false, onboardingComplete: false })
  }

  try {
    const account = await stripe.accounts.retrieve(profile.stripeAccountId)
    const requirements = account.requirements
    const onboardingComplete = Boolean(
      account.details_submitted &&
      account.payouts_enabled &&
      (requirements?.currently_due?.length ?? 0) === 0,
    )

    if (profile.stripeOnboardingDone !== onboardingComplete) {
      await db.haulerProfile.update({
        where: { id: profile.id },
        data: { stripeOnboardingDone: onboardingComplete },
      })
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete,
      payoutsEnabled: Boolean(account.payouts_enabled),
      currentlyDueCount: requirements?.currently_due?.length ?? 0,
      disabledReason: requirements?.disabled_reason ?? null,
    })
  } catch (err) {
    console.error('Stripe Connect status check failed', err)
    return NextResponse.json({ error: 'Unable to verify Stripe onboarding status' }, { status: 502 })
  }
}
