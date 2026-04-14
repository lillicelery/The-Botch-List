import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// resolve db path from cli argument, otherwise use default local database file
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.argv[2] ?? join(__dirname, "..", "..", "data", "botch.db");

// open read-only to make this script safe for quick inspection queries
const db = new Database(dbPath, { readonly: true });

// example query: show providers with the most snippets first
const rows = db
  .prepare(`
    SELECT
      p.slug,
      p.name,
      p.location_label AS locationLabel,
      p.snippet_count AS snippetCount
    FROM providers p
    ORDER BY p.snippet_count DESC, p.name ASC
    LIMIT 15
  `)
  .all();

// print formatted json so it is easy to read in the terminal
console.log(JSON.stringify(rows, null, 2));
db.close();
