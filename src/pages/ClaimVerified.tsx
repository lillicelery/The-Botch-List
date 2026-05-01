import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { useProvidersData } from "../lib/ProvidersDataContext";
import "./ClaimVerified.css";

export default function ClaimVerified() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  const error = searchParams.get("error");
  const already = searchParams.get("already");

  const { refreshMe, subscriptions } = useAuth();
  const { bySlug } = useProvidersData();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) refreshMe();
  }, [slug]);

  const provider = slug ? bySlug.get(slug) : undefined;
  const mySub = subscriptions.find((s) => s.providerSlug === slug);
  const isActive = mySub?.status === "active";

  async function startCheckout() {
    if (!slug) return;
    setCheckingOut(true);
    setCheckoutError(null);
    const csrf = readCsrf();
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ providerSlug: slug }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setCheckoutError(data.error ?? "Unable to start checkout. Please try again.");
        setCheckingOut(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("Network error. Please try again.");
      setCheckingOut(false);
    }
  }

  function renderContent() {
    if (error === "missing_token" || error === "invalid_token") {
      return (
        <>
          <p className="auth-kicker">Verification failed</p>
          <h1 className="auth-title">Invalid verification link</h1>
          <p className="auth-subtitle">
            This verification link is invalid or has already been used. Return to the listing and
            request a new verification email.
          </p>
          {slug && (
            <div className="auth-actions">
              <Link to={`/claim/${slug}`} className="auth-btn auth-btn--primary">
                Resend verification
              </Link>
            </div>
          )}
        </>
      );
    }

    if (error === "expired_token") {
      return (
        <>
          <p className="auth-kicker">Verification expired</p>
          <h1 className="auth-title">Link has expired</h1>
          <p className="auth-subtitle">
            Your verification link expired after 72 hours. Request a new one below.
          </p>
          {slug && (
            <div className="auth-actions">
              <Link to={`/claim/${slug}`} className="auth-btn auth-btn--primary">
                Resend verification
              </Link>
            </div>
          )}
        </>
      );
    }

    if (already) {
      return (
        <>
          <p className="auth-kicker">Already verified</p>
          <h1 className="auth-title">You&apos;re already verified</h1>
          <p className="auth-subtitle">
            Your business claim for <strong>{provider?.name ?? slug}</strong> is already verified.
          </p>
          {!isActive && slug && (
            <div className="auth-actions">
              <button
                type="button"
                className="auth-btn auth-btn--primary"
                onClick={startCheckout}
                disabled={checkingOut}
              >
                {checkingOut ? "Redirecting…" : "Activate full features — $49/month"}
              </button>
            </div>
          )}
          {isActive && slug && (
            <div className="auth-actions">
              <Link to={`/provider-portal/${slug}`} className="auth-btn auth-btn--primary">
                Go to Provider Portal
              </Link>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <p className="auth-kicker">Business claimed</p>
        <h1 className="auth-title">Claim verified!</h1>
        <p className="auth-subtitle">
          Your claim for <strong>{provider?.name ?? slug}</strong> has been verified. Activate your
          verified badge and full provider features for <strong>$49/month</strong>.
        </p>
        {checkoutError && (
          <p className="auth-error" role="alert">
            {checkoutError}
          </p>
        )}
        <div className="auth-actions">
          {slug && (
            <button
              type="button"
              className="auth-btn auth-btn--primary"
              onClick={startCheckout}
              disabled={checkingOut}
            >
              {checkingOut ? "Redirecting to checkout…" : "Activate — $49/month"}
            </button>
          )}
          {slug && (
            <Link to={`/provider/${slug}`} className="auth-btn auth-btn--ghost">
              Back to listing
            </Link>
          )}
        </div>
        <p className="claim-verified-note">
          Features included: verified badge on your listing, respond to patient reviews, analytics
          dashboard, and priority listing sort.
        </p>
      </>
    );
  }

  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main">
        <section className="auth-panel">{renderContent()}</section>
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
