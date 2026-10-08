import type { Habit } from "@/types";
import { addDays, diffDays, rangeKeys, todayKey } from "./dates";
import { isCompleteOn, streaks, type LogMap } from "./stats";
import { isScheduledOn } from "./schedule";

export type BadgeRarity = "bronze" | "silver" | "gold" | "diamond";

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  rarity: BadgeRarity;
  unlocked: boolean;
  progress: number; // 0..100
  currentValue: number;
  targetValue: number;
  unit?: string;
  unlockedAt?: string | undefined;
}

export interface DayCompletionStat {
  date: string;
  dayLabel: string;
  completed: number;
  scheduled: number;
  isComplete: boolean;
  isToday: boolean;
}

export interface GamificationStats {
  /** Consecutive days where habit completion occurred up to today */
  currentStreak: number;
  /** All-time longest streak of consecutive days with habit completion */
  longestStreak: number;
  /** Completion rate percentage over the last 7 days (0 - 100) */
  weeklyRate: number;
  /** Completion rate percentage difference vs the preceding 7 days (+/- %) */
  weeklyTrend: number;
  /** Completion rate percentage over the last 30 days (0 - 100) */
  monthlyRate: number;
  /** Total number of habit completions logged across all time */
  totalCompletions: number;
  /** Number of active (non-archived) habits */
  activeHabitsCount: number;
  /** Number of days in the last 30 days where 100% of scheduled habits were met */
  perfectDaysCount: number;
  /** Overall user gamification XP points */
  xpPoints: number;
  /** Current gamification rank/level details */
  level: {
    level: number;
    title: string;
    currentXp: number;
    nextLevelXp: number;
    progressPercentage: number;
  };
  /** Habit with the highest current individual streak */
  streakLeader: {
    id: string;
    name: string;
    icon: string;
    color?: string | undefined;
    streak: number;
  } | null;
  /** Last 7 days breakdown for visual mini-chart */
  weeklyBreakdown: DayCompletionStat[];
  /** Gamification achievement badges */
  badges: GamificationBadge[];
}

const LEVEL_THRESHOLDS = [
  { level: 1, title: "Seedling", xpRequired: 0 },
  { level: 2, title: "Consistent Starter", xpRequired: 150 },
  { level: 3, title: "Habit Builder", xpRequired: 400 },
  { level: 4, title: "Rhythm Keeper", xpRequired: 900 },
  { level: 5, title: "Focus Master", xpRequired: 1800 },
  { level: 6, title: "Cadence Legend", xpRequired: 3500 },
];

/**
 * Calculates comprehensive gamification and streak statistics from synced habits and logs.
 * Optimized with early returns and fast date range index lookups.
 */
