import { useEffect, useMemo, useState } from 'react'
import { movesFrom, type PieceType } from '@ctk/engine'
import { Board } from '../board/Board'
import { GLYPH } from '../board/pieces'
import type { GameSession } from '../net/useGameSession'
import { Button, Card, Heading, Modal, Stack, Text } from '../ui'

const PROMO_OPTIONS: PieceType[] = ['q', 'r', 'b', 'n']

interface GameViewProps {
  session: GameSession
}

export function GameView({ session }: GameViewProps) {
  const { game, result, phase, sendMove, resign, newGame } = session
  const [selected, setSelected] = useState<number | null>(null)
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null)

  // Authoritative state changes (opponent moved, our move confirmed) clear selection.
  useEffect(() => {
    setSelected(null)
  }, [game?.state])

  const myTurn = !!game && game.state.turn === game.color && phase === 'playing'

  const targets = useMemo(() => {
    if (!game || selected == null) return []
    return movesFrom(game.state, selected)
  }, [game, selected])

  if (!game) return null

  const targetSquares = new Set(targets.map((m) => m.to))
  const opponent = game.color === 'w' ? game.players.b : game.players.w

  function onSquareClick(index: number) {
    if (!myTurn || !game) return
    const piece = game.state.board[index]

    if (selected == null) {
      if (piece && piece.c === game.color) setSelected(index)
      return
    }
    if (index === selected) {
      setSelected(null)
      return
    }
    if (piece && piece.c === game.color) {
      setSelected(index)
      return
    }
    const move = targets.find((m) => m.to === index)
    if (!move) {
      setSelected(null)
      return
    }
    if (move.flags === 'promo') {
      setPromo({ from: selected, to: index })
      return
    }
    sendMove(selected, index)
    setSelected(null)
  }

  function choosePromo(pt: PieceType) {
    if (!promo) return
    sendMove(promo.from, promo.to, pt)
    setPromo(null)
    setSelected(null)
  }

  return (
    <Stack gap={5}>
      <Stack direction="row" justify="between" align="center">
        <Stack gap={1}>
          <Text size="sm" tone="muted">
            vs {opponent.name}
          </Text>
          <Text className="font-semibold">
            You are {game.color === 'w' ? 'White' : 'Black'}
          </Text>
        </Stack>
        <TurnPill myTurn={myTurn} active={phase === 'playing'} />
      </Stack>

      <Board
        state={game.state}
        flipped={game.color === 'b'}
        selected={selected}
        targets={targetSquares}
        lastMove={game.lastMove}
        onSquareClick={onSquareClick}
        interactive={myTurn}
      />

      <Stack direction="row" justify="between" align="center">
        <Button variant="ghost" size="sm" onClick={resign} disabled={phase !== 'playing'}>
          Resign
        </Button>
        <Text size="sm" tone="muted">
          {game.players.w.name} (W) vs {game.players.b.name} (B)
        </Text>
      </Stack>

      {promo && (
        <Modal onClose={() => setPromo(null)}>
          <Card>
            <Stack gap={4}>
              <Heading level={3}>Promote to…</Heading>
              <Stack direction="row" gap={2} justify="between">
                {PROMO_OPTIONS.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => choosePromo(pt)}
                    className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 text-4xl text-zinc-50 transition-colors hover:bg-border"
                  >
                    {GLYPH[pt]}
                  </button>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Modal>
      )}

      {phase === 'over' && result && (
        <Modal>
          <Card>
            <Stack gap={4} align="center" className="text-center">
              <OverMessage myColor={game.color} winner={result.winner} reason={result.reason} />
              <Button block onClick={newGame}>
                Play again
              </Button>
            </Stack>
          </Card>
        </Modal>
      )}
    </Stack>
  )
}

function TurnPill({ myTurn, active }: { myTurn: boolean; active: boolean }) {
  if (!active) return null
  return (
    <span
      className={
        myTurn
          ? 'rounded-full bg-brand px-3 py-1 text-sm font-semibold text-bg'
          : 'rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted'
      }
    >
      {myTurn ? 'Your move' : 'Their move'}
    </span>
  )
}

function OverMessage({
  myColor,
  winner,
  reason,
}: {
  myColor: 'w' | 'b'
  winner: 'w' | 'b' | null
  reason: string
}) {
  const title = winner == null ? 'Draw' : winner === myColor ? 'You win!' : 'You lose'
  const detail =
    reason === 'king-captured'
      ? winner === myColor
        ? 'You captured the enemy king.'
        : 'Your king was captured.'
      : reason === 'resign'
        ? winner === myColor
          ? 'Your opponent resigned.'
          : 'You resigned.'
        : reason === 'stalemate'
          ? 'Stalemate — no legal moves.'
          : 'Game over.'
  return (
    <Stack gap={1} align="center">
      <Heading level={2}>{title}</Heading>
      <Text tone="muted">{detail}</Text>
    </Stack>
  )
}
