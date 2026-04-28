import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { COMPARE_ROWS, toCompareProvider } from "../lib/compareData";
import { compareMetricClass } from "../lib/compareMetricClass";
import { useProvidersData } from "../lib/ProvidersDataContext";
import { useCompareSelection } from "../lib/useCompareSelection";
import "./Compare.css";

function isFeaturedColumn(index: number): boolean {
  return index === 0;
}

export default function Compare() {
  const navigate = useNavigate();
  const { bySlug, providers, status } = useProvidersData();
  const { slugs: selectedSlugs, toggle, atMax } = useCompareSelection();
  const [providerSearch, setProviderSearch] = useState("");

  const dynamicProviders = selectedSlugs
    .map((slug, i) => {
      const provider = bySlug.get(slug);
      if (!provider) return null;
      return toCompareProvider(provider, i);
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  const compareProviders = dynamicProviders;
  const addableProviders = useMemo(
    () => providers.filter((p) => !selectedSlugs.includes(p.slug)),
    [providers, selectedSlugs],
  );
  const filteredAddableProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    if (!q) return addableProviders.slice(0, 8);
    return addableProviders
      .filter((p) => p.name.toLowerCase().includes(q) || p.locationLabel.toLowerCase().includes(q))
      .slice(0, 8);
  }, [addableProviders, providerSearch]);

  function addProvider(slug: string) {
    if (!slug || selectedSlugs.includes(slug) || atMax) return;
    toggle(slug);
    setProviderSearch("");
  }

  function removeProvider(slug: string) {
    toggle(slug);
  }

  return (
    <div className="compare-page" data-name="compare providers" data-node-id="6:369">
      <SiteHeader activeNav="compare" />

      <main className="compare-main" data-node-id="6:410">
        <div className="compare-intro">
          <h1 className="compare-title" data-node-id="6:413">
            Compare providers
          </h1>
          <p className="compare-subtitle" data-node-id="6:415">
            Build your comparison here by adding providers.
          </p>
        </div>
        <div className="compare-controls">
          <label htmlFor="compare-provider-search" className="compare-controls-label">
            Add provider
          </label>
          <input
            id="compare-provider-search"
            type="search"
            className="compare-search"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            placeholder="Search provider by name or location"
            disabled={status !== "ready" || addableProviders.length === 0 || atMax}
          />
          {status === "ready" &&
          providerSearch.trim().length > 0 &&
          addableProviders.length > 0 &&
          !atMax ? (
            <div className="compare-search-results" role="listbox" aria-label="Matching providers">
              {filteredAddableProviders.map((provider) => (
                <button
                  key={provider.slug}
                  type="button"
                  className="compare-search-result"
                  onClick={() => addProvider(provider.slug)}
                >
                  {provider.name}
                  <span>{provider.locationLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          {atMax ? <span className="compare-controls-note">Max 3 providers</span> : null}
        </div>
        {status === "ready" && compareProviders.length === 0 ? (
          <div className="compare-empty-state" role="status">
            No providers selected. Select providers to see comparison data.
          </div>
        ) : null}

        {compareProviders.length > 0 ? (
          <div className="compare-grid" data-node-id="6:416" role="table" aria-label="Provider comparison">
            <div
              className="compare-labels"
              data-name="Comparison Labels Column (Hidden on mobile, visible on md+)"
              data-node-id="6:417"
            >
              {COMPARE_ROWS.map((row, i) => (
                <div
                  key={row.key}
                  className="compare-label-row"
                  data-node-id={["6:418", "6:420", "6:422", "6:426"][i]}
                >
                  <span>{row.label}</span>
                </div>
              ))}
            </div>

            <div className="compare-cards-wrap">
              {compareProviders.map((p, index) => (
                <article
                  key={p.nodeId}
                  className={isFeaturedColumn(index) ? "compare-card compare-card--featured" : "compare-card"}
                  data-name={index === 0 ? "Provider 1 Card" : "Provider 2 Card"}
                  data-node-id={p.nodeId}
                  title="View provider reviews"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(p.bookingUrl)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(p.bookingUrl);
                    }
                  }}
                >
                  <div className="compare-card-header" data-node-id={index === 0 ? "6:429" : "6:454"}>
                    {p.nodeId.startsWith("dynamic-") ? (
                      <button
                        type="button"
                        className="compare-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProvider(p.nodeId.replace("dynamic-", ""));
                        }}
                        aria-label={`Remove ${p.name} from comparison`}
                      >
                        Remove
                      </button>
                    ) : null}
                    <div className="compare-avatar" aria-hidden data-node-id={index === 0 ? "6:430" : "6:455"} />
                    <h2 className="compare-card-name" data-node-id={index === 0 ? "6:432" : "6:457"}>
                      {p.name}
                    </h2>
                    <p className="compare-card-role" data-node-id={index === 0 ? "6:434" : "6:459"}>
                      {p.role}
                    </p>
                  <span className="compare-card-cue" aria-hidden>
                    View →
                  </span>
                  </div>

                  <div className="compare-card-body" data-node-id={index === 0 ? "6:437" : "6:462"}>
                    {COMPARE_ROWS.map((row, i) => {
                      const v = p.values[row.key];
                      return (
                        <div
                          key={row.key}
                          className="compare-metric"
                          data-node-id={
                            index === 0
                              ? ["6:438", "6:441", "6:444", "6:450"][i]
                              : ["6:463", "6:466", "6:469", "6:475"][i]
                          }
                        >
                          <span className="compare-metric-label">{row.label}</span>
                          <p className={compareMetricClass(v.tone)}>{v.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
