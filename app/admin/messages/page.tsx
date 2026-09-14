/**
 * /admin/messages — full conversation browser for admins.
 * Shows every job thread; clicking a job expands the full chat log.
 */
import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

function rolePill(role: string) {
  const map: Record<string, string> = {
    CUSTOMER: 'bg-blue-500/20 text-blue-300',
    HAULER:   'bg-green-500/20 text-green-300',
    ADMIN:    'bg-red-500/20 text-red-300',
    OWNER:    'bg-purple-500/20 text-purple-300',
  }
  return map[role] ?? 'bg-white/10 text-slate-300'
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; search?: string }>
}) {
  const { jobId: filterJob, search } = await searchParams

  // Get all jobs that have at least one message
  const jobs = await db.job.findMany({
    where: filterJob
      ? { id: filterJob }
      : { messages: { some: {} } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      customer: { select: { name: true, email: true } },
      hauler:   { select: { companyName: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { name: true, email: true, role: true, haulerProfile: { select: { companyName: true } } } } },
      },
      _count: { select: { messages: true } },
    },
  })

  // Filter by search text (across sender name / message text)
  const filtered = search
    ? jobs.filter(j =>
        j.messages.some(m =>
          m.text.toLowerCase().includes(search.toLowerCase()) ||
          (m.sender.name ?? m.sender.email).toLowerCase().includes(search.toLowerCase())
        )
      )
    : jobs

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Message Center</h1>
          <p className="mt-1 text-sm text-slate-400">
            {filtered.length} job thread{filtered.length !== 1 ? 's' : ''} with messages
          </p>
        </div>
      </div>

      {/* Search / filter bar */}
      <form method="GET" className="flex gap-3">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search messages or sender…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
        />
        <input
          name="jobId"
          defaultValue={filterJob}
          placeholder="Job ID filter…"
          className="w-48 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
        />
        <button type="submit" className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-ink hover:bg-brand-dark">
          Search
        </button>
        {(search || filterJob) && (
          <a href="/admin/messages" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-400 hover:text-white">
            Clear
          </a>
        )}
      </form>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
          No message threads found.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((job) => (
          <div key={job.id} className="rounded-2xl border border-white/10 bg-white/5">
            {/* Job header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="font-mono font-bold text-brand hover:underline"
                >
                  {job.jobNumber}
                </Link>
                <span className="text-sm text-slate-400">{job.pickupAddress}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                  job.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' :
                  job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-white/10 text-slate-400'
                }`}>{job.status}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span>{job.customer.name ?? job.customer.email}</span>
                <span>→</span>
                <span>{job.hauler?.companyName ?? 'Unassigned'}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {job._count.messages} msg{job._count.messages !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Message thread */}
            <div className="divide-y divide-white/5 px-5 py-2">
              {job.messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3 py-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${rolePill(msg.senderRole)}`}>
                    {msg.senderRole}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">
                      {msg.sender.role === 'HAULER'
                        ? (msg.sender.haulerProfile?.companyName ?? msg.sender.name ?? msg.sender.email)
                        : (msg.sender.name ?? msg.sender.email)}
                      {' · '}
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                    <p className="mt-0.5 text-sm text-white break-words">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
