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
    name: "Dr. Elena Vance, MD",
    role: "Facial plastic & rhinoplasty",
    bookVariant: "primary",
    values: {
      sentiment: { text: "Mostly Positive", tone: "strong" },
      experience: { text: "14 Years", tone: "default" },
      insurance: { text: "Yes (Major)", tone: "default" },
      telehealth: { text: "Consults available", tone: "medium" },
    },
  },
  {
    nodeId: "6:453",
    name: "Harbor Aesthetics",
    role: "Medical spa • injectables & body contouring",
    bookVariant: "outline",
    values: {
      sentiment: { text: "Okay", tone: "strong" },
      experience: { text: "9 Years", tone: "default" },
      insurance: { text: "Limited", tone: "default" },
      telehealth: { text: "Not offered", tone: "muted" },
    },
  },
];
