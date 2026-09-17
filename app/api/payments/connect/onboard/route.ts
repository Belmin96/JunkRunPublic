import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (!value) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  return value.replace(/\/$/, '')
}

export async function POST() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can connect payouts' }, { status: 403 })

  const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  try {
    let accountId = profile.stripeAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: profile.companyName === 'New Contractor' ? (user.name ?? 'JunkRun Contractor') : profile.companyName,
        },
        metadata: {
          userId: user.id,
          haulerProfileId: profile.id,
          contractorType: user.contractorType ?? 'INDEPENDENT_CONTRACTOR',
        },
      }, { idempotencyKey: 'connect-account:' + user.id })

      const saved = await db.haulerProfile.updateMany({
        where: { id: profile.id, stripeAccountId: null },
        data: { stripeAccountId: account.id, stripeOnboardingDone: false },
      })

      if (saved.count === 0) {
        const current = await db.haulerProfile.findUnique({ where: { id: profile.id }, select: { stripeAccountId: true } })
        accountId = current?.stripeAccountId ?? account.id
      } else {
        accountId = account.id
      }
    }

    const account = await stripe.accounts.retrieve(accountId)
    const onboardingComplete = !!account.details_submitted && !!account.payouts_enabled

    if (onboardingComplete) {
      await db.haulerProfile.update({
        where: { id: profile.id },
        data: { stripeOnboardingDone: true },
      })
      return NextResponse.json({ connected: true, onboardingComplete: true, accountId })
    }

    const base = appUrl()
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: base + '/hauler/profile?stripe=refresh',
      return_url: base + '/hauler/profile?stripe=return',
      collect: 'eventually_due',
    })

    return NextResponse.json({ connected: true, onboardingComplete: false, accountId, url: link.url })
  } catch (error) {
    console.error('Stripe Connect onboarding failed', error)
    return NextResponse.json({ error: 'Unable to start Stripe onboarding right now.' }, { status: 502 })
  }
}
