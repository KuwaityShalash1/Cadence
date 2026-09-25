import { useState } from "react";
import { useProgressiveDisclosure } from "@/hooks/use-progressive-disclosure";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";

import {
  HabitIcon,
  RenderIcon,
  colorStyles,
  getColorStyle,
  resolveIconName,
} from "@/components/icon-map";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { IconPicker } from "@/components/shared/IconPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useApp, uid } from "@/stores/app-store";
import type { CustomIcon, Goal, Habit } from "@/types";

interface GoalSuggestion {
  name: string;
  /** Blurb that fills the description field along with the name. */
  description: string;
  /** Lucide icon name — kebab-case names are normalised on apply. */
  icon: string;
  /** Custom HEX accent colour (works everywhere the palette names do). */
  color: string;
  type: Goal["type"];
  targetValue: number;
  unit: string;
  /** Metadata badge shown on the right side of each template card. */
  badge: string;
}

/** Ready-made goal templates for the collapsible Quick Suggestions card list. */
const GOAL_SUGGESTIONS: GoalSuggestion[] = [
  {
    name: "Read 12 Books",
    description: "Finish one book every month",
    icon: "book",
    color: "#A855F7",
    type: "numeric",
    targetValue: 12,
    unit: "books",
    badge: "12 books",
  },
  {
    name: "Emergency Fund",
    description: "Set aside a fixed amount every month",
    icon: "wallet",
    color: "#10B981",
    type: "numeric",
    targetValue: 1000,
    unit: "$",
    badge: "$1,000 target",
  },
  {
    name: "Run 5K Marathon",
    description: "Train consistently toward race day",
    icon: "activity",
    color: "#F97316",
    type: "numeric",
    targetValue: 5,
    unit: "km",
    badge: "5 kilometers",
  },
  {
    name: "Learn Coding / AI",
    description: "Daily practice toward conversational fluency",
    icon: "code",
    color: "#0EA5E9",
    type: "numeric",
    targetValue: 50,
    unit: "hours",
    badge: "50 hours",
  },
  {
    name: "Finish a Course",
    description: "Complete a structured course one lesson at a time",
    icon: "book-open",
    color: "#6366F1",
    type: "habit_milestone",
    targetValue: 12,
    unit: "lessons",
    badge: "12 lessons",
  },
  {
    name: "Build a Portfolio Project",
    description: "Ship a practical project that demonstrates your skills",
    icon: "code-2",
    color: "#0EA5E9",
    type: "numeric",
    targetValue: 1,
    unit: "project",
    badge: "1 project",
  },
  {
    name: "Save for a Safety Net",
    description: "Build an emergency fund through small regular deposits",
    icon: "wallet",
    color: "#10B981",
    type: "numeric",
    targetValue: 2000,
    unit: "$",
    badge: "$2,000 target",
  },
  {
    name: "Run a 10K",
    description: "Train gradually toward a confident race-day finish",
    icon: "footprints",
    color: "#F97316",
    type: "numeric",
    targetValue: 10,
    unit: "km",
    badge: "10 kilometers",
  },
  {
    name: "Read More This Year",
    description: "Make space for books that help you learn and recharge",
    icon: "book",
    color: "#A855F7",
    type: "numeric",
    targetValue: 24,
    unit: "books",
    badge: "24 books",
  },
  {
    name: "Create a Calm Morning",
    description: "Build a sustainable morning routine that starts gently",
    icon: "sun",
    color: "#EAB308",
    type: "habit_milestone",
    targetValue: 30,
    unit: "mornings",
    badge: "30-day practice",
  },
  {
    name: "Improve Sleep Consistency",
    description: "Protect a reliable bedtime and wake-up rhythm",
    icon: "moon",
    color: "#6366F1",
    type: "habit_milestone",
    targetValue: 30,
    unit: "nights",
    badge: "30 nights",
  },
  {
    name: "Learn a New Language",
    description: "Reach a useful conversational foundation through practice",
    icon: "languages",
    color: "#14B8A6",
    type: "numeric",
    targetValue: 500,
    unit: "words",
    badge: "500 words",
  },
  {
    name: "Make Time for Creativity",
    description: "Finish a body of writing, art, music, or design work",
    icon: "pen-tool",
    color: "#EC4899",
    type: "habit_milestone",
    targetValue: 20,
    unit: "sessions",
    badge: "20 sessions",
  },
];

