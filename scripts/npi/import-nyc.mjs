/**
 * Imports the NYC surgeons saved by `npm run npi:fetch` into data/botch.db.
 *
 *   npm run npi:import              # writes to the database
 *   npm run npi:import -- --dry-run # prints what would change, writes nothing
 *
 * - A surgeon whose name matches an existing Google Maps practitioner in NY is attached to that
 *   listing (raw_json.npi), so the reviews and the public record show on one page.
 * - Everyone else becomes a new listing with slug `npi-<number>` and no reviews yet.
 * - Re-running is safe: rows are upserted and AI summaries are kept.
 *
 * Respects BOTCH_DB_PATH.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const dbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");
const inputPath = join(__dirname, "output", "nyc-npi.json");
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(inputPath)) {
  console.error(`No NPI data at ${inputPath}. Run \`npm run npi:fetch\` first.`);
  process.exit(1);
}
if (!existsSync(dbPath)) {
  console.error(`Provider DB not found at ${dbPath}. Run \`npm run sqlite:import\` first.`);
  process.exit(1);
}

const { records, fetchedAt } = JSON.parse(readFileSync(inputPath, "utf8"));
const db = new Database(dbPath, { readonly: dryRun });
if (!dryRun) db.pragma("journal_mode = WAL");

const hasProviderType = db
  .prepare("SELECT 1 FROM pragma_table_info('providers') WHERE name = 'provider_type'")
  .get();
if (!hasProviderType) {
  console.error("providers.provider_type is missing. Run `node scripts/sqlite/migrate-add-provider-type.mjs` first.");
  process.exit(1);
}

/** Lower-case word tokens with accents and titles removed: "Dr. José Pérez-Ruiz, MD" → jose, perez, ruiz, md */
function tokens(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t && t !== "dr");
}

/** Existing Google Maps practitioners in New York, the only rows we try to match against. */
const candidates = db
  .prepare(
    `SELECT slug, name, raw_json FROM providers
     WHERE slug NOT LIKE 'npi-%' AND provider_type = 'practitioner' AND location_label LIKE '%, NY'`
  )
  .all()
  .map((row) => ({ ...row, tokens: new Set(tokens(row.name)) }));

function findMatches(record) {
  const first = tokens(record.firstName);
  const last = tokens(record.lastName);
  if (first.length === 0 || last.length === 0) return [];
  return candidates.filter((c) => [...first, ...last].every((t) => c.tokens.has(t)));
}

/** The public-record block stored at raw_json.npi and shown on the provider page. */
function npiBlock(r) {
  return {
    number: r.npi,
    credential: r.credential,
    specialties: r.specialties,
    nyLicense: r.nyLicense,
    address: r.address,
    phone: r.phone,
    lastUpdated: r.lastUpdated,
    fetchedAt,
  };
}

function newListing(r) {
  const locationLabel = `${r.address.city}, NY`;
  return {
    slug: `npi-${r.npi}`,
    name: r.displayName,
    metaLine: `${r.tag} • ${locationLabel}`,
    summary: `${r.tag} listed in the national NPI registry. No patient reviews collected yet.`,
    cardSentiment: null,
    tags: [r.tag],
    specialties: ["cosmetic", "surgery"],
    locationLabel,
    stats: { snippetsCollected: 0, avgSentimentLabel: "No reviews yet", topConcern: "—" },
    sentimentBreakdown: { negative: 0, good: 0, veryGood: 0 },
    defaultProcedureFilters: [r.tag],
    snippets: [],
    providerType: "practitioner",
    npi: npiBlock(r),
  };
}

const attachNpi = db.prepare("UPDATE providers SET raw_json = json_set(raw_json, '$.npi', json(?)) WHERE slug = ?");
const upsertListing = db.prepare(`
  INSERT INTO providers (slug, name, location_label, card_sentiment, tags_json, specialties_json, snippet_count, provider_type, raw_json)
  VALUES (@slug, @name, @locationLabel, NULL, @tagsJson, @specialtiesJson, 0, 'practitioner', @rawJson)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    location_label = excluded.location_label,
    tags_json = excluded.tags_json,
    specialties_json = excluded.specialties_json,
    raw_json = json_patch(excluded.raw_json, json_object(
      'aiSummary', json_extract(providers.raw_json, '$.aiSummary')
    ))
`);
// A surgeon who now matches a Google listing no longer needs their stand-alone npi-* row.
const deleteListing = db.prepare("DELETE FROM providers WHERE slug = ? AND snippet_count = 0");

const stats = { attached: 0, created: 0, replaced: 0, ambiguous: [] };
const matchedSlugs = new Map(); // google slug -> npi numbers, to catch two surgeons matching one listing

const plan = records.map((r) => ({ record: r, matches: findMatches(r) }));
for (const { record, matches } of plan) {
  for (const m of matches) {
    matchedSlugs.set(m.slug, [...(matchedSlugs.get(m.slug) ?? []), record.npi]);
  }
}

const run = db.transaction(() => {
  for (const { record, matches } of plan) {
    // Only trust a match when this listing matched exactly one surgeon.
    const usable = matches.filter((m) => matchedSlugs.get(m.slug).length === 1);
    if (matches.length > 0 && usable.length === 0) {
      stats.ambiguous.push(`${record.displayName} ↔ ${matches.map((m) => m.name).join(" | ")}`);
    }

    if (usable.length > 0) {
      for (const m of usable) {
        if (!dryRun) attachNpi.run(JSON.stringify(npiBlock(record)), m.slug);
        stats.attached++;
        console.log(`[match] ${record.displayName} → ${m.name}`);
      }
      if (!dryRun && deleteListing.run(`npi-${record.npi}`).changes > 0) stats.replaced++;
      continue;
    }

    const listing = newListing(record);
    if (!dryRun) {
      upsertListing.run({
        slug: listing.slug,
        name: listing.name,
        locationLabel: listing.locationLabel,
        tagsJson: JSON.stringify(listing.tags),
        specialtiesJson: JSON.stringify(listing.specialties),
        rawJson: JSON.stringify(listing),
      });
    }
    stats.created++;
  }
});
run();

const fetchedNpis = new Set(records.map((r) => `npi-${r.npi}`));
const stale = db
  .prepare("SELECT slug, name FROM providers WHERE slug LIKE 'npi-%'")
  .all()
  .filter((row) => !fetchedNpis.has(row.slug));
const total = db.prepare("SELECT COUNT(*) AS n FROM providers WHERE location_label LIKE '%, NY'").get().n;
db.close();

console.log(`\n${dryRun ? "[dry run] Would attach" : "Attached"} NPI data to ${stats.attached} existing Google listings`);
console.log(`${dryRun ? "[dry run] Would create/update" : "Created/updated"} ${stats.created} NPI-only listings`);
if (stats.replaced) console.log(`Removed ${stats.replaced} NPI-only listings that now match a Google listing`);
if (stats.ambiguous.length) {
  console.log(`\nSkipped ${stats.ambiguous.length} ambiguous matches (listed as NPI-only instead):`);
  for (const line of stats.ambiguous) console.log(`  ${line}`);
}
if (stale.length) {
  console.log(`\n${stale.length} NPI-only listings are no longer in the registry results (left in place):`);
  for (const row of stale) console.log(`  ${row.slug} ${row.name}`);
}
console.log(`\nNew York providers in the database: ${total}`);
