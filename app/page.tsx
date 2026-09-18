import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/redirect')

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[520px] -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(168,255,0,0.16),transparent_62%)]" />

        <div className="relative w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-5 rounded-[2rem] border border-brand/20 bg-black/40 p-5 shadow-[0_0_70px_rgba(168,255,0,0.12)]">
              <LogoMark className="h-28 w-36" />
            </div>
            <Logo inverted tagline className="scale-125" markClassName="hidden" />
          </div>

          <div>
            <p className="text-lg font-semibold leading-7 text-slate-200">
              Post it. Get estimates. Pick your contractor. Get it gone.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Photo-first junk removal with secure payments, pickup tracking, and contractor estimates.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/sign-up"
              className="block rounded-2xl bg-brand px-5 py-4 text-center text-sm font-black uppercase tracking-wide text-ink shadow-[0_8px_30px_rgba(168,255,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#C8FF00]"
            >
              Post a job
            </Link>
            <Link
              href="/sign-up?role=hauler"
              className="block rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-center text-sm font-bold text-white transition hover:border-brand/60 hover:bg-brand/10"
            >
              Become a contractor
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="font-bold text-brand hover:underline">
              Sign in
            </Link>
          </p>

          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-6">
            {[
              { icon: '📸', label: 'Photo-first' },
              { icon: '🔒', label: 'Secure payment' },
              { icon: '📍', label: 'GPS pickup' },
            ].map((b) => (
              <div key={b.label} className="rounded-2xl border border-white/8 bg-white/[0.035] px-2 py-3">
                <span className="text-xl">{b.icon}</span>
                <span className="mt-1 block text-[11px] font-semibold text-slate-400">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
