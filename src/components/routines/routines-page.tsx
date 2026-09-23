import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useAddModalListener } from "@/hooks/use-shortcuts";
import { useSortableSensors } from "@/hooks/use-sortable-sensors";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@/services/schedule";
import { todayKey } from "@/services/dates";
import { useApp, uid } from "@/stores/app-store";
import type { Routine, RoutineStep } from "@/types";
import { RoutineForm } from "@/features/routines/routine-form";
import { SortableCard, SortableCardOverlay } from "@/components/sortable-card";
import { RoutineCard } from "@/components/routines/routine-card";

export function RoutinesPage() {
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
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Routines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group habits into daily or weekly routines.
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New routine
        </Button>
      </header>

      {sortedRoutines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">No routines yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Create a routine like &quot;Morning Routine&quot; and add steps that link to your
            habits.
          </p>
          <Button className="mt-5" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Create your first routine
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={sortedRoutines.map((routine) => routine.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="cadence-stagger space-y-4">
              {sortedRoutines.map((routine) => {
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
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
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
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                              {routine.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {describeSchedule(routine.schedule)} · {routine.steps.length} steps ·{" "}
                              {pct}% done today
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            onClick={() => openEdit(routine)}
                            aria-label="Edit routine"
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
                              toast.success("Routine deleted", {
                                action: {
                                  label: "Undo",
                                  onClick: () => restoreRoutine(routineToRestore),
                                },
                                duration: 5000, // Give them 5 seconds to undo
                              });
                            }}
                            aria-label="Delete routine"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {routine.steps.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No steps yet. Edit to add steps.
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
                                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.99]",
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

      <Button className="w-full md:hidden" onClick={openNew}>
        <Plus className="mr-1 h-4 w-4" /> New routine
      </Button>

      <ResponsiveSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={editing ? "Edit routine" : "New routine"}
        description={
          editing
            ? "Update your routine steps and schedule."
            : "Create a routine with steps linked to habits."
        }
      >
        <RoutineForm
          key={editing?.id ?? "new"}
          routine={editing}
          habits={habits}
          onDone={() => setIsOpen(false)}
          onSave={(routine) => {
            upsertRoutine(routine);
            toast.success(editing ? "Routine updated" : "Routine created");
            setIsOpen(false);
          }}
        />
      </ResponsiveSheet>
    </div>
  );
}
