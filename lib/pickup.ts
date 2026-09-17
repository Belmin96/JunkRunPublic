import { ARRIVAL_GEOFENCE_METERS, PICKUP_GRACE_MINUTES, PICKUP_REMINDER_MINUTES } from './constants'

export function minutesUntilPickup(scheduledAt: Date, now = new Date()) {
  return Math.floor((scheduledAt.getTime() - now.getTime()) / 60000)
}

export function pickupReminderWindow(now = new Date()) {
  const start = new Date(now.getTime() - PICKUP_REMINDER_MINUTES * 60000)
  return { start, end: now }
}

export function pickupDeadline(scheduledAt: Date) {
  return new Date(scheduledAt.getTime() + PICKUP_GRACE_MINUTES * 60000)
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinArrivalGeofence(distance: number) {
  return distance <= ARRIVAL_GEOFENCE_METERS
}

export function mapsNavigationUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}
