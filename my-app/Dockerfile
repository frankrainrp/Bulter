FROM node:20-bookworm-slim AS builder

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @smart-hub/web build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]

