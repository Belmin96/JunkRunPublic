'use client'

/**
 * lib/demo-auth/client.tsx
 *
 * Drop-in replacement for '@clerk/nextjs', aliased in next.config.ts.
 * Implements only what this app actually renders: ClerkProvider, UserButton,
 * SignIn, SignUp — each backed by the cookie-based persona switcher instead
 * of a real Clerk instance. See DEMO.md.
 */
import type { ReactNode } from 'react'
import { signInAsDemo, signOutDemo } from './actions'
import { DEMO_PERSONAS } from './identities'

const pillStyle: React.CSSProperties = {
  padding: '4px 9px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
}

function DemoSwitcher() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(16,20,12,0.92)',
        border: '1px solid rgba(99,194,27,0.5)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 260,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#63C21B' }}>
        Demo mode · jump to
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(DEMO_PERSONAS).map(([key, p]) => (
          <form key={key} action={signInAsDemo}>
            <input type="hidden" name="persona" value={key} />
            <button type="submit" style={pillStyle}>{p.label}</button>
          </form>
        ))}
        <form action={signOutDemo}>
          <button type="submit" style={{ ...pillStyle, background: 'transparent', color: '#9CA3AF' }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DemoSwitcher />
    </>
  )
}

export function UserButton(_props: Record<string, unknown>) {
  return (
    <form action={signOutDemo}>
      <button
        type="submit"
        title="Demo mode — click to sign out"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#63C21B',
          color: '#10140C',
          fontWeight: 700,
          fontSize: 11,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        DEMO
      </button>
    </form>
  )
}

function PersonaPicker({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 16,
        border: '1px solid #E5E7EB',
        background: '#fff',
        padding: 28,
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: '#10140C' }}>{title}</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>{subtitle}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(DEMO_PERSONAS).map(([key, p]) => (
          <form key={key} action={signInAsDemo}>
            <input type="hidden" name="persona" value={key} />
            <button
              type="submit"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #E5E7EB',
                background: '#F9FAFB',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#10140C',
              }}
            >
              Continue as {p.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}

export function SignIn(_props: Record<string, unknown>) {
  return (
    <PersonaPicker
      title="Sign in"
      subtitle="Demo mode — no real Clerk instance is configured. Pick a persona to continue as."
    />
  )
}

export function SignUp(_props: Record<string, unknown>) {
  return (
    <PersonaPicker
      title="Create account"
      subtitle="Demo mode — sign-up is simulated. Pick a persona to continue as."
    />
  )
}
