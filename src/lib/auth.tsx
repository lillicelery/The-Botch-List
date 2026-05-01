import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthStatus = "loading" | "idle" | "authenticating" | "authenticated";

export type UserRole = "user" | "provider" | "admin";

export interface ProviderClaim {
  providerSlug: string;
  status: "pending_verification" | "verified" | "rejected";
  businessEmail: string;
}

export interface ProviderSubscription {
  providerSlug: string;
  plan: "verified";
  status: "incomplete" | "active" | "past_due" | "canceled" | "paused";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  userEmail: string | null;
  userRole: UserRole | null;
  claims: ProviderClaim[];
  subscriptions: ProviderSubscription[];
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, userRole?: UserRole) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
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
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [claims, setClaims] = useState<ProviderClaim[]>([]);
  const [subscriptions, setSubscriptions] = useState<ProviderSubscription[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        email: string;
        userRole: UserRole;
        claims: ProviderClaim[];
        subscriptions: ProviderSubscription[];
      };
      setUserRole(data.userRole);
      setClaims(data.claims ?? []);
      setSubscriptions(data.subscriptions ?? []);
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

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
          userRole?: UserRole;
          csrfToken?: string;
        };
        if (!active) return;
        if (payload.authenticated && payload.email) {
          setUserEmail(payload.email);
          setUserRole(payload.userRole ?? "user");
          setCsrfToken(payload.csrfToken ?? readCsrfTokenFromCookie());
          setStatus("authenticated");
          // Load full profile (claims + subscriptions) in background
          fetch("/api/auth/me", { credentials: "include" })
            .then((r) => r.json())
            .then((data: { claims?: ProviderClaim[]; subscriptions?: ProviderSubscription[] }) => {
              if (!active) return;
              setClaims(data.claims ?? []);
              setSubscriptions(data.subscriptions ?? []);
            })
            .catch(() => null);
          return;
        }
        setUserEmail(null);
        setUserRole(null);
        setClaims([]);
        setSubscriptions([]);
        setCsrfToken(null);
        setStatus("idle");
      } catch {
        if (!active) return;
        setUserEmail(null);
        setUserRole(null);
        setClaims([]);
        setSubscriptions([]);
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

  async function signUp(
    email: string,
    password: string,
    role?: UserRole
  ): Promise<{ ok: boolean; error?: string }> {
    setStatus("authenticating");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, userRole: role ?? "user" }),
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
    setUserRole(null);
    setClaims([]);
    setSubscriptions([]);
    setCsrfToken(null);
    setStatus("idle");
  }

  const value = useMemo(
    () => ({
      status,
      userEmail,
      userRole,
      claims,
      subscriptions,
      signIn,
      signUp,
      signOut,
      refreshMe,
    }),
    [status, userEmail, userRole, claims, subscriptions, refreshMe]
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
