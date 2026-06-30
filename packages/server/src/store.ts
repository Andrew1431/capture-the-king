import type { Move } from '@ctk/engine'
import type { GameState } from '@ctk/engine'

/** A seated player. `socketId` is null while the player is disconnected. */
export interface Seat {
  uid: string
  name: string
  socketId: string | null
}

export interface GameRecord {
  id: string
  players: { w: Seat; b: Seat }
  state: GameState
  lastMove: Move | null
  createdAt: number
}

export interface QueueEntry {
  uid: string
  name: string
  socketId: string
}

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
