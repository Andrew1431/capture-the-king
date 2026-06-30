# Capture the King — Live / Deploy Status

Operational runbook: what's deployed, where, and the exact steps left to finish.
Last updated: 2026-06-30.

## Target URLs
- Web (SPA): https://capturetheking.hartwigdev.ca  → Cloudflare Pages
- API (WebSocket): https://ws.capturetheking.hartwigdev.ca  → Cloud Run
- Cloud Run service URL (works today, no DNS needed):
  https://ctk-server-1054289488256.us-central1.run.app

## GCP / Firebase
- Project: `capture-the-king` (project number `1054289488256`)
- Region: `us-central1`
- Account/owner: andrew.hartwig1@gmail.com
- Enabled APIs: run, cloudbuild, artifactregistry
- Artifact Registry repo: `us-central1-docker.pkg.dev/capture-the-king/ctk`

## Server — Cloud Run (DEPLOYED ✅)
- Service: `ctk-server`, region `us-central1`, image `…/ctk/server:latest`
- Settings: `--allow-unauthenticated --port 8080 --min-instances 0 --max-instances 1
  --concurrency 800 --session-affinity --timeout 3600`
  (`max-instances 1` is deliberate — see "Notes" re: the in-memory store.)
- Env: `WEB_ORIGIN=https://capturetheking.hartwigdev.ca` (Socket.IO CORS allow-list)
- Auth/creds: uses **Application Default Credentials** on Cloud Run (no key file).
  `auth.ts` detects `K_SERVICE` and calls `applicationDefault()`.
- Runtime service account: `1054289488256-compute@developer.gserviceaccount.com`
  — already has `roles/editor`, which covers Firestore writes. No extra IAM needed.
- Health check: `GET /health` → `{"ok":true,"service":"ctk-server"}` (verified live).
- Scale-to-zero ⇒ ~$0 idle. First hit after idle cold-starts (~1–3s).

### Redeploy the server (after server/engine/protocol changes)
```
gcloud config set project capture-the-king
gcloud builds submit --config cloudbuild.yaml
gcloud run deploy ctk-server \
  --image us-central1-docker.pkg.dev/capture-the-king/ctk/server:latest \
  --region us-central1 --allow-unauthenticated --port 8080 \
  --min-instances 0 --max-instances 1 --concurrency 800 \
  --session-affinity --timeout 3600 \
  --set-env-vars WEB_ORIGIN=https://capturetheking.hartwigdev.ca
```
`cloudbuild.yaml` builds from the repo root using `packages/server/Dockerfile`
(the Dockerfile COPYs workspace files from root, so context must be `.`).

## Build files added
- `firestore.rules` — server-only writes; participant/self reads. Default deny.
- `firebase.json`, `.firebaserc` — point the Firebase CLI at the project + rules.
- `cloudbuild.yaml` — Cloud Build → Artifact Registry image.
- `packages/server/Dockerfile` — fixed: now builds engine + **protocol** + server,
  copies `pnpm-lock.yaml`, and uses `pnpm --legacy deploy` (pnpm v10).
- `packages/web/public/_redirects` — SPA fallback so `/join/<code>` etc. don't 404.

---

# Remaining steps (need your interactive login — run these yourself)

These need a browser/dashboard or interactive CLI login, so they weren't automated.
Run terminal commands by typing `! <command>` in Claude Code.

## 1. Deploy Firestore security rules
```
npm i -g firebase-tools      # if not installed
firebase login
firebase deploy --only firestore:rules
```
Rules are in `firestore.rules` (already wired via `firebase.json`).

## 2. `ws.` custom domain → Cloud Run
Cloud Run needs the domain verified first (one-time, opens Google Search Console):
```
gcloud domains verify capturetheking.hartwigdev.ca
```
Add the TXT record it gives you in Cloudflare DNS, finish verification, then:
```
gcloud beta run domain-mappings create \
  --service ctk-server --domain ws.capturetheking.hartwigdev.ca --region us-central1
```
It prints a DNS record (a CNAME, target like `ghs.googlehosted.com`). Add it in
Cloudflare as **DNS-only (grey cloud, NOT proxied)** so Cloud Run can issue its
managed TLS cert. Cert provisioning takes a few minutes. Verify:
```
curl https://ws.capturetheking.hartwigdev.ca/health
```

## 3. Web → Cloudflare Pages
Dashboard → Pages → Create → connect this Git repo. Settings:
- Framework preset: **None**
- Build command:
  `pnpm install && pnpm --filter @ctk/engine build && pnpm --filter @ctk/protocol build && pnpm --filter @ctk/web build`
- Build output directory: `packages/web/dist`
- Root directory: repo root (leave blank)
- Node: 20+ (set `NODE_VERSION=22` env var if needed)

Environment variables (Production) — copy the `VITE_FIREBASE_*` values from
`packages/web/.env`, and set the server URL to the `ws.` domain:
```
VITE_SERVER_URL=https://ws.capturetheking.hartwigdev.ca
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=capture-the-king
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```
(The `VITE_FIREBASE_*` keys are public — safe in the client bundle.)

Then map the custom domain `capturetheking.hartwigdev.ca` to the Pages project
(Pages → Custom domains). Cloudflare manages that DNS automatically.

## 4. Firebase Auth — authorized domains
Firebase console → Authentication → Settings → Authorized domains: add
`capturetheking.hartwigdev.ca` so Google/email sign-in works from the live site.

## 5. Cost guardrail (recommended)
GCP console → Billing → Budgets & alerts: set a small budget + email alert on
`capture-the-king` so a traffic spike can't surprise-bill. (`max-instances=4`
already caps blast radius.)

---

# Quick smoke test once 1–4 are done
1. `curl https://ws.capturetheking.hartwigdev.ca/health` → ok.
2. Open https://capturetheking.hartwigdev.ca, sign in (Google/guest).
3. Two browsers → Play → get matched → play to king capture.
4. Confirm a `games/*` doc + bumped `users/*` stats appear in Firestore.

# Notes / deferred
- Store backend is in-memory (`MemoryStore`), so all live state (queue, invites,
  games) lives in one process. The service is pinned to `--max-instances 1` so two
  players can never split across instances and fail to match. To scale past one
  instance, switch to the Redis store (PLAN §M7) and raise max-instances together.
- Cold start wipes in-flight games (acceptable for v1; Redis store removes this).
- No CI yet (`.github/` absent). Deploys are manual via the commands above.
