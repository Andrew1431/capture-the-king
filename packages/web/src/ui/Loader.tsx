import { cn } from '../lib/cn'

/** A gold ring orbiting a still crown — the app's one loading motif. */
export function Loader({ className }: { className?: string }) {
  return (
    <span className={cn('relative grid h-14 w-14 place-items-center', className)}>
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-border border-t-brand" />
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <path d="M5 23L3 10l7 5L16 6l6 9 7-5-2 13z" fill="var(--color-brand)" />
        <rect x="5" y="24" width="22" height="3.4" rx="1.2" fill="var(--color-brand)" />
      </svg>
    </span>
  )
}
