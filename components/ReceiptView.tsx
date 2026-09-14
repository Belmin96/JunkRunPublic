import { Logo } from './Logo'
import { formatCents, formatDate, parseJobTypes } from '@/lib/utils'
import PrintButton from './PrintButton'

interface ReceiptJob {
  jobNumber: string
  pickupAddress: string
  city: string
  zipCode: string
  jobTypes: string
  date: string
  completedAt: Date | null
  priceCents: number | null
  platformFeeCents: number
  haulerPayoutCents: number
  customerName: string
  haulerName: string
}

/** Shared printable receipt — audience decides which totals are emphasized. */
export default function ReceiptView({ job, audience }: { job: ReceiptJob; audience: 'customer' | 'hauler' }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Logo />
        <p className="text-right text-sm text-slate-500">
          Receipt <br />
          <span className="font-mono font-bold text-ink">{job.jobNumber}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Date</dt><dd className="font-medium">{formatDate(job.date)}</dd></div>
          <div><dt className="text-slate-500">Completed</dt><dd className="font-medium">{job.completedAt ? formatDate(job.completedAt.toISOString().slice(0, 10)) : '—'}</dd></div>
          <div><dt className="text-slate-500">Customer</dt><dd className="font-medium">{job.customerName}</dd></div>
          <div><dt className="text-slate-500">Contractor</dt><dd className="font-medium">{job.haulerName}</dd></div>
          <div className="col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-medium">{job.pickupAddress}, {job.city} {job.zipCode}</dd></div>
          <div className="col-span-2"><dt className="text-slate-500">Job type</dt><dd className="font-medium">{parseJobTypes(job.jobTypes).join(', ')}</dd></div>
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold text-ink">{audience === 'customer' ? 'Amount charged' : 'Payout breakdown'}</h3>
        <div className="space-y-2 text-sm">
          <Row k="Job total" v={formatCents(job.priceCents)} />
          <Row k="JunkRun platform fee (10%)" v={`− ${formatCents(job.platformFeeCents)}`} muted />
          <div className="border-t border-border pt-2">
            <Row k={audience === 'customer' ? 'Total charged to your card' : 'Your payout'} v={formatCents(audience === 'customer' ? job.priceCents : job.haulerPayoutCents)} bold />
          </div>
        </div>
      </div>

      <PrintButton />
    </div>
  )
}

function Row({ k, v, muted, bold }: { k: string; v: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{k}</span>
      <span className={bold ? 'text-lg font-black text-ink' : muted ? 'text-slate-400' : 'font-medium text-ink'}>{v}</span>
    </div>
  )
}
