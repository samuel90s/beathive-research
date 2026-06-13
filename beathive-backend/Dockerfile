# ── Stage 1: Install dependencies ─────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Also install ALL deps for build stage
FROM node:20-alpine AS build-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build TypeScript ─────────────────────────────
FROM build-deps AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production runtime ──────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# Install FFmpeg (required for audio preview/waveform generation)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy Prisma schema + migrations (needed for prisma migrate deploy)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy seed script dependencies
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts

# Create uploads directories
RUN mkdir -p uploads/sounds uploads/previews uploads/avatars

EXPOSE 3000

# Health check — matches /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1));"

CMD ["node", "dist/main.js"]
