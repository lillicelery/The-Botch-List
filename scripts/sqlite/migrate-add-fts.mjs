/**
 * One-time migration: add FTS (full-text search) virtual tables to an existing botch.db.
 * Safe to run multiple times — uses IF NOT EXISTS.
 *
 * Usage:
 *   npm run sqlite:migrate:fts
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbDir = join(projectRoot, "data");
const dbPath = join(dbDir, "botch.db");

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Run sqlite:import:apify first.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("Adding FTS virtual tables...");

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

console.log("Rebuilding FTS indexes from existing data...");

db.exec(`
  INSERT INTO providers_fts(providers_fts) VALUES('rebuild');
  INSERT INTO snippets_fts(snippets_fts) VALUES('rebuild');
`);

const providerFtsCount = db.prepare("SELECT COUNT(*) AS c FROM providers_fts").get().c;
const snippetFtsCount = db.prepare("SELECT COUNT(*) AS c FROM snippets_fts").get().c;
db.close();

console.log(`FTS ready: ${providerFtsCount} providers, ${snippetFtsCount} snippets indexed.`);
