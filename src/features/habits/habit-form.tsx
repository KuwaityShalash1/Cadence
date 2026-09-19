import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Clock,
  Search,
  Timer,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { IconPicker } from "@/components/shared/IconPicker";
import {
  HABIT_TEMPLATES,
  TEMPLATE_ICONS,
  type HabitTemplate,
} from "@/features/habits/habit-templates";
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
import { todayKey, WEEKDAY_LABELS } from "@/services/dates";
import { normalizeQuickDecrements } from "@/services/quick-steps";
import { useApp } from "@/stores/app-store";
import type { Habit, HabitType, Schedule } from "@/types";
import { cn } from "@/lib/utils";
import { playAddHabitSound, playDeleteHabitSound } from "@/lib/sound";

const TYPE_LABELS: Record<HabitType, string> = {
  boolean: "Done / not done",
  numeric: "Numeric amount",
  duration: "Duration",
  counter: "Counter",
};

const DEFAULT_UNITS: Record<HabitType, string> = {
  boolean: "",
  numeric: "glasses",
  duration: "min",
  counter: "reps",
};

/** Tiny glyphs hinting the template's tracking style inside the target badge. */
const TEMPLATE_TYPE_GLYPHS: Record<HabitTemplate["type"], LucideIcon> = {
  boolean: Check,
  counter: Zap,
  timer: Timer,
};

interface TemplateChipProps {
  template: HabitTemplate;
  selected: boolean;
  onSelect: (template: HabitTemplate) => void;
}

/** Full-width preset row for the expanded single-column list — the name is
 * never truncated, so long template titles always render in full. */
