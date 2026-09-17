import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyHaulersOfNewJob } from '@/lib/notify'
import { JOB_TYPES } from '@/lib/constants'
import { z } from 'zod'

const CreateJobSchema = z.object({ jobTypes: z.array(z.enum(JOB_TYPES)).min(1).max(20), whatToExpect: z.string().trim().max(2000).optional(), numStories: z.number().int().min(1).max(10), pickupAddress: z.string().trim().min(5).max(300), city: z.string().trim().min(2).max(100), zipCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/), arrivalType: z.enum(['SET_TIME', 'ANYTIME']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/).optional(), pickupLatitude: z.number().min(-90).max(90).optional(), pickupLongitude: z.number().min(-180).max(180).optional(), beforePhotoUrl: z.string().url().max(2048) })
function newJobNumber() { return `JR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}` }

export async function GET(req: NextRequest) {
  const user = await getOrCreateDbUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tab = new URL(req.url).searchParams.get('tab')
  if (user.role === 'CUSTOMER') return NextResponse.json(await db.job.findMany({ where: { customerId: user.id }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { estimates: true } } } }))
  if (user.role === 'HAULER') { const profile = await db.haulerProfile.findUnique({ where: { userId: user.id } }); if (!profile) return NextResponse.json([]); if (tab === 'mine') return NextResponse.json(await db.job.findMany({ where: { haulerId: profile.id }, orderBy: { updatedAt: 'desc' } })); return NextResponse.json(await db.job.findMany({ where: { status: { in: ['POSTED', 'BIDDING'] }, NOT: { exclusions: { some: { haulerId: profile.id } } } }, orderBy: { createdAt: 'desc' }, take: 100, include: { estimates: { where: { haulerId: profile.id } } } })) }
  if (!['ADMIN', 'OWNER'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { _count: { select: { estimates: true } } } }))
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Only customers can post jobs' }, { status: 403 }); if (!user.paymentVerified) return NextResponse.json({ error: 'Add a verified payment method before posting a job', code: 'PAYMENT_UNVERIFIED' }, { status: 402 })
  const parsed = CreateJobSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 }); const data = parsed.data
  if (data.arrivalType === 'SET_TIME' && !data.time) return NextResponse.json({ error: 'A pickup time is required' }, { status: 422 })
  if ((data.pickupLatitude == null) !== (data.pickupLongitude == null)) return NextResponse.json({ error: 'Pickup latitude and longitude must be provided together' }, { status: 422 })
  const scheduledAt = new Date(`${data.date}T${data.time ?? '23:59'}:00`); if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: 'Invalid pickup date/time' }, { status: 422 })
  const job = await db.job.create({ data: { jobNumber: newJobNumber(), customerId: user.id, jobTypes: JSON.stringify(data.jobTypes), whatToExpect: data.whatToExpect || null, numStories: data.numStories, pickupAddress: data.pickupAddress, city: data.city, zipCode: data.zipCode, arrivalType: data.arrivalType, date: data.date, time: data.arrivalType === 'SET_TIME' ? data.time! : null, scheduledAt, pickupLatitude: data.pickupLatitude, pickupLongitude: data.pickupLongitude, beforePhotoUrl: data.beforePhotoUrl, status: 'POSTED', paymentStatus: 'PENDING' } })
  await db.auditLog.create({ data: { actorUserId: user.id, action: 'JOB_CREATED', entityType: 'JOB', entityId: job.id, jobId: job.id } })
  notifyHaulersOfNewJob({ id: job.id, jobNumber: job.jobNumber, city: job.city, typesLabel: data.jobTypes.slice(0, 2).join(', ') + (data.jobTypes.length > 2 ? '…' : '') }).catch(err => console.error('notifyHaulersOfNewJob failed:', err))
  return NextResponse.json({ jobId: job.id, jobNumber: job.jobNumber }, { status: 201 })
}
