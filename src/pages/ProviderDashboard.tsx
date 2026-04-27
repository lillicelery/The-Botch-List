import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { dashboardSourceFacebook, dashboardSourceReddit } from "../lib/figma-assets";
import { useProvidersData } from "../lib/ProvidersDataContext";
import { getProviderDisplayName } from "../lib/providersStatic";
import { getProviderType } from "../lib/providerType";
import type { PatientSnippet, SearchProvider, SnippetSentiment } from "../types/provider";
import "./ProviderDashboard.css";

const MOCK_DOCTORS = [
  { name: "Dr. Sarah Linton, MD", specialty: "Cosmetic Surgery" },
  { name: "Dr. Marcus Webb, DO", specialty: "Dermatology" },
  { name: "Dr. Priya Kaur, MD", specialty: "Plastic Surgery" },
];

function DoctorsAtLocation({ doctors }: { doctors: SearchProvider[] }) {
  const hasReal = doctors.length > 0;

  return (
    <section className="doctors-section" aria-labelledby="doctors-heading">
      <div className="doctors-header">
        <h2 className="doctors-title" id="doctors-heading">Doctors at this location</h2>
        {!hasReal && <span className="doctors-badge">Coming soon</span>}
      </div>
      {!hasReal && (
        <p className="doctors-lead">
          Individual practitioner profiles will be linked here once our doctor dataset is available.
        </p>
      )}
      <div className="doctors-grid">
        {hasReal
          ? doctors.map((doc) => (
              <Link key={doc.slug} to={`/provider/${doc.slug}`} className="doctor-card">
                <div className="doctor-avatar" aria-hidden />
                <div className="doctor-info">
                  <p className="doctor-name">{doc.name}</p>
                  <p className="doctor-specialty">{doc.metaLine}</p>
                </div>
              </Link>
            ))
          : MOCK_DOCTORS.map((doc) => (
              <div key={doc.name} className="doctor-card doctor-card--placeholder">
                <div className="doctor-avatar" aria-hidden />
                <div className="doctor-info">
                  <p className="doctor-name">{doc.name}</p>
                  <p className="doctor-specialty">{doc.specialty}</p>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}

function snippetSentimentClass(s: SnippetSentiment): string {
  if (s === "Positive") return "review-meta-positive";
  if (s === "Okay") return "review-meta-okay";
  return "review-meta-negative";
}

/** UI copy aligned with sentiment breakdown legend (data still uses Okay / Positive). */
function snippetSentimentLabel(s: SnippetSentiment): string {
  if (s === "Positive") return "Very good";
  if (s === "Okay") return "Good";
  return "Negative";
}

/** Counts for donut / legend: Negative, Okay → good bucket, Positive → very good bucket. */
function sentimentCountsFromSnippets(snippets: PatientSnippet[]): {
  negative: number;
  good: number;
  veryGood: number;
} {
  let negative = 0;
  let good = 0;
  let veryGood = 0;
  for (const s of snippets) {
    if (s.sentiment === "Negative") negative += 1;
    else if (s.sentiment === "Okay") good += 1;
    else veryGood += 1;
  }
  return { negative, good, veryGood };
}

/** Rounds three shares to whole percents that sum to 100 (matches slice proportions). */
function breakdownDisplayPercents(negative: number, good: number, veryGood: number): [number, number, number] {
  const total = negative + good + veryGood;
  if (total <= 0) return [0, 0, 0];
  const raw = [negative, good, veryGood].map((v) => (v / total) * 100);
  const floor = raw.map((x) => Math.floor(x));
  let remainder = 100 - floor.reduce((a, b) => a + b, 0);
  const byFrac = raw.map((x, i) => ({ i, frac: x - floor[i] })).sort((a, b) => b.frac - a.frac);
  const out: number[] = [...floor];
  for (let k = 0; k < remainder; k++) out[byFrac[k].i]++;
  return [out[0], out[1], out[2]];
}

function SentimentDonut({
  negative,
  good,
  veryGood,
}: {
  negative: number;
  good: number;
  veryGood: number;
}) {
  const total = negative + good + veryGood;
  const cx = 90;
  const cy = 90;
  const rMid = 58;
  const strokeWidth = 28;
  const circ = 2 * Math.PI * rMid;

  if (total <= 0) {
    return (
      <svg className="pie-visual pie-visual--svg" viewBox="0 0 180 180" aria-hidden>
        <circle cx={cx} cy={cy} r={rMid} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      </svg>
    );
  }

  const fracs = [negative / total, good / total, veryGood / total];
  const colors = ["#ef4444", "#f5f765", "#46d616"];
  let offsetPx = 0;

  return (
    <svg className="pie-visual pie-visual--svg" viewBox="0 0 180 180" aria-hidden>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {fracs.map((frac, i) => {
          const arcLen = frac * circ;
          const dash = `${arcLen} ${circ}`;
          const off = -offsetPx;
          offsetPx += arcLen;
          if (arcLen < 0.001) return null;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={rMid}
              fill="none"
              stroke={colors[i]}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={dash}
              strokeDashoffset={off}
            />
          );
        })}
      </g>
    </svg>
  );
}

function SourceLogo({ snippet }: { snippet: PatientSnippet }) {
  if (snippet.sourceLogo === "reddit") {
    return (
      <img
        className="review-source-icon"
        src={dashboardSourceReddit}
        alt=""
        width={56}
        height={20}
      />
    );
  }
  if (snippet.sourceLogo === "facebook") {
    return (
      <img
        className="review-source-icon review-source-icon--fb"
        src={dashboardSourceFacebook}
        alt=""
        width={43}
        height={23}
      />
    );
  }
  return (
    <span className="review-source-fallback" title={snippet.sourceName}>
      {snippet.sourceName}
    </span>
  );
}

export default function ProviderDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { bySlug, byWorkplace, status } = useProvidersData();
  const provider = useMemo(() => (slug ? bySlug.get(slug) : undefined), [bySlug, slug]);
  const displayName = provider?.name ?? getProviderDisplayName(slug);

  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [reviewTab, setReviewTab] = useState<"public" | "site">("public");

  useEffect(() => {
    setFilterTags(provider ? [...provider.defaultProcedureFilters] : []);
  }, [provider]);

  const visibleSnippets = useMemo(() => {
    if (!provider) return [];
    if (filterTags.length === 0) return provider.snippets;
    return provider.snippets.filter((s) => s.procedureTags.some((t) => filterTags.includes(t)));
  }, [provider, filterTags]);

  const listSentimentBreakdown = useMemo(
    () => sentimentCountsFromSnippets(visibleSnippets),
    [visibleSnippets],
  );
  const legendPercents = useMemo(
    () =>
      breakdownDisplayPercents(
        listSentimentBreakdown.negative,
        listSentimentBreakdown.good,
        listSentimentBreakdown.veryGood,
      ),
    [listSentimentBreakdown],
  );

  function removeFilter(tag: string) {
    setFilterTags((prev) => prev.filter((t) => t !== tag));
  }

  if (status === "loading") {
    return (
      <div className="provider-dashboard">
        <SiteHeader />
        <main className="provider-main">
          <p className="provider-not-found" role="status">
            Loading provider…
          </p>
        </main>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="provider-dashboard">
        <SiteHeader />
        <main className="provider-main">
          <p className="provider-not-found">
            We don&apos;t have a profile for <strong>{displayName}</strong> yet.{" "}
            <Link to="/search">Back to search</Link>
          </p>
        </main>
      </div>
    );
  }

  const providerType = getProviderType(provider);
  const { stats } = provider;
  const [pctNeg, pctGood, pctVeryGood] = legendPercents;
  const providerMapQuery = `${provider.name} ${provider.locationLabel}`;
  const providerMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(providerMapQuery)}&output=embed`;

  const pieLegendRows = [
    { key: "neg", pct: pctNeg, label: "Negative", swatch: "pie-swatch--negative" as const },
    { key: "good", pct: pctGood, label: "Good", swatch: "pie-swatch--good" as const },
    { key: "vg", pct: pctVeryGood, label: "Very good", swatch: "pie-swatch--very-good" as const },
  ].filter((row) => row.pct > 0);

  return (
    <div className="provider-dashboard" data-name="dashboard" data-node-id="10:32">
      <SiteHeader />

      <main className="provider-main">
        <header className="provider-hero">
          <h1 className="provider-name" data-node-id="10:191">
            {provider.name}
          </h1>
          <p className="provider-tagline" data-node-id="10:199">
            Aggregated snippets from public posts and reviews, with links to originals
          </p>
        </header>

        <section className="stats-grid" data-name="Stats Grid" data-node-id="10:201" aria-label="Key statistics">
          <article className="stat-card" data-node-id="10:202">
            <p className="stat-label" data-node-id="10:204">
              Snippets collected
            </p>
            <p className="stat-value" data-node-id="10:206">
              {stats.snippetsCollected}
            </p>
            <p className="stat-foot" data-node-id="10:211">
              {stats.monthOverMonthPct != null ? (
                <>
                  <strong data-node-id="10:209">
                    {stats.monthOverMonthPct >= 0 ? "↑" : "↓"} {Math.abs(stats.monthOverMonthPct)}%
                  </strong>
                  {" vs last month"}
                </>
              ) : (
                <span aria-hidden>&nbsp;</span>
              )}
            </p>
          </article>
          <article className="stat-card" data-node-id="10:212">
            <p className="stat-label" data-node-id="10:214">
              Overall tone
            </p>
            <p className="stat-value stat-value--text" data-node-id="10:216">
              {stats.avgSentimentLabel}
            </p>
            <p className="stat-foot" aria-hidden>
              &nbsp;
            </p>
          </article>
          <article className="stat-card" data-node-id="10:232">
            <p className="stat-label" data-node-id="10:234">
              Top concern
            </p>
            <p className="stat-value stat-value--text" data-node-id="10:236">
              {stats.topConcern}
            </p>
            <p className="stat-foot" aria-hidden>
              &nbsp;
            </p>
          </article>
        </section>

        <div className="charts-row">
          <div className="pie-card" data-name="Pie Chart" data-node-id="23:320">
            <h2 className="pie-card-title" data-node-id="I23:320;14:1388">
              Sentiment breakdown
            </h2>
            <p className="pie-card-subtitle">
              {visibleSnippets.length === 0
                ? "No excerpts match the current topic filters."
                : `Among the ${visibleSnippets.length} excerpt${visibleSnippets.length === 1 ? "" : "s"} listed in Patient experiences below.`}
            </p>
            <div className="pie-card-body">
              <div className="pie-visual-wrap" aria-hidden>
                <SentimentDonut
                  negative={listSentimentBreakdown.negative}
                  good={listSentimentBreakdown.good}
                  veryGood={listSentimentBreakdown.veryGood}
                />
              </div>
              <ul className="pie-legend">
                {pieLegendRows.map((row) => (
                  <li key={row.key}>
                    <span className={`pie-swatch ${row.swatch}`} />
                    {row.label} <span className="pie-legend-pct">({row.pct}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="map-panel" data-name="image 4" data-node-id="23:663">
            <iframe
              title={`Map for ${provider.name}`}
              src={providerMapEmbedUrl}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <section className="reviews-section" aria-labelledby="reviews-heading">
          <h2 className="reviews-title" id="reviews-heading" data-node-id="23:458">
            Patient experiences
          </h2>
          <p className="reviews-lead">
            Short excerpts from public discussions and review sites. Open the original to see full context and thread
            rules.
          </p>

          <div className="reviews-tab-group" role="tablist">
            <button
              role="tab"
              aria-selected={reviewTab === "public"}
              className={reviewTab === "public" ? "reviews-tab reviews-tab--active" : "reviews-tab"}
              onClick={() => setReviewTab("public")}
            >
              Public reviews
            </button>
            <button
              role="tab"
              aria-selected={reviewTab === "site"}
              className={reviewTab === "site" ? "reviews-tab reviews-tab--active" : "reviews-tab"}
              onClick={() => setReviewTab("site")}
            >
              Site reviews
            </button>
          </div>

          {reviewTab === "public" && (
            <>
              <div className="reviews-filters" data-node-id="30:95">
                <span className="reviews-filters-label" data-node-id="30:61">
                  Procedure / topic
                </span>
                {filterTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="filter-chip"
                    aria-label={`Remove ${tag} filter`}
                    onClick={() => removeFilter(tag)}
                  >
                    {tag}
                    <span className="filter-chip-x" aria-hidden>
                      ×
                    </span>
                  </button>
                ))}
                {filterTags.length === 0 ? (
                  <span className="reviews-filters-all">Showing all topics</span>
                ) : null}
              </div>

              {visibleSnippets.length === 0 ? (
                <p className="reviews-empty" role="status">
                  No snippets match the remaining topic filters. Remove a chip to see more.
                </p>
              ) : (
                visibleSnippets.map((snippet) => (
                  <article key={snippet.id} className="review-block">
                    <div className="review-head">
                      <div>
                        <h3 className="review-user">{snippet.authorLabel}</h3>
                        <p className="review-meta">
                          <span className={snippetSentimentClass(snippet.sentiment)}>{snippetSentimentLabel(snippet.sentiment)}</span>
                          <span>
                            {" "}
                            • {snippet.postedRelative} • {snippet.sourceName}
                          </span>
                        </p>
                      </div>
                      {!snippet.originalUrl.includes("maps/search") && (
                        <a
                          className="review-original-link"
                          href={snippet.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View original
                        </a>
                      )}
                    </div>
                    <p className="review-body">{snippet.excerpt}</p>
                    <div className="review-foot">
                      <div className="review-tags">
                        {snippet.procedureTags.map((t) => (
                          <span key={t} className="review-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </>
          )}

          {reviewTab === "site" && (
            <p className="reviews-empty">
              Site reviews coming soon.
            </p>
          )}
        </section>

        {providerType === "place" && (
          <DoctorsAtLocation doctors={byWorkplace.get(provider.slug) ?? []} />
        )}

        <p className="dashboard-disclaimer" data-node-id="23:510">
          This preview aggregates publicly available patient experiences for research convenience. It does not replace
          medical advice. Always verify details on the original source.
        </p>
      </main>
    </div>
  );
}

