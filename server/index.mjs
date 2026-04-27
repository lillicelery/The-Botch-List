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
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const providersDbPath = process.env.BOTCH_DB_PATH?.trim() || join(projectRoot, "data", "botch.db");
const authDbPath = process.env.BOTCH_AUTH_DB_PATH?.trim() || join(projectRoot, "data", "auth.db");
const port = Math.max(1, Number(process.env.BOTCH_API_PORT || 8787));
const appOrigin = process.env.BOTCH_APP_ORIGIN?.trim() || "http://127.0.0.1:5173";
const isProd = process.env.NODE_ENV === "production";
const sessionCookieName = "botch_session";
const csrfCookieName = "botch_csrf";
const sessionTtlMs = 1000 * 60 * 60 * 8;
const sessions = new Map();
const failedAttempts = new Map();
const maxFailedAttempts = 6;
const lockoutWindowMs = 1000 * 60 * 15;

let providersDbInstance = null;
let authDbInstance = null;

function getProvidersDb() {
  if (providersDbInstance) return providersDbInstance;
  if (!existsSync(providersDbPath)) return null;
  try {
    providersDbInstance = new Database(providersDbPath, { readonly: true, fileMustExist: true });
    providersDbInstance.pragma("foreign_keys = ON");
    return providersDbInstance;
  } catch {
    return null;
  }
}

function getAuthDb() {
  if (authDbInstance) return authDbInstance;
  authDbInstance = new Database(authDbPath);
  authDbInstance.pragma("journal_mode = WAL");
  authDbInstance.pragma("foreign_keys = ON");
  authDbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return authDbInstance;
}

const app = new Hono();

function secureRandomToken(byteCount = 32) {
  return crypto.randomBytes(byteCount).toString("base64url");
}

function setSessionCookie(c, token) {
  setCookie(c, sessionCookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "Strict",
    path: "/",
    maxAge: Math.floor(sessionTtlMs / 1000),
  });
}

function setCsrfCookie(c, token) {
  setCookie(c, csrfCookieName, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: "Strict",
    path: "/",
    maxAge: Math.floor(sessionTtlMs / 1000),
  });
}

function clearAuthCookies(c) {
  deleteCookie(c, sessionCookieName, { path: "/" });
  deleteCookie(c, csrfCookieName, { path: "/" });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password);
}

function getClientKey(c) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return c.req.header("x-real-ip") || "unknown";
}

function tooManyAttempts(clientKey) {
  const entry = failedAttempts.get(clientKey);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    failedAttempts.delete(clientKey);
    return false;
  }
  return entry.count >= maxFailedAttempts;
}

function registerFailedAttempt(clientKey) {
  const now = Date.now();
  const current = failedAttempts.get(clientKey);
  if (!current || now > current.lockedUntil) {
    failedAttempts.set(clientKey, {
      count: 1,
      lockedUntil: now + lockoutWindowMs,
    });
    return;
  }
  current.count += 1;
  current.lockedUntil = now + lockoutWindowMs;
  failedAttempts.set(clientKey, current);
}

function clearFailedAttempts(clientKey) {
  failedAttempts.delete(clientKey);
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function getSessionFromRequest(c) {
  pruneExpiredSessions();
  const sessionToken = getCookie(c, sessionCookieName);
  if (!sessionToken) return null;
  const session = sessions.get(sessionToken);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionToken);
    return null;
  }
  return { token: sessionToken, session };
}

app.use(
  "/*",
  cors({
    origin: [appOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "HEAD", "OPTIONS", "POST"],
    allowHeaders: ["Content-Type", "X-CSRF-Token"],
    credentials: true,
  })
);

app.get("/api/health", (c) => {
  const db = getProvidersDb();
  if (!db) {
    return c.json(
      {
        ok: false,
        reason: "database_unavailable",
        hint: "Create data/botch.db with npm run sqlite:import",
        dbPath: providersDbPath,
      },
      503
    );
  }
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM providers").get();
    getAuthDb();
    return c.json({ ok: true, providerCount: row.n, providersDbPath, authDbPath });
  } catch (e) {
    return c.json({ ok: false, reason: e instanceof Error ? e.message : String(e) }, 503);
  }
});

app.get("/api/providers", (c) => {
  const db = getProvidersDb();
  if (!db) {
    return c.json({ error: "Database not available", dbPath: providersDbPath }, 503);
  }
  try {
    const rows = db
      .prepare(
        `SELECT raw_json, workplace_slug FROM providers
         ORDER BY snippet_count DESC, name COLLATE NOCASE ASC`
      )
      .all();
    const providers = rows.map((r) => {
      const p = JSON.parse(r.raw_json);
      if (r.workplace_slug) p.workplaceSlug = r.workplace_slug;
      return p;
    });
    return c.json(providers);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/providers/:slug", (c) => {
  const db = getProvidersDb();
  if (!db) {
    return c.json({ error: "Database not available", dbPath: providersDbPath }, 503);
  }
  const slug = c.req.param("slug");
  try {
    const row = db.prepare("SELECT raw_json, workplace_slug FROM providers WHERE slug = ?").get(slug);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const p = JSON.parse(row.raw_json);
    if (row.workplace_slug) p.workplaceSlug = row.workplace_slug;
    return c.json(p);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/auth/session", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ authenticated: false });

  setSessionCookie(c, sessionData.token);
  setCsrfCookie(c, sessionData.session.csrfToken);

  return c.json({
    authenticated: true,
    email: sessionData.session.email,
    csrfToken: sessionData.session.csrfToken,
  });
});

app.post("/api/auth/signin", async (c) => {
  const clientKey = getClientKey(c);
  if (tooManyAttempts(clientKey)) {
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    registerFailedAttempt(clientKey);
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT email, password_hash FROM users WHERE email = ?").get(email);
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!passwordMatches) {
    registerFailedAttempt(clientKey);
    return c.json({ error: "Invalid credentials" }, 401);
  }
  clearFailedAttempts(clientKey);

  const sessionToken = secureRandomToken();
  const csrfToken = secureRandomToken(24);
  sessions.set(sessionToken, {
    email: user.email,
    csrfToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionTtlMs,
  });

  setSessionCookie(c, sessionToken);
  setCsrfCookie(c, csrfToken);

  return c.json({ ok: true, email: user.email, csrfToken });
});

app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email)) {
    return c.json({ error: "Enter a valid email address." }, 400);
  }
  if (!isStrongPassword(password)) {
    return c.json({ error: "Use at least 10 characters with uppercase, lowercase, and a number." }, 400);
  }

  const authDb = getAuthDb();
  const existing = authDb.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return c.json({ error: "An account with that email already exists." }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  authDb.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, passwordHash);
  return c.json({ ok: true }, 201);
});

app.post("/api/auth/signout", (c) => {
  const sessionData = getSessionFromRequest(c);
  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);

  if (sessionData) {
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
      return c.json({ error: "Invalid CSRF token" }, 403);
    }
    sessions.delete(sessionData.token);
  }

  clearAuthCookies(c);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `Botch API listening on http://127.0.0.1:${info.port} (providers: ${providersDbPath}, auth: ${authDbPath})`
  );
});
