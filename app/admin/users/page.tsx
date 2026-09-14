/**
 * /admin/users — user management for admins.
 * Lists all users with role, job count, message count.
 * Admins can promote/demote roles via inline form.
 */
import { db } from '@/lib/db'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import UserRoleForm from './UserRoleForm'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string }>
}) {
  const { role: filterRole, search } = await searchParams

  const users = await db.user.findMany({
    where: {
      ...(filterRole ? { role: filterRole } : {}),
      ...(search ? {
        OR: [
          { name:  { contains: search } },
          { email: { contains: search } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      haulerProfile: { select: { companyName: true, verified: true, rating: true, jobCount: true } },
      _count: { select: { customerJobs: true, messagesSent: true } },
    },
  })

  const roleBg: Record<string, string> = {
    CUSTOMER: 'bg-blue-500/20 text-blue-300',
    HAULER:   'bg-green-500/20 text-green-300',
    ADMIN:    'bg-red-500/20 text-red-300',
    OWNER:    'bg-purple-500/20 text-purple-300',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Users</h1>
          <p className="mt-1 text-sm text-slate-400">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search + role filter */}
      <form method="GET" className="flex gap-3">
        <input
          name="search"
          defaultValue={search}
          placeholder="Name or email…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
        />
        <select
          name="role"
          defaultValue={filterRole ?? ''}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="HAULER">Hauler</option>
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </select>
        <button type="submit" className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-ink hover:bg-brand-dark">
          Filter
        </button>
        {(search || filterRole) && (
          <a href="/admin/users" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-400 hover:text-white">
            Clear
          </a>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="pb-2 pr-4">Name / Email</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Company</th>
              <th className="pb-2 pr-4">Jobs</th>
              <th className="pb-2 pr-4">Messages</th>
              <th className="pb-2 pr-4">Joined</th>
              <th className="pb-2">Change Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-white/5">
                <td className="py-3 pr-4">
                  <p className="font-medium text-white">{u.name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${roleBg[u.role] ?? 'bg-white/10 text-slate-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-300">{u.haulerProfile?.companyName ?? '—'}</td>
                <td className="py-3 pr-4 text-slate-300">{u._count.customerJobs}</td>
                <td className="py-3 pr-4 text-slate-300">{u._count.messagesSent}</td>
                <td className="py-3 pr-4 text-slate-400 text-xs">
                  {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                </td>
                <td className="py-3">
                  {u.role !== 'OWNER' ? (
                    <UserRoleForm userId={u.id} currentRole={u.role} />
                  ) : (
                    <span className="text-xs text-slate-600">Protected</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
