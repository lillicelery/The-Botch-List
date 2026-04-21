/**
 * Fetch cosmetic surgery posts from Reddit using the official OAuth2 API.
 *
 * Legal: Uses Reddit's official OAuth2 API (client credentials flow).
 * Only reads publicly accessible posts from public subreddits.
 * Rate limit: 60 requests/minute per Reddit API rules (we stay well under).
 * Register an app at: https://www.reddit.com/prefs/apps (script type)
 *
 * Usage (from repo root):
 *   npm run reddit:fetch
 *
 * Requires: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET in .env (see .env.example)
 *
 * After a successful run:
 *   npm run reddit:map
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isCosmeticSnippetText, inferCosmeticTags } from "../common/cosmeticFilters.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const clientId = process.env.REDDIT_CLIENT_ID?.trim();
const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET. Add them to your .env file.");
  process.exit(1);
}

const RATE_LIMIT_MS = 1100;
const MAX_POSTS_PER_QUERY = 100;

// Subreddits + search queries likely to surface Seattle-area cosmetic surgeon mentions
const SEARCH_CONFIGS = [
  { subreddit: "PlasticSurgery", query: "Seattle surgeon" },
  { subreddit: "PlasticSurgery", query: "Bellevue surgeon" },
  { subreddit: "PlasticSurgery", query: "Washington state rhinoplasty" },
  { subreddit: "PlasticSurgery", query: "Seattle rhinoplasty facelift" },
  { subreddit: "PlasticSurgery", query: "Seattle breast augmentation botox" },
  { subreddit: "Seattle", query: "plastic surgeon cosmetic" },
  { subreddit: "Seattle", query: "rhinoplasty facelift recommendation" },
  { subreddit: "seattlewa", query: "plastic surgeon cosmetic" },
];

// Mappings from post content → known Seattle providers (extend as data grows)
const SEATTLE_PROVIDER_HINTS = [
  { patterns: ["arias", "arias facial"], slug: "gm-cosmetic-dr-arias-seattle", name: "Arias Facial Plastic Surgery", location: "Seattle, WA" },
  { patterns: ["lin aesthetic", "dr lin", "lin surgery"], slug: "gm-cosmetic-dr-lin-bellevue", name: "Lin Aesthetic Surgery Center", location: "Bellevue, WA" },
  { patterns: ["mcintosh", "dr mcintosh"], slug: "gm-cosmetic-dr-mcintosh-seattle", name: "Dr. Bryan McIntosh", location: "Seattle, WA" },
  { patterns: ["levy aesthetics", "lévy aesthetics", "lewy aesthetics"], slug: "gm-cosmetic-levy-aesthetics", name: "Lévy Aesthetics", location: "Bellevue, WA" },
  { patterns: ["park cosmetic", "dr park"], slug: "gm-cosmetic-dr-park-seattle", name: "Park Cosmetic & Reconstructive", location: "Seattle, WA" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken() {
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "TheBotchList/1.0 (by /u/botchlist_bot)",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reddit auth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function redditGet(token, path, params = {}) {
  const url = new URL(`https://oauth.reddit.com${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(String(k), String(v));
  }
  await sleep(RATE_LIMIT_MS);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "TheBotchList/1.0 (by /u/botchlist_bot)",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reddit API ${res.status} for ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function detectProvider(text) {
  const lower = text.toLowerCase();
  for (const hint of SEATTLE_PROVIDER_HINTS) {
    if (hint.patterns.some((p) => lower.includes(p))) {
      return { slug: hint.slug, name: hint.name, location: hint.location };
    }
  }
  return null;
}

function mapPost(post) {
  const data = post?.data;
  if (!data) return null;

  const title = String(data.title ?? "").trim();
  const body = String(data.selftext ?? "").trim();
  const fullText = `${title} ${body}`;

  if (!isCosmeticSnippetText(fullText)) return null;
  if (title === "[deleted]" || title === "[removed]") return null;
  if (body === "[deleted]" || body === "[removed]") return null;

  const provider = detectProvider(fullText);
  if (!provider) return null;

  return {
    id: `reddit-api-${String(data.id ?? Math.random().toString(36).slice(2))}`,
    providerSlug: provider.slug,
    providerName: provider.name,
    locationLabel: provider.location,
    specialties: ["cosmetic", "surgery"],
    title: title.slice(0, 200),
    body: body.slice(0, 800),
    author: `u/${String(data.author ?? "deleted").replace(/^u\//, "")}`,
    subreddit: String(data.subreddit ?? ""),
    createdUtc: typeof data.created_utc === "number" ? data.created_utc : null,
    url: `https://www.reddit.com${String(data.permalink ?? "")}`,
    score: typeof data.score === "number" ? data.score : 0,
    procedureTags: inferCosmeticTags(fullText),
  };
}

console.log("Authenticating with Reddit API...");
const token = await getAccessToken();
console.log("Authentication successful.\n");

const allPosts = new Map();

for (const { subreddit, query } of SEARCH_CONFIGS) {
  console.log(`Searching r/${subreddit}: "${query}"`);
  let after = null;
  let fetched = 0;

  while (fetched < MAX_POSTS_PER_QUERY) {
    const params = { q: query, sort: "relevance", t: "year", limit: 25, restrict_sr: "true" };
    if (after) params.after = after;

    let data;
    try {
      data = await redditGet(token, `/r/${subreddit}/search`, params);
    } catch (err) {
      console.warn(`  Error:`, err.message);
      break;
    }

    const posts = data?.data?.children ?? [];
    if (!posts.length) break;

    for (const post of posts) {
      const mapped = mapPost(post);
      if (mapped && !allPosts.has(mapped.id)) {
        allPosts.set(mapped.id, mapped);
      }
    }

    fetched += posts.length;
    after = data?.data?.after;
    if (!after) break;
  }

  console.log(`  Found ${allPosts.size} relevant posts so far`);
}

const results = [...allPosts.values()];
console.log(`\nTotal cosmetic surgeon posts matched: ${results.length}`);

const outDir = join(__dirname, "output");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = join(outDir, `reddit-seattle-api-${stamp}.json`);

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Wrote ${results.length} posts to ${outPath}`);
console.log(`\nNext step: npm run reddit:map`);
