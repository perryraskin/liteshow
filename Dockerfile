# Liteshow API - Fly.io Deployment
# Multi-stage build for optimized production image

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY turbo.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules

COPY . .

# Build the API (db and auth packages use source files directly)
RUN pnpm --filter @liteshow/api build

# Stage 3: Production runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy packages (db and auth use source files, not built dist)
COPY --from=builder /app/packages/db/src ./packages/db/src
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/auth/src ./packages/auth/src
COPY --from=builder /app/packages/auth/package.json ./packages/auth/

# Copy API source and dependencies
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=builder /app/package.json ./

# Copy workspace files
COPY --from=builder /app/pnpm-workspace.yaml ./

# Install tsx globally for running TypeScript
RUN npm install -g tsx

EXPOSE 8080

# Fly.io uses PORT env var (default 8080)
ENV API_PORT=8080

WORKDIR /app/apps/api
CMD ["tsx", "src/index.ts"]
