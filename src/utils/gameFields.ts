import { GameItem } from "../types";
import { parsePlayedHours } from "./itemHelpers";

export const gamePlatforms = ["PlayStation", "Xbox", "Computador", "Nintendo Switch"] as const;

export function getGamePlatform(item: Pick<GameItem, "platform" | "playedPlatform">) {
  const value = item.playedPlatform || item.platform || "";
  if (/^(playstation(?:\s*[1-5])?|ps[1-5])$/i.test(value.trim())) return "PlayStation";
  if (/^xbox(?:\s+(?:one|360|series\s+[xs]))?$/i.test(value.trim())) return "Xbox";
  if (/^(pc|windows|computador|computer)$/i.test(value.trim())) return "Computador";
  if (/^(nintendo\s+)?switch(?:\s+2)?$/i.test(value.trim())) return "Nintendo Switch";
  return value;
}

export function getPlayedTimeParts(value: string) {
  const totalMinutes = Math.max(0, Math.round(parsePlayedHours(value) * 60));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function updatePlayedTime(value: string, part: "hours" | "minutes", input: string) {
  const current = getPlayedTimeParts(value);
  const number = input === "" ? 0 : Number(input);
  if (!Number.isSafeInteger(number) || number < 0 || (part === "minutes" && number > 59)) return value;
  current[part] = number;
  return `${current.hours}:${String(current.minutes).padStart(2, "0")}`;
}
