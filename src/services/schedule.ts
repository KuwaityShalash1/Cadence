import type { Habit, Schedule } from "@/types";
import { fromDateKey, startOfWeekKey, diffDays, rangeKeys } from "./dates";

/** Does the schedule itself fall on this day (ignoring start/end dates)? */
export function scheduleMatches(schedule: Schedule, dateKey: string, anchorKey: string): boolean {
  const date = fromDateKey(dateKey);
  switch (schedule.type) {
    case "daily":
      return true;
    case "weekdays":
      return schedule.days.includes(date.getDay());
    case "timesPerWeek":
      // Flexible: available every day, measured weekly.
      return true;
    case "monthDays": {
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      // A "31st" habit lands on the last day of shorter months (and Feb 29 in leap years).
      return schedule.days.some(
        (d) => d === date.getDate() || (d > lastDayOfMonth && date.getDate() === lastDayOfMonth),
      );
    }
    case "interval": {
      const n = Math.max(1, schedule.everyNDays);
      const delta = diffDays(dateKey, anchorKey);
      return delta >= 0 && delta % n === 0;
    }
    default:
      return false;
  }
}

/** Is this habit scheduled (and active) on the given local day? */
export function isScheduledOn(habit: Habit, dateKey: string): boolean {
  if (dateKey < habit.startDate) return false;
  if (habit.endDate && dateKey > habit.endDate) return false;
  return scheduleMatches(habit.schedule, dateKey, habit.startDate);
}

export function isFlexible(habit: Habit): boolean {
  return habit.schedule.type === "timesPerWeek";
}

export function weeklyQuota(habit: Habit): number | null {
  return habit.schedule.type === "timesPerWeek" ? habit.schedule.count : null;
}

export function scheduledDaysIn(habit: Habit, startKey: string, endKey: string): string[] {
  return rangeKeys(startKey, endKey).filter((key) => isScheduledOn(habit, key));
}

export function describeSchedule(schedule: Schedule): string {
  switch (schedule.type) {
    case "daily":
      return "Every day";
    case "weekdays": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (schedule.days.length === 7) return "Every day";
      return schedule.days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => names[d])
        .join(", ");
    }
    case "timesPerWeek":
      return `${schedule.count}× per week`;
    case "monthDays":
      return `Monthly on ${schedule.days
        .slice()
        .sort((a, b) => a - b)
        .join(", ")}`;
    case "interval":
      return schedule.everyNDays === 1 ? "Every day" : `Every ${schedule.everyNDays} days`;
    default:
      return "Custom";
  }
}

/** Week window (inclusive) containing dateKey. */
export function weekWindow(dateKey: string, weekStartsOn: 0 | 1 = 1): [string, string] {
  const start = startOfWeekKey(dateKey, weekStartsOn);
  const end = rangeKeys(start, start)[0];
  void end;
  const endKey = addWeek(start);
  return [start, endKey];
}

function addWeek(startKey: string): string {
  const date = fromDateKey(startKey);
  date.setDate(date.getDate() + 6);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
