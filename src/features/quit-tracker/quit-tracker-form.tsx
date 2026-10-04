import { useState } from "react";
import { useProgressiveDisclosure } from "@/hooks/use-progressive-disclosure";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { RenderIcon, getColorStyle, resolveIconName } from "@/components/icon-map";
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
import { Progress } from "@/components/ui/progress";
import { useApp, uid } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import type { BadHabit } from "@/types";

interface QuitSuggestion {
  key: string;
  name: string;
  /** Lucide icon name — kebab-case names are normalised on apply. */
  icon: string;
  /** Custom HEX accent colour (works everywhere the palette names do). */
  color: string;
  /** Metadata badge shown on the right side of each template card. */
  badge: string;
  /**
   * Preconfigured strategy for this suggestion.
   * - "cold-turkey": Complete Cessation (full abstinence).
   * - "limit": Moderation / Limit (moderate usage with a daily limit).
   * When "limit", limitType and limitValue are also preconfigured.
   */
  strategy?: "cold-turkey" | "limit";
  /** The type of limit (time or count). Only used when strategy is "limit". */
  limitType?: "time" | "count";
  /** The daily limit value. Only used when strategy is "limit". */
  limitValue?: number;
}

/** Ready-made quit-tracker templates for the collapsible Quick Suggestions card list. */
const QUIT_SUGGESTIONS: QuitSuggestion[] = [
  { key: "smoking", name: "Smoking / Vaping", icon: "flame", color: "#EF4444", badge: "Health", strategy: "cold-turkey" },
  { key: "junkFood", name: "Junk Food & Sugar", icon: "pizza", color: "#F97316", badge: "Diet", strategy: "cold-turkey" },
  {
    key: "doomscrolling",
    name: "Social Media Doomscrolling",
    icon: "smartphone",
    color: "#3B82F6",
    badge: "Focus",
    strategy: "limit",
    limitType: "time",
    limitValue: 120,
  },
  { key: "procrastination", name: "Procrastination", icon: "clock", color: "#64748B", badge: "Productivity", strategy: "cold-turkey" },
  { key: "nailBiting", name: "Nail Biting", icon: "hand", color: "#EC4899", badge: "Habit", strategy: "cold-turkey" },
  { key: "lateNightScrolling", name: "Late-Night Scrolling", icon: "moon", color: "#6366F1", badge: "Sleep", strategy: "cold-turkey" },
  { key: "impulseShopping", name: "Impulse Shopping", icon: "wallet", color: "#10B981", badge: "Finance", strategy: "cold-turkey" },
  { key: "sugaryDrinks", name: "Sugary Drinks", icon: "droplets", color: "#0EA5E9", badge: "Health", strategy: "limit", limitType: "count", limitValue: 1 },
  { key: "energyDrinks", name: "Energy Drink Dependence", icon: "flame", color: "#EAB308", badge: "Health", strategy: "limit", limitType: "count", limitValue: 1 },
  { key: "excessiveGaming", name: "Excessive Gaming", icon: "tv", color: "#8B5CF6", badge: "Digital", strategy: "limit", limitType: "time", limitValue: 60 },
  { key: "constantNews", name: "Constant News Checking", icon: "globe", color: "#3B82F6", badge: "Mental health", strategy: "limit", limitType: "time", limitValue: 30 },
  { key: "negativeSelfTalk", name: "Negative Self-Talk", icon: "heart", color: "#EC4899", badge: "Wellbeing", strategy: "cold-turkey" },
  { key: "skippingMeals", name: "Skipping Meals", icon: "utensils", color: "#F97316", badge: "Health", strategy: "cold-turkey" },
  { key: "workAfterHours", name: "Work After Hours", icon: "briefcase", color: "#64748B", badge: "Boundaries", strategy: "cold-turkey" },
  {
    key: "checkingMessages",
    name: "Checking Messages Constantly",
    icon: "smartphone",
    color: "#0EA5E9",
    badge: "Productivity",
    strategy: "limit",
    limitType: "time",
    limitValue: 60,
  },
  { key: "alcohol", name: "Alcohol", icon: "ban", color: "#DC2626", badge: "Health", strategy: "cold-turkey" },
  { key: "compulsiveSnacking", name: "Compulsive Snacking", icon: "apple", color: "#EF4444", badge: "Nutrition", strategy: "limit", limitType: "count", limitValue: 3 },
  { key: "avoidingDifficultTasks", name: "Avoiding Difficult Tasks", icon: "lock", color: "#7C3AED", badge: "Growth", strategy: "cold-turkey" },
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
  const { t } = useTranslation();
  const [title, setTitle] = useState(habit?.title ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "Flame");
  const [color, setColor] = useState(habit?.color ?? "rose");
  const [quitDateTime, setQuitDateTime] = useState<string>(
    toLocalDateTimeString(habit?.quitDate ?? Date.now()),
  );
  const {
    isExpanded: isSuggestionsOpen,
    toggle: toggleSuggestions,
    query: suggestionSearch,
    setQuery: setSuggestionSearch,
  } = useProgressiveDisclosure();


  // Strategy configuration (new feature)
  const [strategy, setStrategy] = useState<"cold-turkey" | "limit">(
    habit?.strategy ?? "cold-turkey",
  );
  const [limitType, setLimitType] = useState<"time" | "count">(
    habit?.limitType ?? "time",
  );
  const [limitValue, setLimitValue] = useState(habit?.limitValue ?? 120);

  // Accent tint for the selected icon tile in the picker grid.
  const { tint: iconTileTint, rawColor: iconTileColor } = getColorStyle(color, 0.14);
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: iconTileTint,
    borderColor: iconTileColor,
    color: iconTileColor,
  };

  /** One-click template: fills the title, icon, colour, and strategy in a single tap. */
  function applySuggestion(suggestion: QuitSuggestion) {
    const locName = t(`quitSuggestion.${suggestion.key}.name`, suggestion.name);
    setTitle(locName);
    setIcon(resolveIconName(suggestion.icon));
    setColor(suggestion.color);
    if (suggestion.strategy) {
      setStrategy(suggestion.strategy);
    }
    if (suggestion.limitType) {
      setLimitType(suggestion.limitType);
    }
    if (suggestion.limitValue !== undefined) {
      setLimitValue(suggestion.limitValue);
    }
  }

  /** Filter quit suggestions by the current search query (case-insensitive,
    matches against the template name and badge text). */
  function filteredQuitSuggestions(): QuitSuggestion[] {
    const q = suggestionSearch.toLowerCase();
    if (!q) return QUIT_SUGGESTIONS;
    return QUIT_SUGGESTIONS.filter((s) => {
      const locName = t(`quitSuggestion.${s.key}.name`, s.name).toLowerCase();
      const locBadge = t(`quitSuggestion.${s.key}.badge`, s.badge).toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        locName.includes(q) ||
        s.badge.toLowerCase().includes(q) ||
        locBadge.includes(q)
      );
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("quitTracker.titleRequired"));
      return;
    }

    const id = habit?.id ?? uid();
    const now = Date.now();
    const parsedQuitDate = quitDateTime
      ? new Date(quitDateTime).getTime()
      : (habit?.quitDate ?? now);

    if (isNaN(parsedQuitDate)) {
      toast.error(t("quitTracker.validDateRequired"));
      return;
    }

    const updated: BadHabit = {
      id,
      title: title.trim(),
      quitDate: parsedQuitDate,
      history: habit?.history ?? [],
      createdAt: habit?.createdAt ?? now,
      /** ISO timestamp initialized on creation for sync metadata. */
      updatedAt: new Date().toISOString(),
      icon,
      color,
      // Strategy fields (new feature)
      strategy,
      ...(strategy === "limit" && { limitType, limitValue }),
      usageLogs: habit?.usageLogs ?? [],
    };

    upsertBadHabit(updated);
    toast.success(habit ? t("quitTracker.updatedToast") : t("quitTracker.createdToast"));
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
              onClick={toggleSuggestions}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">✨</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t("quitTracker.quickSuggestions")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("quitTracker.quickSuggestionsDesc")}
              </p>
            </div>

            {/* PERMANENT TOGGLE BUTTON */}
            <button
              type="button"
              onClick={toggleSuggestions}
              aria-expanded={isSuggestionsOpen}
              aria-label={isSuggestionsOpen ? t("habit.collapseSuggestions", "Collapse suggestions") : t("habit.expandSuggestions", "Expand suggestions")}
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
              {QUIT_SUGGESTIONS.slice(0, 2).map((suggestion) => {
                const locName = t(`quitSuggestion.${suggestion.key}.name`, suggestion.name);
                const isSelected = title === locName || title === suggestion.name;
                return (
                  <button
                    key={suggestion.key}
                    type="button"
                    aria-label={t("habit.useTemplateAria", "Use template: {name}", { name: locName })}
                    aria-pressed={isSelected}
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
                        {locName}
                      </span>
                    </div>
                  </button>
                );
              })}
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
                  className="absolute top-2.5 start-3 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder={t("quitTracker.searchHabitsPlaceholder")}
                  value={suggestionSearch}
                  onChange={(e) => setSuggestionSearch(e.target.value)}
                  aria-label={t("quitTracker.searchTemplatesAria")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pe-3 ps-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                />
              </div>
              {filteredQuitSuggestions().length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                  {filteredQuitSuggestions().map((suggestion) => {
                    const locName = t(`quitSuggestion.${suggestion.key}.name`, suggestion.name);
                    const isSelected = title === locName || title === suggestion.name;
                    return (
                      <button
                        key={suggestion.key}
                        type="button"
                        aria-label={t("habit.useTemplateAria", "Use template: {name}", { name: locName })}
                        aria-pressed={isSelected}
                        onClick={() => applySuggestion(suggestion)}
                        style={
                          isSelected
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
                            {locName}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("quitTracker.noTemplates")}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      )}

      <div className="space-y-2">
        <Label htmlFor="habit-title">{t("quitTracker.habitTitle")}</Label>
        <Input
          id="habit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quitTracker.habitTitlePlaceholder")}
          autoComplete="off"
          maxLength={60}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quit-date">{t("quitTracker.quitStartTime")}</Label>
        <Input
          id="quit-date"
          type="datetime-local"
          value={quitDateTime}
          onChange={(e) => setQuitDateTime(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Strategy Selection — Complete Cessation vs Moderation / Limit */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("quitTracker.cessationStrategy")}</legend>
        <Select
          value={strategy}
          onValueChange={(v) => setStrategy(v as "cold-turkey" | "limit")}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder={t("quitTracker.selectStrategy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cold-turkey">{t("quitTracker.completeCessation")}</SelectItem>
            <SelectItem value="limit">{t("quitTracker.moderationLimit")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-2">
          {strategy === "cold-turkey"
            ? t("quitTracker.coldTurkeyDesc")
            : t("quitTracker.limitDesc")}
        </p>
      </fieldset>

      {/* Limit Configuration — shown only when "limit" strategy is selected */}
      {strategy === "limit" && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("quitTracker.limitType")}</legend>
            <Select
              value={limitType}
              onValueChange={(v) => setLimitType(v as "time" | "count")}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("quitTracker.selectLimitType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">{t("quitTracker.timeLimitOption")}</SelectItem>
                <SelectItem value="count">{t("quitTracker.countLimitOption")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              {limitType === "time"
                ? t("quitTracker.timeLimitDesc")
                : t("quitTracker.countLimitDesc")}
            </p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="limit-value">
              {t("quitTracker.dailyLimitLabel", {
                unit: limitType === "time" ? t("quitTracker.minutes").toLowerCase() : t("quitTracker.units").toLowerCase(),
              })}
            </Label>
            <Input
              id="limit-value"
              type="number"
              min={1}
              value={limitValue}
              onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
              placeholder="e.g., 120"
              autoComplete="off"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              {limitType === "time"
                ? t("quitTracker.minutesHelpText")
                : t("quitTracker.unitsHelpText")}
            </p>
          </div>
        </div>
      )}

      {/* Unified shared pickers — IconPicker adds custom SVG upload/paste
          (saved to the global store) and ColorPicker adds a custom HEX
          popover with a persisted palette. */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("quitTracker.icon")}</legend>
        <IconPicker selectedIcon={icon} onChange={setIcon} activeTileStyle={activeIconTileStyle} />
      </fieldset>

      <ColorPicker selectedColor={color} onChange={setColor} />

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} className="h-11">
          {t("common.cancel")}
        </Button>
        <Button type="submit" className="h-11 sm:min-w-32 font-semibold">
          {habit ? t("quitTracker.saveChanges") : t("quitTracker.startTracking")}
        </Button>
      </div>
    </form>
  );
}
