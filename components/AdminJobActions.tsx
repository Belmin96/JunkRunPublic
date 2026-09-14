'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface JobProps {
  id: string
  status: string
  stripePaymentIntentId: string | null
  haulerStripeId: string | null
  disputeReason: string | null
}

export default function AdminJobActions({ job }: { job: JobProps }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function act(action: string, body: Record<string, unknown>) {
    setLoading(action)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Action failed')
      }
      setSuccess(`${action} completed successfully`)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  const canRelease = ['PENDING_PAYOUT', 'EVIDENCE_SUBMITTED'].includes(job.status)
  const canResolveDispute = job.status === 'DISPUTED'

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="font-bold text-slate-200">Admin Actions</h3>

      {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {success && <p className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">{success}</p>}

      <div className="flex flex-wrap gap-3">
        {canRelease && (
          <button
            disabled={!!loading || !job.haulerStripeId}
            onClick={() => act('payments/release', { jobId: job.id })}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-white disabled:opacity-50"
          >
            {loading === 'payments/release' ? 'Releasing…' : '💸 Release Payout'}
          </button>
        )}
        {canRelease && !job.haulerStripeId && (
          <p className="self-center text-xs text-amber-400">⚠️ Contractor has no Stripe Connect account yet</p>
        )}

        {canResolveDispute && (
          <>
            <button
              disabled={!!loading || !job.haulerStripeId}
              onClick={() => act('payments/release', { jobId: job.id })}
              className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {loading === 'payments/release' ? 'Releasing…' : '✅ Resolve: Pay Contractor'}
            </button>
            <button
              disabled={!!loading}
              onClick={() =>
                act(`jobs/${job.id}`, {
                  status: 'CANCELLED',
                  disputeOutcome: 'REFUNDED_CUSTOMER',
                  disputeResolvedAt: new Date().toISOString(),
                })
              }
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              ❌ Resolve: Refund Customer
            </button>
          </>
        )}
      </div>

      {job.disputeReason && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <span className="font-semibold">Dispute reason: </span>{job.disputeReason}
        </div>
      )}
    </div>
  )
}
