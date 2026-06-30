import { useRef, useState } from 'react'
import type { GameState, Move, Piece } from '@ctk/engine'
import { cn } from '../lib/cn'
import { PIECE_SVG } from './pieces'

interface BoardProps {
  state: GameState
  /** Render from Black's perspective. */
  flipped?: boolean
  selected?: number | null
  /** Legal destination squares for the selected piece. */
  targets?: Set<number>
  lastMove?: Move | null
  /** Tap/click on a square (select, move, deselect). */
  onSquareClick?: (index: number) => void
  /** Select a square as the drag origin (fires when a drag begins). */
  onSelect?: (index: number) => void
  /** Drag-and-drop a piece from one square to another. */
  onDragMove?: (from: number, to: number) => void
  interactive?: boolean
}

/** Pointer travel (px) before a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6

const PIECE_SIZE = 'h-[78%] w-[78%]'

interface DragState {
  from: number
  piece: Piece | null
  x: number
  y: number
  moved: boolean
  /** Square edge length in px, for the floating piece. */
  size: number
}

/**
 * Renders the engine board with click-to-move and drag-and-drop. King-echo ghost
 * squares always show as faint, pulsing kings — intentional teaching of the mechanic.
 */
export function Board({
  state,
  flipped = false,
  selected = null,
  targets,
  lastMove,
  onSquareClick,
  onSelect,
  onDragMove,
  interactive = false,
}: BoardProps) {
  const order = Array.from({ length: 64 }, (_, i) => i)
  if (flipped) order.reverse()
  const ghostSquares = new Set(state.ghost?.squares ?? [])

  const gridRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  // Suppress the synthetic click that follows a pointer interaction (keyboard
  // activation has no preceding pointer sequence, so it still gets through).
  const pointerHandledRef = useRef(false)
  const [drag, setDrag] = useState<DragState | null>(null)

  const canDrag = (piece: Piece | null): boolean =>
    interactive && piece != null && piece.c === state.turn

  function squareFromPoint(clientX: number, clientY: number): number | null {
    const el = gridRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (clientX < r.left || clientX >= r.right || clientY < r.top || clientY >= r.bottom) return null
    const col = Math.floor(((clientX - r.left) / r.width) * 8)
    const row = Math.floor(((clientY - r.top) / r.height) * 8)
    const visual = row * 8 + col
    return flipped ? 63 - visual : visual
  }

  function handlePointerDown(index: number, e: React.PointerEvent) {
    if (!interactive) return
    pointerHandledRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ from: index, piece: state.board[index], x: e.clientX, y: e.clientY, moved: false, size: 0 })
  }

  function handlePointerMove(e: React.PointerEvent) {
    setDrag((d) => {
      if (!d || !startRef.current) return d
      const traveled = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y)
      const moved = d.moved || traveled > DRAG_THRESHOLD
      if (moved && !d.moved && canDrag(d.piece)) onSelect?.(d.from)
      const size = d.size || (gridRef.current ? gridRef.current.getBoundingClientRect().width / 8 : 0)
      return { ...d, x: e.clientX, y: e.clientY, moved, size }
    })
  }

  function handlePointerUp(e: React.PointerEvent) {
    const d = drag
    setDrag(null)
    startRef.current = null
    if (!d) return
    pointerHandledRef.current = true
    const to = squareFromPoint(e.clientX, e.clientY)
    if (d.moved && to != null && to !== d.from && canDrag(d.piece)) {
      onDragMove?.(d.from, to)
    } else {
      onSquareClick?.(d.from)
    }
  }

  function handleClick(index: number) {
    if (pointerHandledRef.current) {
      pointerHandledRef.current = false
      return
    }
    onSquareClick?.(index)
  }

  return (
    <>
      <div className="aspect-square w-full touch-manipulation overflow-hidden rounded-2xl border border-border shadow-md">
        <div ref={gridRef} className="grid h-full w-full grid-cols-8">
          {order.map((index) => {
            const row = Math.floor(index / 8)
            const col = index % 8
            const dark = (row + col) % 2 === 1
            const piece = state.board[index]
            const isGhost = ghostSquares.has(index)
            const isTarget = targets?.has(index) ?? false
            const isSelected = selected === index
            const isLast = lastMove != null && (lastMove.from === index || lastMove.to === index)
            const isDragging = drag?.moved === true && drag.from === index && canDrag(drag.piece)

            return (
              <button
                type="button"
                key={index}
                disabled={!interactive}
                onPointerDown={(e) => handlePointerDown(index, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={() => handleClick(index)}
                className={cn(
                  'relative flex aspect-square select-none items-center justify-center',
                  dark ? 'bg-board-dark' : 'bg-board-light',
                  interactive ? 'cursor-pointer touch-none' : 'cursor-default',
                  isLast && 'ring-2 ring-inset ring-board-mark/70',
                  isSelected && 'ring-4 ring-inset ring-brand',
                )}
              >
                {piece && (
                  <img
                    src={PIECE_SVG[piece.c][piece.t]}
                    alt=""
                    draggable={false}
                    className={cn(
                      PIECE_SIZE,
                      'pointer-events-none drop-shadow-sm',
                      isDragging && 'opacity-0',
                    )}
                  />
                )}

                {isGhost && !piece && state.ghost && (
                  <img
                    src={PIECE_SVG[state.ghost.color].k}
                    alt=""
                    draggable={false}
                    className={cn(PIECE_SIZE, 'pointer-events-none animate-pulse opacity-50')}
                  />
                )}

                {/* Move hint: a dot on empty targets, a ring around capturable squares. */}
                {isTarget &&
                  (piece || isGhost ? (
                    <span className="pointer-events-none absolute inset-1 rounded-full ring-4 ring-brand/70" />
                  ) : (
                    <span className="pointer-events-none absolute h-1/4 w-1/4 rounded-full bg-brand/70" />
                  ))}
              </button>
            )
          })}
        </div>
      </div>

      {drag && drag.moved && canDrag(drag.piece) && drag.piece && (
        <img
          src={PIECE_SVG[drag.piece.c][drag.piece.t]}
          alt=""
          draggable={false}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size }}
        />
      )}
    </>
  )
}
