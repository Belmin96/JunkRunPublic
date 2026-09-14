import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import ReceiptView from '@/components/ReceiptView'

export const dynamic = 'force-dynamic'

export default async function HaulerReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) notFound()

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: dbUser.id } })
  if (!haulerProfile) notFound()

  const job = await db.job.findFirst({
    where: { id, haulerId: haulerProfile.id, status: 'COMPLETED' },
    include: { customer: true, hauler: true },
  })
  if (!job) notFound()

  return (
    <ReceiptView
      audience="hauler"
      job={{
        ...job,
        customerName: job.customer.name ?? job.customer.email,
        haulerName: job.hauler?.companyName ?? 'Contractor',
      }}
    />
  )
}
