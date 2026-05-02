import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { COSMETIC_PROCEDURE_FILTER_OPTIONS } from "../lib/cosmeticProcedureFilters";
import { useProvidersData } from "../lib/ProvidersDataContext";
import type { PatientSnippet } from "../types/provider";
import "./ProviderPortal.css";

interface Analytics {
  totalSnippets: number;
  sentimentCounts: { Positive: number; Okay: number; Negative: number };
  topSources: { name: string; count: number }[];
  respondedCount: number;
}

interface SavedResponse {
  snippetId: string;
  responseText: string;
}

function readCsrf(): string | null {
  const pair = document.cookie.split("; ").find((p) => p.startsWith("botch_csrf="));
  if (!pair) return null;
  const v = pair.slice("botch_csrf=".length);
  return v ? decodeURIComponent(v) : null;
}

function SentimentBar({ positive, okay, negative }: { positive: number; okay: number; negative: number }) {
  const total = positive + okay + negative;
  if (total === 0) return <div className="portal-sentiment-bar portal-sentiment-bar--empty" />;
  const pPos = (positive / total) * 100;
  const pOkay = (okay / total) * 100;
  const pNeg = (negative / total) * 100;
  return (
    <div className="portal-sentiment-bar" title={`Positive: ${positive}, Okay: ${okay}, Negative: ${negative}`}>
      {pPos > 0 && <div className="portal-bar-seg portal-bar-seg--positive" style={{ width: `${pPos}%` }} />}
      {pOkay > 0 && <div className="portal-bar-seg portal-bar-seg--okay" style={{ width: `${pOkay}%` }} />}
      {pNeg > 0 && <div className="portal-bar-seg portal-bar-seg--negative" style={{ width: `${pNeg}%` }} />}
    </div>
  );
}

