import type { Color, GameState, GameStatus, Move, PieceType } from '@ctk/engine'

/** Why a game ended, surfaced to clients. */
export type GameOverReason = 'king-captured' | 'resign' | 'stalemate' | 'draw' | 'abandon'

/** A player's public identity within a game. */
export interface PlayerInfo {
  uid: string
  name: string
}

/** Full snapshot sent on game start / rejoin (the board is tiny, so it ships whole). */
export interface GameSnapshot {
  gameId: string
  /** The seat this client occupies. */
  color: Color
  players: { w: PlayerInfo; b: PlayerInfo }
  state: GameState
  lastMove: Move | null
  /** Every move played so far, in order — seeds the client's move history. */
  moves: Move[]
}

export interface MovePayload {
  from: number
  to: number
  promo?: PieceType
}

export interface GameOverPayload {
  winner: Color | null
  reason: GameOverReason
  status: GameStatus
}

export type InviteJoinResult = { ok: true } | { ok: false; reason: 'not-found' | 'expired' | 'full' }

export interface ClientToServerEvents {
  // Public matchmaking
  'queue:join': () => void
  'queue:leave': () => void

  // Private invite-code matches (M4)
  'invite:create': (ack: (res: { code: string }) => void) => void
  'invite:cancel': (payload: { code: string }) => void
  'invite:join': (payload: { code: string }, ack: (res: InviteJoinResult) => void) => void

  // In-game
  move: (payload: MovePayload) => void
  resign: () => void
}

export interface ServerToClientEvents {
  'queue:waiting': (payload: { position: number }) => void
  'invite:waiting': (payload: { code: string }) => void
  'game:start': (snapshot: GameSnapshot) => void
  state: (payload: { state: GameState; lastMove: Move | null }) => void
  'game:over': (payload: GameOverPayload) => void
  'error:msg': (payload: { message: string }) => void
}

export interface InterServerEvents {
  ping: () => void
}

/** Per-socket data the server attaches on connect, derived from the verified token. */
export interface SocketData {
  uid: string
  name: string
  gameId?: string
}

/** Handshake auth the client sends: a Firebase ID token verified by the server. */
export interface HandshakeAuth {
  token: string
}
