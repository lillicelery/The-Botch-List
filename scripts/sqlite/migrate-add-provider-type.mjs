/**
 * Migration: add provider_type column and classify all existing rows.
 * Safe to re-run — skips rows already classified, skips column creation if present.
 *
 * Usage:
 *   npm run sqlite:migrate:provider-type
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbPath = join(projectRoot, "data", "botch.db");

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}\nRun npm run sqlite:import first.`);
  process.exit(1);
}

const PLACE_TAGS = new Set([
  "medical spa", "medspa", "spa", "beauty salon", "day spa", "clinic",
  "health clinic", "cosmetic surgery clinic", "plastic surgery clinic",
  "skin care clinic", "surgical center", "medical center", "nail salon",
  "laser hair removal service", "aesthetics", "aesthetic medicine",
  "beauty school", "hair salon", "wellness center", "health and wellness centre",
  "facial spa", "health and beauty shop", "weight loss service", "iv therapy service",
]);

const PRACTITIONER_TAGS = new Set([
  "cosmetic surgeon", "dermatologist", "plastic surgeon", "surgeon",
  "physician", "doctor", "nurse", "aesthetician", "nurse practitioner",
  "general practitioner", "skin care specialist", "medical doctor",
]);

function classify(tagsJson) {
  let tags = [];
  try { tags = JSON.parse(tagsJson); } catch { return "place"; }
  const lower = tags.map((t) => String(t).toLowerCase().trim());
  for (const t of lower) { if (PRACTITIONER_TAGS.has(t)) return "practitioner"; }
  for (const t of lower) { if (PLACE_TAGS.has(t)) return "place"; }
  return "place";
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const existingColumns = db.pragma("table_info(providers)").map((c) => c.name);
if (!existingColumns.includes("provider_type")) {
  db.exec(`ALTER TABLE providers ADD COLUMN provider_type TEXT CHECK(provider_type IN ('place', 'practitioner'))`);
  console.log("Added provider_type column.");
} else {
  console.log("provider_type column already exists — skipping ALTER TABLE.");
}

const unclassified = db.prepare("SELECT slug, tags_json FROM providers WHERE provider_type IS NULL").all();
console.log(`Classifying ${unclassified.length} unclassified rows...`);

const update = db.prepare("UPDATE providers SET provider_type = ? WHERE slug = ?");
const applyAll = db.transaction(() => {
  for (const row of unclassified) {
    update.run(classify(row.tags_json), row.slug);
  }
});
applyAll();

const counts = db.prepare("SELECT provider_type, COUNT(*) AS n FROM providers GROUP BY provider_type").all();
db.close();

console.log("\nClassification breakdown:");
for (const { provider_type, n } of counts) {
  console.log(`  ${provider_type ?? "null"}: ${n}`);
}
console.log("\nMigration complete.");
