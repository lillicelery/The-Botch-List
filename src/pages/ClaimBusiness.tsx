import { FormEvent, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { useProvidersData } from "../lib/ProvidersDataContext";
import "./ClaimBusiness.css";

export default function ClaimBusiness() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus, userRole, claims } = useAuth();
  const { bySlug, status: dataStatus } = useProvidersData();

  const [businessEmail, setBusinessEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const provider = slug ? bySlug.get(slug) : undefined;
  const existingClaim = claims.find((c) => c.providerSlug === slug);
  const isResend = existingClaim?.status === "pending_verification";

  if (authStatus === "loading" || dataStatus === "loading") {
    return (
      <div className="auth-page">
        <SiteHeader />
        <main className="auth-main">
          <div className="auth-panel">
            <p className="auth-kicker">Loading…</p>
          </div>
        </main>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return <Navigate to={`/auth?next=/claim/${slug}`} replace />;
  }

  if (userRole !== "provider") {
    return (
      <div className="auth-page">
        <SiteHeader />
        <main className="auth-main">
          <section className="auth-panel">
            <p className="auth-kicker">Account type required</p>
            <h1 className="auth-title">Provider account needed</h1>
            <p className="auth-subtitle">
              Claiming a business requires a Provider account. Create one by{" "}
              <Link to="/auth" className="auth-inline-link">
                signing up as a Provider
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setSubmitting(true);

    const csrf = readCsrf();
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ providerSlug: slug, businessEmail }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devVerifyLink?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.devVerifyLink) setDevLink(data.devVerifyLink);
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main">
        <section className="auth-panel claim-panel">
          {submitted ? (
            <>
              <p className="auth-kicker">Check your inbox</p>
              <h1 className="auth-title">Verification email sent</h1>
              <p className="auth-subtitle">
                We sent a verification link to <strong>{businessEmail}</strong>. Click it within 72 hours to
                complete your claim.
              </p>
              {devLink && (
                <div className="claim-dev-link">
                  <p className="claim-dev-label">Dev mode — email not configured:</p>
                  <a href={devLink} className="auth-inline-link claim-dev-url">
                    {devLink}
                  </a>
                </div>
              )}
              <div className="auth-actions" style={{ marginTop: 20 }}>
                <Link to={`/provider/${slug}`} className="auth-btn auth-btn--ghost">
                  Back to listing
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="auth-kicker">Business claiming</p>
              <h1 className="auth-title">
                {isResend ? "Resend verification" : "Claim this business"}
              </h1>

              {provider && (
                <div className="claim-provider-preview">
                  <p className="claim-preview-name">{provider.name}</p>
                  <p className="claim-preview-meta">{provider.metaLine}</p>
                </div>
              )}

              <p className="auth-subtitle" style={{ marginTop: 16 }}>
                Enter the email address of your business domain (e.g.{" "}
                <em>you@yourclinic.com</em>). We&apos;ll send a verification link to confirm
                you have access.
              </p>

              <form className="auth-form" onSubmit={onSubmit} noValidate>
                <label className="auth-label" htmlFor="businessEmail">
                  Business email address
                </label>
                <input
                  id="businessEmail"
                  type="email"
                  className="auth-input"
                  autoComplete="email"
                  placeholder="you@yourclinic.com"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  required
                />

                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="auth-btn auth-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : isResend ? "Resend verification email" : "Send verification email"}
                </button>
              </form>

              <p className="claim-footer-note">
                <Link to={`/provider/${slug}`} className="auth-inline-link">
                  Cancel
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function readCsrf(): string | null {
  const pair = document.cookie.split("; ").find((p) => p.startsWith("botch_csrf="));
  if (!pair) return null;
  const v = pair.slice("botch_csrf=".length);
  return v ? decodeURIComponent(v) : null;
}
