'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CameraCapture from './CameraCapture'
import { btnPrimary, card } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function HaulerJobActions({ jobId, status, beforePhotoUrl, completionNonce }: { jobId: string; status: string; beforePhotoUrl?: string | null; completionNonce?: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null)
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  const [captureLocation, setCaptureLocation] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null)

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
    if (!afterPhotoUrl || !completionNonce || !capturedAt) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afterPhotoUrl, completionNonce, capturedAt, captureLatitude: captureLocation?.latitude, captureLongitude: captureLocation?.longitude, captureAccuracyMeters: captureLocation?.accuracy }),
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
        <button disabled={loading} onClick={start} className={cn(btnPrimary, 'w-full')}>{loading ? 'Starting…' : 'Start job'}</button>
      </div>
    )
  }

  if (status === 'IN_PROGRESS') {
    return (
      <div className={cn(card, 'space-y-3')}>
        <h3 className="font-semibold text-ink">Finish the job</h3>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-bold">📸 MATCH THE BEFORE PHOTO</p>
          <p className="mt-1">Before taking the after photo, line up your camera as close as reasonably possible to the same position and angle as the customer’s before photo.</p>
          <p className="mt-1 text-xs">The before photo will appear over the live camera view as a reference. GPS does not have to match.</p>
        </div>
        <CameraCapture label="Take after photo" value={afterPhotoUrl} onCapture={(url, location) => { setAfterPhotoUrl(url); setCapturedAt(new Date().toISOString()); setCaptureLocation(location ?? null) }} referenceImageUrl={beforePhotoUrl} />
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={loading || !afterPhotoUrl || !completionNonce || !capturedAt} onClick={complete} className={cn(btnPrimary, 'w-full')}>{loading ? 'Submitting…' : 'Mark complete'}</button>
      </div>
    )
  }

  return null
}
