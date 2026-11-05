import type { CulturalItem } from "../types";
import { addContentTime } from "./contentTimer";

const focus = 25 * 60_000;
const rest = 5 * 60_000;

export function pomodoroEnd(session: NonNullable<CulturalItem["pomodoro"]>) {
  return session.start + (session.phase === "focus" ? focus : rest);
}

export function settlePomodoro(item: CulturalItem, now: number, manual = false): CulturalItem {
  const session = item.pomodoro;
  if (!session || (!manual && now < pomodoroEnd(session))) return item;
  const cleared = { ...item, pomodoro: undefined, updatedAt: new Date(now).toISOString() };
  if (session.phase === "break") return cleared;
  const end = Math.min(now, pomodoroEnd(session));
  const saved = addContentTime(cleared, end - session.start, now);
  if (end === pomodoroEnd(session) && now < end + rest) {
    return { ...saved, pomodoro: { phase: "break", start: end } };
  }
  return saved;
}
