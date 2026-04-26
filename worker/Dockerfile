# ============================================================
# PAWEN worker Dockerfile (Railway)
# Builds a small Node.js image that runs the Inngest connect()
# worker with tsx (zero-config TypeScript runtime).
# ============================================================

FROM node:22-alpine AS base
WORKDIR /app

# Copy worker package + main src (worker imports from ../src/lib)
COPY worker/package.json worker/tsconfig.json ./worker/
COPY worker/index.ts ./worker/
COPY src ./src

WORKDIR /app/worker
RUN npm install --omit=dev --prefer-offline --no-audit --no-fund

# Run as non-root for security
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Inngest connect uses outbound WebSocket only — no inbound port to expose.
# Railway will set NIXPACKS_BUILD_CMD or similar; we rely on the start script.
ENV NODE_ENV=production
CMD ["npm", "start"]
