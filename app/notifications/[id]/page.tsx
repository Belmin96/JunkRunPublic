import { notFound, redirect } from 'next/navigation'
import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'

/** Clicking a notification lands here, which marks it read and routes to the right place for the viewer's role. */
export default async function NotificationRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) notFound()

  const notification = await db.notification.findFirst({ where: { id, userId: dbUser.id } })
  if (!notification) notFound()

  if (!notification.read) {
    await db.notification.update({ where: { id }, data: { read: true } })
  }

  const jobId = notification.jobId
  let dest = '/notifications'

  if (dbUser.role === 'CUSTOMER') {
    dest = jobId ? `/customer/jobs/${jobId}` : '/customer/dashboard'
  } else if (dbUser.role === 'HAULER') {
    dest = ['JOB_POSTED', 'ESTIMATE_DECLINED'].includes(notification.type)
      ? '/hauler/loads'
      : jobId
        ? `/hauler/jobs/${jobId}`
        : '/hauler/dashboard'
  } else if (['ADMIN', 'OWNER'].includes(dbUser.role)) {
    dest = jobId ? `/admin/jobs/${jobId}` : '/admin/ops'
  }

  redirect(dest)
}