export function calculateGamificationStats(habits: Habit[], logMap: LogMap): GamificationStats {
  const today = todayKey();
  const activeHabits = habits.filter((h) => !h.archived);

  // 1. Gather all dates where at least one scheduled habit was completed
  const completionDatesSet = new Set<string>();
  let totalCompletions = 0;

  for (const log of Object.values(logMap)) {
    if (log.status === "complete" || (log.target > 0 && log.value >= log.target)) {
      totalCompletions += 1;
      completionDatesSet.add(log.date);
    }
  }

  // 2. Calculate Current Streak (consecutive days of habit completion)
  let currentStreak = 0;
  const yesterday = addDays(today, -1);

  // If today has completed habits, streak extends through today
  // If today is in progress but yesterday had completions, streak is still active from yesterday
  const streakStartDate = completionDatesSet.has(today)
    ? today
    : completionDatesSet.has(yesterday)
      ? yesterday
      : null;

  if (streakStartDate) {
    let checkDate = streakStartDate;
    while (completionDatesSet.has(checkDate)) {
      currentStreak += 1;
      checkDate = addDays(checkDate, -1);
    }
  }

  // 3. Calculate Longest Streak (all-time longest consecutive days run)
  const sortedDates = Array.from(completionDatesSet).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | null = null;

  for (const date of sortedDates) {
    if (!previousDate) {
      runningStreak = 1;
    } else {
      const diff = diffDays(date, previousDate);
      if (diff === 1) {
        runningStreak += 1;
      } else if (diff > 1) {
        runningStreak = 1;
      }
    }
    previousDate = date;
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
  }

  // Ensure longest streak is at least as large as current streak
  longestStreak = Math.max(longestStreak, currentStreak);

  // 4. Calculate Weekly Completion Rate (last 7 days vs previous 7 days)
  const last7Days = rangeKeys(addDays(today, -6), today);
  const prev7Days = rangeKeys(addDays(today, -13), addDays(today, -7));

  let weekScheduled = 0;
  let weekCompleted = 0;
  const weeklyBreakdown: DayCompletionStat[] = [];

  for (const day of last7Days) {
    let dayScheduled = 0;
    let dayCompleted = 0;

    for (const habit of activeHabits) {
      if (isScheduledOn(habit, day)) {
        dayScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          dayCompleted += 1;
        }
      }
    }

    weekScheduled += dayScheduled;
    weekCompleted += dayCompleted;

    const dateObj = new Date(day + "T00:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "narrow" });

    weeklyBreakdown.push({
      date: day,
      dayLabel,
      completed: dayCompleted,
      scheduled: dayScheduled,
      isComplete: dayScheduled > 0 && dayCompleted >= dayScheduled,
      isToday: day === today,
    });
  }

  const weeklyRate = weekScheduled > 0 ? Math.round((weekCompleted / weekScheduled) * 100) : 0;

  // Previous 7 days rate for trend comparison
  let prevWeekScheduled = 0;
  let prevWeekCompleted = 0;

  for (const day of prev7Days) {
    for (const habit of activeHabits) {
      if (isScheduledOn(habit, day)) {
        prevWeekScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          prevWeekCompleted += 1;
        }
      }
    }
  }

  const prevWeeklyRate =
    prevWeekScheduled > 0 ? Math.round((prevWeekCompleted / prevWeekScheduled) * 100) : 0;
  const weeklyTrend = weeklyRate - prevWeeklyRate;

  // 5. Calculate Monthly Completion Rate (last 30 days) & Perfect Days
  const last30Days = rangeKeys(addDays(today, -29), today);
  let monthScheduled = 0;
  let monthCompleted = 0;
  let perfectDaysCount = 0;

  for (const day of last30Days) {
    let dayScheduled = 0;
    let dayCompleted = 0;

    for (const habit of activeHabits) {
      if (isScheduledOn(habit, day)) {
        dayScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          dayCompleted += 1;
        }
      }
    }

    monthScheduled += dayScheduled;
    monthCompleted += dayCompleted;

    if (dayScheduled > 0 && dayCompleted >= dayScheduled) {
      perfectDaysCount += 1;
    }
  }

  const monthlyRate = monthScheduled > 0 ? Math.round((monthCompleted / monthScheduled) * 100) : 0;

  // 6. Find Individual Habit Streak Leader
  let streakLeader: GamificationStats["streakLeader"] = null;
  let topHabitStreak = 0;

  for (const habit of activeHabits) {
    const habitStreak = streaks(habit, logMap).current;
    if (habitStreak > topHabitStreak) {
      topHabitStreak = habitStreak;
      streakLeader = {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        streak: habitStreak,
      };
    }
  }

  // 7. Gamification XP & Level Progression
  // Completions: 15 XP each, Streak bonus: 20 XP per active day, Perfect days: 30 XP each
  const xpPoints = totalCompletions * 15 + currentStreak * 20 + perfectDaysCount * 30;

  let currentTier = LEVEL_THRESHOLDS[0]!;
  let nextTier = LEVEL_THRESHOLDS[1]!;

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    const tier = LEVEL_THRESHOLDS[i]!;
    if (xpPoints >= tier.xpRequired) {
      currentTier = tier;
      nextTier = LEVEL_THRESHOLDS[i + 1] ?? {
        level: tier.level + 1,
        title: "Transcendent",
        xpRequired: tier.xpRequired + 2000,
      };
    }
  }

  const xpIntoCurrentLevel = xpPoints - currentTier.xpRequired;
  const xpNeededForNext = nextTier.xpRequired - currentTier.xpRequired;
  const progressPercentage = Math.min(
    100,
    Math.max(0, Math.round((xpIntoCurrentLevel / xpNeededForNext) * 100)),
  );

  // 8. Achievements & Badges calculation
  // Early Bird (< 8:00 AM) & Night Owl (>= 10:00 PM / 22:00) detection
  let hasEarlyBird = false;
  let hasNightOwl = false;

  for (const log of Object.values(logMap)) {
    const isCompleted = log.status === "complete" || (log.target > 0 && log.value >= log.target);
    if (
      isCompleted &&
      typeof log.updatedAt === "number" &&
      !isNaN(log.updatedAt) &&
      log.updatedAt > 0
    ) {
      const logHour = new Date(log.updatedAt).getHours();
      if (logHour < 8) {
        hasEarlyBird = true;
      }
      if (logHour >= 22) {
        hasNightOwl = true;
      }
    }
  }

  // Iron Will: 14-day streak without using streak freezes
  const allFrozenDates = new Set<string>();
  for (const h of habits) {
    if (Array.isArray(h.frozenDates)) {
      for (const d of h.frozenDates) {
        allFrozenDates.add(d);
      }
    }
  }
  for (const log of Object.values(logMap)) {
    if (log.status === "frozen") {
      allFrozenDates.add(log.date);
    }
  }

  let maxIronWillStreak = 0;
  let runningFreezeFreeStreak = 0;
  let prevDateForIron: string | null = null;

  for (const date of sortedDates) {
    if (allFrozenDates.has(date)) {
      runningFreezeFreeStreak = 0;
      prevDateForIron = null;
      continue;
    }
    if (!prevDateForIron) {
      runningFreezeFreeStreak = 1;
    } else {
      const diff = diffDays(date, prevDateForIron);
      if (diff === 1) {
        runningFreezeFreeStreak += 1;
      } else {
        runningFreezeFreeStreak = 1;
      }
    }
    prevDateForIron = date;
    if (runningFreezeFreeStreak > maxIronWillStreak) {
      maxIronWillStreak = runningFreezeFreeStreak;
    }
  }

  // Also check individual active habits for freeze-free streaks
  for (const habit of activeHabits) {
    const habitLogs = Object.values(logMap).filter((l) => l.habitId === habit.id);
    if (!habitLogs.length) continue;
    const earliest = habitLogs.reduce((min, l) => (l.date < min ? l.date : min), habit.startDate);
    const habitDays = rangeKeys(earliest < habit.startDate ? earliest : habit.startDate, today);
    let habitFreezeFreeRun = 0;
    for (const day of habitDays) {
      if (!isScheduledOn(habit, day)) continue;
      if (isCompleteOn(habit, logMap, day) && !allFrozenDates.has(day)) {
        habitFreezeFreeRun += 1;
        if (habitFreezeFreeRun > maxIronWillStreak) {
          maxIronWillStreak = habitFreezeFreeRun;
        }
      } else {
        habitFreezeFreeRun = 0;
      }
    }
  }

  // Triple Crown: Achieve 100% daily completion for 3 consecutive days
  let maxConsecutivePerfectDays = 0;
  let runningPerfectDays = 0;

  let earliestPerfDate = addDays(today, -89);
  for (const date of sortedDates) {
    if (date < earliestPerfDate) earliestPerfDate = date;
  }
  const perfDaysRange = rangeKeys(earliestPerfDate, today);

  for (const day of perfDaysRange) {
    let dayScheduled = 0;
    let dayCompleted = 0;
    for (const habit of activeHabits) {
      if (isScheduledOn(habit, day)) {
        dayScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          dayCompleted += 1;
        }
      }
    }
    const isPerfect = dayScheduled > 0 && dayCompleted >= dayScheduled;
    if (isPerfect) {
      runningPerfectDays += 1;
      if (runningPerfectDays > maxConsecutivePerfectDays) {
        maxConsecutivePerfectDays = runningPerfectDays;
      }
    } else {
      if (day !== today) {
        runningPerfectDays = 0;
      }
    }
  }

  const badges: GamificationBadge[] = [
    // Bronze Tiers
    {
      id: "badge-first-step",
      title: "First Step",
      description: "Log your first habit completion",
      icon: "Sparkles",
      rarity: "bronze",
      unlocked: totalCompletions >= 1,
      progress: Math.min(100, Math.round((totalCompletions / 1) * 100)),
      currentValue: Math.min(totalCompletions, 1),
      targetValue: 1,
      unit: "completions",
    },
    {
      id: "badge-early-bird",
      title: "Early Bird",
      description: "Log a habit before 8:00 AM",
      icon: "Sunrise",
      rarity: "bronze",
      unlocked: hasEarlyBird,
      progress: hasEarlyBird ? 100 : 0,
      currentValue: hasEarlyBird ? 1 : 0,
      targetValue: 1,
      unit: "morning",
    },
    {
      id: "badge-night-owl",
      title: "Night Owl",
      description: "Log a habit after 10:00 PM",
      icon: "Moon",
      rarity: "bronze",
      unlocked: hasNightOwl,
      progress: hasNightOwl ? 100 : 0,
      currentValue: hasNightOwl ? 1 : 0,
      targetValue: 1,
      unit: "night",
    },
    // Silver Tiers
    {
      id: "badge-week-streak",
      title: "7-Day Streak",
      description: "Maintain a 7-day consecutive streak",
      icon: "Flame",
      rarity: "silver",
      unlocked: longestStreak >= 7,
      progress: Math.min(100, Math.round((longestStreak / 7) * 100)),
      currentValue: Math.min(longestStreak, 7),
      targetValue: 7,
      unit: "days",
    },
    {
      id: "badge-habit-builder",
      title: "Habit Architect",
      description: "Build and maintain 5 or more active habits",
      icon: "Layers",
      rarity: "silver",
      unlocked: activeHabits.length >= 5,
      progress: Math.min(100, Math.round((activeHabits.length / 5) * 100)),
      currentValue: Math.min(activeHabits.length, 5),
      targetValue: 5,
      unit: "habits",
    },
    {
      id: "badge-triple-crown",
      title: "Triple Crown",
      description: "Achieve 100% daily completion for 3 consecutive days",
      icon: "Trophy",
      rarity: "silver",
      unlocked: maxConsecutivePerfectDays >= 3,
      progress: Math.min(100, Math.round((maxConsecutivePerfectDays / 3) * 100)),
      currentValue: Math.min(maxConsecutivePerfectDays, 3),
      targetValue: 3,
      unit: "days",
    },
    // Gold Tiers
    {
      id: "badge-iron-will",
      title: "Iron Will",
      description: "Maintain a 14-day streak without using streak freezes",
      icon: "ShieldCheck",
      rarity: "gold",
      unlocked: maxIronWillStreak >= 14,
      progress: Math.min(100, Math.round((maxIronWillStreak / 14) * 100)),
      currentValue: Math.min(maxIronWillStreak, 14),
      targetValue: 14,
      unit: "days",
    },
    {
      id: "badge-perfectionist",
      title: "Flawless Week",
      description: "Achieve 85%+ completion rate over 7 days",
      icon: "Target",
      rarity: "gold",
      unlocked: weeklyRate >= 85,
      progress: Math.min(100, Math.round((weeklyRate / 85) * 100)),
      currentValue: Math.min(weeklyRate, 85),
      targetValue: 85,
      unit: "%",
    },
    // Diamond / Legendary Tiers
    {
      id: "badge-consistency-king",
      title: "30-Day Master",
      description: "Achieve a 30-day streak of daily consistency",
      icon: "Crown",
      rarity: "diamond",
      unlocked: longestStreak >= 30,
      progress: Math.min(100, Math.round((longestStreak / 30) * 100)),
      currentValue: Math.min(longestStreak, 30),
      targetValue: 30,
      unit: "days",
    },
    {
      id: "badge-century",
      title: "Century Club",
      description: "Complete 100 habits across your journey",
      icon: "Award",
      rarity: "diamond",
      unlocked: totalCompletions >= 100,
      progress: Math.min(100, Math.round((totalCompletions / 100) * 100)),
      currentValue: Math.min(totalCompletions, 100),
      targetValue: 100,
      unit: "completions",
    },
  ];

  return {
    currentStreak,
    longestStreak,
    weeklyRate,
    weeklyTrend,
    monthlyRate,
    totalCompletions,
    activeHabitsCount: activeHabits.length,
    perfectDaysCount,
    xpPoints,
    level: {
      level: currentTier.level,
      title: currentTier.title,
      currentXp: xpPoints,
      nextLevelXp: nextTier.xpRequired,
      progressPercentage,
    },
    streakLeader,
    weeklyBreakdown,
    badges,
  };
}

