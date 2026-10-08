import { Pause, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { normalizeQuickDecrements } from "@/services/quick-steps";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ActiveTimerBar() {
  const { timer, habits, pauseTimer, resumeTimer, stopTimer, adjustTimer } = useApp();
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer?.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer?.startedAt]);

  const habit = habits.find((h) => h.id === timer?.habitId);
  const elapsed = timer ? timer.accumulatedMs + (timer.startedAt ? now - timer.startedAt : 0) : 0;
  const minutes = Math.floor(elapsed / 60000);
  const reachedTarget = habit ? minutes >= habit.target : false;

  useEffect(() => {
    if (timer && habit && reachedTarget && timer.startedAt) {
      stopTimer(true);
      toast.success(
        t("timer.targetReached", {
          name: habit.name,
          target: habit.target,
          unit: habit.unit || t("common.minsShort", "min"),
        }),
      );
    }
  }, [reachedTarget, timer, habit, stopTimer, t]);

  if (!timer || !habit) return null;

  // Only the steps the user configured — no defaults are substituted.
  // Both lists may be empty, in which case no chips are rendered at all.
  const increments = habit.quickIncrements?.slice(0, 2) ?? [];
  const decrements = normalizeQuickDecrements(habit.quickDecrement);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 end-4 start-4 md:start-auto md:w-96 z-[60] bg-background/95 backdrop-blur-md text-foreground border border-border rounded-2xl p-4 shadow-xl transition-all"
    >
      <div className="flex flex-col gap-3">
        {/* Timer title & live duration count */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {t("timer.title")} · {habit.name}
            </p>
            <p className="numeric font-display text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              {format(elapsed)}
            </p>
          </div>

          {/* Action group */}
          <div className="flex items-center gap-1.5 shrink-0">
            {timer.startedAt ? (
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full"
                aria-label={t("timer.pauseAria")}
                onClick={pauseTimer}
              >
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full"
                aria-label={t("timer.resumeAria")}
                onClick={resumeTimer}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-xl"
              onClick={() => {
                stopTimer(true);
                toast.success(t("timer.sessionSaved"));
              }}
            >
              <Square className="me-1.5 h-3.5 w-3.5" /> {t("timer.save")}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={t("timer.discardAria")}
              onClick={() => stopTimer(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick adjust chips — configured decrement jumps, then configured
            increments. Hidden entirely when the user configured no steps. */}
        {decrements.length > 0 || increments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
            {decrements.map((dec) => (
              <Button
                key={`dec-${dec}`}
                variant="secondary"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => adjustTimer(-dec)}
              >
                -{dec}m
              </Button>
            ))}
            {increments.map((inc) => (
              <Button
                key={inc}
                variant="secondary"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => adjustTimer(inc)}
              >
                +{inc}m
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ActiveTimerBar as TimerDock };
