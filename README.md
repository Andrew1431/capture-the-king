# Capture the King

A mobile-first chess variant where you win by **literally capturing the enemy king** —
no check, no checkmate, pseudo-legal moves, and a signature "king-echo" castling
punishment. See [PLAN.md](./PLAN.md) for the full spec.

## Contributing & issues

Capture the King is open source. Found a bug or have an idea?
[Open an issue](https://github.com/Andrew1431/capture-the-king/issues) — please
include steps to reproduce and, if it's a gameplay bug, the move sequence.

## Monorepo

pnpm workspaces, three packages:

| Package | Name | Role |
|---|---|---|
| `packages/engine` | `@ctk/engine` | Pure, zero-dependency game logic + shared types. Imported by both server and web. |
| `packages/protocol` | `@ctk/protocol` | Shared Socket.IO event/payload types, so client and server are typed against the same contract. |
| `packages/server` | `@ctk/server` | Authoritative Node + Socket.IO game server (scale-to-zero container). |
| `packages/web` | `@ctk/web` | Vite + React 19 + Tailwind v4 mobile-first SPA. |

## Develop

```bash
pnpm install
pnpm -r build        # builds engine → server → web (topological)
pnpm test            # engine Vitest suite
pnpm typecheck       # all packages
pnpm lint            # eslint

pnpm dev:server      # @ctk/server on :8080 (health at /health)
pnpm dev:web         # @ctk/web on :5173
```

> The `engine`/`protocol` packages must be built (`pnpm -r build`) before the server/web
> typecheck, since consumers import their compiled `dist`.

To try local two-player: run `pnpm dev:server` and `pnpm dev:web`, then open
`localhost:5173` in **two tabs** and press **Play** in each — they get matched together.
Set `VITE_SERVER_URL` (see `packages/web/.env.example`) to point at a non-local server.

## Status

- **M0 — Scaffold:** ✅ workspace, packages, lint/format/CI-ready, health check.
- **M1 — Engine:** ✅ full §5 rules + §6 Vitest suite (incl. king-echo) green.
- **M2 — Local 2-player:** ✅ in-memory `GameStore`, FIFO matchmaking, authoritative
  move validation, full-state sync, tap-to-move board, promotion, resign, reconnect
  grace, king-echo rendering.
- **M3 — Auth:** ✅ Firebase Auth in the web app (Google, email/password, anonymous
  guest); the server verifies the ID token on the Socket.IO handshake (`auth.ts`).
- **M4 — Matchmaking:** ✅ public FIFO queue → auto-pairing → `game:start`;
  waiting/cancel UI; private invite codes (create/share/join-by-code) with
  `not-found`/`expired`/`full` handling and a `/join/<code>` deep link.
- **M5 — Persistence:** ✅ finished games + player identities + user stats written to
  Firestore via the Admin SDK (`persistence.ts`), with move lists stored compact and
  replayable. (Standalone `/history` screen deferred; an in-game move-history panel
  ships in M6.)
- **M6 — Mobile polish:** ✅ portrait-first board, tap moves, "server waking"
  cold-start state, reconnect handling, board flip for Black, captured-piece tray,
  and the in-game move-history panel.
- **M7 — Ship:** 🚧 live on Cloud Run (scale-to-zero, `max-instances=1`) + Cloudflare
  Pages, locked Firestore rules, keyless CI via Workload Identity Federation, custom
  domains. **Deferred:** the Redis `store` backend (still `MemoryStore`) and the
  billing-budget guardrail. See [LIVE_STATUS.md](./LIVE_STATUS.md) for the deploy runbook.
