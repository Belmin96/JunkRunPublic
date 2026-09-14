/**
 * Shared string-union "enums" for fields that are plain Strings in the SQLite
 * schema (SQLite has no native enum support). Cast Prisma string fields to
 * these types at the boundary rather than trusting `string` everywhere.
 */

export type Role = 'CUSTOMER' | 'HAULER' | 'ADMIN' | 'OWNER'

export type JobStatus =
  | 'POSTED'
  | 'BIDDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'EVIDENCE_SUBMITTED'
  | 'PENDING_PAYOUT'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'TRANSFERRED' | 'REFUNDED' | 'DISPUTED'

export type EstimateStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export type ArrivalType = 'SET_TIME' | 'ANYTIME'

export type NotificationType =
  | 'JOB_POSTED'
  | 'ESTIMATE_RECEIVED'
  | 'ESTIMATE_ACCEPTED'
  | 'ESTIMATE_DECLINED'
  | 'JOB_DECLINED'
  | 'JOB_ASSIGNED'
  | 'JOB_AUTO_RETURNED'
  | 'JOB_COMPLETED'
  | 'PAYOUT_RELEASED'
  | 'DISPUTE'
  | 'REVIEW'
  | 'VERIFICATION'

/** The six job categories a customer can pick from when posting a load. */
export const JOB_TYPES = [
  'Furniture',
  'Appliances',
  'Construction Debris',
  'Yard Waste',
  'Mattresses',
  'Electronics',
] as const
export type JobType = (typeof JOB_TYPES)[number]

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'ASSIGNED',
  'IN_PROGRESS',
  'EVIDENCE_SUBMITTED',
  'PENDING_PAYOUT',
]
export const OPEN_JOB_STATUSES: JobStatus[] = ['POSTED', 'BIDDING']
export const CLOSED_JOB_STATUSES: JobStatus[] = ['COMPLETED', 'CANCELLED']

export const JOB_STATUS_LABELS: Record<string, string> = {
  POSTED: 'Awaiting Estimates',
  BIDDING: 'Estimates In',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  EVIDENCE_SUBMITTED: 'Photo Submitted',
  PENDING_PAYOUT: 'Verifying',
  DISPUTED: 'Disputed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** The 8-step payment pipeline shown in <PaymentFlowTracker>. */
export const PAYMENT_FLOW_STEPS = [
  { key: 'POSTED', label: 'Load Posted' },
  { key: 'ASSIGNED', label: 'Estimate Accepted (Card Authorized)' },
  { key: 'ASSIGNED', label: 'Contractor Assigned' },
  { key: 'IN_PROGRESS', label: 'Job Started' },
  { key: 'EVIDENCE_SUBMITTED', label: 'After Photo Submitted' },
  { key: 'PENDING_PAYOUT', label: 'JunkRun Verifies' },
  { key: 'COMPLETED', label: 'Payment Released' },
  { key: 'COMPLETED', label: 'Contractor Paid' },
] as const

/** Auto-return window: unfinished assigned jobs bounce back to the HaulBoard after this many hours. */
export const AUTO_RETURN_HOURS = 24
