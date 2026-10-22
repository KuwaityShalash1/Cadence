import { hasLucideIcon, resolveIconName } from "@/components/icon-map";
import { addDays, todayKey } from "@/services/dates";
import { buildLogMap, consistencyScore, habitStats, streaks } from "@/services/stats";
import { saveAiMemory, removeAiMemory } from "@/services/ai-memory";
import { calculateSmartDefaultStep } from "@/services/quick-steps";
import type { AppActions, Goal, Habit, Routine } from "@/stores/app-store";
import { uid } from "@/stores/app-store";
import type { BadHabit, HabitLog, HabitType, RoutineStep, Schedule } from "@/types";
import type { ToolCallPayload, ToolExecutionResult } from "@/types/ai";

export { calculateSmartDefaultStep };

export interface ToolExecutorContext {
  actions: AppActions;
  habits: Habit[];
  goals: Goal[];
  routines?: Routine[] | undefined;
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
  context?: { habits?: Habit[]; goals?: Goal[]; badHabits?: BadHabit[]; routines?: Routine[] },
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
    const targetVal = args["targetValue"] ?? args["target"];
    const unit = args["unit"] ? String(args["unit"]).trim() : "";
    const targetSuffix =
      targetVal !== undefined && !isNaN(Number(targetVal)) && Number(targetVal) > 0
        ? isAr
          ? `، الهدف: ${targetVal} ${unit}`.trim()
          : `, Target: ${targetVal} ${unit}`.trim()
        : "";
    return isAr
      ? `إنشاء عادة: "${habitName}" (${scheduleLabel}${targetSuffix})`
      : `Create Habit: "${habitName}" (${scheduleLabel}${targetSuffix})`;
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

  if (name === "create_routine") {
    const routineName = String(args["name"] || "Untitled Routine");
    const habitCount = Array.isArray(args["habitNames"])
      ? args["habitNames"].length
      : Array.isArray(args["steps"])
        ? args["steps"].length
        : 0;
    const stepsSuffix =
      habitCount > 0 ? (isAr ? ` (${habitCount} خطوات)` : ` (${habitCount} steps)`) : "";
    return isAr
      ? `إنشاء روتين: "${routineName}"${stepsSuffix}`
      : `Create Routine: "${routineName}"${stepsSuffix}`;
  }

