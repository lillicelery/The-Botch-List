import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SearchProvider } from "../types/provider";
import { ALL_SEARCH_PROVIDERS } from "./providersStatic";

export type ProvidersDataSource = "sqlite" | "static";

function parsePollIntervalMs(): number {
  const raw = import.meta.env.VITE_PROVIDERS_POLL_MS?.trim();
  if (raw === "0") return 0;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return import.meta.env.DEV ? 60_000 : 0;
}

export type ProvidersDataContextValue = {
  providers: SearchProvider[];
  bySlug: Map<string, SearchProvider>;
  status: "loading" | "ready";
  dataSource: ProvidersDataSource;
  /** Re-runs the same load logic as mount / poll (e.g. after you re-import SQLite). */
  refetch: () => void;
};

const ProvidersDataContext = createContext<ProvidersDataContextValue | null>(null);

export function ProvidersDataProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [dataSource, setDataSource] = useState<ProvidersDataSource>("static");
  const [loadTick, setLoadTick] = useState(0);
  /** Once we have served rows from `/api/providers`, avoid falling back to static on transient errors. */
  const hadApiProviders = useRef(false);

  const refetch = useCallback(() => {
    setLoadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pollMs = parsePollIntervalMs();

    async function load() {
      try {
        const res = await fetch("/api/providers", { headers: { Accept: "application/json" } });
        if (cancelled) return;
        if (res.ok) {
          const body: unknown = await res.json();
          if (Array.isArray(body) && body.length > 0) {
            hadApiProviders.current = true;
            setProviders(body as SearchProvider[]);
            setDataSource("sqlite");
            setStatus("ready");
            return;
          }
        }
      } catch {
        /* network / offline */
      }
      if (cancelled) return;
      if (hadApiProviders.current) {
        return;
      }
      setProviders(ALL_SEARCH_PROVIDERS);
      setDataSource("static");
      setStatus("ready");
    }

    void load();

    const interval = pollMs > 0 ? setInterval(() => void load(), pollMs) : null;

    function onVisibility() {
      if (document.visibilityState === "visible" && !cancelled) void load();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadTick]);

  const bySlug = useMemo(() => new Map(providers.map((p) => [p.slug, p])), [providers]);

  const value = useMemo<ProvidersDataContextValue>(
    () => ({ providers, bySlug, status, dataSource, refetch }),
    [providers, bySlug, status, dataSource, refetch]
  );

  return <ProvidersDataContext.Provider value={value}>{children}</ProvidersDataContext.Provider>;
}

export function useProvidersData(): ProvidersDataContextValue {
  const ctx = useContext(ProvidersDataContext);
  if (!ctx) {
    throw new Error("useProvidersData must be used within ProvidersDataProvider");
  }
  return ctx;
}
