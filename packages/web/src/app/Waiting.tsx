import type { ConnPhase } from '../net/useGameSession'
import { Button, Heading, Stack, Text } from '../ui'

interface WaitingProps {
  conn: ConnPhase
  onCancel: () => void
}

export function Waiting({ conn, onCancel }: WaitingProps) {
  const waking = conn === 'waking' || conn === 'connecting'

  return (
    <Stack gap={8} align="center" justify="center" className="min-h-[70dvh] text-center">
      <Stack gap={4} align="center">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-brand" />
        <Stack gap={1} align="center">
          <Heading level={2}>{waking ? 'Waking the server…' : 'Finding an opponent…'}</Heading>
          <Text tone="muted">
            {waking
              ? 'The server scales to zero when idle — this takes a second.'
              : 'Open a second tab and press Play to face yourself.'}
          </Text>
        </Stack>
      </Stack>

      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </Stack>
  )
}
