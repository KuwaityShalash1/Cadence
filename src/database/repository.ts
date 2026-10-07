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
import { sanitizeSvgIcon } from "@/components/icon-map";

export interface SyncableRecord {
  id: string;
  pending_sync?: boolean;
  synced?: boolean;
  __syncUpdatedAt?: string;
  updatedAt?: number | string;
  [key: string]: unknown;
}

export interface SyncRecord {
  store: string;
  id: string;
  data: SyncableRecord | null;
  updatedAt: string;
  deleted: boolean;
}

const SYNC_TOMBSTONES_ID = "sync-tombstones";

export interface TombstoneEntry {
  updatedAt: string;
  pending_sync: boolean;
}

type Tombstones = {
  id: typeof SYNC_TOMBSTONES_ID;
  values: Record<string, TombstoneEntry | string>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function markForSync<T extends { id: string }>(
  value: T,
): T & { __syncUpdatedAt: string; synced: boolean; pending_sync: boolean } {
  return { ...value, __syncUpdatedAt: nowIso(), synced: false, pending_sync: true };
}

function saveLocalFallback<T extends { id: string }>(store: string, item: T): void {
  if (typeof localStorage === "undefined") return;
  try {
    const key = `cadence_fallback_${store}`;
    const raw = localStorage.getItem(key);
    const list: T[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    console.error(`Failed to save fallback in localStorage for ${store}:`, err);
  }
}

function write<T extends { id: string }>(
  store: Parameters<typeof put>[0],
  value: T,
): Promise<void> {
  const marked = markForSync(value);
  return put(store, marked)
    .catch((err) => {
      console.warn(`IndexedDB write error for ${store}:${value.id}, saving fallback:`, err);
      saveLocalFallback(store, marked);
    })
    .then(() => {
      void import("@/lib/sync")
        .then(({ pushPendingRecords }) => pushPendingRecords())
        .catch((error: unknown) => {
          // Mutation is preserved locally with pending_sync: true
          console.warn("Background sync push deferred or failed:", error);
        });
    });
}

function writeMany<T extends { id: string }>(
  store: Parameters<typeof putMany>[0],
  values: T[],
): Promise<void> {
  const markedValues = values.map(markForSync);
  return putMany(store, markedValues)
    .catch((err) => {
      console.warn(`IndexedDB writeMany error for ${store}, saving fallback:`, err);
      for (const v of markedValues) saveLocalFallback(store, v);
    })
    .then(() => {
      void import("@/lib/sync")
        .then(({ pushPendingRecords }) => pushPendingRecords())
        .catch((error: unknown) => {
          console.warn("Background sync push deferred or failed:", error);
        });
    });
}

async function recordTombstone(store: string, id: string): Promise<void> {
  const existing = (await getOne<Tombstones>("meta", SYNC_TOMBSTONES_ID)) ?? {
    id: SYNC_TOMBSTONES_ID,
    values: {},
  };
  await put("meta", {
    id: SYNC_TOMBSTONES_ID,
    values: {
      ...existing.values,
      [`${store}:${id}`]: { updatedAt: nowIso(), pending_sync: true },
    },
  });
}

export async function clearTombstone(store: string, id: string): Promise<void> {
  try {
    const existing = await getOne<Tombstones>("meta", SYNC_TOMBSTONES_ID);
    if (existing?.values) {
      const key = `${store}:${id}`;
      if (key in existing.values) {
        const nextValues = { ...existing.values };
        delete nextValues[key];
        await put("meta", { id: SYNC_TOMBSTONES_ID, values: nextValues });
      }
    }
  } catch (error) {
    console.error(`Failed to clear tombstone for ${store}:${id}:`, error);
  }
}

function removeAndSync(store: Parameters<typeof remove>[0], id: string): Promise<void> {
  return remove(store, id).then(async () => {
    await recordTombstone(store, id);
    void import("@/lib/sync")
      .then(({ pushPendingRecords }) => pushPendingRecords())
      .catch((error: unknown) => {
        console.warn("Background sync delete push deferred or failed:", error);
      });
  });
}

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
    badHabits: badHabits.map((h) => ({
      ...h,
      // Backward compatibility: older bad habits that predate the strategy
      // feature default to "cold-turkey" without crashing.
      strategy: h.strategy ?? "cold-turkey",
      ...(h.limitType !== undefined && { limitType: h.limitType }),
      ...(h.limitValue !== undefined && { limitValue: h.limitValue }),
      usageLogs: h.usageLogs ?? [],
    })),
    settings: {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      notificationsEnabled: Boolean(
        (storedSettings as Record<string, unknown>)["notificationsEnabled"] ??
        (storedSettings as Record<string, unknown>)["remindersEnabled"] ??
        false,
      ),
    },
    timer: timer ?? null,
    customColors: Array.isArray(customColors?.customColors) ? customColors.customColors : [],
    customIcons: Array.isArray(customIcons?.customIcons) ? customIcons.customIcons : [],
  };
}

