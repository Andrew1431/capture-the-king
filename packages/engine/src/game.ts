import { applyMove } from './apply.js'
import { initialBoard, initialCastling, opposite } from './board.js'
import { findMove, generateAllMoves, generatePieceMoves } from './moves.js'
import type { Board, Castling, Color, Ghost, Move, PieceType } from './types.js'

export type GameStatus = 'active' | 'w-wins' | 'b-wins' | 'draw'

/** Full authoritative state of one live game. The board is tiny, so this is sent whole. */
export interface GameState {
  board: Board
  turn: Color
  castling: Castling
  enPassant: number | null
  /** King-echo armed by the last castle, live for exactly the current turn. */
  ghost: Ghost | null
  status: GameStatus
}

export interface MoveResult {
  state: GameState
  move: Move
  kingCaptured: boolean
}

export function initialGameState(): GameState {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: initialCastling(),
    enPassant: null,
    ghost: null,
    status: 'active',
  }
}

/** The ghost is only "live" for the side that did not arm it. */
function activeGhost(state: GameState): Ghost | undefined {
  return state.ghost && state.ghost.color !== state.turn ? state.ghost : undefined
}

/** Pseudo-legal moves for the piece on `from`, respecting the live ghost. */
export function movesFrom(state: GameState, from: number): Move[] {
  const piece = state.board[from]
  if (!piece || piece.c !== state.turn) return []
  return generatePieceMoves(state.board, from, state.castling, state.enPassant, activeGhost(state))
}

/** All pseudo-legal moves for the side to move. */
export function allMoves(state: GameState): Move[] {
  return generateAllMoves(state.board, state.turn, state.castling, state.enPassant, activeGhost(state))
}

/**
 * Validate and apply a move by `from`/`to` (+ promo). Returns the next state, or
 * null if the move is illegal. Advances the turn, manages the king-echo ghost
 * lifecycle, and resolves king-capture / stalemate into `status`.
 */
export function makeMove(
  state: GameState,
  from: number,
  to: number,
  promo?: PieceType,
): MoveResult | null {
  if (state.status !== 'active') return null
  const move = findMove(
    state.board,
    from,
    to,
    state.castling,
    state.enPassant,
    promo,
    activeGhost(state),
  )
  if (!move) return null

  const result = applyMove(state.board, state.castling, state.enPassant, move)
  const nextTurn = opposite(state.turn)

  const next: GameState = {
    board: result.board,
    turn: nextTurn,
    castling: result.castling,
    enPassant: result.enPassant,
    ghost: result.castleGhost, // expires after the opponent's single upcoming turn
    status: 'active',
  }

  if (result.kingCaptured) {
    next.status = state.turn === 'w' ? 'w-wins' : 'b-wins'
  } else if (allMoves(next).length === 0) {
    next.status = 'draw' // no check exists, so zero moves is an unambiguous stalemate/draw
  }

  return { state: next, move, kingCaptured: result.kingCaptured }
}
