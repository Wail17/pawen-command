# ============================================================
# PAWEN worker Dockerfile (Railway)
# Builds a small Node.js image that runs the Inngest connect()
# worker with tsx (zero-config TypeScript runtime).
# ============================================================

FROM node:22-alpine AS base
WORKDIR /app

# Copy worker package + stubs + main src (worker imports from ../src/lib)
COPY worker/package.json worker/tsconfig.json ./worker/
COPY worker/index.ts ./worker/
COPY worker/stubs ./worker/stubs
COPY src ./src

WORKDIR /app/worker
RUN npm install --omit=dev --prefer-offline --no-audit --no-fund

# Make the no-op `server-only` stub visible to files under /app/src/* too.
# Node walks up from each importing file looking for node_modules; since
# files under src/ never see worker/node_modules, we plant a copy at the
# parent (/app/node_modules) so `import 'server-only'` resolves to the
# no-op everywhere in the image (worker AND src trees).
RUN mkdir -p /app/node_modules/server-only \
 && cp /app/worker/stubs/server-only/index.js /app/node_modules/server-only/index.js \
 && printf '{"name":"server-only","main":"index.js","type":"commonjs"}\n' > /app/node_modules/server-only/package.json

# Run as non-root for security
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Inngest connect uses outbound WebSocket only — no inbound port to expose.
ENV NODE_ENV=production
CMD ["npm", "start"]
