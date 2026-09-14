'use client'
import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'

function SignUpContent() {
  const params = useSearchParams()
  const role = params.get('role') // "hauler" comes from the landing page CTA

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="mb-8 text-center">
        <Logo tagline className="justify-center" />
        <p className="mt-2 text-sm text-slate-500">
          {role === 'hauler' ? 'Create a contractor account' : 'Create your account'}
        </p>
      </div>
      <SignUp
        unsafeMetadata={{ role: role ?? 'customer' }}
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'bg-card border border-border rounded-2xl shadow-xl',
            headerTitle: 'text-ink',
            headerSubtitle: 'text-slate-500',
            socialButtonsBlockButton: 'border-border text-ink hover:bg-brand-light',
            formFieldInput: 'border-border text-ink focus:border-brand',
            formFieldLabel: 'text-slate-600',
            formButtonPrimary: 'bg-brand hover:bg-brand-dark text-ink hover:text-white font-bold',
            footerActionLink: 'text-brand-dark hover:text-brand',
            dividerLine: 'bg-border',
            dividerText: 'text-slate-400',
          },
        }}
      />
    </main>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  )
}
