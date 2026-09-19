import { useState } from "react";
import { Plus, ShieldAlert, Flame } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { useApp } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { BadHabitCard } from "./bad-habit-card";
import { TriggerInsightsCard } from "./trigger-insights-card";
import { BadHabitEditor } from "./bad-habit-editor";
import { SortableCard, SortableCardOverlay } from "@/components/sortable-card";

export function QuitTrackerPage() {
  const { badHabits, ready, activeTimer, reorderTrackers } = useApp();
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sortedHabits = [...badHabits].sort(
    (a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = sortedHabits.findIndex((habit) => habit.id === event.active.id);
    const newIndex = sortedHabits.findIndex((habit) => habit.id === event.over?.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderTrackers(arrayMove(sortedHabits, oldIndex, newIndex).map((habit) => habit.id));
    }
  }

  const activeHabit = sortedHabits.find((habit) => habit.id === activeId);

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <ShieldAlert className="h-4 w-4" />
            Quit & Abstinence Tracker
          </div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Quit Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor real-time clean streaks, analyze contextual relapse triggers, and build
            unbreakable discipline.
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={() => setEditorOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Tracker
        </Button>
      </header>

      {sortedHabits.length > 0 && <TriggerInsightsCard badHabits={sortedHabits} />}

      {sortedHabits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <Flame className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">No bad habit timers yet</h2>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Take control of your habits. Start tracking your clean streak for smoking, junk food,
              social media, or any addiction.
            </p>
          </div>
          <Button className="mt-2" onClick={() => setEditorOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Start tracking your first habit
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
            items={sortedHabits.map((habit) => habit.id)}
            strategy={rectSortingStrategy}
          >
            <div className="cadence-stagger grid items-start gap-6 md:grid-cols-2">
              {sortedHabits.map((habit) => (
                <SortableCard key={habit.id} id={habit.id}>
                  <BadHabitCard habit={habit} />
                </SortableCard>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeHabit ? (
              <SortableCardOverlay>
                <BadHabitCard habit={activeHabit} />
              </SortableCardOverlay>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Mobile Floating / Bottom Action Button */}
      <div
        className={cn(
          "fixed right-6 z-20 md:hidden transition-all",
          activeTimer ? "bottom-36" : "bottom-20",
        )}
      >
        <Button
          onClick={() => setEditorOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center p-0"
          aria-label="New bad habit"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <BadHabitEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}
