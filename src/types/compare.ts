export type CompareRowKey =
  | "sentiment"
  | "experience"
  | "insurance"
  | "telehealth";

export type CompareMetricTone = "strong" | "medium" | "default" | "muted";

export interface CompareMetricCell {
  text: string;
  tone?: CompareMetricTone;
}

export interface CompareProvider {
  nodeId: string;
  name: string;
  role: string;
  bookVariant: "primary" | "outline";
  values: Record<CompareRowKey, CompareMetricCell>;
}
