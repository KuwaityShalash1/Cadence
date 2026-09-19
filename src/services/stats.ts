import type { Habit, HabitLog, LogStatus } from "@/types";
import { addDays, rangeKeys, startOfWeekKey, todayKey } from "./dates";
import { isFlexible, isScheduledOn, weeklyQuota } from "./schedule";

export type LogMap = Record<string, HabitLog>; // key `${habitId}:${date}`

export function logKey(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}

export function buildLogMap(logs: HabitLog[]): LogMap {
  const map: LogMap = {};
  for (const log of logs) map[log.id] = log;
  return map;
}

export function getLog(logs: LogMap, habitId: string, date: string): HabitLog | undefined {
  return logs[logKey(habitId, date)];
}

export function dayStatus(habit: Habit, logs: LogMap, date: string): LogStatus {
  const log = getLog(logs, habit.id, date);
  if (log) {
    // A frozen day is its own first-class status — it protects the streak
    // without counting as a completion.
    if (log.status === "frozen") return "frozen";
    if (log.status === "skipped") return "skipped";
    return log.value >= log.target ? "complete" : log.value > 0 ? "partial" : "none";
  }
  if (!isScheduledOn(habit, date)) return "none";
  return "none";
}

export function progressOn(habit: Habit, logs: LogMap, date: string): number {
  const log = getLog(logs, habit.id, date);
  if (!log) return 0;
  if (log.status === "skipped" || log.status === "frozen") return 0;
  return Math.min(1, log.target > 0 ? log.value / log.target : 0);
}

export function isCompleteOn(habit: Habit, logs: LogMap, date: string): boolean {
  const log = getLog(logs, habit.id, date);
  if (!log) return false;
  if (log.status === "skipped" || log.status === "frozen") return false;
  return log.value >= log.target;
}

/** Count completed habit logs across all linked habits for a milestone goal. */
export function completedLogCount(habitIds: string[], logs: LogMap): number {
  const linkedIds = new Set(habitIds);
  return Object.values(logs).filter(
    (log) =>
      linkedIds.has(log.habitId) &&
      log.status !== "skipped" &&
      log.status !== "frozen" &&
      log.value >= log.target,
  ).length;
}

export interface CompletionCounts {
  due: number;
  completed: number;
}

/** Count completion against the habit's actual schedule, including weekly quotas. */
export function completionCounts(
  habit: Habit,
  logs: LogMap,
  fromKey: string,
  toKey: string,
): CompletionCounts {
  const start = habit.startDate > fromKey ? habit.startDate : fromKey;
  const end = habit.endDate && habit.endDate < toKey ? habit.endDate : toKey;
  if (start > end) return { due: 0, completed: 0 };

  if (isFlexible(habit)) {
    const quota = weeklyQuota(habit) ?? 1;
    let due = 0;
    let completed = 0;
    let weekStart = startOfWeekKey(start);
    const lastWeek = startOfWeekKey(end);

    while (weekStart <= lastWeek) {
      const weekEnd = addDays(weekStart, 6);
      const activeDays = rangeKeys(
        weekStart > start ? weekStart : start,
        weekEnd < end ? weekEnd : end,
      );
      const completedThisWeek = activeDays.filter((date) => isCompleteOn(habit, logs, date)).length;
      due += quota;
      completed += Math.min(quota, completedThisWeek);
      weekStart = addDays(weekStart, 7);
    }

    return { due, completed };
  }

  let due = 0;
  let completed = 0;
  for (const date of rangeKeys(start, end)) {
    if (!isScheduledOn(habit, date)) continue;
    due += 1;
    if (isCompleteOn(habit, logs, date)) completed += 1;
  }
  return { due, completed };
}

/** Day completion across all scheduled habits (0..1). */
export function dayCompletion(habits: Habit[], logs: LogMap, date: string): number {
  const due = habits.filter((h) => !h.archived && isScheduledOn(h, date));
  if (!due.length) return 0;
  const sum = due.reduce((acc, h) => acc + progressOn(h, logs, date), 0);
  return sum / due.length;
}

export interface HabitStats {
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  averageProgress: number;
  scheduledDays: number;
}

export function habitStats(habit: Habit, logs: LogMap, fromKey: string, toKey: string): HabitStats {
  const days = rangeKeys(fromKey, toKey);
  let scheduled = 0;
  let completed = 0;
  let progressSum = 0;

  for (const day of days) {
    if (!isScheduledOn(habit, day)) continue;
    scheduled += 1;
    progressSum += progressOn(habit, logs, day);
    if (isCompleteOn(habit, logs, day)) completed += 1;
  }

  const totalCompletions = Object.values(logs).filter(
    (l) => l.habitId === habit.id && (l.status === "skipped" || l.value >= l.target),
  ).length;

  const { current, best } = streaks(habit, logs);

  return {
    completionRate: scheduled ? completed / scheduled : 0,
    currentStreak: current,
    bestStreak: best,
    totalCompletions,
    averageProgress: scheduled ? progressSum / scheduled : 0,
    scheduledDays: scheduled,
  };
}

