# ================================
# 1. Base Stage — Dependencies & pnpm setup
# ================================
FROM node:24-slim AS base
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl libssl-dev ca-certificates python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ================================
# 2. Builder Stage — Build all apps
# ================================
FROM base AS builder
WORKDIR /usr/src/app
COPY . .

# Generate Prisma clients (safe fallback)
RUN pnpm run prisma:generate || echo "⚠️ Skipping Prisma generation"

# Build NestJS monorepo
RUN pnpm build

# Prune dev dependencies after build
RUN pnpm prune --prod

# ================================
# 3. Runtime Base — Secure + Minimal
# ================================
FROM node:24-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
RUN useradd -m -r -s /bin/bash nodeuser
USER nodeuser

# Copy production deps + Prisma artifacts
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/libs ./dist/libs
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/package.json ./

# ================================
# 4. be-skillforge App
# ================================
FROM runtime AS be-skillforge
WORKDIR /usr/src/app
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/apps/be-skillforge ./dist/apps/be-skillforge

ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/apps/be-skillforge/main.js"]

# ================================
# 5. AI Service
# ================================
FROM runtime AS ai-service
WORKDIR /usr/src/app
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/apps/ai_service ./dist/apps/ai_service

ENV AI_SERVICE_PORT=3001
EXPOSE 3001
CMD ["node", "dist/apps/ai_service/main.js"]
