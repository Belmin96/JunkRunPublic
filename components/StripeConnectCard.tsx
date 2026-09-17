'use client'

import { useEffect, useState } from 'react'

export default function StripeConnectCard({ initialConnected }: { initialConnected: boolean }) {
  const [connected, setConnected] = useState(initialConnected)
  const [complete, setComplete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    const res = await fetch('/api/payments/connect/status', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setConnected(!!data.connected)
      setComplete(!!data.onboardingComplete)
      if (data.requirementsPastDue?.length) setMessage('Stripe needs additional information before payouts can be enabled.')
      else if (data.requirementsCurrentlyDue?.length) setMessage('Stripe needs a few more details to finish payout setup.')
      else if (data.onboardingComplete) setMessage('Payouts are ready.')
    }
  }

  useEffect(() => { refresh().catch(() => setMessage('Unable to check payout status.')) }, [])

  async function start() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/payments/connect/onboard', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to start Stripe onboarding')
      setConnected(!!data.connected)
      setComplete(!!data.onboardingComplete)
      if (data.url) window.location.assign(data.url)
      else setMessage(data.onboardingComplete ? 'Payouts are ready.' : 'Stripe onboarding needs to be completed.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to start Stripe onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-ink">Stripe payouts</h3>
          <p className="mt-1 text-sm text-slate-500">
            {complete
              ? 'Your Stripe Connect account is ready to receive contractor payouts.'
              : connected
                ? 'Finish Stripe verification to enable payouts.'
                : 'Connect Stripe to receive payments for completed JunkRun jobs.'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${complete ? 'bg-brand-light text-brand-dark' : 'bg-amber-100 text-amber-800'}`}>
          {complete ? 'READY' : 'ACTION NEEDED'}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Individuals can use their personal legal information. An LLC is not required just to complete this Stripe Connect onboarding flow.
      </p>
      {message && <p className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-slate-600">{message}</p>}
      {!complete && (
        <button type="button" onClick={start} disabled={loading} className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {loading ? 'Opening Stripe…' : connected ? 'Continue Stripe setup' : 'Connect Stripe payouts'}
        </button>
      )}
    </div>
  )
}