export const saveHabit = (habit: Habit) => write("habits", habit);
export const saveHabits = (habits: Habit[]) => writeMany("habits", habits);
export const deleteHabit = (id: string) => removeAndSync("habits", id);

export const saveLog = (log: HabitLog) => write("habitLogs", log);
export const deleteLog = (id: string) => removeAndSync("habitLogs", id);

export const saveGroup = (group: Group) => write("groups", group);
export const deleteGroup = (id: string) => removeAndSync("groups", id);

export const saveGoal = (goal: Goal) => write("goals", goal);
export const deleteGoal = (id: string) => removeAndSync("goals", id);

export const saveRoutine = (routine: Routine) => write("routines", routine);
export const deleteRoutine = (id: string) => removeAndSync("routines", id);
export const saveRoutineLog = (log: RoutineLog) => write("routineLogs", log);

export const saveBadHabit = (habit: BadHabit) => write("badHabits", habit);
export const deleteBadHabit = (id: string) => removeAndSync("badHabits", id);

export const saveSettings = (settings: AppSettings) => write("meta", settings);
export const saveTimer = (timer: TimerState) => write("meta", timer);
export const clearTimer = () => removeAndSync("meta", "timer");
export const saveCustomColors = (customColors: string[]) =>
  write("meta", { id: "customColors", customColors });
export const saveCustomIcons = (customIcons: CustomIcon[]) =>
  write("meta", { id: "customIcons", customIcons });

export async function getSyncRecords(): Promise<SyncRecord[]> {
  const records: SyncRecord[] = [];
  for (const store of [
    "habits",
    "habitLogs",
    "groups",
    "goals",
    "routines",
    "routineLogs",
    "badHabits",
    "meta",
  ] as const) {
    const values = await getAll<SyncableRecord>(store);
    for (const value of values) {
      if (store === "meta" && value.id === SYNC_TOMBSTONES_ID) continue;
      const updatedAt =
        typeof value["__syncUpdatedAt"] === "string"
          ? value["__syncUpdatedAt"]
          : typeof value["updatedAt"] === "number"
            ? new Date(value["updatedAt"]).toISOString()
            : typeof value["updatedAt"] === "string"
              ? value["updatedAt"]
              : new Date(0).toISOString();
      records.push({ store, id: value.id, data: value, updatedAt, deleted: false });
    }
  }

  const tombstones = await getOne<Tombstones>("meta", SYNC_TOMBSTONES_ID);
  for (const [key, updatedAt] of Object.entries(tombstones?.values ?? {})) {
    const separator = key.indexOf(":");
    if (separator > 0) {
      records.push({
        store: key.slice(0, separator),
        id: key.slice(separator + 1),
        data: null,
        updatedAt,
        deleted: true,
      });
    }
  }
  return records;
}

export async function mergeSyncRecord(record: SyncRecord): Promise<void> {
  if (record.deleted) {
    await remove(record.store as Parameters<typeof remove>[0], record.id);
    return;
  }
  if (record.data) {
    const { pending_sync, ...rest } = record.data;
    const dataWithSynced = { ...rest, synced: true };
    await put(record.store as Parameters<typeof put>[0], dataWithSynced);
  }
}

/**
 * Removes the pending_sync flag from a local record and marks it as synced: true.
 * Executed immediately upon successful push to Supabase cloud.
 */
export async function clearPendingSyncFlag(
  store: Parameters<typeof put>[0],
  id: string,
  recordData?: SyncableRecord,
): Promise<void> {
  try {
    const current = recordData ?? (await getOne<SyncableRecord>(store, id));
    if (current) {
      const { pending_sync, ...rest } = current;
      const cleanRecord = {
        ...rest,
        synced: true,
        __syncUpdatedAt: (current.__syncUpdatedAt as string) ?? nowIso(),
      };
      await put(store, cleanRecord);
    }
  } catch (error) {
    console.error(`Failed to clear pending_sync flag for ${store}:${id}:`, error);
  }
}

export interface PendingSyncItem {
  store: Parameters<typeof put>[0];
  id: string;
  data: SyncableRecord | null;
  updatedAt: string;
  deleted: boolean;
}

/**
 * Fetches all local items marked with pending_sync: true (or un-synced) across
 * all database stores, as well as pending deletion tombstones.
 */
