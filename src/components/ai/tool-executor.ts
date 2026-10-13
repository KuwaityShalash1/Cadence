import { hasLucideIcon, resolveIconName } from "@/components/icon-map";
import type { AppActions, Goal, Habit } from "@/stores/app-store";
import type { ToolCallPayload, ToolExecutionResult } from "@/types/ai";

export interface ToolExecutorContext {
  actions: AppActions;
  habits: Habit[];
  goals: Goal[];
  language: "en" | "ar";
}

/**
 * Executes function calls returned by the AI Assistant against the local store.
 * Local mutations persist to IndexedDB immediately, while Supabase synchronization
 * occurs automatically in the background.
 */
export async function executeAiToolCalls(
  toolCalls: ToolCallPayload[],
  context: ToolExecutorContext,
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const isAr = context.language === "ar";

  for (const tc of toolCalls) {
    try {
      if (tc.name === "create_habit") {
        const name = String(tc.args["name"] || "").trim();
        const scheduleRaw = String(tc.args["schedule"] || "everyday").toLowerCase();
        const color = tc.args["color"] ? String(tc.args["color"]) : "emerald";
        const iconRaw = tc.args["icon"] ? String(tc.args["icon"]).trim() : undefined;
        const goalIdRaw = tc.args["goalId"] ? String(tc.args["goalId"]).trim() : undefined;

        const schedule =
          scheduleRaw === "weekdays" || scheduleRaw === "weekends"
            ? (scheduleRaw as "weekdays" | "weekends")
            : "everyday";

        if (!name) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: اسم العادة مطلوب" : "Failed: Habit name is required",
            success: false,
          });
          continue;
        }

        // Validate and normalize icon name from lucide-react with fallback to Sparkles
        let resolvedIcon = "Sparkles";
        if (iconRaw) {
          const resolved = resolveIconName(iconRaw);
          if (hasLucideIcon(resolved)) {
            resolvedIcon = resolved;
          }
        }

        // Match goalId against existing goals either by exact ID or by goal name
        let matchedGoal: Goal | undefined;
        if (goalIdRaw) {
          matchedGoal = context.goals.find(
            (g) => g.id === goalIdRaw || g.name.toLowerCase() === goalIdRaw.toLowerCase(),
          );
        }

        const habit = context.actions.addHabit({
          name,
          schedule,
          color,
          icon: resolvedIcon,
          goalId: matchedGoal ? matchedGoal.id : goalIdRaw || undefined,
        });

        const scheduleLabel = isAr
          ? schedule === "everyday"
            ? "يومياً"
            : schedule === "weekdays"
              ? "أيام العمل"
              : "عطلة نهاية الأسبوع"
          : schedule;

        let summary: string;
        if (matchedGoal) {
          summary = isAr
            ? `تم إنشاء العادة بنجاح: "${habit.name}" (${scheduleLabel}) وربطها بالهدف "${matchedGoal.name}"`
            : `Created habit: "${habit.name}" (${scheduleLabel}) linked to goal "${matchedGoal.name}"`;
        } else {
          summary = isAr
            ? `تم إنشاء العادة بنجاح: "${habit.name}" (${scheduleLabel})`
            : `Created habit: "${habit.name}" (${scheduleLabel})`;
        }

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: habit,
        });
      } else if (tc.name === "create_goal") {
        const name = String(tc.args["name"] || "").trim();
        const targetValue = Number(tc.args["targetValue"]) || 1;
        const unit = tc.args["unit"] ? String(tc.args["unit"]).trim() : "";

        if (!name) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: اسم الهدف مطلوب" : "Failed: Goal name is required",
            success: false,
          });
          continue;
        }

        const goal = context.actions.addGoal({
          name,
          targetValue,
          unit,
        });

        const summary = isAr
          ? `تم إنشاء الهدف بنجاح: "${goal.name}" (الهدف: ${targetValue} ${unit})`
          : `Created goal: "${goal.name}" (Target: ${targetValue} ${unit})`.trim();

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: goal,
        });
      } else if (tc.name === "log_habit") {
        const habitName = String(tc.args["habitName"] || "").trim();
        const status =
          String(tc.args["status"] || "done").toLowerCase() === "skipped" ? "skipped" : "done";

        if (!habitName) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: اسم العادة مطلوب" : "Failed: Habit name is required",
            success: false,
          });
          continue;
        }

        const logResult = context.actions.logHabit(habitName, status);

        if (logResult.success && logResult.habit) {
          const statusLabel = isAr
            ? status === "done"
              ? "منجزة"
              : "تم تخطيها"
            : status === "done"
              ? "done"
              : "skipped";

          const summary = isAr
            ? `تم تسجيل عادة "${logResult.habit.name}" كـ ${statusLabel} لليوم`
            : `Logged habit: "${logResult.habit.name}" as ${statusLabel} for today`;

          results.push({
            toolName: tc.name,
            summary,
            success: true,
            data: logResult.habit,
          });
        } else {
          const summary = isAr
            ? `لم يتم العثور على عادة باسم "${habitName}". يرجى التحقق من اسم العادة.`
            : `Could not find habit named "${habitName}". Please verify the habit name.`;

          results.push({
            toolName: tc.name,
            summary,
            success: false,
          });
        }
      } else if (tc.name === "get_app_summary") {
        const activeHabitsCount = context.habits.filter((h) => !h.archived).length;
        const activeGoalsCount = context.goals.length;

        const summary = isAr
          ? `لديك حالياً ${activeHabitsCount} عادات نشطة و ${activeGoalsCount} أهداف قيد المتابعة.`
          : `You currently have ${activeHabitsCount} active habit(s) and ${activeGoalsCount} goal(s).`;

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: {
            habits: context.habits
              .filter((h) => !h.archived)
              .map((h) => ({
                id: h.id,
                name: h.name,
                schedule: h.schedule,
                icon: h.icon,
                goalId: h.goalId,
              })),
            goals: context.goals.map((g) => ({
              id: g.id,
              name: g.name,
              targetValue: g.targetValue,
              currentValue: g.currentValue,
              unit: g.unit || "",
            })),
          },
        });
      }
    } catch (err) {
      console.error("[Client Tool Executor Error]:", err);
      results.push({
        toolName: tc.name,
        summary: isAr
          ? `حدث خطأ أثناء تنفيذ الإجراء: ${err instanceof Error ? err.message : String(err)}`
          : `Error executing action: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      });
    }
  }

  return results;
}
