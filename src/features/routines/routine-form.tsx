import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { HabitIcon, RenderIcon, getColorStyle, resolveIconName } from "@/components/icon-map";
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
import { cn } from "@/lib/utils";
import { useApp, uid } from "@/stores/app-store";
import type { Routine, RoutineStep } from "@/types";

interface RoutineSuggestion {
  name: string;
  /** Lucide icon name — kebab-case names are normalised on apply. */
  icon: string;
  /** Custom HEX accent colour (works everywhere the palette names do). */
  color: string;
  /** Metadata badge shown on the right side of each template card. */
  badge: string;
}

/** Ready-made routine templates for the collapsible Quick Suggestions card list. */
const ROUTINE_SUGGESTIONS: RoutineSuggestion[] = [
  { name: "Morning Setup", icon: "sun", color: "#EAB308", badge: "3 steps • 15m" },
  { name: "Evening Wind Down", icon: "moon", color: "#6366F1", badge: "4 steps • 30m" },
  { name: "Deep Work Session", icon: "brain", color: "#3B82F6", badge: "2 steps • 90m" },
  { name: "Sunday Reset", icon: "refresh-cw", color: "#10B981", badge: "5 steps • 45m" },
  { name: "Exam Prep Sprint", icon: "book-open", color: "#8B5CF6", badge: "4 steps • 60m" },
  { name: "Developer Daily Loop", icon: "code-2", color: "#0EA5E9", badge: "4 steps • 75m" },
  { name: "Money Check-In", icon: "wallet", color: "#10B981", badge: "3 steps • 15m" },
  { name: "Mindful Reset", icon: "heart", color: "#14B8A6", badge: "3 steps • 20m" },
  { name: "Screen-Free Night", icon: "phone-off", color: "#64748B", badge: "4 steps • 40m" },
  { name: "Creative Practice", icon: "pen-tool", color: "#EC4899", badge: "3 steps • 45m" },
  { name: "Meal Prep Block", icon: "utensils", color: "#F97316", badge: "4 steps • 60m" },
  { name: "Home Maintenance", icon: "refresh-cw", color: "#64748B", badge: "5 steps • 30m" },
  {
    name: "Weekly Planning Review",
    icon: "calendar-check",
    color: "#A855F7",
    badge: "4 steps • 25m",
  },
];

