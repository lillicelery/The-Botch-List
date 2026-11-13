import type { SearchProvider } from "../types/provider";
import { isInServiceArea } from "./serviceArea";
import apifyProviders from "../data/apifyProviders.json";
import redditProviders from "../data/redditProviders.json";
import yelpProviders from "../data/yelpProviders.json";

/** Scraped Google Maps providers → run `npm run apify:map` after `npm run apify:maps`. */
const FROM_APIFY: SearchProvider[] = apifyProviders as SearchProvider[];
/** Yelp Fusion API providers → run `npm run yelp:fetch && npm run yelp:map`. */
const FROM_YELP: SearchProvider[] = yelpProviders as SearchProvider[];
/** Optional Reddit source: run `npm run reddit:fetch && npm run reddit:map` to refresh. */
const FROM_REDDIT: SearchProvider[] = redditProviders as SearchProvider[];

function dedupeByName(providers: SearchProvider[]): SearchProvider[] {
  const seen = new Map<string, SearchProvider>();
  for (const p of providers) {
    const key = `${(p.name ?? "").toLowerCase().trim()}|${(p.locationLabel ?? "").toLowerCase().split(",")[0].trim()}`;
    const existing = seen.get(key);
    if (!existing || (p.snippets?.length ?? 0) > (existing.snippets?.length ?? 0)) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

/** Cosmetic / aesthetic providers in the service area, deduplicated across sources. */
export const ALL_SEARCH_PROVIDERS: SearchProvider[] = dedupeByName([...FROM_APIFY, ...FROM_YELP, ...FROM_REDDIT]).filter(
  (p) => isInServiceArea(p.locationLabel)
);

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


