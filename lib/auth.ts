import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

/** Get (or create) a DB User record for the currently signed-in Clerk user. */
export async function getOrCreateDbUser() {
  const { userId } = await auth()
  if (!userId) return null

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ??
    clerkUser.phoneNumbers[0]?.phoneNumber ??
    ''
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null
  const phone = clerkUser.phoneNumbers[0]?.phoneNumber ?? null

  // Upsert so first-login automatically creates the row
  const user = await db.user.upsert({
    where: { clerkId: userId },
    update: { name, phone },
    create: {
      clerkId: userId,
      email,
      name,
      phone,
      role: 'CUSTOMER',
    },
    include: { haulerProfile: true },
  })

  return user
}

/** Read the role stored in Clerk session claims (set by Clerk webhook / metadata). */
export async function getSessionRole(): Promise<string | null> {
  const { sessionClaims } = await auth()
  return (sessionClaims?.metadata as { role?: string })?.role ?? null
}

/** Require that the current user has one of the allowed roles. Returns 403 text if not. */
export async function requireRole(...roles: string[]) {
  const role = await getSessionRole()
  if (!role || !roles.includes(role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return null
}
