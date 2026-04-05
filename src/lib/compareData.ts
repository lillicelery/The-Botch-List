import type { CompareProvider, CompareRowKey } from "../types/compare";

export const COMPARE_ROWS: ReadonlyArray<{ key: CompareRowKey; label: string }> = [
  { key: "sentiment", label: "Overall Sentiment" },
  { key: "experience", label: "Years Experience" },
  { key: "insurance", label: "Accepts Insurance" },
  { key: "telehealth", label: "Telehealth" },
];

export const COMPARE_PROVIDERS: CompareProvider[] = [
  {
    nodeId: "6:428",
    name: "Dr. Sarah Jenkins, DPT",
    role: "Orthopedic physical therapy",
    bookVariant: "primary",
    values: {
      sentiment: { text: "Mostly Positive", tone: "strong" },
      experience: { text: "12 Years", tone: "default" },
      insurance: { text: "Yes (Major)", tone: "default" },
      telehealth: { text: "Available", tone: "medium" },
    },
  },
  {
    nodeId: "6:453",
    name: "Dr. Michael Chen, MD",
    role: "Sports medicine",
    bookVariant: "outline",
    values: {
      sentiment: { text: "Okay", tone: "strong" },
      experience: { text: "8 Years", tone: "default" },
      insurance: { text: "Yes (All)", tone: "default" },
      telehealth: { text: "Not Available", tone: "muted" },
    },
  },
];
