import { cn } from '../lib/cn'

const URL = 'https://buymeacoffee.com/andrew1431'

/** Icon link to support the project via Buy Me a Coffee. */
export function BuyMeACoffeeLink({ className }: { className?: string }) {
  return (
    <a
      href={URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Buy me a coffee"
      title="Enjoying it? Buy me a coffee"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zm13 1v4a3 3 0 0 0 3-3 1 1 0 0 0-1-1h-2zM4 20h14a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2zM7 2c.6.7.6 1.3 0 2-.6.8-.6 1.5 0 2.3M11 2c.6.7.6 1.3 0 2-.6.8-.6 1.5 0 2.3M15 2c.6.7.6 1.3 0 2-.6.8-.6 1.5 0 2.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </a>
  )
}
