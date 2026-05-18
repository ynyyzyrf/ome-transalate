# ─── Stage 1: Build Client ──────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY client/ client/
COPY shared/ shared/
COPY tsconfig.json vite.config.ts components.json ./

RUN pnpm vite build

# ─── Stage 2: Build Server ──────────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY server/ server/
COPY shared/ shared/
COPY drizzle/ drizzle/
COPY tsconfig.json ./

RUN npx esbuild server/_core/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist

# ─── Stage 3: Production Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=server-builder /app/dist/ ./dist/
COPY --from=client-builder /app/dist/public/ ./dist/public/
COPY drizzle/ ./drizzle/
COPY shared/ ./shared/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
