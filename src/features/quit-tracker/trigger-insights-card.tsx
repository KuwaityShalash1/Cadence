import { useMemo } from "react";
import { Sparkles, BarChart2, ShieldAlert } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { BadHabit } from "@/types";
import { TRIGGER_OPTIONS } from "./constants";

interface TriggerInsightsCardProps {
  badHabits: BadHabit[];
}

export function TriggerInsightsCard({ badHabits }: TriggerInsightsCardProps) {
  const insights = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalRelapses = 0;

    for (const habit of badHabits) {
      for (const record of habit.history) {
        counts[record.triggerCategory] = (counts[record.triggerCategory] ?? 0) + 1;
        totalRelapses += 1;
      }
    }

    if (totalRelapses === 0) return { totalRelapses: 0, items: [] };

    const items = Object.entries(counts)
      .map(([triggerId, count]) => {
        const option = TRIGGER_OPTIONS.find((t) => t.id === triggerId);
        const percentage = Math.round((count / totalRelapses) * 100);
        return {
          id: triggerId,
          label: option?.label ?? triggerId,
          emoji: option?.emoji ?? "⚡",
          count,
          percentage,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { totalRelapses, items };
  }, [badHabits]);

  // Card foundation matches Today HabitRow tokens: rounded-2xl,
  // border-border, bg-card, p-4 (p-5 on sm+) — full unified width.
  if (insights.totalRelapses === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">Trigger Insights</h3>
            <p className="text-xs text-muted-foreground">
              Log relapses to discover your personal trigger patterns and prevent setbacks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const topTrigger = insights.items[0];

  return (
    <div className="w-full space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <BarChart2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">Relapse Trigger Insights</h3>
            <p className="text-xs text-muted-foreground">
              Based on {insights.totalRelapses} total recorded relapse
              {insights.totalRelapses === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {topTrigger && (
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Top Trigger: {topTrigger.percentage}% {topTrigger.label.split("/")[0]}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-1">
        {insights.items.map((item) => (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span>{item.emoji}</span>
                <span>{item.label}</span>
              </span>
              <span className="font-semibold text-muted-foreground">
                {item.count} ({item.percentage}%)
              </span>
            </div>
            <Progress
              value={item.percentage}
              aria-label={`Relapse share for ${item.label}`}
              className="h-2.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
