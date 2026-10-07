import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  getLastPushTimestamp,
  getLastSyncTimestamp,
  getSyncRecords,
  mergeSyncRecord,
  setLastPushTimestamp,
  setLastSyncTimestamp,
  type SyncRecord,
} from "@/database/repository";

const SYNC_TABLE = "cadence_sync_records";
let syncInFlight: Promise<void> | null = null;

interface RemoteSyncRow {
  store_name: string;
  record_id: string;
  data: Record<string, unknown> | null;
  updated_at: string;
  deleted: boolean;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name !== "AuthSessionMissingError") {
      console.error("Unable to read the Supabase user for sync.", error);
    }
    return null;
  }
  return data.user?.id ?? null;
}

export async function pushPendingRecords(): Promise<void> {
  if (!isOnline()) return;
  const userId = await getAuthenticatedUserId();
  if (!userId) return;

  const lastPushTimestamp = await getLastPushTimestamp();
  const records = (await getSyncRecords()).filter((record) => record.updatedAt > lastPushTimestamp);
  if (records.length === 0) return;
  const results = await Promise.all(
    records.map((record) =>
      supabase.rpc("upsert_cadence_sync_record", {
        p_store_name: record.store,
        p_record_id: record.id,
        p_data: record.data,
        p_updated_at: record.updatedAt,
        p_deleted: record.deleted,
      }),
    ),
  );
  const failed = results.find(({ error }) => error);
  if (failed?.error) {
    console.error("Unable to push local changes to Supabase.", failed.error);
    return;
  }
  const newestTimestamp = records.reduce(
    (latest, record) => (record.updatedAt > latest ? record.updatedAt : latest),
    lastPushTimestamp,
  );
  await setLastPushTimestamp(newestTimestamp);
}

export async function pullRemoteRecords(): Promise<boolean> {
  if (!isOnline()) return false;
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;
  const lastSyncTimestamp = await getLastSyncTimestamp();
  const { data, error } = await supabase
    .from(SYNC_TABLE)
    .select("store_name, record_id, data, updated_at, deleted")
    .eq("user_id", userId)
    .gt("updated_at", lastSyncTimestamp)
    .order("updated_at", { ascending: true });
  if (error) {
    console.error("Unable to pull remote changes from Supabase.", error);
    return false;
  }

  let newestTimestamp = lastSyncTimestamp;
  for (const row of (data ?? []) as RemoteSyncRow[]) {
    const syncData =
      row.data && typeof row.data["id"] === "string" ? (row.data as SyncRecord["data"]) : null;
    const record: SyncRecord = {
      store: row.store_name,
      id: row.record_id,
      data: syncData,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    };
    const local = (await getSyncRecords()).find(
      (candidate) => candidate.store === record.store && candidate.id === record.id,
    );
    if (!local || local.updatedAt < record.updatedAt) {
      await mergeSyncRecord(record);
    }
    if (record.updatedAt > newestTimestamp) newestTimestamp = record.updatedAt;
  }
  if (newestTimestamp !== lastSyncTimestamp) {
    await setLastSyncTimestamp(newestTimestamp);
  }
  return (data?.length ?? 0) > 0;
}

export async function syncNow(): Promise<boolean> {
  if (syncInFlight) {
    await syncInFlight;
    return false;
  }
  syncInFlight = (async () => {
    await pullRemoteRecords();
    await pushPendingRecords();
  })().finally(() => {
    syncInFlight = null;
  });
  await syncInFlight;
  return true;
}

export async function syncOnAuthChange(): Promise<void> {
  await syncNow();
}
