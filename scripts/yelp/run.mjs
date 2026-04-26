/**
 * Fetch cosmetic surgeon businesses from Yelp Fusion API for Seattle/WA area.
 *
 * Legal: Uses Yelp Fusion API (official, rate-limited). Per Yelp Fusion ToS,
 * data is for display only with Yelp attribution. Business metadata is stored;
 * review excerpts are displayed with source attribution.
 * Register at: https://www.yelp.com/developers
 *
 * Usage (from repo root):
 *   npm run yelp:fetch
 *
 * Requires: YELP_API_KEY in .env (see .env.example)
 *
 * After a successful run, build the provider list:
 *   npm run yelp:map
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.YELP_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing YELP_API_KEY. Add it to your .env file (see .env.example).");
  process.exit(1);
}

const YELP_API_BASE = "https://api.yelp.com/v3";
const RATE_LIMIT_MS = 600;
const MAX_RESULTS_PER_TERM = 200;

const SEARCH_CONFIGS = [
  { term: "plastic surgeon",     location: "Miami, FL" },
  { term: "cosmetic surgeon",    location: "Miami, FL" },
  { term: "medical spa",         location: "Miami, FL" },
  { term: "aesthetic clinic",    location: "Miami, FL" },
  { term: "plastic surgeon",     location: "Fort Lauderdale, FL" },
  { term: "medical spa",         location: "Fort Lauderdale, FL" },
  { term: "plastic surgeon",     location: "Boca Raton, FL" },
  { term: "medical spa",         location: "Boca Raton, FL" },
  { term: "plastic surgeon",     location: "Tampa, FL" },
  { term: "medical spa",         location: "Tampa, FL" },
  { term: "plastic surgeon",     location: "Orlando, FL" },
  { term: "medical spa",         location: "Orlando, FL" },
  { term: "plastic surgeon",     location: "Naples, FL" },
  { term: "plastic surgeon",     location: "West Palm Beach, FL" },
  { term: "medical spa",         location: "West Palm Beach, FL" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yelpGet(path, params = {}) {
  const url = new URL(`${YELP_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(String(k), String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "TheBotchList/1.0 (jhanellalillian.123456789@gmail.com)",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Yelp API ${res.status} for ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function searchBusinesses(term, location) {
  const businesses = [];
  const seenIds = new Set();
  let offset = 0;

  while (offset < MAX_RESULTS_PER_TERM) {
    await sleep(RATE_LIMIT_MS);
    let data;
    try {
      data = await yelpGet("/businesses/search", {
        term,
        location,
        categories: "plastic_surgeons,cosmeticsurgeons,medspa,skincare",
        limit: 50,
        offset,
      });
    } catch (err) {
      console.warn(`  Search error at offset ${offset}:`, err.message);
      break;
    }

    const batch = (data.businesses ?? []).filter((b) => !seenIds.has(b.id));
    if (!batch.length) break;

    batch.forEach((b) => seenIds.add(b.id));
    businesses.push(...batch);
    console.log(`  ${term} @ ${location}: fetched ${businesses.length} so far (offset ${offset})`);

    if (batch.length < 50) break;
    offset += 50;
  }

  return businesses;
}


const allBusinesses = new Map();

for (const config of SEARCH_CONFIGS) {
  console.log(`\nSearching: "${config.term}" in ${config.location}`);
  const results = await searchBusinesses(config.term, config.location);
  for (const biz of results) {
    if (!allBusinesses.has(biz.id)) {
      allBusinesses.set(biz.id, biz);
    }
  }
}

console.log(`\nFetched ${allBusinesses.size} unique businesses.`);

const businesses = [...allBusinesses.values()];

const outDir = join(__dirname, "output");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = join(outDir, `yelp-florida-${stamp}.json`);

writeFileSync(
  outPath,
  JSON.stringify({ fetchedAt: new Date().toISOString(), itemCount: businesses.length, items: businesses }, null, 2),
  "utf8"
);
console.log(`\nWrote ${businesses.length} businesses to ${outPath}`);