export function GoalForm({
  goal,
  habits,
  customIcons,
  onDone,
  onSave,
  onLinkHabit,
}: {
  goal: Goal | null;
  habits: Habit[];
  customIcons: CustomIcon[];
  onDone: () => void;
  onSave: (goal: Goal) => void;
  onLinkHabit: (habitId: string, goalId: string) => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [icon, setIcon] = useState(goal?.icon || "target");
  const [color, setColor] = useState(goal?.color || "#3B82F6");
  const [goalType, setGoalType] = useState<Goal["type"]>(goal?.type ?? "numeric");
  const [targetValue, setTargetValue] = useState(String(goal?.targetValue ?? ""));
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [habitIds, setHabitIds] = useState<string[]>(goal?.habitIds ?? []);
  const {
    isExpanded: isSuggestionsOpen,
    toggle: toggleSuggestions,
    query: suggestionSearch,
    setQuery: setSuggestionSearch,
  } = useProgressiveDisclosure();


  const activeHabits = habits.filter((h) => !h.archived);

  // Accent + tint for the live preview — works for palette names and custom HEX.
  const previewTint = getColorStyle(color, 0.14);

  /** Selected icon tile in the picker grid — colour-matched tint, border and glyph. */
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: previewTint.tint,
    borderColor: previewTint.rawColor,
    color: previewTint.rawColor,
  };

  /** One-click template: fills name, description, icon and colour in a single tap. */
  function applySuggestion(suggestion: GoalSuggestion) {
    setName(suggestion.name);
    setDescription(suggestion.description);
    setIcon(resolveIconName(suggestion.icon));
    setColor(suggestion.color);
    setGoalType(suggestion.type);
    setTargetValue(String(suggestion.targetValue));
    setUnit(suggestion.unit);
  }

  /** Filter goal suggestions by the current search query (case-insensitive,
    matches against the template name and badge text). */
  function filteredGoalSuggestions(): GoalSuggestion[] {
    const q = suggestionSearch.toLowerCase();
    if (!q) return GOAL_SUGGESTIONS;
    return GOAL_SUGGESTIONS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q),
    );
  }

  function toggleHabit(id: string) {
    setHabitIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the goal a name");
      return;
    }
    const parsedTargetValue = Number(targetValue);
    if (!Number.isFinite(parsedTargetValue) || parsedTargetValue <= 0) {
      toast.error("Enter a target value greater than zero");
      return;
    }
    if (!unit.trim()) {
      toast.error("Enter a unit for this goal");
      return;
    }
    const id = goal?.id ?? uid();
    const next: Goal = {
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      habitIds,
      icon,
      color,
      type: goalType,
      targetValue: parsedTargetValue,
      currentValue: goal?.type === goalType ? goal.currentValue : 0,
      unit: unit.trim(),
      targetDate: targetDate || undefined,
      createdAt: goal?.createdAt ?? Date.now(),
      /** ISO timestamp initialized on creation for sync metadata. */
      updatedAt: new Date().toISOString(),
    };
    habitIds.forEach((hid) => onLinkHabit(hid, id));
    onSave(next);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!goal && (
        <fieldset className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          {/* Unified header: title + subtitle form one large click target that
              toggles the section, and the chevron button on the right is a
              PERMANENT toggle rendered in BOTH collapsed and expanded states —
              only the body below this header toggles. */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div
              className="flex-1 cursor-pointer select-none"
              onClick={toggleSuggestions}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">✨</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Quick Suggestions
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Tap a template to prefill the form — you can still edit everything below.
              </p>
            </div>

            {/* PERMANENT TOGGLE BUTTON */}
            <button
              type="button"
              onClick={toggleSuggestions}
              aria-expanded={isSuggestionsOpen}
              aria-label={isSuggestionsOpen ? "Collapse suggestions" : "Expand suggestions"}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  isSuggestionsOpen ? "rotate-180" : "rotate-0",
                )}
                aria-hidden="true"
              />
            </button>
          </div>
          {/* Collapsed peek: two preview chips — hidden once the panel is open.
              Expanded panel: CSS Grid height animation (0fr → 1fr) keeps this
              purely CSS-driven with zero layout thrash. */}
          {!isSuggestionsOpen && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {GOAL_SUGGESTIONS.slice(0, 2).map((suggestion) => (
                <button
                  key={suggestion.name}
                  type="button"
                  aria-label={`Use template: ${suggestion.name}`}
                  aria-pressed={name === suggestion.name}
                  onClick={() => applySuggestion(suggestion)}
                  className="w-full flex items-center justify-start px-3 py-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition active:scale-95 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${suggestion.color}20`,
                        color: suggestion.color,
                      }}
                    >
                      <RenderIcon
                        className="w-4 h-4"
                        name={suggestion.icon}
                        style={{ color: suggestion.color }}
                      />
                    </div>
                    <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {suggestion.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Grid-based height animation — transition on grid-template-rows
              from 0fr (fully collapsed, no height) to 1fr (natural height).
              The inner div MUST have overflow-hidden for the clip to work. */}
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              isSuggestionsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="relative mt-2">
                <Search
                  className="absolute top-2.5 left-3 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search goals..."
                  value={suggestionSearch}
                  onChange={(e) => setSuggestionSearch(e.target.value)}
                  aria-label="Search templates"
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                />
              </div>
              {filteredGoalSuggestions().length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                  {filteredGoalSuggestions().map((suggestion) => (
                    <button
                      key={suggestion.name}
                      type="button"
                      aria-label={`Use template: ${suggestion.name}`}
                      aria-pressed={name === suggestion.name}
                      onClick={() => applySuggestion(suggestion)}
                      style={
                        name === suggestion.name
                          ? {
                              borderColor: suggestion.color,
                              boxShadow: `0 0 0 1px ${suggestion.color}`,
                            }
                          : undefined
                      }
                      className="w-full flex cursor-pointer items-center justify-start rounded-xl border border-slate-200/80 bg-white px-3 py-2 transition active:scale-[0.99] hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:bg-slate-800/80"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `${suggestion.color}20`,
                            color: suggestion.color,
                          }}
                        >
                          <RenderIcon
                            className="h-4 w-4"
                            name={suggestion.icon}
                            style={{ color: suggestion.color }}
                          />
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-semibold whitespace-normal text-slate-800 dark:text-slate-200">
                          {suggestion.name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No matching templates found
                </p>
              )}
            </div>
          </div>
        </fieldset>
      )}

      <div className="space-y-2">
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Read 12 books this year"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-desc">Description</Label>
        <Textarea
          id="goal-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional detail"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-date">Target date</Label>
        <Input
          id="goal-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-type">Tracking type</Label>
        <Select value={goalType} onValueChange={(value) => setGoalType(value as Goal["type"])}>
          <SelectTrigger id="goal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="numeric">Numeric / Manual</SelectItem>
            <SelectItem value="habit_milestone">Habit Milestone</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {goalType === "numeric"
            ? "Update progress manually. Linked habits are action-plan reminders."
            : "Progress counts completed logs from the linked habits below."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="goal-target-value">Target value</Label>
          <Input
            id="goal-target-value"
            type="number"
            min="0"
            step="any"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="e.g. 12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-unit">Unit</Label>
          <Input
            id="goal-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="books, kg, workouts"
            maxLength={24}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        {/* Live preview — mirrors the goal card. Custom icons are resolved
            first so a saved SVG never falls back to the default Lucide glyph. */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors"
            style={{ ...previewTint.style, color: previewTint.rawColor }}
          >
            <HabitIcon name={icon} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name.trim() || "Goal preview"}</p>
            <p className="text-xs text-muted-foreground">How your goal will look</p>
          </div>
        </div>
        <IconPicker selectedIcon={icon} onChange={setIcon} activeTileStyle={activeIconTileStyle} />
      </fieldset>

      <ColorPicker selectedColor={color} onChange={setColor} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Linked habits</legend>
        {activeHabits.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active habits to link.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeHabits.map((habit) => {
              const active = habitIds.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleHabit(habit.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg",
                      colorStyles(habit.color).soft,
                    )}
                  >
                    <HabitIcon
                      name={habit.icon}
                      customIcons={customIcons}
                      className={cn("h-4 w-4", colorStyles(habit.color).text)}
                    />
                  </span>
                  {habit.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} className="h-11">
          Cancel
        </Button>
        <Button type="submit" className="h-11">
          {goal ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
