import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/auth/auth-context";

import {
  BACKUP_STATUS_CHANGED_EVENT,
  DEFAULT_SNOOZE_DAYS,
  downloadJsonBackup,
  isBackupExportNeeded,
  isBackupReminderDue,
  markBackupComplete,
  snoozeBackupReminder,
} from "@/lib/backup";

interface UseWeeklyBackupReminderOptions {
  /** Skip the check (e.g. while the store is still loading). Defaults to true. */
  enabled?: boolean | undefined;
}

export interface WeeklyBackupReminderState {
  /** True when a backup is due and not currently snoozed. */
  isDue: boolean;
  /** Backwards compatibility alias for `isDue`. */
  visible: boolean;
  /** Export the Dexie snapshot to JSON, refresh the timestamp, and dismiss the reminder. */
  exportBackup: () => void;
  /** Snoozes the reminder for 7-14 days via local-storage timestamp. */
  snoozeReminder: (days?: number) => void;
  /** Dismisses the reminder, persisting the dismissal for 7-14 days. */
  dismissReminder: (days?: number) => void;
  /** Manually re-check backup staleness and snooze status. */
  refreshStatus: () => void;
}

/**
 * Hook providing reactive backup status for the navigation bar badge.
 * Subscribes to window events so state updates instantly across the app.
 * Returns `isDue: true` whenever the user has not exported a JSON backup
 * (or it is older than 7 days). This powers the yellow dot on the Settings icon.
 *
 * NOTE: If the user has an active Supabase session, their data is already safely
 * backed up and synchronized to the cloud. The reminder is disabled entirely.
 */
export function useBackupReminderStatus() {
  const [isDue, setIsDue] = useState(false);
  const { session } = useAuth();

  const checkStatus = useCallback(() => {
    // Suppress and disable reminder if the user is authenticated to Supabase cloud
    if (session) {
      setIsDue(false);
      return;
    }
    setIsDue(isBackupExportNeeded());
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      setIsDue(false);
      return;
    }

    checkStatus();

    window.addEventListener(BACKUP_STATUS_CHANGED_EVENT, checkStatus);
    window.addEventListener("storage", checkStatus);
    window.addEventListener("focus", checkStatus);
    window.addEventListener("pageshow", checkStatus);
    return () => {
      window.removeEventListener(BACKUP_STATUS_CHANGED_EVENT, checkStatus);
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("focus", checkStatus);
      window.removeEventListener("pageshow", checkStatus);
    };
  }, [checkStatus, session]);

  return { isDue: session ? false : isDue, checkStatus };
}

/**
 * Smart Weekly Auto-Backup reminder hook for the Settings page inline banner.
 *
 * Checks `localStorage` on the client after mount. When no backup exists yet,
 * or the last one is older than 7 days — and the reminder is not snoozed — it flags
 * `isDue` to true.
 *
 * If the user is logged into Supabase (authenticated), this prompt is completely
 * hidden and disabled because data is continually synchronized to the cloud.
 *
 * SSR-safe: storage checks happen inside `useEffect`; initial render is false.
 *
 * @param exportData - Serializer returning the full JSON snapshot (store's `exportData()`).
 * @param options - Optional `enabled` flag.
 */
export function useWeeklyBackupReminder(
  exportData?: () => string,
  options?: UseWeeklyBackupReminderOptions,
): WeeklyBackupReminderState {
  const { session } = useAuth();
  const enabled = (options?.enabled ?? true) && !session;
  const [isDue, setIsDue] = useState(false);
  const { t } = useTranslation();

  const checkStatus = useCallback(() => {
    // Disable JSON backup reminder prompt when authenticated to Supabase cloud
    if (session) {
      setIsDue(false);
      return;
    }
    setIsDue(isBackupReminderDue());
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      setIsDue(false);
      return;
    }

    checkStatus();

    window.addEventListener(BACKUP_STATUS_CHANGED_EVENT, checkStatus);
    window.addEventListener("storage", checkStatus);
    window.addEventListener("focus", checkStatus);
    window.addEventListener("pageshow", checkStatus);
    return () => {
      window.removeEventListener(BACKUP_STATUS_CHANGED_EVENT, checkStatus);
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("focus", checkStatus);
      window.removeEventListener("pageshow", checkStatus);
    };
  }, [checkStatus, session]);

  const snooze = useCallback((days: number = DEFAULT_SNOOZE_DAYS) => {
    snoozeBackupReminder(days);
    setIsDue(false);
  }, []);

  const dismiss = useCallback((days: number = DEFAULT_SNOOZE_DAYS) => {
    snoozeBackupReminder(days);
    setIsDue(false);
  }, []);

  const exportDataRef = useRef(exportData);
  useEffect(() => {
    exportDataRef.current = exportData;
  }, [exportData]);

  // Export immediately from user gesture, then mark backup complete and refresh state.
  const exportBackup = useCallback(() => {
    try {
      if (!exportDataRef.current) {
        throw new Error("No export serializer provided");
      }
      const json = exportDataRef.current();
      downloadJsonBackup(json);
      markBackupComplete();
      toast.success(t("backup.success"));
    } catch {
      toast.error(t("backup.error"));
    }
  }, [t]);

  return {
    isDue: enabled ? isDue : false,
    visible: enabled ? isDue : false,
    exportBackup,
    snoozeReminder: snooze,
    dismissReminder: dismiss,
    refreshStatus: checkStatus,
  };
}
