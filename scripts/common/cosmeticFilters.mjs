export const COSMETIC_KEYWORDS = [
  "plastic surgeon",
  "cosmetic surgeon",
  "facial plastic",
  "aesthetic clinic",
  "rhinoplasty",
  "nose job",
  "blepharoplasty",
  "eyelid surgery",
  "facelift",
  "neck lift",
  "otoplasty",
  "chin implant",
  "genioplasty",
  "lip lift",
  "brow lift",
  "liposuction",
  "lipo",
  "tummy tuck",
  "abdominoplasty",
  "mommy makeover",
  "bbl",
  "brazilian butt lift",
  "breast augmentation",
  "breast implant",
  "breast lift",
  "mastopexy",
  "breast reduction",
  "gynecomastia",
  "fat transfer",
  "body contouring",
  "coolsculpting",
  "dermal filler",
  "botox",
  "injectable",
  "med spa",
  "cosmetic dermatology"
];

const NON_COSMETIC_KEYWORDS = [
  "physical therapist",
  "physical therapy",
  "sports medicine",
  "sports injury",
  "orthopedic clinic",
  "orthopedics",
  "rehabilitation center",
  "chiropractic",
  "neurology",
  "urgent care",
  "primary care",
  "dentist",
  "pediatric"
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

export function isCosmeticProviderText(text) {
  const cosmetic = containsAny(text, COSMETIC_KEYWORDS);
  const nonCosmetic = containsAny(text, NON_COSMETIC_KEYWORDS);
  return cosmetic && !nonCosmetic;
}

export function isCosmeticProviderRow({ title, categoryName, categories = [] }) {
  const blob = [title, categoryName, ...(Array.isArray(categories) ? categories : [])].join(" ");
  return isCosmeticProviderText(blob);
}

export function isCosmeticSnippetText(text) {
  return containsAny(text, COSMETIC_KEYWORDS);
}

export function inferCosmeticTags(text) {
  const t = String(text || "").toLowerCase();
  const tags = [];
  const map = [
    ["rhinoplasty", "Rhinoplasty"],
    ["nose job", "Rhinoplasty"],
    ["blepharoplasty", "Blepharoplasty"],
    ["eyelid", "Blepharoplasty"],
    ["facelift", "Facelift"],
    ["neck lift", "Neck lift"],
    ["liposuction", "Liposuction"],
    ["lipo", "Liposuction"],
    ["tummy tuck", "Tummy tuck"],
    ["abdominoplasty", "Tummy tuck"],
    ["bbl", "BBL"],
    ["breast augmentation", "Breast augmentation"],
    ["breast implant", "Breast augmentation"],
    ["breast lift", "Breast lift"],
    ["mastopexy", "Breast lift"],
    ["breast reduction", "Breast reduction"],
    ["gynecomastia", "Gynecomastia"],
    ["botox", "Botox"],
    ["filler", "Dermal fillers"],
    ["fat transfer", "Fat transfer"]
  ];
  for (const [needle, label] of map) {
    if (t.includes(needle)) tags.push(label);
    if (tags.length >= 3) break;
  }
  return [...new Set(tags)].slice(0, 3);
}
