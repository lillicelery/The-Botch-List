import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import "./Auth.css";

function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password);
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("This reset link is invalid.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must use at least 10 characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "Unable to reset password right now.");
        setStatus("idle");
        return;
      }
      setStatus("done");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reset password right now.");
      setStatus("idle");
    }
  }

  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main">
        <section className="auth-panel">
          <p className="auth-kicker">Account Recovery</p>
          <h1 className="auth-title">Choose a new password</h1>
          <p className="auth-subtitle">Set a strong new password for your account.</p>
          {!token ? (
            <>
              <p className="auth-error">This reset link is missing a token.</p>
              <div className="auth-actions">
                <Link to="/forgot-password" className="auth-btn auth-btn--primary">
                  Request New Link
                </Link>
              </div>
            </>
          ) : status === "done" ? (
            <>
              <p className="auth-success">Password reset complete. You can now sign in.</p>
              <div className="auth-actions">
                <Link to="/auth" className="auth-btn auth-btn--primary">
                  Go to Sign In
                </Link>
              </div>
            </>
          ) : (
            <form className="auth-form" onSubmit={onSubmit} noValidate>
              <label className="auth-label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="auth-input"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <label className="auth-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="auth-input"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="auth-btn auth-btn--primary" disabled={status === "submitting"}>
                {status === "submitting" ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
