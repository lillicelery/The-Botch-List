import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import SiteHeader from "../components/SiteHeader";
import { ALL_SEARCH_PROVIDERS } from "../lib/providersStatic";
import {
  filterSearchProviders,
  RATING_FILTER_OPTIONS,
  type SidebarFilterState,
} from "../lib/searchFilters";
import { resultsHeadline } from "../lib/searchHeadline";
import "./SearchResults.css";

function sentimentBadgeClass(sentiment: string): string {
  const base = "sentiment-badge";
  if (sentiment === "Very Positive" || sentiment === "Positive") return `${base} ${base}--positive`;
  if (sentiment === "Very Negative" || sentiment === "Negative") return `${base} ${base}--negative`;
  if (sentiment === "Okay") return `${base} ${base}--okay`;
  return base;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const locParam = searchParams.get("loc") ?? "";

  const [query, setQuery] = useState(qParam);
  const [location, setLocation] = useState(locParam);
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterState>({
    specialties: [],
    ratings: [],
  });

  useEffect(() => {
    setQuery(qParam);
    setLocation(locParam);
  }, [qParam, locParam]);

  const filteredProviders = useMemo(
    () => filterSearchProviders(ALL_SEARCH_PROVIDERS, qParam, locParam, sidebarFilters),
    [qParam, locParam, sidebarFilters]
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (location.trim()) next.set("loc", location.trim());
    setSearchParams(next);
  }

  function toggleSpecialty(value: string) {
    setSidebarFilters((prev) => {
      const set = new Set(prev.specialties);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, specialties: [...set] };
    });
  }

  function toggleRating(option: (typeof RATING_FILTER_OPTIONS)[number]) {
    setSidebarFilters((prev) => {
      const set = new Set(prev.ratings);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      return { ...prev, ratings: [...set] };
    });
  }

  function resetSidebarFilters() {
    setSidebarFilters({ specialties: [], ratings: [] });
  }

  return (
    <div className="search-results-page" data-name="search results" data-node-id="6:3">
      <SiteHeader activeNav="search" />

      <main className="search-results-main">
        <h1 className="results-page-title" data-node-id="6:124">
          {resultsHeadline(qParam, locParam)}
        </h1>

        <SearchBar
          query={query}
          location={location}
          onQueryChange={setQuery}
          onLocationChange={setLocation}
          onSubmit={onSearch}
          queryPlaceholder="Condition, procedure, or doctor name"
          dataNodeId="6:250"
        />

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

            <div className="filter-section" data-node-id="6:82">
              <p className="filter-label" id="filter-specialty">
                Specialty
              </p>
              <ul className="filter-options" role="group" aria-labelledby="filter-specialty">
                <li>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      name="specialty"
                      value="orthopedics"
                      checked={sidebarFilters.specialties.includes("orthopedics")}
                      onChange={() => toggleSpecialty("orthopedics")}
                    />
                    Orthopedics
                  </label>
                </li>
                <li>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      name="specialty"
                      value="sports"
                      checked={sidebarFilters.specialties.includes("sports")}
                      onChange={() => toggleSpecialty("sports")}
                    />
                    Sports Medicine
                  </label>
                </li>
                <li>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      name="specialty"
                      value="neurology"
                      checked={sidebarFilters.specialties.includes("neurology")}
                      onChange={() => toggleSpecialty("neurology")}
                    />
                    Neurology
                  </label>
                </li>
              </ul>
            </div>

            <div className="filter-section" data-node-id="6:98">
              <p className="filter-label" id="filter-rating">
                Review rating
              </p>
              <p className="filter-section-hint" id="filter-rating-hint">
                Select one or more; leave all unchecked to show every rating.
              </p>
              <ul
                className="filter-options"
                role="group"
                aria-labelledby="filter-rating"
                aria-describedby="filter-rating-hint"
              >
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
                defaultValue={50}
                aria-labelledby="filter-distance"
                disabled
                title="Distance filter is not available in the static preview"
              />
              <div className="distance-labels">
                <span>1 mi</span>
                <span>Anywhere</span>
              </div>
            </div>
          </aside>

          <div className="results-list" data-name="Results Grid" data-node-id="6:128">
            {filteredProviders.length === 0 ? (
              <p className="results-empty" role="status">
                No providers match your search and filters. Try different keywords, location, or reset filters.
              </p>
            ) : (
              filteredProviders.map((p) => (
                <article key={p.slug} className="result-card" data-name="Result Card">
                  <div className="result-card-inner">
                    <div className="result-thumb" aria-hidden />
                    <div className="result-body">
                      <div className="result-row-top">
                        <div>
                          <h2 className="result-name">{p.name}</h2>
                          <p className="result-meta">{p.metaLine}</p>
                        </div>
                        <span className={sentimentBadgeClass(p.cardSentiment)}>{p.cardSentiment}</span>
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
                        <Link to={`/provider/${p.slug}`} className="result-view">
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
