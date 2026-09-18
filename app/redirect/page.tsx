import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateDbUser } from '@/lib/auth'
import { hasAcceptedLegal, CUSTOMER_LEGAL, CONTRACTOR_LEGAL } from '@/lib/legal'

export default async function RedirectPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const dbUser = await getOrCreateDbUser()
  if (!dbUser) redirect('/sign-in')

  const required = dbUser.role === 'HAULER' ? CONTRACTOR_LEGAL : CUSTOMER_LEGAL

  if (!(await hasAcceptedLegal(dbUser.id, required))) {
    redirect('/legal/accept')
  }

  switch (dbUser.role) {
    case 'OWNER':
    case 'ADMIN':
      redirect('/admin/ops')
    case 'HAULER':
      redirect('/hauler/dashboard')
    default:
      redirect('/customer/dashboard')
  }
}
