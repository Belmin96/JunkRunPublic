import Link from 'next/link'
import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ACTIVE_JOB_STATUSES } from '@/lib/constants'
import { formatArrival, formatCents, isoWeekRange, parseJobTypes } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import { cardHover } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function HaulerDashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'active' } = await searchParams
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: dbUser.id } })
  if (!haulerProfile) return null

  const { start: weekStart, end: weekEnd } = isoWeekRange(new Date())

  const [activeJobs, pastJobs, totals, weekTotals] = await Promise.all([
    db.job.findMany({ where: { haulerId: haulerProfile.id, status: { in: ACTIVE_JOB_STATUSES } }, orderBy: { updatedAt: 'desc' } }),
    db.job.findMany({ where: { haulerId: haulerProfile.id, status: { in: ['COMPLETED', 'CANCELLED', 'DISPUTED'] } }, orderBy: { completedAt: 'desc' }, take: 20 }),
    db.job.aggregate({ where: { haulerId: haulerProfile.id, status: 'COMPLETED' }, _sum: { haulerPayoutCents: true }, _count: true }),
    db.job.aggregate({
      where: { haulerId: haulerProfile.id, status: 'COMPLETED', completedAt: { gte: weekStart, lt: weekEnd } },
      _sum: { haulerPayoutCents: true },
    }),
  ])

  const jobs = tab === 'completed' ? pastJobs : activeJobs

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'This week', value: formatCents(weekTotals._sum.haulerPayoutCents ?? 0) },
          { label: 'Total earned', value: formatCents(totals._sum.haulerPayoutCents ?? 0) },
          { label: 'Jobs completed', value: String(totals._count) },
          { label: 'Active loads', value: String(activeJobs.length) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-black text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">My Loads</h2>
          <Link href="/hauler/loads" className="text-sm font-semibold text-brand-dark hover:underline">Browse HaulBoard →</Link>
        </div>

        <div className="mb-4 flex gap-2">
          <Link href="/hauler/dashboard?tab=active" className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm font-semibold ${tab !== 'completed' ? 'border-brand bg-ink text-white' : 'border-border text-slate-500'}`}>
            Active ({activeJobs.length})
          </Link>
          <Link href="/hauler/dashboard?tab=completed" className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm font-semibold ${tab === 'completed' ? 'border-brand bg-ink text-white' : 'border-border text-slate-500'}`}>
            Completed
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-10 text-center">
            <p className="text-slate-500">Nothing here yet.</p>
            <Link href="/hauler/loads" className="mt-3 inline-block text-sm font-semibold text-brand-dark hover:underline">Find a job on the HaulBoard →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/hauler/jobs/${job.id}`} className={`block ${cardHover}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-brand-dark">{job.jobNumber}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{parseJobTypes(job.jobTypes).join(', ')}</p>
                    <p className="text-xs text-slate-500">{job.pickupAddress}, {job.city}</p>
                    <p className="text-xs text-slate-400">{formatArrival(job)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{formatCents(job.haulerPayoutCents)}</p>
                    <p className="text-xs text-slate-500">your payout</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
