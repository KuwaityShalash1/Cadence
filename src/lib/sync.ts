import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getLocalClientId, trackLocalPush } from "@/lib/realtime";
import {
  clearPendingSyncFlag,
  clearTombstone,
  getAllItemsFromStore,
  getLastPushTimestamp,
  getLastSyncTimestamp,
  getPendingSyncRecords,
  getSyncRecords,
  mergeSyncRecord,
  recordSyncFailure,
  removeLocalOnly,
  setLastPushTimestamp,
  setLastSyncTimestamp,
  type SyncRecord,
} from "@/database/repository";

const SYNC_TABLE = "cadence_sync_records";
let syncInFlight: Promise<boolean> | null = null;

export const RECONCILED_ENTITY_STORES = [
  "habits",
  "goals",
  "routines",
  "badHabits",
  "habitLogs",
  "routineLogs",
  "groups",
] as const;

export type ReconciledEntityStore = (typeof RECONCILED_ENTITY_STORES)[number];

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
 * Simultaneously removes a record from Supabase cloud database during local deletion mutations.
 * Ensures the cloud and local stores are synchronized immediately when online.
 */
export async function deleteRecordFromCloud(store: string, id: string): Promise<boolean> {
  if (!isOnline() || !isSupabaseConfigured) return false;
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;

  const now = new Date().toISOString();
  trackLocalPush(store, id, now);

  try {
    // 1. Direct deletion from Supabase cadence_sync_records
    const { error: delError } = await supabase
      .from(SYNC_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("store_name", store)
      .eq("record_id", id);

    if (delError) {
      console.warn(
        `Direct cloud deletion failed for ${store}:${id}, attempting RPC fallback:`,
        delError,
      );
      const { error: rpcError } = await supabase.rpc("upsert_cadence_sync_record", {
        p_store_name: store,
        p_record_id: id,
        p_data: { _clientId: getLocalClientId() },
        p_updated_at: now,
        p_deleted: true,
      });
      if (rpcError) {
        console.error(`Cloud deletion failed for ${store}:${id}:`, rpcError);
        return false;
      }
    }

    // Successfully removed remotely: clear local tombstone
    await clearTombstone(store, id);
    return true;
  } catch (error) {
    console.warn(`Network error deleting record ${store}:${id} from cloud:`, error);
    return false;
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

      if (record.deleted) {
        // Direct delete from Supabase table
        const { error: delError } = await supabase
          .from(SYNC_TABLE)
          .delete()
          .eq("user_id", userId)
          .eq("store_name", record.store)
          .eq("record_id", record.id);

        let rpcFailed = false;
        if (delError) {
          // Fallback to RPC upsert with deleted: true
          const { error: rpcError } = await supabase.rpc("upsert_cadence_sync_record", {
            p_store_name: record.store,
            p_record_id: record.id,
            p_data: { _clientId: clientId },
            p_updated_at: record.updatedAt,
            p_deleted: true,
          });
          if (rpcError) {
            console.error(
              `Failed to push deleted tombstone ${record.store}:${record.id}:`,
              rpcError,
            );
            rpcFailed = true;
            failedCount++;
            await recordSyncFailure(record.store, record.id, rpcError.message, true);
          }
        }

        if (!rpcFailed) {
          pushedCount++;
          await clearTombstone(record.store, record.id);
        }
      } else {
        // Remove local-only pending_sync flag before uploading to Supabase
        let payloadData: Record<string, unknown> | null = null;
        if (record.data) {
          const { pending_sync, sync_attempts, sync_error, poisoned, ...rest } = record.data;
          payloadData = { ...rest, synced: true, _clientId: clientId };
        }

        const { error } = await supabase.rpc("upsert_cadence_sync_record", {
          p_store_name: record.store,
          p_record_id: record.id,
          p_data: payloadData,
          p_updated_at: record.updatedAt,
          p_deleted: false,
        });

        if (error) {
          console.error(`Failed to push record ${record.store}:${record.id} to Supabase:`, error);
          failedCount++;
          await recordSyncFailure(record.store, record.id, error.message, false);
        } else {
          pushedCount++;
          if (record.data) {
            await clearPendingSyncFlag(record.store, record.id, record.data);
          }
        }
      }
    } catch (pushError) {
      console.error(`Network error pushing record ${record.store}:${record.id}:`, pushError);
      failedCount++;
      const msg = pushError instanceof Error ? pushError.message : String(pushError);
      await recordSyncFailure(record.store, record.id, msg, record.deleted);
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

/**
 * Global Sync Reconciliation Logic:
 * 1. Fetches all sync records for the authenticated user from Supabase.
 * 2. Compares active cloud IDs against local IndexedDB records across EVERY entity store.
 * 3. Explicitly executes local DELETE operations for any records that exist locally but are
 *    missing from Supabase (deleted on another device or removed in cloud).
 * 4. Hydrates and merges incoming newer modifications into local storage.
 */
export async function pullRemoteRecords(): Promise<boolean> {
  if (!isOnline()) return false;
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;
  const lastSyncTimestamp = await getLastSyncTimestamp();

  try {
    const PAGE_SIZE = 1000;
    let from = 0;
    const allRows: RemoteSyncRow[] = [];

    // Paginate using .range(from, to) to safely fetch all cloud sync records for this user
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(SYNC_TABLE)
        .select("store_name, record_id, data, updated_at, deleted")
        .eq("user_id", userId)
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

    let hasChanges = false;
    let newestTimestamp = lastSyncTimestamp;

    // 1. Map all active remote record IDs by store (where deleted === false)
    const activeRemoteIdsByStore = new Map<string, Set<string>>();
    for (const store of RECONCILED_ENTITY_STORES) {
      activeRemoteIdsByStore.set(store, new Set<string>());
    }

    for (const row of allRows) {
      if (!row.deleted) {
        activeRemoteIdsByStore.get(row.store_name)?.add(row.record_id);
      }
    }

    // 2. Hydrate/update local store with remote records
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

      // Remote tombstone: delete from local IndexedDB if present
      if (record.deleted) {
        if (local) {
          await mergeSyncRecord(record);
          localMap.delete(`${record.store}-${record.id}`);
          hasChanges = true;
        }
      } else if (!local || localTime < remoteTime) {
        await mergeSyncRecord(record);
        localMap.set(`${record.store}-${record.id}`, record);
        hasChanges = true;
      }

      if (record.updatedAt > newestTimestamp) {
        newestTimestamp = record.updatedAt;
      }
    }

    // 3. Global Reconciliation Across EVERY Entity:
    // Compare local records against active IDs fetched from Supabase.
    // If a record exists locally with synced: true (or without pending offline changes)
    // but is completely missing from Supabase's active IDs, explicitly delete it locally.
    for (const store of RECONCILED_ENTITY_STORES) {
      const activeIds = activeRemoteIdsByStore.get(store) ?? new Set<string>();
      const localStoreItems = await getAllItemsFromStore(store);

      for (const localItem of localStoreItems) {
        // Active in cloud: keep
        if (activeIds.has(localItem.id)) {
          continue;
        }

        // Offline safety: protect locally-created or edited items that haven't pushed yet
        if (localItem.pending_sync === true || localItem.synced === false) {
          continue;
        }

        // The item was previously synced with cloud, but is no longer active in Supabase cloud.
        // It was deleted on mobile/another device or removed in Supabase.
        // Explicitly execute local DELETE operation!
        await removeLocalOnly(store, localItem.id);
        await clearTombstone(store, localItem.id);
        hasChanges = true;
      }
    }

    if (newestTimestamp !== lastSyncTimestamp) {
      await setLastSyncTimestamp(newestTimestamp);
    }

    return hasChanges;
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
