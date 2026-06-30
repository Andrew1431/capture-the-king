# Capture the King — Architecture & Development Plan

A standalone, mobile-first web app for one chess variant: **Capture the King**.
Think "chess.com, but a single game mode where you win by *literally capturing the
enemy king*." There is no check, no checkmate, no pins, no castling restrictions.
Move generation is **pseudo-legal**: any piece may move wherever its movement rules
allow, even into danger, and the game ends the instant a king is taken.

This document is the complete spec. It is self-contained — everything needed to
build the engine, server, and client from scratch is described here.

---

## 1. Goals & Constraints

- **Standalone single-game app.** No plugin system, no generic game framework.
- **Mobile-first.** Designed for a phone in portrait first, desktop second: the
  board fills the screen, fat tap targets, drag *or* tap-to-move.
- **Cheap when idle, scalable under load.** Target idle cost ≈ the price of the
  domain (~$10/yr). Must not fall over (or bankrupt us) under a traffic spike.
- **Real-time multiplayer** over WebSockets.
- **Persistence:** Firestore stores finished games and who played them.
- **Auth:** Google OAuth, email/password, and anonymous guests (Firebase Auth).
- **Matchmaking:** a "Play" button drops you into a game with the next person in
  the queue.

---

## 2. Cost & Scale (read this before choosing infra)

### Views are not concurrent connections

A concurrent connection is a player with the tab open **and a live WebSocket right
now**. Page views spread over time produce far fewer concurrent sockets than the
raw view count: a viral spike of ~2000 views in an hour is realistically only a few
hundred simultaneous players. Capacity planning is about **peak concurrent live
sockets**, not total views.

### The WebSocket billing gotcha

A WebSocket is a single long-lived HTTP request. On request-billed serverless
platforms (e.g. Cloud Run), **CPU is billed for as long as the socket stays
connected**, not just while messages flow. Consequences:

- **Zero connected players → scales to zero → $0.**
- **One idle-but-connected tab → one warm instance billing the whole time.**

So "scale to zero" means zero *connected* clients. Mitigate stragglers with an
**idle-disconnect timeout** (drop a socket after N minutes of no input). Bound spike
cost with a **max-instance cap** and a **billing budget alert** so a traffic surge
can never produce a surprise bill.

### Per-instance ceiling and how to scale past it

This game is **turn-based with a very low message rate** (a player sends a move
every ~10–30 s), so the limit is connection count, not CPU. A single small instance
can hold on the order of a thousand mostly-idle sockets, but request-billed
serverless platforms cap request concurrency at ~1000 per instance. **One instance
is therefore a hard ~1000-socket ceiling.** The only way past it is **more
instances**, which forces a decision: with naive in-memory state, two players in the
same game could land on different instances and never see each other.

### Recommended target architecture: stateless instances + a serverless coordinator

Run **many small instances** (`min-instances=0`, `max-instances=N`) and move the
shared state out of process memory into a **serverless Redis (e.g. Upstash)** that
itself scales its cost toward zero when idle:

- **Pub/sub adapter** — a Socket.IO Redis adapter fans broadcasts across all
  instances, so two players matched onto different instances still communicate.
- **Matchmaking queue in Redis** — an atomic pop shared across instances.
- **Authoritative live-game state in Redis** — any instance can load a game,
  validate a move with the engine, and write it back. Turn-based play means one
  small Redis round-trip per move, which is imperceptible.

This removes the ~1000 ceiling, scales out under load, and still costs ~$0 when
nobody is connected. Avoid an always-on managed Redis (typically ~$35/mo minimum) —
that is what breaks the budget; a serverless/pay-per-request Redis with a free tier
does not.

Operational notes for multi-instance WebSockets:
- Force `transports: ['websocket']` (skip HTTP long-polling) to largely remove the
  need for sticky sessions during the handshake.
- Enable **session affinity** anyway as a safety net.
- Set a sane `max-instances` and a billing alert.

### Cheapest-always-on alternative (good starting point)

