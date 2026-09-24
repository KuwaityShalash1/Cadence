import { useMemo, useState } from "react";
import {
  Plus,
  ShieldAlert,
  Flame,
  LayoutGrid,
  ListFilter as Filter,
  Search,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddModalListener } from "@/hooks/use-shortcuts";
import { useSortableSensors } from "@/hooks/use-sortable-sensors";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";
import { BadHabitCard } from "./bad-habit-card";
import { TriggerInsightsCard } from "./trigger-insights-card";
import { BadHabitEditor } from "./bad-habit-editor";
import { SortableCard, SortableCardOverlay } from "@/components/sortable-card";

type TrackerFilter = "all" | "abstinence" | "moderation";

const FILTER_TABS: Array<{
  id: TrackerFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "abstinence", label: "Abstinence" },
  { id: "moderation", label: "Moderation" },
];

export function QuitTrackerPage() {
  const { badHabits, ready, activeTimer, reorderTrackers } = useApp();
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Mental-model separation: abstinence (cold turkey) vs moderation (daily limits).
  const [activeFilter, setActiveFilter] = useState<TrackerFilter>("all");

  // Keyboard shortcut bridge: pressing N on /quit-tracker opens the editor.
  useAddModalListener("quit-tracker", () => {
    if (!editorOpen) setEditorOpen(true);
  });

  const sortedHabits = useMemo(
    () => [...badHabits].sort((a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt)),
    [badHabits],
  );

  // Smooth client-side filtering based on active tab and search query. No DB queries involved.
  const filteredHabits = useMemo(() => {
    let list = sortedHabits;
    if (activeFilter === "abstinence") {
      list = list.filter((habit) => habit.strategy !== "limit");
    } else if (activeFilter === "moderation") {
      list = list.filter((habit) => habit.strategy === "limit");
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((habit) => habit.title.toLowerCase().includes(q));
    }
    return list;
  }, [sortedHabits, activeFilter, query]);

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
    // Resolve indices against the full sorted order so reordering while
    // filtered still persists a valid global order via the same store action.
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

  // Unified layout shell: no max-width, margins, or horizontal padding here on
  // purpose — AppShell already owns the page gutter (px-4 mobile / px-6 md+)
  // and max width (max-w-6xl). This mirrors TodayPage's root
  // (`mx-0 w-full space-y-8`) so navigating between / and /quit-tracker
  // causes zero layout shift. Header, insights, tabs, and cards all share
  // this full unified width.
  return (
    <div className="mx-0 w-full space-y-8">
      {/* Page header: title, description, and add action sit directly above
          the insights banner with standard rhythm (no extra top padding). */}
      <header className="mb-6 flex items-end justify-between gap-4">
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

      {sortedHabits.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search quit trackers…"
              className="h-11 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
              aria-label="Search quit trackers"
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
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={activeFilter === tab.id}
                className={cn(
                  "h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors",
                  activeFilter === tab.id
                    ? "bg-primary/10 text-teal-800 dark:text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
      ) : filteredHabits.length === 0 ? (
        query ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No trackers match your search.
          </p>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <p className="font-display text-lg font-bold">
              {activeFilter === "abstinence"
                ? "No abstinence trackers yet"
                : "No moderation trackers yet"}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {activeFilter === "abstinence"
                ? "Track a habit with total abstinence to see its live clean-streak timer here."
                : "Track a habit with a daily limit to monitor moderation progress here."}
            </p>
            <Button variant="outline" onClick={() => setActiveFilter("all")}>
              <LayoutGrid className="mr-2 h-4 w-4" /> Show all trackers
            </Button>
          </div>
        )
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={filteredHabits.map((habit) => habit.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* Single-column tracker stack: each card fills the full unified
                container width with consistent rhythm (Today page spacing). */}
            <div className="flex w-full flex-col gap-4">
              {filteredHabits.map((habit) => (
                <SortableCard key={habit.id} id={habit.id} className="w-full">
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

      {/* Mobile FAB — floats above the bottom nav and the timer bar */}
      <button
        type="button"
        aria-label="New bad habit"
        onClick={() => setEditorOpen(true)}
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

      <BadHabitEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}
