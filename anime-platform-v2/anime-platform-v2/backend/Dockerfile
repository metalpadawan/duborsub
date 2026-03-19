# backend/Dockerfile
# Multi-stage build — keeps the final image lean

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production image ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Copy only what's needed at runtime
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/prisma        ./prisma

USER nestjs
EXPOSE 4000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
