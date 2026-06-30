import type { Color, PieceType } from '@ctk/engine'

import bB from './pieces-svg/bB.svg'
import bK from './pieces-svg/bK.svg'
import bN from './pieces-svg/bN.svg'
import bP from './pieces-svg/bP.svg'
import bQ from './pieces-svg/bQ.svg'
import bR from './pieces-svg/bR.svg'
import wB from './pieces-svg/wB.svg'
import wK from './pieces-svg/wK.svg'
import wN from './pieces-svg/wN.svg'
import wP from './pieces-svg/wP.svg'
import wQ from './pieces-svg/wQ.svg'
import wR from './pieces-svg/wR.svg'

/**
 * Cburnett piece artwork (Lichess/Wikimedia Commons), keyed by color then type.
 * Each SVG is self-colored, so no per-piece CSS tint is needed. See CREDITS.md.
 */
export const PIECE_SVG: Record<Color, Record<PieceType, string>> = {
  w: { k: wK, q: wQ, r: wR, b: wB, n: wN, p: wP },
  b: { k: bK, q: bQ, r: bR, b: bB, n: bN, p: bP },
}
