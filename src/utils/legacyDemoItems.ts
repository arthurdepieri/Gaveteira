import { CulturalItem } from "../types";

const LEGACY_DEMO_ITEM_IDS = new Set([
  "game-outer-wilds",
  "book-clarice",
  "album-igor",
  "movie-arrival",
  "series-severance",
  "game-hades",
]);

export function isLegacyDemoItem(itemOrId: CulturalItem | string) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId.id;
  return LEGACY_DEMO_ITEM_IDS.has(id);
}

export function withoutLegacyDemoItems(items: CulturalItem[] = []) {
  return items.filter((item) => !isLegacyDemoItem(item));
}
