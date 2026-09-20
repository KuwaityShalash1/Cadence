import { Calendar, Pencil, Plus, Target, Trash2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useSortableSensors } from "@/hooks/use-sortable-sensors";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { fromDateKey } from "@/services/dates";
import { completedLogCount } from "@/services/stats";
import { useApp, uid } from "@/stores/app-store";
import type { CustomIcon, Goal, Habit } from "@/types";
import { GoalForm } from "@/features/goals/goal-form";
import { SortableCard, SortableCardOverlay } from "@/components/sortable-card";
import { GoalCard, GoalValueControls } from "@/components/goals/goal-card";

export function GoalsPage() {
  const {
    goals,
    habits,
    logMap,
    ready,
    upsertGoal,
    removeGoal,
    restoreGoal,
    reorderGoals,
    updateHabit,
    customIcons,
  } = useApp();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setIsOpen(true);
  }
  function openEdit(goal: Goal) {
    setEditing(goal);
    setIsOpen(true);
  }

  const goalProgressMap = useMemo(() => {
    const progress = new Map<string, number>();
    const currentValues = new Map<string, number>();
    for (const goal of goals) {
      const currentValue =
        goal.type === "habit_milestone"
          ? completedLogCount(goal.habitIds, logMap)
          : goal.currentValue;
      currentValues.set(goal.id, currentValue);

      if (goal.type === "numeric") {
        progress.set(
          goal.id,
          goal.targetValue > 0 ? Math.min(1, Math.max(0, currentValue / goal.targetValue)) : 0,
        );
        continue;
      }

      if (!goal.habitIds.length) {
        progress.set(goal.id, 0);
        continue;
      }
      progress.set(
        goal.id,
        goal.targetValue > 0 ? Math.min(1, currentValue / goal.targetValue) : 0,
      );
    }
    return { progress, currentValues };
  }, [goals, logMap]);

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)),
    [goals],
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
    const oldIndex = sortedGoals.findIndex((goal) => goal.id === event.active.id);
    const newIndex = sortedGoals.findIndex((goal) => goal.id === event.over?.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderGoals(arrayMove(sortedGoals, oldIndex, newIndex).map((goal) => goal.id));
    }
  }

  const activeGoal = sortedGoals.find((goal) => goal.id === activeId);

  function goalProgress(goal: Goal): number {
    return goalProgressMap.progress.get(goal.id) ?? 0;
  }

  function goalCurrentValue(goal: Goal): number {
    return goalProgressMap.currentValues.get(goal.id) ?? 0;
  }

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set long-term targets and track progress across habits.
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New goal
        </Button>
      </header>

      {sortedGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h2 className="mt-3 font-display text-xl">No goals yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Group habits into a goal to track long-term progress toward a target date.
          </p>
          <Button className="mt-5" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Create your first goal
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
            items={sortedGoals.map((goal) => goal.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="cadence-stagger space-y-3">
              {sortedGoals.map((goal) => {
                const pct = Math.round(goalProgress(goal) * 100);
                // Accent + tint for the card icon — works for palette names and custom HEX.
                const cardTint = getColorStyle(goal.color || "#3B82F6", 0.14);
                const linkedHabits = goal.habitIds
                  .map((id) => habits.find((h) => h.id === id))
                  .filter((h): h is Habit => !!h && !h.archived);
                return (
                  <SortableCard key={goal.id} id={goal.id}>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm"
                            style={{ ...cardTint.style, color: cardTint.rawColor }}
                          >
                            <HabitIcon
                              name={goal.icon || "target"}
                              customIcons={customIcons}
                              className="h-5 w-5"
                            />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                              {goal.name}
                            </h3>
                            {goal.description ? (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {goal.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            onClick={() => openEdit(goal)}
                            aria-label="Edit goal"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-slate-500 hover:bg-rose-50 hover:text-destructive dark:text-slate-400 dark:hover:bg-rose-950/30"
                            onClick={() => {
                              // Snapshot the goal BEFORE deleting so the toast's
                              // Undo action can put it back exactly as it was.
                              const goalToRestore = structuredClone(goal);
                              removeGoal(goal.id);
                              toast.success("Goal deleted", {
                                action: {
                                  label: "Undo",
                                  onClick: () => restoreGoal(goalToRestore),
                                },
                                duration: 5000, // Give them 5 seconds to undo
                              });
                            }}
                            aria-label="Delete goal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {goal.targetDate ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Target:{" "}
                          {fromDateKey(goal.targetDate).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {linkedHabits.length} habits linked
                          </span>
                          <span className="numeric font-medium">{pct}%</span>
                        </div>
                        <Progress value={pct} className="mt-2 h-2 bg-slate-100 dark:bg-slate-800" />
                      </div>

                      <GoalValueControls goal={goal} currentValue={goalCurrentValue(goal)} />

                      {linkedHabits.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {linkedHabits.map((habit) => {
                            const styles = colorStyles(habit.color);
                            return (
                              <span
                                key={habit.id}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg border border-slate-200/70 px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300",
                                  styles.soft,
                                )}
                              >
                                <HabitIcon
                                  name={habit.icon}
                                  customIcons={customIcons}
                                  className={cn("h-3.5 w-3.5", styles.text)}
                                />
                                {habit.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </SortableCard>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeGoal ? (
              <SortableCardOverlay>
                <GoalCard
                  goal={activeGoal}
                  linkedHabits={activeGoal.habitIds
                    .map((id) => habits.find((habit) => habit.id === id))
                    .filter((habit): habit is Habit => !!habit && !habit.archived)}
                  progress={goalProgress(activeGoal)}
                  currentValue={goalCurrentValue(activeGoal)}
                  customIcons={customIcons}
                  onEdit={openEdit}
                />
              </SortableCardOverlay>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Button className="w-full md:hidden" onClick={openNew}>
        <Plus className="mr-1 h-4 w-4" /> New goal
      </Button>

      <ResponsiveSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={editing ? "Edit goal" : "New goal"}
        description={
          editing
            ? "Update your goal details and linked habits."
            : "Group habits into a long-term target."
        }
      >
        <GoalForm
          key={editing?.id ?? "new"}
          goal={editing}
          habits={habits}
          customIcons={customIcons}
          onDone={() => setIsOpen(false)}
          onSave={(goal) => {
            upsertGoal(goal);
            toast.success(editing ? "Goal updated" : "Goal created");
            setIsOpen(false);
          }}
          onLinkHabit={(habitId, goalId) => {
            const habit = habits.find((h) => h.id === habitId);
            if (habit) updateHabit({ ...habit, goalId });
          }}
        />
      </ResponsiveSheet>
    </div>
  );
}
