/**
 * Fetch cosmetic surgery posts + comment threads from Reddit via Apify's Reddit scraper.
 *
 * Why this over the official Reddit OAuth2 API (scripts/reddit/fetch.mjs):
 * - Gets full comment trees — where most provider recommendations actually appear
 * - No Reddit credentials needed; Apify handles authentication internally
 *
 * Actor: trudax/reddit-scraper
 * Requires: APIFY_TOKEN in .env (reuses existing token)
 *
 * Usage (from repo root):
 *   npm run reddit:apify
 *
 * After a successful run:
 *   npm run reddit:map
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApifyClient } from "apify-client";
import { isCosmeticSnippetText, inferCosmeticTags } from "../common/cosmeticFilters.mjs";
import { loadProviderHints } from "../common/providerHints.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "src", "data");
const ACTOR_ID = "trudax/reddit-scraper-lite";

const token = process.env.APIFY_TOKEN?.trim();
if (!token) {
  console.error("Missing APIFY_TOKEN. Add it to your .env file.");
  process.exit(1);
}

// 14 searches across r/PlasticSurgery + procedure-specific communities (~$0.08–$0.12)
const SEARCHES = [
  // r/PlasticSurgery — recommendations AND personal experiences
  { subreddit: "PlasticSurgery", query: "plastic surgeon" },
  { subreddit: "PlasticSurgery", query: "cosmetic surgeon" },
  { subreddit: "PlasticSurgery", query: "my surgeon" },
  { subreddit: "PlasticSurgery", query: "surgeon review" },
  // Procedure-specific communities — people name their surgeon in nearly every post
  { subreddit: "Rhinoplasty", query: "surgeon" },
  { subreddit: "Rhinoplasty", query: "my doctor" },
  { subreddit: "BreastImplants", query: "surgeon" },
  { subreddit: "BreastImplants", query: "my surgeon" },
  { subreddit: "Botox", query: "injector" },
  { subreddit: "Botox", query: "med spa" },
  // City-scoped queries to match providers in NY, FL, WA already in the DB
  { subreddit: "PlasticSurgery", query: "Seattle surgeon" },
  { subreddit: "PlasticSurgery", query: "Miami surgeon" },
  { subreddit: "PlasticSurgery", query: "New York surgeon" },
  { subreddit: "PlasticSurgery", query: "NYC rhinoplasty" },
];

function buildSearchUrl({ subreddit, query }) {
  return `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(query)}&sort=relevance&t=year&type=link&restrict_sr=1`;
}

// Defensive field accessors — different actor versions use different key names
function getField(obj, ...keys) {
  for (const k of keys) if (obj[k] != null) return obj[k];
}
function postId(item)     { return String(getField(item, "id", "postId") ?? Math.random().toString(36).slice(2)); }
function postTitle(item)  { return String(getField(item, "title", "postTitle") ?? "").trim(); }
function postBody(item)   { return String(getField(item, "body", "text", "selftext") ?? "").trim(); }
function postUrl(item)    { return String(getField(item, "url", "postUrl") ?? "https://www.reddit.com/"); }
function itemScore(item)  { return Number(getField(item, "upVotes", "score", "ups") ?? 0); }
function itemSubreddit(item) { return String(getField(item, "subredditName", "subreddit", "community") ?? ""); }

function itemAuthor(item) {
  const a = getField(item, "author", "authorName", "username");
  if (a && typeof a === "object") return `u/${a.name ?? "deleted"}`;
  return `u/${String(a ?? "deleted").replace(/^u\//, "")}`;
}

function itemCreatedUtc(item) {
  const raw = getField(item, "createdAt", "created_utc", "created", "date");
  if (typeof raw === "number") return raw > 1e12 ? Math.floor(raw / 1000) : raw;
  if (typeof raw === "string") { const t = Date.parse(raw); return isNaN(t) ? null : Math.floor(t / 1000); }
  return null;
}

function itemComments(item) {
  const c = getField(item, "comments", "topComments", "commentsData");
  return Array.isArray(c) ? c : [];
}

function commentBody(c)    { return String(getField(c, "body", "text", "content") ?? "").trim(); }
function commentId(c)      { return String(getField(c, "id", "commentId") ?? Math.random().toString(36).slice(2)); }
function commentReplies(c) { const r = getField(c, "replies", "children", "nested"); return Array.isArray(r) ? r : []; }

function flattenComments(comments, maxDepth = 2) {
  const out = [];
  function walk(items, depth) {
    if (depth < 0 || !items?.length) return;
    for (const c of items) {
      out.push(c);
      walk(commentReplies(c), depth - 1);
    }
  }
  walk(comments, maxDepth);
  return out;
}

function detectProvider(text, hints) {
  const lower = text.toLowerCase();
  for (const hint of hints) {
    if (hint.patterns.some((p) => lower.includes(p))) return hint;
  }
  return null;
}

// --- Main ---

const hints = loadProviderHints(DATA_DIR);
console.log(`Loaded ${hints.length} provider hints from src/data/\n`);

if (!hints.length) {
  console.error("No provider hints found. Run npm run apify:map (or yelp:map) first to populate src/data/.");
  process.exit(1);
}

const client = new ApifyClient({ token });
const startUrls = SEARCHES.map((s) => ({ url: buildSearchUrl(s) }));

console.log(`Starting ${ACTOR_ID} with ${SEARCHES.length} search URLs...`);
startUrls.forEach((u) => console.log(" ", u.url));

const run = await client.actor(ACTOR_ID).call({
  startUrls,
  maxItems: 20,
  maxComments: 50,
  maxCommentsDepth: 2,
});

const datasetId = run.defaultDatasetId;
if (!datasetId) {
  console.error("Actor run returned no dataset:", run);
  process.exit(1);
}

console.log(`\nRun complete: ${run.id} | Status: ${run.status} | Dataset: ${datasetId}`);

const { items } = await client.dataset(datasetId).listItems({ limit: 5000 });
console.log(`Retrieved ${items.length} posts`);

if (items.length > 0) {
  console.log("Item keys detected:", Object.keys(items[0]).join(", "));
}

const allResults = new Map();

for (const item of items) {
  const pid = postId(item);
  const title = postTitle(item);
  const body = postBody(item);
  const url = postUrl(item);
  const author = itemAuthor(item);
  const score = itemScore(item);
  const created = itemCreatedUtc(item);
  const subreddit = itemSubreddit(item);

  // Check post itself
  const postText = `${title} ${body}`;
  if (isCosmeticSnippetText(postText)) {
    const provider = detectProvider(postText, hints);
    if (provider) {
      const id = `reddit-apify-post-${pid}`;
      if (!allResults.has(id)) {
        allResults.set(id, {
          id,
          providerSlug: provider.slug,
          providerName: provider.name,
          locationLabel: provider.location,
          title: title.slice(0, 200),
          body: body.slice(0, 800),
          author,
          subreddit,
          createdUtc: created,
          url,
          score,
          procedureTags: inferCosmeticTags(postText),
        });
      }
    }
  }

  // Check all comments (flattened to depth 2)
  for (const comment of flattenComments(itemComments(item))) {
    const cbody = commentBody(comment);
    if (!cbody || !isCosmeticSnippetText(cbody)) continue;
    const provider = detectProvider(cbody, hints);
    if (!provider) continue;

    const id = `reddit-apify-comment-${pid}-${commentId(comment)}`;
    if (!allResults.has(id)) {
      allResults.set(id, {
        id,
        providerSlug: provider.slug,
        providerName: provider.name,
        locationLabel: provider.location,
        title: title.slice(0, 200),
        body: cbody.slice(0, 800),
        author: itemAuthor(comment),
        subreddit,
        createdUtc: itemCreatedUtc(comment) ?? created,
        url,
        score: itemScore(comment),
        procedureTags: inferCosmeticTags(cbody),
      });
    }
  }
}

const results = [...allResults.values()];
console.log(`\nMatched ${results.length} rows (posts + comments with provider mentions)`);

const outDir = join(__dirname, "output");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = join(outDir, `reddit-apify-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} rows to ${outPath}`);
console.log(`\nNext step: npm run reddit:map`);
