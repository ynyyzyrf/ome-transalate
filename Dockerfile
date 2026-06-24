FROM node:20-alpine AS client-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
# Normalize patch file line endings to LF. pnpm hashes the patch content and
# CRLF (which can sneak in when the working copy is on Windows) will break
# `--frozen-lockfile` even if `.gitattributes` is configured.
RUN sed -i 's/\r$//' patches/*.patch
RUN pnpm install --frozen-lockfile

COPY client/ client/
COPY shared/ shared/
COPY tsconfig.json vite.config.ts components.json ./

RUN pnpm vite build

FROM node:20-alpine AS server-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN sed -i 's/\r$//' patches/*.patch
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

# Keep only runtime dependencies so the final image does not need a second install step.
RUN pnpm prune --prod

FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY --from=server-builder /app/node_modules/ ./node_modules/

COPY --from=server-builder /app/dist/ ./dist/
COPY --from=client-builder /app/dist/public/ ./dist/public/
COPY drizzle/ ./drizzle/
COPY shared/ ./shared/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
