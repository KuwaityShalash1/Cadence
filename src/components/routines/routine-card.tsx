import { Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { HabitIcon, colorStyles, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { describeSchedule } from "@/services/schedule";
import { useApp } from "@/stores/app-store";
import type { CustomIcon, Habit, Routine } from "@/types";

interface RoutineCardProps {
  routine: Routine;
  habits: Habit[];
  completedStepIds: string[];
  date: string;
  customIcons: CustomIcon[];
  onEdit: (routine: Routine) => void;
}

export function RoutineCard({
  routine,
  habits,
  completedStepIds,
  date,
  customIcons,
  onEdit,
}: RoutineCardProps) {
  const { t } = useTranslation();
  const { removeRoutine, restoreRoutine, toggleRoutineStep } = useApp();
  const cardTint = getColorStyle(routine.color ?? "teal", 0.14);
  const pct =
    routine.steps.length > 0
      ? Math.round((completedStepIds.length / routine.steps.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:bg-muted/30 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm"
            style={{ ...cardTint.style, color: cardTint.rawColor }}
          >
            <HabitIcon name={routine.icon} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-foreground">
              {routine.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {describeSchedule(routine.schedule, t)} · {routine.steps.length} {t("routine.stepsCount")} · {pct}% {t("routine.doneToday")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onEdit(routine)}
            aria-label={t("routine.edit")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-rose-50 hover:text-destructive dark:hover:bg-rose-950/30"
            onClick={() => {
              const routineToRestore = structuredClone(routine);
              removeRoutine(routine.id);
              toast.success(t("routine.deleted"), {
                action: { label: t("common.undo"), onClick: () => restoreRoutine(routineToRestore) },
                duration: 5000,
              });
            }}
            aria-label={t("routine.deleteRoutineAria")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {routine.steps.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("routine.noStepsYet")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {routine.steps.map((step) => {
            const isDone = completedStepIds.includes(step.id);
            const habit = step.habitId
              ? habits.find((item) => item.id === step.habitId)
              : undefined;
            const styles = habit ? colorStyles(habit.color) : null;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => toggleRoutineStep(routine.id, step.id, date)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200 active:scale-[0.99]",
                    isDone ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-muted/50 text-transparent",
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        isDone && "text-muted-foreground line-through",
                      )}
                    >
                      {step.title}
                    </p>
                    {habit && styles ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <HabitIcon
                          name={habit.icon}
                          customIcons={customIcons}
                          className={cn("h-3 w-3", styles.text)}
                        />
                        {habit.name}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
