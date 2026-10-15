import type { AiRequestBody, AiResponsePayload, ToolCallPayload } from "../../types/ai";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY?: string;
      GROQ_API_KEY?: string;
      AI_EXECUTION_STRATEGY?: string;
      AI_PROVIDER?: string;
    }
  }
}

/**
 * Unified tool declarations for Google Gemini.
 */
const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_habit",
        description:
          "Create a new habit in Cadence with name, recurrence schedule, dynamic icon from lucide-react, optional color theme, and optional linked goal ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description:
                "The title or name of the habit (e.g., 'Drink 2L Water', 'Morning Meditation').",
            },
            schedule: {
              type: "STRING",
              enum: ["everyday", "weekdays", "weekends"],
              description:
                "Recurrence frequency: 'everyday' for all 7 days, 'weekdays' for Mon-Fri, 'weekends' for Sat-Sun.",
            },
            color: {
              type: "STRING",
              description:
                "Optional color token for the habit (e.g., 'emerald', 'teal', 'violet', 'amber', 'rose').",
            },
            icon: {
              type: "STRING",
              description:
                "Highly relevant icon name from the `lucide-react` icon library (e.g., 'Dumbbell' for workouts, 'Droplet' for water, 'BookOpen' for reading, 'Briefcase' for work). Return the exact PascalCase component name as a string.",
            },
            goalId: {
              type: "STRING",
              description:
                "Optional goal ID to link this habit to. Use this if the user asks to link the habit to a specific goal, or if it makes logical sense based on the get_app_summary context.",
            },
          },
          required: ["name", "schedule"],
        },
      },
      {
        name: "create_bad_habit",
        description:
          "Create a new bad habit / quit tracker in Cadence when the user wants to STOP, QUIT, REDUCE, or BREAK a negative behavior (e.g., smoking, gossiping, biting nails, doomscrolling).",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description:
                "The name or title of the bad habit to stop or quit (e.g., 'Stop Gossiping', 'Quit Smoking', 'Reduce Doomscrolling').",
            },
            triggerCategory: {
              type: "STRING",
              description:
                "Optional primary trigger category (e.g., 'stress', 'boredom', 'social', 'digital', 'custom').",
            },
            limit: {
              type: "NUMBER",
              description:
                "Optional daily limit number for moderation or reduction. Omit for complete cessation (cold turkey).",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "create_goal",
        description:
          "Create a new target goal in Cadence with name, target value, and optional unit.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description: "The name of the goal (e.g., 'Read 12 Books', 'Run 100km').",
            },
            targetValue: {
              type: "NUMBER",
              description: "The target numerical value to reach (e.g., 12, 100).",
            },
            unit: {
              type: "STRING",
              description: "Optional unit of measurement (e.g., 'books', 'km', 'hours').",
            },
          },
          required: ["name", "targetValue"],
        },
      },
      {
        name: "log_habit",
        description: "Mark or log a habit as completed ('done') or skipped ('skipped') for today.",
        parameters: {
          type: "OBJECT",
          properties: {
            habitName: {
              type: "STRING",
              description: "The name of the habit to mark (e.g., 'Drink 2L Water').",
            },
            status: {
              type: "STRING",
              enum: ["done", "skipped"],
              description: "Whether the habit was completed ('done') or skipped ('skipped').",
            },
          },
          required: ["habitName", "status"],
        },
      },
      {
        name: "get_app_summary",
        description:
          "Retrieve a summary of current active habits and goals to answer questions about progress or today's schedule.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "Aspect to summarize: e.g. 'today_habits', 'goals_progress', or 'all'.",
            },
          },
        },
      },
      {
        name: "delete_habit",
        description:
          "Permanently delete or remove an existing habit by name or ID. Propose this when the user asks to remove/delete a habit, or when recommending dropping a dead, obsolete, or unsustainable habit.",
        parameters: {
          type: "OBJECT",
          properties: {
            habitId: {
              type: "STRING",
              description: "Optional exact ID of the habit to delete.",
            },
            habitName: {
              type: "STRING",
              description: "The name or title of the habit to delete (e.g., 'Drink 2L Water').",
            },
          },
        },
      },
      {
        name: "delete_bad_habit",
        description:
          "Permanently delete or remove an existing bad habit / quit tracker by name or ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            badHabitId: {
              type: "STRING",
              description: "Optional exact ID of the bad habit/quit tracker to delete.",
            },
            badHabitName: {
              type: "STRING",
              description: "The name or title of the bad habit to delete (e.g., 'Smoking').",
            },
          },
        },
      },
      {
        name: "delete_goal",
        description: "Permanently delete or remove an existing target goal by name or ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            goalId: {
              type: "STRING",
              description: "Optional exact ID of the goal to delete.",
            },
            goalName: {
              type: "STRING",
              description: "The name or title of the goal to delete (e.g., 'Read 12 Books').",
            },
          },
        },
      },
      {
        name: "get_analytics",
        description:
          "Retrieve deep habit analytics, consistency scores, current streaks, best streaks, and 30-day completion rates to give smart habit coaching advice and spot patterns.",
        parameters: {
          type: "OBJECT",
          properties: {
            habitName: {
              type: "STRING",
              description:
                "Optional specific habit name to retrieve detailed metrics for. Leave empty to analyze all habits.",
            },
            timeRangeDays: {
              type: "NUMBER",
              description: "Time range in days for analytics calculation (defaults to 30).",
            },
          },
        },
      },
    ],
  },
];

