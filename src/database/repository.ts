import type {
  AppSettings,
  BadHabit,
  CustomIcon,
  Goal,
  Group,
  Habit,
  HabitLog,
  Routine,
  RoutineLog,
  TimerState,
} from "@/types";
import { clearStore, getAll, getOne, put, putMany, remove } from "./idb";
import { todayKey } from "@/services/dates";

export interface Snapshot {
  habits: Habit[];
  habitLogs: HabitLog[];
  groups: Group[];
  goals: Goal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  badHabits: BadHabit[];
  settings: AppSettings;
  timer: TimerState | null;
  customColors: string[]; // Custom HEX colors for habits
  customIcons: CustomIcon[]; // Custom SVG icons for habits
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  theme: "system",
  language: "en",
  weekStartsOn: 1,
  notificationsEnabled: false,
  remindersEnabled: false,
  onboarded: false,
  isSoundEnabled: true,
  soundEnabled: true,
  isMuted: false,
};

export async function loadSnapshot(): Promise<Snapshot> {
  const [
    habitsRaw,
    habitLogs,
    groups,
    goalsRaw,
    routines,
    routineLogs,
    badHabits,
    settings,
    timer,
    customColors,
    customIcons,
  ] = await Promise.all([
    getAll<Habit>("habits"),
    getAll<HabitLog>("habitLogs"),
    getAll<Group>("groups"),
    getAll<Goal>("goals"),
    getAll<Routine>("routines"),
    getAll<RoutineLog>("routineLogs"),
    getAll<BadHabit>("badHabits"),
    getOne<AppSettings>("meta", "settings"),
    getOne<TimerState>("meta", "timer"),
    getOne<{ customColors: string[] }>("meta", "customColors"),
    getOne<{ customIcons: CustomIcon[] }>("meta", "customIcons"),
  ]);

  const habits = habitsRaw.map((h) => ({
    ...h,
    reminderTimes:
      Array.isArray(h.reminderTimes) && h.reminderTimes.length > 0
        ? h.reminderTimes
        : h.reminder
          ? [h.reminder]
          : [],
    // Monthly freeze budget — defaults to 3 when a habit predates the feature
    // or was created without an explicit limit.
    freezesAllowedPerMonth: h.freezesAllowedPerMonth ?? 3,
    freezesUsedThisMonth: h.freezesUsedThisMonth ?? 0,
    frozenDates: h.frozenDates ?? [],
    lastFreezeResetDate: h.lastFreezeResetDate ?? todayKey().slice(0, 7),
  }));

  const goals = goalsRaw.map((goal) => ({
    ...goal,
    type: goal.type ?? (goal.targetValue !== undefined ? "numeric" : "habit_milestone"),
    targetValue: goal.targetValue ?? 1,
    currentValue: goal.currentValue ?? 0,
    unit: goal.unit ?? "completions",
  }));

  const storedSettings = settings ?? {};
  return {
    habits,
    habitLogs,
    groups,
    goals,
    routines,
    routineLogs,
    badHabits,
    settings: {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      notificationsEnabled:
        storedSettings.notificationsEnabled ?? storedSettings.remindersEnabled ?? false,
    },
    timer: timer ?? null,
    customColors: Array.isArray(customColors?.customColors) ? customColors.customColors : [],
    customIcons: Array.isArray(customIcons?.customIcons) ? customIcons.customIcons : [],
  };
}

export const saveHabit = (habit: Habit) => put("habits", habit);
export const saveHabits = (habits: Habit[]) => putMany("habits", habits);
export const deleteHabit = (id: string) => remove("habits", id);

export const saveLog = (log: HabitLog) => put("habitLogs", log);
export const deleteLog = (id: string) => remove("habitLogs", id);

export const saveGroup = (group: Group) => put("groups", group);
export const deleteGroup = (id: string) => remove("groups", id);

export const saveGoal = (goal: Goal) => put("goals", goal);
export const deleteGoal = (id: string) => remove("goals", id);

export const saveRoutine = (routine: Routine) => put("routines", routine);
export const deleteRoutine = (id: string) => remove("routines", id);
export const saveRoutineLog = (log: RoutineLog) => put("routineLogs", log);

export const saveBadHabit = (habit: BadHabit) => put("badHabits", habit);
export const deleteBadHabit = (id: string) => remove("badHabits", id);

export const saveSettings = (settings: AppSettings) => put("meta", settings);
export const saveTimer = (timer: TimerState) => put("meta", timer);
export const clearTimer = () => remove("meta", "timer");
export const saveCustomColors = (customColors: string[]) =>
  put("meta", { id: "customColors", customColors });
export const saveCustomIcons = (customIcons: CustomIcon[]) =>
  put("meta", { id: "customIcons", customIcons });

export async function wipeAll(): Promise<void> {
  await Promise.all([
    clearStore("habits"),
    clearStore("habitLogs"),
    clearStore("groups"),
    clearStore("goals"),
    clearStore("routines"),
    clearStore("routineLogs"),
    clearStore("badHabits"),
    clearStore("meta"),
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is Array<{ id: string }> {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.id === "string" && item.id.length > 0)
  );
}

function validateImportSnapshot(data: unknown): asserts data is Partial<Snapshot> {
  if (!isRecord(data)) {
    throw new Error("Backup must contain a JSON object");
  }

  const requiredArrays = [
    "habits",
    "habitLogs",
    "groups",
    "goals",
    "routines",
    "routineLogs",
    "badHabits",
  ] as const;

  for (const key of requiredArrays) {
    if (!isRecordArray(data[key])) {
      throw new Error(`Backup field '${key}' must be an array of records`);
    }
  }

  if (data.settings !== undefined && !isRecord(data.settings)) {
    throw new Error("Backup field 'settings' must be an object");
  }
  if (data.customColors !== undefined && !Array.isArray(data.customColors)) {
    throw new Error("Backup field 'customColors' must be an array");
  }
  if (data.customIcons !== undefined && !isRecordArray(data.customIcons)) {
    throw new Error("Backup field 'customIcons' must be an array of records");
  }
}

export async function importSnapshot(data: unknown): Promise<void> {
  validateImportSnapshot(data);
  const previous = await loadSnapshot();
  try {
    await wipeAll();
    await Promise.all([
      putMany("habits", data.habits ?? []),
      putMany("habitLogs", data.habitLogs ?? []),
      putMany("groups", data.groups ?? []),
      putMany("goals", data.goals ?? []),
      putMany("routines", data.routines ?? []),
      putMany("routineLogs", data.routineLogs ?? []),
      putMany("badHabits", data.badHabits ?? []),
      put("meta", { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }),
      put("meta", { id: "customColors", customColors: data.customColors ?? [] }),
      put("meta", { id: "customIcons", customIcons: data.customIcons ?? [] }),
    ]);
  } catch (error) {
    // Restore the previous snapshot when any store write fails. IndexedDB
    // transactions are atomic per store, not across this multi-store import.
    try {
      await wipeAll();
      await Promise.all([
        putMany("habits", previous.habits),
        putMany("habitLogs", previous.habitLogs),
        putMany("groups", previous.groups),
        putMany("goals", previous.goals),
        putMany("routines", previous.routines),
        putMany("routineLogs", previous.routineLogs),
        putMany("badHabits", previous.badHabits),
        put("meta", previous.settings),
        ...(previous.timer ? [put("meta", previous.timer)] : []),
        put("meta", { id: "customColors", customColors: previous.customColors }),
        put("meta", { id: "customIcons", customIcons: previous.customIcons }),
      ]);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], "Import failed and backup restore failed");
    }
    throw error;
  }
}
