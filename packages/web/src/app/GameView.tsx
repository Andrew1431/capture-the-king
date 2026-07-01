import { useEffect, useMemo, useRef, useState } from 'react'
import { movesFrom, type Board as BoardArray, type Color, type PieceType } from '@ctk/engine'
import type { ClockState } from '@ctk/protocol'
import { Board } from '../board/Board'
import { PIECE_SVG } from '../board/pieces'
import { cn } from '../lib/cn'
import type { GameSession } from '../net/useGameSession'
import { Button, Card, Heading, Modal, Stack, Text } from '../ui'
import { MoveHistory } from './MoveHistory'

const PROMO_OPTIONS: PieceType[] = ['q', 'r', 'b', 'n']

// Tray order: pawns first, up to queen (kings are never captured into the tray).
const TRAY_ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q']
const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const STARTING_COUNT: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }

interface Material {
  /** Pieces of each color that have been captured (taken off the board). */
  captured: Record<Color, PieceType[]>
  /** How far each color is ahead on material; 0 unless strictly ahead. */
  advantage: Record<Color, number>
}

/** Derive captured pieces and the material lead from the current board. */
function deriveMaterial(board: BoardArray): Material {
  const remaining: Record<Color, Record<PieceType, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  }
  for (const sq of board) if (sq) remaining[sq.c][sq.t]++

  const captured: Record<Color, PieceType[]> = { w: [], b: [] }
  const score: Record<Color, number> = { w: 0, b: 0 }
  for (const color of ['w', 'b'] as Color[]) {
    for (const t of TRAY_ORDER) {
      const missing = STARTING_COUNT[t] - remaining[color][t]
      for (let i = 0; i < missing; i++) captured[color].push(t)
      score[color] += remaining[color][t] * PIECE_VALUE[t]
    }
  }
  return {
    captured,
    advantage: { w: Math.max(0, score.w - score.b), b: Math.max(0, score.b - score.w) },
  }
}

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

  const clock = useLiveClock(game?.clock ?? null)
  const myTurn = !!game && game.state.turn === game.color && phase === 'playing'

  const targets = useMemo(() => {
    if (!game || selected == null) return []
    return movesFrom(game.state, selected)
  }, [game, selected])

  const material = useMemo(
    () => (game ? deriveMaterial(game.state.board) : null),
    [game?.state.board],
  )

  if (!game || !material) return null

  const targetSquares = new Set(targets.map((m) => m.to))
  const opponent = game.color === 'w' ? game.players.b : game.players.w

  // Attempt a move from->to; returns false if no legal move connects them.
  function tryMove(from: number, to: number): boolean {
    if (!myTurn || !game) return false
    const move = movesFrom(game.state, from).find((m) => m.to === to)
    if (!move) return false
    if (move.flags === 'promo') {
      setPromo({ from, to })
      return true
    }
    sendMove(from, to)
    setSelected(null)
    return true
  }

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
    if (!tryMove(selected, index)) setSelected(null)
  }

  // Illegal drops leave the selection intact so its move hints stay visible.
  function onDragMove(from: number, to: number) {
    tryMove(from, to)
  }

  function choosePromo(pt: PieceType) {
    if (!promo) return
    sendMove(promo.from, promo.to, pt)
    setPromo(null)
    setSelected(null)
  }

  return (
    <Stack gap={5}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <Stack gap={5} className="w-full lg:min-w-0 lg:max-w-xl lg:flex-1">
          <Stack direction="row" justify="between" align="center">
            <Stack gap={1}>
              <Text size="sm" tone="muted">
                vs {opponent.name}
              </Text>
              <Text className="font-semibold">
                You are {game.color === 'w' ? 'White' : 'Black'}
              </Text>
            </Stack>
            <Stack direction="row" align="center" gap={2}>
              {clock && (
                <Clock ms={clock[game.color === 'w' ? 'b' : 'w']} running={clock.running === (game.color === 'w' ? 'b' : 'w')} />
              )}
              <TurnPill myTurn={myTurn} active={phase === 'playing'} />
            </Stack>
          </Stack>

          <CapturedTray
            pieces={material.captured[game.color]}
            color={game.color}
            advantage={material.advantage[game.color === 'w' ? 'b' : 'w']}
          />

          <Board
            state={game.state}
            flipped={game.color === 'b'}
            selected={selected}
            targets={targetSquares}
            lastMove={game.lastMove}
            onSquareClick={onSquareClick}
            onSelect={setSelected}
            onDragMove={onDragMove}
            interactive={myTurn}
          />

          <CapturedTray
            pieces={material.captured[game.color === 'w' ? 'b' : 'w']}
            color={game.color === 'w' ? 'b' : 'w'}
            advantage={material.advantage[game.color]}
          />

          <Stack direction="row" justify="between" align="center">
            <Button variant="ghost" size="sm" onClick={resign} disabled={phase !== 'playing'}>
              Resign
            </Button>
            <Stack direction="row" align="center" gap={3}>
              <Text size="sm" tone="muted" className="hidden sm:block">
                {game.players.w.name} (W) vs {game.players.b.name} (B)
              </Text>
              {clock && <Clock ms={clock[game.color]} running={clock.running === game.color} />}
            </Stack>
          </Stack>
        </Stack>

        <MoveHistory moves={game.moves} className="lg:w-72 lg:shrink-0" />
      </div>

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
                    className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 transition-colors hover:bg-border"
                  >
                    <img src={PIECE_SVG[game.color][pt]} alt={pt} draggable={false} className="h-11 w-11" />
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

/**
 * Row of pieces one side has captured, with a +N material-advantage badge.
 * Reserves height even when empty so the board never shifts as pieces fall.
 */
function CapturedTray({
  pieces,
  color,
  advantage,
}: {
  pieces: PieceType[]
  color: Color
  advantage: number
}) {
  return (
    <div className="flex min-h-5 items-center gap-1">
      {pieces.map((pt, i) => (
        <img
          key={`${pt}-${i}`}
          src={PIECE_SVG[color][pt]}
          alt={pt}
          draggable={false}
          className="h-5 w-5"
        />
      ))}
      {advantage > 0 && (
        <span className="ml-1 text-sm font-semibold text-muted">+{advantage}</span>
      )}
    </div>
  )
}

/**
 * Extrapolate a server clock snapshot locally: the `running` side counts down from
 * the moment its snapshot was received. Re-renders on a 250ms tick only while a side
 * is actually running; the server remains authoritative for the flag-fall itself.
 */
function useLiveClock(clock: ClockState | null): ClockState | null {
  const [, tick] = useState(0)
  const receivedAt = useRef(Date.now())

  useEffect(() => {
    receivedAt.current = Date.now()
    tick((n) => n + 1)
  }, [clock])

  useEffect(() => {
    if (!clock || clock.running == null) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [clock])

  if (!clock || clock.running == null) return clock
  const elapsed = Date.now() - receivedAt.current
  return {
    w: clock.running === 'w' ? Math.max(0, clock.w - elapsed) : clock.w,
    b: clock.running === 'b' ? Math.max(0, clock.b - elapsed) : clock.b,
    running: clock.running,
  }
}

/** mm:ss clock chip; gold while running, red under 30s, muted while idle. */
function Clock({ ms, running }: { ms: number; running: boolean }) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const label = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  const urgent = running && total <= 30
  return (
    <span
      className={cn(
        'rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums',
        !running && 'text-muted',
        running && !urgent && 'text-brand',
        urgent && 'text-danger',
      )}
    >
      {label}
    </span>
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
        : reason === 'timeout'
          ? winner === myColor
            ? 'Your opponent ran out of time.'
            : 'You ran out of time.'
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
