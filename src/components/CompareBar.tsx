import { useNavigate } from "react-router-dom";
import { useCompareSelection } from "../lib/useCompareSelection";
import { useProvidersData } from "../lib/ProvidersDataContext";
import "./CompareBar.css";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CompareBar() {
  const { slugs, count, clear } = useCompareSelection();
  const { bySlug } = useProvidersData();
  const navigate = useNavigate();

  if (count === 0) return null;

  return (
    <div className="compare-bar" role="region" aria-label="Compare selection">
      <div className="compare-bar__chips">
        {slugs.map((slug) => {
          const provider = bySlug.get(slug);
          const name = provider?.name ?? slug;
          return (
            <div key={slug} className="compare-bar__chip">
              <span className="compare-bar__chip-avatar" aria-hidden>
                {getInitials(name)}
              </span>
              <span className="compare-bar__chip-name">{name}</span>
            </div>
          );
        })}
      </div>
      <div className="compare-bar__actions">
        <button type="button" className="compare-bar__clear" onClick={clear}>
          Clear
        </button>
        <button
          type="button"
          className="compare-bar__go"
          onClick={() => navigate("/compare")}
        >
          Compare ({count})
        </button>
      </div>
    </div>
  );
}
