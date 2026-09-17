/** Shared maintenance jobs for Vercel Cron and admin-triggered maintenance. */
import { db } from './db'
import { stripe } from './stripe'
import { notifyUser, notifyHaulersOfNewJob } from './notify'
import { isoWeekRange } from './utils'
import { AUTO_RETURN_HOURS, PICKUP_REMINDER_MINUTES, PICKUP_GRACE_MINUTES } from './constants'

export async function runPickupWatch() {
  const now = new Date()
  const reminderCutoff = new Date(now.getTime() + PICKUP_REMINDER_MINUTES * 60000)
  const overdueCutoff = new Date(now.getTime() - PICKUP_GRACE_MINUTES * 60000)
  const reminderJobs = await db.job.findMany({ where: { status: 'ASSIGNED', arrivalType: 'SET_TIME', scheduledAt: { gt: now, lte: reminderCutoff }, pickupReminderSentAt: null, haulerId: { not: null } }, include: { hauler: true } })
  for (const job of reminderJobs) {
    const claimed = await db.job.updateMany({ where: { id: job.id, status: 'ASSIGNED', pickupReminderSentAt: null }, data: { pickupReminderSentAt: now } })
    if (!claimed.count || !job.hauler) continue
    await notifyUser({ userId: job.hauler.userId, type: 'PICKUP_REMINDER', title: 'Pickup in 45 minutes', body: `${job.jobNumber} is scheduled for pickup at ${job.time ?? job.scheduledAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Open the job to navigate and verify arrival.`, jobId: job.id, url: `/hauler/jobs/${job.id}` })
  }
  const missedJobs = await db.job.findMany({ where: { status: 'ASSIGNED', arrivalType: 'SET_TIME', scheduledAt: { lt: overdueCutoff }, arrivalVerifiedAt: null, missedPickupAt: null, haulerId: { not: null } }, include: { hauler: true } })
  let reposted = 0
  for (const job of missedJobs) {
    if (!job.haulerId || !job.hauler) continue
    const excludedHaulerId = job.haulerId
    if (job.stripePaymentIntentId) await stripe.paymentIntents.cancel(job.stripePaymentIntentId).catch((err) => console.error(`Could not release hold for ${job.jobNumber}:`, err))
    const reopened = await db.$transaction(async (tx) => {
      const current = await tx.job.findUnique({ where: { id: job.id } })
      if (!current || current.status !== 'ASSIGNED' || current.missedPickupAt || current.arrivalVerifiedAt || current.haulerId !== excludedHaulerId) return null
      await tx.jobHaulerExclusion.create({ data: { jobId: job.id, haulerId: excludedHaulerId, reason: 'MISSED_PICKUP' } }).catch(() => null)
      await tx.estimate.deleteMany({ where: { jobId: job.id } })
      await tx.jobDecline.deleteMany({ where: { jobId: job.id } })
      return tx.job.update({ where: { id: job.id }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, stripePaymentIntentId: null, paymentStatus: 'PENDING', acceptedAt: null, inProgressAt: null, pickupReminderSentAt: null, missedPickupAt: now, repostedAt: now, autoReturnedCount: { increment: 1 } } })
    })
    if (!reopened) continue
    reposted += 1
    await notifyUser({ userId: job.hauler.userId, type: 'PICKUP_MISSED', title: 'Pickup missed', body: `${job.jobNumber} was not verified as arrived within ${PICKUP_GRACE_MINUTES} minutes of the scheduled pickup. The job has been returned to the HaulBoard.`, jobId: job.id, url: '/hauler/dashboard' })
    await notifyUser({ userId: job.customerId, type: 'PICKUP_MISSED', title: 'Your job was reposted', body: `${job.jobNumber} was not picked up on time and has been returned to the HaulBoard for new estimates.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
    await notifyHaulersOfNewJob({ id: job.id, jobNumber: job.jobNumber, city: job.city, typesLabel: 'Reposted job' })
  }
  return { remindersSent: reminderJobs.length, missedAndReposted: reposted }
}

export async function runAutoReturn() {
  const cutoff = new Date(Date.now() - AUTO_RETURN_HOURS * 60 * 60 * 1000)
  const stuck = await db.job.findMany({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, scheduledAt: { lt: cutoff } }, include: { hauler: true } })
  for (const job of stuck) {
    if (job.stripePaymentIntentId) await stripe.paymentIntents.cancel(job.stripePaymentIntentId).catch((err) => console.error(`Could not release hold for ${job.jobNumber}:`, err))
    await db.$transaction([db.estimate.deleteMany({ where: { jobId: job.id } }), db.jobDecline.deleteMany({ where: { jobId: job.id } }), db.job.update({ where: { id: job.id }, data: { status: 'POSTED', haulerId: null, priceCents: null, platformFeeCents: 0, haulerPayoutCents: 0, stripePaymentIntentId: null, paymentStatus: 'PENDING', acceptedAt: null, inProgressAt: null, autoReturnedCount: { increment: 1 } } })])
    if (job.hauler) await notifyUser({ userId: job.hauler.userId, type: 'JOB_AUTO_RETURNED', title: 'Job returned to the HaulBoard', body: `${job.jobNumber} wasn't completed within 24h of the scheduled time and was reassigned.`, url: '/hauler/dashboard' })
    await notifyUser({ userId: job.customerId, type: 'JOB_AUTO_RETURNED', title: 'Your job is back on the HaulBoard', body: `${job.jobNumber} wasn't completed in time, so we reopened it for new estimates.`, jobId: job.id, url: `/customer/jobs/${job.id}` })
  }
  return { returned: stuck.length }
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
