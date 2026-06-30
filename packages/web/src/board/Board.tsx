import type { GameState } from '@ctk/engine'
import { cn } from '../lib/cn'
import { GLYPH } from './pieces'

interface BoardProps {
  state: GameState
  /** Render from Black's perspective. */
  flipped?: boolean
}

/**
 * Presentational board. Renders the engine's board plus any armed king-echo
 * ghost squares as faint, pulsing kings (intentional teaching of the mechanic).
 */
export function Board({ state, flipped = false }: BoardProps) {
  const order = Array.from({ length: 64 }, (_, i) => i)
  if (flipped) order.reverse()
  const ghostSquares = new Set(state.ghost?.squares ?? [])

  return (
    <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border shadow-md">
      <div className="grid h-full w-full grid-cols-8">
        {order.map((index) => {
          const row = Math.floor(index / 8)
          const col = index % 8
          const dark = (row + col) % 2 === 1
          const piece = state.board[index]
          const isGhost = ghostSquares.has(index)

          return (
            <div
              key={index}
              className={cn(
                'relative flex items-center justify-center',
                dark ? 'bg-board-dark' : 'bg-board-light',
              )}
            >
              {piece && (
                <span
                  className={cn(
                    'text-[clamp(1.5rem,9vw,2.75rem)] leading-none drop-shadow-sm',
                    piece.c === 'w' ? 'text-zinc-50' : 'text-zinc-900',
                  )}
                >
                  {GLYPH[piece.t]}
                </span>
              )}
              {isGhost && !piece && (
                <span className="animate-pulse text-[clamp(1.5rem,9vw,2.75rem)] leading-none text-board-mark/70">
                  {GLYPH.k}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
