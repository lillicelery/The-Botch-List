import type { CompareProvider, CompareRowKey } from "../types/compare";
import type { SearchProvider } from "../types/provider";

export const COMPARE_ROWS: ReadonlyArray<{ key: CompareRowKey; label: string }> = [
  { key: "sentiment", label: "Overall Sentiment" },
  { key: "snippets", label: "Snippets Collected" },
  { key: "topConcern", label: "Top Concern" },
  { key: "location", label: "Location" },
];

export const COMPARE_PROVIDERS: CompareProvider[] = [
  {
    nodeId: "6:428",
    name: "Dr. Elena Vance, MD",
    role: "Facial plastic & rhinoplasty",
    bookingUrl: "/search",
    bookVariant: "primary",
    values: {
      sentiment: { text: "Mostly Positive", tone: "strong" },
      snippets: { text: "124", tone: "default" },
      topConcern: { text: "Scar visibility", tone: "default" },
      location: { text: "Seattle, WA", tone: "medium" },
    },
  },
  {
    nodeId: "6:453",
    name: "Harbor Aesthetics",
    role: "Medical spa • injectables & body contouring",
    bookingUrl: "/search",
    bookVariant: "outline",
    values: {
      sentiment: { text: "Okay", tone: "strong" },
      snippets: { text: "87", tone: "default" },
      topConcern: { text: "Pricing clarity", tone: "default" },
      location: { text: "Bellevue, WA", tone: "muted" },
    },
  },
];

function sentimentTone(sentiment: SearchProvider["cardSentiment"]): "very-positive" | "positive" | "okay" | "negative" | "very-negative" {
  if (sentiment === "Very Positive") return "very-positive";
  if (sentiment === "Positive") return "positive";
  if (sentiment === "Negative") return "negative";
  if (sentiment === "Very Negative") return "very-negative";
  return "okay";
}

export function toCompareProvider(provider: SearchProvider, index: number): CompareProvider {
  const bookingUrl = `/provider/${provider.slug}`;

  return {
    nodeId: `dynamic-${provider.slug}`,
    name: provider.name,
    role: provider.metaLine,
    bookingUrl,
    bookVariant: index === 0 ? "primary" : "outline",
    values: {
      sentiment: { text: provider.cardSentiment ?? "No reviews yet", tone: sentimentTone(provider.cardSentiment) },
      snippets: { text: String(provider.stats.snippetsCollected), tone: "default" },
      topConcern: { text: provider.stats.topConcern, tone: "default" },
      location: { text: provider.locationLabel, tone: "medium" },
    },
  };
}
