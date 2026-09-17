'use client'

import { useEffect, useState } from 'react'

type Status = {
  connected: boolean
  onboardingComplete: boolean
  payoutsEnabled?: boolean
  currentlyDueCount?: number
  disabledReason?: string | null
}

export default function ConnectOnboardingCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/status', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unable to check payout setup')
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check payout setup')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function startOnboarding() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.redirect) window.location.href = data.redirect
        throw new Error(data.error ?? 'Unable to start Stripe onboarding')
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start Stripe onboarding')
      setStarting(false)
    }
  }

  if (loading) return <section className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-slate-500">Checking payout setup…</p></section>

  if (status?.onboardingComplete) {
    return <section className="rounded-2xl border border-brand/30 bg-brand-light p-5"><p className="font-bold text-ink">✓ Stripe payouts connected</p><p className="mt-1 text-sm text-slate-600">Your connected account is ready to receive JunkRun payouts.</p></section>
  }

  return (
    <section className="rounded-2xl border border-amber-300/50 bg-amber-50 p-5">
      <h2 className="font-bold text-ink">Set up your contractor payouts</h2>
      <p className="mt-1 text-sm text-slate-600">Connect Stripe before accepting a JunkRun estimate. Independent contractors can complete Stripe onboarding as individuals; an LLC is not required.</p>
      {status?.connected && status.currentlyDueCount ? <p className="mt-2 text-xs text-amber-800">Stripe still needs {status.currentlyDueCount} item(s) from you.</p> : null}
      {status?.disabledReason ? <p className="mt-2 text-xs text-red-700">Stripe has paused payouts until its requirements are resolved.</p> : null}
      {error && <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={startOnboarding} disabled={starting} className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{starting ? 'Opening Stripe…' : status?.connected ? 'Continue Stripe onboarding' : 'Connect Stripe & get paid'}</button>
    </section>
  )
}
