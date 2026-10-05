import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useProgressiveDisclosure } from "@/hooks/use-progressive-disclosure";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Clock,
  Info,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { todayKey, WEEKDAY_LABELS } from "@/services/dates";
import { normalizeQuickDecrements } from "@/services/quick-steps";
import { useApp } from "@/stores/app-store";
import type { Habit, HabitType, Schedule } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { playAddHabitSound, playDeleteHabitSound } from "@/lib/sound";

const WEEKDAY_KEYS = [
  "weekdays.sun",
  "weekdays.mon",
  "weekdays.tue",
  "weekdays.wed",
  "weekdays.thu",
  "weekdays.fri",
  "weekdays.sat",
];

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
  const { t } = useTranslation();
  const TemplateGlyph = TEMPLATE_ICONS[template.iconName];
  const templateName = t(`habitTemplate.${template.id}.name`, template.name);
  return (
    <button
      type="button"
      aria-label={t("habit.useTemplateAria", "Use template: {name}", { name: templateName })}
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
          {templateName}
        </span>
      </span>
    </button>
  );
}

export interface HabitFormValues {
  name: string;
  description: string;
  icon: string;
  color: string;
  groupId: string;
  goalId: string;
  type: HabitType;
  target: string;
  unit: string;
  scheduleType: Schedule["type"];
  weekdays: number[];
  timesPerWeek: string;
  monthDays: string;
  interval: string;
  startDate: string;
  endDate: string;
  reminderEnabled: boolean;
  reminderTimes: string[];
  quickIncrements: number[];
  quickDecrements: number[];
}

interface Props {
  habit?: Habit | undefined;
  onDone: () => void;
}

