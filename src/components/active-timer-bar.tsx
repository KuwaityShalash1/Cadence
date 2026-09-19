import { Pause, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { normalizeQuickDecrements } from "@/services/quick-steps";
import { useApp } from "@/stores/app-store";

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
      toast.success(`${habit.name} target reached — ${habit.target} ${habit.unit || "min"} logged`);
    }
  }, [reachedTarget, timer, habit, stopTimer]);

  if (!timer || !habit) return null;

  // Only the steps the user configured — no defaults are substituted.
  // Both lists may be empty, in which case no chips are rendered at all.
  const increments = habit.quickIncrements?.slice(0, 2) ?? [];
  const decrements = normalizeQuickDecrements(habit.quickDecrement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-lg bg-background text-foreground border border-border rounded-2xl p-6 shadow-2xl transition-colors"
      >
        <div className="flex flex-col gap-6">
          {/* Timer title & live duration count */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Timer · {habit.name}</p>
            <p className="numeric font-display text-5xl font-semibold text-foreground tracking-tight">
              {format(elapsed)}
            </p>
          </div>

          {/* Quick adjust chips — configured decrement jumps, then configured
              increments. Hidden entirely when the user configured no steps. */}
          {decrements.length > 0 || increments.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {decrements.map((dec) => (
                <Button
                  key={`dec-${dec}`}
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
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
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => adjustTimer(inc)}
                >
                  +{inc}m
                </Button>
              ))}
            </div>
          ) : null}

          {/* Action group */}
          <div className="flex items-center justify-center gap-3">
            {timer.startedAt ? (
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-14 rounded-full"
                aria-label="Pause timer"
                onClick={pauseTimer}
              >
                <Pause className="h-6 w-6" />
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-14 rounded-full"
                aria-label="Resume timer"
                onClick={resumeTimer}
              >
                <Play className="h-6 w-6" />
              </Button>
            )}
            <Button
              size="lg"
              className="h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-medium"
              onClick={() => {
                stopTimer(true);
                toast.success("Session saved");
              }}
            >
              <Square className="mr-2 h-5 w-5" /> Save
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-14 w-14 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Discard timer"
              onClick={() => stopTimer(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ActiveTimerBar as TimerDock };
