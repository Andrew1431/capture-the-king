import type { Move } from '@ctk/engine'
import type { GameState } from '@ctk/engine'

/** A seated player. `socketId` is null while the player is disconnected. */
export interface Seat {
  uid: string
  name: string
  socketId: string | null
}

/**
 * Server-side chess clock for a timed game. `w`/`b` are the milliseconds banked for
 * each side; the side to move is charged `now - turnStartedAt` on top of its banked
 * value. null on a GameRecord means an untimed (private) game.
 */
export interface Clock {
  w: number
  b: number
  /** When the current turn's clock started ticking (last move, or game start). */
  turnStartedAt: number
}

export interface GameRecord {
  id: string
  players: { w: Seat; b: Seat }
  state: GameState
  lastMove: Move | null
  /** Every move applied, in order — the full replayable history of the game. */
  moves: Move[]
  /** Chess clock for timed (public) games; null for untimed (private) games. */
  clock: Clock | null
  createdAt: number
}

export interface QueueEntry {
  uid: string
  name: string
  socketId: string
}

/** An open private room waiting for a friend to join by code. */
export interface InviteRoom {
  code: string
  host: QueueEntry
  createdAt: number
}

/** Result of atomically claiming an invite room to start a game. */
export type InviteClaim =
  | { ok: true; room: InviteRoom }
  | { ok: false; reason: 'not-found' | 'expired' }

/** How long an unclaimed invite code stays valid. */
export const INVITE_TTL_MS = 15 * 60 * 1000

/**
 * All shared state goes through this interface. The in-memory implementation backs
 * single-instance / micro-VM mode; a Redis-backed one (M7) slots in unchanged.
 * Methods are async so the Redis swap needs no call-site changes.
 */
export interface GameStore {
  // Matchmaking queue (FIFO)
  queueJoin(entry: QueueEntry): Promise<void>
  queueLeaveByUid(uid: string): Promise<void>
  /** Atomically remove and return the first two distinct waiting players, or null. */
  queueShiftPair(): Promise<[QueueEntry, QueueEntry] | null>
  queuePosition(uid: string): Promise<number>

  // Private invite rooms
  inviteCreate(room: InviteRoom): Promise<void>
  inviteGet(code: string): Promise<InviteRoom | undefined>
  /** Atomically remove and return a non-expired room, or report why it failed. */
  inviteClaim(code: string): Promise<InviteClaim>
  inviteDeleteByHost(uid: string): Promise<void>

  // Live games
  createGame(record: GameRecord): Promise<void>
  getGame(id: string): Promise<GameRecord | undefined>
  saveGame(record: GameRecord): Promise<void>
  deleteGame(id: string): Promise<void>
  findActiveGameByUid(uid: string): Promise<GameRecord | undefined>
}

export class MemoryStore implements GameStore {
  private queue: QueueEntry[] = []
  private games = new Map<string, GameRecord>()
  private invites = new Map<string, InviteRoom>()

  async queueJoin(entry: QueueEntry): Promise<void> {
    this.queue = this.queue.filter((e) => e.uid !== entry.uid)
    this.queue.push(entry)
  }

  async queueLeaveByUid(uid: string): Promise<void> {
    this.queue = this.queue.filter((e) => e.uid !== uid)
  }

  async queueShiftPair(): Promise<[QueueEntry, QueueEntry] | null> {
    if (this.queue.length < 2) return null
    const a = this.queue.shift()!
    const b = this.queue.shift()!
    return [a, b]
  }

  async queuePosition(uid: string): Promise<number> {
    const i = this.queue.findIndex((e) => e.uid === uid)
    return i < 0 ? 0 : i + 1
  }

  async inviteCreate(room: InviteRoom): Promise<void> {
    this.invites.set(room.code, room)
  }

  async inviteGet(code: string): Promise<InviteRoom | undefined> {
    return this.invites.get(code)
  }

  // No `await` inside, so this whole body runs atomically per call: concurrent
  // joiners can't both claim the same room (the loser sees 'not-found').
  async inviteClaim(code: string): Promise<InviteClaim> {
    const room = this.invites.get(code)
    if (!room) return { ok: false, reason: 'not-found' }
    if (Date.now() - room.createdAt > INVITE_TTL_MS) {
      this.invites.delete(code)
      return { ok: false, reason: 'expired' }
    }
    this.invites.delete(code)
    return { ok: true, room }
  }

  async inviteDeleteByHost(uid: string): Promise<void> {
    for (const [code, room] of this.invites) {
      if (room.host.uid === uid) this.invites.delete(code)
    }
  }

  async createGame(record: GameRecord): Promise<void> {
    this.games.set(record.id, record)
  }

  async getGame(id: string): Promise<GameRecord | undefined> {
    return this.games.get(id)
  }

  async saveGame(record: GameRecord): Promise<void> {
    this.games.set(record.id, record)
  }

  async deleteGame(id: string): Promise<void> {
    this.games.delete(id)
  }

  async findActiveGameByUid(uid: string): Promise<GameRecord | undefined> {
    for (const game of this.games.values()) {
      if (game.state.status !== 'active') continue
      if (game.players.w.uid === uid || game.players.b.uid === uid) return game
    }
    return undefined
  }
}
