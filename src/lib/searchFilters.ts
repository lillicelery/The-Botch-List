import type { ResultSentiment, SearchProvider } from "../types/provider";

export interface SidebarFilterState {
  /** Selected cosmetic procedure filter labels (see `COSMETIC_PROCEDURE_FILTER_OPTIONS`). */
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

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

function matchesLocation(provider: SearchProvider, loc: string): boolean {
  const t = loc.trim().toLowerCase();
  if (!t) return true;
  const blob = `${provider.locationLabel} ${provider.metaLine}`.toLowerCase();
  if (blob.includes(t)) return true;
  const abbr = STATE_NAME_TO_ABBR[t];
  return abbr !== undefined && blob.includes(abbr.toLowerCase());
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

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/** Procedure/topic filters: match tags, snippet procedure tags, defaults, specialties, and listing text. */
function matchesProcedureFilters(provider: SearchProvider, selected: string[]): boolean {
  if (selected.length === 0) return true;

  const tagLike = new Set(
    [
      ...provider.tags,
      ...provider.defaultProcedureFilters,
      ...provider.specialties,
      ...provider.snippets.flatMap((s) => s.procedureTags),
    ].map(norm)
  );

  const textBlob = norm(
    [provider.name, provider.metaLine, provider.summary, ...provider.tags].join(" ")
  );

  return selected.some((sel) => {
    const n = norm(sel);
    if (!n) return false;
    for (const t of tagLike) {
      if (!t) continue;
      if (t === n || t.includes(n) || n.includes(t)) return true;
    }
    if (textBlob.includes(n)) return true;
    return false;
  });
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
      matchesProcedureFilters(p, filters.specialties) &&
      matchesRatings(p, filters.ratings)
  );
}
