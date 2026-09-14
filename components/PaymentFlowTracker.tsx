/**
 * PaymentFlowTracker
 * Displays the 8-step payment pipeline with current progress highlighted.
 */
import { PAYMENT_FLOW_STEPS } from '@/lib/constants'
import { card } from '@/lib/ui'

const STATUS_ORDER = ['POSTED', 'BIDDING', 'ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'PENDING_PAYOUT', 'COMPLETED']

function getStepIndex(status: string): number {
  const rank = STATUS_ORDER.indexOf(status)
  if (rank <= 1) return 0 // POSTED/BIDDING → step 0
  if (rank === 2) return 2 // ASSIGNED
  if (rank === 3) return 3 // IN_PROGRESS
  if (rank === 4) return 4 // EVIDENCE_SUBMITTED
  if (rank === 5) return 5 // PENDING_PAYOUT
  return 7 // COMPLETED → all done
}

export default function PaymentFlowTracker({ status }: { status: string }) {
  const currentStep = getStepIndex(status)

  if (status === 'DISPUTED') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
        <p className="font-semibold text-red-600">⚠️ This job is under dispute review</p>
        <p className="mt-1 text-xs text-red-500">Payout is frozen until an admin resolves the dispute.</p>
      </div>
    )
  }

  return (
    <div className={card}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Pipeline</p>
      <ol className="relative">
        {PAYMENT_FLOW_STEPS.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep

          return (
            <li key={`${step.key}-${i}`} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? 'bg-brand text-ink'
                      : active
                        ? 'bg-ink text-white ring-4 ring-brand-light'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
                {i < PAYMENT_FLOW_STEPS.length - 1 && (
                  <div className={`mt-1 w-0.5 flex-1 ${done ? 'bg-brand/50' : 'bg-slate-200'}`} style={{ minHeight: '16px' }} />
                )}
              </div>
              <div className="pb-1">
                <p className={`text-sm font-medium leading-tight ${done ? 'text-brand-dark' : active ? 'text-ink' : 'text-slate-400'}`}>
                  {step.label}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
