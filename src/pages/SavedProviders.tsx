import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { useProvidersData } from "../lib/ProvidersDataContext";
import "./SavedProviders.css";

export default function SavedProviders() {
  const { status, savedProviders, unsaveProvider } = useAuth();
  const { bySlug } = useProvidersData();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "idle") {
      navigate("/auth", { replace: true });
    }
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <div className="saved-page">
        <SiteHeader />
        <main className="saved-main">
          <p className="saved-loading">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <SiteHeader />
      <main className="saved-main">
        <div className="saved-header">
          <h1 className="saved-title">Saved Providers</h1>
          <span className="saved-count">{savedProviders.length} saved</span>
        </div>

        {savedProviders.length === 0 ? (
          <div className="saved-empty">
            <p>You haven&apos;t saved any providers yet.</p>
            <Link to="/search" className="saved-empty-link">
              Browse providers
            </Link>
          </div>
        ) : (
          <ul className="saved-list">
            {savedProviders.map((slug) => {
              const provider = bySlug.get(slug);
              const name = provider?.name ?? slug;
              const meta = provider?.metaLine ?? "";
              return (
                <li key={slug} className="saved-item">
                  <Link to={`/provider/${slug}`} className="saved-item__link">
                    <div className="saved-item__info">
                      <span className="saved-item__name">{name}</span>
                      {meta && <span className="saved-item__meta">{meta}</span>}
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="saved-item__remove"
                    onClick={() => unsaveProvider(slug)}
                    aria-label={`Remove ${name} from saved`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
