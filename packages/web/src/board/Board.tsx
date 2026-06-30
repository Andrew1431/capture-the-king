import type { GameState, Move } from '@ctk/engine'
import { cn } from '../lib/cn'
import { GLYPH } from './pieces'

interface BoardProps {
  state: GameState
  /** Render from Black's perspective. */
  flipped?: boolean
  selected?: number | null
  /** Legal destination squares for the selected piece. */
  targets?: Set<number>
  lastMove?: Move | null
  onSquareClick?: (index: number) => void
  interactive?: boolean
}

const GLYPH_SIZE = 'text-[clamp(1.5rem,9vw,2.75rem)] leading-none'

/**
 * Renders the engine board with optional move affordances. King-echo ghost squares
 * always show as faint, pulsing kings — intentional teaching of the mechanic.
 */
export function Board({
  state,
  flipped = false,
  selected = null,
  targets,
  lastMove,
  onSquareClick,
  interactive = false,
}: BoardProps) {
  const order = Array.from({ length: 64 }, (_, i) => i)
  if (flipped) order.reverse()
  const ghostSquares = new Set(state.ghost?.squares ?? [])

  return (
    <div className="aspect-square w-full touch-manipulation overflow-hidden rounded-2xl border border-border shadow-md">
      <div className="grid h-full w-full grid-cols-8">
        {order.map((index) => {
          const row = Math.floor(index / 8)
          const col = index % 8
          const dark = (row + col) % 2 === 1
          const piece = state.board[index]
          const isGhost = ghostSquares.has(index)
          const isTarget = targets?.has(index) ?? false
          const isSelected = selected === index
          const isLast = lastMove != null && (lastMove.from === index || lastMove.to === index)

          return (
            <button
              type="button"
              key={index}
              disabled={!interactive}
              onClick={() => onSquareClick?.(index)}
              className={cn(
                'relative flex aspect-square items-center justify-center',
                dark ? 'bg-board-dark' : 'bg-board-light',
                interactive ? 'cursor-pointer' : 'cursor-default',
                isLast && 'ring-2 ring-inset ring-board-mark/70',
                isSelected && 'ring-4 ring-inset ring-brand',
              )}
            >
              {piece && (
                <span
                  className={cn(
                    GLYPH_SIZE,
                    'drop-shadow-sm',
                    piece.c === 'w' ? 'text-zinc-50' : 'text-zinc-900',
                  )}
                >
                  {GLYPH[piece.t]}
                </span>
              )}

              {isGhost && !piece && (
                <span className={cn(GLYPH_SIZE, 'animate-pulse text-board-mark/70')}>{GLYPH.k}</span>
              )}

              {/* Move hint: a dot on empty targets, a ring around capturable squares. */}
              {isTarget &&
                (piece || isGhost ? (
                  <span className="absolute inset-1 rounded-full ring-4 ring-brand/70" />
                ) : (
                  <span className="absolute h-1/4 w-1/4 rounded-full bg-brand/70" />
                ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
