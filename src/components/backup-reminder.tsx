import { Download, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

interface BackupReminderProps {
  /** Controls reminder visibility. */
  visible?: boolean;
  /** Triggers data export and clears the reminder. */
  onExport: () => void;
  /** Snoozes the reminder for 7-14 days. */
  onSnooze: () => void;
  /** Dismisses the reminder (persisting snooze). */
  onDismiss: () => void;
  className?: string;
}

/**
 * Minimalist, non-floating inline backup reminder.
 *
 * Renders as a compact, subtle inline alert strip inside the Settings page.
 * Completely in-flow (never fixed or floating) so it never blocks UI elements.
 */
export function BackupReminder({
  visible = true,
  onExport,
  onSnooze,
  onDismiss,
  className,
}: BackupReminderProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t("backup.ariaLabel")}
      className={cn(
        // Pure in-flow layout — no fixed, no absolute, no floating
        "relative flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        // Sleek, minimal rounded strip with subtle tint and soft border
        "rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 px-3.5 py-3 text-card-foreground",
        // Smooth fade-in without jarring position shift
        "animate-in fade-in duration-200",
        className,
      )}
    >
      {/* Icon + Brief text */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          aria-hidden="true"
          className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium leading-tight text-foreground truncate">
            {t("backup.title")}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight mt-0.5">
            {t("backup.descShort", "Export a copy to keep your habit progress safe.")}
          </p>
        </div>
      </div>

      {/* Action buttons & dismiss */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <Button
          type="button"
          size="sm"
          onClick={onExport}
          className="h-7.5 px-2.5 text-xs font-medium gap-1.5 rounded-lg shadow-none"
        >
          <Download className="h-3 w-3" />
          {t("backup.export")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSnooze}
          className="h-7.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          {t("backup.later")}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("backup.dismiss")}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

