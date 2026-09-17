'use client'

import { useState } from 'react'

const REASONS = [
  ['CUSTOMER_CHANGED_MIND', 'Changed my mind'],
  ['SCHEDULE_CHANGE', 'Schedule changed'],
  ['NO_LONGER_NEEDED', 'No longer needed'],
  ['CONTRACTOR_ISSUE', 'Contractor issue'],
  ['OTHER', 'Other'],
] as const

export default function CancelJobForm({ jobId }: { jobId: string }) {
  const [reason, setReason] = useState(REASONS[0][0])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function cancel() {
    if (!confirm('Cancel this job? This cannot be undone. Any refund or fee will be handled according to JunkRun policy.')) return
    setLoading(true); setMessage('')
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Unable to cancel job')
      setMessage('Job cancelled. Reloading…')
      window.location.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to cancel job')
    } finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h3 className="font-semibold text-red-800">Cancel job</h3>
      <p className="mt-1 text-sm text-red-700">Cancellation may affect refunds or fees. The app will not promise a refund until the payment review is completed.</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" disabled={loading}>
        {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button onClick={cancel} disabled={loading} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {loading ? 'Cancelling…' : 'Cancel job'}
      </button>
      {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
    </div>
  )
}
