import Link from 'next/link'
import { db } from '@/lib/db'
import { formatCents, parseJobTypes } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

/** All Loads — every job on the platform, for admin/owner. */
export default async function AdminAllLoadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams

  const jobs = await db.job.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { customer: true, hauler: true, _count: { select: { estimates: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">All Loads</h1>
        <p className="mt-1 text-sm text-slate-400">{jobs.length} job{jobs.length !== 1 ? 's' : ''}{status ? ` · ${status}` : ''}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="pb-2 pr-4">Job #</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Customer</th>
              <th className="pb-2 pr-4">Contractor</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Price</th>
              <th className="pb-2">Estimates</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {jobs.map((job) => (
              <tr key={job.id} className="transition hover:bg-white/5">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/jobs/${job.id}`} className="font-mono font-bold text-brand hover:underline">{job.jobNumber}</Link>
                </td>
                <td className="py-2.5 pr-4 text-slate-300">{parseJobTypes(job.jobTypes)[0]}</td>
                <td className="py-2.5 pr-4 text-slate-300">{job.customer.name ?? job.customer.email}</td>
                <td className="py-2.5 pr-4 text-slate-300">{job.hauler?.companyName ?? '—'}</td>
                <td className="py-2.5 pr-4"><StatusBadge status={job.status} /></td>
                <td className="py-2.5 pr-4 font-medium">{formatCents(job.priceCents)}</td>
                <td className="py-2.5 text-slate-400">{job._count.estimates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
