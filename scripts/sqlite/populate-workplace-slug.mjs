/**
 * Populate workplace_slug on practitioner rows by name-matching against place rows.
 *
 * Strategy: for each practitioner, extract their human name (strip titles/credentials),
 * then check if that name appears inside any place's name in the same city.
 * If exactly one place matches, set workplace_slug.
 *
 * Usage:
 *   node scripts/sqlite/populate-workplace-slug.mjs          # dry run (no writes)
 *   node scripts/sqlite/populate-workplace-slug.mjs --apply  # write to DB
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const DRY_RUN = !process.argv.includes("--apply");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}.`);
  process.exit(1);
}

const db = new Database(dbPath, DRY_RUN ? { readonly: true } : undefined);
if (!DRY_RUN) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
}

// ── tag sets (mirrors src/lib/providerType.ts) ───────────────────────────────

const PLACE_TAGS = new Set([
  "medical spa", "medspa", "spa", "beauty salon", "day spa", "clinic",
  "health clinic", "cosmetic surgery clinic", "medical center", "nail salon",
  "laser hair removal service", "aesthetics", "aesthetic medicine",
  "beauty school", "hair salon", "wellness center", "health and wellness centre",
]);

const PRACTITIONER_TAGS = new Set([
  "cosmetic surgeon", "dermatologist", "plastic surgeon", "surgeon",
  "physician", "doctor", "nurse", "aesthetician", "nurse practitioner",
  "general practitioner", "skin care specialist", "medical doctor",
]);

function classify(tagsJson) {
  const tags = JSON.parse(tagsJson).map((t) => t.toLowerCase().trim());
  if (tags.some((t) => PLACE_TAGS.has(t))) return "place";
  if (tags.some((t) => PRACTITIONER_TAGS.has(t))) return "practitioner";
  return "place";
}

// ── name normalisation ───────────────────────────────────────────────────────

const TITLE_RE = /\b(dr\.?|md|do|facs|faad|rn|np|pa|dds|dmd|phd|ms|bs|bsc|m\.d\.?|d\.o\.?)\b\.?/gi;
const PUNCT_RE = /[|:,\-–—]/g;

function extractHumanName(raw) {
  return raw
    .replace(TITLE_RE, " ")
    .replace(PUNCT_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
}

/** Return tokens of length ≥ 4 (skip noise words like "and", "the"). */
function nameTokens(name) {
  return name.split(/\s+/).filter((t) => t.length >= 4);
}

// ── load all providers ───────────────────────────────────────────────────────

const all = db
  .prepare("SELECT slug, name, location_label, tags_json FROM providers")
  .all();

const places = all.filter((r) => classify(r.tags_json) === "place");
const practitioners = all.filter((r) => classify(r.tags_json) === "practitioner");

console.log(`Loaded ${all.length} providers — ${places.length} places, ${practitioners.length} practitioners`);

// ── build place lookup: city → [place rows] ──────────────────────────────────

const placesByCity = new Map();
for (const p of places) {
  const city = p.location_label?.toLowerCase().trim() ?? "";
  if (!placesByCity.has(city)) placesByCity.set(city, []);
  placesByCity.get(city).push({ ...p, nameLower: p.name.toLowerCase() });
}

// ── match ────────────────────────────────────────────────────────────────────

const matches = []; // { practitionerSlug, placeSlug, practitionerName, placeName }
const ambiguous = []; // multiple place matches — skip to avoid wrong links
const unmatched = [];

for (const practitioner of practitioners) {
  const city = practitioner.location_label?.toLowerCase().trim() ?? "";
  const cityPlaces = placesByCity.get(city) ?? [];

  if (cityPlaces.length === 0) {
    unmatched.push(practitioner.name);
    continue;
  }

  const cleanName = extractHumanName(practitioner.name);
  const tokens = nameTokens(cleanName);

  if (tokens.length === 0) {
    unmatched.push(practitioner.name);
    continue;
  }

  // A place matches if ALL significant tokens from the practitioner name appear in the place name.
  const hits = cityPlaces.filter((place) =>
    tokens.every((tok) => place.nameLower.includes(tok))
  );

  // Skip self-match: practitioner name basically IS the place name (same entity, different classification)
  const nonSelf = hits.filter((place) => place.slug !== practitioner.slug);

  if (nonSelf.length === 1) {
    matches.push({
      practitionerSlug: practitioner.slug,
      placeSlug: nonSelf[0].slug,
      practitionerName: practitioner.name,
      placeName: nonSelf[0].name,
    });
  } else if (nonSelf.length > 1) {
    ambiguous.push({ name: practitioner.name, candidates: nonSelf.map((p) => p.name) });
  } else {
    unmatched.push(practitioner.name);
  }
}

// ── report ───────────────────────────────────────────────────────────────────

console.log(`\n── Matches (${matches.length}) ──`);
for (const m of matches) {
  console.log(`  "${m.practitionerName}" → "${m.placeName}"`);
}

if (ambiguous.length > 0) {
  console.log(`\n── Ambiguous — skipped (${ambiguous.length}) ──`);
  for (const a of ambiguous) {
    console.log(`  "${a.name}" matched: ${a.candidates.join(", ")}`);
  }
}

console.log(`\n── Unmatched (${unmatched.length}) ──`);
for (const n of unmatched) {
  console.log(`  "${n}"`);
}

// ── write ────────────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log(`\nDry run — no changes written. Re-run with --apply to commit.`);
} else {
  const update = db.prepare("UPDATE providers SET workplace_slug = ? WHERE slug = ?");
  const runAll = db.transaction(() => {
    for (const m of matches) {
      update.run(m.placeSlug, m.practitionerSlug);
    }
  });
  runAll();
  console.log(`\nWrote ${matches.length} workplace_slug link(s) to DB.`);
}

db.close();
