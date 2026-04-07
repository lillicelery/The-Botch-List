import type { SearchProvider } from "../types/provider";
import apifyProviders from "../data/apifyProviders.json";
import redditProviders from "../data/redditProviders.json";

/** Scraped Google Maps providers → run `npm run apify:map` after `npm run apify:maps`. */
const FROM_APIFY: SearchProvider[] = apifyProviders as SearchProvider[];
/** Optional second source: run `npm run reddit:map` to refresh this file. */
const FROM_REDDIT: SearchProvider[] = redditProviders as SearchProvider[];

/** Cosmetic / aesthetic providers only (see `scripts/prune-non-cosmetic-snippets.mjs`). */
export const ALL_SEARCH_PROVIDERS: SearchProvider[] = [...FROM_APIFY, ...FROM_REDDIT];

const bySlug = new Map(ALL_SEARCH_PROVIDERS.map((p) => [p.slug, p]));

export function getProviderBySlug(slug: string | undefined): SearchProvider | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}

export function getProviderDisplayName(slug: string | undefined): string {
  if (!slug) return "Provider";
  return bySlug.get(slug)?.name ?? titleFromSlug(slug);
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}


