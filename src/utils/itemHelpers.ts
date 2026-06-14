import { Category, CulturalItem, SocialVisibility } from "../types";
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

export function getGenres(item: CulturalItem) {
  return splitGenres(getGenre(item));
}

export function getWorkKey(item: CulturalItem) {
  const title = normalizeWorkText(getTitle(item));
  if (!title) return "";

  const year = getYear(item);
  return `${item.category}:${title}:${year ?? ""}`;
}

export function getPlayedHours(item: CulturalItem) {
  if (item.category !== "games" || !item.timePlayed) return 0;
  return parsePlayedHours(item.timePlayed);
}

export function getItemVisibility(item: CulturalItem): SocialVisibility {
  return item.visibility ?? "friends";
}

export function getItemVisibilityLabel(item: CulturalItem) {
  const visibility = getItemVisibility(item);
  if (visibility === "private") return "Privado";
  if (visibility === "friends") return "Visível para amigos";
  if (visibility === "group") return "Grupo";
  return "Público";
}

export function isVisibleToFriends(item: CulturalItem) {
  return getItemVisibility(item) !== "private";
}

export function parsePlayedHours(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(",", ".")
    .trim();
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hora|horas|hr|hrs)/);
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(m|min|minuto|minutos)/);
  const colonMatch = normalized.match(/^(\d+):(\d{1,2})$/);

  if (colonMatch) {
    return Number(colonMatch[1]) + Number(colonMatch[2]) / 60;
  }

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  if (hours || minutes) return hours + minutes / 60;

  const plainNumber = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(plainNumber) ? plainNumber : 0;
}

export function splitGenres(value: string) {
  return value
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

export function isWishlist(item: CulturalItem) {
  return wishlistStatuses.some((status) => sameLabel(status, item.status));
}

export function isInProgress(item: CulturalItem) {
  return progressStatuses.some((status) => sameLabel(status, item.status));
}

export function isCompleted(item: CulturalItem) {
  return completedStatuses.some((status) => sameLabel(status, item.status));
}

export function getEndDate(item: CulturalItem) {
  if (item.category === "albums") return item.listenedDate;
  return item.endDate;
}

export function isCategory(value: string): value is Category {
  return ["games", "books", "albums", "movies", "series"].includes(value);
}

export function isEmptyCulturalItem(item: CulturalItem) {
  const hasSharedInfo =
    Boolean(item.coverUrl?.trim()) ||
    item.links.some((link) => link.label.trim() || link.url.trim()) ||
    item.timeline.some((event) => event.date.trim() || event.note?.trim()) ||
    item.diary.some((entry) => entry.text.trim()) ||
    Boolean(item.rating);

  if (hasSharedInfo) return false;

  const ignoredKeys = new Set([
    "id",
    "category",
    "status",
    "visibility",
    "tags",
    "coverUrl",
    "links",
    "timeline",
    "diary",
    "seasonalTheme",
    "createdAt",
    "updatedAt",
    "rating",
  ]);

  return !Object.entries(item).some(([key, value]) => {
    if (ignoredKeys.has(key)) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    return value != null;
  });
}

function sameLabel(left: string, right: string) {
  return normalizeLabel(left) === normalizeLabel(right);
}

function normalizeWorkText(value: string) {
  return normalizeLabel(value).replace(/\s+/g, " ").trim();
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
