import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { Color } from '@ctk/engine'
import type { GameOverPayload } from '@ctk/protocol'
import type { GameRecord } from './store.js'

let db: Firestore | null = null
function firestore(): Firestore {
  if (!db) db = getFirestore()
  return db
}

/** Compact, replayable move: from/to (+ promo). The engine re-derives everything else. */
function compactMoves(record: GameRecord): { from: number; to: number; promo?: string }[] {
  return record.moves.map((m) => (m.promo ? { from: m.from, to: m.to, promo: m.promo } : { from: m.from, to: m.to }))
}

/** Which stat field a player earns from this result. */
function statFor(winner: Color | null, color: Color): 'wins' | 'losses' | 'draws' {
  if (winner === null) return 'draws'
  return winner === color ? 'wins' : 'losses'
}

/**
 * Persist a finished game and bump both players' aggregate stats, in one transaction.
 * Best-effort: callers wrap this so a Firestore hiccup never breaks game teardown.
 * Writes only here happen at game-over — no per-move writes — to stay in the free tier.
 */
export async function persistFinishedGame(record: GameRecord, over: GameOverPayload): Promise<void> {
  const fs = firestore()
  const gameRef = fs.collection('games').doc(record.id)
  const seats = [
    { ref: fs.collection('users').doc(record.players.w.uid), seat: record.players.w, color: 'w' as const },
    { ref: fs.collection('users').doc(record.players.b.uid), seat: record.players.b, color: 'b' as const },
  ]

  await fs.runTransaction(async (tx) => {
    const snaps = await Promise.all(seats.map(({ ref }) => tx.get(ref)))

    tx.set(gameRef, {
      createdAt: record.createdAt,
      endedAt: Date.now(),
      players: {
        w: { uid: record.players.w.uid, name: record.players.w.name },
        b: { uid: record.players.b.uid, name: record.players.b.name },
      },
      winner: over.winner,
      reason: over.reason,
      moves: compactMoves(record),
      finalBoard: record.state.board,
    })

    seats.forEach(({ ref, seat, color }, i) => {
      const stat = statFor(over.winner, color)
      tx.set(
        ref,
        {
          displayName: seat.name,
          ...(snaps[i].exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          gamesPlayed: FieldValue.increment(1),
          [stat]: FieldValue.increment(1),
        },
        { merge: true },
      )
    })
  })
}
