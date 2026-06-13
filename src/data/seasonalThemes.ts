import type { CulturalItem, SeasonalThemeStamp } from "../types";

export interface SeasonalThemeDefinition {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

export const seasonalThemes: SeasonalThemeDefinition[] = [];

export function createSeasonalThemeStamp(date = new Date()): SeasonalThemeStamp | undefined {
  const activeTheme = findActiveSeasonalTheme(date);
  if (!activeTheme) return undefined;

  return {
    id: activeTheme.id,
    label: activeTheme.label,
    assignedAt: date.toISOString(),
  };
}

export function getSeasonalThemeId(item: CulturalItem) {
  return item.seasonalTheme?.id ?? "none";
}

export function getSeasonalThemeClassName(item: CulturalItem, baseClassName: string) {
  const themeId = item.seasonalTheme?.id;
  return themeId ? `${baseClassName} season-theme season-theme-${toClassNameToken(themeId)}` : baseClassName;
}

function findActiveSeasonalTheme(date: Date) {
  const timestamp = date.getTime();

  return seasonalThemes.find((theme) => {
    const startsAt = new Date(theme.startsAt).getTime();
    const endsAt = new Date(theme.endsAt).getTime();

    return Number.isFinite(startsAt)
      && Number.isFinite(endsAt)
      && timestamp >= startsAt
      && timestamp <= endsAt;
  });
}

function toClassNameToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom";
}
