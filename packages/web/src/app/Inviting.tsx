import { useState } from 'react'
import { Button, Heading, Loader, Stack, Text } from '../ui'

interface InvitingProps {
  code: string | null
  onCancel: () => void
}

export function Inviting({ code, onCancel }: InvitingProps) {
  const [copied, setCopied] = useState(false)
  const minting = !code

  const shareUrl = code ? `${window.location.origin}/join/${code}` : ''

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. insecure context) — the code is shown to read out.
    }
  }

  return (
    <Stack gap={8} align="center" justify="center" className="min-h-[70dvh] text-center">
      <Stack gap={4} align="center">
        <Heading level={2}>{minting ? 'Creating room…' : 'Waiting for your friend'}</Heading>
        <Text tone="muted">
          {minting
            ? 'Waking the server and minting a code.'
            : 'Share this code — the game starts the moment they join.'}
        </Text>

        {code && (
          <Stack gap={3} align="center">
            <span className="ring-gilt rounded-2xl bg-surface-2 px-8 py-4 font-mono text-5xl font-bold tracking-[0.3em] text-brand">
              {code}
            </span>
            <Button variant="secondary" onClick={copy}>
              {copied ? 'Link copied!' : 'Copy invite link'}
            </Button>
          </Stack>
        )}

        {minting && <Loader />}
      </Stack>

      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </Stack>
  )
}
