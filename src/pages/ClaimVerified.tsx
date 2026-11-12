import { useEffect } from "react";
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

  const { refreshMe } = useAuth();
  const { bySlug } = useProvidersData();

  useEffect(() => {
    if (slug) refreshMe();
  }, [slug]);

  const provider = slug ? bySlug.get(slug) : undefined;

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

    return (
      <>
        <p className="auth-kicker">{already ? "Already verified" : "Business claimed"}</p>
        <h1 className="auth-title">{already ? "You're already verified" : "Claim verified!"}</h1>
        <p className="auth-subtitle">
          Your claim for <strong>{provider?.name ?? slug}</strong> is verified. Your listing now shows a
          verified badge, and you can manage it from the Provider Portal.
        </p>
        <div className="auth-actions">
          {slug && (
            <Link to={`/provider-portal/${slug}`} className="auth-btn auth-btn--primary">
              Go to Provider Portal
            </Link>
          )}
          {slug && (
            <Link to={`/provider/${slug}`} className="auth-btn auth-btn--ghost">
              Back to listing
            </Link>
          )}
        </div>
        <p className="claim-verified-note">
          Included free: verified badge, review analytics, responses to patient reviews, and an editable
          public profile. Paid provider plans are coming soon.
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
