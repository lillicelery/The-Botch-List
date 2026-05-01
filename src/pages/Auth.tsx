import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth, type UserRole } from "../lib/auth";
import "./Auth.css";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  // Minimum: 10 chars, one lowercase, one uppercase, one number.
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password);
}

export default function Auth() {
  const { status, userEmail, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupRole, setSignupRole] = useState<UserRole>("user");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signup" && !isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode === "signup" && !isStrongPassword(password)) {
      setError("Password must use at least 10 characters with uppercase, lowercase, and a number.");
      return;
    }

    setError(null);
    const result =
      mode === "signin"
        ? await signIn(normalizedEmail, password)
        : await signUp(normalizedEmail, password, signupRole);
    if (!result.ok) {
      setError(result.error ?? "Sign-in failed. Check your credentials and try again.");
      return;
    }

    if (mode === "signup") {
      setError("Account created. You can now sign in.");
      setMode("signin");
      return;
    }

    setPassword("");
  }

  if (status === "authenticated" && !userEmail) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main">
        <section className="auth-panel" aria-live="polite">
          {status === "loading" ? (
            <>
              <p className="auth-kicker">Security Check</p>
              <h1 className="auth-title">Checking your session...</h1>
              <p className="auth-subtitle">Please wait while we validate your secure session.</p>
            </>
          ) : status === "authenticated" ? (
            <>
              <p className="auth-kicker">Signed In</p>
              <h1 className="auth-title">You are securely signed in.</h1>
              <p className="auth-subtitle">
                Session active for <strong>{userEmail}</strong>.
              </p>
              <div className="auth-actions">
                <button type="button" className="auth-btn auth-btn--primary" onClick={signOut}>
                  Sign Out
                </button>
                <Link to="/search" className="auth-btn auth-btn--ghost">
                  Continue to Search
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signin"}
                  className={`auth-mode-btn${mode === "signin" ? " auth-mode-btn--active" : ""}`}
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={`auth-mode-btn${mode === "signup" ? " auth-mode-btn--active" : ""}`}
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  Create Account
                </button>
              </div>

              <p className="auth-kicker">{mode === "signin" ? "Welcome Back" : "New Here?"}</p>
              <h1 className="auth-title">
                {mode === "signin" ? "Sign in to your account" : "Create your account"}
              </h1>
              <p className="auth-subtitle">
                {mode === "signin"
                  ? "Keep access to saved providers and comparison workflows."
                  : "Register with your email and secure password to start using Botch List."}
              </p>

              {mode === "signup" && (
                <div className="auth-role-section">
                  <p className="auth-role-label">Account type</p>
                  <div className="auth-mode-switch auth-role-switch" role="group" aria-label="Account type">
                    <button
                      type="button"
                      className={`auth-mode-btn${signupRole === "user" ? " auth-mode-btn--active" : ""}`}
                      onClick={() => setSignupRole("user")}
                    >
                      Regular User
                    </button>
                    <button
                      type="button"
                      className={`auth-mode-btn${signupRole === "provider" ? " auth-mode-btn--active" : ""}`}
                      onClick={() => setSignupRole("provider")}
                    >
                      Provider / Business
                    </button>
                  </div>
                  {signupRole === "provider" && (
                    <p className="auth-role-hint">
                      Provider accounts can claim and manage business listings.
                    </p>
                  )}
                </div>
              )}
              <form className="auth-form" onSubmit={onSubmit} noValidate>
                <label className="auth-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="auth-input"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <label className="auth-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="auth-input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                {mode === "signin" ? (
                  <Link to="/forgot-password" className="auth-inline-link">
                    Forgot password?
                  </Link>
                ) : null}

                {error ? (
                  <p
                    className={
                      error.toLowerCase().startsWith("account created") ? "auth-success" : "auth-error"
                    }
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="auth-btn auth-btn--primary"
                  disabled={status === "authenticating"}
                >
                  {status === "authenticating"
                    ? mode === "signin"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "signin"
                      ? "Sign In"
                      : "Create Account"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
