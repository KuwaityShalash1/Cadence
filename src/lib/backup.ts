/**
 * Smart Weekly Auto-Backup helpers for the offline-first Dexie/IndexedDB database.
 *
 * Browsers block automatic file downloads without a user gesture, so Cadence
 * cannot silently write a backup file. Instead we store the last successful
 * backup timestamp in `localStorage` and surface a floating banner reminder
 * with an "Export Backup" action once the backup becomes stale (> 7 days old).
 *
 * This module performs no network I/O and is safe to import during SSR. Every
 * function that touches `window` / `localStorage` / `document` guards against
 * server rendering and private-mode storage failures.
 */

/** LocalStorage key holding the last successful backup timestamp. */
export const LAST_BACKUP_STORAGE_KEY = "cadence_last_backup_date";

/** LocalStorage key holding the snooze timestamp for the backup reminder banner. */
export const BACKUP_SNOOZE_STORAGE_KEY = "cadence_backup_reminder_snoozed_until";

/** How long a backup is considered fresh (7 days in milliseconds). */
export const WEEKLY_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

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
 * Record a successful backup so the reminder stays quiet for the next 7 days.
 * Failures (private mode, blocked storage) are swallowed — the reminder will
 * simply appear again on the next visit, which is the safe fallback.
 */
export function markBackupComplete(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_BACKUP_STORAGE_KEY, String(nowMs));
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
 * Snooze the backup reminder banner for 7 days.
 *
 * @param nowMs - Current epoch ms (defaults to `Date.now()`; injectable for tests).
 */
export function snoozeBackupReminder(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      BACKUP_SNOOZE_STORAGE_KEY,
      String(nowMs + WEEKLY_BACKUP_INTERVAL_MS),
    );
  } catch {
    // Intentionally ignored: the banner simply reappears next visit.
  }
}

/**
 * Clear any active snooze so the reminder can surface again immediately.
 */
export function clearBackupSnooze(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BACKUP_SNOOZE_STORAGE_KEY);
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
