import { useMemo, useState, useEffect } from "react";
import { Sparkles, Trophy, Flame, Share2 } from "lucide-react";

import type { Habit } from "@/types";
import type { LogMap } from "@/services/stats";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { cn } from "@/lib/utils";
import { calculateWeeklyRecap } from "@/services/gamification";
import { triggerConfetti } from "@/lib/celebration";

interface WeeklyRecapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
  logMap: LogMap;
  onOpenShareCard?: () => void;
}

export function WeeklyRecapModal({
  open,
  onOpenChange,
  habits,
  logMap,
  onOpenShareCard,
}: WeeklyRecapModalProps) {
  const { t, language } = useTranslation();

  const recap = useMemo(() => calculateWeeklyRecap(habits, logMap), [habits, logMap]);

  // Read / write auto-show preference
  const [autoShow, setAutoShow] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cadence_auto_weekly_recap_enabled") !== "false";
  });

  const handleToggleAutoShow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoShow(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("cadence_auto_weekly_recap_enabled", val ? "true" : "false");
    }
  };

  // Trigger subtle celebratory confetti when opening modal with a good rate
  useEffect(() => {
    if (open && recap.successRate >= 50) {
      triggerConfetti();
    }
  }, [open, recap.successRate]);

  // Motivational takeaway message
  const praiseMessage = useMemo(() => {
    if (recap.successRate >= 90) {
      return t(
        "weeklyRecap.elitePraise",
        "Extraordinary consistency! You operated in peak rhythm this week.",
      );
    }
    if (recap.successRate >= 75) {
      return t(
        "weeklyRecap.highPraise",
        "Terrific momentum! You showed up and stayed disciplined.",
      );
    }
    if (recap.successRate >= 50) {
      return t(
        "weeklyRecap.steadyPraise",
        "Solid progress! Your habit rhythm is taking shape day by day.",
      );
    }
    return t(
      "weeklyRecap.freshStartPraise",
      "Every new week is a fresh canvas. Focus on 1 or 2 core habits to build momentum!",
    );
  }, [recap.successRate, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider border-primary/30 bg-primary/10 text-primary px-2 py-0 h-4"
                >
                  {t("weeklyRecap.badge", "7-Day Summary")}
                </Badge>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {t("weeklyRecap.title", "Weekly Recap")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t("weeklyRecap.subtitle", "Your consistency breakdown over the past 7 days.")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Motivational Hero Praise Banner */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                  {praiseMessage}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("weeklyRecap.keepMomentum", "Keep the momentum going into next week!")}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Core Metric Capsules */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Success Rate */}
            <div className="rounded-xl border border-border/70 bg-card p-3 text-center space-y-1 shadow-2xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                {t("weeklyRecap.successRate", "Success Rate")}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 block">
                {recap.successRate}%
              </span>
              <span className="text-[10px] text-muted-foreground block truncate">
                {t("weeklyRecap.successRateDesc", "Scheduled met")}
              </span>
            </div>

            {/* Total Completions */}
            <div className="rounded-xl border border-border/70 bg-card p-3 text-center space-y-1 shadow-2xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                {t("weeklyRecap.totalCompletions", "Completions")}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-primary block">
                {recap.totalCompletions}
              </span>
              <span className="text-[10px] text-muted-foreground block truncate">
                {t("weeklyRecap.totalCompletionsDesc", "Last 7 days")}
              </span>
            </div>

            {/* Perfect Days */}
            <div className="rounded-xl border border-border/70 bg-card p-3 text-center space-y-1 shadow-2xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                {t("weeklyRecap.perfectDays", "Perfect Days")}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-500 block">
                {recap.perfectDaysCount}
              </span>
              <span className="text-[10px] text-muted-foreground block truncate">
                {t("weeklyRecap.perfectDaysDesc", "100% days")}
              </span>
            </div>
          </div>

          {/* Star Habit Spotlight */}
          {recap.bestHabit ? (
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>{t("weeklyRecap.bestHabit", "Star Habit")}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  {recap.bestHabit.rate}% {t("shareCard.weeklyConsistency", "Rate")}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                {(() => {
                  const habitAccent = getColorStyle(recap.bestHabit.habit.color);
                  return (
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                      style={habitAccent.style}
                    >
                      <HabitIcon
                        name={recap.bestHabit.habit.icon}
                        className="h-5 w-5"
                        style={{ color: habitAccent.rawColor }}
                      />
                    </div>
                  );
                })()}

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">
                    {recap.bestHabit.habit.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.daysRunningStreak", { count: recap.bestHabit.streak })} •{" "}
                    {recap.bestHabit.completed}/{recap.bestHabit.scheduled}{" "}
                    {t("dashboard.days", "days")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              {t(
                "weeklyRecap.noCompletions",
                "No habits completed in the past 7 days yet. Complete a habit today to start your recap!",
              )}
            </div>
          )}

          {/* 7-Day Rhythm Mini-Chart Breakdown */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("dashboard.sevenDayRhythm", "7-Day Rhythm")}
            </span>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {recap.dayStats.map((day) => {
                const formattedDayLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
                  language === "ar" ? "ar-SA" : "en-US",
                  { weekday: "narrow" },
                );
                return (
                  <div
                    key={day.date}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                      day.isComplete
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : day.completed > 0
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/40 text-muted-foreground",
                      day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    )}
                  >
                    <span className="text-[10px] font-semibold">{formattedDayLabel}</span>
                    <span className="text-xs font-bold mt-1">
                      {day.completed}/{day.scheduled}
                    </span>
                    <span className="text-[9px] opacity-75 mt-0.5">
                      {day.scheduled > 0
                        ? `${Math.round((day.completed / day.scheduled) * 100)}%`
                        : t("dashboard.rest", "Rest")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auto-Prompt Checkbox Preference */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
            <label
              htmlFor="auto-recap-toggle"
              className="text-muted-foreground cursor-pointer select-none"
            >
              {t("weeklyRecap.autoShowPrompt", "Auto-show recap at start of week")}
            </label>
            <input
              id="auto-recap-toggle"
              type="checkbox"
              checked={autoShow}
              onChange={handleToggleAutoShow}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            {t("dashboard.close", "Close")}
          </Button>

          {onOpenShareCard && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenShareCard();
              }}
              className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{t("weeklyRecap.shareRecap", "Share Milestone")}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