export interface WeeklyRecapData {
  last7Days: string[];
  totalCompletions: number;
  totalScheduled: number;
  successRate: number;
  perfectDaysCount: number;
  bestHabit: {
    habit: Habit;
    completed: number;
    scheduled: number;
    rate: number;
    streak: number;
  } | null;
  dayStats: Array<{
    date: string;
    dayLabel: string;
    completed: number;
    scheduled: number;
    isComplete: boolean;
    isToday: boolean;
  }>;
}

/**
 * Calculates past 7 days recap statistics from habits and logs.
 */
export function calculateWeeklyRecap(habits: Habit[], logMap: LogMap): WeeklyRecapData {
  const today = todayKey();
  const last7Days = rangeKeys(addDays(today, -6), today);
  const activeHabits = habits.filter((h) => !h.archived);

  let totalScheduled = 0;
  let totalCompletions = 0;
  let perfectDaysCount = 0;

  const dayStats: WeeklyRecapData["dayStats"] = [];

  for (const day of last7Days) {
    let dayScheduled = 0;
    let dayCompleted = 0;

    for (const habit of activeHabits) {
      if (isScheduledOn(habit, day)) {
        dayScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          dayCompleted += 1;
        }
      }
    }

    totalScheduled += dayScheduled;
    totalCompletions += dayCompleted;

    const isComplete = dayScheduled > 0 && dayCompleted >= dayScheduled;
    if (isComplete) {
      perfectDaysCount += 1;
    }

    const dateObj = new Date(day + "T00:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "narrow" });

    dayStats.push({
      date: day,
      dayLabel,
      completed: dayCompleted,
      scheduled: dayScheduled,
      isComplete,
      isToday: day === today,
    });
  }

  const successRate =
    totalScheduled > 0 ? Math.round((totalCompletions / totalScheduled) * 100) : 0;

  // Find best habit over these 7 days
  let bestHabit: WeeklyRecapData["bestHabit"] = null;
  let bestHabitScore = -1;

  for (const habit of activeHabits) {
    let habitScheduled = 0;
    let habitCompleted = 0;

    for (const day of last7Days) {
      if (isScheduledOn(habit, day)) {
        habitScheduled += 1;
        if (isCompleteOn(habit, logMap, day)) {
          habitCompleted += 1;
        }
      }
    }

    if (habitCompleted > 0) {
      const habitStreak = streaks(habit, logMap).current;
      // Score prioritizes completions and streak
      const score = habitCompleted * 10 + habitStreak;
      if (score > bestHabitScore) {
        bestHabitScore = score;
        const rate = habitScheduled > 0 ? Math.round((habitCompleted / habitScheduled) * 100) : 100;
        bestHabit = {
          habit,
          completed: habitCompleted,
          scheduled: habitScheduled,
          rate,
          streak: habitStreak,
        };
      }
    }
  }

  return {
    last7Days,
    totalCompletions,
    totalScheduled,
    successRate,
    perfectDaysCount,
    bestHabit,
    dayStats,
  };
}
