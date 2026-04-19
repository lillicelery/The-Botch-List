/**
 * Cross-source deduplication: finds providers that appear in multiple source JSON files
 * (Apify, Yelp, Reddit) and merges their snippets into the primary (Apify) record.
 *
 * Matching strategy: normalize name (lowercase, strip punctuation + common words like
 * "dr", "center", "surgery") + city. Providers with the same normalized key are merged.
 *
 * Usage:
 *   npm run data:deduplicate
 *
 * Reads:  src/data/apifyProviders.json, src/data/yelpProviders.json, src/data/redditProviders.json
 * Writes: updates each file, removing providers whose snippets were merged into another source
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "src", "data");

const SOURCES = [
  { key: "apify", path: join(DATA_DIR, "apifyProviders.json") },
  { key: "yelp", path: join(DATA_DIR, "yelpProviders.json") },
  { key: "reddit", path: join(DATA_DIR, "redditProviders.json") },
];

const STRIP_WORDS = /\b(dr|doctor|the|center|surgery|surgical|aesthetic|aesthetics|clinic|medical|spa|plastic|cosmetic|institute|associates|group|llc|pllc|inc|of|and|for|at|in)\b/g;

function normalizeKey(name, locationLabel) {
  const city = String(locationLabel ?? "").split(",")[0].toLowerCase().trim();
  const normName = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(STRIP_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${normName}|${city}`;
}

// Load all providers from each source
const sourceData = {};
for (const { key, path } of SOURCES) {
  if (!existsSync(path)) {
    sourceData[key] = [];
    continue;
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  sourceData[key] = Array.isArray(raw) ? raw : [];
}

// Build a map: normalizedKey → { primarySlug, primarySource, allSnippets }
const primaryByKey = new Map();

// First pass: register all Apify providers as primary (most data)
for (const provider of sourceData.apify) {
  const key = normalizeKey(provider.name, provider.locationLabel);
  if (!primaryByKey.has(key)) {
    primaryByKey.set(key, { primary: provider, source: "apify", extraSnippets: [] });
  }
}

// Second pass: for each non-apify provider, check if it matches an Apify provider
const yelpDuplicates = new Set();
const redditDuplicates = new Set();

for (const provider of sourceData.yelp) {
  const key = normalizeKey(provider.name, provider.locationLabel);
  if (primaryByKey.has(key)) {
    const entry = primaryByKey.get(key);
    const newSnippets = (provider.snippets ?? []).map((s) => ({
      ...s,
      id: `dedup-yelp-${s.id}`,
    }));
    entry.extraSnippets.push(...newSnippets);
    yelpDuplicates.add(provider.slug);
    console.log(`Merging Yelp "${provider.name}" → Apify "${entry.primary.name}"`);
  }
}

for (const provider of sourceData.reddit) {
  const key = normalizeKey(provider.name, provider.locationLabel);
  if (primaryByKey.has(key)) {
    const entry = primaryByKey.get(key);
    const newSnippets = (provider.snippets ?? []).map((s) => ({
      ...s,
      id: `dedup-reddit-${s.id}`,
    }));
    entry.extraSnippets.push(...newSnippets);
    redditDuplicates.add(provider.slug);
    console.log(`Merging Reddit "${provider.name}" → Apify "${entry.primary.name}"`);
  }
}

// Apply merged snippets to Apify providers
let mergedCount = 0;
const updatedApify = sourceData.apify.map((provider) => {
  const key = normalizeKey(provider.name, provider.locationLabel);
  const entry = primaryByKey.get(key);
  if (!entry || !entry.extraSnippets.length) return provider;

  const snippetMap = new Map((provider.snippets ?? []).map((s) => [s.id, s]));
  for (const s of entry.extraSnippets) {
    if (!snippetMap.has(s.id)) snippetMap.set(s.id, s);
  }
  const mergedSnippets = [...snippetMap.values()].slice(0, 12);
  mergedCount++;
  return {
    ...provider,
    snippets: mergedSnippets,
    stats: { ...provider.stats, snippetsCollected: mergedSnippets.length },
  };
});

// Remove duplicates from secondary source files
const updatedYelp = sourceData.yelp.filter((p) => !yelpDuplicates.has(p.slug));
const updatedReddit = sourceData.reddit.filter((p) => !redditDuplicates.has(p.slug));

// Write updated files
writeFileSync(join(DATA_DIR, "apifyProviders.json"), JSON.stringify(updatedApify, null, 2), "utf8");
writeFileSync(join(DATA_DIR, "yelpProviders.json"), JSON.stringify(updatedYelp, null, 2), "utf8");
writeFileSync(join(DATA_DIR, "redditProviders.json"), JSON.stringify(updatedReddit, null, 2), "utf8");

console.log(`\nDeduplication complete:`);
console.log(`  Merged ${mergedCount} Apify providers with extra snippets`);
console.log(`  Removed ${yelpDuplicates.size} Yelp duplicates`);
console.log(`  Removed ${redditDuplicates.size} Reddit duplicates`);
console.log(`  Apify: ${updatedApify.length} providers`);
console.log(`  Yelp:  ${updatedYelp.length} providers`);
console.log(`  Reddit: ${updatedReddit.length} providers`);
