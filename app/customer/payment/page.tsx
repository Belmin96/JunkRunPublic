'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { btnPrimary, card } from '@/lib/ui'
import { cn } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function SetupForm({ clientSecret, next }: { clientSecret: string; next: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError(null)
    setProcessing(true)

    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Could not verify card')
      setProcessing(false)
      return
    }

    const pmId = typeof setupIntent?.payment_method === 'string' ? setupIntent.payment_method : setupIntent?.payment_method?.id
    const res = await fetch('/api/customer/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId: pmId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Could not save card')
      setProcessing(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <PaymentElement />
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!stripe || processing} className={cn(btnPrimary, 'w-full')}>
        {processing ? 'Verifying…' : 'Verify payment method'}
      </button>
      <p className="text-center text-xs text-slate-400">Your card isn&apos;t charged now — this just verifies it's valid.</p>
    </form>
  )
}

export default function CustomerPaymentPage() {
  const params = useSearchParams()
  const next = params.get('next') || '/customer/dashboard'
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [status, setStatus] = useState<{ paymentVerified: boolean; cardBrand: string | null; cardLast4: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/customer/payment/status')
      .then((r) => r.json())
      .then((d) => {
        setStatus(d)
        if (!d.paymentVerified) {
          fetch('/api/customer/payment/setup-intent', { method: 'POST' })
            .then((r) => r.json())
            .then((sd) => setClientSecret(sd.clientSecret))
        }
      })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment verification</h2>
        <p className="mt-1 text-sm text-slate-500">A verified card is required before you can post a job.</p>
      </div>

      <div className="flex gap-2">
        <span className="flex-1 rounded-xl border border-brand bg-brand-light px-4 py-2 text-center text-sm font-semibold text-brand-dark">Verification</span>
        <span className="flex-1 rounded-xl border border-border px-4 py-2 text-center text-sm font-semibold text-slate-400">Unverified until confirmed</span>
      </div>

      {status?.paymentVerified ? (
        <div className={card}>
          <p className="font-semibold text-brand-dark">✓ Payment verified</p>
          <p className="mt-1 text-sm text-slate-500">{status.cardBrand?.toUpperCase()} •••• {status.cardLast4}</p>
        </div>
      ) : clientSecret ? (
        <div className={card}>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#63C21B', borderRadius: '10px' } } }}
          >
            <SetupForm clientSecret={clientSecret} next={next} />
          </Elements>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-400">Loading…</p>
      )}
    </div>
  )
}
