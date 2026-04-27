import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import SiteHeader from "../components/SiteHeader";
import { useProvidersData } from "../lib/ProvidersDataContext";
import { COSMETIC_PROCEDURE_FILTER_OPTIONS } from "../lib/cosmeticProcedureFilters";
import {
  filterSearchProviders,
  RATING_FILTER_OPTIONS,
  type SidebarFilterState,
} from "../lib/searchFilters";
import { getProviderType } from "../lib/providerType";
import "./SearchResults.css";

type SearchType = "places" | "practitioners";

function sentimentBadgeClass(sentiment: string): string {
  const base = "sentiment-badge";
  if (sentiment === "Very Positive") return `${base} sentiment-very-positive`;
  if (sentiment === "Positive") return `${base} sentiment-positive`;
  if (sentiment === "Very Negative" || sentiment === "Negative") return `${base} sentiment-negative`;
  if (sentiment === "Okay") return `${base} sentiment-okay`;
  return base;
}

export default function SearchResults() {
  const { providers, status } = useProvidersData();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const locParam = searchParams.get("loc") ?? "";
  const typeParam = (searchParams.get("type") ?? "places") as SearchType;

  const [query, setQuery] = useState(qParam);
  const [location, setLocation] = useState(locParam || "Florida");
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterState>({
    specialties: [],
    ratings: [],
  });

  useEffect(() => {
    setQuery(qParam);
    setLocation(locParam || "Florida");
  }, [qParam, locParam]);

  const filteredProviders = useMemo(() => {
    if (status === "loading") return [];
    const base = filterSearchProviders(providers, qParam, locParam, sidebarFilters);
    return base.filter((p) => getProviderType(p) === (typeParam === "practitioners" ? "practitioner" : "place"));
  }, [status, providers, qParam, locParam, sidebarFilters, typeParam]);

  function switchType(type: SearchType) {
    const next = new URLSearchParams(searchParams);
    next.set("type", type);
    setSearchParams(next);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (location.trim()) next.set("loc", location.trim());
    next.set("type", typeParam);
    setSearchParams(next);
  }

  function toggleSpecialty(value: string) {
    startTransition(() => {
      setSidebarFilters((prev) => {
        const set = new Set(prev.specialties);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        return { ...prev, specialties: [...set] };
      });
    });
  }

  function toggleRating(option: (typeof RATING_FILTER_OPTIONS)[number]) {
    startTransition(() => {
      setSidebarFilters((prev) => {
        const set = new Set(prev.ratings);
        if (set.has(option)) set.delete(option);
        else set.add(option);
        return { ...prev, ratings: [...set] };
      });
    });
  }

  function resetSidebarFilters() {
    startTransition(() => {
      setSidebarFilters({ specialties: [], ratings: [] });
    });
  }

  return (
    <div className="search-results-page" data-name="search results" data-node-id="6:3">
      <SiteHeader activeNav="search" />

      <main className="search-results-main">
        <div className="search-header-wrap">
          <SearchBar
            query={query}
            location={location}
            onQueryChange={setQuery}
            onLocationChange={setLocation}
            onSubmit={onSearch}
            queryPlaceholder="Condition, procedure, clinic, or doctor"
            dataNodeId="6:250"
          />
        </div>

        <div className="results-layout">
          <aside className="filters-panel" data-name="Aside - Filters Sidebar" data-node-id="6:74">
            <div className="filters-header">
              <h2 className="filters-title" data-node-id="6:78">
                Filters
              </h2>
              <button type="button" className="filters-reset" data-node-id="6:80" onClick={resetSidebarFilters}>
                Reset
              </button>
            </div>

            <div className="filter-section filter-section--procedures" data-node-id="6:82">
              <p className="filter-label" id="filter-procedure">
                Cosmetic procedure
              </p>
              <p className="filter-section-hint" id="filter-procedure-hint">
                Select one or more; leave all unchecked to show every procedure.
              </p>
              <ul
                className="filter-options filter-options--scroll"
                role="group"
                aria-labelledby="filter-procedure"
                aria-describedby="filter-procedure-hint"
              >
                {COSMETIC_PROCEDURE_FILTER_OPTIONS.map((label) => (
                  <li key={label}>
                    <label className="filter-option">
                      <input
                        type="checkbox"
                        name="procedure"
                        value={label}
                        checked={sidebarFilters.specialties.includes(label)}
                        onChange={() => toggleSpecialty(label)}
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="filter-section" data-node-id="6:98">
              <p className="filter-label" id="filter-rating">
                Review rating
              </p>
              <ul className="filter-options" role="group" aria-labelledby="filter-rating">
                {RATING_FILTER_OPTIONS.map((option) => (
                  <li key={option}>
                    <label className="filter-option">
                      <input
                        type="checkbox"
                        name="review-rating"
                        value={option}
                        checked={sidebarFilters.ratings.includes(option)}
                        onChange={() => toggleRating(option)}
                      />
                      {option}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="filter-section distance-section" data-node-id="6:110">
              <p className="filter-label" id="filter-distance">
                Distance
              </p>
              <input
                type="range"
                className="distance-slider"
                min={1}
                max={100}
                defaultValue={40}
                aria-labelledby="filter-distance"
                disabled
              />
              <div className="distance-labels">
                <span>1 mi</span>
                <span>Anywhere</span>
              </div>
            </div>
          </aside>

          <div className="results-list" data-name="Results Grid" data-node-id="6:128">
            <div className="search-type-tabs" role="tablist" aria-label="Search mode">
              <button
                role="tab"
                type="button"
                aria-selected={typeParam === "places"}
                className={`search-type-tab${typeParam === "places" ? " search-type-tab--active" : ""}`}
                onClick={() => switchType("places")}
              >
                Places
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={typeParam === "practitioners"}
                className={`search-type-tab${typeParam === "practitioners" ? " search-type-tab--active" : ""}`}
                onClick={() => switchType("practitioners")}
              >
                Surgeons &amp; Practitioners
              </button>
            </div>

            <div className="results-header">
              <h1 className="results-title">
                {typeParam === "practitioners" ? "Surgeons & Practitioners" : "Places"}
              </h1>
              <span className="results-count">
                {status === "loading" ? "…" : `${filteredProviders.length} found`}
              </span>
            </div>

            {status === "loading" ? (
              <p className="results-empty" role="status">
                Loading providers…
              </p>
            ) : filteredProviders.length === 0 ? (
              <p className="results-empty" role="status">
                No providers match your search and filters.
              </p>
            ) : (
              filteredProviders.map((p) => (
                <Link
                  key={p.slug}
                  to={`/provider/${p.slug}`}
                  className="result-card"
                  data-name="Result Card"
                >
                  <div className="result-card-inner">
                    <div className="result-thumb" aria-hidden />
                    <div className="result-body">
                      <div className="result-row-top">
                        <div>
                          <h2 className="result-name">{p.name}</h2>
                          <p className="result-meta">{p.metaLine}</p>
                        </div>
                      </div>
                      <p className="result-desc">{p.summary}</p>
                      <div className="result-footer">
                        <div className="result-tags">
                          {p.tags.map((tag) => (
                            <span key={tag} className="result-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="provider-actions">
                      <span className={sentimentBadgeClass(p.cardSentiment)}>{p.cardSentiment}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
