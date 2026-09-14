/**
 * JunkRun logo — a faithful recreation of the brand mark (black badge, lime
 * green "J" with speed lines, white "R") plus wordmark. Swap in the real
 * artwork later by dropping it at public/logo.png and rendering that instead.
 */
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#10140C" />
      {/* speed lines */}
      <g stroke="#63C21B" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
        <line x1="8" y1="20" x2="20" y2="20" />
        <line x1="11" y1="25" x2="23" y2="25" />
        <line x1="14" y1="30" x2="26" y2="30" />
      </g>
      {/* J */}
      <path
        d="M30 16h7v20a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-2h6v2a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3z"
        fill="#63C21B"
      />
      {/* R */}
      <path
        d="M40 16h9a7 7 0 0 1 3 13.3L57 45h-7.5l-4-9H47v9h-7z M47 21v6h2a3 3 0 0 0 0-6z"
        fill="#FFFFFF"
        fillRule="evenodd"
      />
    </svg>
  )
}

export function Logo({
  className,
  markClassName,
  tagline = false,
  inverted = false,
}: {
  className?: string
  markClassName?: string
  tagline?: boolean
  inverted?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className={cn('text-xl font-black tracking-tight', inverted ? 'text-white' : 'text-ink')}>
          Junk<span className={inverted ? 'text-brand' : 'text-brand-dark'}>Run</span>
        </span>
        {tagline && (
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', inverted ? 'text-slate-400' : 'text-slate-400')}>
            Curb it. We&apos;ll serve it.
          </span>
        )}
      </span>
    </span>
  )
}
