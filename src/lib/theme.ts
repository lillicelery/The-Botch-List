export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "botch-theme";

export function readStoredTheme(): ThemeMode | null {
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
}

export function getPreferredTheme(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) return stored;
  return "light";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function initializeTheme(): ThemeMode {
  const theme = getPreferredTheme();
  applyTheme(theme);
  return theme;
}
