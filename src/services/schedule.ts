import type { Habit, Schedule } from "@/types";
import { fromDateKey, startOfWeekKey, diffDays, rangeKeys, addDays } from "./dates";

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

export function describeSchedule(
  schedule: Schedule,
  t?: (key: string, fallback?: string) => string,
): string {
  switch (schedule.type) {
    case "daily":
      return t ? t("habit.everyDay", "Every day") : "Every day";
    case "weekdays": {
      const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const fallbackNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (schedule.days.length === 7) return t ? t("habit.everyDay", "Every day") : "Every day";
      return schedule.days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => (t ? t(`weekdays.${names[d]}`, fallbackNames[d]) : fallbackNames[d]))
        .join(", ");
    }
    case "timesPerWeek":
      return t
        ? t("schedule.timesPerWeek", `${schedule.count}× per week`).replace(
            "{count}",
            String(schedule.count),
          )
        : `${schedule.count}× per week`;
    case "monthDays": {
      const daysStr = schedule.days
        .slice()
        .sort((a, b) => a - b)
        .join(", ");
      return t
        ? t("schedule.monthlyOn", `Monthly on ${daysStr}`).replace("{days}", daysStr)
        : `Monthly on ${daysStr}`;
    }
    case "interval":
      if (schedule.everyNDays === 1) {
        return t ? t("habit.everyDay", "Every day") : "Every day";
      }
      return t
        ? t("schedule.everyNDays", `Every ${schedule.everyNDays} days`).replace(
            "{count}",
            String(schedule.everyNDays),
          )
        : `Every ${schedule.everyNDays} days`;
    default:
      return t ? t("schedule.custom", "Custom") : "Custom";
  }
}

/** Week window (inclusive) containing dateKey. */
export function weekWindow(dateKey: string, weekStartsOn: 0 | 1 = 1): [string, string] {
  const start = startOfWeekKey(dateKey, weekStartsOn);
  return [start, addDays(start, 6)];
}
