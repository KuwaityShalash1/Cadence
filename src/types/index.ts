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
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** ISO timestamp of the last modification (undefined for default groups). */
  updatedAt?: string | undefined;
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
}

export interface RoutineStep {
  id: string;
  title: string;
  habitId?: string | undefined;
  /** ISO timestamp of the last modification. */
  updatedAt?: string | undefined;
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
}

export interface RoutineLog {
  id: string; // `${routineId}:${date}`
  routineId: string;
  date: string;
  completedStepIds: string[];
  updatedAt: number;
}

export type ThemeMode = "light" | "dark" | "system";
export type LanguageCode = "en" | "ar" | "es" | "fr" | "de";

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
}

export interface TimerState {
  id: "timer";
  habitId: string;
  startedAt: number | null; // null while paused
  accumulatedMs: number;
}
