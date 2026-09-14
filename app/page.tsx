import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/redirect')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-white">
      <div className="app-shell w-full space-y-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Logo className="scale-125" markClassName="h-14 w-14" />
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Curb it. We&apos;ll serve it.</p>
        </div>
        <p className="text-slate-300">
          Post a photo of your junk, get real quotes from local contractors, and only pay once the job is done right.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/sign-up"
            className="rounded-xl bg-brand py-3.5 text-center text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-white"
          >
            Post a job
          </Link>
          <Link
            href="/sign-up?role=hauler"
            className="rounded-xl border border-slate-700 py-3.5 text-center text-sm font-semibold text-white transition hover:border-brand"
          >
            Become a contractor
          </Link>
        </div>

        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>

        <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-6">
          {[
            { icon: '📸', label: 'Photo-quoted' },
            { icon: '🔒', label: 'Secure payments' },
            { icon: '⚡', label: 'Fast pickups' },
          ].map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{b.icon}</span>
              <span className="text-xs font-medium text-slate-400">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
