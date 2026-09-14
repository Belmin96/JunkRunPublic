'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCents } from '@/lib/utils'
import { btnPrimary, btnSecondary, card } from '@/lib/ui'
import { cn } from '@/lib/utils'

interface EstimateItem {
  id: string
  amountCents: number
  arrival: string | null
  message: string | null
  status: string
  hauler: { companyName: string; rating: number; jobCount: number; verified: boolean }
}

/** Customer-facing list of contractor estimates on a job, with Accept / Decline actions. */
export default function EstimateList({ jobId, estimates }: { jobId: string; estimates: EstimateItem[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function accept(estimateId: string) {
    setBusy(estimateId)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not accept that estimate')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  async function decline(estimateId: string) {
    setBusy(estimateId)
    setError(null)
    try {
      const res = await fetch(`/api/estimates/${estimateId}/decline`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Could not decline that estimate')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  const pending = estimates.filter((e) => e.status === 'PENDING')

  if (estimates.length === 0) {
    return (
      <div className={card}>
        <p className="text-sm text-slate-500">No estimates yet — contractors are reviewing your job.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      {pending
        .sort((a, b) => a.amountCents - b.amountCents)
        .map((e) => (
          <div key={e.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{e.hauler.companyName}</p>
                  {e.hauler.verified && <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-dark">VERIFIED</span>}
                </div>
                <p className="text-xs text-slate-500">
                  ⭐ {e.hauler.rating.toFixed(1)} · {e.hauler.jobCount} jobs completed
                </p>
                {e.arrival && <p className="mt-1 text-xs text-slate-500">Arrival: {e.arrival}</p>}
                {e.message && <p className="mt-1 text-sm text-slate-600">&ldquo;{e.message}&rdquo;</p>}
              </div>
              <p className="shrink-0 text-xl font-black text-ink">{formatCents(e.amountCents)}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button disabled={!!busy} onClick={() => accept(e.id)} className={cn(btnPrimary, 'flex-1')}>
                {busy === e.id ? 'Working…' : 'Accept'}
              </button>
              <button disabled={!!busy} onClick={() => decline(e.id)} className={cn(btnSecondary, 'flex-1')}>
                Decline
              </button>
            </div>
          </div>
        ))}
    </div>
  )
}
