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

/** Public-record data from the CMS NPI Registry. Set by scripts/npi/import-nyc.mjs. */
export interface NpiRecord {
  number: string;
  credential: string | null;
  /** Registry taxonomy descriptions, e.g. "Plastic Surgery". */
  specialties: string[];
  /** New York State medical license number, if the registry lists one. */
  nyLicense: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; zip: string };
  phone: string | null;
  /** When the clinician last updated their registry entry (YYYY-MM-DD). */
  lastUpdated: string | null;
  /** When we fetched it (ISO timestamp). */
  fetchedAt: string;
}

export interface SearchProvider {
  slug: string;
  name: string;
  /** e.g. "Cosmetic surgeon • Bellevue, WA" */
  metaLine: string;
  summary: string;
  /** Null when no reviews have been collected yet. */
  cardSentiment: ResultSentiment | null;
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
  /** AI-generated prose summary of patient reviews. Set by scripts/ai/generate-summaries.mjs. */
  aiSummary?: string;
  /** Public-record data, when the provider was matched in the NPI Registry. */
  npi?: NpiRecord;
}
