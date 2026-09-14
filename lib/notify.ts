import { db } from './db'
import { sendPush } from './push'
import type { NotificationType } from './constants'

interface NotifyArgs {
  userId: string
  type: NotificationType
  title: string
  body: string
  jobId?: string
  url?: string
}

/**
 * Write an in-app notification (always) and best-effort fan it out via Web
 * Push (unless the user's master notificationsEnabled switch is off).
 */
export async function notifyUser({ userId, type, title, body, jobId, url }: NotifyArgs) {
  await db.notification.create({ data: { userId, type, title, body, jobId } })

  const user = await db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } })
  if (!user || !user.notificationsEnabled) return

  const subs = await db.pushSubscription.findMany({ where: { userId } })
  const dest = url ?? (jobId ? '/notifications' : '/')
  await Promise.all(
    subs.map(async (sub) => {
      const { gone } = await sendPush(sub, { title, body, url: dest })
      if (gone) await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
    })
  )
}

/** Fan a "new job" alert out to every hauler who hasn't muted HaulBoard alerts. */
export async function notifyHaulersOfNewJob(job: { id: string; jobNumber: string; city: string; typesLabel: string }) {
  const haulers = await db.haulerProfile.findMany({
    where: { notificationsEnabled: true, acceptingLoads: true },
    select: { userId: true },
  })
  await Promise.all(
    haulers.map((h) =>
      notifyUser({
        userId: h.userId,
        type: 'JOB_POSTED',
        title: 'New job on the HaulBoard',
        body: `${job.typesLabel} in ${job.city} · ${job.jobNumber}`,
        jobId: job.id,
        url: '/hauler/loads',
      })
    )
  )
}
