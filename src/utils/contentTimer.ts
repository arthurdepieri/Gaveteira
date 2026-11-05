import type { CulturalItem } from "../types";
import { getPlayedTimeParts } from "./gameFields";

export function contentTime(item: CulturalItem) {
  const remainder = item.timerMilliseconds ?? 0;
  if (item.category !== "games") return remainder;
  const { hours, minutes } = getPlayedTimeParts(item.timePlayed ?? "");
  return (hours * 60 + minutes) * 60_000 + remainder;
}

export function finishSession(item: CulturalItem, now: number): CulturalItem {
  if (!item.timerStartedAt) return item;
  return addContentTime({ ...item, timerStartedAt: undefined }, now - item.timerStartedAt, now);
}

export function addContentTime(item: CulturalItem, elapsed: number, now: number): CulturalItem {
  const total = contentTime(item) + Math.max(0, elapsed);
  const stopped = { updatedAt: new Date(now).toISOString() };
  if (item.category !== "games") return { ...item, ...stopped, timerMilliseconds: total };
  const minutes = Math.floor(total / 60_000);
  return { ...item, ...stopped, timerMilliseconds: total % 60_000,
    timePlayed: Math.floor(minutes / 60) + ":" + String(minutes % 60).padStart(2, "0") };
}

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}
