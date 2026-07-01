import { useState } from 'react'
import { initialGameState } from '@ctk/engine'
import { Board } from '../board/Board'
import { Button, Eyebrow, Stack, Text, Wordmark } from '../ui'

interface HomeProps {
  onPlay: () => void
  onCreateInvite: () => void
  onJoinCode: (code: string) => void
}

export function Home({ onPlay, onCreateInvite, onJoinCode }: HomeProps) {
  const [code, setCode] = useState('')
  const trimmed = code.trim()

  return (
    <Stack gap={7}>
      <Stack gap={3} align="center" className="pt-2 text-center">
        <Eyebrow>No check · No checkmate</Eyebrow>
        <Wordmark />
        <Text tone="muted" className="max-w-xs">
          Hunt down the enemy king. Take it, and the crown is yours.
        </Text>
      </Stack>

      <Board state={initialGameState()} />

      <Stack gap={3}>
        <Button size="lg" block onClick={onPlay}>
          Play now
        </Button>
        <Button size="lg" variant="secondary" block onClick={onCreateInvite}>
          Challenge a friend
        </Button>

        <div className="flex items-center gap-3 pt-1 text-muted">
          <span className="h-px flex-1 bg-border" />
          <span className="font-display text-[0.6rem] font-semibold tracking-[0.3em] uppercase">
            or join a room
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

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
            placeholder="CODE"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            className="h-14 w-full rounded-xl bg-surface-2 px-4 font-mono text-lg tracking-widest text-text uppercase ring-1 ring-inset ring-border placeholder:tracking-[0.2em] placeholder:text-muted/60 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          />
          <Button type="submit" size="lg" variant="secondary" disabled={!trimmed}>
            Join
          </Button>
        </form>
      </Stack>
    </Stack>
  )
}
