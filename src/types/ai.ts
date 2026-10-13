export type AiProvider = "gemini" | "groq";

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
    name: string;
    type: string;
    target: number;
    unit: string;
    schedule: string;
    isCompletedToday?: boolean;
    streak?: number;
  }>;
  goals: Array<{
    name: string;
    targetValue: number;
    currentValue: number;
    unit: string;
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
  color?: string;
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
