import type { PieceType } from '@ctk/engine'

/** Filled Unicode chess glyphs; color is applied via CSS per piece color. */
export const GLYPH: Record<PieceType, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}
