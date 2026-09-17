/** Shared maintenance jobs for Vercel Cron and admin-triggered maintenance. */
import { db } from './db'
import { stripe } from './stripe'
import { notifyUser, notifyHaulersOfNewJob } from './notify'
import { isoWeekRange } from './utils'
import { AUTO_RETURN_HOURS, PICKUP_REMINDER_MINUTES, PICKUP_WARNING_MINUTES, PICKUP_DEADLINE_MINUTES } from './constants'

const ANYTIME_PICKUP_WINDOW_MINUTES = 24 * 60
const SET_TIME_WARNING_MINUTES = 15
const ANYTIME_WARNING_MINUTES = 60

export async function runPickupWatch() {
  const now = new Date()
  const reminderCutoff = new Date(now.getTime() + PICKUP_REMINDER_MINUTES * 60000)

  const reminderJobs = await db.job.findMany({ where: { status: 'ASSIGNED', arrivalType: 'SET_TIME', scheduledAt: { gt: now, lte: reminderCutoff }, pickupReminderSentAt: null, haulerId: { not: null } }, include: { hauler: true } })
  for (const job of reminderJobs) {
    const claimed = await db.job.updateMany({ where: { id: job.id, status: 'ASSIGNED', pickupReminderSentAt: null }, data: { pickupReminderSentAt: now } })
    if (!claimed.count || !job.hauler) continue
    await notifyUser({ userId: job.hauler.userId, type: 'PICKUP_REMINDER', title: 'Pickup in 45 minutes', body: `${job.jobNumber} is scheduled for pickup at ${job.time ?? job.scheduledAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Open the job to navigate and verify arrival.`, jobId: job.id, url: `/hauler/jobs/${job.id}` })
  }

  // The warning is based on the actual stored deadline, so SET_TIME jobs warn
  // 15 minutes before their 45-minute window ends, while ANYTIME jobs warn
  // 1 hour before their 24-hour window ends.
  const anytimeWarningAtOrBefore = new Date(now.getTime() + ANYTIME_WARNING_MINUTES * 60000)
  const setTimeWarningAtOrBefore = new Date(now.getTime() + SET_TIME_WARNING_MINUTES * 60000)
  const warningJobs = await db.job.findMany({
    where: {
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      pickupDeadlineAt: { gt: now, lte: anytimeWarningAtOrBefore },
      pickupWarningSentAt: null,
      haulerId: { not: null },
    },
    include: { hauler: true },
  })
  let warningsSent = 0
  for (const job of warningJobs) {
    if (!job.hauler) continue
    const isAnytime = job.arrivalType === 'ANYTIME'
    const warningCutoff = isAnytime ? anytimeWarningAtOrBefore : setTimeWarningAtOrBefore
    if (job.pickupDeadlineAt > warningCutoff) continue
    const claimed = await db.job.updateMany({ where: { id: job.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, pickupDeadlineAt: { gt: now, lte: warningCutoff }, pickupWarningSentAt: null }, data: { pickupWarningSentAt: now } })
    if (!claimed.count) continue
    warningsSent += 1
    const minutesLeft = isAnytime ? ANYTIME_WARNING_MINUTES : SET_TIME_WARNING_MINUTES
    await notifyUser({ userId: job.hauler.userId, type: 'PICKUP_REMINDER', title: `${minutesLeft} minutes left`, body: `${job.jobNumber} has ${minutesLeft} minutes remaining in the ${isAnytime ? '24-hour' : '45-minute'} pickup window. Arrive and verify pickup before the deadline.`, jobId: job.id, url: `/hauler/jobs/${job.id}` })
  }

  const expired = await db.job.findMany({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, pickupDeadlineAt: { lte: now }, haulerId: { not: null } }, include: { hauler: true } })
  let reposted = 0
  for (const job of expired) {
    if (!job.haulerId || !job.hauler) continue
    const excludedHaulerId = job.haulerId
    if (job.stripePaymentIntentId) await stripe.paymentIntents.cancel(job.stripePaymentIntentId).catch((err) => console.error(`Could not release hold for ${job.jobNumber}:`, err))
    const reopened = await db.$transaction(async (tx) => {
      const current = await tx.job.findUnique({ where: { id: job.id } })
      if (!current || !['ASSIGNED', 'IN_PROGRESS'].includes(current.status) || current.haulerId !== excludedHaulerId || !current.pickupDeadlineAt || current.pickupDeadlineAt > now) return null
      await tx.jobHaulerExclusion.upsert({ where: { jobId_haulerId: { jobId: job.id, haulerId: excludedHaulerId } }, update: { reason: 'MISSED_PICKUP' }, create: { jobId: job.id, haulerId: excludedHaulerId, reason: 'MISSED_PICKUP' } })
      await tx.estimate.deleteMany({ where: { jobId: job.id } })
      await tx.jobDecline.deleteMany({ where: { jobId: job.id } })
      return tx.job.update({ where: { id: job.id }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, stripePaymentIntentId: null, paymentStatus: 'PENDING', acceptedAt: null, authorizedAt: null, inProgressAt: null, evidenceSubmittedAt: null, verifiedAt: null, completedAt: null, disputeWindowEnd: null, pickupReminderSentAt: null, pickupWarningSentAt: null, pickupDeadlineAt: null, autoReturnedAt: now, missedPickupAt: now, repostedAt: now, autoReturnedCount: { increment: 1 } } })
    })
    if (!reopened) continue
    reposted += 1
    const windowLabel = job.arrivalType === 'ANYTIME' ? '24-hour' : '45-minute'
    await notifyUser({ userId: job.hauler.userId, type: 'PICKUP_MISSED', title: 'Pickup window expired', body: `${job.jobNumber} was not completed within the ${windowLabel} pickup window and has been returned to the HaulBoard. You cannot rebid on this reposted job.`, jobId: job.id, url: '/hauler/dashboard' })
    await notifyUser({ userId: job.customerId, type: 'PICKUP_MISSED', title: 'Your job was reposted', body: `${job.jobNumber} was not completed within the ${windowLabel} pickup window and has been returned to the HaulBoard for new estimates.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
    await notifyHaulersOfNewJob({ id: job.id, jobNumber: job.jobNumber, city: job.city, typesLabel: 'Reposted job' })
  }
  return { remindersSent: reminderJobs.length, warningsSent, missedAndReposted: reposted }
}

export async function runAutoReturn() {
  return runPickupWatch()
}

export async function runWeeklyPayoutSummary(weeksAgo = 1) {
  const anchor = new Date(); anchor.setUTCDate(anchor.getUTCDate() - weeksAgo * 7); const { start, end } = isoWeekRange(anchor)
  const jobs = await db.job.findMany({ where: { status: 'COMPLETED', completedAt: { gte: start, lt: end } } })
  type Agg = { jobCount: number; grossCents: number; platformFeeCents: number; payoutCents: number }
  const byHauler = new Map<string, Agg>()
  for (const job of jobs) { if (!job.haulerId) continue; const agg = byHauler.get(job.haulerId) ?? { jobCount: 0, grossCents: 0, platformFeeCents: 0, payoutCents: 0 }; agg.jobCount += 1; agg.grossCents += job.priceCents ?? 0; agg.platformFeeCents += job.platformFeeCents; agg.payoutCents += job.haulerPayoutCents; byHauler.set(job.haulerId, agg) }
  const rows = await Promise.all(Array.from(byHauler.entries()).map(([haulerId, agg]) => db.weeklyPayout.upsert({ where: { haulerId_weekStart: { haulerId, weekStart: start } }, update: { ...agg, weekEnd: end }, create: { haulerId, weekStart: start, weekEnd: end, ...agg } })))
  return { weekStart: start, weekEnd: end, haulers: rows.length, rows }
}
