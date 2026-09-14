import Link from 'next/link'
import { db } from '@/lib/db'
import HaulerVerifyButtons from '@/components/HaulerVerifyButtons'

export const dynamic = 'force-dynamic'

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'unverified' } = await searchParams
  const wantVerified = tab === 'verified'

  const [haulers, customers] = await Promise.all([
    db.haulerProfile.findMany({ where: { verified: wantVerified }, include: { user: true }, orderBy: { createdAt: 'desc' } }),
    db.user.findMany({ where: { role: 'CUSTOMER', paymentVerified: wantVerified }, orderBy: { createdAt: 'desc' } }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Verification</h1>
        <p className="mt-1 text-sm text-slate-400">Contractor insurance &amp; customer payment status.</p>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/verification?tab=unverified" className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm font-semibold ${!wantVerified ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 text-slate-400'}`}>
          Unverified
        </Link>
        <Link href="/admin/verification?tab=verified" className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm font-semibold ${wantVerified ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 text-slate-400'}`}>
          Verified
        </Link>
      </div>

      <section>
        <h2 className="mb-3 font-bold text-slate-200">Contractors ({haulers.length})</h2>
        {haulers.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing here.</p>
        ) : (
          <div className="space-y-2">
            {haulers.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{h.companyName}</p>
                  <p className="text-xs text-slate-400">{h.user.email}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {h.insuranceDocUrl ? 'Insurance doc uploaded' : 'No insurance doc uploaded'}
                  </p>
                </div>
                {!wantVerified && h.insuranceDocUrl && <HaulerVerifyButtons haulerId={h.id} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-bold text-slate-200">Customers ({customers.length})</h2>
        {customers.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing here.</p>
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{c.name ?? 'Customer'}</p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                </div>
                {c.paymentVerified && <p className="text-xs text-slate-500">{c.cardBrand?.toUpperCase()} •••• {c.cardLast4}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
