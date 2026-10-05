/**
 * Smart Weekly Auto-Backup helpers for the offline-first Dexie/IndexedDB database.
 *
 * Browsers block automatic file downloads without a user gesture, so Cadence
 * cannot silently write a backup file. Instead we store the last successful
 * backup timestamp in `localStorage` and surface an inline reminder with an
 * "Export Backup" action once the backup becomes stale (> 7 days old).
 *
 * This module performs no network I/O and is safe to import during SSR. Every
 * function that touches `window` / `localStorage` / `document` guards against
 * server rendering and private-mode storage failures.
 */

/** LocalStorage key holding the last successful backup timestamp. */
export const LAST_BACKUP_STORAGE_KEY = "cadence_last_backup_date";

/** LocalStorage key holding the snooze timestamp for the backup reminder. */
export const BACKUP_SNOOZE_STORAGE_KEY = "cadence_backup_reminder_snoozed_until";

/** How long a backup is considered fresh (7 days in milliseconds). */
export const WEEKLY_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default snooze duration: 7 days in milliseconds (configurable up to 14 days). */
export const DEFAULT_SNOOZE_DAYS = 7;

/** Event dispatched to synchronize backup status across components without page refresh. */
export const BACKUP_STATUS_CHANGED_EVENT = "cadence:backup-status-changed";

/**
 * Dispatch a custom event to notify all listeners that backup state has changed
 * (e.g., backup downloaded, reminder snoozed or dismissed).
 */
export function notifyBackupStatusChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(BACKUP_STATUS_CHANGED_EVENT));
  } catch {
    // Fail quietly if CustomEvent or window is unavailable.
  }
}

/**
 * Read the last backup timestamp from `localStorage`.
 *
 * Accepts both numeric epoch-ms strings (written by this feature) and ISO date
 * strings (forward compatible with manual writes). Returns `null` when the key
 * is missing, unreadable, or unparsable — which the scheduler treats as "due".
 *
 * @returns Epoch milliseconds of the last backup, or `null` when unknown.
 */
export function getLastBackupTime(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
    if (!raw) return null;
    // Numeric epoch-ms (the canonical format written by `markBackupComplete`).
    if (/^\d+$/.test(raw.trim())) {
      const ms = Number(raw);
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    // Fallback: ISO date string.
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    // Storage can throw in private mode or when cookies are blocked.
    // Treat as unknown so the caller can decide; the hook swallows this.
    return null;
  }
}

/**
 * Decide whether a weekly backup reminder is due.
 *
 * @param lastBackupMs - Epoch ms of the last backup, or `null` when never backed up.
 * @param nowMs - Current epoch ms (defaults to `Date.now()`; injectable for tests).
 * @returns `true` when no backup exists or the last one is older than 7 days.
 */
export function isWeeklyBackupDue(
  lastBackupMs: number | null,
  nowMs: number = Date.now(),
): boolean {
  if (lastBackupMs === null || !Number.isFinite(lastBackupMs)) return true;
  // Clock moved backwards or a future timestamp was stored — do not nag.
  if (lastBackupMs > nowMs) return false;
  return nowMs - lastBackupMs >= WEEKLY_BACKUP_INTERVAL_MS;
}

/**
 * Check if the user hasn't exported the JSON backup file (either never exported,
 * or older than 7 days). This powers the yellow indicator dot on the Settings icon.
 * Unlike the inline Settings banner, this indicator does not get hidden by snooze:
 * it stays active as a subtle badge until the user actually exports their JSON file.
 */
export function isBackupExportNeeded(nowMs: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lastBackup = getLastBackupTime();
    return isWeeklyBackupDue(lastBackup, nowMs);
  } catch {
    return false;
  }
}

/**
 * Check if the backup reminder is due right now, taking both the snooze timestamp
 * and the last backup time into account.
 *
 * @param nowMs - Current epoch ms (defaults to `Date.now()`).
 * @returns `true` if a backup is due and not currently snoozed.
 */
export function isBackupReminderDue(nowMs: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const snoozedUntil = getBackupSnoozedUntil();
    if (snoozedUntil !== null && snoozedUntil > nowMs) {
      return false;
    }
    const lastBackup = getLastBackupTime();
    return isWeeklyBackupDue(lastBackup, nowMs);
  } catch {
    return false;
  }
}

/**
 * Record a successful backup so the reminder stays quiet for the next 7 days.
 * Failures (private mode, blocked storage) are swallowed — the reminder will
 * simply appear again on the next visit, which is the safe fallback.
 */
export function markBackupComplete(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_BACKUP_STORAGE_KEY, String(nowMs));
    notifyBackupStatusChanged();
  } catch {
    // Intentionally ignored: offline-first reminder degrades to always-due.
  }
}

/**
 * Read the backup-reminder snooze timestamp from `localStorage`.
 *
 * @returns Epoch milliseconds until which the reminder stays snoozed, or `null`.
 */
export function getBackupSnoozedUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKUP_SNOOZE_STORAGE_KEY);
    if (!raw) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    // Storage can throw in private mode — treat as not snoozed.
    return null;
  }
}

/**
 * Snooze the backup reminder for 7-14 days. Persists a timestamp in localStorage
 * so that dismissing or clicking "Later" suppresses the reminder.
 *
 * @param days - Number of days to snooze (default: 7).
 * @param nowMs - Current epoch ms (defaults to `Date.now()`; injectable for tests).
 */
export function snoozeBackupReminder(
  days: number = DEFAULT_SNOOZE_DAYS,
  nowMs: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  try {
    const snoozeDurationMs = Math.max(1, days) * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(BACKUP_SNOOZE_STORAGE_KEY, String(nowMs + snoozeDurationMs));
    notifyBackupStatusChanged();
  } catch {
    // Intentionally ignored: the reminder simply reappears next visit.
  }
}

/**
 * Clear any active snooze so the reminder can surface again immediately.
 */
export function clearBackupSnooze(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BACKUP_SNOOZE_STORAGE_KEY);
    notifyBackupStatusChanged();
  } catch {
    // Intentionally ignored.
  }
}

/**
 * Build a stable, human-sortable backup file name (`cadence-export-YYYY-MM-DD.json`),
 * matching the convention already used by the Settings screen.
 */
export function buildBackupFileName(now: Date = new Date()): string {
  return `cadence-export-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Trigger a JSON file download. Must be called from a user gesture (the banner
 * "Export Backup" action) so the browser does not block it as an unwanted
 * automatic download.
 *
 * @param json - Serialized snapshot produced by the store's `exportData()`.
 * @param fileName - Optional override for the download file name.
 */
export function downloadJsonBackup(json: string, fileName?: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName ?? buildBackupFileName();
    // Appending to the DOM keeps the click working in Firefox/Safari.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke asynchronously so large backups finish streaming first.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