A single **always-free micro VM** (e.g. GCP `e2-micro` in an eligible region) can
run the server as one always-on process: **no cold start, no Redis, free**, capped
by one box's RAM (a few thousand idle turn-based sockets). This is an excellent way
to launch. The migration path to the multi-instance + serverless-Redis design above
is clean because the server is written stateless-ready from day one (see §5).

### Cold start

With scale-to-zero, the first connection after an idle period cold-starts a
container (~1–3 s for a slim Node image). The frontend handles this with a "waking
the server up…" state while the socket handshake retries. This is an explicit,
accepted trade-off.

### Ads — not a cost strategy

Display-ad revenue for a hobby game is small (~$1–8 per 1000 impressions) and
requires *sustained* traffic; a one-time spike earns a few dollars once. Covering
even a modest always-on dependency would need tens of thousands of impressions every
month. Since the recommended design already costs ~$0 when idle, **ad revenue is not
needed to cover hosting.** If offsetting always-on infra ever matters, a "support /
buy me a coffee" link is a better fit than banner ads, which require network approval
and degrade UX on a game board. Treat ads as optional upside, never as the plan.

### Rough monthly cost

| Service | Idle | Light use |
|---|---|---|
| Serverless container (scale-to-zero) | $0 | ~$0 (generous free tier) |
| Serverless Redis (free tier) | $0 | ~$0 |
| Firestore (free tier) | $0 | ~$0 |
| Auth (Google/password/anon) | $0 | $0 |
| Static frontend hosting (edge) | $0 | $0 |
| Domain | — | ~$10/yr (the only guaranteed cost) |

---

## 3. High-Level Architecture

```
                         Your domain (Cloudflare DNS)
                                     │
            ┌─────────────────────────┴──────────────────────────┐
            │                                                      │
     play.yoursite.com                                    api.yoursite.com
   (static SPA on edge host)                        (WebSocket game server,
   mobile-first React app                            scale-to-zero container)
            │                                                      │
            │  Firebase Auth (ID token in socket handshake)        │
            ├──────────────► verifies token (Admin SDK) ◄──────────┤
            │                                                      │
            │                                         ┌────────────┴───────────┐
            │                                         │  Serverless Redis      │
            │                                         │  • matchmaking queue   │
            │                                         │  • live-game state     │
            │                                         │  • pub/sub adapter      │
            │                                         └────────────┬───────────┘
            │                                                      │
            │                                       writes finished games
            │                                                      ▼
            └──────────────────── Firestore (game history, user stats) ◄──
```

- **Frontend:** a static bundle (no SSR), served from an edge host (Cloudflare Pages
  recommended since DNS already lives there; any static host works). Talks to
  Firebase Auth directly and to the game server over a single WebSocket.
- **Server:** stateless-ready Node + Socket.IO container. Verifies the Firebase ID
  token on connect, runs the **authoritative** engine, coordinates via Redis (in the
  scaled design), and writes completed games to Firestore via the Admin SDK.
- **Firebase:** Auth + Firestore only. No Cloud Functions, no Firebase Hosting —
  fewer moving parts.

---

## 4. Monorepo Layout (pnpm, 3 packages)

