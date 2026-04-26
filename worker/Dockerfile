# ============================================================
# PAWEN worker Dockerfile (Railway)
#
# Two-stage logic in a single image: install all deps (incl. esbuild),
# bundle worker/index.ts + ../src/lib/** into one ESM file, prune to
# prod-only deps, then run plain Node on the bundle. No tsx, no runtime
# tsconfig-paths gymnastics.
# ============================================================

FROM node:22-alpine AS base
WORKDIR /app

# Source needed for the bundle
COPY worker/package.json worker/tsconfig.json worker/index.ts worker/build.mjs ./worker/
COPY worker/stubs ./worker/stubs
COPY src ./src

WORKDIR /app/worker

# Install ALL deps (we need esbuild + tsx in devDeps for the build step).
RUN npm install --prefer-offline --no-audit --no-fund

# Bundle to dist/index.mjs (server-only aliased to no-op, @/* resolved via tsconfig).
RUN node build.mjs

# Drop devDeps now that bundling is done.
RUN npm prune --omit=dev

# Run as non-root for security.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENV NODE_ENV=production
# Inngest connect uses outbound WebSocket only — no inbound port to expose.
CMD ["node", "dist/index.mjs"]
