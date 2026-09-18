import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={cn('h-10 w-10', className)} role="img" aria-label="JunkRun">
      <defs>
        <linearGradient id="jr-lime" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4FF00" />
          <stop offset="55%" stopColor="#A8FF00" />
          <stop offset="100%" stopColor="#63E600" />
        </linearGradient>
        <filter id="jr-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter="url(#jr-glow)" fill="none" stroke="url(#jr-lime)" strokeWidth="6" strokeLinecap="square">
        <path d="M8 22H43" />
        <path d="M15 37H51" />
        <path d="M22 52H57" />
        <path d="M29 67H61" />
      </g>

      <path
        d="M55 13h23L64 58c-3 10-9 16-21 16H29c-11 0-18-7-18-17 0-5 2-9 5-13l18 7c-2 2-3 4-3 6 0 2 1 3 4 3h5c3 0 5-2 6-5z"
        fill="url(#jr-lime)"
        stroke="#11150B"
        strokeWidth="3"
      />

      <path
        d="M80 13h20c11 0 18 7 18 18 0 8-4 14-11 17l11 25H98L88 52h-5v21H62V13zm3 13v13h11c4 0 7-3 7-7s-3-6-7-6z"
        fill="#FFF"
        stroke="#11150B"
        strokeWidth="3"
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
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className={cn('text-xl font-black italic tracking-tight', inverted ? 'text-white' : 'text-ink')}>
          JUNK<span className="text-brand">RUN</span>
        </span>
        {tagline && (
          <span className={cn(
            'mt-1 text-[9px] font-black uppercase tracking-[0.16em]',
            inverted ? 'text-brand' : 'text-brand-dark'
          )}>
            Curb it. We&apos;ll serve it.
          </span>
        )}
      </span>
    </span>
  )
}
