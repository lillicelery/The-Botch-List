import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import "./Auth.css";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "Unable to send reset email right now.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("Unable to send reset email right now.");
      setStatus("idle");
    }
  }

  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main">
        <section className="auth-panel">
          <p className="auth-kicker">Account Recovery</p>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter your account email and we will send a secure reset link.
          </p>

          {status === "done" ? (
            <>
              <p className="auth-success">
                If an account exists for that email, a password reset link has been sent.
              </p>
              <div className="auth-actions">
                <Link to="/auth" className="auth-btn auth-btn--primary">
                  Back to Sign In
                </Link>
              </div>
            </>
          ) : (
            <form className="auth-form" onSubmit={onSubmit} noValidate>
              <label className="auth-label" htmlFor="reset-email">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                className="auth-input"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="auth-btn auth-btn--primary" disabled={status === "submitting"}>
                {status === "submitting" ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