/**
 * Unified tool declarations for Groq (OpenAI-compatible tool format).
 */
const GROQ_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_habit",
      description:
        "Create a new habit in Cadence with name, recurrence schedule, dynamic icon from lucide-react, optional color theme, and optional linked goal ID.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "The title or name of the habit (e.g., 'Drink 2L Water', 'Morning Meditation').",
          },
          schedule: {
            type: "string",
            enum: ["everyday", "weekdays", "weekends"],
            description:
              "Recurrence frequency: 'everyday' for all 7 days, 'weekdays' for Mon-Fri, 'weekends' for Sat-Sun.",
          },
          color: {
            type: "string",
            description:
              "Optional color token for the habit (e.g., 'emerald', 'teal', 'violet', 'amber', 'rose').",
          },
          icon: {
            type: "string",
            description:
              "Highly relevant icon name from the `lucide-react` icon library (e.g., 'Dumbbell' for workouts, 'Droplet' for water, 'BookOpen' for reading, 'Briefcase' for work). Return the exact PascalCase component name as a string.",
          },
          goalId: {
            type: "string",
            description:
              "Optional goal ID to link this habit to. Use this if the user asks to link the habit to a specific goal, or if it makes logical sense based on the get_app_summary context.",
          },
        },
        required: ["name", "schedule"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bad_habit",
      description:
        "Create a new bad habit / quit tracker in Cadence when the user wants to STOP, QUIT, REDUCE, or BREAK a negative behavior (e.g., smoking, gossiping, biting nails, doomscrolling).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "The name or title of the bad habit to stop or quit (e.g., 'Stop Gossiping', 'Quit Smoking', 'Reduce Doomscrolling').",
          },
          triggerCategory: {
            type: "string",
            description:
              "Optional primary trigger category (e.g., 'stress', 'boredom', 'social', 'digital', 'custom').",
          },
          limit: {
            type: "number",
            description:
              "Optional daily limit number for moderation or reduction. Omit for complete cessation (cold turkey).",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal",
      description:
        "Create a new target goal in Cadence with name, target value, and optional unit.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the goal (e.g., 'Read 12 Books', 'Run 100km').",
          },
          targetValue: {
            type: "number",
            description: "The target numerical value to reach (e.g., 12, 100).",
          },
          unit: {
            type: "string",
            description: "Optional unit of measurement (e.g., 'books', 'km', 'hours').",
          },
        },
        required: ["name", "targetValue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_habit",
      description: "Mark or log a habit as completed ('done') or skipped ('skipped') for today.",
      parameters: {
        type: "object",
        properties: {
          habitName: {
            type: "string",
            description: "The name of the habit to mark (e.g., 'Drink 2L Water').",
          },
          status: {
            type: "string",
            enum: ["done", "skipped"],
            description: "Whether the habit was completed ('done') or skipped ('skipped').",
          },
        },
        required: ["habitName", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_app_summary",
      description:
        "Retrieve a summary of current active habits and goals to answer questions about progress or today's schedule.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Aspect to summarize: e.g. 'today_habits', 'goals_progress', or 'all'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_habit",
      description:
        "Permanently delete or remove an existing habit by name or ID. Propose this when the user asks to remove/delete a habit, or when recommending dropping a dead, obsolete, or unsustainable habit.",
      parameters: {
        type: "object",
        properties: {
          habitId: {
            type: "string",
            description: "Optional exact ID of the habit to delete.",
          },
          habitName: {
            type: "string",
            description: "The name or title of the habit to delete (e.g., 'Drink 2L Water').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_bad_habit",
      description:
        "Permanently delete or remove an existing bad habit / quit tracker by name or ID from Cadence.",
      parameters: {
        type: "object",
        properties: {
          badHabitId: {
            type: "string",
            description: "Optional exact ID of the bad habit/quit tracker to delete.",
          },
          badHabitName: {
            type: "string",
            description: "The name or title of the bad habit to delete (e.g., 'Smoking').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_goal",
      description: "Permanently delete or remove an existing target goal by name or ID.",
      parameters: {
        type: "object",
        properties: {
          goalId: {
            type: "string",
            description: "Optional exact ID of the goal to delete.",
          },
          goalName: {
            type: "string",
            description: "The name or title of the goal to delete (e.g., 'Read 12 Books').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analytics",
      description:
        "Retrieve deep habit analytics, consistency scores, current streaks, best streaks, and 30-day completion rates to give smart habit coaching advice and spot patterns.",
      parameters: {
        type: "object",
        properties: {
          habitName: {
            type: "string",
            description:
              "Optional specific habit name to retrieve detailed metrics for. Leave empty to analyze all habits.",
          },
          timeRangeDays: {
            type: "number",
            description: "Time range in days for analytics calculation (defaults to 30).",
          },
        },
      },
    },
  },
];

/**
 * Builds the system prompt injecting current application context (habits, goals, date, analytics).
 */
function buildSystemPrompt(body: AiRequestBody): string {
  const habitsContext = body.context?.habits
    ? body.context.habits
        .map(
          (h) =>
            `- [ID: "${h.id || ""}"] ${h.name} (${h.schedule}, ${h.isCompletedToday ? "completed today" : "pending today"}, streak: ${h.streak ?? 0}${h.icon ? `, icon: ${h.icon}` : ""}${h.goalId ? `, linkedGoalId: ${h.goalId}` : ""})`,
        )
        .join("\n")
    : "No habits tracked yet.";

  const goalsContext = body.context?.goals
    ? body.context.goals
        .map(
          (g) =>
            `- [ID: "${g.id}"] "${g.name}" (${g.currentValue}/${g.targetValue} ${g.unit || ""})`,
        )
        .join("\n")
    : "No goals tracked yet.";

  const badHabitsContext =
    body.context?.badHabits && body.context.badHabits.length > 0
      ? body.context.badHabits
          .map(
            (bh) =>
              `- [ID: "${bh.id || ""}"] "${bh.name}" (${bh.strategy === "limit" ? `limit: ${bh.limitValue ?? "custom"}` : "cold-turkey (abstinence)"}, ${bh.daysClean ?? 0} days clean)`,
          )
          .join("\n")
      : "No quit trackers recorded yet.";

  const analyticsContext = body.context?.analytics?.habitPerformance
    ? [
        `Overall Consistency Score: ${Math.round((body.context.analytics.overallConsistencyScore ?? 0) * 100)}%`,
        "Habit Performance Breakdown (last 30 days):",
        ...body.context.analytics.habitPerformance.map(
          (p) =>
            `- "${p.name}": Streak ${p.currentStreak}d (Best: ${p.bestStreak}d), 30-day Completion Rate: ${Math.round(p.completionRate30d * 100)}%, Total Completed: ${p.totalCompletions}`,
        ),
      ].join("\n")
    : "Call the `get_analytics` tool to retrieve live streaks, completion rates, and historical data.";

  return `You are Cadence AI Assistant, a highly intelligent, proactive habit coach and personal growth strategist for the Cadence habit tracker app.
Cadence is an offline-first, minimalist habit tracker designed to help users build routines, track goals, and stay consistent effortlessly. It also includes a dedicated Quit Tracker section for breaking unwanted vices and negative behaviors.

You seamlessly support both English and Arabic. When the user speaks Arabic, reply in Arabic. When the user speaks English, reply in English.
Keep your responses minimalist, warm, actionable, and free of fluff.

COACHING PHILOSOPHY & PROACTIVE AGENT BEHAVIOR:
When the user asks you to manage their habits, or if you notice a bad pattern, propose changes using your tools. You are a habit coach.
Be proactive, analytical, and opinionated:
- Do NOT be a passive chatbot that only answers when directly instructed. Proactively diagnose problems, spot patterns, celebrate winning streaks, and identify struggling routines.
- Call \`get_analytics\` whenever you need deeper metrics on consistency, streaks, or completion rates to offer evidence-backed coaching.
- HUMAN-IN-THE-LOOP APPROVAL WORKFLOW:
  Cadence enforces a strict Human-in-the-Loop workflow. When you call ANY mutation tool (create_habit, delete_habit, create_bad_habit, delete_bad_habit, create_goal, delete_goal, log_habit), the mutation is NOT executed immediately. Instead, a rich UI card with "Approve & Apply" and "Cancel" buttons is shown to the user in chat.
  Because the user must explicitly approve mutations, feel completely free to be proactive! If a habit has a 0% completion rate or is causing burnout, recommend deleting or modifying it. If a user achieves a goal, propose setting a new target or cleaning up.

CURRENT USER CONTEXT:
Habits:
${habitsContext}

Goals:
${goalsContext}

Quit Trackers (Bad Habits):
${badHabitsContext}

Analytics & Consistency:
${analyticsContext}

IMPORTANT HABIT VS QUIT TRACKER RULE:
If the user wants to start doing something positive (e.g., read, workout, study), use the \`create_habit\` tool. However, if the user wants to STOP, QUIT, REDUCE, or BREAK a negative behavior (e.g., smoking, gossiping, biting nails, doomscrolling), you MUST use the \`create_bad_habit\` tool instead.

AVAILABLE ACTIONS (FUNCTION CALLS):
1. create_habit: Propose creating a new positive habit routine.
   - When creating a habit, ALWAYS select a highly relevant PascalCase icon name from \`lucide-react\` (e.g., 'Dumbbell', 'Droplet', 'BookOpen', 'Briefcase', 'Heart', 'Sun').
   - Intelligently link habits to existing goals by providing \`goalId\` if applicable.
   - Args: name (string, req), schedule ("everyday" | "weekdays" | "weekends", req), color (string, opt), icon (string, opt), goalId (string, opt).
2. delete_habit: Propose deleting an existing habit that the user wants to remove or that is obsolete/stale.
   - Args: habitId (string, opt), habitName (string, opt).
3. create_bad_habit: Propose creating a quit tracker entry to stop or reduce a vice or unwanted behavior.
   - Args: name (string, req), triggerCategory (string, opt), limit (number, opt).
4. delete_bad_habit: Propose deleting a quit tracker / bad habit.
   - Args: badHabitId (string, opt), badHabitName (string, opt).
5. create_goal: Propose creating a target milestone goal.
   - Args: name (string, req), targetValue (number, req), unit (string, opt).
6. delete_goal: Propose deleting an existing goal.
   - Args: goalId (string, opt), goalName (string, opt).
7. log_habit: Propose marking a habit as completed ('done') or skipped ('skipped') for today.
   - Args: habitName (string, req), status ("done" | "skipped", req).
8. get_analytics: Retrieve deep streaks, completion rates, and consistency statistics for smart advice.
   - Args: habitName (string, opt), timeRangeDays (number, opt).
9. get_app_summary: Retrieve an overview summary of current habits and goals.
   - Args: query (string, opt).

When you execute or propose a tool call, accompany it with a short, encouraging, and helpful explanation of your rationale.`;
}

/**
 * Default timeout budgets to guarantee execution finishes comfortably within
 * Vercel Serverless Function limits (10s default / 30s configured).
 */
const DEFAULT_GEMINI_TIMEOUT_MS = 2500;
const DEFAULT_GROQ_TIMEOUT_MS = 8000;

/**
 * Strips accidental wrapping quotes or leading/trailing whitespace from environment variables.
 */
function cleanApiKey(key?: string): string {
  if (!key) return "";
  return key
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * Primary Provider: Google Gemini
 */
async function callGemini(
  body: AiRequestBody,
  geminiKey: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<AiResponsePayload> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const systemInstructionText = buildSystemPrompt(body);

  const contents = body.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Production-available fast Gemini models:
  const models = ["gemini-3.5-flash", "gemini-flash-latest"];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortListener = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error("Gemini invocation aborted");
    }
    options.signal.addEventListener("abort", abortListener, { once: true });
  }

  let lastError: unknown = null;

  try {
    for (const model of models) {
      if (controller.signal.aborted || options?.signal?.aborted) {
        throw new Error(`Gemini request aborted or timed out after ${timeoutMs}ms`);
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents,
              systemInstruction: {
                parts: [{ text: systemInstructionText }],
              },
              tools: GEMINI_TOOLS,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini [${model}] HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
                functionCall?: {
                  name: string;
                  args: Record<string, unknown>;
                };
              }>;
            };
          }>;
        };

        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts) {
          throw new Error(`Gemini [${model}] returned empty candidates`);
        }

        let text = "";
        const toolCalls: ToolCallPayload[] = [];

        for (const part of candidate.content.parts) {
          if (part.text) {
            text += part.text;
          }
          if (part.functionCall) {
            toolCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
        }

        return {
          text: text.trim(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          providerUsed: "gemini",
        };
      } catch (err: unknown) {
        lastError = err;
        if (controller.signal.aborted || options?.signal?.aborted) {
          break;
        }
        // If model-specific failure, continue to next candidate model
        continue;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener("abort", abortListener);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Gemini invocation failed"));
}

/**
 * Fallback Provider: Groq (OpenAI-compatible completions endpoint)
 */
async function callGroq(
  body: AiRequestBody,
  groqKey: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<AiResponsePayload> {
  if (!groqKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured");
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_GROQ_TIMEOUT_MS;
  const systemPrompt = buildSystemPrompt(body);

  const messages = [
    { role: "system", content: systemPrompt },
    ...body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // High-performance active Groq models with verified sub-500ms latency and tool calling:
  const models = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortListener = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error("Groq invocation aborted");
    }
    options.signal.addEventListener("abort", abortListener, { once: true });
  }

  let lastError: unknown = null;

  try {
    for (const model of models) {
      if (controller.signal.aborted || options?.signal?.aborted) {
        throw new Error(`Groq request aborted or timed out after ${timeoutMs}ms`);
      }

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            tools: GROQ_TOOLS,
            tool_choice: "auto",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq [${model}] HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{
                id?: string;
                function: {
                  name: string;
                  arguments: string;
                };
              }>;
            };
          }>;
        };

        const choice = data.choices?.[0];
        if (!choice?.message) {
          throw new Error(`Groq [${model}] returned empty response choice`);
        }

        let text = choice.message.content || "";
        // Strip any internal reasoning tags if present
        text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        const toolCalls: ToolCallPayload[] = [];
        if (choice.message.tool_calls) {
          for (const tc of choice.message.tool_calls) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments);
            } catch {
              parsedArgs = {};
            }
            const payload: ToolCallPayload = {
              name: tc.function.name,
              args: parsedArgs,
            };
            if (tc.id !== undefined) {
              payload.id = tc.id;
            }
            toolCalls.push(payload);
          }
        }

        return {
          text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          providerUsed: "groq",
        };
      } catch (err: unknown) {
        lastError = err;
        if (controller.signal.aborted || options?.signal?.aborted) {
          break;
        }
        continue;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener("abort", abortListener);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Groq invocation failed"));
}

/**
 * Main AI Request Handler implementing resilient serverless dual-provider orchestration.
 *
 * Supported execution strategies via AI_EXECUTION_STRATEGY or AI_PROVIDER:
 * - 'parallel' (default): Fires Gemini & Groq simultaneously via Promise.any. The fastest successful
 *   response wins, and the slower pending call is aborted immediately. Zero fallback latency penalty!
 * - 'fallback' / 'sequential': Tries Gemini with a strict 2.0s fast-fail timeout. If it fails or times
 *   out, immediately delegates to Groq with the remaining time budget.
 * - 'groq' / 'groq-only': Completely bypasses Gemini and calls Groq exclusively (with 8.5s timeout).
 * - 'gemini' / 'gemini-only': Exclusively calls Gemini.
 */
export async function handleAiRequest(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: AiRequestBody;
    try {
      body = (await request.json()) as AiRequestBody;
    } catch (parseErr) {
      throw new Error(
        `Failed to parse JSON request body: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("Invalid request body: 'messages' array is required and must not be empty");
    }

    const geminiApiKey = cleanApiKey(process.env.GEMINI_API_KEY);
    const groqApiKey = cleanApiKey(process.env.GROQ_API_KEY);

    const strategy = (
      process.env["AI_EXECUTION_STRATEGY"] ||
      process.env["AI_PROVIDER"] ||
      "parallel"
    ).toLowerCase();

    let result: AiResponsePayload | null = null;
    let lastError: unknown = null;

    // 1. Exclusive Groq mode or only Groq key configured
    if (strategy === "groq" || strategy === "groq-only" || (!geminiApiKey && groqApiKey)) {
      try {
        result = await callGroq(body, groqApiKey, { timeoutMs: 8500 });
      } catch (err) {
        lastError = err;
        console.error("[AI Provider] Groq exclusive execution failed:", err);
      }
    }
    // 2. Exclusive Gemini mode or only Gemini key configured
    else if (strategy === "gemini" || strategy === "gemini-only" || (geminiApiKey && !groqApiKey)) {
      try {
        result = await callGemini(body, geminiApiKey, { timeoutMs: 8500 });
      } catch (err) {
        lastError = err;
        console.error("[AI Provider] Gemini exclusive execution failed:", err);
      }
    }
    // 3. Fast-Fail Sequential Fallback mode
    else if (strategy === "fallback" || strategy === "sequential") {
      try {
        // Primary: Fast-Failing Gemini (max 2000ms to guarantee ample budget for fallback)
        result = await callGemini(body, geminiApiKey, { timeoutMs: 2000 });
      } catch (geminiErr) {
        console.warn(
          "[AI Provider] Gemini fast-fail (<2000ms), immediately delegating to Groq fallback:",
          geminiErr instanceof Error ? geminiErr.message : geminiErr,
        );
        try {
          // Fallback: Groq with generous remaining budget
          result = await callGroq(body, groqApiKey, { timeoutMs: 7000 });
        } catch (groqErr) {
          lastError = groqErr;
          console.error("[AI Provider] Both Gemini and Groq fallback failed:", groqErr);
        }
      }
    }
    // 4. Default: Speculative Parallel Execution (Promise.any)
    // Fires both simultaneously; fastest successful response wins and aborts the other request.
    else if (geminiApiKey && groqApiKey) {
      const cancelOtherController = new AbortController();

      const geminiPromise = callGemini(body, geminiApiKey, {
        timeoutMs: 3000,
        signal: cancelOtherController.signal,
      });

      const groqPromise = callGroq(body, groqApiKey, {
        timeoutMs: 8000,
        signal: cancelOtherController.signal,
      });

      try {
        result = await Promise.any([groqPromise, geminiPromise]);
        // Immediately abort the slower pending request to save serverless resources
        cancelOtherController.abort();
      } catch (aggregateErr) {
        lastError = aggregateErr;
        console.error(
          "[AI Provider] Both Gemini and Groq parallel executions failed:",
          aggregateErr,
        );
      }
    } else {
      throw new Error(
        "No AI provider keys configured on server. Please set GEMINI_API_KEY or GROQ_API_KEY in Vercel Environment Variables.",
      );
    }

    if (!result) {
      throw lastError instanceof Error
        ? lastError
        : lastError instanceof AggregateError
          ? lastError
          : new Error(String(lastError || "All AI providers failed to return a response"));
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    console.error("[AI Provider] Critical unhandled backend error:", err);
    let errorMessage = err instanceof Error ? err.message : String(err);
    if (err instanceof AggregateError) {
      errorMessage =
        "AggregateError: " +
        err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join(" | ");
    }

    return new Response(
      JSON.stringify({
        text: `🚨 CRITICAL BACKEND ERROR 🚨\n\n${errorMessage}`,
        providerUsed: "error",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}
