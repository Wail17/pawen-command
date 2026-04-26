#!/usr/bin/env bash
# Bulk set Vercel production env vars via bash stdin (no trailing newline).
# Each var: rm -y then add via printf piped to vercel env add.

set -u

declare -A VARS=(
  [EXA_API_KEY]="ba8bb7a8-fc43-46da-9cca-53fcfdd8c76d"
  [BRIGHTDATA_API_KEY]="04c5ddd1-14b9-4743-befb-a99a3ae140c5"
  [BRIGHTDATA_DATASET_ID_REDDIT_POSTS]="gd_lvz8ah06191smkebj4"
  [BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS]="gd_lvzdpsdlw09j6t702"
  [BRIGHTDATA_DATASET_ID_QUORA]="gd_lvz1rbj81afv3m6n5y"
  [BRIGHTDATA_DATASET_ID_TIKTOK_POSTS]="gd_lu702nij2f790tmv9h"
  [BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS]="gd_lkf2st302ap89utw5k"
  [BRIGHTDATA_DATASET_ID_TIKTOK_PROFILES]="gd_l1villgoiiidt09ci"
  [BRIGHTDATA_DATASET_ID_INSTAGRAM_PROFILES]="gd_l1vikfch901nx3by4"
  [BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS]="gd_lk5ns7kz21pck8jpis"
  [BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS]="gd_lyclm20il4r5helnj"
  [BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS]="gd_ltppn085pokosxh13"
  [BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS]="gd_lk56epmy2i5g7lzu0k"
  [BRIGHTDATA_DATASET_ID_YOUTUBE_CHANNELS]="gd_lk538t2k2p1k3oos71"
  [BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS]="gd_lk9q0ew71spt1mxywf"
  [BRIGHTDATA_DATASET_ID_AMAZON_PRODUCTS]="gd_l7q7dkf244hwjntr0"
  [BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS]="gd_le8e811kzy4ggddlq"
  [BRIGHTDATA_DATASET_ID_AMAZON_SEARCH]="gd_lwdb4vjm1ehb499uxs"
  [VOYAGE_API_KEY]="pa-GiMB0Cj8BateO1fUrPy_EwUquI0klydFr34s00MjRuh"
  [USE_NEW_SCRAPING_STACK]="1"
  [NEXT_PUBLIC_USE_NEW_SCRAPING_STACK]="1"
)

ok=0
fail=0
for name in "${!VARS[@]}"; do
  value="${VARS[$name]}"
  printf "→ %-45s " "$name"
  vercel env rm "$name" production -y >/dev/null 2>&1
  # printf without \n — vercel env add reads until EOF
  if printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1; then
    echo "✓"
    ok=$((ok+1))
  else
    echo "✗"
    fail=$((fail+1))
  fi
done
echo
echo "$ok ok / $fail fail"
