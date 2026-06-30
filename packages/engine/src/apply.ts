import { cloneBoard, fileOf, opposite, rowOf } from './board.js'
import type { ApplyResult, Board, Castling, Ghost, Move, Piece } from './types.js'

/** Rook home squares -> the castling right they govern. */
const ROOK_HOME: Record<number, keyof Castling> = {
  56: 'wq', // a1
  63: 'wk', // h1
  0: 'bq', // a8
  7: 'bk', // h8
}

/**
 * Apply a (pseudo-legal) move and return the resulting state. Pure: the input
 * board is not mutated. Handles captures, en passant, promotion, castling
 * (incl. arming the king-echo ghost) and castling-right/en-passant updates.
 */
export function applyMove(
  board: Board,
  castling: Castling,
  // Part of the spec'd signature; the en-passant target is already encoded in the
  // 'ep' move, so the live target is not re-read here.
  _enPassant: number | null,
  move: Move,
): ApplyResult {
  const next = cloneBoard(board)
  const piece = board[move.from]
  if (!piece) throw new Error(`applyMove: no piece on square ${move.from}`)

  const nextCastling: Castling = { ...castling }
  let captured: Piece | null = null
  let castleGhost: Ghost | null = null

  // Resolve the captured piece (en passant captures off the destination square).
  if (move.flags === 'ep') {
    const capSquare = rowOf(move.from) * 8 + fileOf(move.to)
    captured = board[capSquare]
    next[capSquare] = null
  } else {
    captured = board[move.to]
  }

  // Move the piece.
  next[move.to] = move.flags === 'promo' && move.promo ? { t: move.promo, c: piece.c } : piece
  next[move.from] = null

  // Castling: relocate the rook and arm the king-echo ghost.
  if (move.flags === 'k' || move.flags === 'q') {
    const passOver = move.flags === 'k' ? move.from + 1 : move.from - 1
    const rookFrom = move.flags === 'k' ? move.from + 3 : move.from - 4
    next[passOver] = next[rookFrom]
    next[rookFrom] = null
    castleGhost = { color: piece.c, squares: [passOver, move.from] }
  }

  // King move clears both castling rights for that side.
  if (piece.t === 'k') {
    if (piece.c === 'w') {
      nextCastling.wk = false
      nextCastling.wq = false
    } else {
      nextCastling.bk = false
      nextCastling.bq = false
    }
  }
  // A rook leaving or being captured on its home square clears that right.
  for (const square of [move.from, move.to]) {
    const right = ROOK_HOME[square]
    if (right) nextCastling[right] = false
  }

  // Double pawn push sets the en passant target (the skipped square).
  let nextEnPassant: number | null = null
  if (piece.t === 'p' && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
    nextEnPassant = (move.from + move.to) / 2
  }

  const kingCaptured = move.captured === 'k' || captured?.t === 'k'
  // A king-echo ghost captured on the (empty) origin square has no piece object.
  if (kingCaptured && !captured) {
    captured = { t: 'k', c: opposite(piece.c) }
  }

  return {
    board: next,
    castling: nextCastling,
    enPassant: nextEnPassant,
    move,
    captured,
    kingCaptured,
    castleGhost,
  }
}
