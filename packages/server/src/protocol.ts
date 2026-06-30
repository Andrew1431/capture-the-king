import type { GameState, GameStatus, Move, PieceType } from '@ctk/engine'

/** What a winner/end looks like to clients. */
export type GameOverReason = 'king-captured' | 'resign' | 'stalemate' | 'draw' | 'abandon'

/** A player's public identity in a game. */
export interface PlayerInfo {
  uid: string
  name: string
}

/** Full snapshot sent on join/start and after every move (the board is tiny). */
export interface GameSnapshot {
  gameId: string
  /** The seat this client occupies. */
  color: 'w' | 'b'
  players: { w: PlayerInfo; b: PlayerInfo }
  state: GameState
  lastMove: Move | null
}

export interface ClientToServerEvents {
  // Public matchmaking
  'queue:join': () => void
  'queue:leave': () => void

  // Private invite-code matches
  'invite:create': (ack: (res: { code: string }) => void) => void
  'invite:cancel': (payload: { code: string }) => void
  'invite:join': (payload: { code: string }, ack: (res: InviteJoinResult) => void) => void

  // In-game
  move: (payload: { from: number; to: number; promo?: PieceType }) => void
  resign: () => void
  'rejoin': (payload: { gameId: string }) => void
}

export interface ServerToClientEvents {
  'queue:waiting': (payload: { position: number }) => void
  'invite:waiting': (payload: { code: string }) => void
  'game:start': (snapshot: GameSnapshot) => void
  state: (payload: { state: GameState; lastMove: Move | null }) => void
  'game:over': (payload: { winner: 'w' | 'b' | null; reason: GameOverReason; status: GameStatus }) => void
  'error:msg': (payload: { message: string }) => void
}

export type InviteJoinResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'expired' | 'full' }

/** Per-socket data the server attaches after auth (M3). */
export interface SocketData {
  uid: string
  name: string
}

export interface InterServerEvents {
  ping: () => void
}
