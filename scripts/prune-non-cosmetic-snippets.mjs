/**
 * Remove review snippets that don't mention cosmetic/aesthetic keywords (see cosmeticFilters.mjs).
 * Rewrites src/data/apifyProviders.json and src/data/redditProviders.json in place.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isCosmeticSnippetText } from "./common/cosmeticFilters.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const FILES = [
  join(ROOT, "src", "data", "apifyProviders.json"),
  join(ROOT, "src", "data", "redditProviders.json"),
];

function pruneFile(absPath) {
  const raw = readFileSync(absPath, "utf8");
  const providers = JSON.parse(raw);
  if (!Array.isArray(providers)) {
    console.error("Expected array:", absPath);
    process.exit(1);
  }

  let removed = 0;
  for (const p of providers) {
    const before = Array.isArray(p.snippets) ? p.snippets.length : 0;
    p.snippets = (Array.isArray(p.snippets) ? p.snippets : []).filter((s) =>
      isCosmeticSnippetText(s?.excerpt ?? "")
    );
    removed += before - p.snippets.length;
    if (p.stats && typeof p.stats === "object") {
      p.stats.snippetsCollected = p.snippets.length;
    }
  }

  const withSnippets = providers.filter((p) => (Array.isArray(p.snippets) ? p.snippets.length : 0) > 0);
  const droppedProviders = providers.length - withSnippets.length;

  writeFileSync(absPath, JSON.stringify(withSnippets, null, 2) + "\n", "utf8");
  console.log(
    `${absPath}: removed ${removed} non-cosmetic snippet(s); dropped ${droppedProviders} provider(s) with no snippets left; ${withSnippets.length} provider(s) kept`
  );
}

for (const f of FILES) {
  pruneFile(f);
}
