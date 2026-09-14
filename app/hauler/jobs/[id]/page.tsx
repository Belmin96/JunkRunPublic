import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { formatArrival, formatCents, parseJobTypes } from '@/lib/utils'
import { card } from '@/lib/ui'
import PaymentFlowTracker from '@/components/PaymentFlowTracker'
import HaulerJobActions from '@/components/HaulerJobActions'
import ReviewForm from '@/components/ReviewForm'

export const dynamic = 'force-dynamic'

export default async function HaulerJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) notFound()

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: dbUser.id } })
  if (!haulerProfile) notFound()

  const job = await db.job.findFirst({ where: { id, haulerId: haulerProfile.id }, include: { customer: true } })
  if (!job) notFound()

  const alreadyReviewed = await db.review.findUnique({ where: { jobId_raterId: { jobId: id, raterId: dbUser.id } } })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-brand-dark">{job.jobNumber}</p>
          <h2 className="mt-1 text-xl font-bold">{job.pickupAddress}</h2>
          <p className="text-sm text-slate-500">{job.city} · {formatArrival(job)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black">{formatCents(job.haulerPayoutCents)}</p>
          <p className="text-xs text-slate-500">your payout (after 10% fee)</p>
        </div>
      </div>

      <PaymentFlowTracker status={job.status} />

      <div className={card}>
        <h3 className="font-semibold">Job Details</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parseJobTypes(job.jobTypes).map((t) => (
            <span key={t} className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand-dark">{t}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">{job.numStories} stor{job.numStories === 1 ? 'y' : 'ies'}</p>
        {job.whatToExpect && <p className="mt-3 border-t border-border pt-3 text-sm text-slate-600">{job.whatToExpect}</p>}
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold">Before photo (from customer)</h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={job.beforePhotoUrl} alt="Before" className="h-48 w-full rounded-lg object-cover" />
      </div>

      <HaulerJobActions jobId={job.id} status={job.status} />

      {job.afterPhotoUrl && (
        <div className={card}>
          <h3 className="mb-3 font-semibold">After photo (you)</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.afterPhotoUrl} alt="After" className="h-48 w-full rounded-lg object-cover" />
        </div>
      )}

      {job.status === 'PENDING_PAYOUT' && job.disputeWindowEnd && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-700">⏱ Dispute window closes {new Date(job.disputeWindowEnd).toLocaleString()}. Payout releases after that if no dispute is filed.</p>
        </div>
      )}

      {job.status === 'DISPUTED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-600">⚠️ Customer filed a dispute: {job.disputeReason}</p>
        </div>
      )}

      {job.status === 'COMPLETED' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-brand/30 bg-brand-light px-4 py-3 text-center">
            <p className="font-semibold text-brand-dark">✓ Payment released to you.</p>
          </div>
          <Link href={`/hauler/jobs/${job.id}/receipt`} className="block text-center text-sm font-semibold text-brand-dark hover:underline">
            View receipt →
          </Link>
          {!alreadyReviewed && <ReviewForm jobId={job.id} target="customer" />}
        </div>
      )}
    </div>
  )
}
