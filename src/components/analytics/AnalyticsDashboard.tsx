import { useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { addDays, todayKey, rangeKeys, diffDays, formatDay, formatLongDay, fromDateKey, toDateKey } from "@/services/dates";
import { isScheduledOn } from "@/services/schedule";
import {
  isCompleteOn,
  consistencyScore,
  habitStats,
  streaks,
  dayCompletion,
} from "@/services/stats";
import { useApp } from "@/stores/app-store";
import type { Habit, HabitLog, BadHabit } from "@/types";
import { Award, Flame, Target, TrendingUp, ShieldCheck, CalendarRange } from "lucide-react";
import { HabitIcon, colorStyles } from "@/components/icon-map";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEFRAME_OPTIONS = [
  { value: "7days", label: "7 days", days: 7 },
  { value: "30days", label: "30 days", days: 30 },
  { value: "90days", label: "90 days", days: 90 },
  { value: "1year", label: "1 year", days: 365 },
] as const;

const CHART_COLORS = {
  complete: "var(--color-chart-1)",
  withinLimit: "var(--color-chart-1)",
  overLimit: "var(--color-chart-4)",
} as const;

const MODERATION_LABELS = {
  within: "Within Limit",
  over: "Over Limit",
} as const;

const ANALYTICS_CHART_CONFIG = {
  complete: { label: "Completed", color: "var(--color-chart-1)" },
  within: { label: "Within Limit", color: "var(--color-chart-1)" },
  over: { label: "Over Limit", color: "var(--color-chart-4)" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayCompletionData {
  date: string;
  label: string;
  completionRate: number;
  completed: number;
  scheduled: number;
}

interface ModerationSlice {
  name: string;
  value: number;
  color: string;
}

interface TimeRange {
  type: "preset" | "custom";
  days?: number;
  startKey?: string;
  endKey?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDayCompletionData(
  activeHabits: Habit[],
  logMap: Record<string, HabitLog>,
  startKey: string,
  endKey: string,
): DayCompletionData[] {
  const data: DayCompletionData[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const keys = rangeKeys(startKey, endKey);
  for (const date of keys) {
    let scheduled = 0;
    let completed = 0;

    for (const h of activeHabits) {
      if (!isScheduledOn(h, date)) continue;
      scheduled += 1;
      if (isCompleteOn(h, logMap, date)) completed += 1;
    }

    const rate = scheduled > 0 ? (completed / scheduled) * 100 : 0;
    const d = new Date(date);

    let label: string;
    if (keys.length <= 30) {
      label = `${dayNames[d.getDay()]} ${d.getDate()}`;
    } else {
      label = `${d.getMonth() + 1}/${d.getDate()}`;
    }

    data.push({
      date,
      label,
      completionRate: Math.round(rate * 10) / 10,
      completed,
      scheduled,
    });
  }

  return data;
}

function computeModerationData(
  badHabits: BadHabit[],
  startKey: string,
  endKey: string,
): ModerationSlice[] {
  let within = 0;
  let over = 0;

  for (const bh of badHabits) {
    if (bh.strategy !== "limit" || bh.limitValue == null) continue;
    const logs = bh.usageLogs ?? [];
    for (const log of logs) {
      if (log.date < startKey || log.date > endKey) continue;
      if (log.value <= bh.limitValue) within += 1;
      else over += 1;
    }
  }

  if (within === 0 && over === 0) {
    return [
      { name: MODERATION_LABELS.within, value: 1, color: CHART_COLORS.withinLimit },
      { name: MODERATION_LABELS.over, value: 0, color: CHART_COLORS.overLimit },
    ];
  }

  return [
    { name: MODERATION_LABELS.within, value: within, color: CHART_COLORS.withinLimit },
    { name: MODERATION_LABELS.over, value: over, color: CHART_COLORS.overLimit },
  ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 numeric font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Adaptive trend chart: bars for short ranges, smooth area for dense ranges. */
function CompletionBarChart({
  data,
}: {
  data: DayCompletionData[];
}) {
  // Dense ranges (90 days, 1 year, wide custom) contain too many points for
  // sub-pixel bars on a ~340px mobile viewport, so render an area chart.
  // Short ranges (7 / 30 days and narrow custom ranges) stay as clean bars.
  const isLargeRange = data.length > 30;

  // Compact tick labels keep the X axis readable on mobile:
  // "Sep 23" (MMM d) for short ranges, month only ("Sep") for yearly density.
  const formatCompactTick = useCallback(
    (value: string): string => {
      const date = fromDateKey(String(value));
      const monthShort = date.toLocaleDateString("en-US", { month: "short" });
      if (data.length > 180) return monthShort;
      return `${monthShort} ${date.getDate()}`;
    },
    [data.length],
  );

  const sharedXAxisProps = {
    dataKey: "date",
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
    minTickGap: isLargeRange ? 28 : 12,
    interval: "preserveStartEnd" as const,
    padding: { left: 8, right: 8 } as const,
    tickFormatter: formatCompactTick,
  };

  const sharedYAxisProps = {
    tickFormatter: (v: number | string) => `${v}%`,
    domain: [0, 100] as [number, number],
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    axisLine: false,
    tickLine: false,
    width: 40,
  };

  return (
    // Fixed-height parent gives ResponsiveContainer a CSS-driven size, so no
    // hardcoded width/height numbers are passed (avoids Recharts warnings).
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {isLargeRange ? (
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="completionTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis {...sharedXAxisProps} />
            <YAxis {...sharedYAxisProps} />
            <Tooltip
              content={<CompletionTrendTooltip />}
              cursor={{ stroke: "var(--color-border)" }}
            />
            <Area
              type="monotone"
              dataKey="completionRate"
              name="Completed"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#completionTrendFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis {...sharedXAxisProps} />
            <YAxis {...sharedYAxisProps} />
            <Tooltip content={<CompletionTrendTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="completionRate"
              name="Completed"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Custom tooltip for the trend chart (theme-aware, works on dark background). */
function CompletionTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length || label == null) return null;
  const value = payload[0]?.value;
  return (
    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatLongDay(String(label))}</div>
      <div className="flex w-full items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: "var(--color-chart-1)" }}
          />
          Completed
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {typeof value === "number" ? `${value}%` : String(value ?? "—")}
        </span>
      </div>
    </div>
  );
}

/** Donut chart showing moderation (limit) adherence */
function ModerationPieChart({ data }: { data: ModerationSlice[] }) {
  return (
    <ChartContainer config={ANALYTICS_CHART_CONFIG} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={52}
            paddingAngle={3}
            strokeWidth={2}
            stroke="var(--background)"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent nameKey="name" />} verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Time Range Selector
// ---------------------------------------------------------------------------

function TimeRangeSelector({
  value,
  onChange,
  onCustomRangeChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  onCustomRangeChange: (range: TimeRange) => void;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const handlePresetChange = useCallback(
    (days: number) => {
      const endKey = todayKey();
      const startKey = addDays(endKey, -(days - 1));
      onChange({ type: "preset", days, startKey, endKey });
    },
    [onChange],
  );

  const handleApplyCustom = useCallback(() => {
    if (customRange.from && customRange.to) {
      const startKey = toDateKey(customRange.from);
      const endKey = toDateKey(customRange.to);
      if (startKey > endKey) {
        onCustomRangeChange({ type: "custom", startKey: endKey, endKey: startKey });
      } else {
        onCustomRangeChange({ type: "custom", startKey, endKey });
      }
      setIsPopoverOpen(false);
    }
  }, [customRange, onCustomRangeChange]);

  const handleCancelCustom = useCallback(() => {
    setIsPopoverOpen(false);
    setCustomRange({ from: undefined, to: undefined });
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value.type === "preset" && value.days === option.days ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetChange(option.days)}
          className="transition-all"
        >
          {option.label}
        </Button>
      ))}

      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value.type === "custom" ? "default" : "outline"}
            size="sm"
            className="transition-all"
          >
            <CalendarRange className="mr-2 h-4 w-4" />
            Custom Range
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] overflow-y-auto max-h-[calc(100dvh-4rem)] p-0"
          align="start"
        >
          <div className="p-4">
            <p className="text-sm font-medium text-foreground">Select Date Range</p>
            <div className="mt-3 hidden md:block">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(range) => range && setCustomRange({ from: range.from, to: range.to })}
                numberOfMonths={2}
                disabled={(date: Date) => date > new Date()}
              />
            </div>
            <div className="mt-3 md:hidden">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(range) => range && setCustomRange({ from: range.from, to: range.to })}
                numberOfMonths={1}
                disabled={(date: Date) => date > new Date()}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleCancelCustom}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!customRange.from || !customRange.to}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-Habit Breakdown Card — restored from the previous Statistics page
// ---------------------------------------------------------------------------

function HabitBreakdownCard({
  habit,
  stats,
  customIcons,
}: {
  habit: Habit;
  stats: ReturnType<typeof habitStats>;
  customIcons?: Parameters<typeof HabitIcon>[0]["customIcons"];
}) {
  const styles = colorStyles(habit.color);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", styles.soft)}>
          <HabitIcon
            name={habit.icon}
            {...(customIcons ? { customIcons } : {})}
            className={cn("h-5 w-5", styles.text)}
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-base font-semibold" title={habit.name}>
            {habit.name}
          </h3>
          <p
            className="text-xs text-muted-foreground truncate"
            title={`${stats.scheduledDays} scheduled • ${stats.totalCompletions} total`}
          >
            {stats.scheduledDays} scheduled · {stats.totalCompletions} completions
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="numeric font-display text-xl">{stats.currentStreak}</p>
          <p className="text-xs text-muted-foreground">current streak</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Completion rate</span>
          <span className="numeric font-medium">{Math.round(stats.completionRate * 100)}%</span>
        </div>
        <Progress value={Math.round(stats.completionRate * 100)} className="mt-1.5 h-2" />
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span>
          Best streak:{" "}
          <span className="numeric font-medium text-foreground">{stats.bestStreak}</span>
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
}

// ---------------------------------------------------------------------------
// Main AnalyticsDashboard Component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard() {
  const { habits, habitLogs, badHabits, ready, customIcons } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const endKey = todayKey();
    const startKey = addDays(endKey, -29);
    return { type: "preset", days: 30, startKey, endKey };
  });

  const logMap = useMemo(
    () =>
      habitLogs.reduce<Record<string, HabitLog>>((map, log) => {
        map[log.id] = log;
        return map;
      }, {}),
    [habitLogs],
  );

  const handleCustomRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  // Active (non-archived) habits sorted by order — memoized so every
  // downstream heavy computation shares one stable reference.
  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order),
    [habits],
  );

  // Resolve the visible date window. Memoized so `todayKey()` isn't re-read
  // and `startKey`/`endKey` stay referentially stable unless `timeRange` changes.
  // This keeps every downstream `useMemo` from invalidating on each render.
  const { startKey, endKey } = useMemo(() => {
    const resolvedEnd = timeRange.endKey ?? todayKey();
    const resolvedStart =
      timeRange.startKey ?? addDays(resolvedEnd, -(timeRange.days! - 1));
    return { startKey: resolvedStart, endKey: resolvedEnd };
  }, [timeRange]);

  // Heavy: builds one entry per day in range (365 for "1 year").
  // Memoized on the resolved window + habit/log inputs only.
  const dayData = useMemo(
    () => computeDayCompletionData(activeHabits, logMap, startKey, endKey),
    [activeHabits, logMap, startKey, endKey],
  );

  // Heavy: aggregates moderation (limit) usage logs across the window.
  const moderationData = useMemo(
    () => computeModerationData(badHabits, startKey, endKey),
    [badHabits, startKey, endKey],
  );

  // Derived totals — computed from the already-memoized `dayData` instead of
  // re-scanning every habit x every day a second time. Identical to counting
  // scheduled/completed across the window because `dayData` already holds
  // those per-day counts.
  const { totalScheduled, totalCompleted, overallCompletion } = useMemo(() => {
    let scheduled = 0;
    let completed = 0;
    for (const d of dayData) {
      scheduled += d.scheduled;
      completed += d.completed;
    }
    return {
      totalScheduled: scheduled,
      totalCompleted: completed,
      overallCompletion: scheduled ? (completed / scheduled) * 100 : 0,
    };
  }, [dayData]);

  // KPI: Perfect Days (>= 99.9% completion, partial progress counts).
  // Uses `dayCompletion` (average progress) to preserve exact semantics —
  // memoized so the 365-day scan only re-runs when inputs change.
  const perfectDays = useMemo(() => {
    const days = rangeKeys(startKey, endKey);
    let count = 0;
    for (const day of days) {
      if (dayCompletion(activeHabits, logMap, day) >= 0.999) count += 1;
    }
    return count;
  }, [activeHabits, logMap, startKey, endKey]);

  // KPI: Consistency Score (weighted, max 30-day lookback)
  const consistency = useMemo(() => {
    const days = Math.min(diffDays(startKey, endKey) + 1, 30);
    return consistencyScore(activeHabits, logMap, days);
  }, [activeHabits, logMap, startKey, endKey]);

  // KPI: Best Streak (across all habits)
  const bestStreakAcross = useMemo(() => {
    let best = 0;
    for (const h of activeHabits) {
      const s = streaks(h, logMap);
      best = Math.max(best, s.best);
    }
    return best;
  }, [activeHabits, logMap]);

  // KPI: Moderation Adherence %
  const moderationAdherence = useMemo(() => {
    const total = (moderationData[0]?.value ?? 0) + (moderationData[1]?.value ?? 0);
    if (total === 0) return 0;
    return (moderationData[0]!.value / total) * 100;
  }, [moderationData]);

  // Per-habit stats for the breakdown section
  const habitBreakdownData = useMemo(
    () =>
      activeHabits.map((habit) => ({
        habit,
        stats: habitStats(habit, logMap, startKey, endKey),
      })),
    [activeHabits, logMap, startKey, endKey],
  );

  // Whether any limit-strategy usage exists in the window. Memoized to avoid
  // re-filtering every bad-habit's usage logs on each render.
  const hasModerationData = useMemo(
    () =>
      badHabits.some(
        (bh) =>
          bh.strategy === "limit" &&
          (bh.usageLogs?.some((log) => log.date >= startKey && log.date <= endKey) ??
            false),
      ),
    [badHabits, startKey, endKey],
  );

  const rangeLabel = useMemo(() => {
    if (timeRange.type === "custom") {
      return `Custom: ${formatDay(startKey)} — ${formatDay(endKey)}`;
    }
    const option = TIMEFRAME_OPTIONS.find((o) => o.days === timeRange.days);
    return option?.label ?? `${timeRange.days} days`;
  }, [timeRange, startKey, endKey]);

  if (!ready) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">Loading analytics…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visual breakdown of your habit completion and moderation adherence.
        </p>
      </header>

      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-display text-lg">Completion rate — {rangeLabel}</h2>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* KPI Cards Grid — responsive: 1 mobile, 2 sm, 5 lg */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Completion"
          value={`${Math.round(overallCompletion)}%`}
          hint={`${totalCompleted} of ${totalScheduled} scheduled`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Consistency"
          value={`${Math.round(consistency * 100)}%`}
          hint="Recent weighted average"
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Best Streak"
          value={bestStreakAcross}
          hint="Days"
        />
        <StatCard
          icon={<Award className="h-4 w-4" />}
          label="Perfect Days"
          value={perfectDays}
          hint="100% completion days"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Moderation"
          value={hasModerationData ? `${Math.round(moderationAdherence)}%` : "—"}
          hint="Days within limits"
        />
      </div>

      {/* Main Trend Chart */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="font-display text-lg">Completion trend</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Percentage of scheduled habits completed each day.
        </p>
        <div className="mt-4">
          {dayData.some((d) => d.scheduled > 0) ? (
            <CompletionBarChart data={dayData} />
          ) : (
            <EmptyState>Complete at least one habit to see your completion chart.</EmptyState>
          )}
        </div>
      </section>

      {/* Moderation Donut Chart */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="font-display text-lg">Moderation adherence</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How often you stay within your self-imposed daily limits on bad habits (limit strategy).
        </p>
        <div className="mt-4">
          {hasModerationData ? (
            <ModerationPieChart data={moderationData} />
          ) : (
            <EmptyState>
              Add a bad habit with a <span className="font-medium text-foreground">Limit</span>{" "}
              strategy and start logging usage to see this chart.
            </EmptyState>
          )}
        </div>
      </section>

      {/* Per-Habit Breakdown — restored from previous Statistics page */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Per-habit breakdown</h2>
        {activeHabits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No active habits yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {habitBreakdownData.map(({ habit, stats }) => (
              <HabitBreakdownCard
                key={habit.id}
                habit={habit}
                stats={stats}
                customIcons={customIcons}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
