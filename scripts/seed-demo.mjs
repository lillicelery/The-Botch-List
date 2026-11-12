/**
 * Seeds demo accounts into the auth DB so the full app can be shown without email setup.
 *
 *   npm run seed:demo                 # picks a good demo provider automatically
 *   npm run seed:demo -- --slug <s>   # seed a specific provider
 *   npm run seed:demo -- --force      # take over a provider already claimed by another account
 *
 * Creates (or resets) two accounts:
 *   - a patient account with a few saved providers
 *   - a provider account with a verified claim (which unlocks the Provider Portal),
 *     a filled-in profile, and a response to one review
 *
 * Safe to re-run: the demo accounts' data is rebuilt each time. Stop/restart the API afterwards
 * isn't required, but existing sessions for the demo accounts keep their old role until re-login.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import { initAuthSchema, VALID_PROCEDURES } from "../server/authDb.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const providersDbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");
const authDbPath = process.env.BOTCH_AUTH_DB_PATH?.trim() || join(projectRoot, "data", "auth.db");
const appUrl = process.env.BOTCH_APP_PUBLIC_URL?.trim() || "http://127.0.0.1:5173";

const DEMO_PROVIDER = { email: "demo-provider@botchlist.test", password: "DemoProvider123", role: "provider" };
const DEMO_PATIENT = { email: "demo-patient@botchlist.test", password: "DemoPatient123", role: "user" };

const args = process.argv.slice(2);
const slugArgIndex = args.indexOf("--slug");
const requestedSlug = slugArgIndex >= 0 ? args[slugArgIndex + 1] : undefined;
const force = args.includes("--force");

if (!existsSync(providersDbPath)) {
  console.error(`Provider DB not found at ${providersDbPath}. Run \`npm run sqlite:import\` first.`);
  process.exit(1);
}

const providersDb = new Database(providersDbPath, { readonly: true, fileMustExist: true });
const authDb = initAuthSchema(new Database(authDbPath));

const providerRows = providersDb
  .prepare("SELECT slug, raw_json FROM providers ORDER BY snippet_count DESC, name COLLATE NOCASE ASC")
  .all()
  .map((row) => ({ slug: row.slug, data: JSON.parse(row.raw_json) }));

/** Best demo candidate: has an AI summary and at least one negative review to respond to. */
function pickDemoProvider() {
  if (requestedSlug) {
    const match = providerRows.find((p) => p.slug === requestedSlug);
    if (!match) {
      console.error(`No provider with slug "${requestedSlug}".`);
      process.exit(1);
    }
    return match;
  }
  const hasNegative = (p) => (p.data.snippets ?? []).some((s) => s.sentiment === "Negative");
  return (
    providerRows.find((p) => p.data.aiSummary && hasNegative(p)) ??
    providerRows.find(hasNegative) ??
    providerRows[0]
  );
}

const provider = pickDemoProvider();
if (!provider) {
  console.error("Provider DB is empty.");
  process.exit(1);
}
const { slug } = provider;
const snippets = provider.data.snippets ?? [];

function upsertUser({ email, password, role }) {
  const passwordHash = bcrypt.hashSync(password, 12);
  authDb
    .prepare(
      `INSERT INTO users (email, password_hash, user_role) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, user_role = excluded.user_role`
    )
    .run(email, passwordHash, role);
  return authDb.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
}

const existingClaim = authDb.prepare("SELECT user_id FROM provider_claims WHERE provider_slug = ?").get(slug);
const demoProviderId = authDb.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_PROVIDER.email)?.id;
if (existingClaim && existingClaim.user_id !== demoProviderId && !force) {
  console.error(
    `"${provider.data.name}" (${slug}) is already claimed by another account.\n` +
      "Re-run with --force to take it over, or pick another provider with --slug."
  );
  process.exit(1);
}

const procedures = [
  ...new Set(snippets.flatMap((s) => s.procedureTags ?? []).filter((t) => VALID_PROCEDURES.has(t))),
];
const reviewToAnswer = snippets.find((s) => s.sentiment === "Negative") ?? snippets[0];
const savedSlugs = [slug, ...providerRows.filter((p) => p.slug !== slug).slice(0, 2).map((p) => p.slug)];

authDb.transaction(() => {
  const providerUserId = upsertUser(DEMO_PROVIDER);
  const patientUserId = upsertUser(DEMO_PATIENT);

  // Reset everything the demo accounts own, plus anything else attached to the demo slug.
  for (const table of ["provider_claims", "provider_responses", "provider_profiles"]) {
    authDb.prepare(`DELETE FROM ${table} WHERE user_id = ? OR provider_slug = ?`).run(providerUserId, slug);
  }
  authDb.prepare("DELETE FROM user_saved_providers WHERE user_id = ?").run(patientUserId);

  authDb
    .prepare(
      `INSERT INTO provider_claims (user_id, provider_slug, status, business_email, verif_used_at)
       VALUES (?, ?, 'verified', ?, datetime('now'))`
    )
    .run(providerUserId, slug, DEMO_PROVIDER.email);

  authDb
    .prepare(
      `INSERT INTO provider_profiles
         (provider_slug, user_id, display_name, address, hours, phone, bio, procedures_json, price_ranges_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}')`
    )
    .run(
      slug,
      providerUserId,
      provider.data.name,
      provider.data.locationLabel ?? "",
      "Mon–Fri 9am–5pm",
      "(555) 010-0100",
      "Sample profile created by the demo seed script. Edit it from the Provider Portal.",
      JSON.stringify(procedures)
    );

  if (reviewToAnswer) {
    authDb
      .prepare(
        `INSERT INTO provider_responses (user_id, provider_slug, snippet_id, response_text) VALUES (?, ?, ?, ?)`
      )
      .run(
        providerUserId,
        slug,
        reviewToAnswer.id,
        "Thank you for sharing your experience. We'd like to learn more and make this right — please contact our office directly so we can follow up."
      );
  }

  const insertSaved = authDb.prepare("INSERT INTO user_saved_providers (user_id, provider_slug) VALUES (?, ?)");
  for (const s of savedSlugs) insertSaved.run(patientUserId, s);
})();

authDb.close();
providersDb.close();

console.log(`
Demo data seeded into ${authDbPath}

  Provider: ${provider.data.name} (${slug})

  Provider account   ${DEMO_PROVIDER.email} / ${DEMO_PROVIDER.password}
    portal           ${appUrl}/provider-portal/${slug}
    public page      ${appUrl}/provider/${slug}

  Patient account    ${DEMO_PATIENT.email} / ${DEMO_PATIENT.password}
    saved providers  ${appUrl}/saved (${savedSlugs.length} saved)
`);
