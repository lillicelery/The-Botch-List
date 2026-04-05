import type { ResultSentiment, SearchProvider } from "../types/provider";

export interface SidebarFilterState {
  /** Checkbox `value`s from the filters panel (e.g. orthopedics). */
  specialties: string[];
  /** Selected card sentiments; empty means include all ratings. */
  ratings: ResultSentiment[];
}

/** Order for the search sidebar rating filter (best → worst). */
export const RATING_FILTER_OPTIONS: readonly ResultSentiment[] = [
  "Very Positive",
  "Positive",
  "Okay",
  "Negative",
  "Very Negative",
] as const;

function matchesLocation(provider: SearchProvider, loc: string): boolean {
  const t = loc.trim().toLowerCase();
  if (!t) return true;
  const blob = `${provider.locationLabel} ${provider.metaLine}`.toLowerCase();
  return blob.includes(t);
}

function matchesQuery(provider: SearchProvider, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const blob = [
    provider.name,
    provider.metaLine,
    provider.summary,
    ...provider.tags,
    ...provider.snippets.flatMap((s) => [...s.procedureTags, s.excerpt, s.sourceName]),
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(t);
}

function matchesRatings(provider: SearchProvider, selected: ResultSentiment[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(provider.cardSentiment);
}

function matchesSpecialties(provider: SearchProvider, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((s) => provider.specialties.includes(s));
}

export function filterSearchProviders(
  providers: readonly SearchProvider[],
  q: string,
  loc: string,
  filters: SidebarFilterState
): SearchProvider[] {
  return providers.filter(
    (p) =>
      matchesQuery(p, q) &&
      matchesLocation(p, loc) &&
      matchesSpecialties(p, filters.specialties) &&
      matchesRatings(p, filters.ratings)
  );
}
