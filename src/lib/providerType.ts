import type { SearchProvider } from "../types/provider";

export type ProviderType = "place" | "practitioner";

const PLACE_TAGS = new Set([
  "medical spa",
  "medspa",
  "spa",
  "beauty salon",
  "day spa",
  "clinic",
  "health clinic",
  "cosmetic surgery clinic",
  "plastic surgery clinic",
  "skin care clinic",
  "surgical center",
  "medical center",
  "nail salon",
  "laser hair removal service",
  "aesthetics",
  "aesthetic medicine",
  "beauty school",
  "hair salon",
  "wellness center",
  "health and wellness centre",
  "facial spa",
  "health and beauty shop",
  "weight loss service",
  "iv therapy service",
]);

const PRACTITIONER_TAGS = new Set([
  "cosmetic surgeon",
  "dermatologist",
  "plastic surgeon",
  "surgeon",
  "physician",
  "doctor",
  "nurse",
  "aesthetician",
  "nurse practitioner",
  "general practitioner",
  "skin care specialist",
  "medical doctor",
]);

export function getProviderType(provider: SearchProvider): ProviderType {
  const lowTags = provider.tags.map((t) => t.toLowerCase().trim());
  for (const t of lowTags) {
    if (PLACE_TAGS.has(t)) return "place";
  }
  for (const t of lowTags) {
    if (PRACTITIONER_TAGS.has(t)) return "practitioner";
  }
  return "place";
}
