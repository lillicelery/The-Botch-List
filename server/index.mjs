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
import Stripe from "stripe";
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
const appPublicBaseUrl = process.env.BOTCH_APP_PUBLIC_URL?.trim() || appOrigin;
const isProd = process.env.NODE_ENV === "production";
const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
const authEmailFrom = process.env.BOTCH_AUTH_EMAIL_FROM?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripeVerifiedPriceId = process.env.STRIPE_VERIFIED_PRICE_ID?.trim() || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const sessionCookieName = "botch_session";
const csrfCookieName = "botch_csrf";
const sessionTtlMs = 1000 * 60 * 60 * 8;
const resetTokenTtlMs = 1000 * 60 * 30;
const verifTokenTtlMs = 1000 * 60 * 60 * 72;
const sessions = new Map();
const failedAttempts = new Map();
const forgotAttempts = new Map();
const maxFailedAttempts = 6;
const lockoutWindowMs = 1000 * 60 * 15;
const maxForgotAttempts = 4;
const forgotWindowMs = 1000 * 60 * 15;

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

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS provider_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK(status IN ('pending_verification','verified','rejected')),
      business_email TEXT NOT NULL,
      verif_token_hash TEXT,
      verif_expires_at TEXT,
      verif_used_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider_slug)
    );

    CREATE INDEX IF NOT EXISTS idx_claims_user_id    ON provider_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_slug       ON provider_claims(provider_slug);
    CREATE INDEX IF NOT EXISTS idx_claims_verif_hash ON provider_claims(verif_token_hash);

    CREATE TABLE IF NOT EXISTS provider_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      stripe_subscription_id TEXT,
      stripe_checkout_session_id TEXT,
      plan TEXT NOT NULL DEFAULT 'verified' CHECK(plan IN ('verified')),
      status TEXT NOT NULL DEFAULT 'incomplete'
        CHECK(status IN ('incomplete','active','past_due','canceled','paused')),
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider_slug)
    );

    CREATE INDEX IF NOT EXISTS idx_subs_user_id    ON provider_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_slug       ON provider_subscriptions(provider_slug);
    CREATE INDEX IF NOT EXISTS idx_subs_stripe_sub ON provider_subscriptions(stripe_subscription_id);

    CREATE TABLE IF NOT EXISTS provider_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL,
      snippet_id TEXT NOT NULL,
      response_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider_slug, snippet_id)
    );

    CREATE INDEX IF NOT EXISTS idx_responses_slug ON provider_responses(provider_slug);

    CREATE TABLE IF NOT EXISTS user_saved_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider_slug)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_user_id ON user_saved_providers(user_id);

    CREATE TABLE IF NOT EXISTS provider_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_slug TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      display_name TEXT,
      address TEXT,
      hours TEXT,
      phone TEXT,
      website_url TEXT,
      booking_url TEXT,
      bio TEXT,
      credentials TEXT,
      procedures_json TEXT,
      price_ranges_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_slug ON provider_profiles(provider_slug);
  `);

  // Migrate existing users table to add user_role if the column doesn't exist yet.
  try {
    authDbInstance.exec(
      `ALTER TABLE users ADD COLUMN user_role TEXT NOT NULL DEFAULT 'user' CHECK(user_role IN ('user', 'provider', 'admin'))`
    );
  } catch {
    // Column already exists — safe to ignore.
  }
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

function tooManyForgotAttempts(clientKey) {
  const entry = forgotAttempts.get(clientKey);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    forgotAttempts.delete(clientKey);
    return false;
  }
  return entry.count >= maxForgotAttempts;
}

function registerForgotAttempt(clientKey) {
  const now = Date.now();
  const current = forgotAttempts.get(clientKey);
  if (!current || now > current.lockedUntil) {
    forgotAttempts.set(clientKey, {
      count: 1,
      lockedUntil: now + forgotWindowMs,
    });
    return;
  }
  current.count += 1;
  current.lockedUntil = now + forgotWindowMs;
  forgotAttempts.set(clientKey, current);
}

function clearForgotAttempts(clientKey) {
  forgotAttempts.delete(clientKey);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isResetEmailConfigured() {
  return Boolean(resendApiKey && authEmailFrom);
}

async function sendResetEmail(email, resetLink) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: authEmailFrom,
      to: [email],
      subject: "Reset your Botch List password",
      text: `Reset your password using this link (valid for 30 minutes): ${resetLink}`,
      html: `<p>Reset your password using the link below. It is valid for 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend error (${response.status}): ${body}`);
  }
}

const freeEmailDomains = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "proton.me", "tutanota.com", "yandex.com", "yandex.ru", "mail.com",
  "zoho.com", "inbox.com",
]);

function isPersonalEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return freeEmailDomains.has(domain);
}

async function sendVerificationEmail(toEmail, providerName, verifyLink) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: authEmailFrom,
      to: [toEmail],
      subject: `Verify your claim for ${providerName} on The Botch List`,
      text: [
        `You submitted a claim for "${providerName}" on The Botch List.`,
        ``,
        `Click the link below to verify you have access to this business email address.`,
        `The link is valid for 72 hours.`,
        ``,
        verifyLink,
        ``,
        `If you did not submit this claim, you can safely ignore this email.`,
      ].join("\n"),
      html: `
        <h2>Verify your business claim</h2>
        <p>You submitted a claim for <strong>${providerName}</strong> on The Botch List.</p>
        <p>Click the button below to verify you have access to this business email address.
           The link is valid for <strong>72 hours</strong>.</p>
        <p><a href="${verifyLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify my claim</a></p>
        <p style="margin-top:16px;font-size:13px;color:#555;"><a href="${verifyLink}">${verifyLink}</a></p>
        <hr />
        <p style="color:#888;font-size:12px;">If you did not submit this claim, you can safely ignore this email.</p>
      `,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend error (${response.status}): ${body}`);
  }
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
    allowMethods: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"],
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
    userRole: sessionData.session.userRole ?? "user",
    csrfToken: sessionData.session.csrfToken,
  });
});

