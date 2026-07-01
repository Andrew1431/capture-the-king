import { useEffect, useRef } from 'react'
import { squareName, type Move } from '@ctk/engine'
import { cn } from '../lib/cn'
import { Text } from '../ui'

/** Compact coordinate label for one move (castles, captures, promotion, king-take). */
function moveLabel(m: Move): string {
  if (m.flags === 'k') return 'O-O'
  if (m.flags === 'q') return 'O-O-O'
  const sep = m.captured ? '×' : '–'
  let s = squareName(m.from) + sep + squareName(m.to)
  if (m.promo) s += '=' + m.promo.toUpperCase()
  if (m.captured === 'k') s += '#'
  return s
}

interface Row {
  no: number
  white: Move | null
  black: Move | null
}

/** Pair moves into White/Black rows (White moves first). */
function toRows(moves: Move[]): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: moves[i] ?? null, black: moves[i + 1] ?? null })
  }
  return rows
}

/** Scrollable two-column move list, auto-scrolled to the latest move. */
function MoveList({ moves }: { moves: Move[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = moves.length - 1

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [moves.length])

  if (moves.length === 0) {
    return (
      <Text size="sm" tone="muted" className="px-3 py-4 text-center">
        No moves yet.
      </Text>
    )
  }

  return (
    <div ref={ref} className="max-h-64 overflow-y-auto lg:max-h-[28rem]">
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <tbody>
          {toRows(moves).map((row) => (
            <tr key={row.no} className="border-b border-border/40 last:border-0">
              <td className="w-8 py-1 pl-3 pr-2 text-right text-muted">{row.no}.</td>
              <Cell move={row.white} highlight={row.white != null && last === (row.no - 1) * 2} />
              <Cell move={row.black} highlight={row.black != null && last === (row.no - 1) * 2 + 1} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ move, highlight }: { move: Move | null; highlight: boolean }) {
  return (
    <td className="py-1 pr-3">
      {move && (
        <span
          className={cn(
            'inline-block rounded px-1.5 py-0.5',
            highlight ? 'bg-brand/20 font-semibold text-text' : 'text-text',
          )}
        >
          {moveLabel(move)}
        </span>
      )}
    </td>
  )
}

/** Move history: a side column on desktop, a collapsible panel below the board on mobile. */
export function MoveHistory({ moves, className }: { moves: Move[]; className?: string }) {
  return (
    <>
      {/* Desktop: always-visible side column. */}
      <div
        className={cn(
          'hidden flex-col rounded-2xl border border-border bg-surface lg:flex',
          className,
        )}
      >
        <div className="border-b border-border px-3 py-2.5">
          <Text
            size="sm"
            className="font-display font-semibold tracking-[0.2em] text-muted uppercase"
          >
            Scoresheet
          </Text>
        </div>
        <MoveList moves={moves} />
      </div>

      {/* Mobile: collapsible disclosure under the board. */}
      <details className="rounded-2xl border border-border bg-surface lg:hidden" open>
        <summary className="cursor-pointer px-3 py-2.5 font-display text-sm font-semibold tracking-[0.2em] text-muted uppercase select-none">
          Scoresheet · {moves.length}
        </summary>
        <div className="border-t border-border">
          <MoveList moves={moves} />
        </div>
      </details>
    </>
  )
}
