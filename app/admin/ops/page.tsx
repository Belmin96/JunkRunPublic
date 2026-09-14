import Link from 'next/link'
import { db } from '@/lib/db'
import { formatCents, parseJobTypes } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

export default async function AdminOpsPage() {
  const [stats, disputes, pendingPayout, unverifiedHaulers, unverifiedCustomers] = await Promise.all([
    db.job.groupBy({ by: ['status'], _count: { id: true }, _sum: { priceCents: true, platformFeeCents: true, haulerPayoutCents: true } }),
    db.job.findMany({ where: { status: 'DISPUTED' }, orderBy: { disputedAt: 'asc' } }),
    db.job.findMany({ where: { status: 'PENDING_PAYOUT' }, orderBy: { evidenceSubmittedAt: 'asc' } }),
    db.haulerProfile.count({ where: { insuranceVerified: false, insuranceDocUrl: { not: null } } }),
    db.user.count({ where: { role: 'CUSTOMER', paymentVerified: false } }),
  ])

  const totalJobs = stats.reduce((sum, s) => sum + s._count.id, 0)
  const platformProfit = stats.reduce((sum, s) => sum + (s._sum.platformFeeCents ?? 0), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Live view of all JunkRun activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total jobs', value: totalJobs },
          { label: 'JunkRun profit', value: formatCents(platformProfit) },
          { label: 'Pending payout', value: pendingPayout.length },
          { label: 'Open disputes', value: disputes.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {(unverifiedHaulers > 0 || unverifiedCustomers > 0) && (
        <Link href="/admin/verification" className="block rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 hover:border-amber-500/50">
          <p className="font-bold text-amber-400">⚠️ Verification queue</p>
          <p className="mt-1 text-sm text-amber-300">
            {unverifiedHaulers} contractor{unverifiedHaulers !== 1 ? 's' : ''} awaiting insurance review · {unverifiedCustomers} customer{unverifiedCustomers !== 1 ? 's' : ''} without a verified card
          </p>
        </Link>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-4 font-bold text-slate-200">Jobs by Status</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.status} className="rounded-xl bg-white/5 p-3 text-center">
              <StatusBadge status={s.status} />
              <p className="mt-2 text-xl font-black">{s._count.id}</p>
            </div>
          ))}
        </div>
      </div>

      {disputes.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <h2 className="mb-4 font-bold text-red-400">⚠️ Open Disputes ({disputes.length})</h2>
          <div className="space-y-2">
            {disputes.map((job) => (
              <Link key={job.id} href={`/admin/jobs/${job.id}`} className="flex items-center justify-between rounded-xl border border-red-500/20 bg-white/5 px-4 py-3 hover:border-red-500/40">
                <div>
                  <span className="font-mono text-sm font-bold text-brand">{job.jobNumber}</span>
                  <p className="text-sm text-slate-300">{job.pickupAddress}, {job.city}</p>
                  {job.disputeReason && <p className="mt-0.5 text-xs text-red-400">{job.disputeReason}</p>}
                </div>
                <p className="font-bold">{formatCents(job.priceCents)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendingPayout.length > 0 && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
          <h2 className="mb-4 font-bold text-indigo-300">Pending Payout ({pendingPayout.length})</h2>
          <div className="space-y-2">
            {pendingPayout.map((job) => (
              <Link key={job.id} href={`/admin/jobs/${job.id}`} className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-white/5 px-4 py-3 hover:border-indigo-500/40">
                <div>
                  <span className="font-mono text-sm font-bold text-brand">{job.jobNumber}</span>
                  <p className="text-sm text-slate-300">{job.pickupAddress}, {job.city}</p>
                  <p className="text-xs text-slate-500">
                    Dispute window closes: {job.disputeWindowEnd ? new Date(job.disputeWindowEnd).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCents(job.haulerPayoutCents)}</p>
                  <p className="text-xs text-slate-500">hauler payout</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
