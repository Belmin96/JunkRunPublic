/**
 * Shared maintenance jobs, callable both from the CRON_SECRET-protected
 * /api/cron/* routes (for Vercel Cron) and from admin-session-protected
 * "run now" buttons on /admin/finance.
 */
import { db } from './db'
import { stripe } from './stripe'
import { notifyUser } from './notify'
import { isoWeekRange } from './utils'
import { AUTO_RETURN_HOURS } from './constants'

export async function runAutoReturn() {
  const cutoff = new Date(Date.now() - AUTO_RETURN_HOURS * 60 * 60 * 1000)
  const stuck = await db.job.findMany({
    where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, scheduledAt: { lt: cutoff } },
    include: { hauler: true },
  })

  for (const job of stuck) {
    if (job.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(job.stripePaymentIntentId).catch((err) => {
        console.error(`Could not release hold for ${job.jobNumber}:`, err)
      })
    }

    await db.$transaction([
      db.estimate.deleteMany({ where: { jobId: job.id } }),
      db.jobDecline.deleteMany({ where: { jobId: job.id } }),
      db.job.update({
        where: { id: job.id },
        data: {
          status: 'POSTED',
          haulerId: null,
          priceCents: null,
          platformFeeCents: 0,
          haulerPayoutCents: 0,
          stripePaymentIntentId: null,
          paymentStatus: 'PENDING',
          acceptedAt: null,
          inProgressAt: null,
          autoReturnedCount: { increment: 1 },
        },
      }),
    ])

    if (job.hauler) {
      await notifyUser({
        userId: job.hauler.userId,
        type: 'JOB_AUTO_RETURNED',
        title: 'Job returned to the HaulBoard',
        body: `${job.jobNumber} wasn't completed within 24h of the scheduled time and was reassigned.`,
        url: '/hauler/dashboard',
      })
    }
    await notifyUser({
      userId: job.customerId,
      type: 'JOB_AUTO_RETURNED',
      title: 'Your job is back on the HaulBoard',
      body: `${job.jobNumber} wasn't completed in time, so we reopened it for new estimates.`,
      jobId: job.id,
      url: `/customer/jobs/${job.id}`,
    })
  }

  return { returned: stuck.length }
}

export async function runWeeklyPayoutSummary(weeksAgo = 1) {
  const anchor = new Date()
  anchor.setUTCDate(anchor.getUTCDate() - weeksAgo * 7)
  const { start, end } = isoWeekRange(anchor)

  const jobs = await db.job.findMany({ where: { status: 'COMPLETED', completedAt: { gte: start, lt: end } } })

  type Agg = { jobCount: number; grossCents: number; platformFeeCents: number; payoutCents: number }
  const byHauler = new Map<string, Agg>()
  for (const job of jobs) {
    if (!job.haulerId) continue
    const agg = byHauler.get(job.haulerId) ?? { jobCount: 0, grossCents: 0, platformFeeCents: 0, payoutCents: 0 }
    agg.jobCount += 1
    agg.grossCents += job.priceCents ?? 0
    agg.platformFeeCents += job.platformFeeCents
    agg.payoutCents += job.haulerPayoutCents
    byHauler.set(job.haulerId, agg)
  }

  const rows = await Promise.all(
    Array.from(byHauler.entries()).map(([haulerId, agg]) =>
      db.weeklyPayout.upsert({
        where: { haulerId_weekStart: { haulerId, weekStart: start } },
        update: { ...agg, weekEnd: end },
        create: { haulerId, weekStart: start, weekEnd: end, ...agg },
      })
    )
  )

  return { weekStart: start, weekEnd: end, haulers: rows.length, rows }
}
