import { hasLucideIcon, resolveIconName } from "@/components/icon-map";
import type { AppActions, Goal, Habit } from "@/stores/app-store";
import { uid } from "@/stores/app-store";
import type { BadHabit } from "@/types";
import type { ToolCallPayload, ToolExecutionResult } from "@/types/ai";

export interface ToolExecutorContext {
  actions: AppActions;
  habits: Habit[];
  goals: Goal[];
  badHabits?: BadHabit[];
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
      } else if (tc.name === "create_bad_habit") {
        const name = String(tc.args["name"] || "").trim();
        const triggerCategory = tc.args["triggerCategory"]
          ? String(tc.args["triggerCategory"]).trim()
          : undefined;
        const limitRaw = tc.args["limit"];
        const limit =
          typeof limitRaw === "number"
            ? limitRaw
            : limitRaw !== undefined && limitRaw !== null && !isNaN(Number(limitRaw))
              ? Number(limitRaw)
              : undefined;

        if (!name) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: اسم متتبع الإقلاع مطلوب" : "Failed: Bad habit name is required",
            success: false,
          });
          continue;
        }

        // Intelligently infer an icon based on habit name or trigger
        let resolvedIcon = "Flame";
        const lowerName = name.toLowerCase();
        if (
          lowerName.includes("smok") ||
          lowerName.includes("vape") ||
          lowerName.includes("cigar") ||
          lowerName.includes("nicotine")
        ) {
          resolvedIcon = "Flame";
        } else if (
          lowerName.includes("scroll") ||
          lowerName.includes("phone") ||
          lowerName.includes("screen") ||
          lowerName.includes("media")
        ) {
          resolvedIcon = "Smartphone";
        } else if (lowerName.includes("nail") || lowerName.includes("biting")) {
          resolvedIcon = "Hand";
        } else if (
          lowerName.includes("sugar") ||
          lowerName.includes("food") ||
          lowerName.includes("eat") ||
          lowerName.includes("snack") ||
          lowerName.includes("junk")
        ) {
          resolvedIcon = "Pizza";
        } else if (lowerName.includes("gossip") || lowerName.includes("talk")) {
          resolvedIcon = "MessageSquareOff";
        } else if (lowerName.includes("procrastinat") || lowerName.includes("delay")) {
          resolvedIcon = "Clock";
        } else if (
          lowerName.includes("drink") ||
          lowerName.includes("alcohol") ||
          lowerName.includes("beer")
        ) {
          resolvedIcon = "Wine";
        } else if (triggerCategory === "social") {
          resolvedIcon = "Users";
        } else if (triggerCategory === "stress") {
          resolvedIcon = "Zap";
        } else if (triggerCategory === "boredom") {
          resolvedIcon = "Moon";
        } else if (triggerCategory === "digital") {
          resolvedIcon = "Smartphone";
        }

        if (hasLucideIcon(resolveIconName(resolvedIcon))) {
          resolvedIcon = resolveIconName(resolvedIcon);
        } else {
          resolvedIcon = "Flame";
        }

        let badHabit: BadHabit;
        if (typeof context.actions.addBadHabit === "function") {
          badHabit = context.actions.addBadHabit({
            name,
            triggerCategory,
            limit,
            icon: resolvedIcon,
          });
        } else {
          const now = Date.now();
          const hasLimit = typeof limit === "number" && !isNaN(limit) && limit > 0;
          badHabit = {
            id: uid(),
            title: name,
            quitDate: now,
            history: [],
            createdAt: now,
            updatedAt: new Date().toISOString(),
            icon: resolvedIcon,
            color: "rose",
            strategy: hasLimit ? "limit" : "cold-turkey",
            ...(hasLimit && limit !== undefined
              ? { limitType: "count" as const, limitValue: limit }
              : {}),
            usageLogs: [],
            triggerCategory,
          };
          context.actions.upsertBadHabit(badHabit);
        }

        const summary = isAr
          ? `تم إنشاء متتبع الإقلاع: ${badHabit.title}`
          : `Created Quit Tracker: ${badHabit.title}`;

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: badHabit,
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
        const activeBadHabitsCount = (context.badHabits ?? []).length;

        const summary = isAr
          ? `لديك حالياً ${activeHabitsCount} عادات نشطة، ${activeBadHabitsCount} متتبعات إقلاع، و ${activeGoalsCount} أهداف قيد المتابعة.`
          : `You currently have ${activeHabitsCount} active habit(s), ${activeBadHabitsCount} quit tracker(s), and ${activeGoalsCount} goal(s).`;

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
            badHabits: (context.badHabits ?? []).map((bh) => ({
              id: bh.id,
              title: bh.title,
              strategy: bh.strategy,
              limitValue: bh.limitValue,
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
