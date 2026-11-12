/**
 * Shared auth-database schema, used by the API server and by `scripts/seed-demo.mjs`.
 */

/** Procedures a provider may list on their profile (validated on PUT /api/portal/:slug/profile). */
export const VALID_PROCEDURES = new Set([
  "BBL", "Blepharoplasty", "Body contouring", "Botox", "Breast augmentation",
  "Breast lift", "Breast reduction", "Brow lift", "Chin surgery", "Coolsculpting",
  "Dermal fillers", "Facelift", "Fat transfer", "Gynecomastia", "Lip lift",
  "Liposuction", "Medical spa", "Mommy makeover", "Neck lift", "Otoplasty",
  "Rhinoplasty", "Tummy tuck",
]);

/** Creates tables / indexes if missing and applies in-place migrations. Safe to run repeatedly. */
export function initAuthSchema(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
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
  const hasUserRole = db
    .prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'user_role'")
    .get();
  if (!hasUserRole) {
    db.exec(
      `ALTER TABLE users ADD COLUMN user_role TEXT NOT NULL DEFAULT 'user' CHECK(user_role IN ('user', 'provider', 'admin'))`
    );
  }
  return db;
}