app.get("/api/auth/me", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id, email, user_role FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found" }, 404);

  const claims = authDb
    .prepare("SELECT provider_slug, status, business_email FROM provider_claims WHERE user_id = ?")
    .all(user.id);

  const subs = authDb
    .prepare(
      "SELECT provider_slug, plan, status, current_period_end, cancel_at_period_end FROM provider_subscriptions WHERE user_id = ?"
    )
    .all(user.id);

  return c.json({
    email: user.email,
    userRole: user.user_role || "user",
    claims: claims.map((row) => ({
      providerSlug: row.provider_slug,
      status: row.status,
      businessEmail: row.business_email,
    })),
    subscriptions: subs.map((row) => ({
      providerSlug: row.provider_slug,
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    })),
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
  const user = authDb.prepare("SELECT id, email, password_hash, user_role FROM users WHERE email = ?").get(email);
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
    userRole: user.user_role || "user",
    csrfToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionTtlMs,
  });

  setSessionCookie(c, sessionToken);
  setCsrfCookie(c, csrfToken);

  return c.json({ ok: true, email: user.email, csrfToken, userRole: user.user_role || "user" });
});

app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const userRole = body?.userRole === "provider" ? "provider" : "user";

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
  authDb
    .prepare("INSERT INTO users (email, password_hash, user_role) VALUES (?, ?, ?)")
    .run(email, passwordHash, userRole);
  return c.json({ ok: true }, 201);
});

