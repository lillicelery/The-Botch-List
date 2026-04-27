import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthStatus = "loading" | "idle" | "authenticating" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCsrfTokenFromCookie(): string | null {
  const csrfPair = document.cookie
    .split("; ")
    .find((part) => part.startsWith("botch_csrf="));
  if (!csrfPair) return null;
  const value = csrfPair.slice("botch_csrf=".length);
  return value ? decodeURIComponent(value) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Session check failed");
        const payload = (await response.json()) as {
          authenticated: boolean;
          email?: string;
          csrfToken?: string;
        };
        if (!active) return;
        if (payload.authenticated && payload.email) {
          setUserEmail(payload.email);
          setCsrfToken(payload.csrfToken ?? readCsrfTokenFromCookie());
          setStatus("authenticated");
          return;
        }
        setUserEmail(null);
        setCsrfToken(null);
        setStatus("idle");
      } catch {
        if (!active) return;
        setUserEmail(null);
        setCsrfToken(null);
        setStatus("idle");
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    setStatus("authenticating");
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setStatus("idle");
        return { ok: false, error: "Sign-in failed. Check your credentials and try again." };
      }
      const payload = (await response.json()) as { email: string; csrfToken?: string };
      setUserEmail(payload.email);
      setCsrfToken(payload.csrfToken ?? readCsrfTokenFromCookie());
      setStatus("authenticated");
      return { ok: true };
    } catch {
      setStatus("idle");
      return { ok: false, error: "Sign-in failed due to a network issue." };
    }
  }

  async function signUp(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    setStatus("authenticating");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus("idle");
        return { ok: false, error: payload?.error || "Unable to create account right now." };
      }
      setStatus("idle");
      return { ok: true };
    } catch {
      setStatus("idle");
      return { ok: false, error: "Sign-up failed due to a network issue." };
    }
  }

  async function signOut() {
    const headerToken = csrfToken ?? readCsrfTokenFromCookie();
    const headers: Record<string, string> = {};
    if (headerToken) headers["X-CSRF-Token"] = headerToken;
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
      headers,
    }).catch(() => null);
    setUserEmail(null);
    setCsrfToken(null);
    setStatus("idle");
  }

  const value = useMemo(
    () => ({
      status,
      userEmail,
      signIn,
      signUp,
      signOut,
    }),
    [status, userEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
