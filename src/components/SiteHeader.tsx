import { Link } from "react-router-dom";
import "./SiteHeader.css";

export type SiteHeaderActiveNav = "search" | "compare";

export interface SiteHeaderProps {
  activeNav?: SiteHeaderActiveNav;
}

export default function SiteHeader({ activeNav }: SiteHeaderProps) {
  return (
    <header className="site-header" data-name="Navigation (Global)" data-node-id="23:602">
      <div className="site-header__inner">
        <Link to="/" className="site-header__logo">
          <span className="site-header__logo-script">The</span>
          <span className="site-header__logo-main">Botch List</span>
        </Link>
        <nav className="site-header__links" aria-label="Primary">
          <Link
            to="/search"
            className={
              activeNav === "search"
                ? "site-header__link site-header__link--search"
                : "site-header__link"
            }
          >
            Search
          </Link>
          <Link
            to="/compare"
            className={
              activeNav === "compare"
                ? "site-header__link site-header__link--compare"
                : "site-header__link"
            }
          >
            Compare
          </Link>
        </nav>
        <a href="#sign-in" className="site-header__signin">
          Sign In
        </a>
      </div>
    </header>
  );
}