app.post("/api/auth/forgot-password", async (c) => {
  const clientKey = getClientKey(c);
  if (tooManyForgotAttempts(clientKey)) {
    return c.json({ error: "Too many reset requests. Try again later." }, 429);
  }
  if (!isResetEmailConfigured()) {
    return c.json({ error: "Reset email provider is not configured." }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  registerForgotAttempt(clientKey);
  if (!isValidEmail(email)) {
    return c.json({ ok: true });
  }

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
  if (!user) {
    return c.json({ ok: true });
  }

  const token = secureRandomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + resetTokenTtlMs).toISOString();
  authDb
    .prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(user.id, tokenHash, expiresAt);

  // Keep only most recent active reset token per user.
  authDb
    .prepare(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ?
         AND id NOT IN (
           SELECT id FROM password_reset_tokens
           WHERE user_id = ? AND used_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1
         )`
    )
    .run(user.id, user.id);

  const resetLink = `${appPublicBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendResetEmail(user.email, resetLink);
    clearForgotAttempts(clientKey);
  } catch (error) {
    console.error("Failed to send reset email", error);
    return c.json({ error: "Unable to send reset email right now." }, 502);
  }

  return c.json({ ok: true });
});

app.post("/api/auth/reset-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return c.json({ error: "Reset token is required." }, 400);
  }
  if (!isStrongPassword(password)) {
    return c.json({ error: "Password must use at least 10 characters with uppercase, lowercase, and a number." }, 400);
  }

  const tokenHash = sha256(token);
  const authDb = getAuthDb();
  const resetRow = authDb
    .prepare(
      `SELECT rt.id, rt.user_id, u.email
       FROM password_reset_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?
         AND rt.used_at IS NULL
         AND datetime(rt.expires_at) > datetime('now')
       ORDER BY rt.created_at DESC
       LIMIT 1`
    )
    .get(tokenHash);

  if (!resetRow) {
    return c.json({ error: "This reset link is invalid or expired." }, 400);
  }

  const newHash = await bcrypt.hash(password, 12);
  authDb.transaction(() => {
    authDb.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, resetRow.user_id);
    authDb.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(resetRow.id);
  })();

  // Invalidate active sessions for this account after password change.
  for (const [sessionToken, session] of sessions.entries()) {
    if (session.email === resetRow.email) sessions.delete(sessionToken);
  }

  return c.json({ ok: true });
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

// ── Claiming ──────────────────────────────────────────────────────────────────

app.post("/api/claims", async (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const providerSlug = typeof body?.providerSlug === "string" ? body.providerSlug.trim() : "";
  const businessEmail = typeof body?.businessEmail === "string" ? body.businessEmail.trim().toLowerCase() : "";

  if (!providerSlug) return c.json({ error: "providerSlug is required." }, 400);
  if (!isValidEmail(businessEmail)) return c.json({ error: "Enter a valid business email address." }, 400);
  if (isPersonalEmail(businessEmail)) {
    return c.json({ error: "Please use a business email address, not a personal email service." }, 400);
  }

  const providersDb = getProvidersDb();
  if (!providersDb) return c.json({ error: "Provider database unavailable." }, 503);
  const providerRow = providersDb.prepare("SELECT raw_json FROM providers WHERE slug = ?").get(providerSlug);
  if (!providerRow) return c.json({ error: "Provider not found." }, 404);
  const providerData = JSON.parse(providerRow.raw_json);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const existingClaim = authDb
    .prepare("SELECT user_id, status FROM provider_claims WHERE provider_slug = ?")
    .get(providerSlug);
  if (existingClaim && existingClaim.user_id !== user.id) {
    return c.json({ error: "This provider has already been claimed by another account." }, 409);
  }

  const token = secureRandomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + verifTokenTtlMs).toISOString();
  const verifyLink = `${appPublicBaseUrl}/api/claims/verify?token=${encodeURIComponent(token)}`;

  if (existingClaim && existingClaim.user_id === user.id) {
    authDb
      .prepare(
        `UPDATE provider_claims
         SET business_email = ?, verif_token_hash = ?, verif_expires_at = ?,
             verif_used_at = NULL, status = 'pending_verification', updated_at = datetime('now')
         WHERE provider_slug = ? AND user_id = ?`
      )
      .run(businessEmail, tokenHash, expiresAt, providerSlug, user.id);
  } else {
    authDb
      .prepare(
        `INSERT INTO provider_claims (user_id, provider_slug, business_email, verif_token_hash, verif_expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(user.id, providerSlug, businessEmail, tokenHash, expiresAt);
  }

  if (!isResetEmailConfigured()) {
    return c.json({ ok: true, devVerifyLink: verifyLink });
  }

  try {
    await sendVerificationEmail(businessEmail, providerData.name, verifyLink);
  } catch (err) {
    console.error("Failed to send verification email", err);
    return c.json({ error: "Unable to send verification email right now." }, 502);
  }

  return c.json({ ok: true });
});

app.get("/api/claims/verify", (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.redirect(`${appPublicBaseUrl}/claim-verified?error=missing_token`);

  const tokenHash = sha256(token);
  const authDb = getAuthDb();
  const claim = authDb
    .prepare(
      `SELECT id, provider_slug, verif_used_at, verif_expires_at
       FROM provider_claims WHERE verif_token_hash = ?`
    )
    .get(tokenHash);

  if (!claim) return c.redirect(`${appPublicBaseUrl}/claim-verified?error=invalid_token`);
  if (claim.verif_used_at) {
    return c.redirect(`${appPublicBaseUrl}/claim-verified?slug=${encodeURIComponent(claim.provider_slug)}&already=1`);
  }
  if (new Date(claim.verif_expires_at) < new Date()) {
    return c.redirect(`${appPublicBaseUrl}/claim-verified?error=expired_token`);
  }

  authDb
    .prepare(
      `UPDATE provider_claims
       SET status = 'verified', verif_used_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(claim.id);

  return c.redirect(`${appPublicBaseUrl}/claim-verified?slug=${encodeURIComponent(claim.provider_slug)}`);
});

app.get("/api/claims/status/:slug", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ claimed: false });

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ claimed: false });

  const claim = authDb
    .prepare(
      "SELECT status, business_email FROM provider_claims WHERE provider_slug = ? AND user_id = ?"
    )
    .get(slug, user.id);
  if (!claim) return c.json({ claimed: false });

  const sub = authDb
    .prepare(
      "SELECT status, current_period_end FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ?"
    )
    .get(slug, user.id);

  return c.json({
    claimed: true,
    status: claim.status,
    businessEmail: claim.business_email,
    subscriptionStatus: sub?.status ?? null,
    subscriptionPeriodEnd: sub?.current_period_end ?? null,
  });
});

