#!/usr/bin/env bash
# Push ALL worker env vars to Railway in one shot.
# Run AFTER `railway login` + `railway link` (select pawen-command service).
#
# Reads values from .env.railway (already pulled from Vercel via `vercel env pull`).
# Filters to only the vars the worker needs (skips VERCEL_*, TURBO_*, OIDC, etc.).
set -euo pipefail

ENV_FILE="${1:-.env.railway}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run: vercel env pull .env.railway --environment=production --yes" >&2
  exit 1
fi

# Vars the worker actually needs.
WORKER_VARS=(
  INNGEST_EVENT_KEY
  INNGEST_SIGNING_KEY
  DATABASE_URL
  ANTHROPIC_API_KEY
  BRIGHTDATA_API_KEY
  BRIGHTDATA_DATASET_ID_AMAZON_PRODUCTS
  BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS
  BRIGHTDATA_DATASET_ID_AMAZON_SEARCH
  BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS
  BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS
  BRIGHTDATA_DATASET_ID_INSTAGRAM_PROFILES
  BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS
  BRIGHTDATA_DATASET_ID_QUORA
  BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS
  BRIGHTDATA_DATASET_ID_REDDIT_POSTS
  BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS
  BRIGHTDATA_DATASET_ID_TIKTOK_POSTS
  BRIGHTDATA_DATASET_ID_TIKTOK_PROFILES
  BRIGHTDATA_DATASET_ID_YOUTUBE_CHANNELS
  BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS
  BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS
  BRIGHTDATA_DISABLE_TIKTOK_COMMENTS
  BRIGHTDATA_DISABLE_YOUTUBE_COMMENTS
  VOYAGE_API_KEY
  EXA_API_KEY
  FIRECRAWL_API_KEY
  TAVILY_API_KEY
  BLOB_READ_WRITE_TOKEN
  SESSION_SECRET
)

# Pull a single key's value from the dotenv file. Strips quotes and any
# trailing literal `\n` that vercel env pull sometimes adds.
get_var() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" || true)
  [ -z "$line" ] && return 1
  # Remove KEY= prefix
  local value="${line#${key}=}"
  # Strip surrounding double quotes if present
  value="${value#\"}"
  value="${value%\"}"
  # Strip a trailing literal \n (two chars: backslash + n)
  value="${value%\\n}"
  printf '%s' "$value"
}

CMD=(railway variables)
for key in "${WORKER_VARS[@]}"; do
  if val=$(get_var "$key"); then
    if [ -z "$val" ]; then
      echo "  skip (empty): $key" >&2
      continue
    fi
    CMD+=(--set "${key}=${val}")
    echo "  + $key (${#val} chars)" >&2
  else
    echo "  skip (not in $ENV_FILE): $key" >&2
  fi
done

# Hard-coded extras (kill switches + worker identity).
CMD+=(--set "INSTANCE_ID=pawen-worker-railway-prod")
CMD+=(--set "USE_NEW_SCRAPING_STACK=1")
CMD+=(--set "NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1")
CMD+=(--set "FORCE_TWO_PASS_COMPILE=1")
CMD+=(--set "DISABLE_GAP_FILL=1")
CMD+=(--set "DISABLE_SOURCE_DOUBLING=1")
CMD+=(--set "DISABLE_ADVERSARIAL=1")
CMD+=(--set "NODE_ENV=production")
CMD+=(--set "INNGEST_LOG_LEVEL=debug")
echo "  + 8 hard-coded flags" >&2

echo
echo "Running: railway variables --set <31 vars> ..." >&2
"${CMD[@]}"
