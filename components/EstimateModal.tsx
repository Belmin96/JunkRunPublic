'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCents } from '@/lib/utils'
import { btnPrimary, btnSecondary, input, label as labelCls } from '@/lib/ui'
import { cn } from '@/lib/utils'

interface Props {
  jobId: string
  jobNumber: string
  existingAmountCents?: number
}

/** The estimation system — a contractor names their price for a HaulBoard job. */
export default function EstimateModal({ jobId, jobNumber, existingAmountCents }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(existingAmountCents ? String(existingAmountCents / 100) : '')
  const [message, setMessage] = useState('')
  const [arrival, setArrival] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: Math.round(parseFloat(amount) * 100),
          message: message || undefined,
          arrival: arrival || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(typeof data.error === 'string' ? data.error : 'Estimate failed')
      }
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        router.refresh()
      }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn(btnPrimary, existingAmountCents ? btnSecondary : '')}>
        {existingAmountCents ? `Edit estimate (${formatCents(existingAmountCents)})` : 'Give estimate'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">Your estimate</h3>
                <p className="text-sm text-slate-500">{jobNumber}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-xl text-slate-400 hover:text-ink" aria-label="Close">×</button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <p className="text-2xl">🎉</p>
                <p className="mt-2 font-semibold text-brand-dark">Estimate sent!</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <label className="block">
                  <span className={labelCls}>Your price ($)</span>
                  <input required type="number" min="25" step="5" className={input} placeholder="150.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  {amount && !isNaN(parseFloat(amount)) && (
                    <p className="mt-1 text-xs text-slate-500">
                      You&apos;ll earn {formatCents(Math.round(parseFloat(amount) * 100 * 0.9))} after JunkRun&apos;s 10% fee.
                    </p>
                  )}
                </label>
                <label className="block">
                  <span className={labelCls}>Arrival estimate (optional)</span>
                  <input className={input} placeholder="Today 2–4pm" value={arrival} onChange={(e) => setArrival(e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Note to customer (optional)</span>
                  <textarea rows={2} className={input} placeholder="I have a 1-ton truck and can handle large loads…" value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>

                {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setOpen(false)} className={cn(btnSecondary, 'flex-1')}>Cancel</button>
                  <button type="submit" disabled={loading} className={cn(btnPrimary, 'flex-1')}>{loading ? 'Sending…' : 'Send estimate'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
