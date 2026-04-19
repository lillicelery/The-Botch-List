/**
 * Run Apify Google Maps Scraper once for a single city/region and save raw output JSON.
 * Actor: compass/crawler-google-places (Google Maps Scraper)
 *
 * Legal: Apify's Google Places actor fetches publicly visible business data from Google Maps.
 * Google Maps ToS (§3.2.3) restricts unauthorized scraping; Apify operates as a third-party
 * service — review Apify's ToS at https://apify.com/terms-of-service before commercial use.
 * We scrape: business name, category, rating, and public review text only (no PII).
 * We set scrapeReviewsPersonalData=false and respect rate limits via maxCrawledPlacesPerSearch.
 * Prefer Google Places API (official) at scale: https://developers.google.com/maps/documentation/places
 *
 * Usage (from repo root):
 *   npm run apify:maps
 *
 * Requires: APIFY_TOKEN in .env (see .env.example)
 *
 * After a successful run, refresh the app dataset:
 *   npm run apify:map
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApifyClient } from "apify-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ACTOR_ID = "compass/crawler-google-places";

const token = process.env.APIFY_TOKEN?.trim();
if (!token) {
  console.error("Missing APIFY_TOKEN. Add it to your .env file (see .env.example).");
  process.exit(1);
}

const locationQuery = process.env.MAPS_LOCATION_QUERY?.trim() || "Seattle, WA, USA";
const searchTerm = process.env.MAPS_SEARCH?.trim() || "plastic surgeon";
const maxCrawledPlacesPerSearch = Math.max(1, Number(process.env.MAPS_MAX_PLACES || 10));

// Review scraping knobs (cost/time sensitive)
const maxReviews = Math.max(0, Number(process.env.MAPS_MAX_REVIEWS || 3));
const reviewsSort = (process.env.MAPS_REVIEWS_SORT || "newest").trim();
const reviewsOrigin = (process.env.MAPS_REVIEWS_ORIGIN || "google").trim();
const reviewsStartDate = process.env.MAPS_REVIEWS_START_DATE?.trim();
const reviewsFilterString = process.env.MAPS_REVIEWS_FILTER_STRING?.trim();

const input = {
  searchStringsArray: [searchTerm],
  locationQuery,
  maxCrawledPlacesPerSearch,
  maxReviews,
  reviewsSort,
  reviewsOrigin,
  scrapeReviewsPersonalData: false,
  ...(reviewsStartDate ? { reviewsStartDate } : {}),
  ...(reviewsFilterString ? { reviewsFilterString } : {}),
};

const client = new ApifyClient({ token });

async function listAllDatasetItems(datasetId) {
  const all = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { items, total } = await client.dataset(datasetId).listItems({ offset, limit });
    all.push(...items);
    if (!items.length) break;
    if (total != null && all.length >= total) break;
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

console.log(`Calling actor ${ACTOR_ID} ...`);
console.log(JSON.stringify(input, null, 2));

const run = await client.actor(ACTOR_ID).call(input);
const datasetId = run.defaultDatasetId;

if (!datasetId) {
  console.error("Run finished but no defaultDatasetId on run:", run);
  process.exit(1);
}

console.log("Run finished:", run.id, "dataset:", datasetId);

const items = await listAllDatasetItems(datasetId);

const outDir = join(__dirname, "output");
mkdirSync(outDir, { recursive: true });

const slug = locationQuery.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = join(outDir, `google-maps-${slug}-${stamp}.json`);

const payload = {
  actorId: ACTOR_ID,
  runId: run.id,
  datasetId,
  status: run.status,
  input,
  itemCount: items.length,
  items,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Wrote ${items.length} items to ${outPath}`);

