import { db } from '@/lib/db'
import { formatCents, formatDate, isoWeekRange } from '@/lib/utils'
import RunMaintenanceButton from '@/components/RunMaintenanceButton'

export const dynamic = 'force-dynamic'

/**
 * Finance — JunkRun's 10% platform profit tracked separately from what
 * contractors are paid out, all-time and week over week.
 */
export default async function AdminFinancePage() {
  const { start: weekStart, end: weekEnd } = isoWeekRange(new Date())

  const [allTime, thisWeek, weeklyRows] = await Promise.all([
    db.job.aggregate({ where: { status: 'COMPLETED' }, _sum: { priceCents: true, platformFeeCents: true, haulerPayoutCents: true }, _count: true }),
    db.job.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: weekStart, lt: weekEnd } },
      _sum: { priceCents: true, platformFeeCents: true, haulerPayoutCents: true },
    }),
    db.weeklyPayout.findMany({ orderBy: { weekStart: 'desc' }, take: 12, include: { hauler: true } }),
  ])

  const byWeek = new Map<string, { weekStart: Date; weekEnd: Date; grossCents: number; platformFeeCents: number; payoutCents: number; jobCount: number }>()
  for (const row of weeklyRows) {
    const key = row.weekStart.toISOString()
    const agg = byWeek.get(key) ?? { weekStart: row.weekStart, weekEnd: row.weekEnd, grossCents: 0, platformFeeCents: 0, payoutCents: 0, jobCount: 0 }
    agg.grossCents += row.grossCents
    agg.platformFeeCents += row.platformFeeCents
    agg.payoutCents += row.payoutCents
    agg.jobCount += row.jobCount
    byWeek.set(key, agg)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Finance</h1>
        <p className="mt-1 text-sm text-slate-400">JunkRun&apos;s profit, tracked separately from contractor payouts.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'This week — JunkRun profit', value: formatCents(thisWeek._sum.platformFeeCents ?? 0) },
          { label: 'This week — contractor payouts', value: formatCents(thisWeek._sum.haulerPayoutCents ?? 0) },
          { label: 'All-time — JunkRun profit', value: formatCents(allTime._sum.platformFeeCents ?? 0) },
          { label: 'All-time — contractor payouts', value: formatCents(allTime._sum.haulerPayoutCents ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 font-bold text-slate-200">Maintenance jobs</h2>
        <p className="mb-4 text-xs text-slate-500">
          These run automatically via Vercel Cron (see vercel.json) — trigger them manually here too.
        </p>
        <div className="flex flex-wrap gap-4">
          <RunMaintenanceButton job="auto-return" label="Run auto-return check" />
          <RunMaintenanceButton job="weekly-summary" label="Run weekly payout summary" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 font-bold text-slate-200">Weekly breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="pb-2 pr-4">Week</th>
              <th className="pb-2 pr-4">Jobs</th>
              <th className="pb-2 pr-4">Gross</th>
              <th className="pb-2 pr-4">JunkRun profit</th>
              <th className="pb-2">Contractor payouts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {Array.from(byWeek.values()).map((w) => (
              <tr key={w.weekStart.toISOString()}>
                <td className="py-2.5 pr-4">{formatDate(w.weekStart.toISOString().slice(0, 10))} – {formatDate(w.weekEnd.toISOString().slice(0, 10))}</td>
                <td className="py-2.5 pr-4 text-slate-400">{w.jobCount}</td>
                <td className="py-2.5 pr-4">{formatCents(w.grossCents)}</td>
                <td className="py-2.5 pr-4 font-semibold text-brand">{formatCents(w.platformFeeCents)}</td>
                <td className="py-2.5">{formatCents(w.payoutCents)}</td>
              </tr>
            ))}
            {byWeek.size === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">No weekly summaries yet — run one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
