# Production Dockerfile for Worker
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps

WORKDIR /app

COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/onec-client/package.json ./packages/onec-client/

RUN npm install --legacy-peer-deps || npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

WORKDIR /app/packages/database
RUN sh -c "for i in 1 2 3 4 5; do npx prisma generate && exit 0; echo \"prisma generate failed, retry $i/5\"; sleep $((i * 5)); done; exit 1"

WORKDIR /app/packages/onec-client
RUN npm run build

WORKDIR /app/apps/worker
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/onec-client ./packages/onec-client

USER worker

CMD ["node", "apps/worker/dist/index.js"]
