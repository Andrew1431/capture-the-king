import { cn } from '../lib/cn'

/**
 * The wordmark and the game's signature in one: "KING" casts a violet king-echo —
 * the same ghost a castled king leaves on the board — breathing just behind it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <h1
      className={cn(
        'font-display leading-[0.9] font-bold tracking-wide text-text select-none',
        className,
      )}
    >
      <span className="block text-xl font-semibold text-muted sm:text-2xl">Capture the</span>
      <span className="relative inline-block">
        <span
          aria-hidden
          className="animate-echo absolute inset-0 translate-x-[0.06em] translate-y-[0.06em] text-5xl text-royal/45 blur-[1px] select-none sm:text-6xl"
        >
          King
        </span>
        <span className="relative bg-gradient-to-b from-brand to-brand-strong bg-clip-text text-5xl text-transparent drop-shadow-[0_2px_12px_rgba(232,184,75,0.35)] sm:text-6xl">
          King
        </span>
      </span>
    </h1>
  )
}

/** Small tracked label flanked by hairlines — a court "decree" line. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 text-muted', className)}>
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-border" />
      <span className="font-display text-[0.65rem] font-semibold tracking-[0.3em] uppercase">
        {children}
      </span>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-border" />
    </div>
  )
}
