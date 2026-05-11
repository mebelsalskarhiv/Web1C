# Production Dockerfile for Next.js app
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl wget

# Install dependencies only when needed
FROM base AS deps

WORKDIR /app

# Copy package files (no lock files required)
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/onec-client/package.json ./packages/onec-client/

# Install dependencies
RUN npm install --legacy-peer-deps || npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
WORKDIR /app/packages/database
RUN sh -c "for i in 1 2 3 4 5; do npx prisma generate && exit 0; echo \"prisma generate failed, retry $i/5\"; sleep $((i * 5)); done; exit 1"

WORKDIR /app/packages/onec-client
RUN npm run build

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create uploads directory
RUN mkdir -p /app/apps/web/uploads
RUN chown -R nextjs:nodejs /app/apps/web/uploads

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/uploads ./apps/web/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app
CMD ["node", "apps/web/server.js"]
