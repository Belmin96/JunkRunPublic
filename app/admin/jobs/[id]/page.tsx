import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatCents, parseJobTypes } from '@/lib/utils'
import PaymentFlowTracker from '@/components/PaymentFlowTracker'
import AdminJobActions from '@/components/AdminJobActions'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

export default async function AdminJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const job = await db.job.findUnique({
    where: { id },
    include: {
      customer: true,
      hauler: true,
      estimates: { include: { hauler: true }, orderBy: { amountCents: 'asc' } },
    },
  })
  if (!job) notFound()

  const resolvedDispute = job.status === 'DISPUTED' && !!job.disputeResolvedAt

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-bold text-brand">{job.jobNumber}</p>
          <h2 className="mt-1 text-2xl font-bold">{job.pickupAddress}</h2>
          <p className="text-sm text-slate-400">{job.city} · {job.date} {job.time ?? '(Anytime)'}</p>
          <div className="mt-2"><StatusBadge status={job.status} /></div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black">{formatCents(job.priceCents)}</p>
          <p className="text-xs text-slate-500">Platform: {formatCents(job.platformFeeCents)}</p>
          <p className="text-xs text-slate-500">Contractor: {formatCents(job.haulerPayoutCents)}</p>
        </div>
      </div>

      <PaymentFlowTracker status={job.status} />

      {resolvedDispute && (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-5">
          <p className="font-bold text-brand">Dispute decision recorded</p>
          <p className="mt-1 text-sm text-slate-300">Outcome: {job.disputeOutcome ?? '—'}</p>
          <p className="mt-1 text-xs text-amber-300">The job remains DISPUTED until the separate payment/refund workflow confirms the financial action.</p>
        </div>
      )}

      <AdminJobActions job={{ id: job.id, status: job.status, disputeReason: job.disputeReason }} />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Customer</p>
          <p className="font-medium">{job.customer.name ?? 'Unknown'}</p>
          <p className="text-sm text-slate-400">{job.customer.email}</p>
        </div>
        {job.hauler && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Contractor</p>
            <p className="font-medium">{job.hauler.companyName}</p>
            {job.hauler.stripeAccountId && <p className="mt-1 text-xs text-slate-500">Stripe: {job.hauler.stripeAccountId}</p>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 font-semibold">Photos</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Before</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.beforePhotoUrl} alt="Before" className="h-32 w-full rounded-lg object-cover" />
          </div>
          {job.afterPhotoUrl && (
            <div>
              <p className="mb-1 text-xs text-slate-500">After</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.afterPhotoUrl} alt="After" className="h-32 w-full rounded-lg object-cover" />
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-400">{parseJobTypes(job.jobTypes).join(', ')}</p>
      </div>

      {job.estimates.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-3 font-semibold">Estimates ({job.estimates.length})</h3>
          <div className="space-y-2">
            {job.estimates.map((e) => (
              <div key={e.id} className={`flex items-center justify-between rounded-xl px-4 py-2 text-sm ${e.haulerId === job.haulerId ? 'border border-brand/30 bg-brand/10' : 'bg-white/5'}`}>
                <div>
                  <p className="font-medium">{e.hauler.companyName}</p>
                  {e.message && <p className="text-xs text-slate-400">{e.message}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCents(e.amountCents)}</p>
                  <p className="text-xs text-slate-500">{e.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-xs text-slate-500">
        <p>Payment status: {job.paymentStatus}</p>
        {job.disputeWindowEnd && <p>Dispute window: {new Date(job.disputeWindowEnd).toLocaleString()}</p>}
        {job.disputeResolvedAt && <p>Dispute resolved: {new Date(job.disputeResolvedAt).toLocaleString()}</p>}
      </div>
    </div>
  )
}
