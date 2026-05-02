export type CompareRowKey =
  | "sentiment"
  | "snippets"
  | "topConcern"
  | "location";

export type CompareMetricTone = "strong" | "medium" | "default" | "muted" | "very-positive" | "positive" | "okay" | "negative" | "very-negative";

export interface CompareMetricCell {
  text: string;
  tone?: CompareMetricTone;
}

export interface CompareProvider {
  nodeId: string;
  name: string;
  role: string;
  bookingUrl: string;
  bookVariant: "primary" | "outline";
  values: Record<CompareRowKey, CompareMetricCell>;
}
