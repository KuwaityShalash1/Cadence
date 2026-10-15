import { hasLucideIcon, resolveIconName } from "@/components/icon-map";
import { addDays, todayKey } from "@/services/dates";
import { buildLogMap, consistencyScore, habitStats, streaks } from "@/services/stats";
import type { AppActions, Goal, Habit } from "@/stores/app-store";
import { uid } from "@/stores/app-store";
import type { BadHabit, HabitLog } from "@/types";
import type { ToolCallPayload, ToolExecutionResult } from "@/types/ai";

export interface ToolExecutorContext {
  actions: AppActions;
  habits: Habit[];
  goals: Goal[];
  badHabits?: BadHabit[] | undefined;
  habitLogs?: HabitLog[] | undefined;
  language: "en" | "ar";
}

/**
 * Returns human-readable descriptions of proposed actions for Human-in-the-Loop cards.
 */
export function describeAction(
  toolCall: ToolCallPayload,
  language: "en" | "ar",
  context?: { habits?: Habit[]; goals?: Goal[]; badHabits?: BadHabit[] },
): string {
  const isAr = language === "ar";
  const { name, args } = toolCall;

  if (name === "create_habit") {
    const habitName = String(args["name"] || "Untitled Habit");
    const schedule = String(args["schedule"] || "everyday");
    const scheduleLabel = isAr
      ? schedule === "everyday"
        ? "يومياً"
        : schedule === "weekdays"
          ? "أيام العمل"
          : "عطلة نهاية الأسبوع"
      : schedule;
    return isAr
      ? `إنشاء عادة: "${habitName}" (${scheduleLabel})`
      : `Create Habit: "${habitName}" (${scheduleLabel})`;
  }

  if (name === "delete_habit") {
    let habitName = String(args["habitName"] || "").trim();
    const habitId = String(args["habitId"] || "").trim();
    if (!habitName && habitId && context?.habits) {
      const found = context.habits.find((h) => h.id === habitId);
      if (found) habitName = found.name;
    }
    habitName = habitName || habitId || (isAr ? "عادة محددة" : "Specified Habit");
    return isAr ? `حذف العادة: "${habitName}"` : `Delete Habit: "${habitName}"`;
  }

  if (name === "create_bad_habit") {
    const habitName = String(args["name"] || "Untitled");
    const limit = args["limit"];
    const limitSuffix =
      limit !== undefined && limit !== null && !isNaN(Number(limit))
        ? isAr
          ? ` (حد يومي: ${limit})`
          : ` (daily limit: ${limit})`
        : "";
    return isAr
      ? `إنشاء متتبع إقلاع: "${habitName}"${limitSuffix}`
      : `Create Quit Tracker: "${habitName}"${limitSuffix}`;
  }

  if (name === "delete_bad_habit") {
    let bhName = String(args["badHabitName"] || "").trim();
    const bhId = String(args["badHabitId"] || "").trim();
    if (!bhName && bhId && context?.badHabits) {
      const found = context.badHabits.find((b) => b.id === bhId);
      if (found) bhName = found.title;
    }
    bhName = bhName || bhId || (isAr ? "متتبع محدد" : "Specified Quit Tracker");
    return isAr ? `حذف متتبع الإقلاع: "${bhName}"` : `Delete Quit Tracker: "${bhName}"`;
  }

  if (name === "create_goal") {
    const goalName = String(args["name"] || "Untitled Goal");
    const target = args["targetValue"] ?? "";
    const unit = args["unit"] ? ` ${args["unit"]}` : "";
    return isAr
      ? `إنشاء هدف: "${goalName}" (المستهدف: ${target}${unit})`
      : `Create Goal: "${goalName}" (Target: ${target}${unit})`;
  }

  if (name === "delete_goal") {
    let goalName = String(args["goalName"] || "").trim();
    const goalId = String(args["goalId"] || "").trim();
    if (!goalName && goalId && context?.goals) {
      const found = context.goals.find((g) => g.id === goalId);
      if (found) goalName = found.name;
    }
    goalName = goalName || goalId || (isAr ? "هدف محدد" : "Specified Goal");
    return isAr ? `حذف الهدف: "${goalName}"` : `Delete Goal: "${goalName}"`;
  }

  if (name === "log_habit") {
    const habitName = String(args["habitName"] || "Habit");
    const status =
      String(args["status"] || "done").toLowerCase() === "skipped" ? "skipped" : "done";
    const statusLabel = isAr ? (status === "done" ? "منجزة" : "تم تخطيها") : status;
    return isAr
      ? `تسجيل عادة: تعيين "${habitName}" كـ ${statusLabel}`
      : `Log Habit: Mark "${habitName}" as ${statusLabel}`;
  }

  return isAr ? `تنفيذ الإجراء: ${name}` : `Execute Action: ${name}`;
}