export function checkMonthlyFreezeReset(habit: Habit): Habit {
  const currentMonth = todayKey().slice(0, 7);
  const habitMonth = habit.lastFreezeResetDate?.slice(0, 7) || currentMonth;
  if (currentMonth > habitMonth) {
    return {
      ...habit,
      freezesUsedThisMonth: 0,
      lastFreezeResetDate: currentMonth,
    };
  }
  return habit;
}

/**
 * Streaks count *scheduled* occurrences only, so an unscheduled rest day never
 * breaks a streak. Flexible (X per week) habits are counted per week.
 */
export function streaks(habit: Habit, logs: LogMap): { current: number; best: number } {
  const h = checkMonthlyFreezeReset(habit);
  const today = todayKey();
  if (isFlexible(h)) return weeklyStreaks(h, logs, today);

  const habitLogs = Object.values(logs).filter((l) => l.habitId === h.id);
  if (!habitLogs.length) return { current: 0, best: 0 };
  const earliest = habitLogs.reduce((min, l) => (l.date < min ? l.date : min), h.startDate);
  const days = rangeKeys(earliest < h.startDate ? earliest : h.startDate, today);

  let best = 0;
  let run = 0;
  let current = 0;
  for (const day of days) {
    if (!isScheduledOn(h, day)) continue;
    if (isCompleteOn(h, logs, day)) {
      run += 1;
      best = Math.max(best, run);
    } else if (h.frozenDates?.includes(day) || getLog(logs, h.id, day)?.status === "frozen") {
      // Frozen day: holds streak count instead of resetting to 0. Checked both
      // on the habit's frozenDates and on the day's 'frozen' log entry so the
      // two persistence paths stay interchangeable.
      best = Math.max(best, run);
    } else if (day === today) {
      // Today isn't a miss yet — it just doesn't extend the streak.
      break;
    } else {
      run = 0;
    }
  }
  current = run;
  return { current, best };
}

function weeklyStreaks(
  habit: Habit,
  logs: LogMap,
  today: string,
): { current: number; best: number } {
  const quota = weeklyQuota(habit) ?? 1;
  const habitLogs = Object.values(logs).filter((l) => l.habitId === habit.id);
  if (!habitLogs.length) return { current: 0, best: 0 };
  const first = startOfWeekKey(
    habitLogs.reduce((min, l) => (l.date < min ? l.date : min), habit.startDate),
  );
  let cursor = first;
  let run = 0;
  let best = 0;
  const currentWeek = startOfWeekKey(today);
  while (cursor <= currentWeek) {
    const weekDays = rangeKeys(cursor, addDays(cursor, 6));
    const done = weekDays.filter((d) => isCompleteOn(habit, logs, d)).length;
    if (done >= quota) {
      run += 1;
      best = Math.max(best, run);
    } else if (cursor === currentWeek) {
      break;
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 7);
  }
  return { current: run, best };
}

/** Overall consistency: average daily completion, weighted so recent days matter more. */
export function consistencyScore(habits: Habit[], logs: LogMap, days = 30): number {
  const today = todayKey();
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, -i);
    const active = habits.filter((h) => !h.archived && isScheduledOn(h, date));
    if (!active.length) continue;
    const weight = 1 - i / (days * 1.5);
    weightedSum += dayCompletion(habits, logs, date) * weight;
    weightTotal += weight;
  }
  return weightTotal ? weightedSum / weightTotal : 0;
}

export function completedDaysTotal(habits: Habit[], logs: LogMap): number {
  const dates = new Set(Object.values(logs).map((l) => l.date));
  let count = 0;
  for (const date of dates) {
    if (dayCompletion(habits, logs, date) >= 0.999) count += 1;
  }
  return count;
}

export interface TrendPoint {
  date: string;
  label: string;
  value: number;
}

export function trend(habits: Habit[], logs: LogMap, days: number): TrendPoint[] {
  const today = todayKey();
  const points: TrendPoint[] = [];
  const step = days > 120 ? 7 : 1;
  for (let i = days - 1; i >= 0; i -= step) {
    const date = addDays(today, -i);
    let value: number;
    if (step === 1) {
      value = dayCompletion(habits, logs, date);
    } else {
      const window = rangeKeys(date, addDays(date, 6)).filter((d) => d <= today);
      value = window.length
        ? window.reduce((acc, d) => acc + dayCompletion(habits, logs, d), 0) / window.length
        : 0;
    }
    points.push({
      date,
      label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.round(value * 100),
    });
  }
  return points;
}
