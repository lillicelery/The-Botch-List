import { useCallback, useState, type ReactNode } from "react";
import { CompareSelectionContext } from "./useCompareSelection";

const STORAGE_KEY = "compare:selectedProviders";
const MAX = 3;

function readSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CompareSelectionProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>(() => readSlugs());

  const toggle = useCallback((slug: string) => {
    setSlugs((prev) => {
      let next: string[];
      if (prev.includes(slug)) {
        next = prev.filter((s) => s !== slug);
      } else {
        if (prev.length >= MAX) return prev;
        next = [...prev, slug];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    setSlugs([]);
  }, []);

  const isSelected = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  return (
    <CompareSelectionContext.Provider
      value={{ slugs, count: slugs.length, atMax: slugs.length >= MAX, isSelected, toggle, clear }}
    >
      {children}
    </CompareSelectionContext.Provider>
  );
}
