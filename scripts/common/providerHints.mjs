/**
 * Dynamically generates provider name patterns from existing source JSON files.
 * Used by scrapers (Apify Reddit, Trustpilot) to detect provider mentions in text.
 *
 * Rather than maintaining a hardcoded list of providers (like the old Reddit script),
 * this reads all providers from apifyProviders.json + yelpProviders.json and generates
 * search patterns automatically.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Same strip words as deduplicate.mjs — used to find the distinctive part of a name
const STRIP_WORDS = /\b(dr|doctor|the|center|surgery|surgical|aesthetic|aesthetics|clinic|medical|spa|plastic|cosmetic|institute|associates|group|llc|pllc|inc|of|and|for|at|in)\b/g;

// Words too generic to use as standalone patterns (cause too many false positives)
const TOO_GENERIC = new Set([
  "aesthetic", "aesthetics", "cosmetic", "facial", "surgical",
  "medical", "beauty", "skin", "care", "health", "wellness",
]);

function generatePatterns(name) {
  const lower = String(name ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!lower) return [];

  const stripped = lower.replace(STRIP_WORDS, " ").replace(/\s+/g, " ").trim();
  const patterns = new Set();

  // Full stripped name (e.g. "arias facial", "oren tepper")
  if (stripped.length >= 3) patterns.add(stripped);

  // Individual distinctive tokens ≥ 5 chars (e.g. "tepper", "capella")
  for (const token of stripped.split(" ").filter(Boolean)) {
    if (token.length >= 5 && !TOO_GENERIC.has(token)) {
      patterns.add(token);
    }
  }

  // First two words of original name (catches "Lin Aesthetic", "Dr Park" etc.)
  const firstTwo = lower.split(" ").filter(Boolean).slice(0, 2).join(" ");
  if (firstTwo.length >= 5) patterns.add(firstTwo);

  return [...patterns].filter((p) => p.length >= 3);
}

/**
 * Load provider hints from the existing source data JSON files.
 * @param {string} srcDataDir - path to src/data/ directory
 * @returns {{ patterns: string[], slug: string, name: string, location: string }[]}
 */
export function loadProviderHints(srcDataDir) {
  const sources = [
    join(srcDataDir, "apifyProviders.json"),
    join(srcDataDir, "yelpProviders.json"),
  ];

  const seen = new Set();
  const hints = [];

  for (const src of sources) {
    if (!existsSync(src)) continue;
    let providers;
    try {
      providers = JSON.parse(readFileSync(src, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(providers)) continue;

    for (const p of providers) {
      if (!p?.slug || !p?.name) continue;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);

      const patterns = generatePatterns(p.name);
      if (!patterns.length) continue;

      hints.push({
        patterns,
        slug: p.slug,
        name: p.name,
        location: p.locationLabel ?? "",
      });
    }
  }

  return hints;
}
