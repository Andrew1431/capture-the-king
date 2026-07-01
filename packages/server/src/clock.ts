import type { GameOverPayload } from '@ctk/protocol'
import { flagPayload, remainingForTurn } from './game.js'
import type { AppServer } from './matchmaking.js'
import { persistFinishedGame } from './persistence.js'
import type { GameRecord, GameStore } from './store.js'

// Game-scoped flag-fall timers, keyed by game id. These live independently of any
// socket, so a player still flags (and loses) even while their tab is disconnected.
const flagTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Cancel a game's pending flag-fall timer, if any. */
export function clearFlag(gameId: string): void {
  const timer = flagTimers.get(gameId)
  if (timer) {
    clearTimeout(timer)
    flagTimers.delete(gameId)
  }
}

/**
 * End a game: notify the room, persist (best-effort), and tear it down — including
 * its flag timer. Lives here (not in a socket handler) so a flag-fall can invoke it.
 */
export async function endGame(
  io: AppServer,
  store: GameStore,
  game: GameRecord,
  payload: GameOverPayload,
): Promise<void> {
  clearFlag(game.id)
  io.to(game.id).emit('game:over', payload)
  // Persist before teardown; never let a Firestore error abort the game-over flow.
  try {
    await persistFinishedGame(game, payload)
  } catch (err) {
    console.error(`failed to persist game ${game.id}:`, err)
  }
  await store.deleteGame(game.id)
  io.in(game.id).socketsLeave(game.id)
}

/**
 * (Re)arm the flag-fall timer for a timed game so the side to move loses when their
 * clock hits zero. No-op for untimed or already-finished games. Call after every
 * move (and at game start) — it cancels any prior timer first.
 */
export function armFlag(io: AppServer, store: GameStore, game: GameRecord): void {
  clearFlag(game.id)
  if (!game.clock || game.state.status !== 'active') return
  const remaining = Math.max(0, remainingForTurn(game))
  flagTimers.set(
    game.id,
    setTimeout(() => void fireFlag(io, store, game.id), remaining),
  )
}

/** Fire when a clock is due to hit zero: re-check against fresh state, then end. */
async function fireFlag(io: AppServer, store: GameStore, gameId: string): Promise<void> {
  flagTimers.delete(gameId)
  const game = await store.getGame(gameId)
  if (!game || !game.clock || game.state.status !== 'active') return
  // Guard against a move that landed without re-arming: if time remains, re-arm.
  if (remainingForTurn(game) > 0) return armFlag(io, store, game)
  await endGame(io, store, game, flagPayload(game))
}