function ResponseForm({
  snippet,
  existing,
  onSaved,
}: {
  snippet: PatientSnippet;
  existing: string | undefined;
  onSaved: (snippetId: string, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { slug } = useParams<{ slug: string }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    const csrf = readCsrf();
    try {
      const res = await fetch(`/api/portal/${slug}/responses`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ snippetId: snippet.id, responseText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      onSaved(snippet.id, text);
      setOpen(false);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-response-section">
      {existing && !open ? (
        <div className="portal-response-saved">
          <p className="portal-response-label">Your response:</p>
          <p className="portal-response-text">{existing}</p>
          <button type="button" className="portal-link-btn" onClick={() => setOpen(true)}>
            Edit
          </button>
        </div>
      ) : open ? (
        <form onSubmit={submit} className="portal-response-form">
          <textarea
            className="portal-response-textarea"
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a professional response to this review…"
          />
          {error && <p className="portal-response-error">{error}</p>}
          <div className="portal-response-actions">
            <button type="submit" className="portal-btn portal-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save response"}
            </button>
            <button type="button" className="portal-btn portal-btn--ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="portal-link-btn" onClick={() => setOpen(true)}>
          + Add response
        </button>
      )}
    </div>
  );
}

interface ProfileData {
  displayName: string;
  address: string;
  hours: string;
  phone: string;
  websiteUrl: string;
  bookingUrl: string;
  bio: string;
  credentials: string;
  procedures: string[];
  priceRanges: Record<string, string>;
}

const EMPTY_PROFILE: ProfileData = {
  displayName: "", address: "", hours: "", phone: "",
  websiteUrl: "", bookingUrl: "", bio: "", credentials: "",
  procedures: [], priceRanges: {},
};

function ProfileEditor({ slug }: { slug: string }) {
  const [form, setForm] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${slug}/profile`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: Partial<ProfileData>) => {
        setForm({
          displayName: data.displayName ?? "",
          address: data.address ?? "",
          hours: data.hours ?? "",
          phone: data.phone ?? "",
          websiteUrl: data.websiteUrl ?? "",
          bookingUrl: data.bookingUrl ?? "",
          bio: data.bio ?? "",
          credentials: data.credentials ?? "",
          procedures: data.procedures ?? [],
          priceRanges: data.priceRanges ?? {},
        });
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [slug]);

  function setField(field: keyof ProfileData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleProcedure(proc: string) {
    setForm((prev) => {
      const set = new Set(prev.procedures);
      const next = { ...prev.priceRanges };
      if (set.has(proc)) {
        set.delete(proc);
        delete next[proc];
      } else {
        set.add(proc);
      }
      return { ...prev, procedures: [...set], priceRanges: next };
    });
  }

  function setPriceRange(proc: string, value: string) {
    setForm((prev) => ({
      ...prev,
      priceRanges: { ...prev.priceRanges, [proc]: value },
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    const csrf = readCsrf();
    try {
      const res = await fetch(`/api/portal/${slug}/profile`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          displayName: form.displayName,
          address: form.address,
          hours: form.hours,
          phone: form.phone,
          websiteUrl: form.websiteUrl,
          bookingUrl: form.bookingUrl,
          bio: form.bio,
          credentials: form.credentials,
          procedures: form.procedures,
          priceRanges: form.priceRanges,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg({ ok: false, text: data.error ?? "Save failed." });
      } else {
        setSaveMsg({ ok: true, text: "Profile saved." });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="portal-loading">Loading profile…</p>;

  return (
    <form className="portal-profile-form" onSubmit={handleSubmit}>
      <fieldset className="portal-profile-section">
        <legend className="portal-profile-section-title">Practice Info</legend>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-display-name">Display name</label>
          <input id="pf-display-name" className="portal-field-input" type="text" value={form.displayName} onChange={(e) => setField("displayName", e.target.value)} placeholder="Public name for this practice" />
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-address">Address</label>
          <input id="pf-address" className="portal-field-input" type="text" value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="123 Main St, City, State ZIP" />
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-phone">Phone</label>
          <input id="pf-phone" className="portal-field-input" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(555) 555-5555" />
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-hours">Hours</label>
          <textarea id="pf-hours" className="portal-field-textarea" rows={3} value={form.hours} onChange={(e) => setField("hours", e.target.value)} placeholder="Mon–Fri 9am–5pm&#10;Sat 10am–2pm" />
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-website">Website</label>
          <input id="pf-website" className="portal-field-input" type="url" value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://yourpractice.com" />
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-booking">Consultation / booking link</label>
          <input id="pf-booking" className="portal-field-input" type="url" value={form.bookingUrl} onChange={(e) => setField("bookingUrl", e.target.value)} placeholder="https://book.yourpractice.com" />
        </div>
      </fieldset>

      <fieldset className="portal-profile-section">
        <legend className="portal-profile-section-title">Bio &amp; Credentials</legend>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-bio">Bio</label>
          <textarea id="pf-bio" className="portal-field-textarea" rows={5} maxLength={1000} value={form.bio} onChange={(e) => setField("bio", e.target.value)} placeholder="Tell patients about your practice, philosophy, and expertise…" />
          <p className="portal-field-hint">{form.bio.length}/1000</p>
        </div>
        <div className="portal-field-group">
          <label className="portal-field-label" htmlFor="pf-credentials">Credentials &amp; certifications</label>
          <textarea id="pf-credentials" className="portal-field-textarea" rows={3} value={form.credentials} onChange={(e) => setField("credentials", e.target.value)} placeholder="Board-certified plastic surgeon, ASPS member…" />
        </div>
      </fieldset>

      <fieldset className="portal-profile-section">
        <legend className="portal-profile-section-title">Procedures Offered</legend>
        <p className="portal-field-hint">Select the procedures your practice performs.</p>
        <ul className="portal-procedure-grid">
          {COSMETIC_PROCEDURE_FILTER_OPTIONS.map((proc) => (
            <li key={proc}>
              <label className="portal-proc-label">
                <input
                  type="checkbox"
                  checked={form.procedures.includes(proc)}
                  onChange={() => toggleProcedure(proc)}
                />
                {proc}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {form.procedures.length > 0 && (
        <fieldset className="portal-profile-section">
          <legend className="portal-profile-section-title">Starting Price Ranges <span className="portal-field-hint">(optional)</span></legend>
          <p className="portal-field-hint">Add a starting price range for any procedure you offer.</p>
          {form.procedures.map((proc) => (
            <div key={proc} className="portal-price-range-row">
              <label className="portal-price-range-label" htmlFor={`price-${proc}`}>{proc}</label>
              <input
                id={`price-${proc}`}
                className="portal-field-input portal-field-input--price"
                type="text"
                value={form.priceRanges[proc] ?? ""}
                onChange={(e) => setPriceRange(proc, e.target.value)}
                placeholder="e.g. $5,000–$15,000"
              />
            </div>
          ))}
        </fieldset>
      )}

      {saveMsg && (
        <p className={`portal-save-msg${saveMsg.ok ? " portal-save-msg--ok" : " portal-save-msg--err"}`}>
          {saveMsg.text}
        </p>
      )}
      <button type="submit" className="portal-btn portal-btn--primary" disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export default function ProviderPortal() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus, claims, subscriptions, refreshMe } = useAuth();
  const { bySlug, status: dataStatus } = useProvidersData();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [portalTab, setPortalTab] = useState<"analytics" | "profile" | "subscription">("analytics");

  const provider = slug ? bySlug.get(slug) : undefined;
  const myClaim = claims.find((c) => c.providerSlug === slug);
  const mySub = subscriptions.find((s) => s.providerSlug === slug);
  const isActive = mySub?.status === "active";

  useEffect(() => {
    if (!slug || !isActive) return;
    fetch(`/api/portal/${slug}/analytics`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setAnalytics(data))
      .catch(() => null);
    fetch(`/api/portal/${slug}/responses`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: SavedResponse[]) => setResponses(Array.isArray(data) ? data : []))
      .catch(() => null);
  }, [slug, isActive]);

  if (authStatus === "loading" || dataStatus === "loading") {
    return (
      <div className="portal-page">
        <SiteHeader />
        <main className="portal-main">
          <p className="portal-loading">Loading…</p>
        </main>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return <Navigate to={`/auth?next=/provider-portal/${slug}`} replace />;
  }

  if (!myClaim || myClaim.status !== "verified") {
    return (
      <div className="portal-page">
        <SiteHeader />
        <main className="portal-main">
          <div className="portal-gate">
            <p className="auth-kicker">Verification required</p>
            <h1 className="portal-gate-title">Verify your claim first</h1>
            <p className="portal-gate-body">
              You need a verified business claim to access the Provider Portal.
            </p>
            {slug && (
              <Link to={`/claim/${slug}`} className="portal-btn portal-btn--primary">
                Claim this business
              </Link>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="portal-page">
        <SiteHeader />
        <main className="portal-main">
          <div className="portal-gate">
            <p className="auth-kicker">Subscription required</p>
            <h1 className="portal-gate-title">Activate your portal</h1>
            <p className="portal-gate-body">
              Get your verified badge, analytics, and the ability to respond to reviews for{" "}
              <strong>$49/month</strong>.
            </p>
            <Link to={`/claim-verified?slug=${slug}`} className="portal-btn portal-btn--primary">
              Activate — $49/month
            </Link>
          </div>
        </main>
      </div>
    );
  }

  async function cancelSubscription() {
    if (!slug) return;
    setCanceling(true);
    const csrf = readCsrf();
    try {
      await fetch("/api/billing/cancel", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ providerSlug: slug }),
      });
      await refreshMe();
      setCancelConfirm(false);
    } catch {
      // ignore
    } finally {
      setCanceling(false);
    }
  }

  const responseMap = new Map(responses.map((r) => [r.snippetId, r.responseText]));

  return (
    <div className="portal-page">
      <SiteHeader />
      <main className="portal-main">
        {/* Hero */}
        <header className="portal-hero">
          <div className="portal-hero__top">
            <h1 className="portal-provider-name">{provider?.name ?? slug}</h1>
            <span className="portal-verified-badge">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="7" fill="#0d9488" />
                <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified Provider
            </span>
          </div>
          {provider && <p className="portal-meta">{provider.metaLine}</p>}
        </header>

        {/* Tab bar */}
        <div className="portal-tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={portalTab === "analytics"}
            className={portalTab === "analytics" ? "portal-tab portal-tab--active" : "portal-tab"}
            onClick={() => setPortalTab("analytics")}
          >
            Analytics
          </button>
          <button
            role="tab"
            aria-selected={portalTab === "profile"}
            className={portalTab === "profile" ? "portal-tab portal-tab--active" : "portal-tab"}
            onClick={() => setPortalTab("profile")}
          >
            Edit Profile
          </button>
          <button
            role="tab"
            aria-selected={portalTab === "subscription"}
            className={portalTab === "subscription" ? "portal-tab portal-tab--active" : "portal-tab"}
            onClick={() => setPortalTab("subscription")}
          >
            Subscription
          </button>
        </div>

        {/* Analytics tab */}
        {portalTab === "analytics" && (
          <>
            <section className="portal-section" aria-labelledby="analytics-heading">
              <h2 className="portal-section-title" id="analytics-heading">Analytics</h2>
              {analytics ? (
                <div className="portal-analytics-grid">
                  <div className="portal-stat-card">
                    <p className="portal-stat-label">Total snippets</p>
                    <p className="portal-stat-value">{analytics.totalSnippets}</p>
                  </div>
                  <div className="portal-stat-card">
                    <p className="portal-stat-label">Responses submitted</p>
                    <p className="portal-stat-value">{analytics.respondedCount}</p>
                  </div>
                  <div className="portal-stat-card portal-stat-card--wide">
                    <p className="portal-stat-label">Sentiment breakdown</p>
                    <SentimentBar
                      positive={analytics.sentimentCounts.Positive}
                      okay={analytics.sentimentCounts.Okay}
                      negative={analytics.sentimentCounts.Negative}
                    />
                    <div className="portal-sentiment-legend">
                      <span className="portal-legend-item portal-legend-item--positive">
                        Positive: {analytics.sentimentCounts.Positive}
                      </span>
                      <span className="portal-legend-item portal-legend-item--okay">
                        Good: {analytics.sentimentCounts.Okay}
                      </span>
                      <span className="portal-legend-item portal-legend-item--negative">
                        Negative: {analytics.sentimentCounts.Negative}
                      </span>
                    </div>
                  </div>
                  {analytics.topSources.length > 0 && (
                    <div className="portal-stat-card portal-stat-card--wide">
                      <p className="portal-stat-label">Top review sources</p>
                      <ul className="portal-source-list">
                        {analytics.topSources.map((s) => (
                          <li key={s.name} className="portal-source-item">
                            <span className="portal-source-name">{s.name}</span>
                            <span className="portal-source-count">{s.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="portal-loading">Loading analytics…</p>
              )}
            </section>

            {provider && provider.snippets.length > 0 && (
              <section className="portal-section" aria-labelledby="reviews-heading">
                <h2 className="portal-section-title" id="reviews-heading">Respond to Reviews</h2>
                <div className="portal-reviews-list">
                  {provider.snippets.slice(0, 20).map((snippet) => (
                    <article key={snippet.id} className="portal-review-card">
                      <div className="portal-review-meta">
                        <span className={`portal-review-sentiment portal-review-sentiment--${snippet.sentiment.toLowerCase()}`}>
                          {snippet.sentiment}
                        </span>
                        <span className="portal-review-author">{snippet.authorLabel}</span>
                        {snippet.postedRelative && (
                          <span className="portal-review-date">{snippet.postedRelative}</span>
                        )}
                      </div>
                      <p className="portal-review-excerpt">{snippet.excerpt}</p>
                      <ResponseForm
                        snippet={snippet}
                        existing={responseMap.get(snippet.id)}
                        onSaved={(id, text) =>
                          setResponses((prev) => {
                            const next = prev.filter((r) => r.snippetId !== id);
                            return [...next, { snippetId: id, responseText: text }];
                          })
                        }
                      />
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Edit Profile tab */}
        {portalTab === "profile" && slug && (
          <section className="portal-section" aria-labelledby="profile-heading">
            <h2 className="portal-section-title" id="profile-heading">Edit Profile</h2>
            <p className="portal-section-lead">This information appears publicly on your provider page.</p>
            <ProfileEditor slug={slug} />
          </section>
        )}

        {/* Subscription tab */}
        {portalTab === "subscription" && (
          <section className="portal-section portal-section--subscription" aria-labelledby="sub-heading">
            <h2 className="portal-section-title" id="sub-heading">Subscription</h2>
            <div className="portal-sub-card">
              <div className="portal-sub-details">
                <p className="portal-sub-plan">Verified Provider — $49/month</p>
                {mySub?.currentPeriodEnd && (
                  <p className="portal-sub-renewal">
                    {mySub.cancelAtPeriodEnd
                      ? `Cancels on ${new Date(mySub.currentPeriodEnd).toLocaleDateString()}`
                      : `Renews on ${new Date(mySub.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              {!mySub?.cancelAtPeriodEnd && (
                <>
                  {cancelConfirm ? (
                    <div className="portal-cancel-confirm">
                      <p>Cancel at end of billing period?</p>
                      <button
                        type="button"
                        className="portal-btn portal-btn--danger"
                        onClick={cancelSubscription}
                        disabled={canceling}
                      >
                        {canceling ? "Canceling…" : "Yes, cancel"}
                      </button>
                      <button type="button" className="portal-btn portal-btn--ghost" onClick={() => setCancelConfirm(false)}>
                        Keep subscription
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="portal-link-btn portal-link-btn--muted" onClick={() => setCancelConfirm(true)}>
                      Cancel subscription
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
