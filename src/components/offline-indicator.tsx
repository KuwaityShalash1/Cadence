import { useEffect, useRef, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Subtle connectivity pill for the app header.
 *
 * Renders nothing while the browser is online, shows an amber "Offline" badge
 * when it is not, and briefly confirms the reconnect afterwards. It is purely
 * informational: Cadence reads and writes everything locally, so the UI stays
 * fully interactive either way.
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnected(false);
      return;
    }
    if (!wasOffline.current) return;

    setShowReconnected(true);
    const timer = window.setTimeout(() => {
      wasOffline.current = false;
      setShowReconnected(false);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      title={isOnline ? t("offline.backOnline") : t("offline.hint")}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
        isOnline
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
        className,
      )}
    >
      {isOnline ? <CheckCircle2 className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">
        {isOnline ? t("offline.backOnline") : t("offline.offline")}
      </span>
    </span>
  );
}
