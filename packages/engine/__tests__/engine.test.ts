import { describe, expect, it } from 'vitest'
import {
  applyMove,
  findMove,
  generateAllMoves,
  generatePieceMoves,
  initialBoard,
  initialCastling,
  initialGameState,
  makeMove,
  squareIndex,
  squareName,
  type Board,
  type Ghost,
  type Piece,
} from '../src/index.js'

const sq = squareIndex
const empty = (): Board => new Array(64).fill(null)
const put = (board: Board, name: string, piece: Piece) => {
  board[sq(name)] = piece
}

describe('board model', () => {
  it('initial board has 32 pieces with kings on e1/e8', () => {
    const board = initialBoard()
    expect(board.filter(Boolean)).toHaveLength(32)
    expect(board[sq('e1')]).toEqual({ t: 'k', c: 'w' })
    expect(board[sq('e8')]).toEqual({ t: 'k', c: 'b' })
  })

  it('squareName round-trips with squareIndex', () => {
    expect(squareName(0)).toBe('a8')
    expect(squareName(60)).toBe('e1')
    expect(sq('a8')).toBe(0)
    expect(sq('e1')).toBe(60)
  })
})

describe('move generation', () => {
  it('opening position yields exactly 20 moves for White', () => {
    const board = initialBoard()
    expect(generateAllMoves(board, 'w', initialCastling(), null)).toHaveLength(20)
  })

  it('pawn single and double push; double push sets the en-passant target', () => {
    const board = initialBoard()
    const moves = generatePieceMoves(board, sq('e2'), initialCastling(), null)
    expect(moves.map((m) => m.to).sort()).toEqual([sq('e3'), sq('e4')].sort())

    const double = findMove(board, sq('e2'), sq('e4'), initialCastling(), null)!
    const res = applyMove(board, initialCastling(), null, double)
    expect(res.enPassant).toBe(sq('e3'))
  })

  it('en passant capture removes the passed pawn', () => {
    const board = empty()
    put(board, 'e5', { t: 'p', c: 'w' })
    put(board, 'd5', { t: 'p', c: 'b' })
    const ep = sq('d6')
    const move = findMove(board, sq('e5'), ep, initialCastling(), ep)!
    expect(move.flags).toBe('ep')
    const res = applyMove(board, initialCastling(), ep, move)
    expect(res.board[sq('d5')]).toBeNull()
    expect(res.board[sq('d6')]).toEqual({ t: 'p', c: 'w' })
  })

  it('promotion offers all four pieces and applies the chosen one', () => {
    const board = empty()
    put(board, 'a7', { t: 'p', c: 'w' })
    const moves = generatePieceMoves(board, sq('a7'), initialCastling(), null)
    expect(moves.every((m) => m.flags === 'promo')).toBe(true)
    expect(moves.map((m) => m.promo).sort()).toEqual(['b', 'n', 'q', 'r'])

    const knight = findMove(board, sq('a7'), sq('a8'), initialCastling(), null, 'n')!
    const res = applyMove(board, initialCastling(), null, knight)
    expect(res.board[sq('a8')]).toEqual({ t: 'n', c: 'w' })
  })

  it('knight moves from a corner-blocked opening square', () => {
    const board = initialBoard()
    const moves = generatePieceMoves(board, sq('b1'), initialCastling(), null)
    expect(moves.map((m) => m.to).sort()).toEqual([sq('a3'), sq('c3')].sort())
  })

  it('king may move into an attacked square', () => {
    const board = empty()
    put(board, 'e4', { t: 'k', c: 'w' })
    put(board, 'e8', { t: 'r', c: 'b' }) // attacks the whole e-file
    const moves = generatePieceMoves(board, sq('e4'), initialCastling(), null)
    expect(moves.some((m) => m.to === sq('e5'))).toBe(true)
  })

  it('a "pinned" piece can still move (pins do not exist)', () => {
    const board = empty()
    put(board, 'e1', { t: 'k', c: 'w' })
    put(board, 'e4', { t: 'n', c: 'w' }) // "pinned" along the e-file
    put(board, 'e8', { t: 'r', c: 'b' })
    const moves = generatePieceMoves(board, sq('e4'), initialCastling(), null)
    expect(moves.length).toBeGreaterThan(0)
  })
})

describe('castling', () => {
  it('king-side castling moves king and rook and clears rights', () => {
    const board = empty()
    put(board, 'e1', { t: 'k', c: 'w' })
    put(board, 'h1', { t: 'r', c: 'w' })
    const move = findMove(board, sq('e1'), sq('g1'), initialCastling(), null)!
    expect(move.flags).toBe('k')
    const res = applyMove(board, initialCastling(), null, move)
    expect(res.board[sq('g1')]).toEqual({ t: 'k', c: 'w' })
    expect(res.board[sq('f1')]).toEqual({ t: 'r', c: 'w' })
    expect(res.board[sq('e1')]).toBeNull()
    expect(res.board[sq('h1')]).toBeNull()
    expect(res.castling.wk).toBe(false)
    expect(res.castling.wq).toBe(false)
  })
})