```
capture-the-king/
├── pnpm-workspace.yaml
├── package.json                # root scripts, shared dev deps, lint/format
├── tsconfig.base.json
├── PLAN.md
├── .github/workflows/          # CI: typecheck, test, deploy
└── packages/
    ├── engine/                 # @ctk/engine  — pure game logic + types
    │   ├── src/
    │   │   ├── board.ts        # board model, initialBoard, squareName, idx
    │   │   ├── moves.ts        # generatePieceMoves / generateAllMoves / findMove
    │   │   ├── apply.ts        # applyMove, ApplyResult, castle ghost
    │   │   ├── types.ts        # Piece, Color, Move, Castling, Ghost, GameState
    │   │   └── index.ts
    │   └── __tests__/          # full Vitest regression suite (§6)
    │
    ├── server/                 # @ctk/server — scale-to-zero container
    │   ├── src/
    │   │   ├── index.ts        # http + socket.io bootstrap, health check
    │   │   ├── auth.ts         # Firebase Admin token verification on handshake
    │   │   ├── matchmaking.ts  # queue → pairs players into a Game
    │   │   ├── game.ts         # one live game: wraps engine, validates turns
    │   │   ├── store.ts        # state backend: in-memory OR redis (one interface)
    │   │   ├── persistence.ts  # write finished game to Firestore
    │   │   └── protocol.ts     # socket event names/payloads (imports engine types)
    │   ├── Dockerfile
    │   └── package.json        # depends on @ctk/engine (workspace:*)
    │
    └── web/                    # @ctk/web — mobile-first static SPA
        ├── src/
        │   ├── main.tsx
        │   ├── app/            # routes: /, /play, /game/:id, /history, /login
        │   ├── board/          # Board, Square, Piece, drag+tap move UI
        │   ├── net/            # socket client, reconnect, "server waking" state
        │   ├── auth/           # Firebase Auth: Google, email/pw, anonymous
        │   └── ui/             # mobile shell, nav, toasts
        └── package.json        # depends on @ctk/engine (workspace:*)
```

### Package responsibilities

**`@ctk/engine`** — zero runtime dependencies, pure functions, no I/O. The complete
rules (§5–§6) live here. Both `web` (move-dot hints, ghost squares, optimistic UI)
and `server` (authoritative validation) import it, guaranteeing identical rules on
both sides. Ships compiled ESM + `.d.ts`.

**`@ctk/server`** — the only trusted authority. Validates every move with the
engine, owns turn order, detects king capture / stalemate, runs matchmaking, and
persists results. Never trusts client-claimed legality. **Critically, all shared
state goes through a single `store` interface** with two implementations — an
in-memory map (single-instance / micro-VM mode) and a Redis-backed one
(multi-instance mode). The rest of the server never knows which is active, so
scaling up is a config flip, not a rewrite.

**`@ctk/web`** — renders the board, sends move intents, applies
server-authoritative state. Uses the engine only for *local* affordances (legal-move
dots, ghost-king highlights), never as the source of truth.

`workspace:*` links `engine` into both consumers; `pnpm -r build` builds all three in
dependency order.

---

## 5. Game Rules (the engine spec)

### Board model

- 8×8 board as a **flat 64-element array**. Index `= (8 - rank) * 8 + file`, where
  `file` is 0–7 (a–h) and `rank` is 1–8. Index `0` = a8 (top-left as White sees it).
- Each cell is `null` or a piece `{ t: 'p'|'n'|'b'|'r'|'q'|'k', c: 'w'|'b' }`.
- White moves toward decreasing index (up the board); Black toward increasing.

### Win condition

You win by **capturing the enemy king**. There is **no check, no checkmate, no
draw-by-king-safety**. The game ends the moment a king is taken.

### Pseudo-legal move generation

Generate moves purely from each piece's movement pattern, with **no king-safety
filtering**:

- A king **may move into an attacked square**.
- A "pinned" piece **may still move** (pins do not exist).
- All standard piece movement otherwise applies: sliding for B/R/Q, leaping for N,
  one-square king moves, pawn pushes/captures.

### Standard mechanics retained

- **Pawns:** single push, double push from the starting rank, diagonal capture,
  **en passant**, and **promotion** to Q/R/B/N on reaching the last rank (all four
  options offered).
- **Castling is always allowed** when the king and chosen rook have not moved and
  the squares between them are empty — **including castling out of, through, or into
  an attacked square** (no check restriction). Castling moves the rook to the square
  the king passed over.
- **Castling rights** track per side: white/black, king-side/queen-side; cleared when
  the king or the relevant rook moves.

### The King-Echo castling punishment (signature mechanic)

Because castling through danger is legal here, it must carry a risk. When a side
castles, it arms a **"ghost king"** on two squares for **exactly the opponent's next
turn**:

