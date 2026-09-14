import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatArrival, parseJobTypes } from '@/lib/utils'
import { card } from '@/lib/ui'
import EstimateModal from '@/components/EstimateModal'
import DeclineJobButton from '@/components/DeclineJobButton'

export const dynamic = 'force-dynamic'

/** The HaulBoard — every open job a contractor hasn't already passed on. */
export default async function HaulBoard() {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: dbUser.id } })
  if (!haulerProfile) return null

  const declines = await db.jobDecline.findMany({ where: { haulerId: haulerProfile.id }, select: { jobId: true } })
  const jobs = await db.job.findMany({
    where: { status: { in: ['POSTED', 'BIDDING'] }, id: { notIn: declines.map((d) => d.jobId) } },
    orderBy: { createdAt: 'desc' },
    include: { estimates: { where: { haulerId: haulerProfile.id } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">HaulBoard</h2>
        <p className="mt-1 text-sm text-slate-500">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''} available — send an estimate to claim one.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-semibold text-ink">No open jobs right now</p>
          <p className="mt-1 text-sm text-slate-500">Check back soon — new jobs post regularly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const myEstimate = job.estimates[0]
            return (
              <div key={job.id} className={card}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm font-bold text-brand-dark">{job.jobNumber}</span>
                    <p className="mt-1 text-sm font-medium text-ink">{job.city} · {formatArrival(job)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parseJobTypes(job.jobTypes).map((t) => (
                        <span key={t} className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">{t}</span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{job.numStories} stor{job.numStories === 1 ? 'y' : 'ies'}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={job.beforePhotoUrl} alt="Job photo" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                </div>
                {job.whatToExpect && <p className="mt-3 text-sm text-slate-600">{job.whatToExpect}</p>}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <DeclineJobButton jobId={job.id} />
                  <EstimateModal jobId={job.id} jobNumber={job.jobNumber} existingAmountCents={myEstimate?.amountCents} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
