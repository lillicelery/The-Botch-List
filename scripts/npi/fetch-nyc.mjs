/**
 * Fetches New York City plastic and facial plastic surgeons from the free CMS NPI Registry API
 * (https://npiregistry.cms.hhs.gov/api-page). No API key needed; the data is public.
 *
 *   npm run npi:fetch
 *
 * Writes normalized records to scripts/npi/output/nyc-npi.json. Run `npm run npi:import` next.
 *
 * The API's taxonomy search is loose ("Plastic Surgery" also returns nurses and hand surgeons),
 * so results are filtered to the physician taxonomy codes below and to NYC ZIP codes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "output");
const outputPath = join(outputDir, "nyc-npi.json");

const API = "https://npiregistry.cms.hhs.gov/api/";
const PAGE_SIZE = 200;
const MAX_SKIP = 1000; // API limit: skip can't go past 1000, so one query returns at most 1,200 rows

/** Search terms sent to the API. Results are narrowed by TAXONOMY_TAGS afterwards. */
const SEARCH_TERMS = ["Plastic Surgery", "Facial Plastic Surgery"];

/** Physician taxonomy codes we list, and the tag shown in the app for each. */
export const TAXONOMY_TAGS = {
  "208200000X": "Plastic surgeon",
  "2082S0099X": "Plastic surgeon",
  "2086S0122X": "Plastic surgeon",
  "207YS0123X": "Facial plastic surgeon",
  "207YX0007X": "Facial plastic surgeon",
  "207YX0905X": "Facial plastic surgeon",
};

/** Residents and other trainees. Skipped when it's their primary taxonomy. */
const TRAINEE_TAXONOMY = "390200000X";

/** NYC ZIP codes: Manhattan 100–102, Staten Island 103, Bronx 104, Brooklyn 112, Queens 111/113/114/116 + 11004–5. */
const NYC_ZIP_PREFIXES = ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"];
const NYC_EXTRA_ZIPS = new Set(["11004", "11005"]);

function isNycZip(postalCode) {
  const zip5 = String(postalCode ?? "").slice(0, 5);
  return NYC_ZIP_PREFIXES.some((p) => zip5.startsWith(p)) || NYC_EXTRA_ZIPS.has(zip5);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAll(term) {
  const results = [];
  for (let skip = 0; skip <= MAX_SKIP; skip += PAGE_SIZE) {
    const params = new URLSearchParams({
      version: "2.1",
      enumeration_type: "NPI-1", // individual clinicians, not organizations
      taxonomy_description: term,
      state: "NY",
      limit: String(PAGE_SIZE),
      skip: String(skip),
    });
    const res = await fetch(`${API}?${params}`);
    if (!res.ok) throw new Error(`NPI API ${res.status} for "${term}" (skip ${skip})`);
    const body = await res.json();
    if (body.Errors) throw new Error(`NPI API error for "${term}": ${JSON.stringify(body.Errors)}`);
    const page = body.results ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) return results;
    await sleep(250);
  }
  console.warn(`Warning: "${term}" hit the API's 1,200-result cap; some providers may be missing.`);
  return results;
}

const SMALL_WORDS = new Set(["de", "la", "del", "van", "von", "der", "da", "di"]);

function titleCase(s) {
  return String(s ?? "")
    .toLowerCase()
    // digits are part of a word so "1ST AVE" becomes "1st Ave", not "1St Ave"
    .replace(/[a-z0-9À-ɏ]+/g, (w, offset) =>
      offset > 0 && SMALL_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)
    )
    .replace(/\b(Mc|O')([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function cleanCredential(c) {
  return String(c ?? "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\bM D\b/, "MD")
    .replace(/\bD O\b/, "DO")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[,\s]+$/, "")
    .trim();
}

/** Credentials that mark a physician. Blank credentials are kept (the taxonomy code is a physician code). */
const PHYSICIAN_CREDENTIAL = /\b(MD|DO|MBBS|MBCHB)\b/;

/** The registry has a few spellings of Manhattan's city name. */
const CITY_ALIASES = { Ny: "New York", Nyc: "New York", "New York City": "New York", Manhattan: "New York" };

function normalize(r) {
  const basic = r.basic ?? {};
  const taxonomies = r.taxonomies ?? [];
  const primary = taxonomies.find((t) => t.primary) ?? taxonomies[0];
  if (primary?.code === TRAINEE_TAXONOMY) return null;

  const listed = taxonomies.filter((t) => TAXONOMY_TAGS[t.code]);
  if (listed.length === 0) return null;

  const location = (r.addresses ?? []).find((a) => a.address_purpose === "LOCATION");
  if (!location || location.state !== "NY" || !isNycZip(location.postal_code)) return null;

  const firstName = titleCase(basic.first_name);
  const lastName = titleCase(basic.last_name);
  const middleInitial = basic.middle_name ? `${basic.middle_name[0].toUpperCase()}. ` : "";
  const credential = cleanCredential(basic.credential);
  if (credential && !PHYSICIAN_CREDENTIAL.test(credential)) return null;
  const city = titleCase(location.city);
  const mainTaxonomy = listed.find((t) => t.primary) ?? listed[0];
  const nyLicense = taxonomies.find((t) => t.state === "NY" && t.license)?.license ?? null;
  const zip = String(location.postal_code ?? "");

  return {
    npi: r.number,
    firstName,
    lastName,
    displayName: `${firstName} ${middleInitial}${lastName}${credential ? `, ${credential}` : ""}`,
    credential: credential || null,
    tag: TAXONOMY_TAGS[mainTaxonomy.code],
    specialties: [...new Set(listed.map((t) => t.desc))],
    nyLicense,
    address: {
      line1: titleCase(location.address_1),
      line2: location.address_2 ? titleCase(location.address_2) : null,
      city: CITY_ALIASES[city] ?? city,
      state: "NY",
      zip: zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip,
    },
    phone: location.telephone_number ?? null,
    lastUpdated: basic.last_updated ?? null,
  };
}

const byNpi = new Map();
for (const term of SEARCH_TERMS) {
  const raw = await fetchAll(term);
  let kept = 0;
  for (const r of raw) {
    if (byNpi.has(r.number)) continue;
    const record = normalize(r);
    if (!record) continue;
    byNpi.set(r.number, record);
    kept++;
  }
  console.log(`"${term}": ${raw.length} statewide results, ${kept} new NYC surgeons kept`);
}

const records = [...byNpi.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  outputPath,
  JSON.stringify({ fetchedAt: new Date().toISOString(), source: API, records }, null, 2) + "\n"
);

const byTag = records.reduce((acc, r) => ({ ...acc, [r.tag]: (acc[r.tag] ?? 0) + 1 }), {});
console.log(`\nSaved ${records.length} NYC surgeons to ${outputPath}`);
console.log(byTag);
