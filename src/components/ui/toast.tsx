import { Snowflake, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Data for the premium streak-freeze toast. Rendered through sonner's
 * `toast.custom`, so it inherits the global <Toaster /> mount (bottom-right on
 * desktop; bottom-center / full-width on mobile via styles.css).
 */
export interface FreezeToastData {
  habitName?: string;
  /** Freezes consumed this calendar month (including the one just applied). */
  used: number;
  /** The habit's monthly freeze limit. */
  max: number;
  /** Days left until the limit resets on the 1st of the next month. */
  daysUntilReset: number;
}

/** Must match the sweep animation duration declared in styles.css. */
const FREEZE_TOAST_DURATION = 4500;

export function FreezeToastContent({
  habitName,
  used,
  max,
  daysUntilReset,
  onDismiss,
}: FreezeToastData & { onDismiss: () => void }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));

  return (
    <div
      className="pointer-events-auto w-full max-w-sm cursor-default select-none overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-900/10 transition-all hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/70 bg-cyan-50 text-cyan-500 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
          <Snowflake className="h-5 w-5 animate-[spin_6s_linear_infinite]" />
        </div>

        <div className="min-w-0 flex-1">
          {habitName ? (
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-cyan-600/80 dark:text-cyan-400/80">
              {habitName}
            </p>
          ) : null}
          <p className="text-sm font-semibold leading-tight">❄️ Habit Frozen!</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Freezes this month:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {used} of {max}
            </span>
            . Limit resets in {daysUntilReset} {daysUntilReset === 1 ? "day" : "days"}.
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          className="-m-1 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Monthly quota meter */}
      <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-500 dark:bg-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Auto-dismiss sweep — mirrors the 4.5s sonner duration */}
      <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800">
        <div className="freeze-toast-progress h-full bg-gradient-to-r from-cyan-400 to-sky-500 dark:from-cyan-500 dark:to-sky-600" />
      </div>
    </div>
  );
}

/**
 * Fires the premium freeze toast. Non-blocking (pointer-events pass through
 * around the toast) and auto-dismisses after ~4.5 seconds.
 */
export function showFreezeToast(data: FreezeToastData) {
  if (typeof window === "undefined") return;
  toast.custom((id) => <FreezeToastContent {...data} onDismiss={() => toast.dismiss(id)} />, {
    duration: FREEZE_TOAST_DURATION,
  });
}
