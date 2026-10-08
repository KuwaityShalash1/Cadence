import { Check, ListFilter as Filter, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { HabitIcon, colorStyles, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useAddModalListener } from "@/hooks/use-shortcuts";
import { useSortableSensors } from "@/hooks/use-sortable-sensors";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { describeSchedule, scheduleMatches } from "@/services/schedule";
import { todayKey } from "@/services/dates";
import { useApp, uid } from "@/stores/app-store";
import type { Routine, RoutineStep } from "@/types";
import { RoutineForm } from "@/features/routines/routine-form";
import { SortableCard, SortableCardOverlay } from "@/components/sortable-card";
import { RoutineCard } from "@/components/routines/routine-card";

type RoutineFilterMode = "all" | "active" | "completed";

const ROUTINE_FILTER_LABELS: Record<RoutineFilterMode, string> = {
  all: "All",
  active: "Active",
  completed: "Completed",
};

export function RoutinesPage() {
  const { t } = useTranslation();
  const {
    routines,
    routineLogs,
    habits,
    ready,
    upsertRoutine,
    removeRoutine,
    restoreRoutine,
    reorderRoutines,
    toggleRoutineStep,
    customIcons,
  } = useApp();
  const [editing, setEditing] = useState<Routine | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoutineFilterMode>("all");

  const today = todayKey();

  function openNew() {
    setEditing(null);
    setIsOpen(true);
  }
  function openEdit(routine: Routine) {
    setEditing(routine);
    setIsOpen(true);
  }

  // Keyboard shortcut bridge: pressing N on /routines opens this sheet.
  useAddModalListener("routine", () => {
    if (!isOpen) openNew();
  });

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)),
    [routines],
  );

  const filteredRoutines = useMemo(() => {
    let list = sortedRoutines;
    if (filter === "active") {
      list = list.filter((r) => {
        const isScheduled = scheduleMatches(r.schedule, today, today);
        const log = routineLogs.find((l) => l.id === `${r.id}:${today}`);
        const completedSteps = log?.completedStepIds ?? [];
        const isCompleted = r.steps.length > 0 && completedSteps.length >= r.steps.length;
        return isScheduled && !isCompleted;
      });
    } else if (filter === "completed") {
      list = list.filter((r) => {
        const log = routineLogs.find((l) => l.id === `${r.id}:${today}`);
        const completedSteps = log?.completedStepIds ?? [];
        return r.steps.length > 0 && completedSteps.length >= r.steps.length;
      });
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.steps.some((s) => s.title.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [sortedRoutines, filter, query, routineLogs, today]);

  /**
   * Mobile-first reorder activation shared by every card list: a 400ms hold
   * with 8px of drift tolerance, so quick vertical swipes keep scrolling the
   * page and only a deliberate long-press picks a card up.
   */
  const sensors = useSortableSensors();

  function handleDragStart(event: DragStartEvent) {
    /* Reached only once the hold threshold is met — confirm the pickup. */
    triggerHaptic();
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = sortedRoutines.findIndex((routine) => routine.id === event.active.id);
    const newIndex = sortedRoutines.findIndex((routine) => routine.id === event.over?.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderRoutines(arrayMove(sortedRoutines, oldIndex, newIndex).map((routine) => routine.id));
    }
  }

  const activeRoutine = sortedRoutines.find((routine) => routine.id === activeId);

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{t("nav.routines")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("routine.subtitle")}
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={openNew}>
          <Plus className="me-1 h-4 w-4" /> {t("routine.new")}
        </Button>
      </header>

      {sortedRoutines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">{t("routine.emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t("routine.emptyDesc")}</p>
          <Button className="mt-5" onClick={openNew}>
            <Plus className="me-1 h-4 w-4" /> {t("routine.createFirst")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("routine.searchPlaceholder")}
                className="h-11 ps-10 [&::-webkit-search-cancel-button]:appearance-none"
                aria-label={t("routine.searchPlaceholder")}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={t("today.clearSearch")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              {(Object.keys(ROUTINE_FILTER_LABELS) as RoutineFilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  aria-pressed={filter === mode}
                  className={cn(
                    "h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors",
                    filter === mode
                      ? "bg-primary/10 text-teal-800 dark:text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {mode === "all" ? t("routine.filterAll") : mode === "active" ? t("routine.filterActive") : t("routine.filterCompleted")}
                </button>
              ))}
            </div>
          </div>

          {filteredRoutines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("routine.noMatch")}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext
                items={filteredRoutines.map((routine) => routine.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="cadence-stagger space-y-4">
                  {filteredRoutines.map((routine) => {
                    const log = routineLogs.find((l) => l.id === `${routine.id}:${today}`);
                    // Accent + tint for the card icon — works for palette names and custom HEX.
                    const cardTint = getColorStyle(routine.color ?? "teal", 0.14);
                    const completed = log?.completedStepIds ?? [];
                    const pct =
                      routine.steps.length > 0
                        ? Math.round((completed.length / routine.steps.length) * 100)
                        : 0;
                    return (
                      <SortableCard key={routine.id} id={routine.id}>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm"
                                style={{ ...cardTint.style, color: cardTint.rawColor }}
                              >
                                <HabitIcon
                                  name={routine.icon}
                                  customIcons={customIcons}
                                  className="h-5 w-5"
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">
                                  {routine.name}
                                </h3>
                                <p className="truncate text-xs text-muted-foreground">
                                  {describeSchedule(routine.schedule, t)} · {routine.steps.length}{" "}
                                  {t("routine.stepsCount")} · {pct}% {t("routine.doneToday")}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                onClick={() => openEdit(routine)}
                                aria-label={t("routine.edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-slate-500 hover:bg-rose-50 hover:text-destructive dark:text-slate-400 dark:hover:bg-rose-950/30"
                                onClick={() => {
                                  // Snapshot the routine BEFORE deleting so the toast's
                                  // Undo action can put it (steps included) back.
                                  const routineToRestore = structuredClone(routine);
                                  removeRoutine(routine.id);
                                  toast.success(t("routine.deleted"), {
                                    action: {
                                      label: t("common.undo"),
                                      onClick: () => restoreRoutine(routineToRestore),
                                    },
                                    duration: 5000, // Give them 5 seconds to undo
                                  });
                                }}
                                aria-label={t("routine.deleteRoutineAria")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {routine.steps.length === 0 ? (
                            <p className="mt-3 text-sm text-muted-foreground">
                              {t("routine.noStepsYet")}
                            </p>
                          ) : (
                            <ul className="mt-3 space-y-2">
                              {routine.steps.map((step) => {
                                const isDone = completed.includes(step.id);
                                const habit = step.habitId
                                  ? habits.find((h) => h.id === step.habitId)
                                  : undefined;
                                const styles = habit ? colorStyles(habit.color) : null;
                                return (
                                  <li key={step.id}>
                                    <button
                                      type="button"
                                      onClick={() => toggleRoutineStep(routine.id, step.id, today)}
                                      className={cn(
                                        "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200 active:scale-[0.99]",
                                        isDone
                                          ? "border-primary/40 bg-primary/5"
                                          : "border-slate-200 bg-slate-50/70 hover:bg-white dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800/60",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
                                          isDone
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-slate-300 bg-white text-transparent dark:border-slate-700 dark:bg-slate-900",
                                        )}
                                      >
                                        {isDone ? <Check className="h-4 w-4" /> : null}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className={cn(
                                            "truncate text-sm font-medium",
                                            isDone && "text-muted-foreground line-through",
                                          )}
                                        >
                                          {step.title}
                                        </p>
                                        {habit && styles ? (
                                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <HabitIcon
                                              name={habit.icon}
                                              customIcons={customIcons}
                                              className={cn("h-3 w-3", styles.text)}
                                            />
                                            {habit.name}
                                          </p>
                                        ) : null}
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </SortableCard>
                    );
                  })}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeRoutine ? (
                  <SortableCardOverlay>
                    <RoutineCard
                      routine={activeRoutine}
                      habits={habits}
                      completedStepIds={
                        routineLogs.find((log) => log.id === `${activeRoutine.id}:${today}`)
                          ?.completedStepIds ?? []
                      }
                      date={today}
                      customIcons={customIcons}
                      onEdit={openEdit}
                    />
                  </SortableCardOverlay>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      <ResponsiveSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={editing ? t("routine.edit") : t("routine.new")}
        description={editing ? t("routine.editDesc") : t("routine.newDesc")}
      >
        <RoutineForm
          key={editing?.id ?? "new"}
          routine={editing}
          habits={habits}
          onDone={() => setIsOpen(false)}
          onSave={(routine) => {
            upsertRoutine(routine);
            toast.success(editing ? t("routine.updated") : t("routine.created"));
            setIsOpen(false);
          }}
        />
      </ResponsiveSheet>
    </div>
  );
}
