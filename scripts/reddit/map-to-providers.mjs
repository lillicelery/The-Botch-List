/**
 * Map curated Reddit post exports -> SearchProvider-shaped JSON.
 * Cosmetic-only filter is enforced for provider text and snippets.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferCosmeticTags, isCosmeticProviderText, isCosmeticSnippetText } from "../common/cosmeticFilters.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "src", "data");
const OUT = join(OUT_DIR, "redditProviders.json");
const FALLBACK_LOCATION = "Seattle, WA";

function toRelativeDateFromUtc(value) {
  if (typeof value !== "number") return "Recently";
  const ms = value > 1e12 ? value : value * 1000;
  const d = new Date(ms);
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

function scoreToSentiment(score) {
  if (typeof score !== "number") return "Okay";
  if (score >= 8) return "Positive";
  if (score >= 1) return "Okay";
  return "Negative";
}

function cleanText(title, body) {
  return `${title ?? ""} ${body ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 420);
}

function resolveInputPath() {
  const arg = process.argv[2];
  if (arg) return arg;
  const dir = join(__dirname, "output");
  const files = readdirSync(dir).filter((f) => f.startsWith("reddit-") && f.endsWith(".json")).sort();
  if (!files.length) return null;
  return join(dir, files[files.length - 1]);
}

const inputPath = resolveInputPath();
if (!inputPath) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, "[]\n", "utf8");
  console.log("No reddit-*.json found. Wrote empty src/data/redditProviders.json");
  process.exit(0);
}

const rows = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(rows)) {
  throw new Error("Reddit input must be a JSON array.");
}

const grouped = new Map();
for (const r of rows) {
  if (!r || typeof r !== "object") continue;
  const providerSlug = String(r.providerSlug ?? "").trim();
  if (!providerSlug) continue;

  const providerName = String(r.providerName ?? providerSlug).trim();
  const locationLabel = String(r.locationLabel ?? FALLBACK_LOCATION).trim() || FALLBACK_LOCATION;
  const providerContext = `${providerName} ${r.title ?? ""} ${r.body ?? ""}`;
  if (!isCosmeticProviderText(providerContext)) continue;

  const excerpt = cleanText(r.title, r.body);
  if (!excerpt || !isCosmeticSnippetText(excerpt)) continue;

  const inferredTags = inferCosmeticTags(excerpt);
  const snippet = {
    id: String(r.id ?? `${providerSlug}-${Math.random().toString(36).slice(2, 8)}`),
    authorLabel: String(r.author ?? "u/reddit-user"),
    postedRelative: toRelativeDateFromUtc(r.createdUtc),
    sentiment: scoreToSentiment(r.score),
    excerpt,
    procedureTags: inferredTags.length ? inferredTags : ["Cosmetic discussion"],
    sourceName: "Reddit",
    sourceLogo: "reddit",
    originalUrl: String(r.url ?? "https://www.reddit.com/"),
  };

  if (!grouped.has(providerSlug)) {
    grouped.set(providerSlug, {
      slug: providerSlug,
      name: providerName,
      metaLine: `Cosmetic community discussion - Reddit mentions - ${locationLabel}`,
      summary: "Cosmetic surgery posts from Reddit mapped into provider snippets.",
      cardSentiment: "Okay",
      tags: ["Reddit", "Cosmetic"],
      specialties: ["cosmetic", "surgery"],
      locationLabel,
      stats: {
        snippetsCollected: 0,
        avgSentimentLabel: "Mixed from cosmetic community posts",
        topConcern: "Results and recovery expectations",
      },
      sentimentBreakdown: { negative: 34, good: 33, veryGood: 33 },
      defaultProcedureFilters: inferredTags.length ? inferredTags : ["Cosmetic discussion"],
      snippets: [],
    });
  }

  grouped.get(providerSlug).snippets.push(snippet);
}

const providers = [...grouped.values()].map((p) => {
  p.stats.snippetsCollected = p.snippets.length;
  return p;
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(providers, null, 2), "utf8");
console.log(`Mapped ${providers.length} cosmetic Reddit provider groups from ${inputPath}`);
console.log(`Wrote ${OUT}`);
