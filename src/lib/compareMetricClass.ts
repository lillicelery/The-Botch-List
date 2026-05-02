import type { CompareMetricTone } from "../types/compare";

export function compareMetricClass(tone?: CompareMetricTone): string {
  switch (tone) {
    case "strong":
      return "compare-metric-value compare-metric-value--strong";
    case "medium":
      return "compare-metric-value compare-metric-value--medium";
    case "muted":
      return "compare-metric-value compare-metric-value--muted";
    case "very-positive":
      return "compare-metric-value compare-metric-value--very-positive";
    case "positive":
      return "compare-metric-value compare-metric-value--positive";
    case "okay":
      return "compare-metric-value compare-metric-value--okay";
    case "negative":
      return "compare-metric-value compare-metric-value--negative";
    case "very-negative":
      return "compare-metric-value compare-metric-value--very-negative";
    default:
      return "compare-metric-value";
  }
}