1. the king's **origin** square (now empty), and
2. the square the king **passed over** (where the rook lands).

During that single opponent turn, the opponent may **capture the king on either
ghost square** — an otherwise-impossible-looking move — and win. Mechanics:

- The pass-over square is occupied by the castled rook, so capturing there is an
  ordinary capture *re-labeled as a king capture*.
- The origin square is empty, so move generation must be **ghost-aware**: for the
  opponent's turn only, those squares behave as a capturable enemy king for
  move-generation and legality.
- The king's actual destination square is already covered by ordinary king capture
  and needs no special handling.
- The echo **expires automatically** after that one opponent turn (every subsequent
  move overwrites/clears it).
- The **castling player cannot capture their own** ghost (it only exists for the
  opponent).
- Ghost squares **always render** as faint, pulsing king icons so players learn the
  mechanic before it is ever used against them. This is intentional teaching, not a
  hidden trap.

### Stalemate

Since there is no check, "the side to move has zero legal moves" is unambiguous and
results in a **draw**.

### Engine API (shape to implement)

```ts
type Color = 'w' | 'b'
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
interface Piece { t: PieceType; c: Color }
type Board = (Piece | null)[]                 // length 64

interface Castling { wk: boolean; wq: boolean; bk: boolean; bq: boolean }
interface Ghost { color: Color; squares: number[] }   // king-echo
interface Move {
  from: number; to: number
  flags?: 'k' | 'q' | 'ep' | 'promo' | null   // castle sides, en passant, promotion
  promo?: PieceType
  captured?: PieceType                         // includes 'k' when a king/ghost is taken
}
interface ApplyResult {
  board: Board; castling: Castling; enPassant: number | null
  move: Move; captured: Piece | null
  kingCaptured: boolean
  castleGhost: Ghost | null                    // armed when this move was a castle
}

function initialBoard(): Board
function initialCastling(): Castling
function squareName(index: number): string
function generatePieceMoves(board, from, castling, enPassant, ghost?): Move[]
function generateAllMoves(board, color, castling, enPassant, ghost?): Move[]
function findMove(board, from, to, castling, enPassant, promo?, ghost?): Move | null
function applyMove(board, castling, enPassant, move): ApplyResult
```

The `ghost` parameter threads the king-echo through generation/legality. `applyMove`
returns `castleGhost` (origin + pass-over squares) whenever the move was a castle, so
the server can arm it for the opponent's next turn.

---

## 6. Engine Test Suite (must stay green)

Port/author a Vitest suite covering at minimum:

- Initial board has 32 pieces with kings on e1/e8.
- Opening position yields exactly 20 moves for White.
- Pawn single/double push; double push sets the en-passant target.
- En passant capture removes the passed pawn.
- Promotion offers all four pieces and applies the chosen one.
- Knight movement; king may move into an attacked square; a "pinned" piece can move.
- King-side castling moves king and rook and clears rights.
- Capturing a king is detected (`kingCaptured`, `captured.t === 'k'`).
- A fully boxed-in side has zero moves (stalemate).
- **King-echo:** a castle arms `{ color, squares: [passOver, origin] }`.
- **King-echo:** an enemy may capture the king on the pass-over square.
- **King-echo:** an enemy may capture the king on the now-empty origin square (and
  *cannot* without the ghost — that square is a quiet move otherwise).
- **King-echo:** the castling side cannot capture its own ghost.

---

## 7. Networking & Protocol

One Socket.IO connection per client. The Firebase ID token is passed in the handshake
(`auth: { token }`); the server rejects the connection if the token is invalid
(anonymous tokens are valid Firebase users and are accepted).

Representative events (typed in `protocol.ts`, payloads share engine types):

