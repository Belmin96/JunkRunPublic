'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnDanger, btnSecondary } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function DisputeForm({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, reason }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Could not file dispute')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={cn(btnSecondary, 'w-full')}>
        Something's wrong — file a dispute
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
      <textarea
        rows={3}
        autoFocus
        placeholder="What went wrong?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className={cn(btnSecondary, 'flex-1')}>
          Cancel
        </button>
        <button disabled={loading || !reason} onClick={submit} className={cn(btnDanger, 'flex-1')}>
          {loading ? 'Filing…' : 'File dispute'}
        </button>
      </div>
    </div>
  )
}
