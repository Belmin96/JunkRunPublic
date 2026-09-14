import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Logo } from '@/components/Logo'
import NotificationBell from '@/components/NotificationBell'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-bg text-ink">
      <nav className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="app-shell flex h-16 items-center justify-between px-4">
          <Link href="/customer/dashboard">
            <Logo markClassName="h-7 w-7" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/customer/dashboard" className="hidden text-sm font-medium text-slate-500 hover:text-ink sm:inline">
              My Loads
            </Link>
            <Link href="/customer/profile" className="hidden text-sm font-medium text-slate-500 hover:text-ink sm:inline">
              Profile
            </Link>
            <Link
              href="/customer/book"
              className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-white"
            >
              + Post a job
            </Link>
            <NotificationBell />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <main className="app-shell px-4 py-6">{children}</main>
    </div>
  )
}
