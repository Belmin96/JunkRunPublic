import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyHaulersOfNewJob } from '@/lib/notify'
import { JOB_TYPES } from '@/lib/constants'
import { z } from 'zod'

const QUESTIONNAIRE_OPTIONS = {
  propertyTypes: ['House', 'Apartment', 'Condo', 'Townhouse', 'Commercial', 'Other'],
  jobTypes: ['Simple Junk Removal', 'Garage Clean-Out', 'Room Clean-Out', 'Whole-House Clean-Out', 'Apartment Clean-Out', 'Estate Clean-Out', 'Construction Debris', 'Yard Debris', 'Other'],
  items: ['Furniture', 'Appliances', 'Mattresses', 'Electronics', 'Yard Waste', 'Construction Materials', 'Boxes / General Household Junk', 'Other'],
  largeHeavyItems: ['Refrigerator', 'Freezer', 'Piano', 'Safe', 'Pool Table', 'Hot Tub', 'Large Furniture', 'Other'],
  junkLocations: ['Inside house/apartment', 'Garage', 'Basement', 'Attic', 'Yard', 'Curbside', 'Other'],
  floors: ['Ground', '2nd', '3rd', '4th', '5th+'],
  stairs: ['1', '2', '3', '4+'],
} as const

const QuestionnaireSchema = z.object({
  propertyType: z.enum(QUESTIONNAIRE_OPTIONS.propertyTypes),
  jobType: z.enum(QUESTIONNAIRE_OPTIONS.jobTypes),
  items: z.array(z.enum(QUESTIONNAIRE_OPTIONS.items)).min(1).max(8),
  hasLargeHeavyItems: z.boolean(),
  largeHeavyItems: z.array(z.enum(QUESTIONNAIRE_OPTIONS.largeHeavyItems)).max(8).default([]),
  hasStairs: z.boolean(),
  stairs: z.enum(QUESTIONNAIRE_OPTIONS.stairs).nullable().default(null),
  elevator: z.boolean(),
  junkLocation: z.enum(QUESTIONNAIRE_OPTIONS.junkLocations),
  floor: z.enum(QUESTIONNAIRE_OPTIONS.floors),
  hasHazardousMaterials: z.boolean(),
  hazardousAcknowledged: z.boolean().default(false),
}).superRefine((q, ctx) => {
  if (q.hasLargeHeavyItems && q.largeHeavyItems.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['largeHeavyItems'], message: 'Select at least one large/heavy item.' })
  if (!q.hasLargeHeavyItems && q.largeHeavyItems.length > 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['largeHeavyItems'], message: 'Large/heavy items must be empty when none are reported.' })
  if (q.hasStairs && !q.stairs) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stairs'], message: 'Select the number of flights.' })
  if (!q.hasStairs && q.stairs) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stairs'], message: 'Stairs must be empty when none are reported.' })
  if (q.hasHazardousMaterials && !q.hazardousAcknowledged) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hazardousAcknowledged'], message: 'Hazardous/prohibited materials must be acknowledged before posting.' })
})

const CreateJobSchema = z.object({ jobTypes: z.array(z.enum(JOB_TYPES)).min(1).max(20), questionnaire: QuestionnaireSchema, whatToExpect: z.string().trim().max(2000).optional(), numStories: z.number().int().min(1).max(10), pickupAddress: z.string().trim().min(5).max(300), city: z.string().trim().min(2).max(100), zipCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/), arrivalType: z.enum(['SET_TIME', 'ANYTIME']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/).optional(), timezone: z.string().trim().min(1).max(100).optional(), scheduledAtIso: z.string().datetime({ offset: true }).optional(), pickupLatitude: z.number().min(-90).max(90).optional(), pickupLongitude: z.number().min(-180).max(180).optional(), beforePhotoUrl: z.string().url().max(2048) })

// Public-facing job numbers must not be predictable. Use 80 bits of randomness
// and rely on the database's unique constraint as the final collision guard.
function newJobNumber() {
  return `JR-${randomBytes(10).toString('hex').toUpperCase()}`
}