/**
 * Executes function calls returned by the AI Assistant against the local store.
 * Local mutations persist immediately, while Supabase synchronization
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
      } else if (tc.name === "delete_habit") {
        const habitId = tc.args["habitId"] ? String(tc.args["habitId"]).trim() : "";
        const habitName = tc.args["habitName"] ? String(tc.args["habitName"]).trim() : "";

        const target = context.habits.find((h) => {
          if (habitId && h.id === habitId) return true;
          if (habitName && h.name.toLowerCase() === habitName.toLowerCase()) return true;
          return false;
        });

        if (!target) {
          const targetName = habitName || habitId || "unknown";
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `لم يتم العثور على عادة باسم أو معرف "${targetName}" لحذفها.`
              : `Could not find habit "${targetName}" to delete.`,
            success: false,
          });
          continue;
        }

        context.actions.deleteHabit(target.id);

        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم حذف العادة بنجاح: "${target.name}"`
            : `Deleted habit: "${target.name}"`,
          success: true,
          data: { id: target.id, name: target.name },
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
      } else if (tc.name === "delete_bad_habit") {
        const badHabitId = tc.args["badHabitId"] ? String(tc.args["badHabitId"]).trim() : "";
        const badHabitName = tc.args["badHabitName"] ? String(tc.args["badHabitName"]).trim() : "";

        const badHabitsList = context.badHabits || [];
        const target = badHabitsList.find((bh) => {
          if (badHabitId && bh.id === badHabitId) return true;
          if (badHabitName && bh.title.toLowerCase() === badHabitName.toLowerCase()) return true;
          return false;
        });

        if (!target) {
          const targetName = badHabitName || badHabitId || "unknown";
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `لم يتم العثور على متتبع إقلاع باسم أو معرف "${targetName}" لحذفه.`
              : `Could not find quit tracker "${targetName}" to delete.`,
            success: false,
          });
          continue;
        }

        if (typeof context.actions.deleteBadHabit === "function") {
          context.actions.deleteBadHabit(target.id);
        } else if (typeof context.actions.deleteQuitTracker === "function") {
          context.actions.deleteQuitTracker(target.id);
        } else {
          context.actions.removeBadHabit(target.id);
        }

        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم حذف متتبع الإقلاع: "${target.title}"`
            : `Deleted quit tracker: "${target.title}"`,
          success: true,
          data: { id: target.id, title: target.title },
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
      } else if (tc.name === "delete_goal") {
        const goalId = tc.args["goalId"] ? String(tc.args["goalId"]).trim() : "";
        const goalName = tc.args["goalName"] ? String(tc.args["goalName"]).trim() : "";

        const target = context.goals.find((g) => {
          if (goalId && g.id === goalId) return true;
          if (goalName && g.name.toLowerCase() === goalName.toLowerCase()) return true;
          return false;
        });

        if (!target) {
          const targetName = goalName || goalId || "unknown";
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `لم يتم العثور على هدف باسم أو معرف "${targetName}" لحذفه.`
              : `Could not find goal "${targetName}" to delete.`,
            success: false,
          });
          continue;
        }

        context.actions.deleteGoal(target.id);

        results.push({
          toolName: tc.name,
          summary: isAr ? `تم حذف الهدف بنجاح: "${target.name}"` : `Deleted goal: "${target.name}"`,
          success: true,
          data: { id: target.id, name: target.name },
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
      } else if (tc.name === "get_analytics") {
        const habitNameQuery = tc.args["habitName"]
          ? String(tc.args["habitName"]).trim().toLowerCase()
          : "";
        const days =
          typeof tc.args["timeRangeDays"] === "number" && tc.args["timeRangeDays"] > 0
            ? Math.round(tc.args["timeRangeDays"])
            : 30;

        const logMap = buildLogMap(context.habitLogs || []);
        const activeHabits = context.habits.filter((h) => !h.archived);
        const overallConsistency = consistencyScore(activeHabits, logMap, days);

        const today = todayKey();
        const startDate = addDays(today, -days);

        if (habitNameQuery) {
          const habit = activeHabits.find(
            (h) => h.name.toLowerCase() === habitNameQuery || h.id === habitNameQuery,
          );

          if (!habit) {
            results.push({
              toolName: tc.name,
              summary: isAr
                ? `لم يتم العثور على عادة باسم "${tc.args["habitName"]}" لتحليلها.`
                : `Could not find habit "${tc.args["habitName"]}" for analytics.`,
              success: false,
            });
            continue;
          }

          const stats = habitStats(habit, logMap, startDate, today);
          const streakInfo = streaks(habit, logMap);

          const summary = isAr
            ? `إحصائيات العادة "${habit.name}": السلسلة الحالية ${streakInfo.current} يوم (الأفضل: ${streakInfo.best} يوم)، نسبة الإنجاز آخر ${days} يوم: ${Math.round(stats.completionRate * 100)}%، الإجمالي المنجز: ${stats.totalCompletions}.`
            : `Habit "${habit.name}" Analytics: Current Streak ${streakInfo.current}d (Best: ${streakInfo.best}d), ${days}-day Completion: ${Math.round(stats.completionRate * 100)}%, Total Completed: ${stats.totalCompletions}.`;

          results.push({
            toolName: tc.name,
            summary,
            success: true,
            data: {
              habit: {
                id: habit.id,
                name: habit.name,
                currentStreak: streakInfo.current,
                bestStreak: streakInfo.best,
                completionRate: stats.completionRate,
                totalCompletions: stats.totalCompletions,
                scheduledDays: stats.scheduledDays,
              },
              overallConsistency,
            },
          });
        } else {
          // All habits summary
          const habitPerformances = activeHabits.map((h) => {
            const stats = habitStats(h, logMap, startDate, today);
            const streakInfo = streaks(h, logMap);
            return {
              id: h.id,
              name: h.name,
              currentStreak: streakInfo.current,
              bestStreak: streakInfo.best,
              completionRate: stats.completionRate,
              totalCompletions: stats.totalCompletions,
            };
          });

          const summary = isAr
            ? `معدل الاستمرارية العام: ${Math.round(overallConsistency * 100)}% عبر ${activeHabits.length} عادات نشطة. أعلى سلسلة حالية: ${Math.max(0, ...habitPerformances.map((p) => p.currentStreak))} يوم.`
            : `Overall consistency: ${Math.round(overallConsistency * 100)}% across ${activeHabits.length} active habit(s). Highest current streak: ${Math.max(0, ...habitPerformances.map((p) => p.currentStreak))}d.`;

          results.push({
            toolName: tc.name,
            summary,
            success: true,
            data: {
              overallConsistency,
              timeRangeDays: days,
              habits: habitPerformances,
            },
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
