/** Player color. White moves toward decreasing board index, Black toward increasing. */
export type Color = 'w' | 'b'

/** Piece type: pawn, knight, bishop, rook, queen, king. */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export interface Piece {
  t: PieceType
  c: Color
}

/** 8x8 board as a flat, length-64 array. Index = (8 - rank) * 8 + file. Index 0 = a8. */
export type Board = (Piece | null)[]

/** Per-side castling rights. Cleared when the king or the relevant rook moves/is captured. */
export interface Castling {
  wk: boolean
  wq: boolean
  bk: boolean
  bq: boolean
}

/**
 * King-echo "ghost" armed when a side castles. For the opponent's next turn only,
 * the listed squares behave as a capturable enemy king. `color` is the castling
 * side (the owner of the ghost king); only the *other* color may capture it.
 */
export interface Ghost {
  color: Color
  squares: number[]
}

/** Castle side ('k'/'q'), en passant ('ep'), or promotion ('promo'). */
export type MoveFlag = 'k' | 'q' | 'ep' | 'promo'

export interface Move {
  from: number
  to: number
  flags?: MoveFlag | null
  promo?: PieceType
  /** Type of piece captured; 'k' when an actual king or a king-echo ghost is taken. */
  captured?: PieceType
}

export interface ApplyResult {
  board: Board
  castling: Castling
  enPassant: number | null
  move: Move
  captured: Piece | null
  kingCaptured: boolean
  /** Armed (origin + pass-over squares) when this move was a castle, else null. */
  castleGhost: Ghost | null
}
