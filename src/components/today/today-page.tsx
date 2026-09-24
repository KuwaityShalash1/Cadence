import {
  Archive,
  ListFilter as Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  Globe,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FOCUS_HABIT_SEARCH_EVENT, OPEN_ARCHIVED_HABITS_EVENT } from "@/hooks/use-shortcuts";

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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { HabitRow, SortableHabitRow } from "@/features/habits/habit-row";
import { useHabitEditor } from "@/features/habits/habit-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { HabitIcon, colorStyles } from "@/components/icon-map";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatLongDay, todayKey } from "@/services/dates";
import { isScheduledOn } from "@/services/schedule";
import { dayCompletion, isCompleteOn } from "@/services/stats";
import { useApp } from "@/stores/app-store";
import type { Habit } from "@/types";

type FilterMode = "all" | "pending" | "completed";

const FILTER_LABELS: Record<FilterMode, string> = {
  all: "All",
  pending: "To do",
  completed: "Done",
};

function greeting(name?: string): string {
  const h = new Date().getHours();
  const displayName = name?.trim() || "User";
  if (h < 12) return `Good morning, ${displayName}`;
  if (h < 18) return `Good afternoon, ${displayName}`;
  return `Good evening, ${displayName}`;
}

/** User's actual timezone detected via Intl — used for the header timezone label. */
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TodayPage() {
  const {
    habits,
    logMap,
    ready,
    archiveHabit,
    removeHabit,
    settings,
    activeTimer,
    reorderHabits,
    customIcons,
  } = useApp();
  const editor = useHabitEditor();
  const date = todayKey();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpenArchived = () => setArchivedOpen(true);
    const handleFocusSearch = () => {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    };

    window.addEventListener(OPEN_ARCHIVED_HABITS_EVENT, handleOpenArchived);
    window.addEventListener(FOCUS_HABIT_SEARCH_EVENT, handleFocusSearch);

    return () => {
      window.removeEventListener(OPEN_ARCHIVED_HABITS_EVENT, handleOpenArchived);
      window.removeEventListener(FOCUS_HABIT_SEARCH_EVENT, handleFocusSearch);
    };
  }, []);

  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits]);

  const due = useMemo(
    () =>
      habits.filter((h) => !h.archived && isScheduledOn(h, date)).sort((a, b) => a.order - b.order),
    [habits, date],
  );

  const doneCount = due.filter((h) => isCompleteOn(h, logMap, date)).length;
  const completion = Math.round(dayCompletion(habits, logMap, date) * 100);

  const filtered = useMemo(() => {
    let list = due;
    if (filter === "pending") list = list.filter((h) => !isCompleteOn(h, logMap, date));
    else if (filter === "completed") list = list.filter((h) => isCompleteOn(h, logMap, date));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) || (h.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [due, filter, query, logMap, date]);

  const pending = filtered.filter((h) => !isCompleteOn(h, logMap, date));
  const completed = filtered.filter((h) => isCompleteOn(h, logMap, date));

  const hasAnyHabits = habits.some((h) => !h.archived);

  /**
   * Mouse/pointer-only drag activation — no KeyboardSensor is registered, so
   * habits can never be picked up via keyboard and no keyboard handlers are
   * forwarded to the habit cards. `distance: 8` means a drag only starts after
   * an 8px pointer move, which keeps plain clicks AND wheel scrolling fully
   * free (no scroll lock).
   */
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  /**
   * Touch is pointer-class input: the 150ms hold with 5px tolerance keeps
   * scrolling and swipe-to-complete free and only starts a reorder after a
   * deliberate long-press.
   */
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = due.findIndex((h) => h.id === active.id);
    const newIndex = due.findIndex((h) => h.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newDue = arrayMove(due, oldIndex, newIndex);
      reorderHabits(newDue.map((h) => h.id));
    }
  }

  const activeHabit = useMemo(() => {
    if (!activeId) return null;
    return due.find((h) => h.id === activeId) || null;
  }, [activeId, due]);

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    /**
     * No horizontal padding, auto margins or max-width here on purpose: the
     * AppShell page container already owns the page gutter (px-4 on mobile,
     * px-6 from md up) and the max width. Repeating them would compound the
     * mobile gutter to 48px and squeeze the habit cards.
     */
    <div className="mx-0 w-full space-y-8">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{formatLongDay(date)}</p>
            {/*
              Single <h1> of the landing view. The visible greeting keeps the
              dashboard header untouched, while the visually hidden suffix states
              the purpose of the app so screen readers and crawlers get an
              unambiguous topic heading for the page.
            */}
            <h1 className="font-sans text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting(settings.displayName)}
              <span className="sr-only">
                {" "}
                — Cadence, a free offline habit tracker and daily routine planner
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchivedOpen(true)}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              <span>Archived Habits</span>
              {archivedHabits.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {archivedHabits.length}
                </Badge>
              )}
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => editor.open()}>
              <Plus className="mr-1 h-4 w-4" /> New habit
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {doneCount} of {due.length} done
            </span>
            <span className="text-muted-foreground">{completion}%</span>
          </div>
          <Progress value={completion} className="mt-3 h-2" />
        </div>

        <p className="text-xs text-muted-foreground">
          <Globe className="inline h-3 w-3 mr-1 -mt-0.5" aria-hidden="true" />
          Times in <span className="font-medium">{USER_TIMEZONE}</span>
        </p>
      </header>

      {!hasAnyHabits ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">Welcome to Cadence</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Start by creating your first habit — pick a target and a schedule, and it will show up
            here every day it&apos;s due.
          </p>
          <Button className="mt-5" onClick={() => editor.open()}>
            <Plus className="mr-1 h-4 w-4" /> Create your first habit
          </Button>
        </div>
      ) : due.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">Nothing scheduled for today</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Your habits aren&apos;t due today. You can still create a new one or check back on your
            scheduled days.
          </p>
          <Button className="mt-5" onClick={() => editor.open()}>
            <Plus className="mr-1 h-4 w-4" /> New habit
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search habits…"
                className="h-11 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
                aria-label="Search habits"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
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
                  {FILTER_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No habits match your search.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-6">
                {filter !== "completed" && pending.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      To do
                    </h2>
                    <SortableContext
                      items={pending.map((h) => h.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="cadence-stagger space-y-3">
                        {pending.map((habit) => (
                          <SortableHabitRow
                            key={habit.id}
                            habit={habit}
                            date={date}
                            draggable={filter === "all" && !query}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </section>
                ) : null}

                {filter !== "pending" && completed.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Completed
                    </h2>
                    <ul className="cadence-stagger space-y-3">
                      {completed.map((habit) => (
                        <HabitRow key={habit.id} habit={habit} date={date} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
              <DragOverlay>
                {activeHabit ? (
                  <HabitRow habit={activeHabit} date={date} isOverlay draggable />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/* Mobile FAB — floats above the bottom nav and the timer bar */}
      <button
        type="button"
        aria-label="Create habit"
        onClick={() => editor.open()}
        style={{
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${activeTimer ? "9.5rem" : "5.5rem"})`,
        }}
        className={cn(
          "fixed right-5 z-40 flex items-center justify-center rounded-full p-4 md:hidden",
          "bg-primary text-primary-foreground shadow-xl ring-1 ring-black/5 transition-all active:scale-95",
          "hover:bg-primary/90 dark:bg-sky-500 dark:text-white dark:ring-white/10 dark:hover:bg-sky-400",
        )}
      >
        <Plus className="h-6 w-6" />
      </button>

      <ResponsiveSheet
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
        title="Archived Habits"
        description="Manage your archived habits. Restore them to active view or delete them permanently."
      >
        {archivedHabits.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Archive className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No archived habits yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Habits you archive will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 py-4">
            {archivedHabits.map((habit) => {
              const styles = colorStyles(habit.color ?? "teal");
              return (
                <li
                  key={habit.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 overflow-hidden"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        styles.soft,
                      )}
                    >
                      <HabitIcon
                        name={habit.icon ?? "Target"}
                        customIcons={customIcons}
                        className={cn("h-5 w-5", styles.text)}
                      />
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h4 className="truncate font-sans text-sm font-semibold">{habit.name}</h4>
                      {habit.description ? (
                        <p
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer truncate text-sm text-muted-foreground hover:text-foreground"
                          title="Click to expand"
                          onClick={(e) => {
                            const target = e.currentTarget;
                            target.classList.toggle("truncate");
                          }}
                          onKeyDown={(e) => {
                            // Keyboard users get the same expand/collapse
                            // behaviour as the pointer interaction above.
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.classList.toggle("truncate");
                            }
                          }}
                        >
                          {habit.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        archiveHabit(habit.id, false);
                        toast.success("Habit restored");
                      }}
                      className="gap-1.5 h-8 text-xs font-medium"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHabitToDelete(habit)}
                      className="gap-1.5 h-8 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ResponsiveSheet>

      <AlertDialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{habitToDelete?.name}&quot; and all its history
              from IndexedDB. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHabitToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (habitToDelete) {
                  removeHabit(habitToDelete.id);
                  toast.success("Habit permanently deleted");
                  setHabitToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
