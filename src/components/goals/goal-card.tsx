import { Calendar, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { HabitIcon, colorStyles, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { fromDateKey } from "@/services/dates";
import { useApp } from "@/stores/app-store";
import type { CustomIcon, Goal, Habit } from "@/types";

interface GoalCardProps {
  goal: Goal;
  linkedHabits: Habit[];
  progress: number;
  currentValue: number;
  customIcons: CustomIcon[];
  onEdit: (goal: Goal) => void;
}

export function GoalValueControls({ goal, currentValue }: { goal: Goal; currentValue: number }) {
  const { t } = useTranslation();
  const { adjustGoalValue } = useApp();
  if (goal.type !== "numeric") return null;

  const unit = goal.unit?.trim();

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-2.5">
      <span className="min-w-0 text-sm font-semibold tabular-nums text-foreground">
        {currentValue} / {goal.targetValue} {unit || t("goal.complete")}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-border bg-card shadow-sm hover:bg-muted"
          onClick={() => adjustGoalValue(goal.id, -1)}
          aria-label={t("goal.decreaseGoalAria", { name: goal.name })}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 rounded-full shadow-sm"
          onClick={() => adjustGoalValue(goal.id, 1)}
          aria-label={t("goal.increaseGoalAria", { name: goal.name })}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function GoalCard({
  goal,
  linkedHabits,
  progress,
  currentValue,
  customIcons,
  onEdit,
}: GoalCardProps) {
  const { t, language } = useTranslation();
  const { removeGoal, restoreGoal } = useApp();
  const cardTint = getColorStyle(goal.color || "#3B82F6", 0.14);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:bg-muted/30 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm"
            style={{ ...cardTint.style, color: cardTint.rawColor }}
          >
            <HabitIcon name={goal.icon || "target"} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-foreground">
              {goal.name}
            </h3>
            {goal.description ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{goal.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onEdit(goal)}
            aria-label={t("goal.edit")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-rose-50 hover:text-destructive dark:hover:bg-rose-950/30"
            onClick={() => {
              const goalToRestore = structuredClone(goal);
              removeGoal(goal.id);
              toast.success(t("goal.deleted"), {
                action: { label: t("common.undo"), onClick: () => restoreGoal(goalToRestore) },
                duration: 5000,
              });
            }}
            aria-label={t("goal.deleteGoalAria")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {goal.targetDate ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {t("goal.targetDate")}:{" "}
          {fromDateKey(goal.targetDate).toLocaleDateString(language, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      ) : null}

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{linkedHabits.length} {t("goal.habitsLinked")}</span>
          <span className="numeric font-medium">{Math.round(progress * 100)}%</span>
        </div>
        <Progress
          value={Math.round(progress * 100)}
          aria-label={t("goal.goalProgressFor", { name: goal.name })}
          className="mt-2 h-2 bg-muted"
        />
      </div>

      <GoalValueControls goal={goal} currentValue={currentValue} />

      {linkedHabits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkedHabits.map((habit) => {
            const styles = colorStyles(habit.color);
            return (
              <span
                key={habit.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border border-border/70 px-2 py-1 text-xs text-foreground",
                  styles.soft,
                )}
              >
                <HabitIcon
                  name={habit.icon}
                  customIcons={customIcons}
                  className={cn("h-3.5 w-3.5", styles.text)}
                />
                {habit.name}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
