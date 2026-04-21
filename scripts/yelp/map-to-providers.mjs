/**
 * Map Yelp Fusion API dataset -> SearchProvider-shaped JSON for the app.
 * Cosmetic-only filter is enforced for both providers and snippets.
 *
 * Usage (from repo root):
 *   npm run yelp:map
 *
 * Reads from:  scripts/yelp/output/yelp-seattle-*.json
 * Writes to:   src/data/yelpProviders.json
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferCosmeticTags, isCosmeticProviderText, isCosmeticSnippetText } from "../common/cosmeticFilters.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "src", "data");
const OUT = join(OUT_DIR, "yelpProviders.json");
const MAX_EXCERPT_CHARS = 420;

function cardSentimentFromRating(rating) {
  if (rating == null || Number.isNaN(rating)) return "Okay";
  if (rating >= 4.5) return "Very Positive";
  if (rating >= 4) return "Positive";
  if (rating >= 3) return "Okay";
  if (rating >= 2) return "Negative";
  return "Very Negative";
}

function breakdownFromRating(rating) {
  if (rating == null || Number.isNaN(rating)) return { negative: 25, good: 50, veryGood: 25 };
  if (rating >= 4.5) return { negative: 8, good: 32, veryGood: 60 };
  if (rating >= 4) return { negative: 15, good: 45, veryGood: 40 };
  if (rating >= 3) return { negative: 30, good: 50, veryGood: 20 };
  if (rating >= 2) return { negative: 55, good: 35, veryGood: 10 };
  return { negative: 70, good: 22, veryGood: 8 };
}

function avgSentimentLabelFromRating(rating) {
  if (rating == null) return "No rating";
  if (rating >= 4.5) return "Mostly very positive (Yelp)";
  if (rating >= 4) return "Mostly positive (Yelp)";
  if (rating >= 3) return "Mixed (Yelp)";
  return "Below average (Yelp)";
}

function snippetSentimentFromRating(rating) {
  if (rating == null || Number.isNaN(rating)) return "Okay";
  if (rating >= 4) return "Positive";
  if (rating >= 3) return "Okay";
  return "Negative";
}

function cleanExcerpt(text) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= MAX_EXCERPT_CHARS) return s;
  return `${s.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd()}...`;
}

function toRelativeDateFromIso(value) {
  if (!value) return "Recently";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "Recently";
  const diffMs = Date.now() - d.valueOf();
  if (diffMs <= 0) return "Recently";
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 13) return `${months} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function slugFromBusiness(biz) {
  return `yelp-${String(biz.alias ?? biz.id ?? "unknown").replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 60)}`;
}

function tagsFromCategories(categories) {
  return (categories ?? []).map((c) => c.title ?? c.alias ?? "").filter(Boolean).slice(0, 4);
}

function specialtiesFromCategories(categories) {
  const blob = (categories ?? []).map((c) => `${c.title ?? ""} ${c.alias ?? ""}`).join(" ").toLowerCase();
  const out = new Set();
  if (blob.includes("plastic") || blob.includes("cosmetic") || blob.includes("aesthetic") || blob.includes("med spa")) out.add("cosmetic");
  if (blob.includes("surg")) out.add("surgery");
  if (out.size === 0) out.add("cosmetic");
  return [...out];
}

function mapBusinessToProvider(biz) {
  const name = String(biz.name ?? "Unknown");
  const categories = Array.isArray(biz.categories) ? biz.categories : [];
  const categoryText = categories.map((c) => `${c.title ?? ""} ${c.alias ?? ""}`).join(" ");
  const providerText = `${name} ${categoryText}`;

  if (!isCosmeticProviderText(providerText)) return null;

  const slug = slugFromBusiness(biz);
  const tags = tagsFromCategories(categories);
  const specialties = specialtiesFromCategories(categories);
  const city = String(biz.location?.city ?? "Seattle");
  const state = String(biz.location?.state ?? "WA");
  const locationLabel = `${city}, ${state}`;
  const rating = typeof biz.rating === "number" ? biz.rating : null;
  const reviewCount = typeof biz.review_count === "number" ? biz.review_count : 0;
  const url = String(biz.url ?? "");

  const rawReviews = Array.isArray(biz.fetchedReviews) ? biz.fetchedReviews : [];
  const snippets = rawReviews
    .map((r, idx) => {
      const excerpt = cleanExcerpt(r?.text ?? "");
      if (!excerpt || excerpt.length < 40) return null;
      if (!isCosmeticSnippetText(excerpt) && !isCosmeticProviderText(providerText)) return null;
      const cosmeticTags = inferCosmeticTags(excerpt);
      const fallbackTags = inferCosmeticTags(providerText);
      return {
        id: String(r?.id ?? `${slug}-yelp-${idx + 1}`),
        authorLabel: String(r?.user?.name ?? "Yelp reviewer"),
        postedRelative: toRelativeDateFromIso(r?.time_created),
        sentiment: snippetSentimentFromRating(typeof r?.rating === "number" ? r.rating : null),
        excerpt,
        procedureTags: cosmeticTags.length ? cosmeticTags : fallbackTags.length ? fallbackTags : tags.slice(0, 2),
        sourceName: "Yelp",
        sourceLogo: "yelp",
        originalUrl: String(r?.url ?? url),
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  const metaLine = `${tags[0] ?? "Provider"} - ${reviewCount} Yelp reviews - ${locationLabel}`;
  const summary =
    `Yelp listing. ${categoryText.trim() || "Cosmetic provider"}. ` +
    (snippets.length
      ? `Showing ${snippets.length} Yelp review snippet${snippets.length === 1 ? "" : "s"}.`
      : "No Yelp review snippets yet for this provider.");

  return {
    slug,
    name,
    metaLine,
    summary,
    cardSentiment: cardSentimentFromRating(rating),
    tags,
    specialties,
    locationLabel,
    stats: {
      snippetsCollected: snippets.length > 0 ? snippets.length : reviewCount,
      avgSentimentLabel: avgSentimentLabelFromRating(rating),
      topConcern: snippets.length > 0 ? "Recovery timeline and bedside manner" : "Cosmetic review themes still being extracted",
    },
    sentimentBreakdown: breakdownFromRating(rating),
    defaultProcedureFilters: (inferCosmeticTags(providerText).length ? inferCosmeticTags(providerText) : tags).slice(0, 3),
    snippets,
  };
}

function mergeBySlug(providers) {
  const bySlug = new Map();
  for (const p of providers) {
    const existing = bySlug.get(p.slug);
    if (!existing) {
      bySlug.set(p.slug, p);
      continue;
    }
    const snippetMap = new Map([
      ...(existing.snippets ?? []).map((s) => [s.id, s]),
      ...(p.snippets ?? []).map((s) => [s.id, s]),
    ]);
    bySlug.set(p.slug, {
      ...existing,
      tags: [...new Set([...(existing.tags ?? []), ...(p.tags ?? [])])].slice(0, 6),
      specialties: [...new Set([...(existing.specialties ?? []), ...(p.specialties ?? [])])],
      snippets: [...snippetMap.values()].slice(0, 8),
    });
  }
  return [...bySlug.values()];
}

function resolveInputPaths() {
  const arg = process.argv[2];
  if (arg) return [arg];
  const dir = join(__dirname, "output");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.startsWith("yelp-seattle-") && f.endsWith(".json"));
  } catch {
    files = [];
  }
  if (!files.length) {
    console.error("No yelp-seattle-*.json in scripts/yelp/output/. Run npm run yelp:fetch first.");
    process.exit(1);
  }
  files.sort();
  return files.map((f) => join(dir, f));
}

const inputPaths = resolveInputPaths();
const allItems = [];
for (const inputPath of inputPaths) {
  const raw = JSON.parse(readFileSync(inputPath, "utf8"));
  const items = Array.isArray(raw.items) ? raw.items : Array.isArray(raw) ? raw : [];
  allItems.push(...items);
}

const providers = mergeBySlug(allItems.map(mapBusinessToProvider).filter(Boolean));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(providers, null, 2), "utf8");
console.log(`Mapped ${providers.length} cosmetic providers from ${inputPaths.length} Yelp file(s)`);
console.log(`Wrote ${OUT}`);
