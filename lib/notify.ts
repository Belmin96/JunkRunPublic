import { db } from './db'
import { sendPush } from './push'
import type { NotificationType } from './constants'

interface NotifyArgs { userId: string; type: NotificationType; title: string; body: string; jobId?: string; url?: string }

export async function notifyUser({ userId, type, title, body, jobId, url }: NotifyArgs) {
  await db.notification.create({ data: { userId, type, title, body, jobId } })
  const user = await db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } })
  if (!user || !user.notificationsEnabled) return
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  const dest = url ?? (jobId ? '/notifications' : '/')
  await Promise.all(subs.map(async (sub) => { const { gone } = await sendPush(sub, { title, body, url: dest }); if (gone) await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {}) }))
}

/** Fan a new-job alert only to eligible haulers. A contractor excluded from a reposted job receives no alert and cannot see the job. */
export async function notifyHaulersOfNewJob(job: { id: string; jobNumber: string; city: string; typesLabel: string }) {
  const haulers = await db.haulerProfile.findMany({ where: { notificationsEnabled: true, acceptingLoads: true, NOT: { exclusions: { some: { jobId: job.id } } } }, select: { userId: true } })
  await Promise.all(haulers.map((h) => notifyUser({ userId: h.userId, type: 'JOB_POSTED', title: 'New job on the HaulBoard', body: `${job.typesLabel} in ${job.city} · ${job.jobNumber}`, jobId: job.id, url: '/hauler/loads' })))
}
