import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";

import { useSync } from "@/context/sync-context";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Subtle connectivity & sync indicator for the app header.
 *
 * Displays:
 * - "Offline" badge when network connection is lost, indicating that changes are kept locally.
 * - "Syncing..." subtle spinning badge when background push/pull is actively syncing data.
 * - Briefly displays "Back online" on reconnection, then disappears into the background.
 *
 * Keeps Cadence completely clean, non-intrusive, and strictly English.
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount } = useSync();
  const wasOffline = useRef(false);
  const [showSyncedBriefly, setShowSyncedBriefly] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowSyncedBriefly(false);
      return;
    }

    if (wasOffline.current && !isSyncing) {
      setShowSyncedBriefly(true);
      const timer = window.setTimeout(() => {
        wasOffline.current = false;
        setShowSyncedBriefly(false);
      }, 2500);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline, isSyncing]);

  // While online and not syncing, hide to keep header clean
  if (isOnline && !isSyncing && !showSyncedBriefly) {
    return null;
  }

  // Active sync state
  if (isOnline && isSyncing) {
    return (
      <span
        role="status"
        aria-live="polite"
        title={t("sync.syncingTooltip", "Syncing changes with cloud...")}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-all duration-200",
          "border-primary/40 bg-primary/10 text-primary",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">{t("sync.syncing", "Syncing...")}</span>
      </span>
    );
  }

  // Offline state
  if (!isOnline) {
    const offlineTitle =
      pendingCount > 0
        ? `${t("offline.offline", "Offline")} • ${pendingCount} pending sync`
        : t("offline.hint", "Your data is saved on this device — Cadence keeps working offline.");

    return (
      <span
        role="status"
        aria-live="polite"
        title={offlineTitle}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-all duration-200",
          "border-warning/40 bg-warning/10 text-warning",
          className,
        )}
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("offline.offline", "Offline")}</span>
        {pendingCount > 0 && (
          <span className="text-[10px] opacity-80" aria-hidden="true">
            ({pendingCount})
          </span>
        )}
      </span>
    );
  }

  // Reconnected confirmation
  return (
    <span
      role="status"
      aria-live="polite"
      title={t("offline.backOnline", "Back online")}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-all duration-200",
        "border-success/40 bg-success/10 text-success",
        className,
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t("offline.backOnline", "Back online")}</span>
    </span>
  );
}
