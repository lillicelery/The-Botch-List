/**
 * Map Apify Google Maps dataset items -> SearchProvider-shaped JSON for the app.
 *
 * Usage:
 *   node scripts/apify/map-to-providers.mjs [path/to/google-maps-*.json]
 * If omitted, uses the newest matching file in scripts/apify/output/.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "src", "data");
const OUT = join(OUT_DIR, "apifyProviders.json");

const MAX_EXCERPT_CHARS = 420;

const US_STATE_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

function cardSentimentFromScore(score) {
  if (score == null || Number.isNaN(score)) return "Okay";
  if (score >= 4.5) return "Very Positive";
  if (score >= 4) return "Positive";
  if (score >= 3) return "Okay";
  if (score >= 2) return "Negative";
  return "Very Negative";
}

function breakdownFromScore(score) {
  if (score == null || Number.isNaN(score)) return { negative: 25, good: 50, veryGood: 25 };
  if (score >= 4.5) return { negative: 8, good: 32, veryGood: 60 };
  if (score >= 4) return { negative: 15, good: 45, veryGood: 40 };
  if (score >= 3) return { negative: 30, good: 50, veryGood: 20 };
  if (score >= 2) return { negative: 55, good: 35, veryGood: 10 };
  return { negative: 70, good: 22, veryGood: 8 };
}

function avgSentimentLabelFromScore(score) {
  if (score == null || Number.isNaN(score)) return "No rating";
  if (score >= 4.5) return "Mostly very positive (Google)";
  if (score >= 4) return "Mostly positive (Google)";
  if (score >= 3) return "Mixed (Google)";
  if (score >= 2) return "Below average (Google)";
  return "Low ratings (Google)";
}

function specialtiesFromCategories(categories) {
  const blob = (categories ?? []).join(" ").toLowerCase();
  const out = new Set();
  if (blob.includes("neurolog")) out.add("neurology");
  if (blob.includes("physical") || blob.includes("orthopedic") || blob.includes("sports") || blob.includes("rehab")) {
    out.add("orthopedics");
  }
  if (blob.includes("sports")) out.add("sports");
  if (out.size === 0) out.add("orthopedics");
  return [...out];
}

function snippetSentimentFromStars(stars) {
  if (stars == null || Number.isNaN(stars)) return "Okay";
  if (stars >= 4) return "Positive";
  if (stars >= 3) return "Okay";
  return "Negative";
}

function toRelativeDate(value) {
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
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 13) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year ago" : `${years} years ago`;
}

function cleanExcerpt(rawText) {
  const collapsed = String(rawText ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]+/g, " ")
    .trim();
  if (!collapsed) return "";
  if (collapsed.length <= MAX_EXCERPT_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd()}...`;
}

function inferProcedureTags(text, categoryTags) {
  const t = text.toLowerCase();
  const inferred = [];
  const rules = [
    ["knee", "Knee"],
    ["shoulder", "Shoulder"],
    ["back", "Back pain"],
    ["hip", "Hip"],
    ["ankle", "Ankle"],
    ["neck", "Neck pain"],
    ["sciatica", "Sciatica"],
    ["acl", "ACL rehab"],
    ["surgery", "Post-surgical rehab"],
    ["injury", "Sports injury"],
  ];
  for (const [needle, label] of rules) {
    if (t.includes(needle)) inferred.push(label);
    if (inferred.length >= 3) break;
  }
  if (inferred.length === 0) return categoryTags.slice(0, 3);
  return [...new Set(inferred)].slice(0, 3);
}

function shouldSkipReview(text) {
  if (text.length < 40) return true;
  const lower = text.toLowerCase();
  if (lower.includes("http://") || lower.includes("https://")) return true;
  return false;
}

function mapReviewsToSnippets(row, slug, tags, fallbackUrl) {
  const rawReviews = Array.isArray(row.reviews) ? row.reviews : [];
  return rawReviews
    .map((r, idx) => {
      const excerpt = cleanExcerpt(r?.text ?? r?.textTranslated ?? r?.reviewText ?? "");
      if (!excerpt || shouldSkipReview(excerpt)) return null;

      const stars = typeof r?.stars === "number" ? r.stars : typeof r?.rating === "number" ? r.rating : null;
      const dateCandidate = r?.publishedAtDate ?? r?.publishedAt ?? r?.date ?? null;
      const authorLabel = String(r?.name ?? r?.reviewerName ?? r?.authorName ?? "Public review").trim() || "Public review";
      const reviewId = String(r?.reviewId ?? `${slug}-google-${idx + 1}`);
      const originalUrl = String(r?.reviewUrl ?? r?.url ?? fallbackUrl ?? "");

      return {
        id: reviewId,
        authorLabel,
        postedRelative: toRelativeDate(dateCandidate),
        sentiment: snippetSentimentFromStars(stars),
        excerpt,
        procedureTags: inferProcedureTags(excerpt, tags),
        sourceName: "Google Maps",
        sourceLogo: "google",
        originalUrl,
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function mapRow(row) {
  const placeId = typeof row.placeId === "string" ? row.placeId : "";
  const slug = placeId ? `gm-${placeId}` : `gm-${hashSlug(String(row.title ?? "unknown"))}`;
  const title = String(row.title ?? "Unknown place");
  const categoryName = row.categoryName != null ? String(row.categoryName) : "Provider";
  const categories = Array.isArray(row.categories) ? row.categories.map(String) : [];
  const city = String(row.city ?? "");
  const stateName = String(row.state ?? "");
  const stateAbbr = US_STATE_ABBR[stateName] ?? stateName.slice(0, 2).toUpperCase();
  const locationLabel = city && stateAbbr ? `${city}, ${stateAbbr}` : city || stateName || "Unknown";
  const reviewsCount = typeof row.reviewsCount === "number" ? row.reviewsCount : 0;
  const totalScore = typeof row.totalScore === "number" ? row.totalScore : null;
  const sourceUrl = String(row.url ?? "");

  const tags = categories.length ? categories.slice(0, 4) : [categoryName];
  const snippets = mapReviewsToSnippets(row, slug, tags, sourceUrl);

  const metaLine = `${categoryName} - ${reviewsCount} Google reviews - ${locationLabel}`;
  const summary =
    `Google Maps listing. ${categoryName}. ` +
    (categories.length ? `Categories: ${categories.slice(0, 5).join(", ")}. ` : "") +
    (snippets.length
      ? `Showing ${snippets.length} scraped review snippet${snippets.length === 1 ? "" : "s"}.`
      : "No scraped review snippets yet for this provider.");

  return {
    slug,
    name: title,
    metaLine,
    summary,
    cardSentiment: cardSentimentFromScore(totalScore),
    tags,
    specialties: specialtiesFromCategories(categories.length ? categories : [categoryName]),
    locationLabel,
    stats: {
      snippetsCollected: snippets.length > 0 ? snippets.length : reviewsCount,
      avgSentimentLabel: avgSentimentLabelFromScore(totalScore),
      topConcern: snippets.length > 0 ? "Wait times and communication" : "Review themes still being extracted",
    },
    sentimentBreakdown: breakdownFromScore(totalScore),
    defaultProcedureFilters: tags.slice(0, 3),
    snippets,
  };
}

function hashSlug(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function resolveInputPath() {
  const arg = process.argv[2];
  if (arg) return arg;
  const dir = join(__dirname, "output");
  const files = readdirSync(dir).filter((f) => f.startsWith("google-maps-") && f.endsWith(".json"));
  if (!files.length) {
    console.error("No google-maps-*.json in scripts/apify/output/. Run npm run apify:maps first.");
    process.exit(1);
  }
  files.sort();
  return join(dir, files[files.length - 1]);
}

const inputPath = resolveInputPath();
const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const items = Array.isArray(raw.items) ? raw.items : [];
const providers = items.map((row) => mapRow(row));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(providers, null, 2), "utf8");
console.log(`Mapped ${providers.length} places from ${inputPath}`);
console.log(`Wrote ${OUT}`);
