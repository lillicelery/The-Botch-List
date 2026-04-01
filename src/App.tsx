import { FormEvent, useState } from "react";
import {
  iconCompare,
  iconDoctorReviews,
  iconLocation,
  iconRecovery,
  iconSearch,
} from "./figma-assets";
import "./App.css";

export default function App() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    // Wire to routing or API when available
  }

  return (
    <div className="landing" data-name="home/landing" data-node-id="7:417">
      <header className="nav-shell" data-name="Navigation (Global)" data-node-id="23:602">
        <div className="nav-inner">
          <div className="nav-left">
            <a href="/" className="logo">
              The Botch List
            </a>
            <nav className="nav-links" aria-label="Primary">
              <a href="#search" className="nav-link">
                Search
              </a>
              <a href="#compare" className="nav-link">
                Compare
              </a>
            </nav>
          </div>
          <a href="#sign-in" className="nav-signin">
            Sign In
          </a>
        </div>
      </header>

      <main className="hero">
        <h1 className="hero-title" data-node-id="7:653">
          Many patient experiences aggregated in one place.
        </h1>
        <p className="hero-sub" data-node-id="7:656">
          Search publicly available reviews and recovery stories for medical and
          cosmetic procedures
        </p>

        <form className="search-bar" onSubmit={onSearch} data-name="Search Component" data-node-id="7:658">
          <div className="search-field">
            <span className="search-icon" aria-hidden>
              <img src={iconSearch} alt="" width={20} height={20} />
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="Condition, procedure, clinic, or doctor name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Condition, procedure, clinic, or doctor name"
            />
          </div>
          <div className="search-divider" aria-hidden />
          <div className="search-field">
            <span className="search-icon" aria-hidden>
              <img src={iconLocation} alt="" width={20} height={20} />
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="City, state, or zip code"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="City, state, or zip code"
            />
          </div>
          <button type="submit" className="search-submit">
            Search
          </button>
        </form>

        <div className="feature-grid" data-name="Feature Cards" data-node-id="7:677">
          <article className="feature-card" data-node-id="7:678">
            <div className="feature-icon-wrap">
              <img src={iconDoctorReviews} alt="" width={24} height={24} />
            </div>
            <h2 className="feature-title">Doctor Reviews</h2>
            <p className="feature-desc">
              See patient feedback across multiple sources
            </p>
          </article>
          <article className="feature-card" data-node-id="7:686">
            <div className="feature-icon-wrap">
              <img src={iconRecovery} alt="" width={24} height={24} />
            </div>
            <h2 className="feature-title">Recovery Experiences</h2>
            <p className="feature-desc">View common concerns and outcomes</p>
          </article>
          <article className="feature-card feature-card-accent" data-node-id="7:694">
            <div className="feature-icon-wrap">
              <img src={iconCompare} alt="" width={24} height={24} />
            </div>
            <h2 className="feature-title">Provider Comparison</h2>
            <p className="feature-desc">
              Side-by-side comparison tools to help you choose the best specialist
              for your needs.
            </p>
          </article>
        </div>
      </main>

      <footer className="site-footer" data-name="Footer" data-node-id="10:2">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <p className="footer-logo">The Botch List</p>
              <p className="footer-tagline">
                Empowering patients with transparent healthcare data to make better
                recovery decisions.
              </p>
            </div>
            <div className="footer-col">
              <h3 className="footer-heading">Platform</h3>
              <ul className="footer-list">
                <li>
                  <a href="#providers">Search Providers</a>
                </li>
                <li>
                  <a href="#review">Write a Review</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3 className="footer-heading">Company</h3>
              <ul className="footer-list">
                <li>
                  <a href="#about">About Us</a>
                </li>
                <li>
                  <a href="#privacy">Privacy Policy</a>
                </li>
                <li>
                  <a href="#contact">Contact</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-rule">
            <p className="footer-copy">© 2025 The Botch List. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
