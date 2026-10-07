import type { Habit } from "@/types";
import { addDays, diffDays, rangeKeys, todayKey } from "./dates";
import { isCompleteOn, streaks, type LogMap } from "./stats";
import { isScheduledOn } from "./schedule";

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  unlocked: boolean;
  progress: number; // 0..100
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

  // 8. Achievements & Badges
  const badges: GamificationBadge[] = [
    {
      id: "badge-first-step",
      title: "First Step",
      description: "Log your first habit completion",
      icon: "Sparkles",
      unlocked: totalCompletions >= 1,
      progress: Math.min(100, Math.round((totalCompletions / 1) * 100)),
    },
    {
      id: "badge-week-streak",
      title: "7-Day Streak",
      description: "Maintain a 7-day consecutive streak",
      icon: "Flame",
      unlocked: longestStreak >= 7,
      progress: Math.min(100, Math.round((longestStreak / 7) * 100)),
    },
    {
      id: "badge-consistency-king",
      title: "30-Day Master",
      description: "Achieve a 30-day streak of daily consistency",
      icon: "Crown",
      unlocked: longestStreak >= 30,
      progress: Math.min(100, Math.round((longestStreak / 30) * 100)),
    },
    {
      id: "badge-century",
      title: "Century Club",
      description: "Complete 100 habits across your journey",
      icon: "Award",
      unlocked: totalCompletions >= 100,
      progress: Math.min(100, Math.round((totalCompletions / 100) * 100)),
    },
    {
      id: "badge-perfectionist",
      title: "Flawless Week",
      description: "Achieve 85%+ completion rate over 7 days",
      icon: "Target",
      unlocked: weeklyRate >= 85,
      progress: Math.min(100, Math.round((weeklyRate / 85) * 100)),
    },
    {
      id: "badge-habit-builder",
      title: "Habit Architect",
      description: "Build and maintain 5 or more active habits",
      icon: "Layers",
      unlocked: activeHabits.length >= 5,
      progress: Math.min(100, Math.round((activeHabits.length / 5) * 100)),
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
