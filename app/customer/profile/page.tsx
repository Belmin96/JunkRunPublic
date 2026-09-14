import Link from 'next/link'
import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { card } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function CustomerProfilePage() {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const [reviews, jobCount] = await Promise.all([
    db.review.findMany({
      where: { customerId: dbUser.id, targetType: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
    }),
    db.job.count({ where: { customerId: dbUser.id, status: 'COMPLETED' } }),
  ])
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p className="mt-1 text-sm text-slate-500">This is what contractors see about you.</p>
      </div>

      <div className={card}>
        <p className="font-semibold text-ink">{dbUser.name ?? 'Customer'}</p>
        <p className="text-sm text-slate-500">{dbUser.email}</p>
        {dbUser.phone && <p className="text-sm text-slate-500">{dbUser.phone}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
          <div><dt className="text-slate-500">Jobs completed</dt><dd className="font-medium">{jobCount}</dd></div>
          <div><dt className="text-slate-500">Rating</dt><dd className="font-medium">{avg ? `⭐ ${avg.toFixed(1)}` : '—'}</dd></div>
        </dl>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink">Payment method</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${dbUser.paymentVerified ? 'bg-brand-light text-brand-dark' : 'bg-amber-100 text-amber-700'}`}>
            {dbUser.paymentVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
        {dbUser.paymentVerified ? (
          <p className="mt-1 text-sm text-slate-500">{dbUser.cardBrand?.toUpperCase()} •••• {dbUser.cardLast4}</p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Add a card to start posting jobs.</p>
        )}
        <Link href="/customer/payment" className="mt-3 inline-block text-sm font-semibold text-brand-dark hover:underline">
          {dbUser.paymentVerified ? 'Update payment method →' : 'Verify now →'}
        </Link>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-ink">
          Reviews from contractors
          {avg && <span className="ml-2 text-sm font-normal text-slate-500">⭐ {avg.toFixed(1)} ({reviews.length})</span>}
        </h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-400">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              // Reviews are shown WITHOUT attribution — the customer can't tell which contractor left which review.
              <div key={r.id} className={card}>
                <p className="text-sm font-semibold text-ink">{'⭐'.repeat(r.stars)}</p>
                {r.note && <p className="mt-1 text-sm text-slate-600">&ldquo;{r.note}&rdquo;</p>}
                <p className="mt-1 text-xs text-slate-400">Contractor review</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