// ── Provider Portal ───────────────────────────────────────────────────────────

app.get("/api/portal/:slug/analytics", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare(
      "SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'"
    )
    .get(slug, user.id);
  if (!sub) return c.json({ error: "Active subscription required." }, 403);

  const providersDb = getProvidersDb();
  if (!providersDb) return c.json({ error: "Provider database unavailable." }, 503);

  const snippets = providersDb
    .prepare(
      `SELECT sentiment, source_name FROM snippets WHERE provider_slug = ?`
    )
    .all(slug);

  const sentimentCounts = { Positive: 0, Okay: 0, Negative: 0 };
  const sourceCounts = {};
  for (const s of snippets) {
    if (s.sentiment in sentimentCounts) sentimentCounts[s.sentiment]++;
    sourceCounts[s.source_name] = (sourceCounts[s.source_name] ?? 0) + 1;
  }

  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const responses = authDb
    .prepare("SELECT snippet_id FROM provider_responses WHERE provider_slug = ?")
    .all(slug);
  const respondedIds = new Set(responses.map((r) => r.snippet_id));

  return c.json({
    totalSnippets: snippets.length,
    sentimentCounts,
    topSources,
    respondedCount: respondedIds.size,
  });
});

app.post("/api/portal/:slug/responses", async (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare(
      "SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'"
    )
    .get(slug, user.id);
  if (!sub) return c.json({ error: "Active subscription required." }, 403);

  const body = await c.req.json().catch(() => null);
  const snippetId = typeof body?.snippetId === "string" ? body.snippetId.trim() : "";
  const responseText = typeof body?.responseText === "string" ? body.responseText.trim() : "";
  if (!snippetId) return c.json({ error: "snippetId is required." }, 400);
  if (!responseText) return c.json({ error: "responseText is required." }, 400);
  if (responseText.length > 2000) return c.json({ error: "Response must be 2000 characters or fewer." }, 400);

  try {
    const result = authDb
      .prepare(
        `INSERT INTO provider_responses (user_id, provider_slug, snippet_id, response_text)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(provider_slug, snippet_id) DO UPDATE SET response_text = excluded.response_text`
      )
      .run(user.id, slug, snippetId, responseText);
    return c.json({ ok: true, responseId: result.lastInsertRowid });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

app.get("/api/portal/:slug/responses", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare(
      "SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'"
    )
    .get(slug, user.id);
  if (!sub) return c.json({ error: "Active subscription required." }, 403);

  const responses = authDb
    .prepare("SELECT snippet_id, response_text, created_at FROM provider_responses WHERE provider_slug = ? AND user_id = ?")
    .all(slug, user.id);

  return c.json(responses.map((r) => ({
    snippetId: r.snippet_id,
    responseText: r.response_text,
    createdAt: r.created_at,
  })));
});

// ── Saved Providers ───────────────────────────────────────────────────────────

const VALID_PROCEDURES = new Set([
  "BBL", "Blepharoplasty", "Body contouring", "Botox", "Breast augmentation",
  "Breast lift", "Breast reduction", "Brow lift", "Chin surgery", "Coolsculpting",
  "Dermal fillers", "Facelift", "Fat transfer", "Gynecomastia", "Lip lift",
  "Liposuction", "Medical spa", "Mommy makeover", "Neck lift", "Otoplasty",
  "Rhinoplasty", "Tummy tuck",
]);

app.get("/api/saved-providers", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const rows = authDb
    .prepare("SELECT provider_slug FROM user_saved_providers WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id);

  return c.json({ slugs: rows.map((r) => r.provider_slug) });
});

app.post("/api/saved-providers", async (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const providerSlug = typeof body?.providerSlug === "string" ? body.providerSlug.trim() : "";
  if (!providerSlug) return c.json({ error: "providerSlug is required." }, 400);

  const providersDb = getProvidersDb();
  if (!providersDb) return c.json({ error: "Provider database unavailable." }, 503);
  const providerRow = providersDb.prepare("SELECT slug FROM providers WHERE slug = ?").get(providerSlug);
  if (!providerRow) return c.json({ error: "Provider not found." }, 404);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  authDb
    .prepare("INSERT INTO user_saved_providers (user_id, provider_slug) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .run(user.id, providerSlug);

  return c.json({ ok: true });
});

app.delete("/api/saved-providers/:slug", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  authDb
    .prepare("DELETE FROM user_saved_providers WHERE user_id = ? AND provider_slug = ?")
    .run(user.id, slug);

  return c.json({ ok: true });
});

// ── Provider Profiles ─────────────────────────────────────────────────────────

app.get("/api/providers/:slug/profile", (c) => {
  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const row = authDb.prepare("SELECT * FROM provider_profiles WHERE provider_slug = ?").get(slug);

  const sub = authDb
    .prepare("SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND status = 'active'")
    .get(slug);
  const isVerified = Boolean(sub);

  if (!row) return c.json({ isVerified });

  let procedures = [];
  let priceRanges = {};
  try { procedures = JSON.parse(row.procedures_json || "[]"); } catch { /* ignore */ }
  try { priceRanges = JSON.parse(row.price_ranges_json || "{}"); } catch { /* ignore */ }

  return c.json({
    isVerified,
    displayName: row.display_name ?? null,
    address: row.address ?? null,
    hours: row.hours ?? null,
    phone: row.phone ?? null,
    websiteUrl: row.website_url ?? null,
    bookingUrl: row.booking_url ?? null,
    bio: row.bio ?? null,
    credentials: row.credentials ?? null,
    procedures,
    priceRanges,
  });
});

app.get("/api/portal/:slug/profile", (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare("SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'")
    .get(slug, user.id);
  if (!sub) return c.json({ error: "Active subscription required." }, 403);

  const row = authDb.prepare("SELECT * FROM provider_profiles WHERE provider_slug = ?").get(slug);
  if (!row) return c.json({});

  let procedures = [];
  let priceRanges = {};
  try { procedures = JSON.parse(row.procedures_json || "[]"); } catch { /* ignore */ }
  try { priceRanges = JSON.parse(row.price_ranges_json || "{}"); } catch { /* ignore */ }

  return c.json({
    displayName: row.display_name ?? "",
    address: row.address ?? "",
    hours: row.hours ?? "",
    phone: row.phone ?? "",
    websiteUrl: row.website_url ?? "",
    bookingUrl: row.booking_url ?? "",
    bio: row.bio ?? "",
    credentials: row.credentials ?? "",
    procedures,
    priceRanges,
  });
});

app.put("/api/portal/:slug/profile", async (c) => {
  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const slug = c.req.param("slug");
  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare("SELECT status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'")
    .get(slug, user.id);
  if (!sub) return c.json({ error: "Active subscription required." }, 403);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "Invalid request body." }, 400);

  // Validate procedures if provided
  let proceduresJson = null;
  if (body.procedures !== undefined) {
    if (!Array.isArray(body.procedures)) return c.json({ error: "procedures must be an array." }, 400);
    for (const p of body.procedures) {
      if (!VALID_PROCEDURES.has(p)) return c.json({ error: `Invalid procedure: ${p}` }, 400);
    }
    proceduresJson = JSON.stringify(body.procedures);
  }

  // Validate priceRanges if provided
  let priceRangesJson = null;
  if (body.priceRanges !== undefined) {
    if (typeof body.priceRanges !== "object" || Array.isArray(body.priceRanges)) {
      return c.json({ error: "priceRanges must be an object." }, 400);
    }
    priceRangesJson = JSON.stringify(body.priceRanges);
  }

  const str = (v) => (typeof v === "string" ? v.trim() : undefined);
  const fields = {
    display_name: str(body.displayName),
    address: str(body.address),
    hours: str(body.hours),
    phone: str(body.phone),
    website_url: str(body.websiteUrl),
    booking_url: str(body.bookingUrl),
    bio: str(body.bio),
    credentials: str(body.credentials),
    procedures_json: proceduresJson ?? undefined,
    price_ranges_json: priceRangesJson ?? undefined,
  };

  // Only include fields that were actually provided
  const updateFields = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (updateFields.length === 0) return c.json({ ok: true });

  const existing = authDb.prepare("SELECT id, user_id FROM provider_profiles WHERE provider_slug = ?").get(slug);

  if (existing) {
    if (existing.user_id !== user.id) return c.json({ error: "Forbidden." }, 403);
    const setClauses = updateFields.map(([col]) => `${col} = ?`).join(", ");
    const values = updateFields.map(([, v]) => v);
    authDb
      .prepare(`UPDATE provider_profiles SET ${setClauses}, updated_at = datetime('now') WHERE provider_slug = ?`)
      .run(...values, slug);
  } else {
    const cols = ["provider_slug", "user_id", ...updateFields.map(([col]) => col)].join(", ");
    const placeholders = Array(2 + updateFields.length).fill("?").join(", ");
    const values = [slug, user.id, ...updateFields.map(([, v]) => v)];
    authDb.prepare(`INSERT INTO provider_profiles (${cols}) VALUES (${placeholders})`).run(...values);
  }

  return c.json({ ok: true });
});

