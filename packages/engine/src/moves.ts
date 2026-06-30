import { fileOf, rc, rowOf } from './board.js'
import type { Board, Castling, Color, Ghost, Move, PieceType } from './types.js'

type Vec = readonly [number, number]

const ROOK_DIRS: readonly Vec[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]
const BISHOP_DIRS: readonly Vec[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]
const KING_DIRS: readonly Vec[] = [...ROOK_DIRS, ...BISHOP_DIRS]
const KNIGHT_HOPS: readonly Vec[] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
]

const PROMO_TYPES: readonly PieceType[] = ['q', 'r', 'b', 'n']

/** Is `square` a king-echo ghost capturable by a piece of color `mover`? */
function ghostHit(ghost: Ghost | undefined, mover: Color, square: number): boolean {
  return !!ghost && ghost.color !== mover && ghost.squares.includes(square)
}

/**
 * Pseudo-legal moves for the single piece on `from`. No king-safety filtering:
 * pins do not exist and kings may move into attacked squares. The optional
 * `ghost` makes king-echo squares behave as a capturable enemy king for `mover`.
 */
export function generatePieceMoves(
  board: Board,
  from: number,
  castling: Castling,
  enPassant: number | null,
  ghost?: Ghost,
): Move[] {
  const piece = board[from]
  if (!piece) return []
  const moves: Move[] = []
  const mover = piece.c

  switch (piece.t) {
    case 'p':
      pawnMoves(board, from, mover, enPassant, ghost, moves)
      break
    case 'n':
      hopMoves(board, from, mover, KNIGHT_HOPS, ghost, moves)
      break
    case 'k':
      hopMoves(board, from, mover, KING_DIRS, ghost, moves)
      castleMoves(board, from, mover, castling, moves)
      break
    case 'b':
      slideMoves(board, from, mover, BISHOP_DIRS, ghost, moves)
      break
    case 'r':
      slideMoves(board, from, mover, ROOK_DIRS, ghost, moves)
      break
    case 'q':
      slideMoves(board, from, mover, KING_DIRS, ghost, moves)
      break
  }
  return moves
}

function addCapture(
  board: Board,
  mover: Color,
  from: number,
  to: number,
  ghost: Ghost | undefined,
  moves: Move[],
): 'empty' | 'captured' | 'blocked' {
  const occupant = board[to]
  if (occupant) {
    if (occupant.c === mover) return 'blocked'
    moves.push({ from, to, captured: ghostHit(ghost, mover, to) ? 'k' : occupant.t })
    return 'captured'
  }
  if (ghostHit(ghost, mover, to)) {
    moves.push({ from, to, captured: 'k' })
    return 'captured'
  }
  moves.push({ from, to })
  return 'empty'
}

function slideMoves(
  board: Board,
  from: number,
  mover: Color,
  dirs: readonly Vec[],
  ghost: Ghost | undefined,
  moves: Move[],
): void {
  const row = rowOf(from)
  const col = fileOf(from)
  for (const [dr, dc] of dirs) {
    let r = row + dr
    let c = col + dc
    let to = rc(r, c)
    while (to >= 0) {
      const result = addCapture(board, mover, from, to, ghost, moves)
      if (result !== 'empty') break
      r += dr
      c += dc
      to = rc(r, c)
    }
  }
}

function hopMoves(
  board: Board,
  from: number,
  mover: Color,
  hops: readonly Vec[],
  ghost: Ghost | undefined,
  moves: Move[],
): void {
  const row = rowOf(from)
  const col = fileOf(from)
  for (const [dr, dc] of hops) {
    const to = rc(row + dr, col + dc)
    if (to >= 0) addCapture(board, mover, from, to, ghost, moves)
  }
}

function pawnMoves(
  board: Board,
  from: number,
  mover: Color,
  enPassant: number | null,
  ghost: Ghost | undefined,
  moves: Move[],
): void {
  const row = rowOf(from)
  const col = fileOf(from)
  const dir = mover === 'w' ? -1 : 1 // white moves up (toward row 0)
  const startRow = mover === 'w' ? 6 : 1
  const promoRow = mover === 'w' ? 0 : 7

  // Forward push
  const one = rc(row + dir, col)
  if (one >= 0 && !board[one]) {
    pushPawnMove(from, one, row + dir === promoRow, undefined, moves)
    // Double push
    if (row === startRow) {
      const two = rc(row + 2 * dir, col)
      if (two >= 0 && !board[two]) moves.push({ from, to: two })
    }
  }

  // Diagonal captures (incl. en passant and ghost)
  for (const dc of [-1, 1]) {
    const to = rc(row + dir, col + dc)
    if (to < 0) continue
    const occupant = board[to]
    if (occupant && occupant.c !== mover) {
      const captured = ghostHit(ghost, mover, to) ? 'k' : occupant.t
      pushPawnMove(from, to, row + dir === promoRow, captured, moves)
    } else if (!occupant && ghostHit(ghost, mover, to)) {
      pushPawnMove(from, to, row + dir === promoRow, 'k', moves)
    } else if (!occupant && enPassant !== null && to === enPassant) {
      moves.push({ from, to, flags: 'ep', captured: 'p' })
    }
  }
}

function pushPawnMove(
  from: number,
  to: number,
  promotion: boolean,
  captured: PieceType | undefined,
  moves: Move[],
): void {
  if (promotion) {
    for (const promo of PROMO_TYPES) {
      moves.push({ from, to, flags: 'promo', promo, ...(captured ? { captured } : {}) })
    }
  } else {
    moves.push({ from, to, ...(captured ? { captured } : {}) })
  }
}

function castleMoves(
  board: Board,
  from: number,
  mover: Color,
  castling: Castling,
  moves: Move[],
): void {
  // King must be on its home square for castling to be coherent.
  const home = mover === 'w' ? 60 : 4
  if (from !== home) return
  const kingSide = mover === 'w' ? castling.wk : castling.bk
  const queenSide = mover === 'w' ? castling.wq : castling.bq

  // King-side: squares between king and h-rook (f, g) must be empty.
  if (kingSide && !board[home + 1] && !board[home + 2]) {
    moves.push({ from, to: home + 2, flags: 'k' })
  }
  // Queen-side: squares between king and a-rook (b, c, d) must be empty.
  if (queenSide && !board[home - 1] && !board[home - 2] && !board[home - 3]) {
    moves.push({ from, to: home - 2, flags: 'q' })
  }
}

/** All pseudo-legal moves for `color`. */
export function generateAllMoves(
  board: Board,
  color: Color,
  castling: Castling,
  enPassant: number | null,
  ghost?: Ghost,
): Move[] {
  const moves: Move[] = []
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (piece && piece.c === color) {
      moves.push(...generatePieceMoves(board, i, castling, enPassant, ghost))
    }
  }
  return moves
}

/**
 * Find the pseudo-legal move matching `from`/`to` (and `promo` when promoting).
 * Returns the fully-populated Move (flags/captured) or null if not legal.
 */
export function findMove(
  board: Board,
  from: number,
  to: number,
  castling: Castling,
  enPassant: number | null,
  promo?: PieceType,
  ghost?: Ghost,
): Move | null {
  const candidates = generatePieceMoves(board, from, castling, enPassant, ghost)
  const matches = candidates.filter((m) => m.to === to)
  if (matches.length === 0) return null
  if (matches[0].flags === 'promo') {
    return matches.find((m) => m.promo === (promo ?? 'q')) ?? null
  }
  return matches[0]
}
