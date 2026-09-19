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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import type { BadHabit } from "@/types";
import { RelapseModal } from "./relapse-modal";
import { BadHabitEditor } from "./bad-habit-editor";
import { TRIGGER_OPTIONS } from "./constants";

interface BadHabitCardProps {
  habit: BadHabit;
}

export function BadHabitCard({ habit }: BadHabitCardProps) {
  const { removeBadHabit, restoreBadHabit, customIcons } = useApp();
  const { t } = useTranslation();
  const [now, setNow] = useState<number>(Date.now());
  const [relapseOpen, setRelapseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = Math.max(0, now - habit.quitDate);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const currentStreakHours = elapsedMs / (1000 * 60 * 60);
  const maxHistoryHours = habit.history.reduce((max, r) => Math.max(max, r.streakDurationHours), 0);
  const longestStreakHours = Math.max(currentStreakHours, maxHistoryHours);

  function formatStreakHours(hoursVal: number): string {
    if (hoursVal < 24) return `${Math.floor(hoursVal)} hrs`;
    const d = Math.floor(hoursVal / 24);
    const h = Math.floor(hoursVal % 24);
    return `${d}d ${h}h`;
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
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            className={cn("grid h-12 w-12 place-items-center rounded-2xl shadow-sm", styles.tint)}
            style={{ backgroundColor: styles.tint }}
          >
            <HabitIcon
              name={habit.icon ?? "Flame"}
              customIcons={customIcons}
              className={cn("h-6 w-6", { color: styles.rawColor })}
            />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight">{habit.title}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <span>{t("quitTracker.quitDate")}:</span>
              <span className="font-medium text-foreground">
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            aria-label="Edit tracker"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            aria-label="Delete tracker"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-muted/40 border border-border/60 p-5 text-center space-y-2">
        <div className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Current Abstinence Streak
        </div>
        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto pt-1">
          <div className="flex flex-col items-center bg-card rounded-xl p-2.5 border shadow-2xs">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-foreground numeric">
              {days}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
              Days
            </span>
          </div>
          <div className="flex flex-col items-center bg-card rounded-xl p-2.5 border shadow-2xs">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-foreground numeric">
              {String(hours).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
              Hours
            </span>
          </div>
          <div className="flex flex-col items-center bg-card rounded-xl p-2.5 border shadow-2xs">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-foreground numeric">
              {String(minutes).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
              Mins
            </span>
          </div>
          <div className="flex flex-col items-center bg-card rounded-xl p-2.5 border shadow-2xs">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-primary numeric animate-pulse">
              {String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
              Secs
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
          <span className="text-muted-foreground">{t("quitTracker.currentStreak")}</span>
          <span className="font-semibold text-foreground">
            {formatStreakHours(currentStreakHours)}
          </span>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
          <span className="text-muted-foreground">{t("quitTracker.longestStreak")}</span>
          <span className="font-semibold text-primary flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" />
            {formatStreakHours(longestStreakHours)}
          </span>
        </div>
      </div>

      <div className="pt-1">
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-destructive/30 bg-destructive/5 text-destructive font-semibold hover:bg-destructive/10 hover:border-destructive transition-colors"
          onClick={() => setRelapseOpen(true)}
        >
          <AlertCircle className="mr-2 h-4 w-4" />
          {t("quitTracker.iRelapsed", "I Relapsed")}
        </Button>
      </div>

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
                    <div className="text-[10px] text-muted-foreground/70 pl-6">
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
    </div>
  );
}
