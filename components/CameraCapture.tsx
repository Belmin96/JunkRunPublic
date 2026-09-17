'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  value: string | null
  onCapture: (dataUrl: string, location?: { latitude: number; longitude: number; accuracy: number | null }) => void
  disabled?: boolean
  referenceImageUrl?: string | null
}

/**
 * Live-camera-only capture for contractor evidence.
 * There is intentionally no <input type="file"> here, so the contractor
 * cannot choose an existing gallery image through this control.
 */
export default function CameraCapture({ label, value, onCapture, disabled, referenceImageUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => stopCamera()
  }, [])

  async function openCamera() {
    setError(null)
    setBusy(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported on this device/browser.')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      setOpen(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera permission is required to take the after photo.')
    } finally {
      setBusy(false)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setOpen(false)
  }

  async function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera is not ready yet. Try again.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      const maxDim = 1600
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Camera capture is not supported.')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)

      let location: { latitude: number; longitude: number; accuracy: number | null } | undefined
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 })
          )
          location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null }
        } catch {
          // GPS is supporting evidence only; photo capture does not fail when location is unavailable.
        }
      }

      onCapture(dataUrl, location)
      stopCamera()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture that photo. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (open) {
    return (
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="h-72 w-full object-cover" aria-label="JunkRun live camera" />
          {referenceImageUrl && <img src={referenceImageUrl} alt="Customer before photo reference" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />}
          {referenceImageUrl && <div className="pointer-events-none absolute inset-x-2 top-2 rounded-lg bg-black/70 px-3 py-2 text-center text-xs font-semibold text-white">Line up this view with the customer's before photo</div>}
          <div className="pointer-events-none absolute inset-0 border-2 border-white/40" />
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={stopCamera} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button>
          <button type="button" disabled={busy} onClick={capture} className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white">{busy ? 'Capturing…' : 'Take photo'}</button>
        </div>
        <p className="text-center text-[11px] text-slate-500">Camera capture only. Gallery photos are not available here.</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-48 w-full rounded-xl border border-border object-cover" />
          <button type="button" disabled={disabled} onClick={openCamera} className="absolute bottom-2 right-2 rounded-lg bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-ink">Retake</button>
        </div>
      ) : (
        <button type="button" disabled={disabled || busy} onClick={openCamera} className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-2 text-slate-400 transition hover:border-brand hover:text-brand-dark disabled:opacity-50">
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">{busy ? 'Opening camera…' : label}</span>
          <span className="text-[11px] text-slate-400">Live camera only — no photo library</span>
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
