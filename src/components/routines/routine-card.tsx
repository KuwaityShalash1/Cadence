import { Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { HabitIcon, colorStyles, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const { removeRoutine, restoreRoutine, toggleRoutineStep } = useApp();
  const cardTint = getColorStyle(routine.color ?? "teal", 0.14);
  const pct =
    routine.steps.length > 0
      ? Math.round((completedStepIds.length / routine.steps.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm"
            style={{ ...cardTint.style, color: cardTint.rawColor }}
          >
            <HabitIcon name={routine.icon} customIcons={customIcons} className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {routine.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {describeSchedule(routine.schedule)} · {routine.steps.length} steps · {pct}% done
              today
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={() => onEdit(routine)}
            aria-label="Edit routine"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-slate-500 hover:bg-rose-50 hover:text-destructive dark:text-slate-400 dark:hover:bg-rose-950/30"
            onClick={() => {
              const routineToRestore = structuredClone(routine);
              removeRoutine(routine.id);
              toast.success("Routine deleted", {
                action: { label: "Undo", onClick: () => restoreRoutine(routineToRestore) },
                duration: 5000,
              });
            }}
            aria-label="Delete routine"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {routine.steps.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No steps yet. Edit to add steps.</p>
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
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.99]",
                    isDone ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-300 bg-slate-50 text-transparent dark:border-slate-700 dark:bg-slate-800",
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
