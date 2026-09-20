import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { HabitIcon, RenderIcon, getColorStyle, resolveIconName } from "@/components/icon-map";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { IconPicker } from "@/components/shared/IconPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp, uid } from "@/stores/app-store";
import type { BadHabit } from "@/types";

interface QuitSuggestion {
  name: string;
  /** Lucide icon name — kebab-case names are normalised on apply. */
  icon: string;
  /** Custom HEX accent colour (works everywhere the palette names do). */
  color: string;
  /** Metadata badge shown on the right side of each template card. */
  badge: string;
}

/** Ready-made quit-tracker templates for the collapsible Quick Suggestions card list. */
const QUIT_SUGGESTIONS: QuitSuggestion[] = [
  { name: "Smoking / Vaping", icon: "flame", color: "#EF4444", badge: "Health" },
  { name: "Junk Food & Sugar", icon: "pizza", color: "#F97316", badge: "Diet" },
  { name: "Social Media Doomscrolling", icon: "smartphone", color: "#3B82F6", badge: "Focus" },
  { name: "Procrastination", icon: "clock", color: "#64748B", badge: "Productivity" },
  { name: "Nail Biting", icon: "hand", color: "#EC4899", badge: "Habit" },
  { name: "Late-Night Scrolling", icon: "moon", color: "#6366F1", badge: "Sleep" },
  { name: "Impulse Shopping", icon: "wallet", color: "#10B981", badge: "Finance" },
  { name: "Sugary Drinks", icon: "droplets", color: "#0EA5E9", badge: "Health" },
  { name: "Energy Drink Dependence", icon: "flame", color: "#EAB308", badge: "Health" },
  { name: "Excessive Gaming", icon: "tv", color: "#8B5CF6", badge: "Digital" },
  { name: "Constant News Checking", icon: "globe", color: "#3B82F6", badge: "Mental health" },
  { name: "Negative Self-Talk", icon: "heart", color: "#EC4899", badge: "Wellbeing" },
  { name: "Skipping Meals", icon: "utensils", color: "#F97316", badge: "Health" },
  { name: "Work After Hours", icon: "briefcase", color: "#64748B", badge: "Boundaries" },
  {
    name: "Checking Messages Constantly",
    icon: "smartphone",
    color: "#0EA5E9",
    badge: "Productivity",
  },
  { name: "Alcohol", icon: "ban", color: "#DC2626", badge: "Health" },
  { name: "Compulsive Snacking", icon: "apple", color: "#EF4444", badge: "Nutrition" },
  { name: "Avoiding Difficult Tasks", icon: "lock", color: "#7C3AED", badge: "Growth" },
];

function toLocalDateTimeString(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuitTrackerForm({
  habit,
  onDone,
}: {
  habit: BadHabit | undefined;
  onDone: () => void;
}) {
  const { upsertBadHabit } = useApp();
  const [title, setTitle] = useState(habit?.title ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "Flame");
  const [color, setColor] = useState(habit?.color ?? "rose");
  const [quitDateTime, setQuitDateTime] = useState<string>(
    toLocalDateTimeString(habit?.quitDate ?? Date.now()),
  );
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
  const [suggestionSearch, setSuggestionSearch] = useState("");

  // Accent + tint for the selected picker tile — works for palette names and
  // custom HEX values, so the picker highlight always matches the live card.
  const activeTint = getColorStyle(color, 0.14);
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: activeTint.tint,
    borderColor: activeTint.rawColor,
    color: activeTint.rawColor,
  };

  /** One-click template: fills the title, icon and colour in a single tap. */
  function applySuggestion(suggestion: QuitSuggestion) {
    setTitle(suggestion.name);
    setIcon(resolveIconName(suggestion.icon));
    setColor(suggestion.color);
  }

  /** Filter quit suggestions by the current search query (case-insensitive,
    matches against the template name and badge text). */
  function filteredQuitSuggestions(): QuitSuggestion[] {
    const q = suggestionSearch.toLowerCase();
    if (!q) return QUIT_SUGGESTIONS;
    return QUIT_SUGGESTIONS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title for the bad habit");
      return;
    }

    const id = habit?.id ?? uid();
    const now = Date.now();
    const parsedQuitDate = quitDateTime
      ? new Date(quitDateTime).getTime()
      : (habit?.quitDate ?? now);

    const updated: BadHabit = {
      id,
      title: title.trim(),
      quitDate: isNaN(parsedQuitDate) ? now : parsedQuitDate,
      history: habit?.history ?? [],
      createdAt: habit?.createdAt ?? now,
      /** ISO timestamp initialized on creation for sync metadata. */
      updatedAt: new Date().toISOString(),
      icon,
      color,
    };

    upsertBadHabit(updated);
    toast.success(habit ? "Bad habit updated successfully" : "Quit tracker created! Stay strong.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-2">
      {!habit && (
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
                  placeholder="Search habits to quit..."
                  value={suggestionSearch}
                  onChange={(e) => setSuggestionSearch(e.target.value)}
                  aria-label="Search templates"
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                />
              </div>
              {filteredQuitSuggestions().length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                  {filteredQuitSuggestions().map((suggestion) => {
                    return (
                      <button
                        key={suggestion.name}
                        type="button"
                        aria-label={`Use template: ${suggestion.name}`}
                        aria-pressed={title === suggestion.name}
                        onClick={() => applySuggestion(suggestion)}
                        style={
                          title === suggestion.name
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
              {QUIT_SUGGESTIONS.slice(0, 2).map((suggestion) => {
                return (
                  <button
                    key={suggestion.name}
                    type="button"
                    aria-label={`Use template: ${suggestion.name}`}
                    aria-pressed={title === suggestion.name}
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
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      <div className="space-y-2">
        <Label htmlFor="habit-title">Habit / Addiction Title</Label>
        <Input
          id="habit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Smoking, Junk Food, Social Media Scrolling"
          autoComplete="off"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quit-date">Quit Start Time</Label>
        <Input
          id="quit-date"
          type="datetime-local"
          value={quitDateTime}
          onChange={(e) => setQuitDateTime(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Unified shared pickers — IconPicker adds custom SVG upload/paste
          (saved to the global store) and ColorPicker adds a custom HEX
          popover with a persisted palette. */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors"
            style={{ ...activeTint.style, color: activeTint.rawColor }}
          >
            <HabitIcon name={icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {title.trim() || "Quit tracker preview"}
            </p>
            <p className="text-xs text-muted-foreground">How your quit tracker will look</p>
          </div>
        </div>
        <IconPicker selectedIcon={icon} onChange={setIcon} activeTileStyle={activeIconTileStyle} />
      </fieldset>

      <ColorPicker selectedColor={color} onChange={setColor} />

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} className="h-11">
          Cancel
        </Button>
        <Button type="submit" className="h-11 sm:min-w-32 font-semibold">
          {habit ? "Save Changes" : "Start Tracking"}
        </Button>
      </div>
    </form>
  );
}
