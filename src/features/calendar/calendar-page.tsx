import { ChevronLeft, ChevronRight, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

import { HabitRow } from "@/features/habits/habit-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fromDateKey, monthMatrix, todayKey, WEEKDAY_LABELS } from "@/services/dates";
import { isScheduledOn } from "@/services/schedule";
import { dayCompletion, isCompleteOn, type LogMap } from "@/services/stats";
import { useApp } from "@/stores/app-store";
import type { Habit } from "@/types";

function dayFillClass(habits: Habit[], logs: LogMap, date: string): string {
  const due = habits.filter((h) => !h.archived && isScheduledOn(h, date));
  if (!due.length) return "";
  const completion = dayCompletion(habits, logs, date);
  // Text colours on the primary tints are chosen per opacity so the day number
  // keeps at least 4.5:1 contrast in BOTH themes: solid primary pairs with the
  // (light) primary-foreground, while the 70% tint needs a near-black number in
  // light mode AND matches the dark theme's original near-black foreground.
  if (completion >= 0.999) return "bg-primary text-primary-foreground";
  if (completion >= 0.5) return "bg-primary/70 text-slate-950";
  if (completion > 0) return "bg-primary/20 text-foreground";
  return "";
}

function hasFrozenHabitOnDay(habits: Habit[], date: string): boolean {
  return habits.some((h) => !h.archived && isScheduledOn(h, date) && h.frozenDates?.includes(date));
}

export function CalendarPage() {
  const { habits, logMap, ready, settings } = useApp();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);

  const weekStartsOn = settings.weekStartsOn;
  const weeks = useMemo(
    () => monthMatrix(cursor.year, cursor.month, weekStartsOn),
    [cursor, weekStartsOn],
  );

  const monthLabel = useMemo(
    () =>
      new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [cursor],
  );

  function prevMonth() {
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 },
    );
  }
  function nextMonth() {
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 },
    );
  }

  const selectedHabits = useMemo(
    () =>
      habits
        .filter((h) => !h.archived && isScheduledOn(h, selected))
        .sort((a, b) => a.order - b.order),
    [habits, selected],
  );

  const selectedDone = selectedHabits.filter((h) => isCompleteOn(h, logMap, selected)).length;
  const selectedPct = Math.round(dayCompletion(habits, logMap, selected) * 100);

  // Future dates are preview-only: date keys are ISO yyyy-MM-dd strings, so a
  // lexicographic comparison matches chronological order.
  const isFutureDate = selected > today;

  const weekdayLabels = useMemo(() => {
    if (weekStartsOn === 0) return WEEKDAY_LABELS;
    return [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
  }, [weekStartsOn]);

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse your history and edit any day.</p>
      </header>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Month navigation */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-display text-base font-semibold tracking-tight">{monthLabel}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-border/40 p-px">
          {weeks.flat().map((dateKey) => {
            const d = fromDateKey(dateKey);
            const inMonth = d.getMonth() === cursor.month;
            const isToday = dateKey === today;
            const isSelected = dateKey === selected;
            const isFrozen = hasFrozenHabitOnDay(habits, dateKey);
            const fill = dayFillClass(habits, logMap, dateKey);
            const hasData = fill !== "";
            /**
             * The cell only paints a day number, which is ambiguous out of
             * context ("22" of which month?). A full sentence name keeps the
             * calendar usable with a screen reader.
             */
            const dayState = !inMonth
              ? "outside this month"
              : isFrozen && !hasData
                ? "frozen, nothing logged"
                : hasData
                  ? "habits logged"
                  : "nothing logged";
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelected(dateKey)}
                aria-label={`${d.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })} — ${dayState}`}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex aspect-square items-center justify-center bg-card text-sm transition-all duration-150",
                  // Out-of-month days stay at full muted opacity: alpha-reduced
                  // variants drop below 4.5:1 contrast in both themes. The
                  // foreground/muted split still reads as clear hierarchy.
                  inMonth ? "text-foreground" : "text-muted-foreground",
                  !isSelected && !hasData && inMonth && "hover:bg-accent/50",
                  !isSelected && !hasData && !inMonth && "hover:bg-accent/30",
                  fill,
                  // cyan-700 clears 4.5:1 on the light cyan tint; cyan-400 only
                  // passes against the dark theme's background.
                  isFrozen &&
                    !hasData &&
                    "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
                  isSelected && "ring-2 ring-inset ring-primary ring-offset-0",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition-colors",
                    isToday &&
                      !hasData &&
                      // teal-800 gives the brand-tinted badge ≥4.5:1 in light
                      // mode; the dark theme keeps the bright primary colour.
                      "bg-primary/15 font-bold text-teal-800 dark:text-primary",
                    isToday &&
                      hasData &&
                      "font-bold ring-2 ring-primary ring-offset-1 ring-offset-transparent",
                  )}
                >
                  {d.getDate()}
                </span>
                {isFrozen && !hasData && (
                                    <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5 items-center justify-center text-cyan-700 dark:text-cyan-400">
                    <Snowflake className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" /> Complete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary/70" /> Partial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary/20" /> Started
        </span>
        <span className="flex items-center gap-1.5">
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
            <Snowflake className="h-2 w-2" />
          </span>{" "}
          Frozen
        </span>
      </div>

      {/* Selected day detail */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg">
            {fromDateKey(selected).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <span className="text-sm text-muted-foreground">
            {selectedDone} of {selectedHabits.length} done · {selectedPct}%
          </span>
        </div>

        {/* Future dates are read-only previews — logging is disabled. */}
        {isFutureDate && selectedHabits.length > 0 ? (
          <p
            role="note"
            title="You cannot log habits for future dates"
            className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground"
          >
            Upcoming — preview only. You cannot log habits for future dates.
          </p>
        ) : null}

        {selectedHabits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No habits scheduled on this day.
          </p>
        ) : (
          <ul className="space-y-3">
            {selectedHabits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} date={selected} readOnly={isFutureDate} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