const CUSTOMER_JOB_SELECT = {
  id: true, jobNumber: true, status: true, jobTypes: true, questionnaire: true, whatToExpect: true, numStories: true,
  pickupAddress: true, city: true, zipCode: true, arrivalType: true, date: true, time: true, timezone: true, scheduledAt: true,
  beforePhotoUrl: true, afterPhotoUrl: true, priceCents: true, platformFeeCents: true, haulerPayoutCents: true, paymentStatus: true,
  disputeWindowEnd: true, disputeReason: true, disputedAt: true, disputeResolvedAt: true, disputeOutcome: true, autoReturnedCount: true,
  acceptedAt: true, inProgressAt: true, evidenceSubmittedAt: true, verifiedAt: true, completedAt: true, pickupReminderSentAt: true,
  pickupWarningSentAt: true, pickupDeadlineAt: true, autoReturnedAt: true, missedPickupAt: true, repostedAt: true, createdAt: true, updatedAt: true,
  _count: { select: { estimates: true } },
} as const

const HAULER_MINE_SELECT = {
  id: true, jobNumber: true, status: true, jobTypes: true, questionnaire: true, whatToExpect: true, numStories: true,
  pickupAddress: true, city: true, zipCode: true, arrivalType: true, date: true, time: true, timezone: true, scheduledAt: true,
  beforePhotoUrl: true, afterPhotoUrl: true, priceCents: true, platformFeeCents: true, haulerPayoutCents: true, paymentStatus: true,
  disputeWindowEnd: true, disputeReason: true, disputedAt: true, disputeResolvedAt: true, disputeOutcome: true, autoReturnedCount: true,
  acceptedAt: true, inProgressAt: true, evidenceSubmittedAt: true, verifiedAt: true, completedAt: true, pickupWarningSentAt: true,
  pickupDeadlineAt: true, autoReturnedAt: true, missedPickupAt: true, repostedAt: true, createdAt: true, updatedAt: true,
} as const

const ADMIN_JOB_SELECT = {
  id: true, jobNumber: true, status: true, customerId: true, haulerId: true, jobTypes: true, questionnaire: true, whatToExpect: true,
  numStories: true, pickupAddress: true, city: true, zipCode: true, arrivalType: true, date: true, time: true, timezone: true, scheduledAt: true,
  pickupLatitude: true, pickupLongitude: true, beforePhotoUrl: true, afterPhotoUrl: true, priceCents: true, platformFeeCents: true,
  haulerPayoutCents: true, paymentStatus: true, disputeWindowEnd: true, disputeReason: true, disputedAt: true, disputeResolvedAt: true,
  disputeOutcome: true, autoReturnedCount: true, authorizedAt: true, acceptedAt: true, inProgressAt: true, evidenceSubmittedAt: true,
  verifiedAt: true, completedAt: true, pickupReminderSentAt: true, pickupWarningSentAt: true, pickupDeadlineAt: true, autoReturnedAt: true,
  arrivalVerifiedAt: true, arrivalLatitude: true, arrivalLongitude: true, arrivalAccuracyMeters: true, missedPickupAt: true, repostedAt: true,
  createdAt: true, updatedAt: true, _count: { select: { estimates: true } },
} as const

