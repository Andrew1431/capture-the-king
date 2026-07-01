import { initialGameState, makeMove } from '@ctk/engine'
import type { Color } from '@ctk/engine'
import type { ClockState, GameOverPayload, GameSnapshot, MovePayload } from '@ctk/protocol'
import { nanoid } from 'nanoid'
import type { Clock, GameRecord, QueueEntry, Seat } from './store.js'

/** Time each side gets on the clock in a timed (public) game: 10 minutes. */
export const CLOCK_MS = 10 * 60 * 1000

const seatToInfo = (seat: Seat) => ({ uid: seat.uid, name: seat.name })

/**
 * Pair two players into a fresh game with randomly-assigned colors. `timed` games
 * (public matchmaking) start a 10:10 chess clock; untimed games (private invites)
 * carry no clock.
 */
export function createGameRecord(a: QueueEntry, b: QueueEntry, timed: boolean): GameRecord {
  const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a]
  const toSeat = (e: QueueEntry): Seat => ({ uid: e.uid, name: e.name, socketId: e.socketId })
  return {
    id: nanoid(10),
    players: { w: toSeat(white), b: toSeat(black) },
    state: initialGameState(),
    lastMove: null,
    moves: [],
    clock: timed ? { w: CLOCK_MS, b: CLOCK_MS, turnStartedAt: Date.now() } : null,
    createdAt: Date.now(),
  }
}

/** Milliseconds left for the side to move, or Infinity for an untimed game. */
export function remainingForTurn(record: GameRecord, now: number = Date.now()): number {
  const c = record.clock
  if (!c) return Infinity
  return c[record.state.turn] - (now - c.turnStartedAt)
}

/** Snapshot the clock for clients: banked values, with the ticking side charged live. */
export function liveClock(record: GameRecord, now: number = Date.now()): ClockState | null {
  const c = record.clock
  if (!c) return null
  if (record.state.status !== 'active') return { w: c.w, b: c.b, running: null }
  const turn = record.state.turn
  const remaining = Math.max(0, c[turn] - (now - c.turnStartedAt))
  return {
    w: turn === 'w' ? remaining : c.w,
    b: turn === 'b' ? remaining : c.b,
    running: turn,
  }
}

/** Game-over payload when the side to move loses on time (flag-fall). */
export function flagPayload(record: GameRecord): GameOverPayload {
  const loser = record.state.turn
  return {
    winner: loser === 'w' ? 'b' : 'w',
    reason: 'timeout',
    status: loser === 'w' ? 'b-wins' : 'w-wins',
  }
}

/** Charge the mover's elapsed time and hand the clock to the opponent. */
function chargeClock(clock: Clock, mover: Color): void {
  const now = Date.now()
  clock[mover] = Math.max(0, clock[mover] - (now - clock.turnStartedAt))
  clock.turnStartedAt = now
}

/** Which seat a uid occupies, or null if they are not in this game. */
export function seatColor(record: GameRecord, uid: string): Color | null {
  if (record.players.w.uid === uid) return 'w'
  if (record.players.b.uid === uid) return 'b'
  return null
}

/** The full snapshot for the player on `color`. */
export function snapshotFor(record: GameRecord, color: Color): GameSnapshot {
  return {
    gameId: record.id,
    color,
    players: { w: seatToInfo(record.players.w), b: seatToInfo(record.players.b) },
    state: record.state,
    lastMove: record.lastMove,
    moves: record.moves,
    clock: liveClock(record),
  }
}

export type MoveOutcome =
  | { error: string }
  | { record: GameRecord; over: GameOverPayload | null }

/** Validate and apply a player's move, mutating the record's state in place. */
export function applyPlayerMove(record: GameRecord, uid: string, payload: MovePayload): MoveOutcome {
  const color = seatColor(record, uid)
  if (!color) return { error: 'You are not a player in this game.' }
  if (record.state.status !== 'active') return { error: 'This game is already over.' }
  if (record.state.turn !== color) return { error: 'It is not your turn.' }

  const result = makeMove(record.state, payload.from, payload.to, payload.promo)
  if (!result) return { error: 'Illegal move.' }

  record.state = result.state
  record.lastMove = result.move
  record.moves.push(result.move)
  // Charge the mover's clock only while the game continues; a game-ending move
  // stops the clock (the result stands regardless of time remaining).
  if (record.clock && record.state.status === 'active') chargeClock(record.clock, color)
  return { record, over: gameOverPayload(record) }
}

/** Build a game-over payload from a finished record, or null if still active. */
export function gameOverPayload(record: GameRecord): GameOverPayload | null {
  const { status } = record.state
  if (status === 'active') return null
  if (status === 'draw') return { winner: null, reason: 'stalemate', status }
  return {
    winner: status === 'w-wins' ? 'w' : 'b',
    reason: 'king-captured',
    status,
  }
}
