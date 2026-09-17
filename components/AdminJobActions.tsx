'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface JobProps { id: string; status: string; disputeReason: string | null }
const OUTCOMES = [
  { value: 'CUSTOMER_REFUND', label: 'Refund customer' },
  { value: 'PARTIAL_REFUND', label: 'Partial refund' },
  { value: 'NO_REFUND', label: 'No refund' },
  { value: 'CONTRACTOR_REMEDY', label: 'Contractor remedy / continue work' },
] as const

export default function AdminJobActions({ job }: { job: JobProps }) {
  const router = useRouter()
  const [outcome, setOutcome] = useState('CUSTOMER_REFUND')
  const [refundAmount, setRefundAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function resolveDispute() {
    if (!notes.trim()) { setError('Resolution notes are required.'); return }
    if (outcome === 'PARTIAL_REFUND' && (!refundAmount || Number(refundAmount) <= 0)) { setError('Enter a positive partial refund amount.'); return }
    if (!window.confirm('Resolve this dispute with the selected outcome?')) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const body: Record<string, unknown> = { outcome, notes: notes.trim() }
      if (outcome === 'PARTIAL_REFUND') body.refundAmountCents = Math.round(Number(refundAmount) * 100)
      const res = await fetch(`/api/admin/jobs/${job.id}/dispute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to resolve dispute')
      setSuccess('Dispute decision recorded. Complete the separate payment/refund action before treating the job as financially finalized.')
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Unable to resolve dispute') }
    finally { setLoading(false) }
  }

  if (job.status !== 'DISPUTED') return null
  return (
    <section className="space-y-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
      <div><h3 className="font-bold text-slate-100">Dispute Review</h3><p className="mt-1 text-xs text-slate-400">Review the evidence, customer complaint, contractor response, photos, messages, and audit history before resolving.</p></div>
      {job.disputeReason && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"><span className="font-semibold">Customer dispute:</span> {job.disputeReason}</div>}
      {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {success && <p className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">{success}</p>}
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Outcome</span><select value={outcome} onChange={(e) => { setOutcome(e.target.value); setRefundAmount('') }} disabled={loading} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand">{OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {outcome === 'PARTIAL_REFUND' && <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Partial refund amount (USD)</span><input inputMode="decimal" type="number" min="0.01" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} disabled={loading} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand" placeholder="0.00" /></label>}
      <p className="text-xs text-slate-500">This records the dispute decision only. Payment/refund execution remains a separate operation.</p>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Resolution notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} disabled={loading} rows={5} placeholder="Document the evidence reviewed and why this outcome was selected…" className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-brand" /><span className="mt-1 block text-right text-xs text-slate-600">{notes.length}/2000</span></label>
      <button type="button" disabled={loading || !notes.trim()} onClick={resolveDispute} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Resolving…' : 'Record Dispute Resolution'}</button>
    </section>
  )
}
