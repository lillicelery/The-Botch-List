/** Card / list sentiment (matches filter labels and badges). */
export type ResultSentiment =
  | "Very Positive"
  | "Positive"
  | "Okay"
  | "Negative"
  | "Very Negative";

/** Per-snippet tone (subset used in UI). */
export type SnippetSentiment = "Positive" | "Okay" | "Negative";

export type SourceLogo = "reddit" | "facebook" | "google";

export interface PatientSnippet {
  id: string;
  authorLabel: string;
  postedRelative: string;
  sentiment: SnippetSentiment;
  excerpt: string;
  procedureTags: string[];
  sourceName: string;
  sourceLogo?: SourceLogo;
  /** Public URL where the experience was published (demo placeholders). */
  originalUrl: string;
}

export interface ProviderStats {
  snippetsCollected: number;
  avgSentimentLabel: string;
  topConcern: string;
  monthOverMonthPct?: number;
}

export interface SentimentBreakdownPct {
  negative: number;
  good: number;
  veryGood: number;
}

export interface SearchProvider {
  slug: string;
  name: string;
  /** e.g. "Cosmetic surgeon • Bellevue, WA" */
  metaLine: string;
  summary: string;
  cardSentiment: ResultSentiment;
  tags: string[];
  /** Matches sidebar specialty checkbox `value` when applicable. */
  specialties: string[];
  /** City / region text for `loc` matching (e.g. "Seattle, WA"). */
  locationLabel: string;
  stats: ProviderStats;
  sentimentBreakdown: SentimentBreakdownPct;
  defaultProcedureFilters: string[];
  snippets: PatientSnippet[];
  /** Slug of the place this practitioner works at, if known. */
  workplaceSlug?: string;
  /** Explicit type set in the database — takes priority over tag inference. */
  providerType?: "place" | "practitioner";
}