| Direction | Event | Payload | Meaning |
|---|---|---|---|
| C→S | `queue:join` | `{}` | enter public matchmaking |
| C→S | `queue:leave` | `{}` | cancel |
| S→C | `queue:waiting` | `{ position }` | still searching |
| C→S | `invite:create` | `{}` → ack `{ code }` | open a private room, get a share code |
| C→S | `invite:join` | `{ code }` → ack `{ ok }` / `{ ok:false, reason }` | join a friend's room by code |
| C→S | `invite:cancel` | `{ code }` | close an unfilled private room |
| S→C | `invite:waiting` | `{ code }` | room open, waiting for the friend |
| S→C | `game:start` | `{ gameId, color, state }` | matched, here's your seat |
| C→S | `move` | `{ from, to, promo? }` | move intent |
| S→C | `state` | `{ state, lastMove }` | authoritative snapshot |
| S→C | `game:over` | `{ winner, reason }` | king captured / resign / draw / stalemate |
| C→S | `resign` / `offer-draw` / `respond-draw` | … | in-game actions |
| both | `ping` / `pong` | — | keepalive within the platform's request timeout |

**State sync:** start by sending the **full game state** on every move — the board is
tiny (64 cells), so this is simpler and robust. Optimize to deltas only if a real
need appears.

