import { createContext, useContext } from "react";

export interface CompareSelectionContextValue {
  slugs: string[];
  count: number;
  atMax: boolean;
  isSelected: (slug: string) => boolean;
  toggle: (slug: string) => void;
  clear: () => void;
}

export const CompareSelectionContext = createContext<CompareSelectionContextValue | null>(null);

export function useCompareSelection(): CompareSelectionContextValue {
  const ctx = useContext(CompareSelectionContext);
  if (!ctx) throw new Error("useCompareSelection must be used inside CompareSelectionProvider");
  return ctx;
}
