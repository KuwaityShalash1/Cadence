import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getLocalClientId, trackLocalPush } from "@/lib/realtime";
import {
  clearPendingSyncFlag,
  clearTombstone,
  getLastPushTimestamp,
  getLastSyncTimestamp,
  getPendingSyncRecords,
  getSyncRecords,
  mergeSyncRecord,
  setLastPushTimestamp,
  setLastSyncTimestamp,
  type SyncRecord,
} from "@/database/repository";

const SYNC_TABLE = "cadence_sync_records";
let syncInFlight: Promise<boolean> | null = null;

interface RemoteSyncRow {
  store_name: string;
  record_id: string;
  data: Record<string, unknown> | null;
  updated_at: string;
  deleted: boolean;
}

type SyncListener = () => void;
const syncListeners = new Set<SyncListener>();

/**
 * Subscribes a callback to be notified whenever background sync completes
 * and updates local database records.
 */
export function subscribeToSync(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Notifies all registered sync listeners to trigger UI updates.
 */
export function notifySyncListeners(): void {
  for (const listener of syncListeners) {
    try {
      listener();
    } catch (err) {
      console.error("Error invoking sync listener:", err);
    }
  }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.name !== "AuthSessionMissingError") {
        console.error("Unable to read the Supabase user for sync.", error);
      }
      return null;
    }
    return data.user?.id ?? null;
  } catch (error) {
    console.warn("Error getting authenticated user for sync:", error);
    return null;
  }
}

/**
 * Fetches all local items flagged with pending_sync: true (or pending deletions)
 * and pushes them to Supabase. Once each item is successfully saved remotely,
 * its pending_sync flag is removed from local storage.
 */
export async function pushPendingRecords(): Promise<{ pushedCount: number; failedCount: number }> {
  if (!isOnline()) return { pushedCount: 0, failedCount: 0 };
  const userId = await getAuthenticatedUserId();
  if (!userId) return { pushedCount: 0, failedCount: 0 };

  const pendingRecords = await getPendingSyncRecords();
  if (pendingRecords.length === 0) return { pushedCount: 0, failedCount: 0 };

  let pushedCount = 0;
  let failedCount = 0;
  const lastPushTimestamp = await getLastPushTimestamp();
  const clientId = getLocalClientId();

  for (const record of pendingRecords) {
    try {
      trackLocalPush(record.store, record.id, record.updatedAt);
      // Remove local-only pending_sync flag before uploading to Supabase
      let payloadData: Record<string, unknown> | null = null;
      if (record.data) {
        const { pending_sync, ...rest } = record.data;
        payloadData = { ...rest, synced: true, _clientId: clientId };
      } else if (record.deleted) {
        payloadData = { _clientId: clientId };
      }

      const { error } = await supabase.rpc("upsert_cadence_sync_record", {
        p_store_name: record.store,
        p_record_id: record.id,
        p_data: payloadData,
        p_updated_at: record.updatedAt,
        p_deleted: record.deleted,
      });

      if (error) {
        console.error(`Failed to push record ${record.store}:${record.id} to Supabase:`, error);
        failedCount++;
      } else {
        pushedCount++;
        // Push succeeded: remove pending_sync flag from local item
        if (record.deleted) {
          await clearTombstone(record.store, record.id);
        } else if (record.data) {
          await clearPendingSyncFlag(record.store, record.id, record.data);
        }
      }
    } catch (pushError) {
      console.error(`Network error pushing record ${record.store}:${record.id}:`, pushError);
      failedCount++;
    }
  }

  if (pushedCount > 0) {
    const newestTimestamp = pendingRecords.reduce(
      (latest, record) => (record.updatedAt > latest ? record.updatedAt : latest),
      lastPushTimestamp,
    );
    await setLastPushTimestamp(newestTimestamp);
    notifySyncListeners();
  }

  return { pushedCount, failedCount };
}

export async function pullRemoteRecords(): Promise<boolean> {
  if (!isOnline()) return false;
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;
  const lastSyncTimestamp = await getLastSyncTimestamp();

  try {
    const PAGE_SIZE = 1000;
    let from = 0;
    const allRows: RemoteSyncRow[] = [];

    // Paginate using .range(from, to) to safely bypass PostgREST's 1,000-row default limit
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(SYNC_TABLE)
        .select("store_name, record_id, data, updated_at, deleted")
        .eq("user_id", userId)
        .gt("updated_at", lastSyncTimestamp)
        .order("updated_at", { ascending: true })
        .order("record_id", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("Unable to pull remote changes from Supabase.", error);
        return false;
      }

      if (data && data.length > 0) {
        allRows.push(...(data as RemoteSyncRow[]));
      }

      if (!data || data.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    if (allRows.length === 0) {
      return false;
    }

    let newestTimestamp = lastSyncTimestamp;
    const localRecords = await getSyncRecords();
    const localMap = new Map<string, SyncRecord>();
    for (const item of localRecords) {
      localMap.set(`${item.store}-${item.id}`, item);
    }

    for (const row of allRows) {
      const syncData =
        row.data && typeof row.data["id"] === "string" ? (row.data as SyncRecord["data"]) : null;
      const record: SyncRecord = {
        store: row.store_name,
        id: row.record_id,
        data: syncData,
        updatedAt: row.updated_at,
        deleted: row.deleted,
      };
      const local = localMap.get(`${record.store}-${record.id}`);
      const localTime = local ? new Date(local.updatedAt).getTime() || 0 : 0;
      const remoteTime = new Date(record.updatedAt).getTime() || 0;

      if (!local || localTime < remoteTime) {
        await mergeSyncRecord(record);
        localMap.set(`${record.store}-${record.id}`, record);
      }
      if (record.updatedAt > newestTimestamp) newestTimestamp = record.updatedAt;
    }

    if (newestTimestamp !== lastSyncTimestamp) {
      await setLastSyncTimestamp(newestTimestamp);
    }
    return allRows.length > 0;
  } catch (pullError) {
    console.error("Network error while pulling remote records:", pullError);
    return false;
  }
}

/**
 * Triggers bidirectional synchronization: pushes all local pending mutations,
 * then pulls any newer cloud modifications.
 */
export async function syncNow(): Promise<boolean> {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      if (!isOnline()) return false;
      const userId = await getAuthenticatedUserId();
      if (userId) {
        const { hasUserBeenMigrated, mergeLocalDataToCloud } = await import("@/lib/data-merge");
        if (!hasUserBeenMigrated(userId)) {
          await mergeLocalDataToCloud(userId);
          notifySyncListeners();
          return true;
        }
      }

      // 1. Push all pending offline mutations
      const { pushedCount } = await pushPendingRecords();

      // 2. Pull remote records from cloud
      const hasPulled = await pullRemoteRecords();

      const hasChanges = pushedCount > 0 || hasPulled;
      if (hasChanges) {
        notifySyncListeners();
      }
      return hasChanges;
    } catch (syncError) {
      console.error("Background data sync failed gracefully:", syncError);
      return false;
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export async function syncOnAuthChange(): Promise<void> {
  await syncNow();
}
