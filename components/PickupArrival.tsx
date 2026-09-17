'use client'

import { useState } from 'react'

export default function PickupArrival({ jobId, scheduledAt, pickupLatitude, pickupLongitude, arrivalVerifiedAt }: { jobId: string; scheduledAt: string; pickupLatitude: number | null; pickupLongitude: number | null; arrivalVerifiedAt: string | null }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(arrivalVerifiedAt ? 'Arrival verified by GPS.' : null)

  const verifyArrival = () => {
    if (!navigator.geolocation) { setMessage('Location services are not available on this device.'); return }
    setBusy(true); setMessage(null)
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/arrive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Arrival verification failed')
        setMessage(`✓ Arrival verified (${data.distanceMeters}m from pickup).`)
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Arrival verification failed.') } finally { setBusy(false) }
    }, (error) => { setMessage(error.code === 1 ? 'Location permission is required to verify arrival.' : 'Unable to get a reliable GPS location. Try again when you have a stronger signal.'); setBusy(false) }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 })
  }

  const navigationUrl = pickupLatitude != null && pickupLongitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${pickupLatitude},${pickupLongitude}` : null
  const pickup = new Date(scheduledAt)
  const reminderStart = new Date(pickup.getTime() - 45 * 60000)
  const now = new Date()
  const canArrive = now >= reminderStart

  return <div className="rounded-xl border border-border bg-white p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Pickup</p><p className="text-sm text-slate-500">{pickup.toLocaleString()}</p></div>{navigationUrl && <a href={navigationUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Navigate</a>}</div>
    <button type="button" onClick={verifyArrival} disabled={busy || !canArrive || !!arrivalVerifiedAt} className="w-full rounded-lg bg-brand px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{arrivalVerifiedAt ? '✓ Arrived — GPS Verified' : busy ? 'Checking GPS…' : canArrive ? "I've Arrived" : 'Arrival opens 45 minutes before pickup'}</button>
    {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
  </div>
}
