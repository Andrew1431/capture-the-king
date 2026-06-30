import { initialGameState } from '@ctk/engine'
import { Board } from '../board/Board'
import { Button, Card, Heading, Stack, Text } from '../ui'

interface HomeProps {
  onPlay: () => void
}

export function Home({ onPlay }: HomeProps) {
  return (
    <Stack gap={8}>
      <Stack gap={2} align="center" className="text-center">
        <Heading level={1}>
          Capture the <span className="text-brand">King</span>
        </Heading>
        <Text tone="muted">
          No check. No checkmate. Take the enemy king and the game is yours.
        </Text>
      </Stack>

      <Board state={initialGameState()} />

      <Stack gap={3}>
        <Button size="lg" block onClick={onPlay}>
          Play
        </Button>
        <Button size="lg" variant="secondary" block disabled>
          Play a friend — soon
        </Button>
      </Stack>

      <Card>
        <Stack gap={2}>
          <Heading level={3}>The king-echo</Heading>
          <Text size="sm" tone="muted">
            Castling through danger is legal here — but it leaves a{' '}
            <span className="text-board-mark">ghost king</span> on the squares your king fled,
            capturable for one turn. Watch for the pulsing crowns.
          </Text>
        </Stack>
      </Card>
    </Stack>
  )
}
