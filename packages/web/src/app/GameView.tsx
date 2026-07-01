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
  const me = game.color
  const them: Color = me === 'w' ? 'b' : 'w'
  const live = phase === 'playing'

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <Stack gap={3} className="w-full lg:min-w-0 lg:max-w-xl lg:flex-1">
          <PlayerPanel
            name={game.players[them].name}
            color={them}
            isYou={false}
            captured={material.captured[them]}
            advantage={material.advantage[them]}
            clockMs={clock ? clock[them] : null}
            clockRunning={clock?.running === them}
            toMove={live && game.state.turn === them}
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

          <PlayerPanel
            name={game.players[me].name}
            color={me}
            isYou
            captured={material.captured[me]}
            advantage={material.advantage[me]}
            clockMs={clock ? clock[me] : null}
            clockRunning={clock?.running === me}
            toMove={myTurn}
          />

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={resign} disabled={!live}>
              Resign
            </Button>
            <Text size="sm" tone="muted" className="font-mono">
              {game.players.w.name} · W vs B · {game.players.b.name}
            </Text>
          </div>
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
                    className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-inset ring-border transition-colors hover:bg-surface hover:ring-brand/50"
                  >
                    <img
                      src={PIECE_SVG[game.color][pt]}
                      alt={pt}
                      draggable={false}
                      className="h-11 w-11"
                    />
                  </button>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Modal>
      )}

      {phase === 'over' && result && (
        <OverModal myColor={game.color} winner={result.winner} reason={result.reason} onAgain={newGame} />
      )}
    </Stack>
  )
}

/**
 * One competitor's strip: crowned medallion, name, captured material and clock.
 * The whole panel lights gold on the side to move, and "you" carry a standing gold
 * accent — so whose turn it is and whose clock is ticking are never in doubt.
 */
function PlayerPanel({
  name,
  color,
  isYou,
  captured,
  advantage,
  clockMs,
  clockRunning,
  toMove,
}: {
  name: string
  color: Color
  isYou: boolean
  captured: PieceType[]
  advantage: number
  clockMs: number | null
  clockRunning: boolean
  toMove: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-300',
        toMove
          ? 'border-brand/50 bg-surface shadow-[0_0_0_1px_rgba(232,184,75,0.25),0_10px_30px_-16px_rgba(232,184,75,0.7)]'
          : 'border-border bg-surface/50',
      )}
    >
      <Medallion color={color} toMove={toMove} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-text">{name}</span>
          {isYou && (
            <span className="rounded-full bg-brand/15 px-1.5 py-0.5 font-display text-[0.6rem] font-bold tracking-widest text-brand uppercase">
              You
            </span>
          )}
        </div>
        <CapturedTray pieces={captured} color={color} advantage={advantage} />
      </div>

      <Clock ms={clockMs} running={clockRunning} />
    </div>
  )
}

/** Crowned color token — parchment for White, ink for Black — haloed when to move. */
function Medallion({ color, toMove }: { color: Color; toMove: boolean }) {
  return (
    <div
      className={cn(
        'relative grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 transition-all duration-300',
        color === 'w' ? 'bg-board-light ring-black/10' : 'bg-surface-2 ring-white/10',
        toMove && 'ring-2 ring-brand shadow-[0_0_16px_-2px_rgba(232,184,75,0.8)]',
      )}
    >
      <img src={PIECE_SVG[color].k} alt="" draggable={false} className="h-7 w-7" />
      {toMove && (
        <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-surface bg-brand" />
      )}
    </div>
  )
}

/**
 * Row of pieces this player has captured, with a +N material-advantage badge.
 * Reserves height even when empty so the panel never jumps as pieces fall.
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
    <div className="flex min-h-5 items-center gap-0.5">
      {pieces.map((pt, i) => (
        <img
          key={`${pt}-${i}`}
          src={PIECE_SVG[color][pt]}
          alt={pt}
          draggable={false}
          className="h-4 w-4 opacity-90"
        />
      ))}
      {advantage > 0 && (
        <span className="ml-1 font-mono text-xs font-bold text-brand">+{advantage}</span>
      )}
      {pieces.length === 0 && advantage === 0 && (
        <span className="font-mono text-xs text-muted/50">no captures</span>
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

/**
 * mm:ss readout. A ticking clock reads as a filled gold chip so an active timer is
 * obvious at a glance; the final 30s turn crimson and beat; idle clocks stay quiet.
 */
