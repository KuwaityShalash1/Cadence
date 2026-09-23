import { Award, Flame, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { HabitIcon, colorStyles } from "@/components/icon-map";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { addDays, rangeKeys, todayKey } from "@/services/dates";
import { isScheduledOn } from "@/services/schedule";
import {
  completedDaysTotal,
  consistencyScore,
  dayCompletion,
  habitStats,
  isCompleteOn,
  streaks,
  trend,
} from "@/services/stats";
import { useApp } from "@/stores/app-store";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
] as const;

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="numeric mt-2 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatsPage() {
  const { habits, logMap, ready, customIcons } = useApp();
  const [rangeIdx, setRangeIdx] = useState(1);
  const range = RANGES[rangeIdx] ?? { label: "30 days", days: 30 };

  const today = todayKey();
  const fromKey = addDays(today, -(range.days - 1));

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order),
    [habits],
  );

  const overallCompletion = useMemo(() => {
    const days = rangeKeys(fromKey, today);
    let scheduled = 0;
    let completed = 0;
    for (const day of days) {
      for (const h of activeHabits) {
        if (!isScheduledOn(h, day)) continue;
        scheduled += 1;
        if (isCompleteOn(h, logMap, day)) completed += 1;
      }
    }
    return scheduled ? completed / scheduled : 0;
  }, [activeHabits, logMap, fromKey, today]);

  const consistency = useMemo(
    () => consistencyScore(activeHabits, logMap, Math.min(range.days, 30)),
    [activeHabits, logMap, range.days],
  );

  const totalCompletedDays = useMemo(
    () => completedDaysTotal(activeHabits, logMap),
    [activeHabits, logMap],
  );

  const bestStreakAcross = useMemo(() => {
    let best = 0;
    for (const h of activeHabits) {
      const s = streaks(h, logMap);
      best = Math.max(best, s.best);
    }
    return best;
  }, [activeHabits, logMap]);

  const trendPoints = useMemo(
    () => trend(activeHabits, logMap, range.days),
    [activeHabits, logMap, range.days],
  );

  const maxTrend = useMemo(
    () => trendPoints.reduce((max, p) => Math.max(max, p.value), 0) || 1,
    [trendPoints],
  );

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Statistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See how you&apos;re doing across all habits.
        </p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRangeIdx(i)}
            aria-pressed={i === rangeIdx}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors",
              i === rangeIdx
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Completion"
          value={`${Math.round(overallCompletion * 100)}%`}
          hint={`${range.label} average`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Consistency"
          value={`${Math.round(consistency * 100)}%`}
          hint="Last 30 days"
        />
        <MetricCard
          icon={Flame}
          label="Best streak"
          value={`${bestStreakAcross}`}
          hint={bestStreakAcross === 1 ? "day" : "days"}
        />
        <MetricCard
          icon={Award}
          label="Perfect days"
          value={`${totalCompletedDays}`}
          hint="All habits done"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg">Completion trend</h2>
        <p className="text-xs text-muted-foreground">
          Daily completion over {range.label.toLowerCase()}
        </p>
        <div className="mt-4 flex h-32 items-end gap-px">
          {trendPoints.map((p, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary"
              style={{ height: `${Math.max(2, (p.value / maxTrend) * 100)}%` }}
              title={`${p.label}: ${p.value}%`}
            />
          ))}
        </div>
        {trendPoints.length > 0 ? (
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{trendPoints[0]?.label}</span>
            <span>{trendPoints[trendPoints.length - 1]?.label}</span>
          </div>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Per-habit breakdown</h2>
        {activeHabits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No active habits yet.
          </p>
        ) : (
          <div className="space-y-3">
            {activeHabits.map((habit) => {
              const stats = habitStats(habit, logMap, fromKey, today);
              const styles = colorStyles(habit.color);
              return (
                <div key={habit.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        styles.soft,
                      )}
                    >
                      <HabitIcon
                        name={habit.icon}
                        customIcons={customIcons}
                        className={cn("h-5 w-5", styles.text)}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-sans text-base font-semibold">{habit.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {stats.scheduledDays} scheduled · {stats.totalCompletions} total completions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="numeric font-display text-xl">{stats.currentStreak}</p>
                      <p className="text-xs text-muted-foreground">current streak</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completion rate</span>
                      <span className="numeric font-medium">
                        {Math.round(stats.completionRate * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.round(stats.completionRate * 100)}
                      aria-label="Completion rate"
                      className="mt-1.5 h-2"
                    />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Best streak:{" "}
                      <span className="numeric font-medium text-foreground">
                        {stats.bestStreak}
                      </span>
                    </span>
                    <span>
                      Avg progress:{" "}
                      <span className="numeric font-medium text-foreground">
                        {Math.round(stats.averageProgress * 100)}%
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
