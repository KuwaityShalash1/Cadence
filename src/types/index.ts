export type HabitType = "boolean" | "numeric" | "duration" | "counter";

export type Schedule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] } // 0 = Sunday
  | { type: "timesPerWeek"; count: number }
  | { type: "monthDays"; days: number[] }
  | { type: "interval"; everyNDays: number };

export type LogStatus = "complete" | "partial" | "skipped" | "frozen" | "none";

export interface Habit {
  id: string;
  name: string;
  description?: string | undefined;
  icon: string;
  color: string;
  groupId?: string | undefined;
  goalId?: string | undefined;
  type: HabitType;
  target: number;
  unit: string;
  quickIncrements?: number[];
  quickDecrement?: number[];
  schedule: Schedule;
  startDate: string; // YYYY-MM-DD
  endDate?: string | undefined;
  reminderTimes: string[]; // HH:mm slots; an empty array disables reminders
  reminder?: string | undefined; // HH:mm
  reminderEnabled: boolean; // explicit on/off toggle (for UI consistency)
  archived: boolean;
  order: number;
  createdAt: number;
  /** ISO timestamp of the last modification (undefined for legacy habits). */
  updatedAt?: string | undefined;
  freezesAllowedPerMonth: number;
  freezesUsedThisMonth: number;
  frozenDates: string[]; // YYYY-MM-DD
  lastFreezeResetDate: string; // YYYY-MM
  /** True when marked as a non-negotiable core Daily Pillar. */
  isPillar?: boolean | undefined;
  /** True when successfully synced to Supabase cloud. */
  synced?: boolean | undefined;
  /** True when local modifications are pending push to Supabase cloud. */
  pending_sync?: boolean | undefined;
}

export interface CustomIcon {
  id: string;
  svgContent: string;
}

export interface HabitLog {
  id: string; // `${habitId}:${date}`
  habitId: string;
  date: string; // YYYY-MM-DD (local day)
  value: number;
  target: number; // snapshot of the target at log time
  status: Exclude<LogStatus, "none">;
  updatedAt: number;
  /** True when successfully synced to Supabase cloud. */
  synced?: boolean | undefined;
  /** True when local modifications are pending push to Supabase cloud. */
  pending_sync?: boolean | undefined;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** ISO timestamp of the last modification (undefined for default groups). */
  updatedAt?: string | undefined;
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export interface Goal {
  id: string;
  order?: number | undefined;
  name: string;
  description?: string | undefined;
  habitIds: string[];
  type: "numeric" | "habit_milestone";
  targetValue: number;
  currentValue: number;
  unit: string;
  /** Lucide icon name or custom SVG icon id (optional for legacy goals). */
  icon?: string | undefined;
  /** Palette name (e.g. "teal") or custom HEX — drives the card tint. */
  color?: string | undefined;
  targetDate?: string | undefined;
  createdAt: number;
  /** ISO timestamp of the last modification (undefined for legacy goals). */
  updatedAt?: string | undefined;
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export interface RoutineStep {
  id: string;
  title: string;
  habitId?: string | undefined;
  /** ISO timestamp of the last modification. */
  updatedAt?: string | undefined;
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export interface Routine {
  id: string;
  order?: number | undefined;
  name: string;
  icon: string;
  /** Palette name (e.g. "teal") or custom HEX — drives the card tint. Optional for legacy routines. */
  color?: string | undefined;
  steps: RoutineStep[];
  schedule: Schedule;
  createdAt: number;
  /** ISO timestamp of the last modification (undefined for legacy routines). */
  updatedAt?: string | undefined;
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export interface RoutineLog {
  id: string; // `${routineId}:${date}`
  routineId: string;
  date: string;
  completedStepIds: string[];
  updatedAt: number;
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export type ThemeMode = "light" | "dark" | "system";
export type LanguageCode = "en" | "ar";

export interface AppSettings {
  id: "settings";
  theme: ThemeMode;
  language: LanguageCode;
  weekStartsOn: 0 | 1;
  notificationsEnabled: boolean;
  remindersEnabled: boolean;
  onboarded: boolean;
  displayName?: string | undefined;
  avatar?: string | undefined; // data URL or emoji
  isSoundEnabled: boolean;
  isMuted?: boolean;
}

export interface RelapseRecord {
  id: string;
  relapsedAt: number; // timestamp
  triggerCategory: string;
  detailedReason?: string | undefined;
  streakDurationHours: number;
  /** ISO timestamp of when this relapse record was created. */
  updatedAt?: string | undefined;
}

/**
 * A single daily usage entry for a "limit" strategy bad habit.
 * E.g., "I used 45 minutes of social media today" or "I had 2 cigarettes."
 */
export interface UsageLog {
  id: string;
  date: string; // YYYY-MM-DD (local day)
  value: number; // amount used (minutes or count)
  /** ISO timestamp of when this usage log was created. */
  updatedAt: number;
}

export interface BadHabit {
  id: string;
  order?: number | undefined;
  title: string;
  quitDate: number; // timestamp
  history: RelapseRecord[];
  createdAt: number;
  /** ISO timestamp of the last modification. */
  updatedAt?: string | undefined;
  icon?: string;
  color?: string;
  /**
   * The cessation strategy for this bad habit.
   * - "cold-turkey": Complete Cessation (full abstinence, traditional approach).
   * - "limit": Moderation / Limit (moderate usage within a daily limit).
   * Defaults to "cold-turkey" for backward compatibility with existing items.
   */
  strategy?: "cold-turkey" | "limit";
  /**
   * The type of limit when strategy is "limit".
   * - "time": Time-based limit (e.g., minutes per day).
   * - "count": Count-based limit (e.g., number of cigarettes).
   * Only applicable when strategy is "limit".
   */
  limitType?: "time" | "count";
  /**
   * The maximum allowed daily value when strategy is "limit".
   * E.g., 120 for 120 minutes of social media, or 5 for 5 cigarettes.
   * Only applicable when strategy is "limit".
   */
  limitValue?: number;
  /**
   * Daily usage logs for "limit" strategy habits.
   * Each entry records how much was used on a given day.
   * A relapse occurs only when the daily total exceeds limitValue.
   */
  usageLogs?: UsageLog[];
  synced?: boolean | undefined;
  pending_sync?: boolean | undefined;
}

export interface TimerState {
  id: "timer";
  habitId: string;
  startedAt: number | null; // null while paused
  accumulatedMs: number;
}

/** Statistics captured during a local-to-cloud merge operation. */
export interface MigrationStats {
  habitsChecked: number;
  habitsUpserted: number;
  habitsResolved: number;
  logsChecked: number;
  logsUpserted: number;
  logsResolved: number;
  badHabitsChecked?: number;
  badHabitsUpserted?: number;
  badHabitsResolved?: number;
  durationMs: number;
}

/** Result returned by the local-to-cloud migration utility. */
export interface MigrationResult {
  success: boolean;
  stats: MigrationStats;
  error?: string | undefined;
  details?:
    | {
        remappedHabitIds: Record<string, string>;
      }
    | undefined;
}

export type MigrationStatus = "idle" | "migrating" | "success" | "error";

/** Background synchronization status. */
export type SyncStatus = "idle" | "syncing" | "offline" | "error";