describe('win condition', () => {
  it('capturing a king is detected', () => {
    const board = empty()
    put(board, 'a1', { t: 'r', c: 'w' })
    put(board, 'a8', { t: 'k', c: 'b' })
    const move = findMove(board, sq('a1'), sq('a8'), initialCastling(), null)!
    expect(move.captured).toBe('k')
    const res = applyMove(board, initialCastling(), null, move)
    expect(res.kingCaptured).toBe(true)
    expect(res.captured?.t).toBe('k')
  })

  it('a fully boxed-in side has zero moves (stalemate)', () => {
    const board = empty()
    put(board, 'a1', { t: 'k', c: 'b' })
    put(board, 'a2', { t: 'p', c: 'b' })
    put(board, 'b2', { t: 'p', c: 'b' })
    put(board, 'b1', { t: 'p', c: 'b' })
    expect(generateAllMoves(board, 'b', initialCastling(), null)).toHaveLength(0)
  })
})

describe('king-echo (castling punishment)', () => {
  it('a castle arms { color, squares: [passOver, origin] }', () => {
    const board = empty()
    put(board, 'e1', { t: 'k', c: 'w' })
    put(board, 'h1', { t: 'r', c: 'w' })
    const move = findMove(board, sq('e1'), sq('g1'), initialCastling(), null)!
    const res = applyMove(board, initialCastling(), null, move)
    expect(res.castleGhost).toEqual<Ghost>({ color: 'w', squares: [sq('f1'), sq('e1')] })
  })

  it('an enemy may capture the king on the pass-over square', () => {
    const board = empty()
    put(board, 'g1', { t: 'k', c: 'w' }) // post-castle king
    put(board, 'f1', { t: 'r', c: 'w' }) // castled rook on the pass-over square
    put(board, 'f8', { t: 'r', c: 'b' })
    const ghost: Ghost = { color: 'w', squares: [sq('f1'), sq('e1')] }

    const withGhost = findMove(board, sq('f8'), sq('f1'), initialCastling(), null, undefined, ghost)!
    expect(withGhost.captured).toBe('k')
    const without = findMove(board, sq('f8'), sq('f1'), initialCastling(), null)!
    expect(without.captured).toBe('r')
  })

  it('an enemy may capture the king on the now-empty origin square (and not without the ghost)', () => {
    const board = empty()
    put(board, 'g1', { t: 'k', c: 'w' })
    put(board, 'f1', { t: 'r', c: 'w' })
    put(board, 'e8', { t: 'r', c: 'b' })
    const ghost: Ghost = { color: 'w', squares: [sq('f1'), sq('e1')] }

    const withGhost = findMove(board, sq('e8'), sq('e1'), initialCastling(), null, undefined, ghost)!
    expect(withGhost.captured).toBe('k')
    const without = findMove(board, sq('e8'), sq('e1'), initialCastling(), null)!
    expect(without.captured).toBeUndefined() // a quiet move otherwise
  })

  it('the castling side cannot capture its own ghost', () => {
    const board = empty()
    put(board, 'g1', { t: 'k', c: 'w' })
    put(board, 'e7', { t: 'r', c: 'w' }) // a friendly rook eyeing the origin square
    const ghost: Ghost = { color: 'w', squares: [sq('f1'), sq('e1')] }

    const move = findMove(board, sq('e7'), sq('e1'), initialCastling(), null, undefined, ghost)!
    expect(move.captured).toBeUndefined()
  })
})

describe('game state machine', () => {
  it('starts with White to move and a standard board', () => {
    const state = initialGameState()
    expect(state.turn).toBe('w')
    expect(state.board.filter(Boolean)).toHaveLength(32)
  })

  it('king-echo: opponent capturing the ghost wins the game', () => {
    let state = initialGameState()
    // Hand-place a position where White can castle king-side and a Black rook eyes e1.
    state = {
      ...state,
      board: (() => {
        const b = empty()
        put(b, 'e1', { t: 'k', c: 'w' })
        put(b, 'h1', { t: 'r', c: 'w' })
        put(b, 'e7', { t: 'r', c: 'b' })
        put(b, 'a8', { t: 'k', c: 'b' })
        return b
      })(),
    }
    const afterCastle = makeMove(state, sq('e1'), sq('g1'))!
    expect(afterCastle.state.ghost).toEqual<Ghost>({ color: 'w', squares: [sq('f1'), sq('e1')] })
    expect(afterCastle.state.turn).toBe('b')

    const capture = makeMove(afterCastle.state, sq('e7'), sq('e1'))!
    expect(capture.kingCaptured).toBe(true)
    expect(capture.state.status).toBe('b-wins')
  })
})