function Clock({ ms, running }: { ms: number | null; running: boolean }) {
  if (ms == null) return null
  const total = Math.max(0, Math.ceil(ms / 1000))
  const label = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  const urgent = running && total <= 30
  return (
    <span
      className={cn(
        'rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums tracking-tight',
        !running && 'bg-surface-2 text-muted',
        running && !urgent &&
          'bg-gradient-to-b from-brand to-brand-strong text-bg shadow-[0_4px_14px_-6px_rgba(232,184,75,0.9)]',
        urgent && 'animate-heartbeat bg-danger text-white shadow-[0_4px_14px_-6px_rgba(214,73,58,0.9)]',
      )}
    >
      {label}
    </span>
  )
}

/** The end-of-game moment: a regicide gets a wax-seal crown; other ends stay sober. */
function OverModal({
  myColor,
  winner,
  reason,
  onAgain,
}: {
  myColor: 'w' | 'b'
  winner: 'w' | 'b' | null
  reason: string
  onAgain: () => void
}) {
  const won = winner === myColor
  const draw = winner == null
  const regicide = won && reason === 'king-captured'

  const title = draw ? 'Stalemate' : regicide ? 'Regicide' : won ? 'Victory' : 'Defeated'
  const detail =
    reason === 'king-captured'
      ? won
        ? 'You captured the enemy king.'
        : 'Your king was captured.'
      : reason === 'resign'
        ? won
          ? 'Your opponent resigned.'
          : 'You resigned.'
        : reason === 'timeout'
          ? won
            ? 'Your opponent ran out of time.'
            : 'You ran out of time.'
          : reason === 'stalemate'
            ? 'Stalemate — no legal moves.'
            : 'Game over.'

  return (
    <Modal>
      <Card className="overflow-hidden">
        <Stack gap={4} align="center" className="text-center">
          <div className="relative grid place-items-center">
            {(won || draw) && (
              <>
                <span className="animate-bloom absolute h-24 w-24 rounded-full bg-brand/40" />
                <span
                  className="animate-bloom absolute h-24 w-24 rounded-full bg-brand/25"
                  style={{ animationDelay: '0.15s' }}
                />
              </>
            )}
            {/* Wax-seal crown medallion. */}
            <div
              className={cn(
                'animate-seal relative grid h-20 w-20 place-items-center rounded-full ring-2',
                won
                  ? 'bg-gradient-to-b from-brand to-brand-strong ring-brand/60 shadow-[0_10px_30px_-8px_rgba(232,184,75,0.8)]'
                  : draw
                    ? 'bg-surface-2 ring-border'
                    : 'bg-surface-2 ring-danger/40',
              )}
            >
              <svg viewBox="0 0 32 32" className="h-11 w-11" aria-hidden>
                <path
                  d="M5 23L3 10l7 5L16 6l6 9 7-5-2 13z"
                  fill={won ? '#100c1a' : draw ? '#a99fc0' : '#d6493a'}
                />
                <rect
                  x="5"
                  y="24"
                  width="22"
                  height="3.4"
                  rx="1.2"
                  fill={won ? '#100c1a' : draw ? '#a99fc0' : '#d6493a'}
                />
              </svg>
            </div>
          </div>

          <Stack gap={1} align="center">
            <Heading level={2} className={cn(regicide && 'text-brand')}>
              {title}
            </Heading>
            <Text tone="muted">{detail}</Text>
          </Stack>

          <Button block onClick={onAgain}>
            Play again
          </Button>
        </Stack>
      </Card>
    </Modal>
  )
}
