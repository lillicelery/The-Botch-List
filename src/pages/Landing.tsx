import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import SiteHeader from "../components/SiteHeader";
import {
  iconCompare,
  iconDoctorReviews,
  iconRecovery,
} from "../lib/figma-assets";
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
    <div className="landing" data-name="home/landing" data-node-id="7:417">
      <SiteHeader />

      <main className="landing__hero">
        <h1 className="landing__title" data-node-id="7:653">
          Many patient experiences aggregated in one place.
        </h1>
        <p className="landing__sub" data-node-id="7:656">
          Search publicly available reviews and recovery stories for medical and cosmetic procedures
        </p>

        <SearchBar
          query={query}
          location={location}
          onQueryChange={setQuery}
          onLocationChange={setLocation}
          onSubmit={onSearch}
          dataNodeId="7:658"
        />

        <div className="landing__feature-grid" data-name="Feature Cards" data-node-id="7:677">
          <article className="landing__feature-card" data-node-id="7:678">
            <div className="landing__feature-icon-wrap">
              <img src={iconDoctorReviews} alt="" width={24} height={24} />
            </div>
            <h2 className="landing__feature-title">Doctor Reviews</h2>
            <p className="landing__feature-desc">
              See patient feedback across multiple sources
            </p>
          </article>
          <article className="landing__feature-card" data-node-id="7:686">
            <div className="landing__feature-icon-wrap">
              <img src={iconRecovery} alt="" width={24} height={24} />
            </div>
            <h2 className="landing__feature-title">Recovery Experiences</h2>
            <p className="landing__feature-desc">View common concerns and outcomes</p>
          </article>
          <article
            className="landing__feature-card"
            id="compare"
            data-node-id="7:694"
          >
            <div className="landing__feature-icon-wrap">
              <img src={iconCompare} alt="" width={24} height={24} />
            </div>
            <h2 className="landing__feature-title">Provider Comparison</h2>
            <p className="landing__feature-desc">
              Side-by-side comparison tools to help you choose the best specialist for your needs.
            </p>
          </article>
        </div>
      </main>

      <footer className="landing__footer" data-name="Footer" data-node-id="10:2">
        <div className="landing__footer-inner">
          <div className="landing__footer-grid">
            <div className="landing__footer-brand">
              <p className="landing__footer-logo">The Botch List</p>
              <p className="landing__footer-tagline">
                Empowering patients with transparent healthcare data to make better recovery
                decisions.
              </p>
            </div>
            <div className="landing__footer-col">
              <h3 className="landing__footer-heading">Platform</h3>
              <ul className="landing__footer-list">
                <li>
                  <Link to="/search">Search Providers</Link>
                </li>
                <li>
                  <a href="#review">Write a Review</a>
                </li>
              </ul>
            </div>
            <div className="landing__footer-col">
              <h3 className="landing__footer-heading">Company</h3>
              <ul className="landing__footer-list">
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
          <div className="landing__footer-rule">
            <p className="landing__footer-copy">© 2026 The Botch List. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

