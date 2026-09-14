import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import ReceiptView from '@/components/ReceiptView'

export const dynamic = 'force-dynamic'

export default async function CustomerReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) notFound()

  const job = await db.job.findFirst({
    where: { id, customerId: dbUser.id, status: 'COMPLETED' },
    include: { customer: true, hauler: true },
  })
  if (!job) notFound()

  return (
    <ReceiptView
      audience="customer"
      job={{
        ...job,
        customerName: job.customer.name ?? job.customer.email,
        haulerName: job.hauler?.companyName ?? 'Contractor',
      }}
    />
  )
}
