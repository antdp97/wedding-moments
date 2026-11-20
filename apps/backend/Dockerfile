# Build context MUST be the repository root (the backend depends on packages/shared):
#   docker build -f apps/backend/Dockerfile .
FROM node:22-alpine

WORKDIR /repo

# 1. Install dependencies for the backend workspace only (+ the shared package it links to).
#    Copy manifests first so this layer is cached until dependencies change.
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
# prisma schema is needed by the backend's `postinstall: prisma generate`
COPY apps/backend/prisma apps/backend/prisma
RUN npm ci --workspace=@wedding-moments/backend --include-workspace-root --no-audit --no-fund

# 2. Copy sources and build shared -> backend (turbo resolves the order).
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npx turbo run build --filter=@wedding-moments/backend

WORKDIR /repo/apps/backend

# Create uploads directory for local dev fallback
RUN mkdir -p public/uploads

EXPOSE 4000

# Run migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
