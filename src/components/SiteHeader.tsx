import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "./SiteHeader.css";

export type SiteHeaderActiveNav = "search" | "compare";

export interface SiteHeaderProps {
  activeNav?: SiteHeaderActiveNav;
}

export default function SiteHeader({ activeNav }: SiteHeaderProps) {
  const { status, userRole, claims, signOut } = useAuth();
  const verifiedClaim = claims.find((c) => c.status === "verified");

  return (
    <header className="site-header" data-name="Navigation (Global)" data-node-id="23:602">
      <div className="site-header__inner">
        <Link to="/" className="site-header__logo">
          <span className="site-header__logo-script">The</span>
          <span className="site-header__logo-main">Botch List</span>
        </Link>
        <div className="site-header__right">
          <nav className="site-header__links" aria-label="Primary">
            <Link
              to="/search"
              className={activeNav === "search" ? "site-header__link site-header__link--active" : "site-header__link"}
            >
              Search
            </Link>
            <Link
              to="/compare"
              className={activeNav === "compare" ? "site-header__link site-header__link--active" : "site-header__link"}
            >
              Compare
            </Link>
          </nav>
          {status === "authenticated" ? (
            <>
              {userRole === "provider" && verifiedClaim && (
                <Link to={`/provider-portal/${verifiedClaim.providerSlug}`} className="site-header__link">
                  My Portal
                </Link>
              )}
              {userRole === "user" && (
                <Link to="/saved" className="site-header__link">
                  Saved
                </Link>
              )}
              <button type="button" className="site-header__signin site-header__signout-btn" onClick={signOut}>
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/auth" className="site-header__signin">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
