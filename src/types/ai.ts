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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallPayload[] | undefined;
  executionResults?: ToolExecutionResult[] | undefined;
  pendingActions?: PendingAction[] | undefined;
  providerUsed?: AiProvider | undefined;
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
  streak?: number | undefined;
  icon?: string | undefined;
  goalId?: string | undefined;
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
  analytics?: AiAnalyticsContext | undefined;
  language?: "en" | "ar" | undefined;
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

export interface GetAppSummaryArgs {
  query?: string | undefined;
}

export interface GetAnalyticsArgs {
  habitName?: string | undefined;
  timeRangeDays?: number | undefined;
}

/**
 * Tools that do not alter state and can be safely executed automatically.
 */
export const SAFE_READ_ONLY_TOOLS = ["get_app_summary", "get_analytics"] as const;
export type SafeReadOnlyTool = (typeof SAFE_READ_ONLY_TOOLS)[number];

export function isMutationTool(toolName: string): boolean {
  return !(SAFE_READ_ONLY_TOOLS as readonly string[]).includes(toolName);
}