export function RoutineForm({
  routine,
  habits,
  onDone,
  onSave,
}: {
  routine: Routine | null;
  habits: { id: string; name: string; icon: string; color: string }[];
  onDone: () => void;
  onSave: (routine: Routine) => void;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [icon, setIcon] = useState(routine?.icon ?? "Sun");
  const [color, setColor] = useState(routine?.color ?? "teal");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekdays">(
    routine?.schedule.type === "weekdays" ? "weekdays" : "daily",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    routine?.schedule.type === "weekdays" ? routine.schedule.days : [1, 2, 3, 4, 5],
  );
  const [steps, setSteps] = useState<RoutineStep[]>(routine?.steps ?? [{ id: uid(), title: "" }]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
  const [suggestionSearch, setSuggestionSearch] = useState("");

  const activeHabits = habits;
  const { customIcons } = useApp();

  // Accent + tint for the live preview — works for palette names and custom HEX.
  const previewTint = getColorStyle(color, 0.14);

  /** Selected icon tile in the picker grid — colour-matched tint, border and glyph. */
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: previewTint.tint,
    borderColor: previewTint.rawColor,
    color: previewTint.rawColor,
  };

  /** One-click template: fills the name, icon and colour in a single tap. */
  function applySuggestion(suggestion: RoutineSuggestion) {
    setName(suggestion.name);
    setIcon(resolveIconName(suggestion.icon));
    setColor(suggestion.color);
  }

  /** Filter routine suggestions by the current search query (case-insensitive,
    matches against the template name and badge text). */
  function filteredRoutineSuggestions(): RoutineSuggestion[] {
    const q = suggestionSearch.toLowerCase();
    if (!q) return ROUTINE_SUGGESTIONS;
    return ROUTINE_SUGGESTIONS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q),
    );
  }

  function updateStep(id: string, patch: Partial<RoutineStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, { id: uid(), title: "", /** ISO timestamp initialized on creation. */ updatedAt: new Date().toISOString() }]);
  }
  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the routine a name");
      return;
    }
    const cleanSteps = steps.filter((s) => s.title.trim());
    if (!cleanSteps.length) {
      toast.error("Add at least one step");
      return;
    }
    const next: Routine = {
      id: routine?.id ?? uid(),
      name: name.trim(),
      icon,
      color,
      steps: cleanSteps.map((s) => ({
        ...s,
        title: s.title.trim(),
        habitId: s.habitId || undefined,
      })),
      schedule:
        scheduleType === "weekdays"
          ? { type: "weekdays", days: weekdays.length ? weekdays : [1] }
          : { type: "daily" },
      createdAt: routine?.createdAt ?? Date.now(),
      /** ISO timestamp initialized on creation for sync metadata. */
      updatedAt: new Date().toISOString(),
    };
    onSave(next);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!routine && (
        <>
          <fieldset className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
            {/* Unified header: title + subtitle form one large click target that
              toggles the section, and the chevron button on the right is a
              PERMANENT toggle rendered in BOTH collapsed and expanded states —
              only the body below this header toggles. */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div
                className="flex-1 cursor-pointer select-none"
                onClick={() => setIsSuggestionsOpen((v) => !v)}
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
                onClick={() => setIsSuggestionsOpen((v) => !v)}
                aria-expanded={isSuggestionsOpen}
                aria-label={isSuggestionsOpen ? "Collapse suggestions" : "Expand suggestions"}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isSuggestionsOpen ? "rotate-180" : "rotate-0",
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>
            {/* Collapsed: exactly two suggestions in a fixed 2-column grid — no
              horizontal scrolling and nothing clipped at the container edge.
              Expanded: search box + the full scrollable template catalog. */}
            {isSuggestionsOpen ? (
              <>
                <div className="relative my-2">
                  <Search
                    className="absolute top-2.5 left-3 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    placeholder="Search routines..."
                    value={suggestionSearch}
                    onChange={(e) => setSuggestionSearch(e.target.value)}
                    aria-label="Search templates"
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                  />
                </div>
                {filteredRoutineSuggestions().length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                    {filteredRoutineSuggestions().map((suggestion) => {
                      return (
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
                            <span className="min-w-0 flex-1 text-xs font-semibold whitespace-normal text-slate-800 dark:text-slate-200">
                              {suggestion.name}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No matching templates found
                  </p>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ROUTINE_SUGGESTIONS.slice(0, 2).map((suggestion) => {
                  return (
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
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {suggestion.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="routine-name">Name</Label>
        <Input
          id="routine-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning Routine"
          autoComplete="off"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        {/* Live preview — mirrors the routine card. Custom icons are resolved
            first so a saved SVG never falls back to the default Lucide glyph. */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ ...previewTint.style, color: previewTint.rawColor }}
          >
            <HabitIcon name={icon} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name.trim() || "Routine preview"}</p>
            <p className="text-xs text-muted-foreground">How your routine will look</p>
          </div>
        </div>
        <IconPicker selectedIcon={icon} onChange={setIcon} activeTileStyle={activeIconTileStyle} />
      </fieldset>

      <ColorPicker selectedColor={color} onChange={setColor} />

      <div className="space-y-2">
        <Label htmlFor="routine-schedule">Schedule</Label>
        <Select
          value={scheduleType}
          onValueChange={(v) => setScheduleType(v as "daily" | "weekdays")}
        >
          <SelectTrigger id="routine-schedule" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Every day</SelectItem>
            <SelectItem value="weekdays">Weekdays</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleType === "weekdays" && (
        <div className="space-y-2">
          <Label id="routine-weekdays-label">Weekdays</Label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => {
              const active = weekdays.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={active}
                  aria-labelledby="routine-weekdays-label"
                  onClick={() =>
                    setWeekdays((prev) =>
                      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
                    )
                  }
                  className={cn(
                    "h-9 min-w-0 rounded-lg border px-2 text-xs font-medium sm:px-3 sm:text-sm",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Steps</legend>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2">
              <span className="numeric w-6 shrink-0 text-xs text-muted-foreground">
                {index + 1}.
              </span>
              <Input
                value={step.title}
                onChange={(e) => updateStep(step.id, { title: e.target.value })}
                placeholder="Step description"
                className="h-11 flex-1 min-w-0"
              />
              <Select
                value={step.habitId ?? "none"}
                onValueChange={(v) =>
                  updateStep(step.id, {
                    habitId: v === "none" ? undefined : v,
                  })
                }
              >
                <SelectTrigger className="h-11 w-36 shrink-0">
                  <SelectValue placeholder="Link habit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No link</SelectItem>
                  {activeHabits.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeStep(step.id)}
                aria-label="Remove step"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addStep}>
          <Plus className="mr-1 h-4 w-4" /> Add step
        </Button>
        <p className="text-xs text-muted-foreground">
          Add steps to build your routine. Link habits to reuse existing ones.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} className="h-11">
          Cancel
        </Button>
        <Button type="submit" className="h-11">
          {routine ? "Save changes" : "Create routine"}
        </Button>
      </div>
    </form>
  );
}
