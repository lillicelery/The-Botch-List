/**
 * Import providers from one or all source JSON files into botch.db.
 * Supports multi-source import with --source flag.
 * Also creates FTS (full-text search) virtual tables for fast querying.
 *
 * Usage:
 *   npm run sqlite:import           # import all sources
 *   npm run sqlite:import -- --source=apify
 *   npm run sqlite:import -- --source=yelp
 *   npm run sqlite:import -- --source=reddit
 *   node scripts/sqlite/import-providers.mjs path/to/custom.json
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbDir = join(projectRoot, "data");
const dbPath = join(dbDir, "botch.db");

const SOURCE_MAP = {
  apify: join(projectRoot, "src", "data", "apifyProviders.json"),
  yelp: join(projectRoot, "src", "data", "yelpProviders.json"),
  reddit: join(projectRoot, "src", "data", "redditProviders.json"),
};

function resolveInputPaths() {
  // if a direct file path is passed, use it
  const maybeFile = process.argv[2];
  if (maybeFile && !maybeFile.startsWith("--")) return [{ source: "custom", path: maybeFile }];

  // check --source= flag
  const sourceFlag = process.argv.find((a) => a.startsWith("--source="));
  const source = sourceFlag ? sourceFlag.replace("--source=", "").trim() : "all";

  if (source === "all") {
    return Object.entries(SOURCE_MAP)
      .filter(([, p]) => existsSync(p))
      .map(([s, p]) => ({ source: s, path: p }));
  }

  if (!SOURCE_MAP[source]) {
    console.error(`Unknown source "${source}". Use: apify, yelp, reddit, or all`);
    process.exit(1);
  }
  if (!existsSync(SOURCE_MAP[source])) {
    console.error(`Source file not found: ${SOURCE_MAP[source]}`);
    process.exit(1);
  }
  return [{ source, path: SOURCE_MAP[source] }];
}

const inputPaths = resolveInputPaths();
if (!inputPaths.length) {
  console.log("No source files found. Run the scraper scripts first.");
  process.exit(0);
}

mkdirSync(dbDir, { recursive: true });
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location_label TEXT,
    card_sentiment TEXT,
    tags_json TEXT NOT NULL,
    specialties_json TEXT NOT NULL,
    snippet_count INTEGER NOT NULL DEFAULT 0,
    raw_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    provider_slug TEXT NOT NULL,
    author_label TEXT,
    posted_relative TEXT,
    sentiment TEXT,
    excerpt TEXT NOT NULL,
    source_name TEXT,
    original_url TEXT,
    procedure_tags_json TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    FOREIGN KEY (provider_slug) REFERENCES providers(slug) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_providers_name ON providers(name);
  CREATE INDEX IF NOT EXISTS idx_providers_location ON providers(location_label);
  CREATE INDEX IF NOT EXISTS idx_snippets_provider_slug ON snippets(provider_slug);
`);

// FTS virtual tables for full-text search — created once, kept in sync by triggers
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS providers_fts USING fts5(
    slug UNINDEXED,
    name,
    location_label,
    tags_json,
    content='providers',
    content_rowid='rowid'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
    id UNINDEXED,
    provider_slug UNINDEXED,
    excerpt,
    procedure_tags_json,
    content='snippets',
    content_rowid='rowid'
  );
`);

const insertProvider = db.prepare(`
  INSERT INTO providers (slug, name, location_label, card_sentiment, tags_json, specialties_json, snippet_count, raw_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    location_label = excluded.location_label,
    card_sentiment = excluded.card_sentiment,
    tags_json = excluded.tags_json,
    specialties_json = excluded.specialties_json,
    snippet_count = excluded.snippet_count,
    raw_json = excluded.raw_json
`);

const insertSnippet = db.prepare(`
  INSERT INTO snippets (id, provider_slug, author_label, posted_relative, sentiment, excerpt, source_name, original_url, procedure_tags_json, raw_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    provider_slug = excluded.provider_slug,
    author_label = excluded.author_label,
    posted_relative = excluded.posted_relative,
    sentiment = excluded.sentiment,
    excerpt = excluded.excerpt,
    source_name = excluded.source_name,
    original_url = excluded.original_url,
    procedure_tags_json = excluded.procedure_tags_json,
    raw_json = excluded.raw_json
`);

const clearSnippetsForProvider = db.prepare("DELETE FROM snippets WHERE provider_slug = ?");

const importTx = db.transaction((rows) => {
  for (const provider of rows) {
    const slug = String(provider?.slug ?? "").trim();
    if (!slug) continue;

    const snippets = Array.isArray(provider?.snippets) ? provider.snippets : [];
    insertProvider.run(
      slug,
      String(provider?.name ?? "Unknown"),
      provider?.locationLabel ? String(provider.locationLabel) : null,
      provider?.cardSentiment ? String(provider.cardSentiment) : null,
      JSON.stringify(Array.isArray(provider?.tags) ? provider.tags : []),
      JSON.stringify(Array.isArray(provider?.specialties) ? provider.specialties : []),
      snippets.length,
      JSON.stringify(provider)
    );

    clearSnippetsForProvider.run(slug);
    for (const snippet of snippets) {
      const id = String(snippet?.id ?? "").trim();
      if (!id) continue;
      insertSnippet.run(
        id,
        slug,
        snippet?.authorLabel ? String(snippet.authorLabel) : null,
        snippet?.postedRelative ? String(snippet.postedRelative) : null,
        snippet?.sentiment ? String(snippet.sentiment) : null,
        String(snippet?.excerpt ?? ""),
        snippet?.sourceName ? String(snippet.sourceName) : null,
        snippet?.originalUrl ? String(snippet.originalUrl) : null,
        JSON.stringify(Array.isArray(snippet?.procedureTags) ? snippet.procedureTags : []),
        JSON.stringify(snippet)
      );
    }
  }
});

let totalProviders = 0;
let totalSnippets = 0;

for (const { source, path: inputPath } of inputPaths) {
  const providers = JSON.parse(readFileSync(inputPath, "utf8"));
  if (!Array.isArray(providers)) {
    console.warn(`Skipping ${inputPath}: not a JSON array`);
    continue;
  }
  importTx(providers);
  console.log(`Imported ${providers.length} providers from ${source} (${inputPath})`);
  totalProviders += providers.length;
  totalSnippets += providers.reduce((n, p) => n + (Array.isArray(p?.snippets) ? p.snippets.length : 0), 0);
}

// Rebuild FTS indexes to match current table state
db.exec(`
  INSERT INTO providers_fts(providers_fts) VALUES('rebuild');
  INSERT INTO snippets_fts(snippets_fts) VALUES('rebuild');
`);

const providerCount = db.prepare("SELECT COUNT(*) AS count FROM providers").get().count;
const snippetCount = db.prepare("SELECT COUNT(*) AS count FROM snippets").get().count;
db.close();

console.log(`\nDB totals: ${providerCount} providers, ${snippetCount} snippets in ${dbPath}`);
console.log(`Session imported: ${totalProviders} providers, ${totalSnippets} snippets`);
