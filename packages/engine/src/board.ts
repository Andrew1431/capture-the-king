import type { Board, Castling, Color, Piece } from './types.js'

export const BOARD_SIZE = 64

/** Column (file) 0-7 (a-h) of a board index. */
export function fileOf(index: number): number {
  return index % 8
}

/** Row 0-7 from the top (row 0 = rank 8) of a board index. */
export function rowOf(index: number): number {
  return Math.floor(index / 8)
}

/** Board rank 1-8 of a board index. */
export function rankOf(index: number): number {
  return 8 - rowOf(index)
}

/** Build a board index from a (row, col) pair; returns -1 if off-board. */
export function rc(row: number, col: number): number {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1
  return row * 8 + col
}

/** Algebraic name of a square, e.g. 0 -> "a8", 60 -> "e1". */
export function squareName(index: number): string {
  const file = String.fromCharCode(97 + fileOf(index))
  return `${file}${rankOf(index)}`
}

/** Parse an algebraic square name into a board index, e.g. "e1" -> 60. */
export function squareIndex(name: string): number {
  const file = name.charCodeAt(0) - 97
  const rank = Number(name[1])
  return rc(8 - rank, file)
}

const BACK_RANK: Piece['t'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']

/** The standard starting position. */
export function initialBoard(): Board {
  const board: Board = new Array(BOARD_SIZE).fill(null)
  for (let file = 0; file < 8; file++) {
    board[rc(0, file)] = { t: BACK_RANK[file], c: 'b' } // rank 8
    board[rc(1, file)] = { t: 'p', c: 'b' } // rank 7
    board[rc(6, file)] = { t: 'p', c: 'w' } // rank 2
    board[rc(7, file)] = { t: BACK_RANK[file], c: 'w' } // rank 1
  }
  return board
}

export function initialCastling(): Castling {
  return { wk: true, wq: true, bk: true, bq: true }
}

export function cloneBoard(board: Board): Board {
  return board.slice()
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}
