import { Download, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface BackupReminderProps {
  /** Controls banner visibility (driven by `useWeeklyBackupReminder`). */
  visible: boolean;
  /** Immediately triggers `downloadBackup()` and dismisses the banner. */
  onExport: () => void;
  /** Snoozes the reminder for 7 days via local-storage timestamp. */
  onSnooze: () => void;
  /** Session-only hide without persisting anything. */
  onDismiss: () => void;
  className?: string;
}

/**
 * Modern floating JSON backup reminder banner.
 *
 * Uses only shadcn/ui semantic tokens (`bg-card`, `text-card-foreground`,
 * `border-border`, `text-muted-foreground`, `bg-primary`) so it adapts to
 * both dark and light mode with no hardcoded colors. Rendered as a fixed,
 * non-intrusive bottom banner with safe-area padding, above content but
 * below the sheet/dialog layer.
 */
export function BackupReminder({
  visible,
  onExport,
  onSnooze,
  onDismiss,
  className,
}: BackupReminderProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Backup reminder"
      className={cn(
        // Fixed floating placement — clears the mobile bottom nav via bottom offset.
        "fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-6 md:px-6",
        // Smooth entrance each time the banner mounts.
        "animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out",
        className,
      )}
    >
      <div
        className={cn(
          // Responsive width: full-bleed with gutter on mobile, compact on desktop.
          "w-[calc(100%-2rem)] mx-auto max-w-xl",
          // Semantic card surface — theme-aware in both light and dark mode.
          "rounded-2xl border border-border/80 bg-card text-card-foreground shadow-lg backdrop-blur-md",
          // Tight, balanced padding with smooth color transitions.
          "p-4 sm:p-5 transition-colors duration-300",
        )}
      >
        <div className="flex items-start gap-3">
          {/* Subtle icon container using primary tint. */}
          <span aria-hidden="true" className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-5">Protect your habit history</p>
              {/* Session-only close affordance. */}
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss backup reminder"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              You haven&apos;t exported a JSON backup recently. Since Cadence is offline-first,
              manual backups ensure your progress is never lost.
            </p>

            {/* Action row: immediate export + 7-day snooze. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExport}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.97]"
              >
                <Download className="h-4 w-4" />
                Export Backup (JSON)
              </button>
              <button
                type="button"
                onClick={onSnooze}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
