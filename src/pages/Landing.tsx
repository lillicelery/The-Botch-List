import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MeshGradient } from "@paper-design/shaders-react";
import SiteHeader from "../components/SiteHeader";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("loc", location.trim());
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : "/search");
  }

  return (
    <div className="page">
      {/* Shader covers header + hero + features */}
      <div style={{ position: "relative" }}>
        <MeshGradient
          className="shader-fill"
          colors={["#eef8f8", "#c3d3d8", "#5ec1c6", "#d4f0f0", "#2b8f95"]}
          speed={0.3}
          maxPixelCount={921_600}
        />
        <MeshGradient
          className="shader-fill"
          style={{ opacity: 0.5 }}
          colors={["#eef8f8", "#ffffff", "#47afb5", "#b0d8da"]}
          speed={0.15}
          distortion={0.2}
          maxPixelCount={921_600}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
        <SiteHeader />

        <main>
          <section className="hero">
            <h1 className="hero-headline">
              Find the right surgeon.
              <br />
              <em>Not just the closest one.</em>
            </h1>
            <p className="hero-sub">
              Search verified reviews and recovery stories from real patients across Google,
              Reddit, and more - before you book a consultation.
            </p>

            <form className="search-wrap" onSubmit={onSearch}>
              <div className="search-field">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Condition, procedure, clinic, or doctor"
                />
              </div>
              <div className="search-divider" />
              <div className="search-field">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9 8 14.5 8 14.5C8 14.5 12.5 9 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, state, or zip"
                />
              </div>
              <button className="search-btn" type="submit">
                Search
              </button>
            </form>

            <div className="stats">
              <div>
                <div className="stat-num">12k+</div>
                <div className="stat-label">Provider reviews</div>
              </div>
              <div>
                <div className="stat-num">340+</div>
                <div className="stat-label">Verified providers</div>
              </div>
              <div>
                <div className="stat-num">8</div>
                <div className="stat-label">Procedure categories</div>
              </div>
            </div>
          </section>

          <section className="features" id="compare">
            <article className="feat-card">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M9 2L11 7H16L12 10.5L13.5 16L9 13L4.5 16L6 10.5L2 7H7L9 2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="feat-title">Doctor Reviews</h2>
              <p className="feat-desc">
                See aggregated patient feedback pulled from Google, Reddit, and more - all
                in one profile.
              </p>
            </article>
            <article className="feat-card">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="2" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M5 5V4C5 2.9 5.9 2 7 2H11C12.1 2 13 2.9 13 4V5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M6 9H12M6 12H10"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 className="feat-title">Recovery Experiences</h2>
              <p className="feat-desc">
                Read real recovery stories filtered by procedure type - outcomes,
                timelines, and what to expect.
              </p>
            </article>
            <article className="feat-card">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M3 14V6L7 3L11 6V14"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path d="M11 9L15 7V14" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <path
                    d="M6 8H8M6 11H8"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 className="feat-title">Provider Comparison</h2>
              <p className="feat-desc">
                Compare providers side by side - ratings, procedures, locations, and
                patient sentiment scores.
              </p>
            </article>
            <article className="feat-card">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="9" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 14c0-2 1.8-3 4-3s4 1 4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="feat-title">Own Your Reputation</h2>
              <p className="feat-desc">
                Your patients are talking. Claim your profile to add your voice, respond to reviews,
                and build trust before they ever book a consult.
              </p>
              <Link className="feat-link" to="/auth">Claim your profile →</Link>
            </article>
          </section>
        </main>
        </div>
      </div>

      <footer className="footer">
        <span className="footer-logo" aria-label="The Botch List">
          <span className="site-header__logo-script">The</span>
          <span className="site-header__logo-main">Botch List</span>
        </span>
        <div className="footer-links">
          <a href="#about">About</a>
          <Link to="/search">Search Providers</Link>
          <a href="#review">Write a Review</a>
          <a href="#privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
