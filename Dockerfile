# --- 1. Base Stage: Install pnpm and dependencies ---
# Use the Node.js 24 LTS image (Alpine for small size)
FROM node:24-alpine AS base
WORKDIR /usr/src/app
# Enable pnpm via corepack
RUN corepack enable
# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install ALL dependencies (dev needed for build)
RUN pnpm install --frozen-lockfile


# --- 2. Builder Stage: Build all apps ---
FROM base AS builder
# Copy the rest of the source code
COPY . .
# Generate the Prisma clients for both services
RUN pnpm run prisma:generate-all
# Run the main build script from your root package.json
RUN pnpm build
# Prune dev dependencies, leaving only prod dependencies
RUN pnpm prune --prod


# --- 3. Production Stage: 'be-skillforge' (Gateway) ---
# Start from a fresh, small image
FROM node:24-alpine AS be-skillforge
WORKDIR /usr/src/app
ENV NODE_ENV=production
# Enable pnpm
RUN corepack enable
# Copy the pruned prod dependencies from the 'builder' stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Copy the built shared libraries
COPY --from=builder /usr/src/app/dist/libs ./dist/libs
# Copy the built 'be-skillforge' app
COPY --from=builder /usr/src/app/dist/apps/be-skillforge ./dist/apps/be-skillforge
# Copy package.json
COPY package.json .
# The command to run the gateway app
CMD ["node", "dist/apps/be-skillforge/main.js"]


# --- 4. Production Stage: 'ai_service' ---
# Start from a fresh, small image
FROM node:24-alpine AS ai-service
WORKDIR /usr/src/app
ENV NODE_ENV=production
# Enable pnpm
RUN corepack enable
# Copy the pruned prod dependencies from the 'builder' stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Copy the built shared libraries
COPY --from=builder /usr/src/app/dist/libs ./dist/libs
# Copy the built 'ai_service' app
COPY --from=builder /usr/src/app/dist/apps/ai_service ./dist/apps/ai_service
# Copy package.json
COPY package.json .
# The command to run the AI service app
CMD ["node", "dist/apps/ai_service/main.js"]