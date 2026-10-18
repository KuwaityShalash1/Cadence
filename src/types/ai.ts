export type AiProvider = "gemini" | "groq" | "error";

export interface ToolCallPayload {
  id?: string | undefined;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  summary: string;
  success: boolean;
  data?: unknown | undefined;
}

export type ActionApprovalStatus = "pending" | "approved" | "cancelled";

export interface PendingAction {
  id: string;
  toolCall: ToolCallPayload;
  status: ActionApprovalStatus;
  description: string;
  descriptionAr?: string | undefined;
  executionResult?: ToolExecutionResult | undefined;
  /** Whether this action is checked in the batch approval UI (default: true). */
  checked?: boolean | undefined;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallPayload[] | undefined;
  executionResults?: ToolExecutionResult[] | undefined;
  pendingActions?: PendingAction[] | undefined;
  providerUsed?: AiProvider | undefined;
  /** Chain-of-thought reasoning extracted from <think>...</think> tags. */
  reasoning?: string | undefined;
  timestamp: number;
}

export interface AiHabitContext {
  id?: string | undefined;
  name: string;
  type: string;
  target: number;
  unit: string;
  schedule: string;
  isCompletedToday?: boolean | undefined;
  /** Current logged value for today (for quantitative habits). */
  currentValue?: number | undefined;
  streak?: number | undefined;
  icon?: string | undefined;
  goalId?: string | undefined;
  /** Number of days completed in the last 7 days (0-7). */
  last7DaysCompleted?: number | undefined;
  /** 7-day completion rate (0-1). */
  completionRate7d?: number | undefined;
}

export interface AiGoalContext {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

export interface AiBadHabitContext {
  id?: string | undefined;
  name: string;
  strategy?: string | undefined;
  limitValue?: number | undefined;
  daysClean?: number | undefined;
  /** Recent relapse triggers or reasons (up to last 3). */
  recentTriggers?: string[] | undefined;
  lastRelapseDate?: string | undefined;
}

export interface AiRoutineStepContext {
  id: string;
  title: string;
  habitId?: string | undefined;
}

export interface AiRoutineContext {
  id: string;
  name: string;
  schedule?: string | undefined;
  steps: AiRoutineStepContext[];
}

export interface AiAnalyticsContext {
  overallConsistencyScore?: number | undefined;
  habitPerformance?:
    | Array<{
        id: string;
        name: string;
        currentStreak: number;
        bestStreak: number;
        completionRate30d: number;
        totalCompletions: number;
      }>
    | undefined;
}

export interface AiAppContext {
  habits: AiHabitContext[];
  goals: AiGoalContext[];
  badHabits?: AiBadHabitContext[] | undefined;
  routines?: AiRoutineContext[] | undefined;
  analytics?: AiAnalyticsContext | undefined;
  /** Persistent facts and preferences remembered about the user. */
  aiMemories?: string[] | undefined;
  language?: "en" | "ar" | undefined;
  /** User's current local hour (0-23) for coaching context. */
  localHour?: number | undefined;
  /** Overall completion rate today (0–1) across all habits. */
  todayCompletionRate?: number | undefined;
}

export interface AiRequestBody {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  context?: AiAppContext | undefined;
}

export interface AiResponsePayload {
  text: string;
  toolCalls?: ToolCallPayload[] | undefined;
  providerUsed: AiProvider;
  /** Chain-of-thought reasoning stripped from the AI response (if present). */
  reasoning?: string | undefined;
}

export interface CreateHabitArgs {
  name: string;
  schedule: "everyday" | "weekdays" | "weekends";
  color?: string | undefined;
  icon?: string | undefined;
  goalId?: string | undefined;
}

export interface CreateBadHabitArgs {
  name: string;
  triggerCategory?: string | undefined;
  limit?: number | undefined;
}

export interface CreateGoalArgs {
  name: string;
  targetValue: number;
  unit?: string | undefined;
}

export interface DeleteHabitArgs {
  habitId?: string | undefined;
  habitName?: string | undefined;
}

export interface DeleteBadHabitArgs {
  badHabitId?: string | undefined;
  badHabitName?: string | undefined;
}

export interface DeleteGoalArgs {
  goalId?: string | undefined;
  goalName?: string | undefined;
}

export interface LogHabitArgs {
  habitName: string;
  status: "done" | "skipped";
}

/** Args for the log_habit_progress quantitative tool. */
export interface LogHabitProgressArgs {
  /** Habit ID or name to log progress for. */
  habitId?: string | undefined;
  habitName?: string | undefined;
  /** Amount to log (in the habit's base unit, after conversion). */
  amount: number;
  /** 'increment': add amount to current value; 'set': set current value directly. */
  mode: "increment" | "set";
}

export interface CreateRoutineArgs {
  name: string;
  schedule?: string | undefined;
  timeOfDay?: string | undefined;
  habitNames?: string[] | undefined;
  habitIds?: string[] | undefined;
  steps?: Array<{ title: string; habitName?: string; habitId?: string }> | undefined;
}

export interface DeleteRoutineArgs {
  routineId?: string | undefined;
  routineName?: string | undefined;
}

export interface ClearAllDataArgs {
  sections: Array<"habits" | "bad_habits" | "goals" | "routines" | "all">;
}

export interface BatchOperationsArgs {
  operations: Array<{
    actionType: string;
    payload: Record<string, unknown>;
  }>;
}

export interface GetAppSummaryArgs {
  query?: string | undefined;
}

export interface GetAnalyticsArgs {
  habitName?: string | undefined;
  timeRangeDays?: number | undefined;
}

export interface UpdateHabitArgs {
  habitId?: string | undefined;
  habitName?: string | undefined;
  name?: string | undefined;
  schedule?: "everyday" | "weekdays" | "weekends" | undefined;
  targetValue?: number | undefined;
  unit?: string | undefined;
  color?: string | undefined;
  icon?: string | undefined;
}

export interface UpdateBadHabitArgs {
  badHabitId?: string | undefined;
  badHabitName?: string | undefined;
  name?: string | undefined;
  triggerCategory?: string | undefined;
  limit?: number | undefined;
  color?: string | undefined;
  icon?: string | undefined;
}

export interface UpdateGoalArgs {
  goalId?: string | undefined;
  goalName?: string | undefined;
  name?: string | undefined;
  targetValue?: number | undefined;
  unit?: string | undefined;
  color?: string | undefined;
  icon?: string | undefined;
}

export interface UpdateRoutineArgs {
  routineId?: string | undefined;
  routineName?: string | undefined;
  name?: string | undefined;
  schedule?: "everyday" | "weekdays" | "weekends" | undefined;
  color?: string | undefined;
  icon?: string | undefined;
  habitNames?: string[] | undefined;
  steps?: Array<{ title: string; habitName?: string }> | undefined;
}

export interface ManageUserMemoryArgs {
  action?: "add" | "remove" | undefined;
  fact: string;
}

export interface SaveUserMemoryArgs {
  fact: string;
}

/**
 * Tools that do not alter state or are safe background utilities (like memory)
 * and can be executed automatically without blocking the user for approval.
 */
export const SAFE_READ_ONLY_TOOLS = [
  "get_app_summary",
  "get_analytics",
  "save_user_memory",
  "manage_user_memory",
] as const;
export type SafeReadOnlyTool = (typeof SAFE_READ_ONLY_TOOLS)[number];

export function isMutationTool(toolName: string): boolean {
  return !(SAFE_READ_ONLY_TOOLS as readonly string[]).includes(toolName);
}