**Reconnection:** games are keyed by `gameId` in the `store` and associated with each
player's Firebase `uid`. On reconnect within a grace window, the client rejoins via
`uid → active game` lookup and receives a fresh full `state`. In single-instance
in-memory mode, a cold start wipes live games (acceptable for v1, surfaced as "game
ended"); the Redis store removes this limitation for free.

---

## 8. Matchmaking

Two ways into a game: **public random** matchmaking and **private invite codes**.

### Public (random opponent)

1. Client taps **Play** → `queue:join`.
2. Server keeps a single FIFO queue (in `store`: an array in memory, or a Redis list
   with an atomic pop in multi-instance mode).
3. When two players are queued, pop both, create a `Game`, assign colors randomly,
   and emit `game:start` to each.
4. While alone, the client shows "waiting for an opponent" with a cancel button.

Anonymous guests queue exactly like signed-in users with a generated display name
(e.g. "Guest-4821").

### Private (play a friend by code)

A first-class feature, not a deferred "optional later":

1. Client taps **Play a friend** → `invite:create`; the server mints a short,
   human-shareable **room code** (e.g. 4–6 uppercase chars, ambiguity-free alphabet
   like no `O`/`0`/`I`/`1`), stores `code → { hostUid, createdAt }` in the `store`
   (an in-memory map, or a Redis key with a TTL in multi-instance mode), and replies
   with the code. The host sees a share sheet ("send this code / link") and a
   `invite:waiting` state.
2. The friend enters the code (or opens `play.yoursite.com/join/<code>`) →
   `invite:join`. The server validates: unknown → `not-found`, expired TTL →
   `expired`, already filled → `full`.
3. On a valid join the server pops the room, creates a `Game`, assigns colors
   randomly, emits `game:start` to both, and deletes the code.
4. The host may `invite:cancel` to close an unfilled room; codes also expire by TTL
   so abandoned rooms self-clean.

Both paths converge on the **same `Game` creation + `game:start`** code, so the
engine, turn handling, and persistence are shared. Codes live behind the `store`
interface, so the feature works unchanged in single-instance and multi-instance modes.

Optional later: a simple bot so a solo player can always get a game.

---

## 9. Data Model (Firestore)

Lean, and captures *who played* per requirement.

```
users/{uid}
  displayName, photoURL?, provider: 'google'|'password'|'anonymous',
  createdAt, gamesPlayed, wins, losses, draws

games/{gameId}
  createdAt, endedAt,
  players: { w: { uid, name }, b: { uid, name } },
  winner: 'w' | 'b' | null,            // null = draw
  reason: 'king-captured'|'resign'|'stalemate'|'draw'|'abandon',
  moves: [...],                         // compact from/to/promo list (replayable)
  finalBoard?: <serialized board>
```

- Only the **server** (Admin SDK) writes `games/*` and the aggregate stats on
  `users/*`. Security rules: `games` readable by participants, never client-writable;
  `users` self-read with limited self-write.
- A single write happens on `game:over` — no per-move Firestore writes, keeping usage
  deep in the free tier.

---

## 10. Build, CI/CD & Environments

- **Tooling:** pnpm workspaces, TypeScript project references, **Vitest** for engine
  tests, ESLint + Prettier at the root. Frontend bundler: **Vite + React** (light,
  static output, mobile-friendly).
- **Engine builds first** (`tsc`); server and web consume it via `workspace:*`.
- **Server deploy:** container from the `server` Dockerfile (multi-stage: build
  engine + server, ship a slim `node:lts-slim` runtime), deployed scale-to-zero with
  a `max-instances` cap, session affinity on, and a generous request timeout.
- **Web deploy:** `pnpm --filter @ctk/web build` → static edge host (Cloudflare Pages
  Git integration auto-deploys on push).
- **CI (GitHub Actions):** PR → typecheck + Vitest + lint. Merge to `main` → deploy
  web and server.
- **Config/secrets:** Firebase web config is public (frontend env). The server needs
  a Firebase **service-account** secret for the Admin SDK, plus a `STORE=memory|redis`
  switch and (in redis mode) a Redis URL. Frontend needs `VITE_SERVER_URL` and the
  Firebase web keys.

### DNS
- `play.yoursite.com` → static host (CNAME, proxied).
- `api.yoursite.com` → the container's custom domain. Confirm the proxy passes the
  WebSocket upgrade (standard proxies do).

---

## 11. Milestones

1. **M0 — Scaffold.** pnpm monorepo, three packages, root tsconfig/lint/CI,
   `workspace:*` wiring. Hello-world Vite app + a health-check container deploying
   end-to-end on the domain.
2. **M1 — Engine.** Implement `@ctk/engine` to the §5 spec; author the §6 test suite;
   go green.
3. **M2 — Local 2-player.** Server holds one in-memory game (via the `store`
   interface), two browser tabs, full move flow + king capture + stalemate +
   king-echo, full-state sync. No auth yet.
4. **M3 — Auth.** Firebase Auth in the web app (Google, email/pw, anonymous); server
   verifies the ID token on the socket handshake.
5. **M4 — Matchmaking.** Public FIFO queue → auto-pairing → `game:start`; waiting/cancel
   UI. **Private invite codes:** create/share/join-by-code rooms (the §8 private path),
   with `not-found`/`expired`/`full` handling and a `/join/<code>` deep link.
6. **M5 — Persistence.** Write finished games + player identities + user stats to
   Firestore via the Admin SDK; `/history` screen.
7. **M6 — Mobile polish.** Portrait-first board, drag + tap moves, "server waking"
   cold-start state, reconnect handling, board flip for Black, captured-piece tray.
8. **M7 — Scale-ready + ship.** Implement the Redis `store` backend behind the same
   interface; lock Firestore security rules; `max-instances` + billing alert; custom
   domain live; README + runbook.

---

## 12. Deliberately Deferred

- **Horizontal scale beyond one instance** is *designed for* (the `store` interface)
  but the Redis backend is only switched on when needed (M7 / under real load).
- **Live-game durability across cold starts** comes free once the Redis store is on.
- **Bots / solo play, ELO/ranking, spectating, time controls,
  rematch-with-history.** (Private friend invites are **in scope** — see §8.)
- **Delta state sync** instead of full snapshots.
- **Ads / monetization** — explicitly out of scope (see §2).

---

## 13. Open Questions

- Guest persistence: keep the anonymous `uid` in localStorage so returning guests
  keep their history, and offer "upgrade this guest to Google/email" (Firebase
  supports anonymous → permanent account linking)? Recommended.
- Display name for Google users: use the Google profile name, or prompt for a handle?
- Stored move format: compact `from/to/promo` (cheap, replayable — recommended) vs
  human-readable SAN (nicer for a future PGN export/game viewer).
- Launch infra: start on the **always-free micro VM** (no cold start, simplest) and
  graduate to **scale-to-zero container + serverless Redis**, or go straight to the
  scaled design? The code supports both via the `store` interface regardless.
```

