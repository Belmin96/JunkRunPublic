import Link from 'next/link'
import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatArrival, formatCents, parseJobTypes } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import { cardHover } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function CustomerDashboard() {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const jobs = await db.job.findMany({
    where: { customerId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { estimates: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Loads</h2>
        <p className="mt-1 text-sm text-slate-500">Track every job from posting to payout.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <p className="text-4xl">🚛</p>
          <p className="mt-3 font-semibold text-ink">No loads yet</p>
          <p className="mt-1 text-sm text-slate-500">Post your first job and we&apos;ll take it from there.</p>
          <Link href="/customer/book" className="mt-5 inline-block rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-ink hover:bg-brand-dark hover:text-white transition">
            Post a job
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/customer/jobs/${job.id}`} className={`block ${cardHover}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-brand-dark">{job.jobNumber}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-sm text-slate-700">{parseJobTypes(job.jobTypes).join(', ')}</p>
                  <p className="text-xs text-slate-500">{job.pickupAddress}, {job.city}</p>
                  <p className="text-xs text-slate-400">{formatArrival(job)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{formatCents(job.priceCents)}</p>
                  {['POSTED', 'BIDDING'].includes(job.status) && (
                    <p className="text-xs text-slate-500">{job._count.estimates} estimate{job._count.estimates !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
