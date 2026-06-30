# Multi-stage: build the engine + server, then ship a slim runtime.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @ctk/server... || pnpm install --filter @ctk/server...
COPY packages/engine packages/engine
COPY packages/server packages/server
RUN pnpm --filter @ctk/engine build && pnpm --filter @ctk/server build
RUN pnpm --filter @ctk/server --prod deploy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
EXPOSE 8080
CMD ["node", "dist/index.js"]
