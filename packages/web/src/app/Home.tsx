import { useState } from 'react'
import { initialGameState } from '@ctk/engine'
import { Board } from '../board/Board'
import { Button, Heading, Stack, Text } from '../ui'

interface HomeProps {
  onPlay: () => void
  onCreateInvite: () => void
  onJoinCode: (code: string) => void
}

export function Home({ onPlay, onCreateInvite, onJoinCode }: HomeProps) {
  const [code, setCode] = useState('')
  const trimmed = code.trim()

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
        <Button size="lg" variant="secondary" block onClick={onCreateInvite}>
          Play a friend
        </Button>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onJoinCode(trimmed)
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            className="h-14 w-full rounded-xl bg-surface-2 px-4 text-lg tracking-widest text-text uppercase placeholder:tracking-normal placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          />
          <Button type="submit" size="lg" variant="secondary" disabled={!trimmed}>
            Join
          </Button>
        </form>
      </Stack>
    </Stack>
  )
}
