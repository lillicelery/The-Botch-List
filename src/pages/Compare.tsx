import SiteHeader from "../components/SiteHeader";
import { COMPARE_PROVIDERS, COMPARE_ROWS } from "../lib/compareData";
import { compareMetricClass } from "../lib/compareMetricClass";
import "./Compare.css";

function isFeaturedColumn(index: number): boolean {
  return index === 0;
}

export default function Compare() {
  return (
    <div className="compare-page" data-name="compare providers" data-node-id="6:369">
      <SiteHeader activeNav="compare" />

      <main className="compare-main" data-node-id="6:410">
        <div className="compare-intro">
          <h1 className="compare-title" data-node-id="6:413">
            Compare providers
          </h1>
          <p className="compare-subtitle" data-node-id="6:415">
            Side-by-side comparison of your selected specialists
          </p>
        </div>

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
            {COMPARE_PROVIDERS.map((p, index) => (
              <article
                key={p.nodeId}
                className={isFeaturedColumn(index) ? "compare-card compare-card--featured" : "compare-card"}
                data-name={index === 0 ? "Provider 1 Card" : "Provider 2 Card"}
                data-node-id={p.nodeId}
              >
                <div className="compare-card-header" data-node-id={index === 0 ? "6:429" : "6:454"}>
                  <div className="compare-avatar" aria-hidden data-node-id={index === 0 ? "6:430" : "6:455"} />
                  <h2 className="compare-card-name" data-node-id={index === 0 ? "6:432" : "6:457"}>
                    {p.name}
                  </h2>
                  <p className="compare-card-role" data-node-id={index === 0 ? "6:434" : "6:459"}>
                    {p.role}
                  </p>
                  <button
                    type="button"
                    className={
                      p.bookVariant === "primary"
                        ? "compare-book compare-book--primary"
                        : "compare-book compare-book--outline"
                    }
                    data-node-id={index === 0 ? "6:435" : "6:460"}
                  >
                    Book Now
                  </button>
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

            <button type="button" className="compare-add" aria-label="Add a provider">
              <span className="compare-add-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="compare-add-label">Add a provider</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
