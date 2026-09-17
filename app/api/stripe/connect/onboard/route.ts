import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { hasAcceptedLegal, CONTRACTOR_LEGAL } from '@/lib/legal'

function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!value) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  return value.replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'HAULER') return NextResponse.json({ error: 'Only contractors can connect a payout account' }, { status: 403 })
  if (!(await hasAcceptedLegal(user.id, CONTRACTOR_LEGAL))) {
    return NextResponse.json({ error: 'Complete the contractor legal acceptance first', code: 'LEGAL_ACCEPTANCE_REQUIRED', redirect: '/legal/accept' }, { status: 428 })
  }
  if (!user.contractorType) {
    return NextResponse.json({ error: 'Choose Independent Contractor or Business before connecting Stripe', code: 'CONTRACTOR_TYPE_REQUIRED', redirect: '/legal/accept' }, { status: 422 })
  }

  const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })

  try {
    let accountId = profile.stripeAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        business_type: user.contractorType === 'INDEPENDENT_CONTRACTOR' ? 'individual' : 'company',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          junkRunUserId: user.id,
          junkRunHaulerProfileId: profile.id,
          contractorType: user.contractorType,
        },
      })

      accountId = account.id
      await db.haulerProfile.update({
        where: { id: profile.id },
        data: { stripeAccountId: accountId, stripeOnboardingDone: false },
      })
    } else {
      const account = await stripe.accounts.retrieve(accountId)
      if (account.type !== 'express') {
        return NextResponse.json({ error: 'The existing Stripe account is not an Express connected account. Contact JunkRun support.' }, { status: 409 })
      }
    }

    const base = appUrl()
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${base}/hauler/dashboard?connect=refresh`,
      return_url: `${base}/hauler/dashboard?connect=return`,
      collect: 'eventually_due',
    })

    return NextResponse.json({ url: link.url })
  } catch (err) {
    console.error('Stripe Connect onboarding link failed', err)
    return NextResponse.json({ error: 'Unable to start Stripe onboarding. Please try again.' }, { status: 502 })
  }
}
