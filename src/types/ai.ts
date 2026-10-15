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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallPayload[] | undefined;
  executionResults?: ToolExecutionResult[] | undefined;
  providerUsed?: AiProvider | undefined;
  timestamp: number;
}

export interface AiAppContext {
  habits: Array<{
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
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetValue: number;
    currentValue: number;
    unit: string;
  }>;
  badHabits?: Array<{
    id?: string | undefined;
    name: string;
    strategy?: string | undefined;
    limitValue?: number | undefined;
    daysClean?: number | undefined;
  }>;
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
  unit?: string;
}

export interface LogHabitArgs {
  habitName: string;
  status: "done" | "skipped";
}

export interface GetAppSummaryArgs {
  query?: string;
}
