# Capture the King

A mobile-first chess variant where you win by **literally capturing the enemy king** —
no check, no checkmate, pseudo-legal moves, and a signature "king-echo" castling
punishment. See [PLAN.md](./PLAN.md) for the full spec.

## Monorepo

pnpm workspaces, three packages:

| Package | Name | Role |
|---|---|---|
| `packages/engine` | `@ctk/engine` | Pure, zero-dependency game logic + shared types. Imported by both server and web. |
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

> The engine must be built (`pnpm --filter @ctk/engine build`) before the server/web
> typecheck, since they import its compiled `dist`.

## Status

- **M0 — Scaffold:** ✅ workspace, three packages, lint/format/CI-ready, health check.
- **M1 — Engine:** ✅ full §5 rules + §6 Vitest suite (incl. king-echo) green.
- Next: M2 local 2-player over Socket.IO.
