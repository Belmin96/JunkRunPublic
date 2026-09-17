'use client'

import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { distanceMeters } from '@/lib/pickup'

const pickupIcon = L.divIcon({
  className: '',
  html: '<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#63C21B;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);transform:rotate(-45deg)"><div style="width:10px;height:10px;border-radius:50%;background:#10140C;margin:8px"></div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

const contractorIcon = L.divIcon({
  className: '',
  html: '<div style="width:34px;height:34px;border-radius:50%;background:#10140C;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#63C21B;font-weight:900;font-size:16px">JR</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

type Props = {
  pickupLatitude: number
  pickupLongitude: number
  pickupAddress: string
  scheduledAt: string
  arrivalVerifiedAt: string | null
}

function Recenter({ point }: { point: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(point, Math.max(map.getZoom(), 15), { animate: true })
  }, [map, point])
  return null
}

function fitBounds(points: [number, number][]) {
  if (points.length < 2) return null
  return L.latLngBounds(points)
}

function FitRoute({ pickup, contractor }: { pickup: [number, number]; contractor: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    const bounds = fitBounds(contractor ? [pickup, contractor] : [pickup])
    if (bounds) map.fitBounds(bounds.pad(0.25), { maxZoom: 16, animate: true })
  }, [map, pickup, contractor])
  return null
}

export default function PickupMap({ pickupLatitude, pickupLongitude, pickupAddress, scheduledAt, arrivalVerifiedAt }: Props) {
  const [contractorPosition, setContractorPosition] = useState<[number, number] | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [tracking, setTracking] = useState(false)

  const pickup: [number, number] = [pickupLatitude, pickupLongitude]
  const distance = contractorPosition ? Math.round(distanceMeters(contractorPosition[0], contractorPosition[1], pickupLatitude, pickupLongitude)) : null

  const eta = useMemo(() => {
    if (distance == null) return null
    if (distance < 100) return 'Arriving now'
    const minutes = Math.max(1, Math.ceil(distance / 650))
    return `~${minutes} min drive*`
  }, [distance])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS is not available on this device.')
      return
    }
    setTracking(true)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setContractorPosition([position.coords.latitude, position.coords.longitude])
        setAccuracy(Math.round(position.coords.accuracy))
        setLocationError(null)
      },
      (error) => {
        setTracking(false)
        setLocationError(error.code === 1 ? 'Allow location access to show your position on the map.' : 'Unable to update your GPS position.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold">Pickup map</p>
          <p className="text-xs text-slate-500">{arrivalVerifiedAt ? 'Arrival verified' : tracking ? 'Live GPS enabled' : 'GPS unavailable'}</p>
        </div>
        <div className="text-right">
          {distance != null && <p className="font-bold">{distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}</p>}
          {eta && <p className="text-xs text-slate-500">{eta}</p>}
        </div>
      </div>
      <MapContainer center={pickup} zoom={15} scrollWheelZoom={false} className="h-64 w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={pickup} icon={pickupIcon}>
          <Popup><strong>Pickup</strong><br />{pickupAddress}</Popup>
        </Marker>
        {contractorPosition && <>
          <Marker position={contractorPosition} icon={contractorIcon}><Popup>Contractor location</Popup></Marker>
          {accuracy != null && <Circle center={contractorPosition} radius={Math.min(accuracy, 250)} pathOptions={{ fillOpacity: 0.08 }} />}
          <FitRoute pickup={pickup} contractor={contractorPosition} />
        </>}
        {!contractorPosition && <Recenter point={pickup} />}
      </MapContainer>
      <div className="space-y-1 px-4 py-3 text-xs text-slate-500">
        <p>{contractorPosition ? `Your GPS position is ${distance ?? 0} m from the pickup.` : 'Waiting for your GPS position…'}</p>
        <p>*ETA is a rough distance-based estimate, not live traffic routing. Use Navigate for turn-by-turn directions.</p>
      </div>
    </section>
  )
}
