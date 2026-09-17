import { getOrCreateDbUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCents, formatDate } from '@/lib/utils'
import { card } from '@/lib/ui'
import NotificationsToggle from '@/components/NotificationsToggle'
import InsuranceUpload from '@/components/InsuranceUpload'
import StripeConnectCard from '@/components/StripeConnectCard'

export const dynamic = 'force-dynamic'

export default async function HaulerProfilePage() {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser) return null

  const haulerProfile = await db.haulerProfile.findUnique({ where: { userId: dbUser.id } })
  if (!haulerProfile) return null

  const [reviews, weeklyPayouts] = await Promise.all([
    db.review.findMany({ where: { haulerId: haulerProfile.id, targetType: 'HAULER' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.weeklyPayout.findMany({ where: { haulerId: haulerProfile.id }, orderBy: { weekStart: 'desc' }, take: 8 }),
  ])

  // Reviewer names, for display (contractor reviews ARE attributed to the customer — no anonymity rule on this side)
  const raterIds = reviews.map((r) => r.raterId)
  const raters = await db.user.findMany({ where: { id: { in: raterIds } }, select: { id: true, name: true, email: true } })
  const raterMap = new Map(raters.map((r) => [r.id, r.name ?? r.email]))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p className="mt-1 text-sm text-slate-500">This is what customers see about your company.</p>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink">{haulerProfile.companyName}</p>
          {haulerProfile.verified && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold text-brand-dark">VERIFIED PRO</span>}
        </div>
        <p className="mt-1 text-sm text-slate-500">⭐ {haulerProfile.rating.toFixed(1)} · {haulerProfile.jobCount} jobs completed</p>
        {haulerProfile.bio && <p className="mt-2 text-sm text-slate-600">{haulerProfile.bio}</p>}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">HaulBoard alerts</p>
            <p className="text-xs text-slate-500">Get notified the moment a new job posts.</p>
          </div>
          <NotificationsToggle initialEnabled={haulerProfile.notificationsEnabled} />
        </div>
      </div>

      <StripeConnectCard initialConnected={!!haulerProfile.stripeAccountId} />

      <div className={card}>
        <InsuranceUpload docUrl={haulerProfile.insuranceDocUrl} verified={haulerProfile.insuranceVerified} />
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold text-ink">Weekly payouts</h3>
        {weeklyPayouts.length === 0 ? (
          <p className="text-sm text-slate-400">No completed weeks yet.</p>
        ) : (
          <div className="space-y-2">
            {weeklyPayouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                <div>
                  <p className="font-medium text-ink">{formatDate(w.weekStart.toISOString().slice(0, 10))} – {formatDate(w.weekEnd.toISOString().slice(0, 10))}</p>
                  <p className="text-xs text-slate-500">{w.jobCount} job{w.jobCount !== 1 ? 's' : ''}</p>
                </div>
                <p className="font-bold text-ink">{formatCents(w.payoutCents)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-ink">
          Reviews from customers
          {reviews.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({reviews.length})</span>}
        </h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-400">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className={card}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{raterMap.get(r.raterId) ?? 'Customer'}</p>
                  <p>{'⭐'.repeat(r.stars)}</p>
                </div>
                {r.note && <p className="mt-1 text-sm text-slate-600">&ldquo;{r.note}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
