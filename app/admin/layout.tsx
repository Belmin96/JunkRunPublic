import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { getSessionRole } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import NotificationBell from '@/components/NotificationBell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const role = await getSessionRole()
  if (!role || !['ADMIN', 'OWNER'].includes(role)) redirect('/customer/dashboard')

  return (
    <div className="min-h-screen bg-ink text-white">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/admin/ops" className="flex items-center gap-2">
            <Logo inverted markClassName="h-7 w-7" />
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold uppercase text-red-400">{role}</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/admin/ops" className="text-sm text-slate-400 transition hover:text-white">Ops</Link>
            <Link href="/admin/jobs" className="text-sm text-slate-400 transition hover:text-white">All Loads</Link>
            <Link href="/admin/messages" className="text-sm text-slate-400 transition hover:text-white">Messages</Link>
            <Link href="/admin/users" className="text-sm text-slate-400 transition hover:text-white">Users</Link>
            <Link href="/admin/verification" className="text-sm text-slate-400 transition hover:text-white">Verification</Link>
            <Link href="/admin/finance" className="text-sm text-slate-400 transition hover:text-white">Finance</Link>
            <NotificationBell />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
