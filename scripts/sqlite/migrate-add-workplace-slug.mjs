/**
 * One-time migration: add workplace_slug column to the providers table.
 * Safe to run multiple times — checks if column already exists first.
 *
 * Usage:
 *   npm run sqlite:migrate:workplace-slug
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Run sqlite:import first.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const columns = db.prepare("PRAGMA table_info(providers)").all().map((c) => c.name);

if (columns.includes("workplace_slug")) {
  console.log("Column workplace_slug already exists — nothing to do.");
  db.close();
  process.exit(0);
}

db.exec(`
  ALTER TABLE providers
  ADD COLUMN workplace_slug TEXT REFERENCES providers(slug);
`);

db.close();
console.log("Migration complete: providers.workplace_slug added.");
