import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { toast } from "sonner";
import * as repo from "@/database/repository";
import type { Snapshot } from "@/database/repository";
import { diffDays, toDateKey, todayKey } from "@/services/dates";
import { buildLogMap, logKey, type LogMap } from "@/services/stats";
import { playCompleteHabitSound } from "@/lib/sound";
import type {
  BadHabit,
  AppSettings,
  Goal,
  Group,
  Habit,
  HabitLog,
  Routine,
  RoutineLog,
  TimerState,
  UsageLog,
} from "@/types";

/**
 * Generate a UUID v4 using the native crypto API.
 * Used as the canonical ID generator for all Cadence entities so that
 * future fullstack sync / offline-first work can rely on universally
 * unique identifiers instead of sequential integers.
 */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is unavailable.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_GROUPS: Group[] = [
  { id: "grp-study", name: "Study", icon: "BookOpen", color: "violet" },
  { id: "grp-health", name: "Health", icon: "HeartPulse", color: "emerald" },
  { id: "grp-personal", name: "Personal", icon: "Sparkles", color: "amber" },
];

/**
 * Default monthly freeze budget — applied when a habit doesn't specify its own
 * limit.
 */
export const DEFAULT_MONTHLY_FREEZE_LIMIT = 3;

/** Freeze quota snapshot for the current calendar month. */
export interface FreezeQuota {
  /** 'Frozen' entries for the habit in the current calendar month. */
  used: number;
  /** The habit's monthly freeze limit. */
  max: number;
  /** Days remaining until the limit resets on the 1st of the next month. */
  daysUntilReset: number;
}

/**
 * Outcome of a freeze/unfreeze attempt. Returned synchronously to the UI's
 * click handler, which fires exactly ONE toast per user action — the store
 * itself never notifies (side effects inside a setState updater can be
 * re-invoked by React, which is what caused double toasts).
 */
export interface FreezeResult {
  ok: boolean;
  /** True when the day is frozen AFTER the action. */
  frozen: boolean;
  /** Why the action didn't proceed (already-completed / limit / missing). */
  reason?: "already-completed" | "limit" | "missing";
  /** Quota snapshot after the action. */
  used: number;
  max: number;
  daysUntilReset: number;
  habitName?: string;
  /** True when a running timer had to be stopped by the freeze. */
  stoppedTimer?: boolean;
}

/** Uniform, side-effect-free failure result for the freeze action. */
function buildFreezeFailure(
  reason: "already-completed" | "limit" | "missing",
  used: number,
  max: number,
): FreezeResult {
  return {
    ok: false,
    frozen: false,
    reason,
    used,
    max,
    daysUntilReset: daysUntilMonthlyReset(),
  };
}

/**
 * Count the habit's frozen days within a calendar month. The daily logs
 * (status === 'frozen') are the source of truth; the habit's legacy
 * `frozenDates` list is unioned in so older data keeps counting toward the
 * monthly limit.
 */
function countFrozenDaysThisMonth(habit: Habit, habitLogs: HabitLog[], monthKey: string): number {
  const monthPrefix = `${monthKey}-`;
  const days = new Set<string>();
  for (const log of habitLogs) {
    if (log.habitId === habit.id && log.status === "frozen" && log.date.startsWith(monthPrefix)) {
      days.add(log.date);
    }
  }
  for (const date of habit.frozenDates ?? []) {
    if (date.startsWith(monthPrefix)) days.add(date);
  }
  return days.size;
}

/**
 * A day counts as already-completed when its log is complete or has reached
 * its target. Frozen / skipped logs never count — freezing must stay available
 * for those.
 */
function isCompletedLog(log: HabitLog | undefined): boolean {
  if (!log) return false;
  if (log.status === "frozen" || log.status === "skipped") return false;
  return log.status === "complete" || (log.target > 0 && log.value >= log.target);
}

/** Days remaining until the 1st of the next month (when freeze limits reset). */
function daysUntilMonthlyReset(): number {
  const now = new Date();
  const firstOfNextMonth = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  return Math.max(0, diffDays(firstOfNextMonth, todayKey()));
}

interface AppState extends Snapshot {
  ready: boolean;
  logMap: LogMap;
  isSidebarCollapsed: boolean;
  isCollapsed: boolean;
  collapsed: boolean;
  activeTimer?: TimerState | null;
}