export function HabitForm({ habit, onDone }: Props) {
  const { t } = useTranslation();
  const { groups, goals, createHabit, updateHabit, removeHabit } = useApp();

  const { register, handleSubmit, watch, setValue, reset } = useForm<HabitFormValues>({
    defaultValues: {
      name: habit?.name ?? "",
      description: habit?.description ?? "",
      icon: habit?.icon ?? "Target",
      color: habit?.color ?? "teal",
      groupId: habit?.groupId ?? "none",
      goalId: habit?.goalId ?? "none",
      type: habit?.type ?? "boolean",
      target: String(habit?.target ?? 1),
      unit: habit?.unit ?? "",
      scheduleType: habit?.schedule.type ?? "daily",
      weekdays: habit?.schedule.type === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5],
      timesPerWeek: habit?.schedule.type === "timesPerWeek" ? String(habit.schedule.count) : "3",
      monthDays: habit?.schedule.type === "monthDays" ? habit.schedule.days.join(", ") : "1, 15",
      interval: habit?.schedule.type === "interval" ? String(habit.schedule.everyNDays) : "2",
      startDate: habit?.startDate ?? todayKey(),
      endDate: habit?.endDate ?? "",
      reminderEnabled: Boolean(habit?.reminderTimes?.length || habit?.reminder),
      reminderTimes: habit?.reminderTimes?.length
        ? habit.reminderTimes
        : habit?.reminder
          ? [habit.reminder]
          : [],
      quickIncrements: habit?.quickIncrements ?? [],
      quickDecrements: normalizeQuickDecrements(habit?.quickDecrement),
    },
  });

  // Keep form synchronized if habit prop updates
  useEffect(() => {
    if (habit) {
      reset({
        name: habit.name,
        description: habit.description ?? "",
        icon: habit.icon ?? "Target",
        color: habit.color ?? "teal",
        groupId: habit.groupId ?? "none",
        goalId: habit.goalId ?? "none",
        type: habit.type ?? "boolean",
        target: String(habit.target ?? 1),
        unit: habit.unit ?? "",
        scheduleType: habit.schedule.type ?? "daily",
        weekdays: habit.schedule.type === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5],
        timesPerWeek: habit.schedule.type === "timesPerWeek" ? String(habit.schedule.count) : "3",
        monthDays: habit.schedule.type === "monthDays" ? habit.schedule.days.join(", ") : "1, 15",
        interval: habit.schedule.type === "interval" ? String(habit.schedule.everyNDays) : "2",
        startDate: habit.startDate ?? todayKey(),
        endDate: habit.endDate ?? "",
        reminderEnabled: Boolean(habit.reminderTimes?.length || habit.reminder),
        reminderTimes: habit.reminderTimes?.length
          ? habit.reminderTimes
          : habit.reminder
            ? [habit.reminder]
            : [],
        quickIncrements: habit.quickIncrements ?? [],
        quickDecrements: normalizeQuickDecrements(habit.quickDecrement),
      });
    }
  }, [habit, reset]);

  // Form values watched for conditional UI sections
  const name = watch("name");
  const color = watch("color");
  const icon = watch("icon");
  const groupId = watch("groupId");
  const goalId = watch("goalId");
  const type = watch("type");
  const scheduleType = watch("scheduleType");
  const weekdays = watch("weekdays");
  const reminderEnabled = watch("reminderEnabled");
  const reminderTimes = watch("reminderTimes");
  const quickIncrements = watch("quickIncrements");
  const quickDecrements = watch("quickDecrements");

  // Local states only for the ephemeral "add item" text inputs
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newIncrement, setNewIncrement] = useState("");
  const [newDecrement, setNewDecrement] = useState("");

  // Quick Suggestions: expandable template catalog with live search.
  const {
    isExpanded: isSuggestionsExpanded,
    toggle: toggleSuggestions,
    query: suggestionQuery,
    setQuery: setSuggestionQuery,
  } = useProgressiveDisclosure();

  // Live search across template name, category, and description (supports localized text).
  const filteredTemplates = HABIT_TEMPLATES.filter((template) => {
    const q = suggestionQuery.toLowerCase();
    const locName = t(`habitTemplate.${template.id}.name`, template.name).toLowerCase();
    const locDesc = t(`habitTemplate.${template.id}.desc`, template.description).toLowerCase();
    return (
      template.name.toLowerCase().includes(q) ||
      locName.includes(q) ||
      template.category.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      locDesc.includes(q)
    );
  });

  function handleTypeChange(newType: HabitType) {
    setValue("type", newType, { shouldDirty: true });
    if (!habit) {
      setValue("unit", DEFAULT_UNITS[newType], { shouldDirty: true });
      setValue("target", newType === "boolean" ? "1" : newType === "duration" ? "30" : "8", {
        shouldDirty: true,
      });
    }
  }

  function handleTemplateSelect(tmpl: HabitTemplate) {
    const habitType: HabitType = tmpl.type === "timer" ? "duration" : tmpl.type;
    setValue("name", t(`habitTemplate.${tmpl.id}.name`, tmpl.name), { shouldDirty: true });
    setValue("description", t(`habitTemplate.${tmpl.id}.desc`, tmpl.description), {
      shouldDirty: true,
    });
    setValue("icon", tmpl.iconName, { shouldDirty: true });
    setValue("color", tmpl.colorName, { shouldDirty: true });
    setValue("type", habitType, { shouldDirty: true });
    setValue("target", String(tmpl.target), { shouldDirty: true });
    setValue(
      "unit",
      tmpl.unit ?? (habitType === "duration" ? "min" : habitType === "counter" ? "reps" : ""),
      { shouldDirty: true },
    );
  }

  function buildSchedule(values: HabitFormValues): Schedule {
    switch (values.scheduleType) {
      case "weekdays":
        return { type: "weekdays", days: values.weekdays.length ? values.weekdays : [1] };
      case "timesPerWeek":
        return { type: "timesPerWeek", count: Math.max(1, Number(values.timesPerWeek) || 1) };
      case "monthDays":
        return {
          type: "monthDays",
          days: values.monthDays
            .split(",")
            .map((d) => Number(d.trim()))
            .filter((d) => d >= 1 && d <= 31),
        };
      case "interval":
        return { type: "interval", everyNDays: Math.max(1, Number(values.interval) || 1) };
      default:
        return { type: "daily" };
    }
  }

  const onSubmit = (values: HabitFormValues) => {
    if (!values.name.trim()) {
      toast.error(t("habit.nameRequired"));
      return;
    }
    const schedule = buildSchedule(values);
    if (schedule.type === "monthDays" && schedule.days.length === 0) {
      toast.error(t("habit.monthDaysRequired"));
      return;
    }
    if (values.reminderEnabled && values.reminderTimes.length === 0) {
      toast.error(t("habit.reminderTimeRequired"));
      return;
    }
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      icon: values.icon,
      color: values.color,
      groupId: values.groupId === "none" ? undefined : values.groupId,
      goalId: values.goalId === "none" ? undefined : values.goalId,
      type: values.type,
      target: values.type === "boolean" ? 1 : Math.max(1, Number(values.target) || 1),
      unit: values.type === "boolean" ? "" : values.unit.trim(),
      schedule,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      reminderEnabled: values.reminderEnabled,
      reminderTimes: values.reminderEnabled ? values.reminderTimes : [],
      reminder: values.reminderEnabled ? values.reminderTimes[0] : undefined,
      quickIncrements: values.quickIncrements,
      quickDecrement: values.quickDecrements,
      freezesAllowedPerMonth: 3,
      freezesUsedThisMonth: 0,
      frozenDates: [],
      lastFreezeResetDate: todayKey().slice(0, 7),
    };

    if (habit) {
      updateHabit({
        ...habit,
        ...payload,
        // Explicitly preserve existing streak freeze records and quotas
        freezesAllowedPerMonth: habit.freezesAllowedPerMonth ?? 3,
        freezesUsedThisMonth: habit.freezesUsedThisMonth ?? 0,
        frozenDates: Array.isArray(habit.frozenDates) ? habit.frozenDates : [],
        lastFreezeResetDate: habit.lastFreezeResetDate ?? todayKey().slice(0, 7),
        /** ISO timestamp refreshed on every save. */
        updatedAt: new Date().toISOString(),
      });
      toast.success(t("habit.saved"));
    } else {
      createHabit(payload);
      playAddHabitSound();
      toast.success(t("habit.created"));
    }
    onDone();
  };

  // Accent tint for the selected icon tile in the picker grid.
  const { tint: iconTileTint, rawColor: iconTileColor } = getColorStyle(color, 0.14);

  /** Selected icon tile in the picker grid — habit-coloured tint, border and glyph. */
  const activeIconTileStyle: React.CSSProperties = {
    backgroundColor: iconTileTint,
    borderColor: iconTileColor,
    color: iconTileColor,
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full min-w-0 space-y-5">
      {!habit ? (
        <fieldset className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 cursor-pointer select-none" onClick={toggleSuggestions}>
              <div className="flex items-center gap-2">
                <span className="text-xs">✨</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t("habit.quickSuggestions")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("habit.quickSuggestionsDesc")}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleSuggestions}
              aria-expanded={isSuggestionsExpanded}
              aria-label={
                isSuggestionsExpanded
                  ? t("habit.collapseSuggestions", "Collapse suggestions")
                  : t("habit.expandSuggestions", "Expand suggestions")
              }
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  isSuggestionsExpanded ? "rotate-180" : "rotate-0",
                )}
                aria-hidden="true"
              />
            </button>
          </div>

          {!isSuggestionsExpanded && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {HABIT_TEMPLATES.slice(0, 2).map((template) => {
                const TemplateGlyph = TEMPLATE_ICONS[template.iconName];
                const templateName = t(`habitTemplate.${template.id}.name`, template.name);
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-label={t("habit.useTemplateAria", "Use template: {name}", {
                      name: templateName,
                    })}
                    aria-pressed={name === templateName || name === template.name}
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
                        {templateName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              isSuggestionsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
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
                  placeholder={t("habit.searchTemplates")}
                  value={suggestionQuery}
                  onChange={(e) => setSuggestionQuery(e.target.value)}
                  aria-label={t("habit.searchTemplates")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 py-1.5 pe-3 ps-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
                />
              </div>
              {filteredTemplates.length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mt-2">
                  {filteredTemplates.map((tmpl) => (
                    <TemplateRow
                      key={tmpl.id}
                      template={tmpl}
                      selected={name === tmpl.name}
                      onSelect={handleTemplateSelect}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("habit.noTemplates")}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="habit-name">{t("habit.name")}</Label>
        <Input
          id="habit-name"
          {...register("name")}
          placeholder={t("habit.namePlaceholder")}
          autoComplete="off"
          maxLength={40}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="habit-desc">{t("habit.description")}</Label>
        <Textarea
          id="habit-desc"
          {...register("description")}
          placeholder={t("habit.descriptionPlaceholder")}
          rows={2}
          className={cn(
            "overflow-y-auto resize-none min-h-[80px] px-3.5 py-2.5 leading-relaxed text-sm",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500",
            "dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100 dark:focus:border-emerald-500",
          )}
        />
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("habit.icon")}</legend>
        <IconPicker
          selectedIcon={icon}
          onChange={(newIcon) => setValue("icon", newIcon, { shouldDirty: true })}
          activeTileStyle={activeIconTileStyle}
        />
      </fieldset>

      <ColorPicker
        selectedColor={color}
        onChange={(newColor) => setValue("color", newColor, { shouldDirty: true })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="habit-group">{t("habit.group")}</Label>
          <Select
            value={groupId}
            onValueChange={(val) => setValue("groupId", val, { shouldDirty: true })}
          >
            <SelectTrigger id="habit-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("habit.noGroup")}</SelectItem>
              {groups.map((g) => {
                const groupKey = `group.${g.name.toLowerCase()}`;
                const groupName = t(groupKey, g.name);
                return (
                  <SelectItem key={g.id} value={g.id}>
                    {groupName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-goal">{t("habit.goal")}</Label>
          <Select
            value={goalId}
            onValueChange={(val) => setValue("goalId", val, { shouldDirty: true })}
          >
            <SelectTrigger id="habit-goal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("habit.noGoal")}</SelectItem>
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
        <Label htmlFor="habit-type">{t("habit.type")}</Label>
        <Select value={type} onValueChange={(v) => handleTypeChange(v as HabitType)}>
          <SelectTrigger id="habit-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { value: "boolean" as HabitType, label: t("habit.typeBoolean") },
              { value: "numeric" as HabitType, label: t("habit.typeNumeric") },
              { value: "duration" as HabitType, label: t("habit.typeDuration") },
              { value: "counter" as HabitType, label: t("habit.typeCounter") },
            ].map(({ value, label }) => (
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
            <Label htmlFor="habit-target">{t("habit.dailyTarget")}</Label>
            <Input
              id="habit-target"
              type="number"
              min={1}
              inputMode="numeric"
              {...register("target")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="habit-unit">{t("habit.unit")}</Label>
            <Input
              id="habit-unit"
              {...register("unit")}
              placeholder={
                type === "duration" ? t("habit.unitMinutes", "min") : t("habit.unitItems", "items")
              }
            />
          </div>
        </div>
      ) : null}

      {type !== "boolean" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("habit.quickIncrements")}</Label>
            <div className="flex flex-wrap gap-2">
              {quickIncrements.map((inc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <span>+{inc}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        "quickIncrements",
                        quickIncrements.filter((_, i) => i !== idx),
                        { shouldDirty: true },
                      )
                    }
                    className="ms-1 rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <span className="sr-only">{t("habit.removeStep", "Remove")}</span>×
                  </button>
                </div>
              ))}
              {quickIncrements.length < 2 && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder={t("habit.incrementPlaceholder", "e.g. 10")}
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
                        if (quickIncrements.includes(val)) {
                          toast.info(t("habit.alreadyAdded"));
                          return;
                        }
                        setValue("quickIncrements", [...quickIncrements, val].slice(0, 2), {
                          shouldDirty: true,
                        });
                        setNewIncrement("");
                      }
                    }}
                  >
                    {t("habit.add")}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("habit.quickDecrements")}</Label>
            <div className="flex flex-wrap gap-2">
              {quickDecrements.map((dec, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <span>-{dec}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        "quickDecrements",
                        quickDecrements.filter((_, i) => i !== idx),
                        { shouldDirty: true },
                      )
                    }
                    className="ms-1 rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <span className="sr-only">{t("habit.removeStep", "Remove")}</span>×
                  </button>
                </div>
              ))}
              {quickDecrements.length < 2 && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder={t("habit.decrementPlaceholder", "e.g. 10")}
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
                        if (quickDecrements.includes(val)) {
                          toast.info(t("habit.alreadyAdded"));
                          return;
                        }
                        setValue("quickDecrements", [...quickDecrements, val].slice(0, 2), {
                          shouldDirty: true,
                        });
                        setNewDecrement("");
                      }
                    }}
                  >
                    {t("habit.add")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="habit-schedule">{t("habit.schedule")}</Label>
        <Select
          value={scheduleType}
          onValueChange={(v) =>
            setValue("scheduleType", v as Schedule["type"], { shouldDirty: true })
          }
        >
          <SelectTrigger id="habit-schedule">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t("habit.everyDay")}</SelectItem>
            <SelectItem value="weekdays">{t("habit.weekdays")}</SelectItem>
            <SelectItem value="timesPerWeek">{t("habit.timesPerWeek")}</SelectItem>
            <SelectItem value="monthDays">{t("habit.monthDays")}</SelectItem>
            <SelectItem value="interval">{t("habit.interval")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleType === "weekdays" ? (
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, index) => {
            const active = weekdays.includes(index);
            const dayKey = WEEKDAY_KEYS[index];
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const next = weekdays.includes(index)
                    ? weekdays.filter((d) => d !== index)
                    : [...weekdays, index];
                  setValue("weekdays", next, { shouldDirty: true });
                }}
                className={cn(
                  "h-11 min-w-11 rounded-xl border px-3 text-sm font-medium",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {dayKey ? t(dayKey, label) : label}
              </button>
            );
          })}
        </div>
      ) : null}

      {scheduleType === "timesPerWeek" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-times">{t("habit.timesPerWeekLabel")}</Label>
          <Input id="habit-times" type="number" min={1} max={7} {...register("timesPerWeek")} />
        </div>
      ) : null}

      {scheduleType === "monthDays" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-monthdays">{t("habit.monthDaysLabel")}</Label>
          <Input id="habit-monthdays" {...register("monthDays")} />
          <p className="text-xs text-muted-foreground">{t("habit.monthDaysHint")}</p>
        </div>
      ) : null}

      {scheduleType === "interval" ? (
        <div className="space-y-2">
          <Label htmlFor="habit-interval">{t("habit.everyNDaysLabel")}</Label>
          <Input id="habit-interval" type="number" min={1} {...register("interval")} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="habit-start">{t("habit.startDate")}</Label>
          <Input id="habit-start" type="date" {...register("startDate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-end">{t("habit.endDate")}</Label>
          <Input id="habit-end" type="date" {...register("endDate")} />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <legend className="text-sm font-medium">{t("habit.reminders")}</legend>
            <p className="text-xs text-muted-foreground">{t("habit.remindersDesc")}</p>
          </div>
          <Switch
            checked={reminderEnabled}
            onCheckedChange={(checked) =>
              setValue("reminderEnabled", checked, { shouldDirty: true })
            }
            aria-label={t("habit.toggleRemindersAria", "Toggle reminders for this habit")}
          />
        </div>

        {reminderEnabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {reminderTimes.map((time) => (
                <div
                  key={time}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{time}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        "reminderTimes",
                        reminderTimes.filter((item) => item !== time),
                        { shouldDirty: true },
                      )
                    }
                    className="ms-1 rounded-full p-0.5 hover:bg-primary/20"
                    aria-label={t("habit.removeReminderAria", "Remove {time} reminder", { time })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  id="habit-reminder-time"
                  type="time"
                  value={newReminderTime}
                  onChange={(event) => setNewReminderTime(event.target.value)}
                  aria-label={t("habit.reminderTime")}
                  className="h-9 w-32"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={!newReminderTime || reminderTimes.includes(newReminderTime)}
                  onClick={() => {
                    setValue(
                      "reminderTimes",
                      [...reminderTimes, newReminderTime].sort((left, right) =>
                        left.localeCompare(right),
                      ),
                      { shouldDirty: true },
                    );
                    setNewReminderTime("");
                  }}
                >
                  {t("habit.addTime")}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p>{t("habit.reminderOfflineHint")}</p>
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        {habit ? (
          <Button
            type="button"
            variant="destructive"
            className="h-11 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              if (window.confirm(t("habit.deleteConfirm"))) {
                removeHabit(habit.id);
                playDeleteHabitSound();
                toast.success(t("habit.deleted"));
                onDone();
              }
            }}
          >
            <Trash2 className="me-2 h-4 w-4" /> {t("habit.deleteHabit")}
          </Button>
        ) : (
          <div />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onDone} className="h-11">
            {t("habit.cancel")}
          </Button>
          <Button type="submit" className="h-11 sm:min-w-32">
            {habit ? t("habit.saveChanges") : t("habit.createHabit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
