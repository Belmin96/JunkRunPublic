import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { JOB_STATUS_LABELS } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format cents as a dollar string: 47500 → "$475.00" */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Format a yyyy-mm-dd date string for display, e.g. "Oct 1, 2026". */
export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Format a hh:mm 24h time string as "9:00 AM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Human display for a job's requested arrival window. */
export function formatArrival(job: { arrivalType: string; date: string; time: string | null }): string {
  const day = formatDate(job.date)
  if (job.arrivalType === 'ANYTIME') return `${day} · Anytime`
  return job.time ? `${day} at ${formatTime(job.time)}` : day
}

export { JOB_STATUS_LABELS }

export const STATUS_BADGE: Record<string, string> = {
  POSTED: 'bg-sky-100 text-sky-700',
  BIDDING: 'bg-violet-100 text-violet-700',
  ASSIGNED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-brand-light text-brand-dark',
  EVIDENCE_SUBMITTED: 'bg-teal-100 text-teal-700',
  PENDING_PAYOUT: 'bg-indigo-100 text-indigo-700',
  DISPUTED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
}

/** Parse the JSON array stored in Job.jobTypes back into a string[]. */
export function parseJobTypes(json: string): string[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** Compute the ISO week (Mon–Sun) start/end containing `d`. */
export function isoWeekRange(d: Date): { start: Date; end: Date } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7 // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() - day + 1) // back to Monday
  date.setUTCHours(0, 0, 0, 0)
  const start = new Date(date)
  const end = new Date(date)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}
