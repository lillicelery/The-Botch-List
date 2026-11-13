#!/usr/bin/env bash
# Scrape Google Maps for New York cosmetic providers across NYC boroughs.
# Runs 15 jobs: 5 boroughs x 3 search terms.
# Output files land in scripts/apify/output/ as usual.
# Usage: npm run apify:maps:ny
set -euo pipefail

LOCATIONS=(
  "Manhattan, New York, NY, USA"
  "Brooklyn, NY, USA"
  "Queens, NY, USA"
  "Bronx, NY, USA"
  "Staten Island, NY, USA"
)

SEARCH_TERMS=(
  "cosmetic surgeon"
  "medical spa"
  "dermatologist"
)

for location in "${LOCATIONS[@]}"; do
  for term in "${SEARCH_TERMS[@]}"; do
    echo ""
    echo ">>> $location — $term"
    MAPS_LOCATION_QUERY="$location" \
    MAPS_SEARCH="$term" \
    MAPS_MAX_PLACES=20 \
    MAPS_MAX_REVIEWS=5 \
      node --env-file=.env scripts/apify/run.mjs
    sleep 2
  done
done

echo ""
echo "Done. Run 'npm run apify:map' to merge output files."
