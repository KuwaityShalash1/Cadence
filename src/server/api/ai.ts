import type { AiRequestBody, AiResponsePayload, ToolCallPayload } from "../../types/ai";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY?: string;
      GROQ_API_KEY?: string;
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
];

/**
 * Builds the system prompt injecting current application context (habits, goals, date).
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

  return `You are Cadence AI Assistant, a concise, intelligent, and resilient companion for the Cadence habit tracker app.
Cadence is an offline-first, minimalist habit tracker designed to help users build routines, track goals, and stay consistent effortlessly. It also includes a dedicated Quit Tracker section for breaking unwanted vices and negative behaviors.

You seamlessly support both English and Arabic. When the user speaks Arabic, reply in Arabic. When the user speaks English, reply in English.
Keep your responses minimalist, warm, actionable, and free of fluff.

CURRENT USER CONTEXT:
Habits:
${habitsContext}

Goals:
${goalsContext}

Quit Trackers (Bad Habits):
${badHabitsContext}

IMPORTANT HABIT VS QUIT TRACKER RULE:
If the user wants to start doing something positive (e.g., read, workout, study), use the \`create_habit\` tool. However, if the user wants to STOP, QUIT, REDUCE, or BREAK a negative behavior (e.g., smoking, gossiping, biting nails, doomscrolling), you MUST use the \`create_bad_habit\` tool instead.

AVAILABLE ACTIONS (FUNCTION CALLS):
1. create_habit: Call when the user wants to build or start a POSITIVE routine or habit (e.g., 'Drink 2L Water', 'Morning Meditation', 'Workout').
   - Do NOT use this tool if the user wants to stop, quit, or reduce a bad behavior or vice. For any negative habit, use \`create_bad_habit\` instead.
   - When creating a habit, ALWAYS select a highly relevant icon name from the \`lucide-react\` icon library (e.g., 'Dumbbell' for workouts, 'Droplet' for water, 'BookOpen' for reading, 'Briefcase' for work). Return the exact PascalCase component name as a string.
   - Intelligently link habits to existing goals: If the user asks to link the habit to a specific goal, or if it makes logical sense based on the goals in context or the \`get_app_summary\` context, provide the matching goal's ID in the \`goalId\` argument.
   - Args:
     * name (string, required): Title or name of the habit.
     * schedule ("everyday" | "weekdays" | "weekends", required): Frequency schedule.
     * color (string, optional): Color theme token ('emerald', 'teal', 'violet', 'amber', 'rose').
     * icon (string, optional): PascalCase component name from \`lucide-react\` (e.g., 'Dumbbell', 'Droplet', 'BookOpen', 'Briefcase').
     * goalId (string, optional): ID of an existing goal to link this habit to.
2. create_bad_habit: Call when the user wants to STOP, QUIT, REDUCE, or BREAK a negative behavior or bad habit (e.g., smoking, gossiping, biting nails, doomscrolling, junk food). This logs the entry in Cadence's dedicated Quit Tracker section rather than the standard positive habits list.
   - Args:
     * name (string, required): Title or name of the bad habit to stop or quit (e.g., 'Stop Gossiping', 'Quit Smoking', 'Reduce Doomscrolling').
     * triggerCategory (string, optional): Optional primary trigger category (e.g., 'stress', 'boredom', 'social', 'digital', 'custom').
     * limit (number, optional): Optional daily numerical limit for moderation or gradual reduction. Omit for complete cessation (cold turkey).
3. create_goal: Call when the user wants to set a new goal with a target number.
   Args: name (string), targetValue (number), unit (optional string).
4. log_habit: Call when the user says they completed or skipped a habit today.
   Args: habitName (string), status ("done" | "skipped").
5. get_app_summary: Call when the user asks for an overview of their habits, quit trackers, or goals, or when you need to inspect existing goals and habits to make intelligent linking decisions.

When you execute a tool call, accompany it with a short, helpful explanation of what you are doing.`;
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
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required and must not be empty" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const geminiApiKey = cleanApiKey(process.env.GEMINI_API_KEY);
  const groqApiKey = cleanApiKey(process.env.GROQ_API_KEY);

  const strategy = (
    process.env.AI_EXECUTION_STRATEGY ||
    process.env.AI_PROVIDER ||
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
      console.error("[AI Provider] Both Gemini and Groq parallel executions failed:", aggregateErr);
    }
  } else {
    return new Response(
      JSON.stringify({
        error: "No AI provider keys configured. Please set GEMINI_API_KEY or GROQ_API_KEY.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!result) {
    const errorDetails =
      lastError instanceof AggregateError
        ? lastError.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ")
        : lastError instanceof Error
          ? lastError.message
          : String(lastError || "Unknown provider failure");

    return new Response(
      JSON.stringify({
        error: "AI service temporarily unavailable. Please try again shortly.",
        details: errorDetails,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
