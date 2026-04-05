import type { CompareMetricTone } from "../types/compare";

export function compareMetricClass(tone?: CompareMetricTone): string {
  switch (tone) {
    case "strong":
      return "compare-metric-value compare-metric-value--strong";
    case "medium":
      return "compare-metric-value compare-metric-value--medium";
    case "muted":
      return "compare-metric-value compare-metric-value--muted";
    default:
      return "compare-metric-value";
  }
}
