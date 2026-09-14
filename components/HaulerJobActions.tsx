'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CameraCapture from './CameraCapture'
import { btnPrimary, card } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function HaulerJobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not start job')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function complete() {
    if (!afterPhotoUrl) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afterPhotoUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not complete job')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'ASSIGNED') {
    return (
      <div className="space-y-2">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={loading} onClick={start} className={cn(btnPrimary, 'w-full')}>
          {loading ? 'Starting…' : 'Start job'}
        </button>
      </div>
    )
  }

  if (status === 'IN_PROGRESS') {
    return (
      <div className={cn(card, 'space-y-3')}>
        <h3 className="font-semibold text-ink">Finish the job</h3>
        <p className="text-sm text-slate-500">Snap an after photo, then mark the job complete to trigger payout.</p>
        <CameraCapture label="Take after photo" value={afterPhotoUrl} onCapture={setAfterPhotoUrl} />
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={loading || !afterPhotoUrl} onClick={complete} className={cn(btnPrimary, 'w-full')}>
          {loading ? 'Submitting…' : 'Mark complete'}
        </button>
      </div>
    )
  }

  return null
}
