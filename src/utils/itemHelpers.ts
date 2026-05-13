import { Category, CulturalItem } from "../types";
import { completedStatuses, progressStatuses, wishlistStatuses } from "../data/catalog";

export function uid(prefix = "id") {
  return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function getTitle(item: CulturalItem) {
  if (item.category === "games" || item.category === "albums") return item.name;
  return item.title;
}

export function getYear(item: CulturalItem) {
  if (item.category === "books") return item.publicationYear;
  if (item.category === "movies" || item.category === "series") return item.year;
  return item.releaseYear;
}

export function getRating(item: CulturalItem) {
  return item.rating ?? 0;
}

export function getGenre(item: CulturalItem) {
  return item.genre ?? "";
}

export function isWishlist(item: CulturalItem) {
  return wishlistStatuses.includes(item.status);
}

export function isInProgress(item: CulturalItem) {
  return progressStatuses.includes(item.status);
}

export function isCompleted(item: CulturalItem) {
  return completedStatuses.includes(item.status);
}

export function getEndDate(item: CulturalItem) {
  if (item.category === "albums") return item.listenedDate;
  return item.endDate;
}

export function isCategory(value: string): value is Category {
  return ["games", "books", "albums", "movies", "series"].includes(value);
}
