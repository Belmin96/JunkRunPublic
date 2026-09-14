'use client'
import { cn } from '@/lib/utils'

interface Props<T extends string> {
  tabs: { key: T; label: string; count?: number }[]
  active: T
  onChange: (key: T) => void
}

/** A pill-style tab/chip switcher used for HaulBoard / My Loads / All Loads style navigation. */
export default function Tabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          data-active={active === t.key}
          className={cn(
            'shrink-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition',
            'data-[active=true]:border-brand data-[active=true]:bg-ink data-[active=true]:text-white'
          )}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className="ml-1.5 text-xs opacity-70">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