function TemplateRow({ template, selected, onSelect }: TemplateChipProps) {
  const TemplateGlyph = TEMPLATE_ICONS[template.iconName];
  return (
    <button
      type="button"
      aria-label={`Use template: ${template.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(template)}
      style={
        selected
          ? { borderColor: template.colorHex, boxShadow: `0 0 0 1px ${template.colorHex}` }
          : undefined
      }
      className="w-full flex cursor-pointer items-center justify-start rounded-xl border border-slate-200/80 bg-white px-3 py-2 transition active:scale-[0.99] hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:bg-slate-800/80"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${template.colorHex}20`, color: template.colorHex }}
        >
          {TemplateGlyph ? (
            <TemplateGlyph
              className="h-4 w-4"
              style={{ color: template.colorHex }}
              aria-hidden="true"
            />
          ) : (
            <HabitIcon name={template.iconName} className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-xs font-semibold whitespace-normal text-slate-800 dark:text-slate-200">
          {template.name}
        </span>
      </span>
    </button>
  );
}

interface Props {
  habit?: Habit | undefined;
  onDone: () => void;
}

export function HabitForm({ habit, onDone }: Props) {
  const { groups, goals, createHabit, updateHabit, removeHabit, customIcons } = useApp();
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "Target");
  const [color, setColor] = useState(habit?.color ?? "teal");
  const [groupId, setGroupId] = useState(habit?.groupId ?? "none");
  const [goalId, setGoalId] = useState(habit?.goalId ?? "none");
  const [type, setType] = useState<HabitType>(habit?.type ?? "boolean");
  const [target, setTarget] = useState(String(habit?.target ?? 1));
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [scheduleType, setScheduleType] = useState<Schedule["type"]>(
    habit?.schedule.type ?? "daily",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    habit?.schedule.type === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5],
  );
  const [timesPerWeek, setTimesPerWeek] = useState(
    habit?.schedule.type === "timesPerWeek" ? String(habit.schedule.count) : "3",
  );
  const [monthDays, setMonthDays] = useState(
    habit?.schedule.type === "monthDays" ? habit.schedule.days.join(", ") : "1, 15",
  );
  const [interval, setInterval] = useState(
    habit?.schedule.type === "interval" ? String(habit.schedule.everyNDays) : "2",
  );
  const [startDate, setStartDate] = useState(habit?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(habit?.endDate ?? "");
  const [reminder, setReminder] = useState(habit?.reminder ?? "");
  const [quickIncrements, setQuickIncrements] = useState<number[]>(habit?.quickIncrements ?? []);
  const [quickDecrements, setQuickDecrements] = useState<number[]>(
    normalizeQuickDecrements(habit?.quickDecrement),
  );
  const [newIncrement, setNewIncrement] = useState("");
  const [newDecrement, setNewDecrement] = useState("");

  const skipTypeDefaults = useRef(false);

  // Quick Suggestions: expandable template catalog with live search.
  const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");

  function toggleSuggestions() {
    if (isSuggestionsExpanded) setSuggestionQuery("");
    setIsSuggestionsExpanded((prev) => !prev);
  }

  // Live search across template name, category, and description.
  const filteredTemplates = HABIT_TEMPLATES.filter(
    (template) =>
      template.name.toLowerCase().includes(suggestionQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(suggestionQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(suggestionQuery.toLowerCase()),
  );

  useEffect(() => {
    if (skipTypeDefaults.current) {
      skipTypeDefaults.current = false;
      return;
    }
    if (!habit) {
      setUnit(DEFAULT_UNITS[type]);
      setTarget(type === "boolean" ? "1" : type === "duration" ? "30" : "8");
    }
  }, [type, habit]);

  function buildSchedule(): Schedule {
    switch (scheduleType) {
      case "weekdays":
        return { type: "weekdays", days: weekdays.length ? weekdays : [1] };
      case "timesPerWeek":
        return { type: "timesPerWeek", count: Math.max(1, Number(timesPerWeek) || 1) };
      case "monthDays":
        return {
          type: "monthDays",
          days: monthDays
            .split(",")
            .map((d) => Number(d.trim()))
            .filter((d) => d >= 1 && d <= 31),
        };
      case "interval":
        return { type: "interval", everyNDays: Math.max(1, Number(interval) || 1) };
      default:
        return { type: "daily" };
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give the habit a name");
      return;
    }
    const schedule = buildSchedule();
    if (schedule.type === "monthDays" && schedule.days.length === 0) {
      toast.error("Select at least one day of the month");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      groupId: groupId === "none" ? undefined : groupId,
      goalId: goalId === "none" ? undefined : goalId,
      type,
      target: type === "boolean" ? 1 : Math.max(1, Number(target) || 1),
      unit: type === "boolean" ? "" : unit.trim(),
      schedule,
      startDate,
      endDate: endDate || undefined,
      reminder: reminder || undefined,
      quickIncrements,
      quickDecrement: quickDecrements,
      freezesAllowedPerMonth: 3,
      freezesUsedThisMonth: 0,
      frozenDates: [],
      lastFreezeResetDate: todayKey().slice(0, 7),
    };

    if (habit) {
      updateHabit({ ...habit, ...payload });
      toast.success("Habit updated — past records kept as they were");
    } else {
      createHabit(payload);
      playAddHabitSound();
      toast.success("Habit created");
    }
    onDone();
  }

  function handleTemplateSelect(t: HabitTemplate) {
    skipTypeDefaults.current = true;
    // Template types map onto app types: timer → duration.
    const habitType: HabitType = t.type === "timer" ? "duration" : t.type;
    setName(t.name);
    setDescription(t.description);
    setIcon(t.iconName);
    setColor(t.colorName);
    setType(habitType);
    setTarget(String(t.target));
    setUnit(t.unit ?? (habitType === "duration" ? "min" : habitType === "counter" ? "reps" : ""));
  }

  // Accent + tint for the live preview — works for palette names and custom HEX.
  const previewTint = getColorStyle(color, 0.14);

  /** Selected icon tile in the picker grid — habit-coloured tint, border and glyph. */
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: previewTint.tint,
    borderColor: previewTint.rawColor,
    color: previewTint.rawColor,
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {!habit ? (
        <fieldset className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          {/* Unified header: title + subtitle form one large click target that
              toggles the section, and the chevron button on the right is a
              PERMANENT toggle rendered in BOTH collapsed and expanded states —
              only the body below this header toggles. */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 cursor-pointer select-none" onClick={toggleSuggestions}>
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
              aria-expanded={isSuggestionsExpanded}
              aria-label={isSuggestionsExpanded ? "Collapse suggestions" : "Expand suggestions"}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isSuggestionsExpanded ? "rotate-180" : "rotate-0",
                )}
                aria-hidden="true"
              />
            </button>
          </div>
          {/* Collapsed: exactly two suggestions in a fixed 2-column grid — no
              horizontal scrolling and nothing clipped at the container edge.
              Expanded: search box + the full scrollable template catalog. */}
          {isSuggestionsExpanded ? (
            <>
              <div className="relative my-2">
                <Search
                  className="absolute top-2.5 left-3 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search habits..."
                  value={suggestionQuery}
                  onChange={(e) => setSuggestionQuery(e.target.value)}
                  aria-label="Search templates"
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                />
              </div>
              {filteredTemplates.length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                  {filteredTemplates.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      selected={name === t.name}
                      onSelect={handleTemplateSelect}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No matching templates found
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {HABIT_TEMPLATES.slice(0, 2).map((template) => {
                const TemplateGlyph = TEMPLATE_ICONS[template.iconName];
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-label={`Use template: ${template.name}`}
                    aria-pressed={name === template.name}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full flex items-center justify-start px-3 py-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition active:scale-95 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${template.colorHex}20`,
                          color: template.colorHex,
                        }}
                      >
                        {TemplateGlyph ? (
                          <TemplateGlyph className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <HabitIcon name={template.iconName} className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {template.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="habit-name">Name</Label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deep study session"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="habit-desc">Description</Label>
        {/**
         * Hidden-scrollbar description field — vertical scrolling stays fully
         * functional (wheel, trackpad, touch drag, keyboard); only the
         * scrollbar chrome is removed: `scrollbar-width: none` covers Firefox,
         * `-ms-overflow-style: none` covers legacy Edge/IE, and the WebKit
         * pseudo-element rule covers Chrome / Safari / modern Edge.
         */}
        <Textarea
          id="habit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional detail"
          rows={2}
          className={cn(
            "overflow-y-auto resize-none min-h-[80px] px-3.5 py-2.5 leading-relaxed text-sm",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500",
            "dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100 dark:focus:border-emerald-500",
          )}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        {/* Live preview — mirrors the habit card. Custom icons are resolved
            first so a saved SVG never falls back to the default Lucide glyph. */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ ...previewTint.style, color: previewTint.rawColor }}
          >
            <HabitIcon name={icon} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name.trim() || "Habit preview"}</p>
            <p className="text-xs text-muted-foreground">How your habit will look</p>
          </div>
        </div>
        <IconPicker selectedIcon={icon} onChange={setIcon} activeTileStyle={activeIconTileStyle} />
      </fieldset>

      <ColorPicker selectedColor={color} onChange={setColor} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="habit-group">Group</Label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger id="habit-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No group</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-goal">Goal</Label>
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger id="habit-goal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No goal</SelectItem>
              {goals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="habit-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as HabitType)}>
          <SelectTrigger id="habit-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type !== "boolean" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="habit-target">Daily target</Label>
            <Input
              id="habit-target"
              type="number"
              min={1}
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="habit-unit">Unit</Label>
            <Input
              id="habit-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={type === "duration" ? "min" : "items"}
            />
          </div>
        </div>
      ) : null}

      {type !== "boolean" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quick Increments (max 2)</Label>
            <div className="flex flex-wrap gap-2">
              {quickIncrements.map((inc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <span>+{inc}</span>
                  <button
                    type="button"
                    onClick={() => setQuickIncrements((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <span className="sr-only">Remove</span>×
                  </button>
                </div>
              ))}
              {quickIncrements.length < 2 && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={newIncrement}
                    onChange={(e) => setNewIncrement(e.target.value)}
                    className="h-9 w-20"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      const val = parseInt(newIncrement);
                      if (!isNaN(val) && val > 0) {
                        setQuickIncrements((prev) => [...prev, val].slice(0, 2));
                        setNewIncrement("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Quick Decrements (max 2)</Label>
            <div className="flex flex-wrap gap-2">
              {quickDecrements.map((dec, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <span>-{dec}</span>
                  <button
                    type="button"
                    onClick={() => setQuickDecrements((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <span className="sr-only">Remove</span>×
                  </button>
                </div>
              ))}
              {quickDecrements.length < 2 && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={newDecrement}
                    onChange={(e) => setNewDecrement(e.target.value)}
                    className="h-9 w-20"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      const val = parseInt(newDecrement);
                      if (!isNaN(val) && val > 0) {
                        setQuickDecrements((prev) => [...prev, val].slice(0, 2));
                        setNewDecrement("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="habit-schedule">Schedule</Label>
        <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as Schedule["type"])}>
          <SelectTrigger id="habit-schedule">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Every day</SelectItem>
            <SelectItem value="weekdays">Specific weekdays</SelectItem>
            <SelectItem value="timesPerWeek">X times per week</SelectItem>
            <SelectItem value="monthDays">Specific days of month</SelectItem>
            <SelectItem value="interval">Every N days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleType === "weekdays" ? (
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, index) => {
            const active = weekdays.includes(index);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setWeekdays((prev) =>
                    prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
                  )
                }
                className={cn(
                  "h-11 min-w-11 rounded-xl border px-3 text-sm font-medium",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {scheduleType === "timesPerWeek" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-times">Times per week</Label>
          <Input
            id="habit-times"
            type="number"
            min={1}
            max={7}
            value={timesPerWeek}
            onChange={(e) => setTimesPerWeek(e.target.value)}
          />
        </div>
      ) : null}

      {scheduleType === "monthDays" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-monthdays">Days of month (comma separated)</Label>
          <Input
            id="habit-monthdays"
            value={monthDays}
            onChange={(e) => setMonthDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Days beyond a month&apos;s length roll to that month&apos;s last day.
          </p>
        </div>
      ) : null}

      {scheduleType === "interval" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-interval">Every N days</Label>
          <Input
            id="habit-interval"
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="habit-start">Start date</Label>
          <Input
            id="habit-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-end">End date</Label>
          <Input
            id="habit-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-reminder">Reminder</Label>
          <Input
            id="habit-reminder"
            type="time"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        {habit ? (
          <Button
            type="button"
            variant="destructive"
            className="h-11 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this habit?")) {
                removeHabit(habit.id);
                playDeleteHabitSound();
                toast.success("Habit deleted");
                onDone();
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete Habit
          </Button>
        ) : (
          <div />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onDone} className="h-11">
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:min-w-32">
            {habit ? "Save changes" : "Create habit"}
          </Button>
        </div>
      </div>
    </form>
  );
}
