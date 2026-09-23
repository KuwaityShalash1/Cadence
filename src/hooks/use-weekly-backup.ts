import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  downloadJsonBackup,
  getBackupSnoozedUntil,
  getLastBackupTime,
  isWeeklyBackupDue,
  markBackupComplete,
  snoozeBackupReminder,
} from "@/lib/backup";

/** Delay before showing the reminder so the app shell has mounted. */
const DEFAULT_REMINDER_DELAY_MS = 2000;

interface UseWeeklyBackupReminderOptions {
  /** Skip the check (e.g. while the store is still loading). Defaults to true. */
  enabled?: boolean;
  /** Delay before the banner appears. Defaults to 2000ms. */
  delayMs?: number;
}

export interface WeeklyBackupReminderState {
  /** True when the floating banner should be visible. */
  visible: boolean;
  /** Export the Dexie snapshot to JSON, refresh the timestamp, and hide the banner. */
  exportBackup: () => void;
  /** Snooze the banner for 7 days and hide it. */
  snoozeReminder: () => void;
  /** Hide the banner for this session without persisting anything. */
  dismissReminder: () => void;
}

/**
 * Smart Weekly Auto-Backup reminder for the offline-first IndexedDB database.
 *
 * Checks `localStorage` (`cadence_last_backup_date`) on the client after mount.
 * When no backup exists yet, or the last one is older than 7 days — and the
 * banner is not snoozed (`cadence_backup_reminder_snoozed_until`) — it flips
 * `visible` to true so the floating `BackupReminder` banner can render.
 *
 * The download only runs inside the `exportBackup` click handler, which
 * satisfies browser auto-download policies that block programmatic downloads
 * without a user gesture. After a successful download the timestamp is
 * refreshed so the reminder stays quiet for another 7 days.
 *
 * SSR-safe: all storage work happens inside `useEffect`; the initial render
 * is always hidden so server and client HTML match.
 *
 * @param exportData - Serializer returning the full JSON snapshot (store's `exportData()`).
 * @param options - Optional `enabled` flag and `delayMs` banner delay.
 */
export function useWeeklyBackupReminder(
  exportData: () => string,
  options?: UseWeeklyBackupReminderOptions,
): WeeklyBackupReminderState {
  const enabled = options?.enabled ?? true;
  const delayMs = options?.delayMs ?? DEFAULT_REMINDER_DELAY_MS;
  const [visible, setVisible] = useState(false);

  // Keep the latest serializer without re-subscribing the effect on every render.
  const exportDataRef = useRef(exportData);
  useEffect(() => {
    exportDataRef.current = exportData;
  }, [exportData]);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    // Bail out unless a backup is actually due — fresh backups stay silent.
    let lastBackup: number | null;
    let snoozedUntil: number | null;
    try {
      lastBackup = getLastBackupTime();
      snoozedUntil = getBackupSnoozedUntil();
    } catch {
      lastBackup = null;
      snoozedUntil = null;
    }
    // Respect an active 7-day snooze before checking staleness.
    if (snoozedUntil !== null && snoozedUntil > Date.now()) return;
    if (!isWeeklyBackupDue(lastBackup)) return;

    // Small delay lets the app shell mount first so the entrance feels calm.
    const timerId = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [enabled, delayMs]);

  // Export immediately from the user gesture, then dismiss the banner.
  const exportBackup = useCallback(() => {
    try {
      const json = exportDataRef.current();
      downloadJsonBackup(json);
      markBackupComplete();
      setVisible(false);
      toast.success("Backup downloaded — your data is safe.");
    } catch {
      toast.error("Could not create the backup. Try again from Settings.");
    }
  }, []);

  // Persist a 7-day snooze timestamp and hide the banner quietly.
  const snoozeReminder = useCallback(() => {
    try {
      snoozeBackupReminder();
    } catch {
      // Storage failures degrade to a session-only dismiss below.
    }
    setVisible(false);
  }, []);

  // Session-only hide (e.g. close affordance); nothing is persisted.
  const dismissReminder = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, exportBackup, snoozeReminder, dismissReminder };
}
