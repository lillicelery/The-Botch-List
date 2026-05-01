import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
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

export default function ProviderPortal() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus, claims, subscriptions, refreshMe } = useAuth();
  const { bySlug, status: dataStatus } = useProvidersData();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

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

        {/* Analytics */}
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

        {/* Respond to reviews */}
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

        {/* Subscription management */}
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
      </main>
    </div>
  );
}