export async function getPendingSyncRecords(): Promise<PendingSyncItem[]> {
  const pending: PendingSyncItem[] = [];

  for (const store of [
    "habits",
    "habitLogs",
    "groups",
    "goals",
    "routines",
    "routineLogs",
    "badHabits",
    "meta",
  ] as const) {
    try {
      const records = await getAll<SyncableRecord>(store);
      for (const record of records) {
        if (store === "meta" && record.id === SYNC_TOMBSTONES_ID) continue;
        if (record.pending_sync === true || record.synced === false) {
          const updatedAt =
            typeof record["__syncUpdatedAt"] === "string"
              ? record["__syncUpdatedAt"]
              : typeof record["updatedAt"] === "number"
                ? new Date(record["updatedAt"]).toISOString()
                : typeof record["updatedAt"] === "string"
                  ? record["updatedAt"]
                  : new Date().toISOString();

          pending.push({
            store,
            id: record.id,
            data: record,
            updatedAt,
            deleted: false,
          });
        }
      }
    } catch (storeError) {
      console.error(`Failed reading store ${store} for pending sync:`, storeError);
    }
  }

  // Pending tombstones (deleted records)
  try {
    const tombstones = await getOne<Tombstones>("meta", SYNC_TOMBSTONES_ID);
    for (const [key, tombstoneVal] of Object.entries(tombstones?.values ?? {})) {
      const separator = key.indexOf(":");
      if (separator > 0) {
        const store = key.slice(0, separator) as Parameters<typeof put>[0];
        const id = key.slice(separator + 1);
        let updatedAt = nowIso();
        let isPending = true;

        if (typeof tombstoneVal === "object" && tombstoneVal !== null) {
          updatedAt = tombstoneVal.updatedAt;
          isPending = tombstoneVal.pending_sync !== false;
        } else if (typeof tombstoneVal === "string") {
          updatedAt = tombstoneVal;
          isPending = true;
        }

        if (isPending) {
          pending.push({
            store,
            id,
            data: null,
            updatedAt,
            deleted: true,
          });
        }
      }
    }
  } catch (tombstoneError) {
    console.error("Failed reading tombstones for pending sync:", tombstoneError);
  }

  return pending;
}

/**
 * Returns the count of items currently awaiting synchronization to the cloud.
 */
export async function getPendingSyncCount(): Promise<number> {
  const pending = await getPendingSyncRecords();
  return pending.length;
}

/**
 * Removes a local record from IndexedDB directly without generating a sync tombstone.
 * Used during conflict resolution when remapping duplicate local IDs to canonical IDs.
 */
export function removeLocalOnly(store: Parameters<typeof remove>[0], id: string): Promise<void> {
  return remove(store, id);
}

/**
 * Persists multiple items marked as synced: true without triggering sync push cycles.
 */
export function saveSyncedMany<T extends { id: string }>(
  store: Parameters<typeof putMany>[0],
  values: T[],
): Promise<void> {
  const syncedValues = values.map((val) => {
    const { pending_sync, ...rest } = val as unknown as Record<string, unknown>;
    return {
      ...rest,
      synced: true,
      __syncUpdatedAt: (val as Record<string, unknown>)["__syncUpdatedAt"] ?? nowIso(),
    };
  });
  return putMany(store, syncedValues as unknown as T[]);
}

/**
 * Persists a single item marked as synced: true without triggering sync push cycles.
 */
export function saveSyncedOne<T extends { id: string }>(
  store: Parameters<typeof put>[0],
  value: T,
): Promise<void> {
  const { pending_sync, ...rest } = value as unknown as Record<string, unknown>;
  const syncedValue = {
    ...rest,
    synced: true,
    __syncUpdatedAt: (value as Record<string, unknown>)["__syncUpdatedAt"] ?? nowIso(),
  };
  return put(store, syncedValue as unknown as T);
}

export async function getLastSyncTimestamp(): Promise<string> {
  const value = await getOne<{ id: string; value?: string }>("meta", "lastSyncTimestamp");
  return value?.value ?? new Date(0).toISOString();
}

export async function setLastSyncTimestamp(value: string): Promise<void> {
  await put("meta", { id: "lastSyncTimestamp", value });
}

export async function getLastPushTimestamp(): Promise<string> {
  const value = await getOne<{ id: string; value?: string }>("meta", "lastPushTimestamp");
  return value?.value ?? new Date(0).toISOString();
}

export async function setLastPushTimestamp(value: string): Promise<void> {
  await put("meta", { id: "lastPushTimestamp", value });
}

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
    value.every(
      (item) =>
        isRecord(item) && typeof item["id"] === "string" && (item["id"] as string).length > 0,
    )
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

  if (data["settings"] !== undefined && !isRecord(data["settings"])) {
    throw new Error("Backup field 'settings' must be an object");
  }
  if (data["customColors"] !== undefined && !Array.isArray(data["customColors"])) {
    throw new Error("Backup field 'customColors' must be an array");
  }
  if (data["customIcons"] !== undefined && !isRecordArray(data["customIcons"])) {
    throw new Error("Backup field 'customIcons' must be an array of records");
  }
}

export async function importSnapshot(data: unknown): Promise<void> {
  validateImportSnapshot(data);
  const previous = await loadSnapshot();
  try {
    await wipeAll();
    const sanitizedCustomIcons: CustomIcon[] = (data.customIcons ?? []).map((icon) => ({
      ...icon,
      svgContent: typeof icon.svgContent === "string" ? sanitizeSvgIcon(icon.svgContent) : "",
    }));

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
      put("meta", { id: "customIcons", customIcons: sanitizedCustomIcons }),
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