// ── Billing (Stripe) ──────────────────────────────────────────────────────────

app.post("/api/billing/create-checkout", async (c) => {
  if (!stripe) return c.json({ error: "Stripe is not configured." }, 503);
  if (!stripeVerifiedPriceId) return c.json({ error: "Stripe price not configured." }, 503);

  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const providerSlug = typeof body?.providerSlug === "string" ? body.providerSlug.trim() : "";
  if (!providerSlug) return c.json({ error: "providerSlug is required." }, 400);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id, email FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const claim = authDb
    .prepare("SELECT status FROM provider_claims WHERE provider_slug = ? AND user_id = ?")
    .get(providerSlug, user.id);
  if (!claim || claim.status !== "verified") {
    return c.json({ error: "You must have a verified claim for this provider to subscribe." }, 403);
  }

  let existingSub = authDb
    .prepare("SELECT stripe_customer_id, stripe_subscription_id, status FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ?")
    .get(providerSlug, user.id);

  if (existingSub?.status === "active") {
    return c.json({ error: "Subscription is already active." }, 409);
  }

  // Get or create Stripe customer
  let stripeCustomerId = existingSub?.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(user.id) },
    });
    stripeCustomerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: stripeVerifiedPriceId, quantity: 1 }],
    success_url: `${appPublicBaseUrl}/claim-verified?slug=${encodeURIComponent(providerSlug)}&checkout=success`,
    cancel_url: `${appPublicBaseUrl}/provider/${encodeURIComponent(providerSlug)}?checkout=canceled`,
    metadata: { providerSlug, userId: String(user.id) },
    subscription_data: { metadata: { providerSlug, userId: String(user.id) } },
  });

  if (existingSub) {
    authDb
      .prepare(
        `UPDATE provider_subscriptions
         SET stripe_customer_id = ?, stripe_checkout_session_id = ?, status = 'incomplete', updated_at = datetime('now')
         WHERE provider_slug = ? AND user_id = ?`
      )
      .run(stripeCustomerId, checkoutSession.id, providerSlug, user.id);
  } else {
    authDb
      .prepare(
        `INSERT INTO provider_subscriptions (user_id, provider_slug, stripe_customer_id, stripe_checkout_session_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(user.id, providerSlug, stripeCustomerId, checkoutSession.id);
  }

  return c.json({ checkoutUrl: checkoutSession.url });
});

app.post("/api/billing/webhook", async (c) => {
  if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

  const sig = c.req.header("stripe-signature") ?? "";
  const rawBody = Buffer.from(await c.req.raw.arrayBuffer());

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  const authDb = getAuthDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { providerSlug, userId } = session.metadata ?? {};
    if (providerSlug && userId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(String(session.subscription));
      authDb
        .prepare(
          `UPDATE provider_subscriptions
           SET stripe_subscription_id = ?, status = 'active',
               current_period_end = ?, updated_at = datetime('now')
           WHERE provider_slug = ? AND user_id = ?`
        )
        .run(
          String(session.subscription),
          new Date(sub.current_period_end * 1000).toISOString(),
          providerSlug,
          Number(userId)
        );
    }
  } else if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    const { providerSlug } = sub.metadata ?? {};
    if (providerSlug) {
      authDb
        .prepare(
          `UPDATE provider_subscriptions
           SET status = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = datetime('now')
           WHERE stripe_subscription_id = ?`
        )
        .run(
          sub.status,
          new Date(sub.current_period_end * 1000).toISOString(),
          sub.cancel_at_period_end ? 1 : 0,
          sub.id
        );
    }
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    authDb
      .prepare(
        `UPDATE provider_subscriptions SET status = 'canceled', updated_at = datetime('now')
         WHERE stripe_subscription_id = ?`
      )
      .run(sub.id);
  }

  return c.json({ received: true });
});

app.post("/api/billing/cancel", async (c) => {
  if (!stripe) return c.json({ error: "Stripe not configured." }, 503);

  const sessionData = getSessionFromRequest(c);
  if (!sessionData) return c.json({ error: "Not authenticated" }, 401);

  const csrfHeader = c.req.header("x-csrf-token");
  const csrfCookie = getCookie(c, csrfCookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfHeader !== sessionData.session.csrfToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const providerSlug = typeof body?.providerSlug === "string" ? body.providerSlug.trim() : "";
  if (!providerSlug) return c.json({ error: "providerSlug is required." }, 400);

  const authDb = getAuthDb();
  const user = authDb.prepare("SELECT id FROM users WHERE email = ?").get(sessionData.session.email);
  if (!user) return c.json({ error: "User not found." }, 404);

  const sub = authDb
    .prepare(
      "SELECT stripe_subscription_id FROM provider_subscriptions WHERE provider_slug = ? AND user_id = ? AND status = 'active'"
    )
    .get(providerSlug, user.id);
  if (!sub?.stripe_subscription_id) return c.json({ error: "No active subscription found." }, 404);

  await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  authDb
    .prepare(
      `UPDATE provider_subscriptions SET cancel_at_period_end = 1, updated_at = datetime('now')
       WHERE stripe_subscription_id = ?`
    )
    .run(sub.stripe_subscription_id);

  return c.json({ ok: true, cancelAtPeriodEnd: true });
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `Botch API listening on http://127.0.0.1:${info.port} (providers: ${providersDbPath}, auth: ${authDbPath})`
  );
});
