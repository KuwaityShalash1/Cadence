import {
  Archive,
  ListFilter as Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  Globe,
  LogIn,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { FOCUS_HABIT_SEARCH_EVENT, OPEN_ARCHIVED_HABITS_EVENT } from "@/hooks/use-shortcuts";
import { triggerConfetti } from "@/lib/celebration";
import { playBadgeUnlockSound } from "@/lib/sound";

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
import { useTranslation } from "@/i18n/context";
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

function getGreeting(
  t: (
    key: string,
    fallbackOrParams?: string | Record<string, string | number | undefined | null>,
    params?: Record<string, string | number | undefined | null>,
  ) => string,
  name?: string,
): string {
  const h = new Date().getHours();
  const displayName = name?.trim() || t("nav.user", "User");
  if (h < 12) {
    return t("today.greetingMorning", "Good morning, {name}", { name: displayName });
  }
  if (h < 18) {
    return t("today.greetingAfternoon", "Good afternoon, {name}", { name: displayName });
  }
  return t("today.greetingEvening", "Good evening, {name}", { name: displayName });
}

/** User's actual timezone detected via Intl — used for the header timezone label. */
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TodayPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { habits, logMap, ready, archiveHabit, removeHabit, settings, reorderHabits, customIcons } =
    useApp();
  const editor = useHabitEditor();
  const date = todayKey();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus Mode / Core Only toggle (emergency mode for low-energy days)
  const [coreOnlyMode, setCoreOnlyMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("cadence_core_only_mode") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("cadence_core_only_mode", String(coreOnlyMode));
    } catch {
      // Storage restricted
    }
  }, [coreOnlyMode]);

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

  // Pillars (non-negotiables) vs other habits
  const duePillars = useMemo(() => due.filter((h) => Boolean(h.isPillar)), [due]);
  const dueOthers = useMemo(() => due.filter((h) => !h.isPillar), [due]);

  const completedPillarsCount = useMemo(
    () => duePillars.filter((h) => isCompleteOn(h, logMap, date)).length,
    [duePillars, logMap, date],
  );
  const allPillarsCompleted = duePillars.length > 0 && completedPillarsCount === duePillars.length;

  // Mini-celebration effect: triggers when all daily pillars are secured for today
  const hasMountedRef = useRef(false);
  const prevPillarsCompletedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevPillarsCompletedRef.current = allPillarsCompleted;
      return;
    }

    // Trigger celebration when the final due pillar transitions to complete
    if (prevPillarsCompletedRef.current === false && allPillarsCompleted) {
      triggerConfetti({
        colors: ["#f59e0b", "#fbbf24", "#eab308", "#fcd34d", "#10b981"],
        particleCount: 75,
        spread: 80,
        origin: { y: 0.65 },
      });
      playBadgeUnlockSound();
      toast.success(
        t("today.pillarsCompletedCelebration", "🏛️ Core Day Secured! All Daily Pillars are complete."),
        {
          description: t(
            "today.pillarsCompletedDesc",
            "Even if other habits are unchecked, your foundation is solid today.",
          ),
          duration: 5000,
        },
      );
    }

    prevPillarsCompletedRef.current = allPillarsCompleted;
  }, [ready, allPillarsCompleted, t]);

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

  const filteredPillars = useMemo(
    () => filtered.filter((h) => Boolean(h.isPillar)),
    [filtered],
  );
  const filteredOthers = useMemo(
    () => filtered.filter((h) => !h.isPillar),
    [filtered],
  );

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
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
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
              {getGreeting(t, settings.displayName)}
              <span className="sr-only">
                {t(
                  "today.srSuffix",
                  " — Cadence, a free offline habit tracker and daily routine planner",
                )}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!session && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/auth" aria-label={t("auth.signInOrLogin", "Sign In / Login")}>
                  <LogIn className="h-4 w-4" />
                  <span>{t("nav.signIn", "Sign In")}</span>
                </Link>
              </Button>
            )}
            {/* Core Only / Focus Mode emergency toggle */}
            <Button
              variant={coreOnlyMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCoreOnlyMode((prev) => !prev)}
              aria-pressed={coreOnlyMode}
              title={t("today.coreOnlyTooltip", "Focus on your non-negotiables for low-energy days")}
              className={cn(
                "gap-1.5 transition-all duration-200",
                coreOnlyMode
                  ? "border-amber-500 bg-amber-500 text-slate-950 font-semibold shadow-xs hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950"
                  : "border-border hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400",
              )}
            >
              <Zap className={cn("h-4 w-4", coreOnlyMode ? "fill-slate-950" : "text-amber-500")} />
              <span>{t("today.coreOnlyMode", "Core Only")}</span>
              {duePillars.length > 0 && (
                <Badge
                  variant={coreOnlyMode ? "secondary" : "outline"}
                  className={cn(
                    "ms-0.5 px-1.5 py-0 text-[10px] font-bold",
                    coreOnlyMode
                      ? "bg-amber-600/20 text-slate-950 dark:text-slate-950"
                      : "border-amber-500/30 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {completedPillarsCount}/{duePillars.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchivedOpen(true)}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              <span>{t("today.archivedHabits", "Archived Habits")}</span>
              {archivedHabits.length > 0 && (
                <Badge variant="secondary" className="ms-1 px-1.5 py-0.5 text-xs">
                  {archivedHabits.length}
                </Badge>
              )}
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => editor.open()}>
              <Plus className="me-1 h-4 w-4" /> {t("today.newHabit")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {doneCount} {t("today.of")} {due.length} {t("today.done")}
            </span>
            <div className="flex items-center gap-2">
              {duePillars.length > 0 && (
                <span
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors",
                    allPillarsCompleted
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold"
                      : "bg-muted text-muted-foreground border border-border",
                  )}
                  title={t("today.dailyPillarsDesc", "Non-negotiable core habits for your day")}
                >
                  🏛️ {completedPillarsCount}/{duePillars.length}{" "}
                  {allPillarsCompleted ? `✓ ${t("today.pillarsSecured", "Secured")}` : ""}
                </span>
              )}
              <span className="text-muted-foreground font-semibold">{completion}%</span>
            </div>
          </div>
          <Progress value={completion} className="mt-3 h-2" />
        </div>

        <p className="text-xs text-muted-foreground">
          <Globe className="inline h-3 w-3 me-1 -mt-0.5" aria-hidden="true" />
          {t("today.timesIn")} <span className="font-medium">{USER_TIMEZONE}</span>
        </p>
      </header>

      {!hasAnyHabits ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">{t("today.welcomeTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t("today.welcomeDesc")}
          </p>
          <Button className="mt-5" onClick={() => editor.open()}>
            <Plus className="me-1 h-4 w-4" /> {t("today.createFirst")}
          </Button>
        </div>
      ) : due.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-xl">{t("today.nothingTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t("today.nothingDesc")}
          </p>
          <Button className="mt-5" onClick={() => editor.open()}>
            <Plus className="me-1 h-4 w-4" /> {t("today.newHabit")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("today.searchPlaceholder")}
                className="h-11 ps-10 [&::-webkit-search-cancel-button]:appearance-none"
                aria-label={t("today.searchPlaceholder", "Search habits…")}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={t("today.clearSearch", "Clear search")}
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
                  {mode === "all"
                    ? t("today.filterAll")
                    : mode === "pending"
                      ? t("today.filterPending")
                      : t("today.filterDone")}
                </button>
              ))}
            </div>
          </div>

          {coreOnlyMode && duePillars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/[0.03] p-8 text-center space-y-3">
              <div className="text-3xl select-none" aria-hidden="true">
                🏛️
              </div>
              <h3 className="font-semibold text-foreground text-base">
                {t("today.noPillarsSet", "No daily pillars set yet")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {t(
                  "today.noPillarsSetDesc",
                  "Designate 1-3 core habits as Daily Pillars to anchor your day and use Core Only mode.",
                )}
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setCoreOnlyMode(false)}>
                  {t("today.showAllHabits", "Show All Habits")}
                </Button>
                <Button size="sm" onClick={() => editor.open()}>
                  <Plus className="me-1 h-3.5 w-3.5" />
                  {t("today.newHabit", "New Habit")}
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 || (coreOnlyMode && filteredPillars.length === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("today.noMatch")}</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-6">
                {/* 1. Daily Pillars Section (Pinned at the top with gold/amber styling) */}
                {duePillars.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none" aria-hidden="true">
                          🏛️
                        </span>
                        <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                          {t("today.dailyPillars", "Daily Pillars")}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 transition-colors",
                              allPillarsCompleted
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : "border-border text-muted-foreground",
                            )}
                          >
                            {allPillarsCompleted
                              ? `✓ ${t("today.pillarsSecured", "Secured")}`
                              : `${completedPillarsCount}/${duePillars.length}`}
                          </Badge>
                        </h2>
                      </div>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {t("today.dailyPillarsDesc", "Non-negotiable core habits for your day")}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "rounded-2xl border p-3 sm:p-4 transition-all duration-300",
                        "border-amber-500/35 bg-amber-500/[0.03] dark:border-amber-400/25 dark:bg-amber-400/[0.02]",
                        allPillarsCompleted
                          ? "ring-1 ring-amber-500/25 shadow-[0_0_24px_-4px_rgba(245,158,11,0.14)]"
                          : "shadow-[0_0_16px_-4px_rgba(245,158,11,0.06)]",
                      )}
                    >
                      {filteredPillars.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          {allPillarsCompleted ? (
                            <p className="text-amber-700 dark:text-amber-400 font-medium">
                              🎉 {t("today.allPillarsCompleted", "All Daily Pillars completed for today!")}
                            </p>
                          ) : (
                            <p>{t("today.noPillarsMatch", "No pillars match the current filter.")}</p>
                          )}
                        </div>
                      ) : (
                        <SortableContext
                          items={filteredPillars.map((h) => h.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="cadence-stagger space-y-3">
                            {filteredPillars.map((habit) => (
                              <SortableHabitRow
                                key={habit.id}
                                habit={habit}
                                date={date}
                                logMap={logMap}
                                customIcons={customIcons}
                                draggable={filter === "all" && !query}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      )}
                    </div>
                  </section>
                )}

                {/* Focus / Core Only Mode Banner when active */}
                {coreOnlyMode ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2.5">
                      <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="font-medium">
                        {t(
                          "today.coreOnlyBanner",
                          "Core Only Mode Active — Showing non-negotiables only. Protect your energy today.",
                        )}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold shrink-0 border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-300 self-start sm:self-auto"
                      onClick={() => setCoreOnlyMode(false)}
                    >
                      {t("today.showAllHabits", "Show All Habits")}
                    </Button>
                  </div>
                ) : (
                  /* 2. Other Habits Section (Standard styling) */
                  <section className="space-y-3">
                    {duePillars.length > 0 ? (
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("today.otherHabits", "Other Habits")}
                        </h2>
                        <span className="text-xs text-muted-foreground">{filteredOthers.length}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("today.allHabits", "Habits")}
                        </h2>
                        <span className="text-xs text-muted-foreground">{filteredOthers.length}</span>
                      </div>
                    )}

                    {filteredOthers.length === 0 ? (
                      dueOthers.length > 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          {t("today.noOtherMatch", "No other habits match the current filter.")}
                        </p>
                      ) : null
                    ) : (
                      <SortableContext
                        items={filteredOthers.map((h) => h.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="cadence-stagger space-y-3">
                          {filteredOthers.map((habit) => (
                            <SortableHabitRow
                              key={habit.id}
                              habit={habit}
                              date={date}
                              logMap={logMap}
                              customIcons={customIcons}
                              draggable={filter === "all" && !query}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    )}
                  </section>
                )}
              </div>
              <DragOverlay>
                {activeHabit ? (
                  <HabitRow
                    habit={activeHabit}
                    date={date}
                    logMap={logMap}
                    customIcons={customIcons}
                    isOverlay
                    draggable
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      <ResponsiveSheet
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
        title={t("today.archivedHabits")}
        description={t("today.archivedHabitsDesc")}
      >
        {archivedHabits.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Archive className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">{t("today.noArchived")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("today.noArchivedDesc")}</p>
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
                        <button
                          type="button"
                          className="block w-full text-start cursor-pointer truncate text-sm text-muted-foreground hover:text-foreground"
                          title={t("today.clickToExpand", "Click to expand")}
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
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        archiveHabit(habit.id, false);
                        toast.success(t("today.habitRestored", "Habit restored"));
                      }}
                      className="gap-1.5 h-8 text-xs font-medium"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t("today.restore")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHabitToDelete(habit)}
                      className="gap-1.5 h-8 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("today.delete")}
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
            <AlertDialogTitle>{t("today.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("today.deleteDesc", { name: habitToDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHabitToDelete(null)}>
              {t("today.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (habitToDelete) {
                  removeHabit(habitToDelete.id);
                  toast.success(t("today.habitPermanentlyDeleted", "Habit permanently deleted"));
                  setHabitToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("today.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
