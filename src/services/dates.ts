/** Local-day helpers. Everything in the app keys off the user's local calendar day. */
import { addDays as dfAddDays, differenceInCalendarDays } from "date-fns";

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const parts = key.split("-").map(Number);
  return new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, amount: number): string {
  const date = fromDateKey(key);
  const next = dfAddDays(date, amount);
  return toDateKey(next);
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(fromDateKey(a), fromDateKey(b));
}

export function rangeKeys(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 4000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

export function startOfWeekKey(key: string, weekStartsOn: 0 | 1 = 1): string {
  const date = fromDateKey(key);
  const day = date.getDay();
  const delta = (day - weekStartsOn + 7) % 7;
  return addDays(key, -delta);
}

export function monthMatrix(year: number, month: number, weekStartsOn: 0 | 1 = 1): string[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(toDateKey(first), -lead);
  const weeks: string[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (w >= 3 && fromDateKey(week[6] as string).getMonth() !== month) break;
  }
  return weeks;
}

export function formatDay(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDay(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
