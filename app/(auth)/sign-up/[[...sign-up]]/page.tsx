'use client'
import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Logo } from '@/components/Logo'

type Role = 'customer' | 'hauler'

function SignUpContent() {
  const params = useSearchParams()
  const preRole = params.get('role') as Role | null
  const [role, setRole] = useState<Role | null>(preRole)

  if (!role) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
        <div className="mb-10 text-center">
          <Logo tagline className="justify-center" />
          <p className="mt-3 text-lg font-semibold text-ink">How will you use JunkRun?</p>
          <p className="mt-1 text-sm text-slate-500">Pick your role to get started</p>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-4 sm:flex-row">
          <button onClick={() => setRole('customer')} className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card px-6 py-8 text-center transition hover:border-brand">
            <span className="text-5xl">🏠</span><p className="text-lg font-bold text-ink">I need junk removed</p><p className="text-sm text-slate-500">Post a job, get estimates, pay securely</p>
          </button>
          <button onClick={() => setRole('hauler')} className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card px-6 py-8 text-center transition hover:border-brand">
            <span className="text-5xl">🚛</span><p className="text-lg font-bold text-ink">I haul junk</p><p className="text-sm text-slate-500">Submit estimates, get paid via Stripe Connect</p>
          </button>
        </div>
        <p className="mt-8 text-sm text-slate-500">Already have an account? <a href="/sign-in" className="font-medium text-brand-dark hover:underline">Sign in</a></p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="mb-8 text-center"><Logo tagline className="justify-center" /><p className="mt-2 text-sm text-slate-500">{role === 'hauler' ? '🚛 Contractor account' : '🏠 Customer account'}</p><button onClick={() => setRole(null)} className="mt-1 text-xs text-slate-400 underline">← Change role</button></div>
      <SignUp unsafeMetadata={{ role }} afterSignUpUrl="/redirect" appearance={{ elements: { rootBox: 'w-full max-w-md', card: 'bg-card border border-border rounded-2xl shadow-xl', headerTitle: 'text-ink', headerSubtitle: 'text-slate-500', socialButtonsBlockButton: 'border-border text-ink hover:bg-brand-light', formFieldInput: 'border-border text-ink focus:border-brand', formFieldLabel: 'text-slate-600', formButtonPrimary: 'bg-brand hover:bg-brand-dark text-ink hover:text-white font-bold', footerActionLink: 'text-brand-dark hover:text-brand', dividerLine: 'bg-border', dividerText: 'text-slate-400' } }} />
    </main>
  )
}

export default function SignUpPage() { return <Suspense><SignUpContent /></Suspense> }
