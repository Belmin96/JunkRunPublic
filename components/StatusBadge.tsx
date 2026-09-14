import { JOB_STATUS_LABELS, STATUS_BADGE, cn } from '@/lib/utils'

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[status] ?? 'bg-slate-200 text-slate-600', className)}>
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  )
}
