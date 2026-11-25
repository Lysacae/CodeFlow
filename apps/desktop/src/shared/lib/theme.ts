export type ThemeId = "dark" | "light" | "prune" | "salad";

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "dark", label: "Night" },
  { id: "light", label: "Clair" },
  { id: "prune", label: "Prune" },
  { id: "salad", label: "Salade" },
];

export function normalizeTheme(value: string | null | undefined): ThemeId {
  if (value === "light" || value === "prune" || value === "salad") return value;
  return "dark";
}

export function themeLabel(theme: string): string {
  return THEME_OPTIONS.find((t) => t.id === normalizeTheme(theme))?.label ?? "Night";
}