  if (name === "delete_routine") {
    let rName = String(args["routineName"] || "").trim();
    const rId = String(args["routineId"] || "").trim();
    if (!rName && rId && context?.routines) {
      const found = context.routines.find((r) => r.id === rId);
      if (found) rName = found.name;
    }
    rName = rName || rId || (isAr ? "روتين محدد" : "Specified Routine");
    return isAr ? `حذف الروتين: "${rName}"` : `Delete Routine: "${rName}"`;
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

  if (name === "clear_all_data") {
    const sections = (args["sections"] as string[]) || ["all"];
    if (sections.includes("all")) {
      return isAr
        ? "مسح وإعادة ضبط جميع البيانات بالكامل (عادات، روتينات، أهداف، إقلاع)"
        : "Clear & Reset All Data (Habits, Routines, Goals, Quit Trackers)";
    }
    const label = sections.join(", ");
    return isAr ? `مسح بيانات الأقسام: ${label}` : `Clear sections: ${label}`;
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

  if (name === "log_habit_progress") {
    const rawName = String(args["habitName"] || args["habitId"] || "Habit");
    // Try to resolve habit name from context if only ID was given
    const resolvedHabit = context?.habits?.find(
      (h) =>
        h.id === String(args["habitId"] || "") || h.name.toLowerCase() === rawName.toLowerCase(),
    );
    const displayName = resolvedHabit?.name || rawName;
    const amount = Number(args["amount"] ?? 0);
    const mode = String(args["mode"] || "increment");
    const unit = resolvedHabit?.unit || "";
    if (mode === "set") {
      return isAr
        ? `تعيين قيمة "${displayName}" إلى ${amount} ${unit}`
        : `Set "${displayName}" value to ${amount} ${unit}`;
    }
    return isAr
      ? `إضافة ${amount} ${unit} إلى "${displayName}"`
      : `Add ${amount} ${unit} to "${displayName}"`;
  }

  if (name === "update_habit") {
    const habitName = String(args["habitName"] || "").trim();
    const habitId = String(args["habitId"] || "").trim();
    const existing = context?.habits?.find(
      (h) =>
        (habitId && h.id === habitId) ||
        (habitName && h.name.toLowerCase() === habitName.toLowerCase()),
    );
    const displayName = existing?.name || habitName || (isAr ? "عادة" : "Habit");

    const diffs: string[] = [];
    if (args["targetValue"] !== undefined || args["target"] !== undefined) {
      const oldVal = existing ? `${existing.target} ${existing.unit || ""}`.trim() : "";
      const newUnit = args["unit"] !== undefined ? String(args["unit"]) : existing?.unit || "";
      const newVal = `${Number(args["targetValue"] ?? args["target"])} ${newUnit}`.trim();
      diffs.push(
        isAr ? `الهدف ${oldVal || "?"} ⬅️ ${newVal}` : `Target ${oldVal || "?"} ➡️ ${newVal}`,
      );
    } else if (args["unit"] !== undefined && existing && args["unit"] !== existing.unit) {
      diffs.push(
        isAr
          ? `الوحدة ${existing.unit} ⬅️ ${args["unit"]}`
          : `Unit ${existing.unit} ➡️ ${args["unit"]}`,
      );
    }

    if (args["name"] && existing && String(args["name"]).trim() !== existing.name) {
      diffs.push(
        isAr
          ? `الاسم "${existing.name}" ⬅️ "${args["name"]}"`
          : `Name "${existing.name}" ➡️ "${args["name"]}"`,
      );
    }

    if (args["schedule"]) {
      const scheduleMap: Record<string, { ar: string; en: string }> = {
        everyday: { ar: "يومياً", en: "Everyday" },
        weekdays: { ar: "أيام العمل", en: "Weekdays" },
        weekends: { ar: "عطلة نهاية الأسبوع", en: "Weekends" },
      };
      const oldSchedKey = existing?.schedule.type === "weekdays" ? "weekdays" : "everyday";
      const newSchedKey = String(args["schedule"]).toLowerCase();
      const oldLabel = isAr
        ? (scheduleMap[oldSchedKey]?.ar ?? oldSchedKey)
        : (scheduleMap[oldSchedKey]?.en ?? oldSchedKey);
      const newLabel = isAr
        ? (scheduleMap[newSchedKey]?.ar ?? newSchedKey)
        : (scheduleMap[newSchedKey]?.en ?? newSchedKey);
      diffs.push(
        isAr ? `الجدول ${oldLabel} ⬅️ ${newLabel}` : `Schedule ${oldLabel} ➡️ ${newLabel}`,
      );
    }

    if (args["color"] && existing && args["color"] !== existing.color) {
      diffs.push(isAr ? `اللون ⬅️ ${args["color"]}` : `Color ➡️ ${args["color"]}`);
    }

    if (args["icon"] && existing && args["icon"] !== existing.icon) {
      diffs.push(isAr ? `الأيقونة ⬅️ ${args["icon"]}` : `Icon ➡️ ${args["icon"]}`);
    }

    const diffContent = diffs.length > 0 ? `: ${diffs.join(" ، ")}` : "";
    return isAr
      ? `تعديل العادة "${displayName}"${diffContent}`
      : `Update Habit "${displayName}"${diffContent}`;
  }

  if (name === "update_bad_habit") {
    const badHabitName = String(args["badHabitName"] || "").trim();
    const badHabitId = String(args["badHabitId"] || "").trim();
    const existing = context?.badHabits?.find(
      (b) =>
        (badHabitId && b.id === badHabitId) ||
        (badHabitName && b.title.toLowerCase() === badHabitName.toLowerCase()),
    );
    const displayName = existing?.title || badHabitName || (isAr ? "متتبع إقلاع" : "Quit Tracker");

    const diffs: string[] = [];
    if (args["limit"] !== undefined) {
      const oldLimit =
        existing?.limitValue !== undefined ? String(existing.limitValue) : isAr ? "بدون" : "none";
      diffs.push(
        isAr
          ? `الحد اليومي ${oldLimit} ⬅️ ${args["limit"]}`
          : `Daily limit ${oldLimit} ➡️ ${args["limit"]}`,
      );
    }
    if (args["name"] && existing && String(args["name"]).trim() !== existing.title) {
      diffs.push(
        isAr
          ? `الاسم "${existing.title}" ⬅️ "${args["name"]}"`
          : `Name "${existing.title}" ➡️ "${args["name"]}"`,
      );
    }
    if (
      args["triggerCategory"] &&
      existing &&
      args["triggerCategory"] !== existing.triggerCategory
    ) {
      diffs.push(
        isAr
          ? `المحفز ${existing.triggerCategory || "عام"} ⬅️ ${args["triggerCategory"]}`
          : `Trigger ${existing.triggerCategory || "general"} ➡️ ${args["triggerCategory"]}`,
      );
    }

    const diffContent = diffs.length > 0 ? `: ${diffs.join(" ، ")}` : "";
    return isAr
      ? `تعديل متتبع الإقلاع "${displayName}"${diffContent}`
      : `Update Quit Tracker "${displayName}"${diffContent}`;
  }

  if (name === "update_goal") {
    const goalName = String(args["goalName"] || "").trim();
    const goalId = String(args["goalId"] || "").trim();
    const existing = context?.goals?.find(
      (g) =>
        (goalId && g.id === goalId) ||
        (goalName && g.name.toLowerCase() === goalName.toLowerCase()),
    );
    const displayName = existing?.name || goalName || (isAr ? "هدف" : "Goal");

    const diffs: string[] = [];
    if (args["targetValue"] !== undefined) {
      const oldVal = existing ? `${existing.targetValue} ${existing.unit || ""}`.trim() : "";
      const newUnit = args["unit"] !== undefined ? String(args["unit"]) : existing?.unit || "";
      const newVal = `${Number(args["targetValue"])} ${newUnit}`.trim();
      diffs.push(
        isAr ? `المستهدف ${oldVal || "?"} ⬅️ ${newVal}` : `Target ${oldVal || "?"} ➡️ ${newVal}`,
      );
    }
    if (args["name"] && existing && String(args["name"]).trim() !== existing.name) {
      diffs.push(
        isAr
          ? `الاسم "${existing.name}" ⬅️ "${args["name"]}"`
          : `Name "${existing.name}" ➡️ "${args["name"]}"`,
      );
    }

    const diffContent = diffs.length > 0 ? `: ${diffs.join(" ، ")}` : "";
    return isAr
      ? `تعديل الهدف "${displayName}"${diffContent}`
      : `Update Goal "${displayName}"${diffContent}`;
  }

  if (name === "update_routine") {
    const routineName = String(args["routineName"] || "").trim();
    const routineId = String(args["routineId"] || "").trim();
    const existing = context?.routines?.find(
      (r) =>
        (routineId && r.id === routineId) ||
        (routineName && r.name.toLowerCase() === routineName.toLowerCase()),
    );
    const displayName = existing?.name || routineName || (isAr ? "روتين" : "Routine");

    const diffs: string[] = [];
    if (args["name"] && existing && String(args["name"]).trim() !== existing.name) {
      diffs.push(
        isAr
          ? `الاسم "${existing.name}" ⬅️ "${args["name"]}"`
          : `Name "${existing.name}" ➡️ "${args["name"]}"`,
      );
    }
    if (Array.isArray(args["steps"])) {
      diffs.push(
        isAr ? `الخطوات: ${args["steps"].length} خطوات` : `Steps: ${args["steps"].length} steps`,
      );
    }

    const diffContent = diffs.length > 0 ? `: ${diffs.join(" ، ")}` : "";
    return isAr
      ? `تعديل الروتين "${displayName}"${diffContent}`
      : `Update Routine "${displayName}"${diffContent}`;
  }

  if (name === "save_user_memory") {
    const fact = String(args["fact"] || "");
    return isAr ? `🧠 تذكر المساعد: ${fact}` : `🧠 Assistant remembered: ${fact}`;
  }

  if (name === "manage_user_memory") {
    const fact = String(args["fact"] || "");
    const action = String(args["action"] || "add").toLowerCase();
    if (action === "remove") {
      return isAr ? `🧠 نسي المساعد: ${fact}` : `🧠 Assistant forgot: ${fact}`;
    }
    return isAr ? `🧠 تذكر المساعد: ${fact}` : `🧠 Assistant remembered: ${fact}`;
  }

  return isAr ? `تنفيذ الإجراء: ${name}` : `Execute Action: ${name}`;
}

/**
 * Assigns an execution phase priority so dependencies execute in safe order
 * (e.g. memories -> clear_all_data -> deletions -> updates -> habit creations -> routine creations -> logging).
 */
function getToolExecutionPriority(toolName: string): number {
  if (toolName === "save_user_memory" || toolName === "manage_user_memory") return 0;
  if (toolName === "clear_all_data") return 1;
  if (toolName.startsWith("delete_")) return 2;
  if (toolName.startsWith("update_")) return 3;
  if (toolName === "create_goal") return 4;
  if (toolName === "create_habit" || toolName === "create_bad_habit") return 5;
  if (toolName === "create_routine") return 6;
  if (toolName.startsWith("log_")) return 7;
  return 8;
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

  // Sort calls so habits exist before routines attempt to reference their IDs
  const sortedCalls = [...toolCalls].sort(
    (a, b) => getToolExecutionPriority(a.name) - getToolExecutionPriority(b.name),
  );

  // Track habits created within this execution batch so routines can link to them
  const createdHabitsByName = new Map<string, Habit>();
  const createdHabitsById = new Map<string, Habit>();

  for (const tc of sortedCalls) {
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

        const targetRaw = tc.args["targetValue"] ?? tc.args["target"];
        const target =
          targetRaw !== undefined && !isNaN(Number(targetRaw)) && Number(targetRaw) > 0
            ? Number(targetRaw)
            : 1;

        const unit = typeof tc.args["unit"] === "string" ? tc.args["unit"].trim() : "";

        // Infer habit type (counter, duration, numeric) — never leave as boolean so quick +/- controls render
        let habitType: HabitType = "counter";
        const typeRaw = tc.args["type"];
        if (typeRaw === "counter" || typeRaw === "numeric" || typeRaw === "duration") {
          habitType = typeRaw as HabitType;
        } else {
          const lowerUnit = unit.toLowerCase();
          const lowerName = name.toLowerCase();
          if (
            lowerUnit === "min" ||
            lowerUnit === "mins" ||
            lowerUnit === "minute" ||
            lowerUnit === "minutes" ||
            lowerUnit === "دقيقة" ||
            lowerUnit === "دقائق" ||
            lowerUnit === "hr" ||
            lowerUnit === "hours" ||
            lowerUnit === "ساعة" ||
            lowerUnit === "ساعات" ||
            lowerName.includes("دقيقة") ||
            lowerName.includes("min")
          ) {
            habitType = "duration";
          } else if (
            lowerUnit === "l" ||
            lowerUnit === "ml" ||
            lowerUnit === "liter" ||
            lowerUnit === "liters" ||
            lowerUnit === "لتر" ||
            lowerUnit === "لترات" ||
            lowerUnit === "km" ||
            lowerUnit === "pages" ||
            lowerUnit === "صفحة" ||
            lowerUnit === "صفحات"
          ) {
            habitType = "numeric";
          } else {
            habitType = "counter";
          }
        }

        // Resolve quick increments / decrements
        const stepRaw = tc.args["step"] ?? tc.args["increment"];
        let quickIncrements: number[] = [];
        let quickDecrement: number[] = [];

        if (Array.isArray(tc.args["quickIncrements"])) {
          quickIncrements = (tc.args["quickIncrements"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        }
        if (Array.isArray(tc.args["quickDecrements"])) {
          quickDecrement = (tc.args["quickDecrements"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        } else if (Array.isArray(tc.args["quickDecrement"])) {
          quickDecrement = (tc.args["quickDecrement"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        }

        if (stepRaw !== undefined && !isNaN(Number(stepRaw)) && Number(stepRaw) > 0) {
          const stepVal = Number(stepRaw);
          if (!quickIncrements.includes(stepVal)) {
            quickIncrements.push(stepVal);
          }
          if (!quickDecrement.includes(stepVal)) {
            quickDecrement.push(stepVal);
          }
        }

        // Bulletproof fallback: If AI ever omits the increment/step property, calculate smart default step based on targetValue
        if (quickIncrements.length === 0) {
          const smartStep = calculateSmartDefaultStep(target, unit);
          quickIncrements = [smartStep];
        }
        if (quickDecrement.length === 0) {
          const smartStep = calculateSmartDefaultStep(target, unit);
          quickDecrement = [smartStep];
        }

        const habit = context.actions.addHabit({
          name,
          schedule,
          color,
          icon: resolvedIcon,
          goalId: matchedGoal ? matchedGoal.id : goalIdRaw || undefined,
          target,
          unit,
          type: habitType,
          quickIncrements,
          quickDecrement,
        });

        // Register in newly created map for routine linking
        createdHabitsByName.set(habit.name.trim().toLowerCase(), habit);
        createdHabitsById.set(habit.id, habit);

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
              ? `العادة "${targetName}" تم حذفها بالفعل سابقاً.`
              : `Habit "${targetName}" was already deleted.`,
            success: true,
            data: { id: habitId, name: targetName, alreadyDeleted: true },
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
      } else if (tc.name === "create_routine") {
        const name = String(tc.args["name"] || "").trim();
        const scheduleRaw = String(tc.args["schedule"] || "everyday").toLowerCase();
        const timeOfDay = String(tc.args["timeOfDay"] || "").toLowerCase();
        const habitNames = Array.isArray(tc.args["habitNames"])
          ? (tc.args["habitNames"] as string[])
          : [];
        const habitIds = Array.isArray(tc.args["habitIds"])
          ? (tc.args["habitIds"] as string[])
          : [];
        const stepsRaw = Array.isArray(tc.args["steps"])
          ? (tc.args["steps"] as Array<{ title?: string; habitName?: string; habitId?: string }>)
          : [];

        if (!name) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: اسم الروتين مطلوب" : "Failed: Routine name is required",
            success: false,
          });
          continue;
        }

        // Infer icon based on routine name / timeOfDay
        let resolvedIcon = "Sparkles";
        const lowerName = name.toLowerCase();
        if (
          timeOfDay === "morning" ||
          lowerName.includes("morning") ||
          lowerName.includes("صباح") ||
          lowerName.includes("wake")
        ) {
          resolvedIcon = "Sun";
        } else if (
          timeOfDay === "evening" ||
          lowerName.includes("evening") ||
          lowerName.includes("night") ||
          lowerName.includes("مساء") ||
          lowerName.includes("sleep") ||
          lowerName.includes("bed")
        ) {
          resolvedIcon = "Moon";
        } else if (
          lowerName.includes("work") ||
          lowerName.includes("study") ||
          lowerName.includes("عمل")
        ) {
          resolvedIcon = "Briefcase";
        } else if (
          lowerName.includes("gym") ||
          lowerName.includes("workout") ||
          lowerName.includes("تمرين")
        ) {
          resolvedIcon = "Dumbbell";
        }

        const routineSchedule: Schedule =
          scheduleRaw === "weekdays"
            ? { type: "weekdays", days: [1, 2, 3, 4, 5] }
            : scheduleRaw === "weekends"
              ? { type: "weekdays", days: [0, 6] }
              : { type: "daily" };

        // Helper to find habit across newly created habits and existing habits
        const findHabit = (query: string): Habit | undefined => {
          const q = query.trim().toLowerCase();
          return (
            createdHabitsById.get(query) ||
            context.habits.find((h) => h.id === query) ||
            createdHabitsByName.get(q) ||
            context.habits.find((h) => h.name.trim().toLowerCase() === q) ||
            context.habits.find(
              (h) => h.name.toLowerCase().includes(q) || q.includes(h.name.toLowerCase()),
            )
          );
        };

        const routineSteps: RoutineStep[] = [];

        if (stepsRaw.length > 0) {
          for (const s of stepsRaw) {
            const stepTitle = String(s.title || "").trim();
            if (!stepTitle) continue;
            const habitQuery = s.habitId || s.habitName || stepTitle;
            const linkedHabit = findHabit(habitQuery);
            routineSteps.push({
              id: uid(),
              title: stepTitle,
              habitId: linkedHabit ? linkedHabit.id : undefined,
              updatedAt: new Date().toISOString(),
            });
          }
        } else if (habitNames.length > 0 || habitIds.length > 0) {
          const combined = [...habitNames, ...habitIds];
          for (const item of combined) {
            const q = String(item).trim();
            if (!q) continue;
            const linkedHabit = findHabit(q);
            routineSteps.push({
              id: uid(),
              title: linkedHabit ? linkedHabit.name : q,
              habitId: linkedHabit ? linkedHabit.id : undefined,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          routineSteps.push({
            id: uid(),
            title: name,
            updatedAt: new Date().toISOString(),
          });
        }

        const newRoutine: Routine = {
          id: uid(),
          order: Date.now(),
          name,
          icon: resolvedIcon,
          color: "teal",
          steps: routineSteps,
          schedule: routineSchedule,
          createdAt: Date.now(),
          updatedAt: new Date().toISOString(),
        };

        context.actions.upsertRoutine(newRoutine);

        const summary = isAr
          ? `تم إنشاء الروتين بنجاح: "${newRoutine.name}" (${newRoutine.steps.length} خطوات)`
          : `Created routine: "${newRoutine.name}" (${newRoutine.steps.length} step(s))`;

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: newRoutine,
        });
      } else if (tc.name === "delete_routine") {
        const routineId = tc.args["routineId"] ? String(tc.args["routineId"]).trim() : "";
        const routineName = tc.args["routineName"] ? String(tc.args["routineName"]).trim() : "";

        const routinesList = context.routines || [];
        const target = routinesList.find((r) => {
          if (routineId && r.id === routineId) return true;
          if (routineName && r.name.toLowerCase() === routineName.toLowerCase()) return true;
          return false;
        });

        if (!target) {
          const targetName = routineName || routineId || "unknown";
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `الروتين "${targetName}" تم حذفه بالفعل سابقاً.`
              : `Routine "${targetName}" was already deleted.`,
            success: true,
            data: { id: routineId, name: targetName, alreadyDeleted: true },
          });
          continue;
        }

        context.actions.deleteRoutine(target.id);

        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم حذف الروتين بنجاح: "${target.name}"`
            : `Deleted routine: "${target.name}"`,
          success: true,
          data: { id: target.id, name: target.name },
        });
      } else if (tc.name === "clear_all_data") {
        const sections = Array.isArray(tc.args["sections"])
          ? (tc.args["sections"] as string[])
          : ["all"];

        const wipeAll = sections.includes("all");
        let habitsWiped = 0;
        let badHabitsWiped = 0;
        let goalsWiped = 0;
        let routinesWiped = 0;

        if (wipeAll || sections.includes("habits")) {
          for (const h of context.habits) {
            context.actions.deleteHabit(h.id);
            habitsWiped++;
          }
        }
        if (wipeAll || sections.includes("bad_habits")) {
          for (const bh of context.badHabits || []) {
            if (typeof context.actions.deleteBadHabit === "function") {
              context.actions.deleteBadHabit(bh.id);
            } else if (typeof context.actions.deleteQuitTracker === "function") {
              context.actions.deleteQuitTracker(bh.id);
            } else {
              context.actions.removeBadHabit(bh.id);
            }
            badHabitsWiped++;
          }
        }
        if (wipeAll || sections.includes("goals")) {
          for (const g of context.goals) {
            context.actions.deleteGoal(g.id);
            goalsWiped++;
          }
        }
        if (wipeAll || sections.includes("routines")) {
          for (const r of context.routines || []) {
            context.actions.deleteRoutine(r.id);
            routinesWiped++;
          }
        }

        if (wipeAll && typeof context.actions.resetAll === "function") {
          await context.actions.resetAll();
        }

        const summary = isAr
          ? `تم مسح البيانات بنجاح (${habitsWiped} عادات، ${badHabitsWiped} إقلاع، ${goalsWiped} أهداف، ${routinesWiped} روتينات).`
          : `Cleared data successfully (${habitsWiped} habits, ${badHabitsWiped} quit trackers, ${goalsWiped} goals, ${routinesWiped} routines).`;

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: { habitsWiped, badHabitsWiped, goalsWiped, routinesWiped },
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
              ? `متتبع الإقلاع "${targetName}" تم حذفه بالفعل سابقاً.`
              : `Quit tracker "${targetName}" was already deleted.`,
            success: true,
            data: { id: badHabitId, title: targetName, alreadyDeleted: true },
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
              ? `الهدف "${targetName}" تم حذفه بالفعل سابقاً.`
              : `Goal "${targetName}" was already deleted.`,
            success: true,
            data: { id: goalId, name: targetName, alreadyDeleted: true },
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
      } else if (tc.name === "log_habit_progress") {
        const habitId = tc.args["habitId"] ? String(tc.args["habitId"]).trim() : "";
        const habitName = tc.args["habitName"] ? String(tc.args["habitName"]).trim() : "";
        const amount = Number(tc.args["amount"] ?? 0);
        const mode = String(tc.args["mode"] || "increment") as "increment" | "set";

        if (!habitId && !habitName) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? "فشل: يجب تحديد اسم العادة أو معرفها"
              : "Failed: habitId or habitName is required",
            success: false,
          });
          continue;
        }

        if (isNaN(amount)) {
          results.push({
            toolName: tc.name,
            summary: isAr ? "فشل: القيمة غير صالحة" : "Failed: invalid amount",
            success: false,
          });
          continue;
        }

        // Resolve the habit from the context
        const needle = (habitName || habitId).trim().toLowerCase();
        const targetHabit =
          context.habits.find((h) => h.id === habitId) ??
          context.habits.find((h) => h.name.trim().toLowerCase() === needle) ??
          context.habits.find(
            (h) => h.name.toLowerCase().includes(needle) || needle.includes(h.name.toLowerCase()),
          );

        if (!targetHabit) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `لم يتم العثور على عادة باسم "${habitName || habitId}"`
              : `Could not find habit "${habitName || habitId}"`,
            success: false,
          });
          continue;
        }

        const today = todayKey();
        const existingLog = (context.habitLogs || []).find(
          (l) => l.habitId === targetHabit.id && l.date === today,
        );
        const prevValue = existingLog?.value ?? 0;

        if (mode === "set") {
          context.actions.setHabitValue(targetHabit.id, today, amount);
        } else {
          context.actions.incrementHabit(targetHabit.id, today, amount);
        }

        const newValue = mode === "set" ? amount : prevValue + amount;
        const unit = targetHabit.unit || "";
        const targetVal = targetHabit.target || 1;
        const isNowComplete = newValue >= targetVal;

        const summary = isAr
          ? `تم تسجيل التقدم لـ "${targetHabit.name}": ${newValue.toFixed(2).replace(/\.?0+$/, "")} / ${targetVal} ${unit}${isNowComplete ? " ✓ مكتمل!" : ""}`
          : `Logged progress for "${targetHabit.name}": ${newValue.toFixed(2).replace(/\.?0+$/, "")} / ${targetVal} ${unit}${isNowComplete ? " ✓ Complete!" : ""}`;

        results.push({
          toolName: tc.name,
          summary,
          success: true,
          data: {
            habitId: targetHabit.id,
            habitName: targetHabit.name,
            prevValue,
            newValue,
            targetValue: targetVal,
            unit,
            isComplete: isNowComplete,
          },
        });
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
        const activeRoutinesCount = (context.routines ?? []).length;

        const summary = isAr
          ? `لديك حالياً ${activeHabitsCount} عادات نشطة، ${activeRoutinesCount} روتينات، ${activeBadHabitsCount} متتبعات إقلاع، و ${activeGoalsCount} أهداف قيد المتابعة.`
          : `You currently have ${activeHabitsCount} active habit(s), ${activeRoutinesCount} routine(s), ${activeBadHabitsCount} quit tracker(s), and ${activeGoalsCount} goal(s).`;

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
            routines: (context.routines ?? []).map((r) => ({
              id: r.id,
              name: r.name,
              steps: r.steps,
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
      } else if (tc.name === "update_habit") {
        const habitId = tc.args["habitId"] ? String(tc.args["habitId"]).trim() : "";
        const habitName = tc.args["habitName"] ? String(tc.args["habitName"]).trim() : "";
        const newName = tc.args["name"] ? String(tc.args["name"]).trim() : undefined;
        const scheduleRaw = tc.args["schedule"]
          ? String(tc.args["schedule"]).toLowerCase().trim()
          : undefined;
        const targetValue =
          tc.args["targetValue"] !== undefined
            ? Number(tc.args["targetValue"])
            : tc.args["target"] !== undefined
              ? Number(tc.args["target"])
              : undefined;
        const unit = tc.args["unit"] !== undefined ? String(tc.args["unit"]).trim() : undefined;
        const color = tc.args["color"] ? String(tc.args["color"]).trim() : undefined;
        const iconRaw = tc.args["icon"] ? String(tc.args["icon"]).trim() : undefined;

        const targetHabit = context.habits.find((h) => {
          if (habitId && h.id === habitId) return true;
          if (habitName && h.name.toLowerCase() === habitName.toLowerCase()) return true;
          if (newName && h.name.toLowerCase() === newName.toLowerCase()) return true;
          return false;
        });

        if (!targetHabit) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `فشل: لم يتم العثور على العادة المراد تعديلها (${habitName || habitId || "غير محدد"})`
              : `Failed: Habit to update not found (${habitName || habitId || "unspecified"})`,
            success: false,
          });
          continue;
        }

        let newSchedule: Schedule = targetHabit.schedule;
        if (scheduleRaw === "everyday" || scheduleRaw === "daily") {
          newSchedule = { type: "daily" };
        } else if (scheduleRaw === "weekdays") {
          newSchedule = { type: "weekdays", days: [1, 2, 3, 4, 5] };
        } else if (scheduleRaw === "weekends") {
          newSchedule = { type: "weekdays", days: [0, 6] };
        }

        let resolvedIcon = targetHabit.icon;
        if (iconRaw) {
          const resolved = resolveIconName(iconRaw);
          if (hasLucideIcon(resolved)) {
            resolvedIcon = resolved;
          }
        }

        const stepRaw = tc.args["step"] ?? tc.args["increment"];
        let resolvedQuickIncrements = targetHabit.quickIncrements;
        let resolvedQuickDecrements = targetHabit.quickDecrement;

        if (Array.isArray(tc.args["quickIncrements"])) {
          resolvedQuickIncrements = (tc.args["quickIncrements"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        }
        if (Array.isArray(tc.args["quickDecrements"])) {
          resolvedQuickDecrements = (tc.args["quickDecrements"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        } else if (Array.isArray(tc.args["quickDecrement"])) {
          resolvedQuickDecrements = (tc.args["quickDecrement"] as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0)
            .slice(0, 2);
        }

        if (stepRaw !== undefined && !isNaN(Number(stepRaw)) && Number(stepRaw) > 0) {
          const stepVal = Number(stepRaw);
          resolvedQuickIncrements = [stepVal];
          resolvedQuickDecrements = [stepVal];
        }

        const newTarget =
          targetValue !== undefined && !isNaN(targetValue) && targetValue > 0
            ? targetValue
            : targetHabit.target;
        const newUnit = unit !== undefined ? unit : targetHabit.unit;

        // If increments/decrements are empty or unconfigured, calculate smart defaults
        if (!resolvedQuickIncrements || resolvedQuickIncrements.length === 0) {
          const smartStep = calculateSmartDefaultStep(newTarget, newUnit);
          resolvedQuickIncrements = [smartStep];
        }
        if (!resolvedQuickDecrements || resolvedQuickDecrements.length === 0) {
          const smartStep = calculateSmartDefaultStep(newTarget, newUnit);
          resolvedQuickDecrements = [smartStep];
        }

        // Ensure type is interactive (counter, duration, numeric) so quick controls render
        let resolvedType = targetHabit.type;
        if (tc.args["type"] && typeof tc.args["type"] === "string") {
          resolvedType = tc.args["type"] as HabitType;
        }
        if (resolvedType === "boolean") {
          resolvedType = "counter";
        }

        const updatedHabit: Habit = {
          ...targetHabit,
          name: newName || targetHabit.name,
          schedule: newSchedule,
          type: resolvedType,
          target: newTarget,
          unit: newUnit,
          color: color || targetHabit.color,
          icon: resolvedIcon,
          quickIncrements: resolvedQuickIncrements,
          quickDecrement: resolvedQuickDecrements,
        };

        context.actions.updateHabit(updatedHabit);

        const summary = describeAction(tc, context.language, { habits: context.habits });
        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم تعديل العادة بنجاح: ${summary}`
            : `Updated habit successfully: ${summary}`,
          success: true,
          data: updatedHabit,
        });
      } else if (tc.name === "update_bad_habit") {
        const badHabitId = tc.args["badHabitId"] ? String(tc.args["badHabitId"]).trim() : "";
        const badHabitName = tc.args["badHabitName"] ? String(tc.args["badHabitName"]).trim() : "";
        const newName = tc.args["name"] ? String(tc.args["name"]).trim() : undefined;
        const triggerCategory = tc.args["triggerCategory"]
          ? String(tc.args["triggerCategory"]).trim()
          : undefined;
        const limit = tc.args["limit"] !== undefined ? Number(tc.args["limit"]) : undefined;
        const color = tc.args["color"] ? String(tc.args["color"]).trim() : undefined;
        const iconRaw = tc.args["icon"] ? String(tc.args["icon"]).trim() : undefined;

        const targetBadHabit = (context.badHabits || []).find((b) => {
          if (badHabitId && b.id === badHabitId) return true;
          if (badHabitName && b.title.toLowerCase() === badHabitName.toLowerCase()) return true;
          if (newName && b.title.toLowerCase() === newName.toLowerCase()) return true;
          return false;
        });

        if (!targetBadHabit) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `فشل: لم يتم العثور على متتبع الإقلاع المراد تعديله (${badHabitName || badHabitId || "غير محدد"})`
              : `Failed: Quit tracker to update not found (${badHabitName || badHabitId || "unspecified"})`,
            success: false,
          });
          continue;
        }

