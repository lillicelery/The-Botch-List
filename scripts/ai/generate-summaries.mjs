/**
 * Generates an AI summary for each provider based on their review excerpts.
 * Stores the result in raw_json so the existing /api/providers endpoint picks it up.
 *
 * Usage: node --env-file=.env scripts/ai/generate-summaries.mjs
 * Options:
 *   --slug <slug>   Process a single provider by slug
 *   --force         Re-generate even if aiSummary already exists
 */

import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve } from "path";

const DB_PATH = process.env.BOTCH_DB_PATH ?? "data/botch.db";
const dbPath = resolve(DB_PATH);

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Run npm run sqlite:import first.`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Add it to .env.");
  process.exit(1);
}

const db = new Database(dbPath);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const slugArg = process.argv.includes("--slug")
  ? process.argv[process.argv.indexOf("--slug") + 1]
  : null;
const force = process.argv.includes("--force");

const rows = slugArg
  ? db.prepare("SELECT slug, raw_json FROM providers WHERE slug = ?").all(slugArg)
  : db.prepare("SELECT slug, raw_json FROM providers ORDER BY snippet_count DESC").all();

if (!rows.length) {
  console.error(slugArg ? `Provider '${slugArg}' not found.` : "No providers found.");
  process.exit(1);
}

const snippetsByProvider = db
  .prepare(
    "SELECT provider_slug, excerpt FROM snippets WHERE provider_slug IN (" +
      rows.map(() => "?").join(",") +
      ") AND excerpt IS NOT NULL AND trim(excerpt) != ''"
  )
  .all(...rows.map((r) => r.slug));

const excerptMap = new Map();
for (const { provider_slug, excerpt } of snippetsByProvider) {
  if (!excerptMap.has(provider_slug)) excerptMap.set(provider_slug, []);
  excerptMap.get(provider_slug).push(excerpt);
}

const update = db.prepare("UPDATE providers SET raw_json = ? WHERE slug = ?");

let processed = 0;
let skipped = 0;

for (const row of rows) {
  const provider = JSON.parse(row.raw_json);
  const excerpts = excerptMap.get(row.slug) ?? [];

  if (!force && provider.aiSummary) {
    skipped++;
    continue;
  }

  if (excerpts.length === 0) {
    console.log(`[skip] ${provider.name} — no excerpts`);
    skipped++;
    continue;
  }

  const excerptText = excerpts
    .slice(0, 40)
    .map((e, i) => `${i + 1}. ${e.trim()}`)
    .join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:
        "You summarize patient reviews for a medical/cosmetic provider directory. " +
        "Write 2-3 sentences. Be specific and direct. Note what patients praise and what they raise concerns about. " +
        "Do not use hedging language. Do not mention the provider name. Do not start with 'Patients'.",
      messages: [
        {
          role: "user",
          content: `Summarize these reviews for ${provider.name}:\n\n${excerptText}`,
        },
      ],
    });

    const summary = message.content[0].text.trim();
    provider.aiSummary = summary;
    update.run(JSON.stringify(provider), row.slug);
    console.log(`[done] ${provider.name}`);
    processed++;

    await new Promise((r) => setTimeout(r, 300));
  } catch (err) {
    console.error(`[error] ${provider.name}: ${err.message}`);
  }
}

console.log(`\nDone. ${processed} generated, ${skipped} skipped.`);
db.close();