export async function GET(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tab = new URL(req.url).searchParams.get('tab')

  if (user.role === 'CUSTOMER') {
    const jobs = await db.job.findMany({ where: { customerId: user.id }, orderBy: { createdAt: 'desc' }, select: CUSTOMER_JOB_SELECT })
    return NextResponse.json(jobs)
  }

  if (user.role === 'HAULER') {
    const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } })
    if (!profile) return NextResponse.json([])
    if (tab === 'mine') {
      const jobs = await db.job.findMany({ where: { haulerId: profile.id }, orderBy: { updatedAt: 'desc' }, select: HAULER_MINE_SELECT })
      return NextResponse.json(jobs)
    }
    const jobs = await db.job.findMany({
      where: { status: { in: ['POSTED', 'BIDDING'] }, NOT: { exclusions: { some: { haulerId: profile.id } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: {
        id: true, jobNumber: true, status: true, jobTypes: true, questionnaire: true, whatToExpect: true, numStories: true,
        city: true, arrivalType: true, date: true, time: true, scheduledAt: true, beforePhotoUrl: true, createdAt: true, updatedAt: true,
        estimates: { where: { haulerId: profile.id }, select: { id: true, amountCents: true, arrival: true, message: true, status: true, createdAt: true } },
      },
    })
    return NextResponse.json(jobs)
  }

  if (!['ADMIN', 'OWNER'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const jobs = await db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: ADMIN_JOB_SELECT })
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Only customers can post jobs' }, { status: 403 }); if (!user.paymentVerified) return NextResponse.json({ error: 'Add a verified payment method before posting a job', code: 'PAYMENT_UNVERIFIED' }, { status: 402 })
  const parsed = CreateJobSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 }); const data = parsed.data
  if (data.arrivalType === 'SET_TIME' && !data.time) return NextResponse.json({ error: 'A pickup time is required' }, { status: 422 })
  if ((data.pickupLatitude == null) !== (data.pickupLongitude == null)) return NextResponse.json({ error: 'Pickup latitude and longitude must be provided together' }, { status: 422 })
  if (data.scheduledAtIso && data.arrivalType !== 'SET_TIME') return NextResponse.json({ error: 'Scheduled timestamp is only valid for timed pickups' }, { status: 422 })
  const scheduledAt = data.scheduledAtIso ? new Date(data.scheduledAtIso) : new Date(`${data.date}T${data.time ?? '23:59'}:00`)
  if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: 'Invalid pickup date/time' }, { status: 422 })
  if (data.arrivalType === 'SET_TIME' && scheduledAt.getTime() <= Date.now()) return NextResponse.json({ error: 'Pickup time must be in the future' }, { status: 422 })

  // The UNIQUE constraint on Job.jobNumber is the authoritative collision guard.
  // Retry only on a jobNumber collision; never retry unrelated database failures.
  let job
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      job = await db.job.create({ data: { jobNumber: newJobNumber(), customerId: user.id, jobTypes: JSON.stringify(data.jobTypes), questionnaire: data.questionnaire, whatToExpect: data.whatToExpect || null, numStories: data.numStories, pickupAddress: data.pickupAddress, city: data.city, zipCode: data.zipCode, arrivalType: data.arrivalType, date: data.date, time: data.arrivalType === 'SET_TIME' ? data.time! : null, timezone: data.timezone ?? 'UTC', scheduledAt, pickupLatitude: data.pickupLatitude, pickupLongitude: data.pickupLongitude, beforePhotoUrl: data.beforePhotoUrl, status: 'POSTED', paymentStatus: 'PENDING' } })
      break
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined
      const target = typeof error === 'object' && error !== null && 'meta' in error ? (error as { meta?: { target?: unknown } }).meta?.target : undefined
      const isJobNumberCollision = code === 'P2002' && (target === 'jobNumber' || (Array.isArray(target) && target.includes('jobNumber')))
      if (!isJobNumberCollision || attempt === 2) {
        console.error('Failed to create job:', error)
        return NextResponse.json({ error: 'Unable to create job' }, { status: 500 })
      }
    }
  }

  if (!job) return NextResponse.json({ error: 'Unable to create job' }, { status: 500 })

  await db.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_CREATED', entityType: 'JOB', entityId: job.id, jobId: job.id, metadata: JSON.stringify({ timezone: job.timezone, scheduledAt: job.scheduledAt.toISOString(), questionnaire: data.questionnaire }) } })
  notifyHaulersOfNewJob({ id: job.id, jobNumber: job.jobNumber, city: job.city, typesLabel: data.jobTypes.slice(0, 2).join(', ') + (data.jobTypes.length > 2 ? '…' : '') }).catch(err => console.error('notifyHaulersOfNewJob failed:', err))
  return NextResponse.json({ jobId: job.id, jobNumber: job.jobNumber }, { status: 201 })
}