        let resolvedIcon = targetBadHabit.icon;
        if (iconRaw) {
          const resolved = resolveIconName(iconRaw);
          if (hasLucideIcon(resolved)) {
            resolvedIcon = resolved;
          }
        }

        const updatedBadHabit: BadHabit = {
          ...targetBadHabit,
          title: newName || targetBadHabit.title,
          triggerCategory:
            triggerCategory !== undefined ? triggerCategory : targetBadHabit.triggerCategory,
          limitValue: limit !== undefined && !isNaN(limit) ? limit : targetBadHabit.limitValue,
          strategy: limit !== undefined && !isNaN(limit) ? "limit" : targetBadHabit.strategy,
          color: color || targetBadHabit.color,
          icon: resolvedIcon,
        };

        context.actions.upsertBadHabit(updatedBadHabit);

        const summary = describeAction(tc, context.language, { badHabits: context.badHabits });
        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم تعديل متتبع الإقلاع بنجاح: ${summary}`
            : `Updated quit tracker successfully: ${summary}`,
          success: true,
          data: updatedBadHabit,
        });
      } else if (tc.name === "update_goal") {
        const goalId = tc.args["goalId"] ? String(tc.args["goalId"]).trim() : "";
        const goalName = tc.args["goalName"] ? String(tc.args["goalName"]).trim() : "";
        const newName = tc.args["name"] ? String(tc.args["name"]).trim() : undefined;
        const targetValue =
          tc.args["targetValue"] !== undefined ? Number(tc.args["targetValue"]) : undefined;
        const unit = tc.args["unit"] !== undefined ? String(tc.args["unit"]).trim() : undefined;
        const color = tc.args["color"] ? String(tc.args["color"]).trim() : undefined;
        const iconRaw = tc.args["icon"] ? String(tc.args["icon"]).trim() : undefined;

        const targetGoal = context.goals.find((g) => {
          if (goalId && g.id === goalId) return true;
          if (goalName && g.name.toLowerCase() === goalName.toLowerCase()) return true;
          if (newName && g.name.toLowerCase() === newName.toLowerCase()) return true;
          return false;
        });

        if (!targetGoal) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `فشل: لم يتم العثور على الهدف المراد تعديله (${goalName || goalId || "غير محدد"})`
              : `Failed: Goal to update not found (${goalName || goalId || "unspecified"})`,
            success: false,
          });
          continue;
        }

        let resolvedIcon = targetGoal.icon;
        if (iconRaw) {
          const resolved = resolveIconName(iconRaw);
          if (hasLucideIcon(resolved)) {
            resolvedIcon = resolved;
          }
        }

        const updatedGoal: Goal = {
          ...targetGoal,
          name: newName || targetGoal.name,
          targetValue:
            targetValue !== undefined && !isNaN(targetValue) ? targetValue : targetGoal.targetValue,
          unit: unit !== undefined ? unit : targetGoal.unit,
          color: color || targetGoal.color,
          icon: resolvedIcon,
        };

        context.actions.upsertGoal(updatedGoal);

        const summary = describeAction(tc, context.language, { goals: context.goals });
        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم تعديل الهدف بنجاح: ${summary}`
            : `Updated goal successfully: ${summary}`,
          success: true,
          data: updatedGoal,
        });
      } else if (tc.name === "update_routine") {
        const routineId = tc.args["routineId"] ? String(tc.args["routineId"]).trim() : "";
        const routineName = tc.args["routineName"] ? String(tc.args["routineName"]).trim() : "";
        const newName = tc.args["name"] ? String(tc.args["name"]).trim() : undefined;
        const scheduleRaw = tc.args["schedule"]
          ? String(tc.args["schedule"]).toLowerCase().trim()
          : undefined;
        const color = tc.args["color"] ? String(tc.args["color"]).trim() : undefined;
        const iconRaw = tc.args["icon"] ? String(tc.args["icon"]).trim() : undefined;

        const targetRoutine = (context.routines || []).find((r) => {
          if (routineId && r.id === routineId) return true;
          if (routineName && r.name.toLowerCase() === routineName.toLowerCase()) return true;
          if (newName && r.name.toLowerCase() === newName.toLowerCase()) return true;
          return false;
        });

        if (!targetRoutine) {
          results.push({
            toolName: tc.name,
            summary: isAr
              ? `فشل: لم يتم العثور على الروتين المراد تعديله (${routineName || routineId || "غير محدد"})`
              : `Failed: Routine to update not found (${routineName || routineId || "unspecified"})`,
            success: false,
          });
          continue;
        }

        let newSchedule: Schedule = targetRoutine.schedule;
        if (scheduleRaw === "everyday" || scheduleRaw === "daily") {
          newSchedule = { type: "daily" };
        } else if (scheduleRaw === "weekdays") {
          newSchedule = { type: "weekdays", days: [1, 2, 3, 4, 5] };
        } else if (scheduleRaw === "weekends") {
          newSchedule = { type: "weekdays", days: [0, 6] };
        }

        let resolvedIcon = targetRoutine.icon;
        if (iconRaw) {
          const resolved = resolveIconName(iconRaw);
          if (hasLucideIcon(resolved)) {
            resolvedIcon = resolved;
          }
        }

        let nextSteps = targetRoutine.steps;
        if (Array.isArray(tc.args["steps"])) {
          const rawSteps = tc.args["steps"] as Array<{ title?: string; habitName?: string }>;
          nextSteps = rawSteps.map((s) => {
            const stepTitle = String(s.title || "Step").trim();
            const linkedHabit = s.habitName
              ? context.habits.find(
                  (h) => h.name.toLowerCase() === String(s.habitName).toLowerCase(),
                )
              : undefined;
            return {
              id: uid(),
              title: stepTitle,
              habitId: linkedHabit?.id,
            };
          });
        }

        const updatedRoutine: Routine = {
          ...targetRoutine,
          name: newName || targetRoutine.name,
          schedule: newSchedule,
          color: color || targetRoutine.color,
          icon: resolvedIcon,
          steps: nextSteps,
        };

        context.actions.upsertRoutine(updatedRoutine);

        const summary = describeAction(tc, context.language, { routines: context.routines });
        results.push({
          toolName: tc.name,
          summary: isAr
            ? `تم تعديل الروتين بنجاح: ${summary}`
            : `Updated routine successfully: ${summary}`,
          success: true,
          data: updatedRoutine,
        });
      } else if (tc.name === "save_user_memory" || tc.name === "manage_user_memory") {
        const fact = String(tc.args["fact"] || "").trim();
        const action = String(tc.args["action"] || "add")
          .toLowerCase()
          .trim();

        if (action === "remove") {
          removeAiMemory(fact);
          results.push({
            toolName: tc.name,
            summary: isAr ? `🧠 نسي المساعد: ${fact}` : `🧠 Assistant forgot: ${fact}`,
            success: true,
            data: { fact, action: "remove" },
          });
        } else {
          saveAiMemory(fact);
          results.push({
            toolName: tc.name,
            summary: isAr ? `🧠 تذكر المساعد: ${fact}` : `🧠 Assistant remembered: ${fact}`,
            success: true,
            data: { fact, action: "add" },
          });
        }
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
