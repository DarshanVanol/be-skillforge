# ================================
# 1. Base Stage — Setup pnpm + deps
# ================================
FROM node:24-slim AS base
WORKDIR /usr/src/app

# Install OpenSSL + build essentials (needed for Prisma & native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libssl-dev \
    ca-certificates \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack
RUN corepack enable

# Copy workspace manifests first for caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile


# ================================
# 2. Builder Stage — Build all apps
# ================================
FROM base AS builder
WORKDIR /usr/src/app

# Copy source code
COPY . .

# Generate Prisma clients for all services (if applicable)
RUN pnpm run prisma:generate-all || echo "Skipping prisma generation"

# Build the entire monorepo
RUN pnpm build

# Prune dev dependencies (keep only prod)
RUN pnpm prune --prod


# ================================
# 3. Runtime Base — Minimal & secure
# ================================
FROM node:24-slim AS runtime
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install minimal dependencies for runtime (Prisma needs OpenSSL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm (for runtime scripts/migrations)
RUN corepack enable

# Create non-root user for better security
RUN useradd -m -r -s /bin/bash nodeuser
USER nodeuser

# Copy only production dependencies and dist files
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/libs ./dist/libs
COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/package.json ./


# ================================
# 4. Gateway (be-skillforge)
# ================================
FROM runtime AS be-skillforge
WORKDIR /usr/src/app

COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/apps/be-skillforge ./dist/apps/be-skillforge

EXPOSE 3000
CMD ["node", "dist/apps/be-skillforge/main.js"]


# ================================
# 5. AI Service
# ================================
FROM runtime AS ai-service
WORKDIR /usr/src/app

COPY --from=builder --chown=nodeuser:nodeuser /usr/src/app/dist/apps/ai_service ./dist/apps/ai_service

EXPOSE 3001
CMD ["node", "dist/apps/ai_service/main.js"]
