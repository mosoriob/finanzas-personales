# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# git: required to install the open-banking-chile github dependency
# build-essential + python3: required to compile better-sqlite3 native bindings
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# DATABASE_URL is required for `prisma` to resolve during build; the real
# database is provided at runtime via the environment / a mounted volume.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/prisma/dev.db"
RUN npm run build

# ---- Runner ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV DATABASE_URL="file:/app/prisma/dev.db"
# Absolute path to the sidecar scraper spawned by the /api/sync route.
ENV SYNC_SCRIPT_PATH=/app/scripts/sync-bank.mjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Persist the SQLite database outside the image layer
VOLUME ["/app/prisma"]

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
