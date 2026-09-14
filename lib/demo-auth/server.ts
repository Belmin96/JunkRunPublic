/**
 * lib/demo-auth/server.ts
 *
 * Drop-in replacement for '@clerk/nextjs/server', aliased in next.config.ts.
 * Reads the demo persona from a cookie instead of a real Clerk session — see
 * DEMO.md. Implements only what this app actually calls: auth(), currentUser(),
 * clerkClient() (the latter only referenced by the Clerk webhook route, which
 * demo mode never triggers).
 */
import { cookies } from 'next/headers'
import { DEMO_COOKIE, DEMO_PERSONAS } from './identities'

async function getPersona() {
  const store = await cookies()
  const key = store.get(DEMO_COOKIE)?.value
  return key ? DEMO_PERSONAS[key] : undefined
}

export async function auth() {
  const persona = await getPersona()
  if (!persona) {
    return { userId: null as string | null, sessionClaims: null as { metadata?: { role?: string } } | null }
  }
  return {
    userId: persona.clerkId,
    sessionClaims: { metadata: { role: persona.role } },
  }
}

export async function currentUser() {
  const persona = await getPersona()
  if (!persona) return null
  return {
    id: persona.clerkId,
    firstName: persona.firstName,
    lastName: persona.lastName,
    emailAddresses: [{ emailAddress: persona.email }],
    phoneNumbers: persona.phone ? [{ phoneNumber: persona.phone }] : [],
  }
}

/** Only referenced by app/api/webhooks/clerk/route.ts — never called in demo mode. */
export async function clerkClient() {
  return {
    users: {
      async updateUserMetadata() {
        console.warn('[demo-auth] clerkClient.users.updateUserMetadata is a no-op in demo mode')
      },
    },
  }
}
