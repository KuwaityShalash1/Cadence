import { useState, useEffect } from "react";
import {
  Clock,
  Flame,
  History,
  Trash2,
  Pencil,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  PlusCircle,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import { todayKey } from "@/services/dates";
import type { BadHabit, UsageLog } from "@/types";
import { RelapseModal } from "./relapse-modal";
import { BadHabitEditor } from "./bad-habit-editor";
import { TRIGGER_OPTIONS } from "./constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface BadHabitCardProps {
  habit: BadHabit;
}

export function BadHabitCard({ habit }: BadHabitCardProps) {
  const { removeBadHabit, restoreBadHabit, customIcons, logUsage } = useApp();
  const { t } = useTranslation();
  const [now, setNow] = useState<number>(Date.now());
  const [relapseOpen, setRelapseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Limit strategy: track usage dialog state
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [usageValue, setUsageValue] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate today's usage for limit strategy
  const isLimitStrategy = habit.strategy === "limit";
  const todayUsage = isLimitStrategy
    ? ((habit.usageLogs ?? []).filter((log: UsageLog) => log.date === todayKey()).reduce((sum, log) => sum + log.value, 0) || 0)
    : 0;
  const limitValue = habit.limitValue ?? 0;
  const usagePercentage = limitValue > 0 ? Math.min(100, (todayUsage / limitValue) * 100) : 0;
  const isLimitExceeded = todayUsage > limitValue;

  const elapsedMs = Math.max(0, now - habit.quitDate);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const currentStreakHours = elapsedMs / (1000 * 60 * 60);
  const maxHistoryHours = habit.history.reduce((max, r) => Math.max(max, r.streakDurationHours), 0);
  const longestStreakHours = Math.max(currentStreakHours, maxHistoryHours);

  // Format streak for cold-turkey: show detailed hours/minutes (e.g., "1d 4h")
  function formatStreakHours(hoursVal: number): string {
    if (hoursVal < 24) return `${Math.floor(hoursVal)} hrs`;
    const d = Math.floor(hoursVal / 24);
    const h = Math.floor(hoursVal % 24);
    return `${d}d ${h}h`;
  }

  // Format streak for limit strategy: show whole days only (e.g., "5 Days")
  // Limit adherence is evaluated on a daily basis, not per second.
  function formatStreakDays(hoursVal: number): string {
    const d = Math.floor(hoursVal / 24);
    return `${d} Day${d !== 1 ? "s" : ""}`;
  }

  const styles = getColorStyle(habit.color ?? "rose");

  function handleDelete() {
    // No blocking confirm modal — delete immediately, but snapshot the whole
    // tracker (relapse history included) so the toast's Undo can restore it.
    const trackerToRestore = structuredClone(habit);
    removeBadHabit(habit.id);
    toast.success(t("quitTracker.deletedToast", "Quit tracker deleted"), {
      action: {
        label: t("common.undo", "Undo"),
        onClick: () => restoreBadHabit(trackerToRestore),
      },
      duration: 5000, // Give them 5 seconds to undo
    });
  }
  // Single-column card: full row width with extra vertical breathing room on
  // desktop. min-w-0 + overflow-x-clip guarantee badges never bleed past borders.
  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5 overflow-x-clip rounded-2xl border border-border bg-card p-4 sm:py-6 sm:px-6 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn("grid h-10 w-10 place-items-center rounded-xl shadow-sm", styles.tint)}
            style={{ backgroundColor: styles.tint }}
          >
            <HabitIcon
              name={habit.icon ?? "Flame"}
              customIcons={customIcons}
              className={cn("h-5 w-5", { color: styles.rawColor })}
            />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold tracking-tight leading-tight truncate">{habit.title}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="shrink-0">{t("quitTracker.quitDate")}:</span>
              <span className="font-medium text-foreground whitespace-nowrap">
                {new Date(habit.quitDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            aria-label="Edit tracker"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            aria-label="Delete tracker"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Live abstinence timer — shown only for cold-turkey trackers, not for moderation. */}
      {!isLimitStrategy && (
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-center space-y-2">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Current Abstinence Streak
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
            <div className="flex flex-col items-center bg-card rounded-lg p-2 border shadow-2xs">
              <span className="font-display text-xl font-extrabold text-foreground numeric">
                {days}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Days
              </span>
            </div>
            <div className="flex flex-col items-center bg-card rounded-lg p-2 border shadow-2xs">
              <span className="font-display text-xl font-extrabold text-foreground numeric">
                {String(hours).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Hours
              </span>
            </div>
            <div className="flex flex-col items-center bg-card rounded-lg p-2 border shadow-2xs">
              <span className="font-display text-xl font-extrabold text-foreground numeric">
                {String(minutes).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Mins
              </span>
            </div>
            <div className="flex flex-col items-center bg-card rounded-lg p-2 border shadow-2xs">
              <span className="font-display text-xl font-extrabold text-primary numeric animate-pulse">
                {String(seconds).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Secs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Limit Strategy UI: Progress bar comes first for limit cards */}
      {isLimitStrategy ? (
        <div className="space-y-4 sm:space-y-5">
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 text-sm">
                <BarChart2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {t("quitTracker.dailyProgress", "Daily Progress")}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
                {todayUsage} / {limitValue} {limitValue === 1 && habit.limitType === "count" ? t("quitTracker.unitSingular", "unit") : t("quitTracker.unitPlural", "units")}
              </span>
            </div>
            <Progress
              value={usagePercentage}
              aria-label={t("quitTracker.dailyProgress", "Daily Progress")}
              className={cn(
                "h-2.5",
                isLimitExceeded ? "bg-destructive/20" : "",
              )}
            />
            {isLimitExceeded && (
              <div className="flex items-center gap-3 text-sm text-destructive font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>{t("quitTracker.limitExceeded", "Limit exceeded — streak reset!")}</span>
              </div>
            )}
          </div>
          {/* Streak row: Current Streak & Longest Streak — displayed after progress bar for limit cards */}
          {/* Responsive wrap: stack vertically on narrow screens, side-by-side on sm+. min-w-0 prevents overflow. */}
          <div className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-xl border bg-card px-3 py-2 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{t("quitTracker.currentStreak")}</span>
              <span className="shrink-0 font-semibold text-foreground whitespace-nowrap tabular-nums">
                {formatStreakDays(currentStreakHours)}
              </span>
            </div>
            <div className="rounded-xl border bg-card px-3 py-2 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{t("quitTracker.longestStreak")}</span>
              <span className="shrink-0 font-semibold text-primary flex items-center gap-1 whitespace-nowrap tabular-nums">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {formatStreakDays(longestStreakHours)}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 hover:border-primary transition-colors"
            onClick={() => {
              if (todayUsage >= limitValue) {
                toast.warning(t("quitTracker.limitAlreadyReached", "You've already reached your daily limit."));
                return;
              }
              setUsageDialogOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("quitTracker.logUsage", "Log Usage")}
          </Button>
        </div>
      ) : (
        /* Cold Turkey footer: live counter above already shows the current streak,
           so keep only Longest Streak plus a compact relapse summary. */
        <div className="space-y-4 sm:space-y-5">
          {/* Abstinence footer: stacks on mobile, spreads on sm+. flex-wrap + min-w-0 stops badge overflow. */}
          <div className="rounded-xl border bg-card px-3 py-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{t("quitTracker.longestStreak")}</span>
            <span className="shrink-0 font-semibold text-primary flex items-center gap-1 whitespace-nowrap tabular-nums">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {formatStreakHours(longestStreakHours)}
            </span>
          </div>
          {habit.history.length > 0 && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 font-medium whitespace-nowrap">
                <History className="h-3.5 w-3.5" />
                {habit.history.length} {habit.history.length === 1 ? "relapse" : "relapses"}
              </span>
              <span className="truncate tabular-nums">
                Last:{" "}
                {new Date(
                  Math.max(...habit.history.map((r) => r.relapsedAt)),
                ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-destructive/30 bg-destructive/5 text-destructive text-sm font-semibold hover:bg-destructive/10 hover:border-destructive transition-colors"
            onClick={() => setRelapseOpen(true)}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            {t("quitTracker.iRelapsed", "I Relapsed")}
          </Button>
        </div>
      )}

      {habit.history.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("quitTracker.relapseHistory", "Relapse History")} ({habit.history.length})
            </span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {habit.history.map((record) => {
                const triggerObj = TRIGGER_OPTIONS.find((t) => t.id === record.triggerCategory);
                return (
                  <div
                    key={record.id}
                    className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <span>{triggerObj?.emoji ?? "⚡"}</span>
                        <span>{triggerObj?.label ?? record.triggerCategory}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Streak was: {formatStreakHours(record.streakDurationHours)}
                      </span>
                    </div>
                    {record.detailedReason && (
                      <p className="text-muted-foreground italic pl-6">
                        &ldquo;{record.detailedReason}&rdquo;
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground pl-6">
                      {new Date(record.relapsedAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <RelapseModal
        open={relapseOpen}
        onOpenChange={setRelapseOpen}
        habitId={habit.id}
        habitTitle={habit.title}
      />

      <BadHabitEditor open={editOpen} onOpenChange={setEditOpen} habit={habit} />

      {/* Log Usage Dialog for Limit Strategy */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("quitTracker.logUsage", "Log Usage")}
            </DialogTitle>
            <DialogDescription>
              {habit.limitType === "time"
                ? t("quitTracker.logUsageTimeDesc", "How many minutes did you use today?")
                : t("quitTracker.logUsageCountDesc", "How many units did you use today?")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = parseInt(usageValue, 10);
              if (isNaN(value) || value <= 0) {
                toast.error(t("quitTracker.invalidUsageValue", "Please enter a valid number."));
                return;
              }
              logUsage(habit.id, value);
              setUsageDialogOpen(false);
              setUsageValue("");
              toast.success(
                habit.limitType === "time"
                  ? t("quitTracker.usageLoggedTime", `Logged ${value} minutes`)
                  : t("quitTracker.usageLoggedCount", `Logged ${value} units`),
              );
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="usage-value">
                {habit.limitType === "time" ? "Minutes" : "Units"}
              </Label>
              <Input
                id="usage-value"
                type="number"
                min={1}
                value={usageValue}
                onChange={(e) => setUsageValue(e.target.value)}
                placeholder={habit.limitType === "time" ? "e.g., 30" : "e.g., 2"}
                autoComplete="off"
                className="h-11"
                autoFocus
              />
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                {habit.limitType === "time" ? (
                  <>
                    Today's total: <strong>{todayUsage}</strong> / {limitValue} minutes
                    {todayUsage > 0 && (
                      <span className="block mt-1">
                        Remaining: <strong>{Math.max(0, limitValue - todayUsage)}</strong> minutes
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Today's total: <strong>{todayUsage}</strong> / {limitValue} units
                    {todayUsage > 0 && (
                      <span className="block mt-1">
                        Remaining: <strong>{Math.max(0, limitValue - todayUsage)}</strong> units
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setUsageDialogOpen(false)} className="h-11">
                {t("settings.cancel", "Cancel")}
              </Button>
              <Button type="submit" className="h-11 sm:min-w-32 font-semibold">
                {t("quitTracker.logUsage", "Log Usage")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
