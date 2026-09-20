import {
  Archive,
  Check,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Snowflake,
  Trash2,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { HabitIcon, colorStyles } from "@/components/icon-map";
import { useHabitEditor } from "@/features/habits/habit-editor";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@/services/schedule";
import { normalizeQuickDecrements } from "@/services/quick-steps";
import { getLog, streaks } from "@/services/stats";
import { useApp } from "@/stores/app-store";
import type { Habit } from "@/types";
import { playDeleteHabitSound, playFreezeSound, playUncheckHabitSound } from "@/lib/sound";
import { showFreezeToast } from "@/components/ui/toast";

export interface Props {
  habit: Habit;
  date: string;
  draggable?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  /** Sortable attributes + listeners spread onto the desktop card container. */
  dragHandleProps?: Record<string, unknown>;
  activatorRef?: (element: HTMLElement | null) => void;
  style?: React.CSSProperties;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  /** Drag activators used to make the whole mobile card draggable by touch. */
  dragListeners?: Record<string, unknown> | undefined;
}

/** A single row of the three-dots dropdown / long-press action list. */
type MenuAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  onSelect: (event: Event) => void;
};

/**
 * Shape shared by `DropdownMenuItem` and `ContextMenuItem`. Both wrappers are
 * assignable to it, which lets one action list be rendered under either Radix
 * root — each root then uses its own item primitive.
 */
type MenuActionItem = React.ComponentType<{
  className?: string;
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}>;

/**
 * Habit types that describe a timed / time-based activity. Persisted data may
 * still carry the legacy `"timer"` literal next to the current `"duration"`.
 */
const TIMER_HABIT_TYPES: readonly string[] = ["timer", "duration"];

