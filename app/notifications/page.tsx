import Link from 'next/link'
import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Logo } from '@/components/Logo'
import { card } from '@/lib/ui'

export const dynamic = 'force-dynamic'

const HOME_BY_ROLE: Record<string, string> = {
  CUSTOMER: '/customer/dashboard',
  HAULER: '/hauler/dashboard',
  ADMIN: '/admin/ops',
  OWNER: '/admin/ops',
}

export default async function NotificationsPage() {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const notifications = await db.notification.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  await db.notification.updateMany({ where: { userId: dbUser.id, read: false }, data: { read: true } })

  return (
    <div className="min-h-screen bg-bg text-ink">
      <nav className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="app-shell flex h-16 items-center justify-between px-4">
          <Link href={HOME_BY_ROLE[dbUser.role] ?? '/'}><Logo markClassName="h-7 w-7" /></Link>
          <Link href={HOME_BY_ROLE[dbUser.role] ?? '/'} className="text-sm font-semibold text-brand-dark hover:underline">Done</Link>
        </div>
      </nav>
      <main className="app-shell space-y-3 px-4 py-6">
        <h2 className="text-2xl font-bold">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing yet.</p>
        ) : (
          notifications.map((n) => (
            <Link key={n.id} href={`/notifications/${n.id}`} className={`block ${card}`}>
              <p className="font-medium text-ink">{n.title}</p>
              <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
            </Link>
          ))
        )}
      </main>
    </div>
  )
}
