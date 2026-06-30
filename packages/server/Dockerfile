# Multi-stage: build the engine + protocol + server, then ship a slim runtime.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
# Manifests + lockfile first for a cached, deterministic install.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/server/package.json packages/server/
# `@ctk/server...` pulls in its workspace deps (engine, protocol) too.
RUN pnpm install --frozen-lockfile --filter @ctk/server...
COPY packages/engine packages/engine
COPY packages/protocol packages/protocol
COPY packages/server packages/server
RUN pnpm --filter @ctk/engine build \
  && pnpm --filter @ctk/protocol build \
  && pnpm --filter @ctk/server build
# --legacy: pnpm v10 otherwise refuses to deploy non-injected workspace packages.
RUN pnpm --filter @ctk/server --prod --legacy deploy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
EXPOSE 8080
CMD ["node", "dist/index.js"]
