import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Logo } from '@/components/Logo'
import NotificationBell from '@/components/NotificationBell'

export default async function HaulerLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-bg text-ink">
      <nav className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="app-shell flex h-16 items-center justify-between px-4">
          <Link href="/hauler/loads" className="flex items-center gap-2">
            <Logo markClassName="h-7 w-7" />
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-brand">Pro</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/hauler/loads" className="hidden text-sm font-medium text-slate-500 hover:text-ink sm:inline">HaulBoard</Link>
            <Link href="/hauler/dashboard" className="hidden text-sm font-medium text-slate-500 hover:text-ink sm:inline">My Loads</Link>
            <Link href="/hauler/profile" className="hidden text-sm font-medium text-slate-500 hover:text-ink sm:inline">Profile</Link>
            <NotificationBell />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>
      <main className="app-shell px-4 py-6">{children}</main>
    </div>
  )
}