export const HabitRow = forwardRef<HTMLLIElement, Props>(function HabitRow(
  {
    habit,
    date,
    draggable = false,
    isDragging = false,
    isOverlay = false,
    dragHandleProps,
    dragListeners,
    activatorRef,
    style,
    onDragStart,
    onDragEnter,
    onDragEnd,
  },
  ref,
) {
  const {
    logMap,
    incrementHabit,
    toggleHabit,
    skipHabit,
    clearLog,
    archiveHabit,
    startTimer,
    removeHabit,
    restoreHabit,
    timer,
    freezeHabit,
    calculateRemainingFreezes,
    customIcons,
  } = useApp();
  const editor = useHabitEditor();
  const log = getLog(logMap, habit.id, date);
  const target = log?.target ?? habit.target;
  const value = log?.value ?? 0;
  const skipped = log?.status === "skipped";
  const done = skipped || value >= target;
  const isFrozen = Boolean(habit.frozenDates?.includes(date)) || log?.status === "frozen";
  /** The day is already completed — freezing is pointless and must be blocked. */
  const isCompletedToday = !isFrozen && !skipped && target > 0 && value >= target;
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0);

  /** Monthly freeze quota — drives the Freeze menu item's label + availability. */
  const freezeQuota = useMemo(
    () => calculateRemainingFreezes(habit.id),
    [calculateRemainingFreezes, habit.id],
  );
  const freezesExhausted = !isFrozen && freezeQuota.used >= freezeQuota.max;

  // Determine the color to use: HEX colors (custom) or predefined palette colors
  const isHexColor = typeof habit.color === "string" && habit.color.startsWith("#");
  const colorValue = habit.color || "teal";

  // For HEX colors, use the raw HEX; for named colors, use colorStyles
  const rawColor = isHexColor ? colorValue : colorStyles(colorValue).raw;
  const styles = isHexColor ? null : colorStyles(colorValue);

  /**
   * The habit accent injected as a CSS variable — every card surface below
   * derives its tint from `--habit-color` with color-mix(), so a single
   * variable themes the card for all 11 palette colours in both themes.
   * For custom HEX colors, we use the HEX value directly.
   */
  const accentStyle = { "--habit-color": rawColor } as React.CSSProperties;
  const [, setJustDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  /** Stays true for a beat after a reorder drag so the trailing touch end can see it. */
  const dragActive = useRef(false);
  /**
   * Pointer type of the latest interaction ("mouse" / "touch" / "pen"). A long
   * press emits a synthetic `contextmenu` event, exactly like a physical right
   * click, so this ref is what tells the two gestures apart.
   */
  const lastPointerType = useRef<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const toggleExpanded = () => setIsExpanded((prev) => !prev);
  const toggleDescription = () => setIsDescriptionExpanded((prev) => !prev);

  /**
   * Configured quick jumps shared by the desktop stepper and the mobile tray —
   * ONLY the steps the user added in the habit editor; no defaults are ever
   * substituted, so an unconfigured habit shows just the standard ±1 buttons.
   * The standard ±1 buttons always render, so a configured step of 1 would
   * draw a second identical "-1"/"+1" right beside them (the duplicate
   * "-1 -1" bug) — those are filtered out of the dynamic jumps, and
   * `Array.from(new Set(...))` additionally guarantees a duplicated step value
   * persisted in the config (e.g. [5, 5]) can never render its button twice.
   */
  const increments = Array.from(new Set(habit.quickIncrements ?? []))
    .filter((inc) => inc > 1)
    .slice(0, 2);
  const decrements = Array.from(new Set(normalizeQuickDecrements(habit.quickDecrement)))
    .filter((dec) => dec > 1)
    .slice(0, 2);
  const currentStreak = useMemo(() => streaks(habit, logMap).current, [habit, logMap]);
  /** The timer CTA is strictly reserved for timed / time-based habits. */
  const isTimerHabit = TIMER_HABIT_TYPES.includes(habit.type);
  /** Counter / numeric habits get the generous stepper; boolean habits never do. */
  const showMobileStepper = habit.type !== "boolean";
  const hasDescription = Boolean(habit.description?.trim());
  /**
   * Mobile cards are dragged from their whole surface, so the touch activator is
   * forwarded to the card container. `onPointerDown` is deliberately left out:
   * it would hijack the horizontal swipe-to-complete gesture with an 8px drag
   * threshold, while the touch sensor (hold 150ms, 5px tolerance) keeps quick
   * swipes and scrolling for free and only starts a reorder after a real hold.
   */
  const mobileDragListeners = useMemo(() => {
    const touchActivator = dragListeners?.["onTouchStart"];
    return typeof touchActivator === "function"
      ? { onTouchStart: touchActivator as React.TouchEventHandler<HTMLDivElement> }
      : undefined;
  }, [dragListeners]);

  /**
   * Handle-less dragging: the sortable attributes + listeners sit directly on
   * the card container, so a desktop reorder starts from direct interaction
   * anywhere on the card. DndContext registers only pointer/touch sensors
   * (keyboard dragging is disabled at the sensor level), so `dragHandleProps`
   * never carries an onKeyDown handler — plain clicks and wheel scrolling stay
   * untouched because PointerSensor requires an 8px move before activating.
   */

  /* A reorder drag outranks the long-press action sheet and swipe-to-complete. */
  useEffect(() => {
    if (isDragging) {
      dragActive.current = true;
      cancelLongPress();
      setMenuOpen(false);
      return undefined;
    }

    const resetTimer = window.setTimeout(() => {
      dragActive.current = false;
    }, 250);

    return () => window.clearTimeout(resetTimer);
  }, [isDragging]);

  /** Clean text progress for the desktop header — e.g. "0 / 30 min". */
  const progressText =
    habit.type === "boolean"
      ? isFrozen
        ? "Frozen"
        : done
          ? "Completed"
          : "Pending"
      : `${value} / ${target}${habit.unit ? ` ${habit.unit}` : ""}`;
  /** Numeric shorthand used by the mobile header ("0/30"). */
  const compactProgressText = habit.type === "boolean" ? progressText : `${value}/${target}`;

  /* Shared surface tokens — every colour ships in both light and dark themes. */
  const cardChrome = cn(
    isDragging && "border-dashed border-primary/50 opacity-60 hover:border-primary/50",
    isOverlay && "border-primary/50 shadow-2xl",
  );
  /**
   * A long press on a reorderable card belongs to dnd-kit's touch sensor, so the
   * native iOS text-selection UI must never appear: `select-none` covers
   * `user-select: none`, and `no-callout` (styles.css) drives WebKit's
   * vendor-prefixed `-webkit-touch-callout: none`, which kills the magnifier
   * bubble / callout that would otherwise hijack the drag. Cards that cannot be
   * dragged keep native text selection, because their long press opens the
   * action list instead of a drag.
   */
  const dragSurfaceClass = draggable && !isOverlay ? "select-none no-callout" : undefined;
  /**
   * Elevated glass surface (Linear / Things 3 inspired) — crisp white with a
   * soft shadow in light mode; a translucent, blurred slate panel with a
   * delicate top hairline highlight in dark mode. `relative overflow-hidden`
   * clips the ambient glow and the progress fill to the rounded corners.
   */
  const cardSurfaceClass = cn(
    "relative overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.99]",
    "bg-white border-slate-200/90 shadow-sm hover:shadow-md",
    "dark:bg-slate-900/80 dark:shadow-lg dark:backdrop-blur-md dark:border-slate-800/80 dark:hover:border-slate-700/80",
    "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:content-['']",
    "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
  );
  /**
   * Dynamic progress fill — a full-height accent layer that grows with the
   * day's completion, kept faint (8% light / 12% dark) so text stays sharp.
   */
  const progressFillClass = cn(
    "pointer-events-none absolute inset-y-0 left-0 bg-(--habit-color) transition-all duration-500 ease-out",
    "opacity-[0.08] dark:opacity-[0.12]",
  );
  /** Ambient accent glow — a blurred colour blob fading from the top-left corner. */
  const accentGlowClass = cn(
    "pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-(--habit-color) blur-3xl",
    "opacity-[0.06] dark:opacity-[0.1]",
  );
  /**
   * Elegant accent tile for the habit icon — the accent at 15% with a 25%
   * hairline border, so the icon glows with its own colour in both themes.
   */
  const accentTileClass =
    "bg-[color-mix(in_srgb,var(--habit-color)_15%,transparent)] border border-[color-mix(in_srgb,var(--habit-color)_25%,transparent)]";
  /** Subtle accent border tint raised while the habit is complete for the day. */
  const accentBorderClass =
    "border-[color-mix(in_srgb,var(--habit-color)_20%,transparent)] dark:border-[color-mix(in_srgb,var(--habit-color)_25%,transparent)]";
  /**
   * Vibrant micro-badges — every status tag is its own glowing pill, tuned per
   * meaning. Solid tints with strong borders keep light mode crisp, while
   * translucent neon tints with soft colour glows keep dark mode luminous.
   */
  /** Warm radiant amber pill for the 🔥 streak counter. */
  const streakBadgeClass =
    "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-50 border-amber-200 text-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.12)] dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400";
  /** Vibrant emerald celebration pill shown once the day is complete. */
  const doneBadgeClass =
    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 border-emerald-200 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.15)] dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400";
  /** Icy frost pill shown while the streak is frozen for the day. */
  const frozenBadgeClass =
    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-sky-50 border-sky-200 text-sky-700 shadow-[0_0_8px_rgba(14,165,233,0.15)] dark:bg-sky-500/10 dark:border-sky-500/25 dark:text-sky-300";
  /** Frozen-day content dim — subtly inactive yet fully readable. */
  const frozenDimClass = "opacity-80 saturate-[0.85]";
  /** Minimal neutral tag for the recurrence ("Every day" / day list) and misc states. */
  const recurrenceBadgeClass =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/80 dark:border-slate-700/60 dark:text-slate-300";
  const iconButtonClass =
    "h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white";
  /**
   * Tactile desktop stepper — wide pills with micro-shadows, subtle border
   * contrast and active click compression (active:scale-95). Colour encodes
   * direction: subtract buttons blush rose on hover, add buttons glow emerald.
   * The tone classes sit after the shared base and win over `Button`'s outline
   * variant through tailwind-merge, so every bg/border/text pair lands cleanly
   * in both themes.
   */
  const stepperBaseClass =
    "min-w-[4.75rem] px-6 h-11 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95 flex items-center justify-center";
  const stepperDecrementClass = cn(
    stepperBaseClass,
    "bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-600 shadow-sm",
    "dark:bg-slate-800/60 dark:hover:bg-rose-500/10 dark:border-slate-700/60 dark:hover:border-rose-500/30 dark:text-slate-300 dark:hover:text-rose-300",
  );
  const stepperIncrementClass = cn(
    stepperBaseClass,
    "bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-600 shadow-sm",
    "dark:bg-slate-800/60 dark:hover:bg-emerald-500/10 dark:border-slate-700/60 dark:hover:border-emerald-500/30 dark:text-slate-300 dark:hover:text-emerald-300",
  );
  /**
   * Compact mobile tray stepper — the same tactile colours and click
   * compression as the desktop pills, but keeps the tray's compact footprint
   * (h-9 minimum, px-3, rounded-lg) so the expanded tray stays tidy on phones.
   */
  const mobileStepperBaseClass =
    "h-10 min-w-[3.75rem] shrink-0 rounded-xl px-4 text-xs font-semibold transition-all duration-150 active:scale-95 flex items-center justify-center shadow-sm disabled:opacity-50";
  const mobileStepperDecrementClass = cn(
    mobileStepperBaseClass,
    "bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-600",
    "dark:bg-slate-800/60 dark:hover:bg-rose-500/10 dark:border-slate-700/60 dark:hover:border-rose-500/30 dark:text-slate-300 dark:hover:text-rose-300",
  );
  const mobileStepperIncrementClass = cn(
    mobileStepperBaseClass,
    "bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-600",
    "dark:bg-slate-800/60 dark:hover:bg-emerald-500/10 dark:border-slate-700/60 dark:hover:border-emerald-500/30 dark:text-slate-300 dark:hover:text-emerald-300",
  );
  /** Tray three-dots button — matches the collapsed header icon buttons. */
  const mobileMenuButtonClass =
    "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white";
  /**
   * Dedicated slim progress bar — rendered between the header info and the
   * action buttons in both layouts. The fill uses the habit's accent colour and
   * animates smoothly as the value changes; width is pre-clamped by `pct`.
   */
  const progressBarTrackClass =
    "w-full h-2 bg-slate-200 dark:bg-slate-800/90 rounded-full overflow-hidden my-3";
  const progressBarFillClass = "h-full rounded-full transition-all duration-500 ease-out";

  function complete() {
    if (isFrozen) {
      toast.error("Habit is frozen for today");
      return;
    }
    toggleHabit(habit.id, date);
    if (!done) {
      setJustDone(true);
      window.setTimeout(() => setJustDone(false), 700);
    } else {
      playUncheckHabitSound();
    }
  }

  function handleIncrement(amount: number) {
    if (isFrozen) {
      toast.error("Habit is frozen for today");
      return;
    }
    incrementHabit(habit.id, date, amount);
  }

  function handleStartTimer() {
    if (isFrozen) {
      toast.error("Habit is frozen for today");
      return;
    }
    if (timer && timer.habitId !== habit.id) {
      toast.error("Another timer is already running");
      return;
    }
    startTimer(habit.id);
    toast.success(`Timer started for ${habit.name}`);
  }

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    /**
     * Fallback pointer-type tracking for engines that deliver the long-press
     * `contextmenu` without a preceding Pointer Event. On touch devices
     * `touchstart` always arrives before that synthetic event.
     */
    lastPointerType.current = "touch";

    const t = e.touches[0];
    if (!t) return;
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    touchStart.current = { x: t.clientX, y: t.clientY };

    cancelLongPress();

    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      /**
       * On a reorderable card the long press belongs to dnd-kit's touch sensor
       * (hold to pick the card up), so the quick-actions sheet only opens when
       * the card cannot be dragged — e.g. while searching or on the calendar
       * page. Every action stays reachable from the (+) tray and the three-dots
       * menu either way.
       */
      if (draggable && !isOverlay) return;
      setMenuOpen(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const start = touchStartPos.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = Math.abs(t.clientX - start.x);
    const dy = Math.abs(t.clientY - start.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    cancelLongPress();

    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    touchStartPos.current = null;
    if (!start || !t) return;

    /** A reorder drag always outranks the swipe-to-complete shortcut. */
    if (dragActive.current || isDragging) return;

    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dx > 90 && dy < 50 && !done && !isFrozen) complete();
  }

  function handleTouchCancel() {
    cancelLongPress();
    touchStart.current = null;
    touchStartPos.current = null;
  }

  /**
   * Remembers how the interaction started. A `pointerdown` always precedes the
   * synthetic `contextmenu` that a long press produces, so by the time the menu
   * event arrives the ref already knows whether this was a finger or a mouse.
   * Radix composes its own `onPointerDown` AFTER this handler, so the trigger's
   * built-in long-press timer keeps working untouched.
   */
  function handlePointerDown(e: React.PointerEvent<HTMLLIElement>) {
    lastPointerType.current = e.pointerType;
  }

  /**
   * Desktop right-click and mobile long-press both surface a `contextmenu`
   * event, but only the mouse may open the custom menu:
   *
   * - Touch (long press): the native iOS / Android menu is suppressed with
   *   `preventDefault()` and the custom menu is deliberately NOT opened. Radix
   *   composes its trigger handler after this one and skips it once the event is
   *   default-prevented, so the gesture stays available to dnd-kit's touch
   *   sensor, which needs the hold to pick the card up for reordering.
   * - Mouse (physical right click) and pen: nothing is prevented, so Radix opens
   *   the custom menu exactly as it always did.
   */
  function handleContextMenu(e: React.MouseEvent<HTMLLIElement>) {
    const nativePointerType = (e.nativeEvent as PointerEvent).pointerType;
    const isTouch = lastPointerType.current === "touch" || nativePointerType === "touch";
    if (!isTouch) return;

    e.preventDefault();
  }

  /**
   * Single gate for every open request Radix raises on its own (the
   * `contextmenu` event and its built-in 700ms touch long-press timer). A touch
   * hold must never raise the custom menu — the drag sensor owns it while
   * reordering, and the quick-actions sheet for non-draggable cards is opened
   * explicitly through `setMenuOpen` further down, which is untouched by this
   * gate. Closing and every mouse interaction stay completely unaffected.
   */
  function handleMenuOpenChange(nextOpen: boolean) {
    if (nextOpen && lastPointerType.current === "touch") return;
    setMenuOpen(nextOpen);
  }

  /**
   * Toggle the streak freeze and fire exactly ONE toast for the whole action —
   * imperatively, right here in the click handler. The store action is pure
   * and just returns a `FreezeResult`; no toast lives in any effect or store
   * updater (React can re-invoke updaters, which used to double-fire toasts).
   */
  const handleFreezeToggle = () => {
    const result = freezeHabit(habit.id, date);
    if (result.ok && result.frozen) {
      playFreezeSound();
      showFreezeToast({
        used: result.used,
        max: result.max,
        daysUntilReset: result.daysUntilReset,
        ...(result.habitName ? { habitName: result.habitName } : {}),
      });
      if (result.stoppedTimer) toast.info("Timer stopped — habit frozen");
      return;
    }
    if (result.reason === "already-completed") {
      toast.info("Already completed today — no freeze needed");
    } else if (result.reason === "limit") {
      toast.error(`No freezes left this month — ${result.used} of ${result.max} used`);
    } else if (result.ok) {
      toast.success("Streak unfrozen — back in action");
    }
  };

  /**
   * Every action offered by the three-dots dropdown and the long-press context
   * sheet. The *list* is shared, the item primitive is not: Radix throws
   * "MenuItem must be used within Menu" when a `DropdownMenuItem` is rendered
   * under a `<ContextMenu>` root (and vice versa), so each root renders the list
   * with its own item component via `renderMenuActions`.
   */
  const menuActions: MenuAction[] = [
    {
      key: "freeze",
      label: isFrozen
        ? "Unfreeze Streak"
        : freezesExhausted
          ? "No freezes left this month"
          : `Freeze Streak (${freezeQuota.max - freezeQuota.used} left)`,
      Icon: Snowflake,
      iconClassName: "text-cyan-400",
      disabled: freezesExhausted,
      /**
       * Signature must match the other items (Edit, Delete): a bare `onSelect`
       * with NO `event.preventDefault()` / `event.stopPropagation()`. In Radix,
       * preventDefault() on the select event tells the menu NOT to dismiss —
       * that is exactly what made the Freeze item stay open while every other
       * item closed. The menu content is portaled outside the card, so letting
       * the event bubble cannot reach the card's click handlers either.
       */
      onSelect: () => handleFreezeToggle(),
    },
    {
      key: "edit",
      label: "Edit habit",
      Icon: Pencil,
      onSelect: () => editor.open(habit),
    },
    {
      key: "archive",
      label: habit.archived ? "Unarchive habit" : "Archive habit",
      Icon: Archive,
      onSelect: () => {
        archiveHabit(habit.id, !habit.archived);
        toast.success(habit.archived ? "Habit unarchived" : "Habit archived");
      },
    },
    {
      key: "skip",
      label: "Skip today",
      Icon: SkipForward,
      onSelect: () => skipHabit(habit.id, date),
    },
    {
      key: "clear",
      label: "Clear this day",
      Icon: RotateCcw,
      onSelect: () => clearLog(habit.id, date),
    },
    {
      key: "delete",
      label: "Delete habit",
      Icon: Trash2,
      destructive: true,
      onSelect: () => {
        // Snapshot the full habit BEFORE it leaves the store so the toast's
        // Undo action can restore it (daily logs are never removed, so the
        // whole history comes back with it).
        const habitToRestore = structuredClone(habit);
        removeHabit(habit.id);
        playDeleteHabitSound();
        toast.success("Habit deleted", {
          action: {
            label: "Undo",
            onClick: () => restoreHabit(habitToRestore),
          },
          duration: 5000, // Give them 5 seconds to undo
        });
      },
    },
  ];

  /**
   * Renders the shared action list with the item primitive of the active root.
   * A completed day can't be frozen, so the Freeze entry disappears entirely.
   */
  const renderMenuActions = (Item: MenuActionItem) => (
    <>
      {menuActions
        .filter((action) => !(action.key === "freeze" && isCompletedToday))
        .map(({ key, label, Icon, iconClassName, destructive, disabled, onSelect }) => (
          <Item
            key={key}
            className={cn(destructive && "text-red-500 focus:text-red-500")}
            {...(disabled ? { disabled: true } : {})}
            onSelect={onSelect}
          >
            <Icon className={cn("mr-2 h-4 w-4", iconClassName)} />
            {label}
          </Item>
        ))}
    </>
  );

  /** Primary timer CTA — used by the desktop toolbar and the mobile tray. */
  const renderTimerButton = (extra?: string) => (
    <Button
      size="sm"
      variant="outline"
      aria-label="Start a timer for this habit"
      disabled={isFrozen}
      className={cn(
        "flex h-11 px-7 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 transition-all",
        "hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
        extra,
      )}
      onClick={(e) => {
        e.stopPropagation();
        handleStartTimer();
      }}
    >
      <Play className="h-4 w-4 fill-current" />
      Timer
    </Button>
  );

  /**
   * Three-dots actions menu — shared by the desktop toolbar and the mobile tray.
   * The trigger and every item always live under one `<DropdownMenu>` root so
   * Radix can resolve its menu scope.
   */
  const renderMenuButton = (buttonClassName: string = iconButtonClass) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Habit actions"
          className={buttonClassName}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{renderMenuActions(DropdownMenuItem)}</DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCompleteButton = (withLabel: boolean, extra?: string) => (
    <Button
      size={withLabel ? "sm" : "icon"}
      variant="outline"
      disabled={isFrozen}
      aria-label={
        isFrozen ? "Frozen for today" : done ? "Mark habit as not done" : "Mark habit as complete"
      }
      className={cn(
        "shrink-0 items-center gap-2 rounded-xl border-transparent font-semibold shadow-sm transition-all",
        isFrozen
          ? "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          : "bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white dark:border-transparent dark:bg-emerald-600 dark:hover:bg-emerald-500",
        withLabel ? "h-11 px-8 text-sm font-bold" : "h-10 w-10",
        done && !isFrozen && "ring-1 ring-emerald-400/40",
        extra,
      )}
      onClick={(e) => {
        e.stopPropagation();
        complete();
      }}
    >
      {isFrozen ? (
        <Snowflake className="h-4 w-4 text-sky-500 dark:text-sky-400" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      {withLabel ? (isFrozen ? "Frozen" : done ? "Completed" : "Complete") : null}
    </Button>
  );

  /**
   * Stepper button: configured quick decrements, −1, +1, quick increments.
   * The colour tone follows the sign of `amount` (rose for subtract, emerald
   * for add) and `compact` swaps in the mobile tray footprint.
   */
  const renderStepperButton = (
    label: string,
    amount: number,
    ariaLabel: string,
    compact = false,
  ) => {
    const tone =
      amount < 0
        ? compact
          ? mobileStepperDecrementClass
          : stepperDecrementClass
        : compact
          ? mobileStepperIncrementClass
          : stepperIncrementClass;
    return (
      <Button
        key={label}
        size="sm"
        variant="outline"
        disabled={isFrozen}
        aria-label={ariaLabel}
        className={tone}
        onClick={(e) => {
          e.stopPropagation();
          handleIncrement(amount);
        }}
      >
        {label}
      </Button>
    );
  };

  const renderCounterCluster = () => (
    <div className="flex items-center gap-3">
      {/* Left side — configured quick decrement jumps (e.g. -5, -10), then the standard −1. */}
      {decrements.map((dec) => renderStepperButton(`-${dec}`, -dec, `Subtract ${dec}`))}
      {renderStepperButton("-1", -1, "Subtract 1")}
      {/* Right side — the standard +1, then configured quick increment jumps (e.g. +5, +10). */}
      {renderStepperButton("+1", 1, "Add 1")}
      {increments.map((inc) => renderStepperButton(`+${inc}`, inc, `Add ${inc}`))}
    </div>
  );

  const renderDesktopLayout = () => (
    <div
      ref={activatorRef}
      {...(draggable && !isOverlay && dragHandleProps ? dragHandleProps : {})}
      style={accentStyle}
      className={cn(
        cardSurfaceClass,
        /**
         * Desktop row: fills the container column edge-to-edge (`w-full mx-0`)
         * so the responsive grid never inherits stray outer margins. `p-6`
         * keeps the desktop inner padding exactly as before.
         */
        "hidden md:flex md:flex-col w-full mx-0 gap-5 p-6",
        done && !skipped && accentBorderClass,
        /** Icy frost overlay — frozen day, visually distinct in both themes. */
        isFrozen && "bg-sky-50/60 border-sky-200 dark:bg-sky-900/10 dark:border-sky-800/50",
        isFrozen && frozenDimClass,
        cardChrome,
        /** Long-press suppression on the drag surface — no native selection UI. */
        dragSurfaceClass,
        draggable && !isOverlay && "cursor-grab active:cursor-grabbing",
      )}
    >
      {/* Decorative background layers — dynamic progress fill + ambient glow */}
      <div
        aria-hidden
        className={cn(progressFillClass, done && !skipped && "opacity-[0.12] dark:opacity-[0.16]")}
        style={{ width: `${pct}%` }}
      />
      <div aria-hidden className={accentGlowClass} />
      {/* Row 1 — habit identity, status badges and clean text progress */}
      <div className="relative z-10 flex items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            role="button"
            tabIndex={0}
            aria-label={`Edit ${habit.name}`}
            className={cn(
              "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-transform hover:scale-105",
              accentTileClass,
            )}
            style={{ color: rawColor }}
            onClick={() => editor.open(habit)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") editor.open(habit);
            }}
          >
            {/* The accent tints Lucide glyphs; custom SVGs keep their own colours. */}
            <HabitIcon name={habit.icon} customIcons={customIcons} className="h-6 w-6" />
          </span>

          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editor.open(habit)}>
            <h3 className="truncate text-base md:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {habit.name}
            </h3>
            {hasDescription ? (
              <p
                role="button"
                tabIndex={0}
                aria-expanded={isDescriptionExpanded}
                title={isDescriptionExpanded ? "Collapse description" : "Expand description"}
                className={cn(
                  "text-xs md:text-sm font-normal text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 cursor-pointer transition hover:text-slate-600 dark:hover:text-slate-300",
                  isDescriptionExpanded && "line-clamp-none break-words",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleDescription();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleDescription();
                  }
                }}
              >
                {habit.description}
              </p>
            ) : (
              <p className="mt-1 truncate text-xs md:text-sm font-normal text-slate-500 dark:text-slate-400">
                {describeSchedule(habit.schedule)}
              </p>
            )}

            {/* Streak / status badges sit underneath the subtitle */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={cn(streakBadgeClass, "cursor-pointer")}
                title={`${currentStreak} ${currentStreak === 1 ? "day" : "days"} streak`}
              >
                🔥 {currentStreak} {currentStreak === 1 ? "day" : "days"}
              </span>
              {habit.description?.trim() ? (
                <span className={recurrenceBadgeClass}>{describeSchedule(habit.schedule)}</span>
              ) : null}
              {done && !skipped && !isFrozen ? (
                <span className={doneBadgeClass}>✓ Done</span>
              ) : null}
              {isFrozen ? <span className={frozenBadgeClass}>❄️ Frozen</span> : null}
              {skipped ? <span className={recurrenceBadgeClass}>Skipped</span> : null}
            </div>
          </div>
        </div>

        {/* Clean text progress (e.g. "0 / 30 min") + three-dots menu — no cramped inline bar */}
        <div className="flex shrink-0 items-center gap-3">
          <span
            aria-live="polite"
            className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300"
          >
            {progressText}
          </span>
          {renderMenuButton()}
        </div>
      </div>

      {/* Dedicated visual progress bar — accent fill, smooth width animation */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={value}
        className={cn("relative z-10", progressBarTrackClass)}
      >
        <div
          className={cn(progressBarFillClass, "bg-(--habit-color)")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Row 2 — spacious action toolbar. The timer CTA is only offered for
          timed / time-based habits; boolean and count habits never show it. */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        {habit.type === "boolean" ? (
          <div className="ms-auto flex items-center gap-3">{renderCompleteButton(true)}</div>
        ) : (
          <>
            <div className="flex items-center gap-3">{renderCounterCluster()}</div>
            <div className="flex items-center gap-3">
              {isTimerHabit ? renderTimerButton() : null}
              {renderCompleteButton(true)}
            </div>
          </>
        )}
      </div>
    </div>
  );

  /**
   * Mobile complete CTA — the only action in the collapsed row. Boolean habits
   * get a prominent check button; counter / time habits get the same 40×40 status
   * check that marks the daily target complete. The cramped inline (-, count, +)
   * stepper now lives exclusively in the expanded tray.
   */
  const renderMobilePrimaryAction = () => (
    <Button
      size="icon"
      variant="outline"
      disabled={isFrozen}
      aria-label={
        isFrozen ? "Frozen for today" : done ? "Mark habit as not done" : "Mark habit as complete"
      }
      title={
        isFrozen
          ? "Frozen for today — streak protected"
          : done
            ? "Completed — tap to undo"
            : "Mark complete"
      }
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-all",
        isFrozen
          ? "border border-sky-200 bg-sky-50 text-sky-500 dark:border-sky-800/60 dark:bg-sky-900/30 dark:text-sky-400"
          : "border border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
        !isFrozen &&
          (done
            ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-white"
            : "hover:border-emerald-500/50 hover:bg-emerald-500/25 hover:text-emerald-600 dark:hover:text-emerald-400"),
      )}
      onClick={(e) => {
        e.stopPropagation();
        complete();
      }}
    >
      {isFrozen ? (
        <Snowflake className="h-4 w-4 text-sky-500 dark:text-sky-400" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </Button>
  );

  /**
   * Mobile bottom action row — quick actions use the remaining width and can
   * be swiped horizontally, while the completion/menu group never shrinks.
   */
  const renderMobileTray = () => {
    return (
      <div
        className={cn(
          "relative z-10 mt-3 flex items-center gap-2",
          isExpanded && "animate-in fade-in slide-in-from-top-1 duration-200",
        )}
      >
        {/* Group A — swipeable quick actions. */}
        <div className="min-w-0 flex-1 overflow-x-auto flex flex-nowrap items-center gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isExpanded && showMobileStepper ? (
            <>
              {/* Left — user-configured decrement jumps, then the standard −1.
                  Nothing is shown for unconfigured habits beyond the ±1 pair. */}
              {decrements.map((dec) =>
                renderStepperButton(`-${dec}`, -dec, `Subtract ${dec}`, true),
              )}
              {renderStepperButton("-1", -1, "Subtract 1", true)}
              {/* Right — the standard +1, then user-configured increment jumps. */}
              {renderStepperButton("+1", 1, "Add 1", true)}
              {increments.map((inc) => renderStepperButton(`+${inc}`, inc, `Add ${inc}`, true))}
            </>
          ) : null}

          {/* Timer CTA — strictly timed habits; counter and boolean habits hide it. */}
          {isExpanded && isTimerHabit ? renderTimerButton("h-10 px-4 text-xs font-semibold") : null}
        </div>

        {/* Group B — fixed primary action and menu; never squeeze or wrap. */}
        <div className="flex shrink-0 items-center gap-2">
          {renderMobilePrimaryAction()}
          {renderMenuButton(mobileMenuButtonClass)}
        </div>
      </div>
    );
  };

  const renderMobileLayout = () => {
    /** Whole-card touch dragging on mobile — desktop keeps the dedicated grip. */
    const canDragFromCard = draggable && !isOverlay;

    return (
      <div
        style={accentStyle}
        className={cn(
          cardSurfaceClass,
          /**
           * Mobile card: stretches edge-to-edge inside the 16px page gutter.
           * `w-full mx-0` guarantees the card never adds its own outer spacing,
           * while `p-4` keeps the inner content comfortable.
           */
          "block w-full mx-0 p-4 mb-3 md:hidden",
          done && !skipped && accentBorderClass,
          /** Icy frost overlay — frozen day, visually distinct in both themes. */
          isFrozen && "bg-sky-50/60 border-sky-200 dark:bg-sky-900/10 dark:border-sky-800/50",
          isFrozen && frozenDimClass,
          cardChrome,
          /** Long-press suppression on the drag surface — no native selection UI. */
          dragSurfaceClass,
        )}
        {...(canDragFromCard ? mobileDragListeners : {})}
      >
        {/* Decorative background layers — dynamic progress fill + ambient glow */}
        <div
          aria-hidden
          className={cn(
            progressFillClass,
            done && !skipped && "opacity-[0.12] dark:opacity-[0.16]",
          )}
          style={{ width: `${pct}%` }}
        />
        <div aria-hidden className={accentGlowClass} />
        {/* Top row — icon, title + streak and the complete / (+) tray actions */}
        <div className="relative z-10 flex items-start gap-2.5">
          <span
            role="button"
            tabIndex={0}
            aria-label={`Edit ${habit.name}`}
            className={cn(
              "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-transform hover:scale-105",
              accentTileClass,
            )}
            style={{ color: rawColor }}
            onClick={() => editor.open(habit)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") editor.open(habit);
            }}
          >
            {/* The accent tints Lucide glyphs; custom SVGs keep their own colours. */}
            <HabitIcon name={habit.icon} customIcons={customIcons} className="h-5 w-5" />
          </span>

          {/* Left info column — never squeezed by the trailing action buttons */}
          <div className="min-w-0 flex-1 pr-2">
            <h3
              className="cursor-pointer break-words text-base md:text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50"
              onClick={() => editor.open(habit)}
            >
              {habit.name}
            </h3>

            {/* Description — one line by default, tap to reveal the full text */}
            {hasDescription ? (
              <p
                role="button"
                tabIndex={0}
                aria-expanded={isDescriptionExpanded}
                title={isDescriptionExpanded ? "Collapse description" : "Expand description"}
                className={cn(
                  "text-xs md:text-sm font-normal text-slate-500 dark:text-slate-400 mt-1 cursor-pointer transition-colors hover:text-slate-600 dark:hover:text-slate-300",
                  isDescriptionExpanded ? "whitespace-normal break-words" : "line-clamp-1",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleDescription();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleDescription();
                  }
                }}
              >
                {habit.description}
              </p>
            ) : null}

            {/* Streak badge — displayed cleanly below the title */}
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              <span
                className={cn(streakBadgeClass, "shrink-0 cursor-pointer")}
                title={`${currentStreak} ${currentStreak === 1 ? "day" : "days"} streak`}
              >
                🔥 {currentStreak}
              </span>
              <span
                aria-live="polite"
                className="cursor-pointer truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"
                onClick={() => editor.open(habit)}
              >
                {habit.type === "boolean"
                  ? progressText
                  : `${compactProgressText}${habit.unit ? ` ${habit.unit}` : ""} · ${describeSchedule(habit.schedule)}`}
              </span>
            </div>
          </div>

          {/* Complete action + dedicated (+) tray toggle. The toggle only stops
              propagation, so tapping it never marks the habit complete. It is
              always available because the tray always carries the actions menu. */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Hide extra actions" : "Show extra actions"}
              title={isExpanded ? "Hide extra actions" : "Show extra actions"}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white",
                isExpanded &&
                  "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              <Plus
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-45",
                )}
              />
            </button>
          </div>
        </div>

        {/* Dedicated visual progress bar — accent fill, smooth width animation */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={value}
          className={cn("relative z-10", progressBarTrackClass)}
        >
          <div
            className={cn(progressBarFillClass, "bg-(--habit-color)")}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Expandable secondary tray */}
        {renderMobileTray()}
      </div>
    );
  };

  return (
    <ContextMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <li
          ref={ref}
          style={style}
          onDragStart={onDragStart}
          onDragEnter={onDragEnter}
          onDragEnd={onDragEnd}
          onDragOver={onDragStart ? (e) => e.preventDefault() : undefined}
          onPointerDown={handlePointerDown}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          className={cn(
            /**
             * The sortable wrapper spans the full container width and carries no
             * outer horizontal margin, so the card inside is the only thing that
             * defines the visible edge (16px page gutter on mobile).
             */
            "w-full mx-0 list-none transition-all",
            /** Long-press suppression on the drag surface — no native selection UI. */
            dragSurfaceClass,
            isDragging && "opacity-40",
            isOverlay && "z-50 scale-[1.01] pointer-events-none",
          )}
        >
          {renderDesktopLayout()}
          {renderMobileLayout()}
        </li>
      </ContextMenuTrigger>
      {/**
       * The long-press / right-click sheet lives under a `<ContextMenu>` root, so
       * it renders `ContextMenuItem`s. Dropdown items are only valid under a
       * `<DropdownMenu>` root — mixing the two scopes is what made Radix throw
       * "MenuItem must be used within Menu".
       */}
      <ContextMenuContent>{renderMenuActions(ContextMenuItem)}</ContextMenuContent>
    </ContextMenu>
  );
});

export function SortableHabitRow(props: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.habit.id,
    disabled: !props.draggable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...props.style,
  };

  return (
    <HabitRow
      ref={setNodeRef}
      activatorRef={setActivatorNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragListeners={listeners}
      {...props}
    />
  );
}
