/**
 * Sidebar procedure filters for search — aligned with scripts/common/cosmeticFilters.mjs
 * inferCosmeticTags labels plus common cosmetic keywords used in listings.
 */
export const COSMETIC_PROCEDURE_FILTER_OPTIONS = [
  "BBL",
  "Blepharoplasty",
  "Body contouring",
  "Botox",
  "Breast augmentation",
  "Breast lift",
  "Breast reduction",
  "Brow lift",
  "Chin surgery",
  "Coolsculpting",
  "Dermal fillers",
  "Facelift",
  "Fat transfer",
  "Gynecomastia",
  "Lip lift",
  "Liposuction",
  "Medical spa",
  "Mommy makeover",
  "Neck lift",
  "Otoplasty",
  "Rhinoplasty",
  "Tummy tuck",
] as const satisfies readonly string[];

export type CosmeticProcedureFilter = (typeof COSMETIC_PROCEDURE_FILTER_OPTIONS)[number];