interface AppActions {
  createHabit: (input: Omit<Habit, "id" | "createdAt" | "order" | "archived">) => Habit;
  updateHabit: (habit: Habit) => void;
  archiveHabit: (id: string, archived: boolean) => void;
  removeHabit: (id: string) => void;
  /** Undo-delete support: re-inserts a previously deleted habit (logs stay in the DB). */
  restoreHabit: (habit: Habit) => void;
  reorderHabits: (orderedIds: string[]) => void;
  setHabitValue: (habitId: string, date: string, value: number) => void;
  incrementHabit: (habitId: string, date: string, delta: number) => void;
  toggleHabit: (habitId: string, date: string) => void;
  skipHabit: (habitId: string, date: string) => void;
  clearLog: (habitId: string, date: string) => void;
  upsertGroup: (group: Group) => void;
  removeGroup: (id: string) => void;
  upsertGoal: (goal: Goal) => void;
  adjustGoalValue: (goalId: string, delta: number) => void;
  removeGoal: (id: string) => void;
  reorderGoals: (orderedIds: string[]) => void;
  /** Undo-delete support: re-inserts a previously deleted goal. */
  restoreGoal: (goal: Goal) => void;
  upsertRoutine: (routine: Routine) => void;
  removeRoutine: (id: string) => void;
  reorderRoutines: (orderedIds: string[]) => void;
  /** Undo-delete support: re-inserts a previously deleted routine. */
  restoreRoutine: (routine: Routine) => void;
  toggleRoutineStep: (routineId: string, stepId: string, date: string) => void;
  upsertBadHabit: (habit: BadHabit) => void;
  removeBadHabit: (id: string) => void;
  reorderTrackers: (orderedIds: string[]) => void;
  /** Undo-delete support: re-inserts a previously deleted quit tracker (history included). */
  restoreBadHabit: (habit: BadHabit) => void;
  recordRelapse: (habitId: string, triggerCategory: string, detailedReason?: string) => void;
  /** Log daily usage for a "limit" strategy habit. Triggers relapse if limit exceeded. */
  logUsage: (habitId: string, value: number) => void;
  /** Undo-relapse support: completely overwrites the tracker with the snapshot
   * captured before the relapse was logged — restoring the quit date, the
   * relapse history and the trigger statistics in one shot. */
  undoLastRelapse: (previousTrackerSnapshot: BadHabit) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleSoundSettings: () => void;
  startTimer: (habitId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (saveMinutes: boolean) => void;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapse: () => void;
  toggleSidebar: () => void;
  adjustTimer: (minutes: number) => void;
  freezeHabitDay: (habitId: string, date: string) => FreezeResult;
  freezeHabit: (habitId: string, date?: string) => FreezeResult;
  toggleFreeze: (habitId: string, date?: string) => FreezeResult;
  /** Monthly freeze quota for a habit: used / max / days until reset. */
  calculateRemainingFreezes: (habitId: string) => FreezeQuota;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
  resetAll: () => Promise<void>;
  setCustomColors: (colors: string[]) => void;
  addCustomIcon: (icon: { id: string; svgContent: string }) => void;
  removeCustomIcon: (id: string) => void;
}

type Store = AppState & AppActions;

const AppContext = createContext<Store | null>(null);

const EMPTY: Snapshot = {
  habits: [],
  habitLogs: [],
  groups: [],
  goals: [],
  routines: [],
  routineLogs: [],
  badHabits: [],
  settings: repo.DEFAULT_SETTINGS,
  timer: null,
  customColors: [],
  customIcons: [],
};

export const PERSIST_CONFIG = {
  name: "cadence-storage",
};

const getInitialCollapsed = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem("cadence-storage");
    if (saved) {
      const parsed = JSON.parse(saved);
      const s = parsed?.state || parsed;
      if (typeof s?.isSidebarCollapsed === "boolean") return s.isSidebarCollapsed;
      if (typeof s?.isCollapsed === "boolean") return s.isCollapsed;
    }
    return localStorage.getItem("cadence_sidebar_collapsed") === "true";
  } catch (e) {
    console.error(e);
  }
  return false;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("cadence-storage");
        if (stored) {
          const parsed = JSON.parse(stored);
          const s = parsed.state || parsed;
          if (s?.settings) {
            return {
              ...EMPTY,
              settings: { ...repo.DEFAULT_SETTINGS, ...s.settings },
            };
          }
        }
      }
    } catch {}
    return EMPTY;
  });
  const [ready, setReady] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getInitialCollapsed);

  const setCollapsed = useCallback((collapsed: boolean | ((prev: boolean) => boolean)) => {
    setIsCollapsed((prev) => {
      const next = typeof collapsed === "function" ? collapsed(prev) : collapsed;
      try {
        localStorage.setItem("cadence_sidebar_collapsed", String(next));
        document.documentElement.classList.toggle("sidebar-collapsed", next);
        if (next) {
          document.documentElement.setAttribute("data-sidebar-collapsed", "true");
        } else {
          document.documentElement.removeAttribute("data-sidebar-collapsed");
        }

        // Sync to cadence-storage
        const raw = localStorage.getItem("cadence-storage");
        let existing: any = {};
        try {
          existing = JSON.parse(raw || "{}");
        } catch {}
        const existingState = existing.state || existing;
        localStorage.setItem(
          "cadence-storage",
          JSON.stringify({
            state: {
              ...existingState,
              isSidebarCollapsed: next,
              isCollapsed: next,
            },
            version: 0,
          }),
        );
      } catch {}
      return next;
    });
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle("sidebar-collapsed", isCollapsed);
        if (isCollapsed) {
          document.documentElement.setAttribute("data-sidebar-collapsed", "true");
        } else {
          document.documentElement.removeAttribute("data-sidebar-collapsed");
        }
      }
    } catch {}
  }, [isCollapsed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await repo.loadSnapshot();
        if (cancelled) return;
        const nextHabits = Array.isArray(snapshot?.habits) ? snapshot.habits : [];
        const nextGroups =
          Array.isArray(snapshot?.groups) && snapshot.groups.length > 0
            ? snapshot.groups
            : DEFAULT_GROUPS;
        if (!snapshot?.groups?.length) {
          await Promise.all(DEFAULT_GROUPS.map((g) => repo.saveGroup(g))).catch(() => {});
        }
        setState({
          habits: nextHabits,
          habitLogs: Array.isArray(snapshot?.habitLogs) ? snapshot.habitLogs : [],
          groups: nextGroups,
          goals: Array.isArray(snapshot?.goals) ? snapshot.goals : [],
          routines: Array.isArray(snapshot?.routines) ? snapshot.routines : [],
          routineLogs: Array.isArray(snapshot?.routineLogs) ? snapshot.routineLogs : [],
          badHabits: Array.isArray(snapshot?.badHabits) ? snapshot.badHabits : [],
          settings: { ...repo.DEFAULT_SETTINGS, ...(snapshot?.settings || {}) },
          timer: snapshot?.timer || null,
          customColors: Array.isArray(snapshot?.customColors) ? snapshot.customColors : [],
          // Restored alongside the rest of the snapshot — without this the
          // uploaded icons would be missing after a reload and habits that use
          // a custom icon id would fall back to the default Lucide glyph.
          customIcons: Array.isArray(snapshot?.customIcons) ? snapshot.customIcons : [],
        });

        // Sync theme to cadence-storage on initial load
        try {
          const currentTheme = snapshot?.settings?.theme || "system";
          const raw = localStorage.getItem("cadence-storage");
          let existing: any = {};
          try {
            existing = JSON.parse(raw || "{}");
          } catch {}
          const existingState = existing.state || existing;
          localStorage.setItem(
            "cadence-storage",
            JSON.stringify({
              state: {
                ...existingState,
                theme: existingState.theme || currentTheme,
                isSidebarCollapsed: isCollapsed,
                isCollapsed: isCollapsed,
              },
              version: 0,
            }),
          );
          if (!localStorage.getItem("theme")) {
            localStorage.setItem("theme", existingState.theme || currentTheme);
          }
        } catch {}
      } catch (err) {
        console.error("Failed to load store snapshot from repository:", err);
        toast.error("Local data could not be loaded. Your existing data was not changed.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logMap = useMemo(() => buildLogMap(state.habitLogs), [state.habitLogs]);

  const writeLog = useCallback(
    (
      habitId: string,
      date: string,
      mutate: (existing: HabitLog | undefined, habit: Habit) => HabitLog | null,
    ) => {
      // Defense-in-depth: never persist logs for future dates. UI controls are
      // disabled for future days, but this guard keeps analytics integrity even
      // if a caller bypasses the UI.
      if (date > todayKey()) return;
      setState((prev) => {
        const habit = prev.habits.find((h) => h.id === habitId);
        if (!habit) return prev;
        const id = logKey(habitId, date);
        const existing = prev.habitLogs.find((l) => l.id === id);
        const next = mutate(existing, habit);

        const wasComplete = existing ? existing.status === "complete" : false;
        const isNowComplete = next ? next.status === "complete" : false;
        if (!wasComplete && isNowComplete) {
          playCompleteHabitSound();
        }

        // Habit -> Routine sync intentionally updates routine logs directly.
        // The Routine -> Habit path also writes directly, so neither direction
        // dispatches the other action and the two paths cannot recurse.
        let routineLogs = prev.routineLogs;
        const linkedRoutines = prev.routines.filter((routine) =>
          routine.steps.some((step) => step.habitId === habitId),
        );
        for (const routine of linkedRoutines) {
          const linkedStepIds = routine.steps
            .filter((step) => step.habitId === habitId)
            .map((step) => step.id);
          const routineLogId = `${routine.id}:${date}`;
          const existingRoutineLog = routineLogs.find((log) => log.id === routineLogId);
          const completedStepIds = new Set(existingRoutineLog?.completedStepIds ?? []);

          for (const stepId of linkedStepIds) {
            if (isNowComplete) completedStepIds.add(stepId);
            else completedStepIds.delete(stepId);
          }

          const nextCompletedStepIds = [...completedStepIds];
          const changed = linkedStepIds.some((stepId) =>
            isNowComplete
              ? !existingRoutineLog?.completedStepIds.includes(stepId)
              : existingRoutineLog?.completedStepIds.includes(stepId),
          );
          if (!changed) continue;

          const nextRoutineLog: RoutineLog = {
            id: routineLogId,
            routineId: routine.id,
            date,
            completedStepIds: nextCompletedStepIds,
            updatedAt: Date.now(),
          };
          void repo.saveRoutineLog(nextRoutineLog);
          routineLogs = existingRoutineLog
            ? routineLogs.map((log) => (log.id === routineLogId ? nextRoutineLog : log))
            : [...routineLogs, nextRoutineLog];
        }

        if (!next) {
          void repo.deleteLog(id);
          return {
            ...prev,
            habitLogs: prev.habitLogs.filter((l) => l.id !== id),
            routineLogs,
          };
        }
        void repo.saveLog(next);
        return {
          ...prev,
          routineLogs,
          habitLogs: existing
            ? prev.habitLogs.map((l) => (l.id === id ? next : l))
            : [...prev.habitLogs, next],
        };
      });
    },
    [],
  );

  const actions = useMemo<AppActions>(() => {
    const makeLog = (habit: Habit, date: string, value: number, existing?: HabitLog): HabitLog => ({
      id: logKey(habit.id, date),
      habitId: habit.id,
      date,
      value,
      // Historical logs keep the target that applied when they were written.
      target: existing?.target ?? habit.target,
      status: value >= (existing?.target ?? habit.target) ? "complete" : "partial",
      updatedAt: Date.now(),
    });

    /**
     * Shared settings applier — used by `updateSettings` and
     * `toggleSoundSettings` (which cannot call `updateSettings` directly
     * because both live in the same object literal being built here).
     */
    const applySettings = (patch: Partial<AppSettings>) => {
      setState((prev) => {
        const settings = { ...prev.settings, ...patch };
        void repo.saveSettings(settings);
        try {
          if (patch.theme) {
            localStorage.setItem("cadence-theme", patch.theme);
            localStorage.setItem("theme", patch.theme);
            const media = window.matchMedia("(prefers-color-scheme: dark)");
            const dark = patch.theme === "dark" || (patch.theme === "system" && media.matches);
            document.documentElement.classList.toggle("dark", dark);
          }

          // Always update localStorage and cadence-storage with latest settings
          const soundVal = settings.isSoundEnabled ?? !(settings.isMuted ?? false);
          localStorage.setItem("isSoundEnabled", String(soundVal));
          localStorage.setItem("isMuted", String(!soundVal));
          localStorage.setItem("cadence_sound_enabled", String(soundVal));

          // Always update cadence-storage with latest settings and state
          const raw = localStorage.getItem("cadence-storage");
          let existing: any = {};
          try {
            existing = JSON.parse(raw || "{}");
          } catch {}
          const existingState = existing.state || existing;
          localStorage.setItem(
            "cadence-storage",
            JSON.stringify({
              state: {
                ...existingState,
                settings,
                theme: settings.theme ?? existingState.theme,
                isSidebarCollapsed: isCollapsed,
                isCollapsed,
              },
              version: 0,
            }),
          );
        } catch {}
        return { ...prev, settings };
      });
    };

    /**
     * Toggle a streak freeze for the given day. Freezing writes a 'frozen'
     * daily log — overriding even a 'completed' day — and honours the habit's
     * monthly freeze budget (default 3). Unfreezing restores the previous
     * completion.
     *
     * PURE: no toasts, sounds or other side effects fire here, and the state
     * merge below is the single side-effect-free `setState` call. React may
     * re-invoke updater functions (which previously caused double toasts), so
     * all notification side effects live in the UI's click handler, driven by
     * the synchronously returned `FreezeResult`.
     */
    const freezeHabitFn = (habitId: string, date?: string): FreezeResult => {
      try {
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit) return buildFreezeFailure("missing", 0, 0);

        const dayKey = date || todayKey();
        // Defense-in-depth: future dates are preview-only, never frozen.
        if (dayKey > todayKey()) {
          toast.info("You cannot log habits for future dates");
          return buildFreezeFailure("missing", 0, 0);
        }
        const monthKey = dayKey.slice(0, 7);

        // Roll the legacy monthly counter forward when the month changes.
        const habitCurrent =
          (habit.lastFreezeResetDate?.slice(0, 7) || monthKey) < monthKey
            ? { ...habit, freezesUsedThisMonth: 0, lastFreezeResetDate: monthKey }
            : habit;

        const frozenDates = Array.isArray(habitCurrent.frozenDates) ? habitCurrent.frozenDates : [];
        const isFrozen = frozenDates.includes(dayKey);
        const max = habitCurrent.freezesAllowedPerMonth ?? DEFAULT_MONTHLY_FREEZE_LIMIT;

        const logId = logKey(habitId, dayKey);
        const existingLog = state.habitLogs.find((l) => l.id === logId);

        // Completed days can't be frozen — the streak is already safe, so
        // nothing is written and the monthly quota is not consumed.
        if (!isFrozen && isCompletedLog(existingLog)) {
          return buildFreezeFailure(
            "already-completed",
            countFrozenDaysThisMonth(habitCurrent, state.habitLogs, monthKey),
            max,
          );
        }

        // Used this calendar month — frozen logs merged with legacy dates.
        const used = countFrozenDaysThisMonth(habitCurrent, state.habitLogs, monthKey);

        // Enforce the monthly budget (unfreezing is always allowed).
        if (!isFrozen && used >= max) {
          return buildFreezeFailure("limit", used, max);
        }

        const nextFrozenDates = isFrozen
          ? frozenDates.filter((d) => d !== dayKey)
          : [...frozenDates, dayKey];
        const updatedHabit: Habit = {
          ...habitCurrent,
          frozenDates: nextFrozenDates,
          freezesUsedThisMonth: isFrozen
            ? Math.max(0, (habitCurrent.freezesUsedThisMonth ?? 0) - 1)
            : (habitCurrent.freezesUsedThisMonth ?? 0) + 1,
          lastFreezeResetDate: monthKey,
        };
        void repo.saveHabit(updatedHabit);

        // Daily log — freezing overrides any existing state (even 'complete');
        // unfreezing restores the previous completion when it still holds.
        let nextLogs = state.habitLogs;
        if (!isFrozen) {
          const frozenLog: HabitLog = {
            id: logId,
            habitId,
            date: dayKey,
            // A completed day keeps its value — the status is what flips.
            value: existingLog?.value ?? 0,
            target: existingLog?.target ?? habit.target,
            status: "frozen",
            updatedAt: Date.now(),
          };
          void repo.saveLog(frozenLog);
          nextLogs = existingLog
            ? state.habitLogs.map((l) => (l.id === logId ? frozenLog : l))
            : [...state.habitLogs, frozenLog];
        } else if (existingLog && existingLog.status === "frozen") {
          if (existingLog.value >= existingLog.target) {
            const restoredLog: HabitLog = {
              ...existingLog,
              status: "complete",
              updatedAt: Date.now(),
            };
            void repo.saveLog(restoredLog);
            nextLogs = state.habitLogs.map((l) => (l.id === logId ? restoredLog : l));
          } else {
            void repo.deleteLog(logId);
            nextLogs = state.habitLogs.filter((l) => l.id !== logId);
          }
        }

        // A running timer for this habit can't continue through a freeze.
        const stoppedTimer = !isFrozen && state.timer?.habitId === habitId;
        if (stoppedTimer) {
          void repo.clearTimer();
        }

        // Single pure state merge — every toast/sound happens in the UI.
        setState((prev) => ({
          ...prev,
          timer: stoppedTimer ? null : prev.timer,
          habits: prev.habits.map((h) => (h.id === habitId ? updatedHabit : h)),
          habitLogs: nextLogs,
        }));

        return {
          ok: true,
          frozen: !isFrozen,
          used: isFrozen ? Math.max(0, used - 1) : Math.min(used + 1, max),
          max,
          daysUntilReset: daysUntilMonthlyReset(),
          ...(habit.name ? { habitName: habit.name } : {}),
          ...(stoppedTimer ? { stoppedTimer: true } : {}),
        };
      } catch (error) {
        console.error("Unexpected error in freezeHabit:", error);
        toast.error("Failed to update streak freeze");
        return buildFreezeFailure("missing", 0, 0);
      }
    };

    return {
      createHabit(input) {
        const habit: Habit = {
          ...input,
          id: uid(),
          archived: false,
          order: Date.now(),
          createdAt: Date.now(),
          /** ISO timestamp initialized on creation for sync metadata. */
          updatedAt: new Date().toISOString(),
          freezesAllowedPerMonth: input.freezesAllowedPerMonth ?? DEFAULT_MONTHLY_FREEZE_LIMIT,
          freezesUsedThisMonth: input.freezesUsedThisMonth ?? 0,
          frozenDates: input.frozenDates ?? [],
          lastFreezeResetDate: input.lastFreezeResetDate ?? todayKey().slice(0, 7),
        };
        void repo.saveHabit(habit);
        setState((prev) => ({ ...prev, habits: [...prev.habits, habit] }));
        return habit;
      },
      freezeHabitDay(habitId, date) {
        return freezeHabitFn(habitId, date);
      },
      freezeHabit(habitId, date) {
        return freezeHabitFn(habitId, date);
      },
      toggleFreeze(habitId, date) {
        return freezeHabitFn(habitId, date);
      },
      calculateRemainingFreezes(habitId) {
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit) {
          return {
            used: 0,
            max: DEFAULT_MONTHLY_FREEZE_LIMIT,
            daysUntilReset: daysUntilMonthlyReset(),
          };
        }
        return {
          used: countFrozenDaysThisMonth(habit, state.habitLogs, todayKey().slice(0, 7)),
          max: habit.freezesAllowedPerMonth ?? DEFAULT_MONTHLY_FREEZE_LIMIT,
          daysUntilReset: daysUntilMonthlyReset(),
        };
      },
      updateHabit(habit) {
        void repo.saveHabit(habit);
        setState((prev) => ({
          ...prev,
          habits: prev.habits.map((h) => (h.id === habit.id ? habit : h)),
        }));
      },
      archiveHabit(id, archived) {
        setState((prev) => {
          const habits = prev.habits.map((h) => (h.id === id ? { ...h, archived } : h));
          const changed = habits.find((h) => h.id === id);
          if (changed) void repo.saveHabit(changed);
          return { ...prev, habits };
        });
      },
      removeHabit(id) {
        void repo.deleteHabit(id);
        setState((prev) => {
          const habits = prev.habits.filter((h) => h.id !== id);
          const goals = prev.goals.map((g) => {
            if (!g.habitIds.includes(id)) return g;
            const nextGoal = { ...g, habitIds: g.habitIds.filter((hid) => hid !== id) };
            void repo.saveGoal(nextGoal);
            return nextGoal;
          });
          const routines = prev.routines.map((r) => {
            if (!r.steps.some((s) => s.habitId === id)) return r;
            const nextRoutine = {
              ...r,
              steps: r.steps.map((s) => (s.habitId === id ? { ...s, habitId: undefined } : s)),
            };
            void repo.saveRoutine(nextRoutine);
            return nextRoutine;
          });
          return { ...prev, habits, goals, routines };
        });
      },
      restoreHabit(habit) {
        // A deleted habit's daily logs were never removed (only the habit
        // record itself), so pushing the original object back restores the
        // full history. Idempotent: re-adding an id that already exists is a
        // no-op replacement, which guards against a double-clicked Undo.
        void repo.saveHabit(habit);
        setState((prev) => {
          const goals = habit.goalId
            ? prev.goals.map((goal) => {
                if (goal.id !== habit.goalId || goal.habitIds.includes(habit.id)) return goal;
                const updatedGoal = { ...goal, habitIds: [...goal.habitIds, habit.id] };
                void repo.saveGoal(updatedGoal);
                return updatedGoal;
              })
            : prev.goals;
          return {
            ...prev,
            goals,
            habits: prev.habits.some((h) => h.id === habit.id)
              ? prev.habits.map((h) => (h.id === habit.id ? habit : h))
              : [...prev.habits, habit],
          };
        });
      },
      reorderHabits(orderedIds) {
        setState((prev) => {
          const habits = prev.habits.map((h) => {
            const index = orderedIds.indexOf(h.id);
            return index === -1 ? h : { ...h, order: index };
          });
          void repo.saveHabits(habits);
          return { ...prev, habits };
        });
      },
      setHabitValue(habitId, date, value) {
        writeLog(habitId, date, (existing, habit) =>
          makeLog(habit, date, Math.max(0, value), existing),
        );
      },
      incrementHabit(habitId, date, delta) {
        writeLog(habitId, date, (existing, habit) =>
          makeLog(habit, date, Math.max(0, (existing?.value ?? 0) + delta), existing),
        );
      },
      toggleHabit(habitId, date) {
        writeLog(habitId, date, (existing, habit) => {
          const target = existing?.target ?? habit.target;
          const done = existing ? existing.status === "skipped" || existing.value >= target : false;
          if (done) return null;
          return makeLog(habit, date, target, existing);
        });
      },
      skipHabit(habitId, date) {
        writeLog(habitId, date, (existing, habit) => ({
          id: logKey(habit.id, date),
          habitId: habit.id,
          date,
          value: existing?.value ?? 0,
          target: existing?.target ?? habit.target,
          status: "skipped",
          updatedAt: Date.now(),
        }));
      },
      clearLog(habitId, date) {
        writeLog(habitId, date, () => null);
      },
      upsertGroup(group) {
        void repo.saveGroup(group);
        setState((prev) => ({
          ...prev,
          groups: prev.groups.some((g) => g.id === group.id)
            ? prev.groups.map((g) => (g.id === group.id ? group : g))
            : [...prev.groups, group],
        }));
      },
      removeGroup(id) {
        void repo.deleteGroup(id);
        setState((prev) => ({ ...prev, groups: prev.groups.filter((g) => g.id !== id) }));
      },
      upsertGoal(goal) {
        void repo.saveGoal(goal);
        setState((prev) => {
          const selectedHabitIds = new Set(goal.habitIds);
          const goals = prev.goals
            .map((existingGoal) => {
              if (existingGoal.id === goal.id) return goal;
              const nextHabitIds = existingGoal.habitIds.filter(
                (habitId) => !selectedHabitIds.has(habitId),
              );
              if (nextHabitIds.length === existingGoal.habitIds.length) return existingGoal;
              const updatedGoal = { ...existingGoal, habitIds: nextHabitIds };
              void repo.saveGoal(updatedGoal);
              return updatedGoal;
            })
            .concat(prev.goals.some((existingGoal) => existingGoal.id === goal.id) ? [] : [goal]);

          const habits = prev.habits.map((habit) => {
            const shouldLink = selectedHabitIds.has(habit.id);
            const wasLinkedToThisGoal = habit.goalId === goal.id;
            if (shouldLink && habit.goalId !== goal.id) {
              const updatedHabit = { ...habit, goalId: goal.id };
              void repo.saveHabit(updatedHabit);
              return updatedHabit;
            }
            if (!shouldLink && wasLinkedToThisGoal) {
              const updatedHabit = { ...habit, goalId: undefined };
              void repo.saveHabit(updatedHabit);
              return updatedHabit;
            }
            return habit;
          });

          return { ...prev, goals, habits };
        });
      },
      adjustGoalValue(goalId, delta) {
        setState((prev) => {
          const goal = prev.goals.find((item) => item.id === goalId);
          if (!goal || goal.type !== "numeric") return prev;
          const currentValue = Math.min(
            goal.targetValue,
            Math.max(0, (goal.currentValue ?? 0) + delta),
          );
          const updated = { ...goal, currentValue };
          void repo.saveGoal(updated);
          return {
            ...prev,
            goals: prev.goals.map((item) => (item.id === goalId ? updated : item)),
          };
        });
      },
      removeGoal(id) {
        void repo.deleteGoal(id);
        setState((prev) => {
          const habits = prev.habits.map((habit) => {
            if (habit.goalId !== id) return habit;
            const updatedHabit = { ...habit, goalId: undefined };
            void repo.saveHabit(updatedHabit);
            return updatedHabit;
          });
          return { ...prev, habits, goals: prev.goals.filter((g) => g.id !== id) };
        });
      },
      restoreGoal(goal) {
        void repo.saveGoal(goal);
        setState((prev) => {
          const selectedHabitIds = new Set(goal.habitIds);
          const goals = prev.goals
            .map((existingGoal) => {
              if (existingGoal.id === goal.id) return goal;
              const nextHabitIds = existingGoal.habitIds.filter(
                (habitId) => !selectedHabitIds.has(habitId),
              );
              if (nextHabitIds.length === existingGoal.habitIds.length) return existingGoal;
              const updatedGoal = { ...existingGoal, habitIds: nextHabitIds };
              void repo.saveGoal(updatedGoal);
              return updatedGoal;
            })
            .concat(prev.goals.some((existingGoal) => existingGoal.id === goal.id) ? [] : [goal]);
          const habits = prev.habits.map((habit) => {
            if (!selectedHabitIds.has(habit.id)) return habit;
            const updatedHabit = { ...habit, goalId: goal.id };
            void repo.saveHabit(updatedHabit);
            return updatedHabit;
          });
          return { ...prev, goals, habits };
        });
      },
      reorderGoals(orderedIds) {
        setState((prev) => {
          const goals = prev.goals.map((goal) => {
            const index = orderedIds.indexOf(goal.id);
            return index === -1 ? goal : { ...goal, order: index };
          });
          void Promise.all(goals.map((goal) => repo.saveGoal(goal)));
          return { ...prev, goals };
        });
      },
      upsertRoutine(routine) {
        void repo.saveRoutine(routine);
        setState((prev) => ({
          ...prev,
          routines: prev.routines.some((r) => r.id === routine.id)
            ? prev.routines.map((r) => (r.id === routine.id ? routine : r))
            : [...prev.routines, routine],
        }));
      },
      removeRoutine(id) {
        void repo.deleteRoutine(id);
        setState((prev) => ({ ...prev, routines: prev.routines.filter((r) => r.id !== id) }));
      },
      restoreRoutine(routine) {
        void repo.saveRoutine(routine);
        setState((prev) => ({
          ...prev,
          routines: prev.routines.some((r) => r.id === routine.id)
            ? prev.routines.map((r) => (r.id === routine.id ? routine : r))
            : [...prev.routines, routine],
        }));
      },
      reorderRoutines(orderedIds) {
        setState((prev) => {
          const routines = prev.routines.map((routine) => {
            const index = orderedIds.indexOf(routine.id);
            return index === -1 ? routine : { ...routine, order: index };
          });
          void Promise.all(routines.map((routine) => repo.saveRoutine(routine)));
          return { ...prev, routines };
        });
      },
      toggleRoutineStep(routineId, stepId, date) {
        setState((prev) => {
          const routine = prev.routines.find((item) => item.id === routineId);
          const step = routine?.steps.find((item) => item.id === stepId);
          if (!step) return prev;

          const id = `${routineId}:${date}`;
          const existing = prev.routineLogs.find((l) => l.id === id);
          const completed = existing?.completedStepIds ?? [];
          const wasCompleted = completed.includes(stepId);
          const next: RoutineLog = {
            id,
            routineId,
            date,
            completedStepIds: wasCompleted
              ? completed.filter((s) => s !== stepId)
              : [...completed, stepId],
            updatedAt: Date.now(),
          };
          void repo.saveRoutineLog(next);

          let habitLogs = prev.habitLogs;
          let routineLogs = existing
            ? prev.routineLogs.map((l) => (l.id === id ? next : l))
            : [...prev.routineLogs, next];
          if (step.habitId) {
            const habit = prev.habits.find((item) => item.id === step.habitId);
            if (habit) {
              const habitLogId = logKey(habit.id, date);
              const existingHabitLog = prev.habitLogs.find((log) => log.id === habitLogId);

              if (wasCompleted) {
                void repo.deleteLog(habitLogId);
                habitLogs = prev.habitLogs.filter((log) => log.id !== habitLogId);
              } else {
                const completedHabitLog: HabitLog = {
                  id: habitLogId,
                  habitId: habit.id,
                  date,
                  value: existingHabitLog?.target ?? habit.target,
                  target: existingHabitLog?.target ?? habit.target,
                  status: "complete",
                  updatedAt: Date.now(),
                };
                void repo.saveLog(completedHabitLog);
                habitLogs = existingHabitLog
                  ? prev.habitLogs.map((log) => (log.id === habitLogId ? completedHabitLog : log))
                  : [...prev.habitLogs, completedHabitLog];
              }

              // A habit may be used by multiple routines. Keep every linked
              // step on the same date aligned with the canonical habit log.
              for (const linkedRoutine of prev.routines) {
                if (linkedRoutine.id === routineId) continue;
                const linkedStepIds = linkedRoutine.steps
                  .filter((linkedStep) => linkedStep.habitId === habit.id)
                  .map((linkedStep) => linkedStep.id);
                if (linkedStepIds.length === 0) continue;
                const linkedLogId = `${linkedRoutine.id}:${date}`;
                const existingLinkedLog = routineLogs.find((log) => log.id === linkedLogId);
                const completedStepIds = new Set(existingLinkedLog?.completedStepIds ?? []);
                for (const linkedStepId of linkedStepIds) {
                  if (wasCompleted) completedStepIds.delete(linkedStepId);
                  else completedStepIds.add(linkedStepId);
                }
                const linkedLog: RoutineLog = {
                  id: linkedLogId,
                  routineId: linkedRoutine.id,
                  date,
                  completedStepIds: [...completedStepIds],
                  updatedAt: Date.now(),
                };
                void repo.saveRoutineLog(linkedLog);
                routineLogs = existingLinkedLog
                  ? routineLogs.map((log) => (log.id === linkedLogId ? linkedLog : log))
                  : [...routineLogs, linkedLog];
              }
            }
          }

          return {
            ...prev,
            habitLogs,
            routineLogs,
          };
        });
      },
      toggleSoundSettings() {
        const current = state.settings.isSoundEnabled ?? !(state.settings.isMuted ?? false);
        applySettings({
          isSoundEnabled: !current,
          isMuted: !!current,
        });
      },

      updateSettings(patch) {
        applySettings(patch);
      },
      startTimer(habitId) {
        const timer: TimerState = { id: "timer", habitId, startedAt: Date.now(), accumulatedMs: 0 };
        void repo.saveTimer(timer);
        setState((prev) => ({ ...prev, timer }));
      },
      pauseTimer() {
        setState((prev) => {
          if (!prev.timer?.startedAt) return prev;
          const timer: TimerState = {
            ...prev.timer,
            accumulatedMs: prev.timer.accumulatedMs + (Date.now() - prev.timer.startedAt),
            startedAt: null,
          };
          void repo.saveTimer(timer);
          return { ...prev, timer };
        });
      },
      resumeTimer() {
        setState((prev) => {
          if (!prev.timer || prev.timer.startedAt) return prev;
          const timer: TimerState = { ...prev.timer, startedAt: Date.now() };
          void repo.saveTimer(timer);
          return { ...prev, timer };
        });
      },
      stopTimer(saveMinutes) {
        setState((prev) => {
          const timer = prev.timer;
          if (!timer) return prev;
          void repo.clearTimer();
          if (!saveMinutes) return { ...prev, timer: null };
          const elapsed =
            timer.accumulatedMs + (timer.startedAt ? Date.now() - timer.startedAt : 0);
          const minutes = Math.round(elapsed / 60000);
          const habit = prev.habits.find((h) => h.id === timer.habitId);
          if (!habit || minutes <= 0) return { ...prev, timer: null };
          const date = todayKey();
          const id = logKey(habit.id, date);
          const existing = prev.habitLogs.find((l) => l.id === id);
          const target = existing?.target ?? habit.target;
          const value = (existing?.value ?? 0) + minutes;
          const status = value >= target ? "complete" : "partial";
          const wasComplete = existing ? existing.status === "complete" : false;
          const isNowComplete = status === "complete";
          if (!wasComplete && isNowComplete) {
            playCompleteHabitSound();
          }
          const log: HabitLog = {
            id,
            habitId: habit.id,
            date,
            value,
            target,
            status,
            updatedAt: Date.now(),
          };
          void repo.saveLog(log);
          let routineLogs = prev.routineLogs;
          for (const routine of prev.routines) {
            const linkedStepIds = routine.steps
              .filter((step) => step.habitId === habit.id)
              .map((step) => step.id);
            if (linkedStepIds.length === 0) continue;
            const routineLogId = `${routine.id}:${date}`;
            const existingRoutineLog = routineLogs.find((item) => item.id === routineLogId);
            const completedStepIds = new Set(existingRoutineLog?.completedStepIds ?? []);
            for (const stepId of linkedStepIds) completedStepIds.add(stepId);
            const nextRoutineLog: RoutineLog = {
              id: routineLogId,
              routineId: routine.id,
              date,
              completedStepIds: [...completedStepIds],
              updatedAt: Date.now(),
            };
            void repo.saveRoutineLog(nextRoutineLog);
            routineLogs = existingRoutineLog
              ? routineLogs.map((item) => (item.id === routineLogId ? nextRoutineLog : item))
              : [...routineLogs, nextRoutineLog];
          }
          return {
            ...prev,
            timer: null,
            routineLogs,
            habitLogs: existing
              ? prev.habitLogs.map((l) => (l.id === id ? log : l))
              : [...prev.habitLogs, log],
          };
        });
      },
      adjustTimer(minutes) {
        setState((prev) => {
          if (!prev.timer) return prev;
          const timer: TimerState = {
            ...prev.timer,
            accumulatedMs: Math.max(0, prev.timer.accumulatedMs + minutes * 60000),
          };
          void repo.saveTimer(timer);
          return { ...prev, timer };
        });
      },

      upsertBadHabit(habit) {
        void repo.saveBadHabit(habit);
        setState((prev) => {
          const exists = prev.badHabits.some((h) => h.id === habit.id);
          return {
            ...prev,
            badHabits: exists
              ? prev.badHabits.map((h) => (h.id === habit.id ? habit : h))
              : [...prev.badHabits, habit],
          };
        });
      },
      removeBadHabit(id) {
        void repo.deleteBadHabit(id);
        setState((prev) => ({
          ...prev,
          badHabits: prev.badHabits.filter((h) => h.id !== id),
        }));
      },
      restoreBadHabit(habit) {
        // The relapse history lives inside the BadHabit object itself, so
        // restoring the captured snapshot brings the streak history back too.
        void repo.saveBadHabit(habit);
        setState((prev) => ({
          ...prev,
          badHabits: prev.badHabits.some((h) => h.id === habit.id)
            ? prev.badHabits.map((h) => (h.id === habit.id ? habit : h))
            : [...prev.badHabits, habit],
        }));
      },
      reorderTrackers(orderedIds) {
        setState((prev) => {
          const badHabits = prev.badHabits.map((habit) => {
            const index = orderedIds.indexOf(habit.id);
            return index === -1 ? habit : { ...habit, order: index };
          });
          void Promise.all(badHabits.map((habit) => repo.saveBadHabit(habit)));
          return { ...prev, badHabits };
        });
      },
      recordRelapse(habitId, triggerCategory, detailedReason) {
        setState((prev) => {
          const habit = prev.badHabits.find((h) => h.id === habitId);
          if (!habit) return prev;
          const now = Date.now();
          const streakDurationHours = Math.max(
            0,
            Math.floor((now - habit.quitDate) / (1000 * 60 * 60)),
          );
          const relapseRecord = {
            id: uid(),
            relapsedAt: now,
            triggerCategory,
            detailedReason: detailedReason?.trim() || undefined,
            streakDurationHours,
            /** ISO timestamp of when this relapse record was created. */
            updatedAt: new Date().toISOString(),
          };
          const updated: BadHabit = {
            ...habit,
            quitDate: now,
            history: [relapseRecord, ...habit.history],
          };
          void repo.saveBadHabit(updated);
          return {
            ...prev,
            badHabits: prev.badHabits.map((h) => (h.id === habitId ? updated : h)),
          };
        });
      },

      /**
       * Log daily usage for a "limit" strategy bad habit.
       * If the logged value exceeds the limitValue, a relapse is triggered
       * (quit date resets and a relapse record is added).
       */
      logUsage(habitId, value) {
        setState((prev) => {
          const habit = prev.badHabits.find((h) => h.id === habitId);
          if (!habit || habit.strategy !== "limit") return prev;

          const today = todayKey();
          const existingLogs = habit.usageLogs ?? [];
          const todayLog = existingLogs.find((log) => log.date === today);
          const todayTotal = todayLog ? todayLog.value + value : value;

          // Check if this usage exceeds the limit
          const limitValue = habit.limitValue ?? 0;
          const exceedsLimit = todayTotal > limitValue;

          const newLog: UsageLog = {
            id: uid(),
            date: today,
            value,
            updatedAt: Date.now(),
          };

          const updatedLogs = todayLog
            ? existingLogs.map((log) => (log.date === today ? { ...log, value: todayTotal } : log))
            : [...existingLogs, newLog];

          const updated: BadHabit = {
            ...habit,
            usageLogs: updatedLogs,
          };

          // If limit exceeded, trigger a relapse
          if (exceedsLimit) {
            const now = Date.now();
            const streakDurationHours = Math.max(
              0,
              Math.floor((now - habit.quitDate) / (1000 * 60 * 60)),
            );
            const relapseRecord = {
              id: uid(),
              relapsedAt: now,
              triggerCategory: "limit-exceeded",
              detailedReason: `${habit.limitType === "time" ? "minutes" : "units"} exceeded daily limit (${todayTotal}/${limitValue})`,
              streakDurationHours,
              updatedAt: new Date().toISOString(),
            };
            updated.quitDate = now;
            updated.history = [relapseRecord, ...updated.history];
          }

          void repo.saveBadHabit(updated);
          return {
            ...prev,
            badHabits: prev.badHabits.map((h) => (h.id === habitId ? updated : h)),
          };
        });
      },

      undoLastRelapse(previousTrackerSnapshot) {
        // A relapse doesn't just reset the date — it also prepends a
        // RelapseRecord (trigger + reason + streak length) to `history`,
        // which alters the calculated trigger percentages. Partially
        // reverting (e.g. only restoring quitDate) would leave corrupted
        // statistics, so we find the tracker by ID and completely overwrite
        // it with the pre-relapse snapshot instead.
        void repo.saveBadHabit(previousTrackerSnapshot);
        setState((prev) => {
          const exists = prev.badHabits.some((h) => h.id === previousTrackerSnapshot.id);
          return {
            ...prev,
            badHabits: exists
              ? prev.badHabits.map((h) =>
                  h.id === previousTrackerSnapshot.id ? previousTrackerSnapshot : h,
                )
              : // Defensive fallback: the tracker was deleted after the
                // relapse (and the delete wasn't undone) — re-insert it so the
                // undo still brings the whole tracker back.
                [...prev.badHabits, previousTrackerSnapshot],
          };
        });
      },
      exportData() {
        return JSON.stringify(
          {
            habits: state.habits,
            habitLogs: state.habitLogs,
            groups: state.groups,
            goals: state.goals,
            routines: state.routines,
            routineLogs: state.routineLogs,
            badHabits: state.badHabits,
            settings: state.settings,
            customColors: state.customColors,
            customIcons: state.customIcons,
          },
          null,
          2,
        );
      },
      async importData(json) {
        const parsed: unknown = JSON.parse(json);
        await repo.importSnapshot(parsed);
        const snapshot = await repo.loadSnapshot();
        setState(snapshot);
      },
      setCollapsed,
      toggleCollapse,
      toggleSidebar: toggleCollapse,
      async resetAll() {
        await repo.wipeAll();
        await Promise.all(DEFAULT_GROUPS.map((g) => repo.saveGroup(g)));
        setState({ ...EMPTY, groups: DEFAULT_GROUPS });
      },
      setCustomColors(colors: string[]) {
        void repo.saveCustomColors(colors);
        setState((prev) => ({ ...prev, customColors: colors }));
      },
      addCustomIcon(icon: { id: string; svgContent: string }) {
        const updated = Array.isArray(state.customIcons) ? [...state.customIcons, icon] : [icon];
        void repo.saveCustomIcons(updated);
        setState((prev) => ({ ...prev, customIcons: updated }));
      },
      removeCustomIcon(id: string) {
        const updated = Array.isArray(state.customIcons)
          ? state.customIcons.filter((i) => i.id !== id)
          : [];
        void repo.saveCustomIcons(updated);
        setState((prev) => ({ ...prev, customIcons: updated }));
      },
    };
  }, [writeLog, state, setCollapsed, toggleCollapse]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      habits: Array.isArray(state.habits) ? state.habits : [],
      habitLogs: Array.isArray(state.habitLogs) ? state.habitLogs : [],
      groups: Array.isArray(state.groups) ? state.groups : DEFAULT_GROUPS,
      goals: Array.isArray(state.goals) ? state.goals : [],
      routines: Array.isArray(state.routines) ? state.routines : [],
      routineLogs: Array.isArray(state.routineLogs) ? state.routineLogs : [],
      badHabits: Array.isArray(state.badHabits) ? state.badHabits : [],
      settings: state.settings || repo.DEFAULT_SETTINGS,
      timer: state.timer || null,
      activeTimer: state.timer || null,
      customColors: Array.isArray(state.customColors) ? state.customColors : [],
      customIcons: Array.isArray(state.customIcons) ? state.customIcons : [],
      ready,
      logMap,
      isSidebarCollapsed: isCollapsed,
      isCollapsed,
      collapsed: isCollapsed,
      ...actions,
    }),
    [state, ready, logMap, isCollapsed, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export const useAppStore = useApp;

export type { Goal, Group, Habit, HabitLog, Routine };
