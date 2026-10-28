FROM node:20-alpine AS deps

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/workflows/package.json packages/workflows/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter @smart-hub/web build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=builder /app ./
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

CMD ["pnpm", "--filter", "@smart-hub/web", "start"]
