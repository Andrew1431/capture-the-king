import { track } from '../analytics'
import { cn } from '../lib/cn'

const URL = 'https://discord.gg/yBQTDe2kDB'

/** Icon link to the community Discord server. */
export function DiscordLink({ className }: { className?: string }) {
  return (
    <a
      href={URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => track('link_click', { link: 'discord', url: URL })}
      aria-label="Join the Discord"
      title="Join the community on Discord"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M20.32 4.37A19.8 19.8 0 0 0 15.45 3a13.7 13.7 0 0 0-.62 1.28 18.3 18.3 0 0 0-5.66 0A13.5 13.5 0 0 0 8.55 3a19.7 19.7 0 0 0-4.88 1.37C.57 9 .1 13.55.34 18.03a19.9 19.9 0 0 0 6.07 3.06c.49-.67.93-1.38 1.3-2.13-.71-.27-1.4-.6-2.04-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.06 0c.17.14.34.27.5.4-.65.39-1.34.72-2.05.99.38.75.81 1.46 1.3 2.13a19.8 19.8 0 0 0 6.08-3.06c.29-5.19-.5-9.7-3.34-13.66zM8.02 15.33c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42zm7.96 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42z" />
      </svg>
    </a>
  )
}
