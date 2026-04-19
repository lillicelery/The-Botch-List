/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Milliseconds between `/api/providers` refetches. `"0"` disables. If unset: 60s in dev, off in prod. */
  readonly VITE_PROVIDERS_POLL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
