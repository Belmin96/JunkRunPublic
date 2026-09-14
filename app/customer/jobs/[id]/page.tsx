import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { formatArrival, formatCents, parseJobTypes } from '@/lib/utils'
import { card } from '@/lib/ui'
import PaymentFlowTracker from '@/components/PaymentFlowTracker'
import StatusBadge from '@/components/StatusBadge'
import EstimateList from '@/components/EstimateList'
import DisputeForm from '@/components/DisputeForm'
import ReviewForm from '@/components/ReviewForm'

export const dynamic = 'force-dynamic'

export default async function CustomerJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) notFound()

  const job = await db.job.findFirst({
    where: { id, customerId: dbUser.id },
    include: {
      hauler: true,
      estimates: { include: { hauler: true }, orderBy: { amountCents: 'asc' } },
    },
  })
  if (!job) notFound()

  const alreadyReviewed = await db.review.findUnique({ where: { jobId_raterId: { jobId: id, raterId: dbUser.id } } })
  const jobTypes = parseJobTypes(job.jobTypes)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-brand-dark">{job.jobNumber}</p>
          <h2 className="mt-1 text-xl font-bold">{job.pickupAddress}</h2>
          <p className="text-sm text-slate-500">{job.city} · {formatArrival(job)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black">{formatCents(job.priceCents)}</p>
          <StatusBadge status={job.status} className="mt-1 inline-block" />
        </div>
      </div>

      <PaymentFlowTracker status={job.status} />

      <div className={card}>
        <h3 className="font-semibold text-ink">Job Details</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {jobTypes.map((t) => (
            <span key={t} className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand-dark">{t}</span>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-slate-500">Stories</dt><dd className="font-medium">{job.numStories}</dd></div>
          <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{job.status}</dd></div>
        </dl>
        {job.whatToExpect && <p className="mt-3 border-t border-border pt-3 text-sm text-slate-600">{job.whatToExpect}</p>}
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold text-ink">Photos</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Before (you)</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.beforePhotoUrl} alt="Before" className="h-32 w-full rounded-lg object-cover" />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">After (contractor)</p>
            {job.afterPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.afterPhotoUrl} alt="After" className="h-32 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border-2 text-xs text-slate-400">Pending</div>
            )}
          </div>
        </div>
      </div>

      {['POSTED', 'BIDDING'].includes(job.status) && (
        <div>
          <h3 className="mb-3 font-semibold text-ink">Estimates ({job.estimates.filter((e) => e.status === 'PENDING').length})</h3>
          <EstimateList jobId={job.id} estimates={job.estimates} />
        </div>
      )}

      {job.hauler && ['ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'PENDING_PAYOUT', 'DISPUTED', 'COMPLETED'].includes(job.status) && (
        <div className={card}>
          <p className="text-xs uppercase tracking-wider text-slate-400">Your contractor</p>
          <p className="mt-1 font-semibold text-ink">{job.hauler.companyName}</p>
          <p className="text-xs text-slate-500">⭐ {job.hauler.rating.toFixed(1)} · {job.hauler.jobCount} jobs completed</p>
        </div>
      )}

      {job.status === 'PENDING_PAYOUT' && job.disputeWindowEnd && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-700">⏱ Dispute window closes {new Date(job.disputeWindowEnd).toLocaleString()}</p>
          </div>
          <DisputeForm jobId={job.id} />
        </div>
      )}

      {job.status === 'COMPLETED' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-brand/30 bg-brand-light px-4 py-3 text-center">
            <p className="font-semibold text-brand-dark">✓ Job complete — contractor has been paid.</p>
          </div>
          <Link href={`/customer/jobs/${job.id}/receipt`} className="block text-center text-sm font-semibold text-brand-dark hover:underline">
            View receipt →
          </Link>
          {!alreadyReviewed && <ReviewForm jobId={job.id} target="contractor" />}
        </div>
      )}
    </div>
  )
}
