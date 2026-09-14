import { SignIn } from '@clerk/nextjs'
import { Logo } from '@/components/Logo'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="mb-8">
        <Logo tagline />
      </div>
      <SignIn
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
