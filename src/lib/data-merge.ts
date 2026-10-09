import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getLocalClientId, trackLocalPush } from "@/lib/realtime";
import * as repo from "@/database/repository";
import type {
  AppSettings,
  BadHabit,
  Goal,
  Group,
  Habit,
  HabitLog,
  MigrationResult,
  MigrationStats,
  RelapseRecord,
  Routine,
  RoutineLog,
  UsageLog,
} from "@/types";

/** Batch size when sending upsert RPC calls to Supabase. */
const BATCH_SIZE = 50;

/** Key used in localStorage to mark a user's initial migration completion. */
const MIGRATION_STORAGE_KEY_PREFIX = "cadence_migrated_user_";

/** Lock to prevent concurrent merge operations. */
let migrationInFlight: Promise<MigrationResult> | null = null;

/**
 * Computes a unique signature for a habit based on normalized name and type.
 * This signature identifies habits representing the same user intention
 * across different devices or offline sessions, preventing duplicate creation
 * when the same habit was created with different IDs.
 */
export function generateHabitSignature(habit: { name?: string; type?: string }): string {
  const normalizedName = (habit.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedType = habit.type || "boolean";
  return `${normalizedName}::${normalizedType}`;
}

/**
 * Computes a unique signature for a bad habit (quit tracker) based on normalized title.
 */
export function generateBadHabitSignature(habit: { title?: string }): string {
  return (habit.title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Safely parses any date string or numeric timestamp to epoch milliseconds.
 */
function toTimestampMs(time: string | number | undefined, fallback = 0): number {
  if (typeof time === "number") return time;
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Merges a local habit and a remote habit into a single unified record.
 * Attributes from the more recently modified record take precedence.
 * Preserves the canonical remote ID and merges array fields like frozenDates.
 */
export function mergeHabitRecord(
  localHabit: Habit,
  remoteHabit: Habit,
  canonicalId: string,
): Habit {
  const localTime = Math.max(
    toTimestampMs(localHabit.updatedAt),
    toTimestampMs(localHabit.createdAt),
  );
  const remoteTime = Math.max(
    toTimestampMs(remoteHabit.updatedAt),
    toTimestampMs(remoteHabit.createdAt),
  );

  // The more recently modified version provides primary attributes
  const primary = localTime >= remoteTime ? localHabit : remoteHabit;
  const secondary = localTime >= remoteTime ? remoteHabit : localHabit;

  // Union frozen dates to protect streak freezes logged on either device
  const frozenDatesSet = new Set<string>([
    ...(remoteHabit.frozenDates ?? []),
    ...(localHabit.frozenDates ?? []),
  ]);

  // Union reminder times
  const reminderTimesSet = new Set<string>([
    ...(primary.reminderTimes ?? []),
    ...(secondary.reminderTimes ?? []),
  ]);

  const maxFreezesAllowed = primary.freezesAllowedPerMonth ?? secondary.freezesAllowedPerMonth ?? 3;
  const maxFreezesUsed = Math.max(
    primary.freezesUsedThisMonth ?? 0,
    secondary.freezesUsedThisMonth ?? 0,
  );

  return {
    ...secondary,
    ...primary,
    id: canonicalId,
    frozenDates: Array.from(frozenDatesSet),
    reminderTimes: Array.from(reminderTimesSet),
    freezesAllowedPerMonth: maxFreezesAllowed,
    freezesUsedThisMonth: maxFreezesUsed,
    isPillar: primary.isPillar ?? secondary.isPillar ?? false,
    synced: true,
    updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
  };
}

/**
 * Merges a local bad habit (quit tracker) and a remote bad habit into a unified record.
 * Attributes from the more recently modified record take precedence.
 * Preserves the canonical remote ID, merges relapse history without duplicates,
 * and unions usage logs for moderation/limit habits.
 */
export function mergeBadHabitRecord(
  localHabit: BadHabit,
  remoteHabit: BadHabit,
  canonicalId: string,
): BadHabit {
  const localTime = Math.max(
    toTimestampMs(localHabit.updatedAt),
    localHabit.createdAt,
  );
  const remoteTime = Math.max(
    toTimestampMs(remoteHabit.updatedAt),
    remoteHabit.createdAt,
  );

  const primary = localTime >= remoteTime ? localHabit : remoteHabit;
  const secondary = localTime >= remoteTime ? remoteHabit : localHabit;

  // Merge history (RelapseRecord[]): deduplicate by ID and sort descending by relapsedAt
  const historyMap = new Map<string, RelapseRecord>();
  for (const record of secondary.history ?? []) {
    if (record?.id) historyMap.set(record.id, record);
  }
  for (const record of primary.history ?? []) {
    if (record?.id) historyMap.set(record.id, record);
  }
  const mergedHistory = Array.from(historyMap.values()).sort(
    (a, b) => b.relapsedAt - a.relapsedAt,
  );

  // Merge usageLogs (UsageLog[]): deduplicate by ID or date and sort ascending by date
  const usageMap = new Map<string, UsageLog>();
  for (const log of secondary.usageLogs ?? []) {
    if (log?.id || log?.date) usageMap.set(log.id || log.date, log);
  }
  for (const log of primary.usageLogs ?? []) {
    if (log?.id || log?.date) usageMap.set(log.id || log.date, log);
  }
  const mergedUsageLogs = Array.from(usageMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    ...secondary,
    ...primary,
    id: canonicalId,
    history: mergedHistory,
    usageLogs: mergedUsageLogs,
    synced: true,
    updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
  };
}

/**
 * Resolves conflict between local and remote habit logs for the same habit and date.
 * Completion status always takes precedence over partial or skipped.
 * The highest achieved value is preserved.
 */
export function mergeHabitLogRecord(
  localLog: HabitLog,
  remoteLog: HabitLog,
  canonicalHabitId: string,
): HabitLog {
  const canonicalId = `${canonicalHabitId}:${localLog.date}`;

  // Complete status always wins over partial or none
  let mergedStatus: HabitLog["status"] = "partial";
  if (localLog.status === "complete" || remoteLog.status === "complete") {
    mergedStatus = "complete";
  } else if (localLog.status === "frozen" || remoteLog.status === "frozen") {
    mergedStatus = "frozen";
  } else if (localLog.status === "skipped" || remoteLog.status === "skipped") {
    mergedStatus = "skipped";
  } else {
    mergedStatus = "partial";
  }

  // Preserve the highest progress value recorded
  const mergedValue = Math.max(localLog.value ?? 0, remoteLog.value ?? 0);
  const mergedTarget = localLog.target || remoteLog.target || 1;
  const mergedUpdatedAt = Math.max(localLog.updatedAt ?? 0, remoteLog.updatedAt ?? 0, Date.now());

  return {
    id: canonicalId,
    habitId: canonicalHabitId,
    date: localLog.date,
    value: mergedValue,
    target: mergedTarget,
    status: mergedStatus,
    updatedAt: mergedUpdatedAt,
    synced: true,
  };
}

export interface LocalSnapshotData {
  habits: Habit[];
  habitLogs: HabitLog[];
  groups: Group[];
  goals: Goal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  badHabits: BadHabit[];
  settings: AppSettings;
}

/**
 * Reads all existing habits, progress records, and entities from IndexedDB,
 * with fallback inspection of localStorage in case data predates IndexedDB migration.
 */
export async function readAllLocalData(): Promise<LocalSnapshotData> {
  const snapshot = await repo.loadSnapshot();

  let habits = snapshot.habits ?? [];
  let habitLogs = snapshot.habitLogs ?? [];

  // Fallback to localStorage if IndexedDB habits are empty
  if (habits.length === 0 && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("cadence-storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed.state || parsed;
        if (Array.isArray(state?.habits) && state.habits.length > 0) {
          habits = state.habits;
        }
        if (Array.isArray(state?.habitLogs) && state.habitLogs.length > 0) {
          habitLogs = state.habitLogs;
        }
      }
    } catch (error) {
      console.warn("Failed to inspect localStorage fallback for offline habits:", error);
    }
  }

  return {
    habits,
    habitLogs,
    groups: snapshot.groups ?? [],
    goals: snapshot.goals ?? [],
    routines: snapshot.routines ?? [],
    routineLogs: snapshot.routineLogs ?? [],
    badHabits: snapshot.badHabits ?? [],
    settings: snapshot.settings,
  };
}

export interface RemoteUserData {
  habits: Habit[];
  habitLogs: HabitLog[];
  groups: Group[];
  goals: Goal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  badHabits: BadHabit[];
  newestTimestamp: string;
}

/**
 * Fetches all non-deleted sync records for the given user from Supabase.
 */
export async function fetchRemoteUserData(userId: string): Promise<RemoteUserData> {
  const PAGE_SIZE = 1000;
  let from = 0;
  const allRows: Array<{
    store_name: string;
    record_id: string;
    data: unknown;
    updated_at: string;
    deleted: boolean;
  }> = [];

  // Paginate through Supabase/PostgREST records using .range(from, to) to safely bypass the 1,000-row default limit
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("cadence_sync_records")
      .select("store_name, record_id, data, updated_at, deleted")
      .eq("user_id", userId)
      .eq("deleted", false)
      .order("updated_at", { ascending: true })
      .order("record_id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch remote user data from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      allRows.push(...data);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  const result: RemoteUserData = {
    habits: [],
    habitLogs: [],
    groups: [],
    goals: [],
    routines: [],
    routineLogs: [],
    badHabits: [],
    newestTimestamp: new Date(0).toISOString(),
  };

  for (const row of allRows) {
    if (row.updated_at > result.newestTimestamp) {
      result.newestTimestamp = row.updated_at;
    }
    if (!row.data || typeof row.data !== "object") continue;

    switch (row.store_name) {
      case "habits":
        result.habits.push(row.data as unknown as Habit);
        break;
      case "habitLogs":
        result.habitLogs.push(row.data as unknown as HabitLog);
        break;
      case "groups":
        result.groups.push(row.data as unknown as Group);
        break;
      case "goals":
        result.goals.push(row.data as unknown as Goal);
        break;
      case "routines":
        result.routines.push(row.data as unknown as Routine);
        break;
      case "routineLogs":
        result.routineLogs.push(row.data as unknown as RoutineLog);
        break;
      case "badHabits":
        result.badHabits.push(row.data as unknown as BadHabit);
        break;
    }
  }

  return result;
}

export interface UpsertSyncPayload {
  store: string;
  id: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted: boolean;
}

/**
 * Pushes records to Supabase using upsert_cadence_sync_record RPC in chunks.
 */
export async function pushRecordsToSupabase(
  records: UpsertSyncPayload[],
  userId: string,
): Promise<void> {
  if (records.length === 0) return;
  const clientId = getLocalClientId();

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    for (const record of chunk) {
      trackLocalPush(record.store, record.id, record.updatedAt);
    }
    const results = await Promise.all(
      chunk.map((record) =>
        supabase.rpc("upsert_cadence_sync_record", {
          p_store_name: record.store,
          p_record_id: record.id,
          p_data: { ...record.data, _clientId: clientId },
          p_updated_at: record.updatedAt,
          p_deleted: record.deleted,
        }),
      ),
    );

    const failure = results.find(({ error }) => error);
    if (failure?.error) {
      // Fallback: direct upsert into table if RPC encountered an issue
      console.warn("RPC upsert failed, attempting direct table upsert fallback:", failure.error);
      const rows = chunk.map((r) => ({
        user_id: userId,
        store_name: r.store,
        record_id: r.id,
        data: r.data,
        updated_at: r.updatedAt,
        deleted: r.deleted,
      }));
      const { error: fallbackError } = await supabase
        .from("cadence_sync_records")
        .upsert(rows, { onConflict: "user_id,store_name,record_id" });

      if (fallbackError) {
        throw new Error(
          `Supabase upsert failed for chunk ${i}-${i + chunk.length}: ${fallbackError.message}`,
        );
      }
    }
  }
}

/**
 * Core migration and data merge utility.
 * Merges local offline habits and progress with existing cloud records:
 * - Detects matches by ID or unique signature.
 * - Resolves duplicates and remaps IDs.
 * - Upserts new and resolved data to Supabase.
 * - Persists merged data locally with synced: true.
 * - Cleans up obsolete local IDs so items are never duplicated.
 */
export async function mergeLocalDataToCloud(
  userId: string,
  options?: { force?: boolean },
): Promise<MigrationResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      stats: {
        habitsChecked: 0,
        habitsUpserted: 0,
        habitsResolved: 0,
        logsChecked: 0,
        logsUpserted: 0,
        logsResolved: 0,
        durationMs: 0,
      },
      error: "Supabase client is not configured.",
    };
  }

  if (migrationInFlight) {
    return migrationInFlight;
  }

  migrationInFlight = (async () => {
    const startTime = Date.now();
    const stats: MigrationStats = {
      habitsChecked: 0,
      habitsUpserted: 0,
      habitsResolved: 0,
      logsChecked: 0,
      logsUpserted: 0,
      logsResolved: 0,
      badHabitsChecked: 0,
      badHabitsUpserted: 0,
      badHabitsResolved: 0,
      durationMs: 0,
    };

    const remappedHabitIds: Record<string, string> = {};

    try {
      // 1. Read all local data
      const localData = await readAllLocalData();
      stats.habitsChecked = localData.habits.length;
      stats.logsChecked = localData.habitLogs.length;
      stats.badHabitsChecked = localData.badHabits.length;

      // 2. Fetch remote user data from Supabase
      const remoteData = await fetchRemoteUserData(userId);

      const hasLocalEntities =
        localData.habits.length > 0 ||
        localData.badHabits.length > 0 ||
        localData.goals.length > 0 ||
        localData.routines.length > 0;

      const hasRemoteEntities =
        remoteData.habits.length > 0 ||
        remoteData.badHabits.length > 0 ||
        remoteData.goals.length > 0 ||
        remoteData.routines.length > 0;

      // Fast-path: if local data has no entities and remote has data, simply pull down remote
      if (!hasLocalEntities && hasRemoteEntities) {
        if (remoteData.habits.length > 0) {
          await repo.saveSyncedMany("habits", remoteData.habits);
        }
        if (remoteData.habitLogs.length > 0) {
          await repo.saveSyncedMany("habitLogs", remoteData.habitLogs);
        }
        if (remoteData.groups.length > 0) {
          await repo.saveSyncedMany("groups", remoteData.groups);
        }
        if (remoteData.goals.length > 0) {
          await repo.saveSyncedMany("goals", remoteData.goals);
        }
        if (remoteData.routines.length > 0) {
          await repo.saveSyncedMany("routines", remoteData.routines);
        }
        if (remoteData.routineLogs.length > 0) {
          await repo.saveSyncedMany("routineLogs", remoteData.routineLogs);
        }
        if (remoteData.badHabits.length > 0) {
          await repo.saveSyncedMany("badHabits", remoteData.badHabits);
        }

        await repo.setLastSyncTimestamp(remoteData.newestTimestamp);
        await repo.setLastPushTimestamp(remoteData.newestTimestamp);

        localStorage.setItem(`${MIGRATION_STORAGE_KEY_PREFIX}${userId}`, new Date().toISOString());

        stats.durationMs = Date.now() - startTime;
        return { success: true, stats };
      }

      // Fast-path: if neither local nor remote has entities, record completion
      if (!hasLocalEntities && !hasRemoteEntities) {
        localStorage.setItem(`${MIGRATION_STORAGE_KEY_PREFIX}${userId}`, new Date().toISOString());
        stats.durationMs = Date.now() - startTime;
        return { success: true, stats };
      }

      // 3. Prepare Conflict Resolution for Habits
      const remoteHabitsById = new Map<string, Habit>();
      const remoteHabitsBySignature = new Map<string, Habit>();
      for (const rh of remoteData.habits) {
        remoteHabitsById.set(rh.id, rh);
        remoteHabitsBySignature.set(generateHabitSignature(rh), rh);
      }

      const idMapping = new Map<string, string>(); // localHabitId -> canonicalRemoteId
      const localHabitsToDelete: string[] = [];
      const habitsToSaveLocally: Habit[] = [];
      const processedRemoteHabitIds = new Set<string>();
      const recordsToUpload: UpsertSyncPayload[] = [];

      for (const localHabit of localData.habits) {
        // Match 1: Exact ID match
        const exactMatch = remoteHabitsById.get(localHabit.id);
        if (exactMatch) {
          idMapping.set(localHabit.id, exactMatch.id);
          processedRemoteHabitIds.add(exactMatch.id);

          const merged = mergeHabitRecord(localHabit, exactMatch, exactMatch.id);
          habitsToSaveLocally.push(merged);
          recordsToUpload.push({
            store: "habits",
            id: merged.id,
            data: merged as unknown as Record<string, unknown>,
            updatedAt: merged.updatedAt ?? new Date().toISOString(),
            deleted: false,
          });
          stats.habitsResolved++;
          continue;
        }

        // Match 2: Signature match (same name and type, but differing IDs)
        const signature = generateHabitSignature(localHabit);
        const signatureMatch = remoteHabitsBySignature.get(signature);
        if (signatureMatch) {
          // Conflict resolved! Use canonical remote habit ID
          const canonicalId = signatureMatch.id;
          idMapping.set(localHabit.id, canonicalId);
          remappedHabitIds[localHabit.id] = canonicalId;
          processedRemoteHabitIds.add(canonicalId);

          // Mark local habit ID for deletion so it doesn't duplicate locally
          localHabitsToDelete.push(localHabit.id);

          const merged = mergeHabitRecord(localHabit, signatureMatch, canonicalId);
          habitsToSaveLocally.push(merged);
          recordsToUpload.push({
            store: "habits",
            id: canonicalId,
            data: merged as unknown as Record<string, unknown>,
            updatedAt: merged.updatedAt ?? new Date().toISOString(),
            deleted: false,
          });
          stats.habitsResolved++;
          continue;
        }

        // No match: local-only habit created offline
        idMapping.set(localHabit.id, localHabit.id);
        const localOnlyHabit: Habit = {
          ...localHabit,
          synced: true,
          updatedAt: localHabit.updatedAt ?? new Date().toISOString(),
        };
        habitsToSaveLocally.push(localOnlyHabit);
        recordsToUpload.push({
          store: "habits",
          id: localOnlyHabit.id,
          data: localOnlyHabit as unknown as Record<string, unknown>,
          updatedAt: localOnlyHabit.updatedAt ?? new Date().toISOString(),
          deleted: false,
        });
        stats.habitsUpserted++;
      }

      // Add remote habits that had no local counterpart
      for (const remoteHabit of remoteData.habits) {
        if (!processedRemoteHabitIds.has(remoteHabit.id)) {
          habitsToSaveLocally.push({ ...remoteHabit, synced: true });
        }
      }

      // 4. Conflict Resolution for Habit Logs (Progress records)
      const localLogsToDelete: string[] = [];
      const remappedLocalLogs = new Map<string, HabitLog>(); // canonicalKey -> HabitLog

      for (const log of localData.habitLogs) {
        const canonicalHabitId = idMapping.get(log.habitId) ?? log.habitId;
        const canonicalLogId = `${canonicalHabitId}:${log.date}`;

        // If habit ID was remapped, mark old log ID for deletion
        if (canonicalHabitId !== log.habitId || canonicalLogId !== log.id) {
          localLogsToDelete.push(log.id);
        }

        const remappedLog: HabitLog = {
          ...log,
          id: canonicalLogId,
          habitId: canonicalHabitId,
        };

        const existing = remappedLocalLogs.get(canonicalLogId);
        if (existing) {
          remappedLocalLogs.set(
            canonicalLogId,
            mergeHabitLogRecord(remappedLog, existing, canonicalHabitId),
          );
        } else {
          remappedLocalLogs.set(canonicalLogId, remappedLog);
        }
      }

      const remoteLogsMap = new Map<string, HabitLog>();
      for (const rLog of remoteData.habitLogs) {
        remoteLogsMap.set(rLog.id, rLog);
      }

      const habitLogsToSaveLocally: HabitLog[] = [];
      const processedRemoteLogIds = new Set<string>();

      for (const [canonicalLogId, localLog] of remappedLocalLogs.entries()) {
        const remoteLog = remoteLogsMap.get(canonicalLogId);
        if (remoteLog) {
          // Collision on same date: merge progress values and status
          processedRemoteLogIds.add(canonicalLogId);
          const mergedLog = mergeHabitLogRecord(localLog, remoteLog, localLog.habitId);
          habitLogsToSaveLocally.push(mergedLog);
          recordsToUpload.push({
            store: "habitLogs",
            id: mergedLog.id,
            data: mergedLog as unknown as Record<string, unknown>,
            updatedAt: new Date(mergedLog.updatedAt).toISOString(),
            deleted: false,
          });
          stats.logsResolved++;
        } else {
          // Local-only progress log
          const syncedLog: HabitLog = { ...localLog, synced: true };
          habitLogsToSaveLocally.push(syncedLog);
          recordsToUpload.push({
            store: "habitLogs",
            id: syncedLog.id,
            data: syncedLog as unknown as Record<string, unknown>,
            updatedAt: new Date(syncedLog.updatedAt).toISOString(),
            deleted: false,
          });
          stats.logsUpserted++;
        }
      }

      // Add remote logs that were not modified locally
      for (const remoteLog of remoteData.habitLogs) {
        if (!processedRemoteLogIds.has(remoteLog.id)) {
          habitLogsToSaveLocally.push({ ...remoteLog, synced: true });
        }
      }

      // 5. Remap references in Goals and Routines if habit IDs changed
      const goalsToSave: Goal[] = [];
      for (const goal of localData.goals) {
        let changed = false;
        const nextHabitIds = goal.habitIds.map((hid) => {
          const remapped = idMapping.get(hid);
          if (remapped && remapped !== hid) {
            changed = true;
            return remapped;
          }
          return hid;
        });

        const updatedGoal = changed ? { ...goal, habitIds: nextHabitIds } : goal;
        goalsToSave.push({ ...updatedGoal, synced: true });
        recordsToUpload.push({
          store: "goals",
          id: updatedGoal.id,
          data: updatedGoal as unknown as Record<string, unknown>,
          updatedAt: updatedGoal.updatedAt ?? new Date().toISOString(),
          deleted: false,
        });
      }

      const routinesToSave: Routine[] = [];
      for (const routine of localData.routines) {
        let changed = false;
        const nextSteps = routine.steps.map((step) => {
          if (step.habitId && idMapping.has(step.habitId)) {
            const remapped = idMapping.get(step.habitId)!;
            if (remapped !== step.habitId) {
              changed = true;
              return { ...step, habitId: remapped };
            }
          }
          return step;
        });

        const updatedRoutine = changed ? { ...routine, steps: nextSteps } : routine;
        routinesToSave.push({ ...updatedRoutine, synced: true });
        recordsToUpload.push({
          store: "routines",
          id: updatedRoutine.id,
          data: updatedRoutine as unknown as Record<string, unknown>,
          updatedAt: updatedRoutine.updatedAt ?? new Date().toISOString(),
          deleted: false,
        });
      }

      // 6. Conflict Resolution for Bad Habits (Quit Trackers)
      const remoteBadHabitsById = new Map<string, BadHabit>();
      const remoteBadHabitsBySignature = new Map<string, BadHabit>();
      for (const rbh of remoteData.badHabits) {
        remoteBadHabitsById.set(rbh.id, rbh);
        remoteBadHabitsBySignature.set(generateBadHabitSignature(rbh), rbh);
      }

      const localBadHabitsToDelete: string[] = [];
      const badHabitsToSaveLocally: BadHabit[] = [];
      const processedRemoteBadHabitIds = new Set<string>();

      for (const localBadHabit of localData.badHabits) {
        // Match 1: Exact ID match
        const exactMatch = remoteBadHabitsById.get(localBadHabit.id);
        if (exactMatch) {
          processedRemoteBadHabitIds.add(exactMatch.id);
          const merged = mergeBadHabitRecord(localBadHabit, exactMatch, exactMatch.id);
          badHabitsToSaveLocally.push(merged);
          recordsToUpload.push({
            store: "badHabits",
            id: merged.id,
            data: merged as unknown as Record<string, unknown>,
            updatedAt: merged.updatedAt ?? new Date().toISOString(),
            deleted: false,
          });
          stats.badHabitsResolved = (stats.badHabitsResolved ?? 0) + 1;
          continue;
        }

        // Match 2: Signature match (same normalized title, differing IDs)
        const sig = generateBadHabitSignature(localBadHabit);
        const sigMatch = sig ? remoteBadHabitsBySignature.get(sig) : undefined;
        if (sigMatch) {
          const canonicalId = sigMatch.id;
          processedRemoteBadHabitIds.add(canonicalId);
          localBadHabitsToDelete.push(localBadHabit.id);

          const merged = mergeBadHabitRecord(localBadHabit, sigMatch, canonicalId);
          badHabitsToSaveLocally.push(merged);
          recordsToUpload.push({
            store: "badHabits",
            id: canonicalId,
            data: merged as unknown as Record<string, unknown>,
            updatedAt: merged.updatedAt ?? new Date().toISOString(),
            deleted: false,
          });
          stats.badHabitsResolved = (stats.badHabitsResolved ?? 0) + 1;
          continue;
        }

        // No match: local-only quit tracker created offline
        const localOnlyBadHabit: BadHabit = {
          ...localBadHabit,
          synced: true,
          updatedAt: localBadHabit.updatedAt ?? new Date().toISOString(),
        };
        badHabitsToSaveLocally.push(localOnlyBadHabit);
        recordsToUpload.push({
          store: "badHabits",
          id: localOnlyBadHabit.id,
          data: localOnlyBadHabit as unknown as Record<string, unknown>,
          updatedAt: localOnlyBadHabit.updatedAt ?? new Date().toISOString(),
          deleted: false,
        });
        stats.badHabitsUpserted = (stats.badHabitsUpserted ?? 0) + 1;
      }

      // Add remote bad habits that had no local counterpart
      for (const remoteBadHabit of remoteData.badHabits) {
        if (!processedRemoteBadHabitIds.has(remoteBadHabit.id)) {
          badHabitsToSaveLocally.push({ ...remoteBadHabit, synced: true });
        }
      }

      // 7. Groups reconciliation
      const groupsToSave: Group[] = [];
      const remoteGroupsById = new Map<string, Group>();
      for (const rg of remoteData.groups) {
        remoteGroupsById.set(rg.id, rg);
      }
      const processedRemoteGroupIds = new Set<string>();

      for (const group of localData.groups) {
        const remoteGroup = remoteGroupsById.get(group.id);
        const mergedGroup: Group = remoteGroup
          ? { ...remoteGroup, ...group, synced: true }
          : { ...group, synced: true };
        if (remoteGroup) processedRemoteGroupIds.add(group.id);
        groupsToSave.push(mergedGroup);
        recordsToUpload.push({
          store: "groups",
          id: mergedGroup.id,
          data: mergedGroup as unknown as Record<string, unknown>,
          updatedAt: mergedGroup.updatedAt ?? new Date().toISOString(),
          deleted: false,
        });
      }

      for (const rg of remoteData.groups) {
        if (!processedRemoteGroupIds.has(rg.id)) {
          groupsToSave.push({ ...rg, synced: true });
        }
      }

      // 8. Push all upload records to Supabase
      await pushRecordsToSupabase(recordsToUpload, userId);

      // 9. Apply local storage updates atomically
      // Remove old remapped local records
      for (const oldHabitId of localHabitsToDelete) {
        await repo.removeLocalOnly("habits", oldHabitId);
      }
      for (const oldLogId of localLogsToDelete) {
        await repo.removeLocalOnly("habitLogs", oldLogId);
      }
      for (const oldBadHabitId of localBadHabitsToDelete) {
        await repo.removeLocalOnly("badHabits", oldBadHabitId);
      }

      // Save unified merged datasets marked with synced: true
      await repo.saveSyncedMany("habits", habitsToSaveLocally);
      await repo.saveSyncedMany("habitLogs", habitLogsToSaveLocally);
      if (goalsToSave.length > 0) {
        await repo.saveSyncedMany("goals", goalsToSave);
      }
      if (routinesToSave.length > 0) {
        await repo.saveSyncedMany("routines", routinesToSave);
      }
      if (badHabitsToSaveLocally.length > 0) {
        await repo.saveSyncedMany("badHabits", badHabitsToSaveLocally);
      }
      if (groupsToSave.length > 0) {
        await repo.saveSyncedMany("groups", groupsToSave);
      }

      // Update sync timestamps
      const latestTs = new Date().toISOString();
      await repo.setLastSyncTimestamp(latestTs);
      await repo.setLastPushTimestamp(latestTs);

      // Mark migration as completed for this user in localStorage
      localStorage.setItem(`${MIGRATION_STORAGE_KEY_PREFIX}${userId}`, latestTs);

      stats.durationMs = Date.now() - startTime;
      return {
        success: true,
        stats,
        details: { remappedHabitIds },
      };
    } catch (error) {
      console.error("Local-to-cloud data migration failed:", error);
      stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        stats,
        error: error instanceof Error ? error.message : "Unknown migration error",
      };
    } finally {
      migrationInFlight = null;
    }
  })();

  return migrationInFlight;
}

/**
 * Checks if migration has already been executed for the given user.
 */
export function hasUserBeenMigrated(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(`${MIGRATION_STORAGE_KEY_PREFIX}${userId}`));
}
