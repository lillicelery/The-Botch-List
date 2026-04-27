/**
 * Local HTTP API backed by SQLite (`data/botch.db`).
 *
 * Run (from repo root, with DB populated via `npm run sqlite:import`):
 *   npm run server:dev
 *
 * With Vite (`npm run dev`), requests to `/api/*` are proxied here (see `vite.config.ts`).
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const dbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");
const port = Math.max(1, Number(process.env.BOTCH_API_PORT || 8787));

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  if (!existsSync(dbPath)) return null;
  try {
    dbInstance = new Database(dbPath, { readonly: true, fileMustExist: true });
    dbInstance.pragma("foreign_keys = ON");
    return dbInstance;
  } catch {
    return null;
  }
}

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "HEAD", "OPTIONS"],
  })
);

app.get("/api/health", (c) => {
  const db = getDb();
  if (!db) {
    return c.json(
      {
        ok: false,
        reason: "database_unavailable",
        hint: "Create data/botch.db with npm run sqlite:import",
        dbPath,
      },
      503
    );
  }
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM providers").get();
    return c.json({ ok: true, providerCount: row.n, dbPath });
  } catch (e) {
    return c.json({ ok: false, reason: e instanceof Error ? e.message : String(e) }, 503);
  }
});

app.get("/api/providers", (c) => {
  const db = getDb();
  if (!db) {
    return c.json({ error: "Database not available", dbPath }, 503);
  }
  try {
    const rows = db
      .prepare(
        `SELECT raw_json, workplace_slug, provider_type FROM providers
         ORDER BY snippet_count DESC, name COLLATE NOCASE ASC`
      )
      .all();
    const providers = rows.map((r) => {
      const p = JSON.parse(r.raw_json);
      if (r.workplace_slug) p.workplaceSlug = r.workplace_slug;
      if (r.provider_type) p.providerType = r.provider_type;
      return p;
    });
    return c.json(providers);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/providers/:slug", (c) => {
  const db = getDb();
  if (!db) {
    return c.json({ error: "Database not available", dbPath }, 503);
  }
  const slug = c.req.param("slug");
  try {
    const row = db.prepare("SELECT raw_json, workplace_slug, provider_type FROM providers WHERE slug = ?").get(slug);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const p = JSON.parse(row.raw_json);
    if (row.workplace_slug) p.workplaceSlug = row.workplace_slug;
    if (row.provider_type) p.providerType = row.provider_type;
    return c.json(p);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Botch API listening on http://127.0.0.1:${info.port} (db: ${dbPath})`);
});
