import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateDbUser } from '@/lib/auth'

/**
 * /redirect — called immediately after sign-in/sign-up.
 * Reads the user's role from Clerk session claims (set by webhook)
 * and redirects to the matching dashboard.
 */
export default async function RedirectPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  // Ensure a DB row exists for this user
  const dbUser = await getOrCreateDbUser()
  const role =
    (sessionClaims?.metadata as { role?: string })?.role ??
    dbUser?.role ??
    'CUSTOMER'

  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      redirect('/admin/ops')
    case 'HAULER':
      redirect('/hauler/dashboard')
    default:
      redirect('/customer/dashboard')
  }
}
