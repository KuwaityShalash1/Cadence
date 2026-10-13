import fs from "node:fs";
import path from "node:path";
import type { AiRequestBody, AiResponsePayload, ToolCallPayload } from "../../types/ai";

/**
 * Loads API keys from process.env or falls back to reading .env.local / .env from disk.
 * Ensures secrets are never required to be bundled on the client side.
 */
function getApiKeys(): { geminiApiKey: string; groqApiKey: string } {
  let geminiApiKey = process.env["GEMINI_API_KEY"] || "";
  let groqApiKey = process.env["GROQ_API_KEY"] || "";

  if (!geminiApiKey || !groqApiKey) {
    try {
      const candidates = [
        path.resolve(process.cwd(), ".env.local"),
        path.resolve(process.cwd(), ".env"),
      ];
      for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const [k, ...vParts] = trimmed.split("=");
            const key = k?.trim();
            let val = vParts.join("=").trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            if (key === "GEMINI_API_KEY" && !geminiApiKey) geminiApiKey = val;
            if (key === "GROQ_API_KEY" && !groqApiKey) groqApiKey = val;
          }
        }
      }
    } catch {
      // Ignore file reading errors in serverless environments
    }
  }

  return { geminiApiKey, groqApiKey };
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
          "Create a new habit in Cadence with name, recurrence schedule, and optional color theme.",
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
          },
          required: ["name", "schedule"],
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
        "Create a new habit in Cadence with name, recurrence schedule, and optional color theme.",
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
        },
        required: ["name", "schedule"],
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
            `- ${h.name} (${h.schedule}, ${h.isCompletedToday ? "completed today" : "pending today"}, streak: ${h.streak ?? 0})`,
        )
        .join("\n")
    : "No habits tracked yet.";

  const goalsContext = body.context?.goals
    ? body.context.goals
        .map((g) => `- ${g.name} (${g.currentValue}/${g.targetValue} ${g.unit || ""})`)
        .join("\n")
    : "No goals tracked yet.";

  return `You are Cadence AI Assistant, a concise, intelligent, and resilient companion for the Cadence habit tracker app.
Cadence is an offline-first, minimalist habit tracker designed to help users build routines, track goals, and stay consistent effortlessly.

You seamlessly support both English and Arabic. When the user speaks Arabic, reply in Arabic. When the user speaks English, reply in English.
Keep your responses minimalist, warm, actionable, and free of fluff.

CURRENT USER CONTEXT:
Habits:
${habitsContext}

Goals:
${goalsContext}

AVAILABLE ACTIONS (FUNCTION CALLS):
1. create_habit: Call when the user wants to add or create a habit.
   Args: name (string), schedule ("everyday" | "weekdays" | "weekends"), color (optional).
2. create_goal: Call when the user wants to set a new goal with a target number.
   Args: name (string), targetValue (number), unit (optional string).
3. log_habit: Call when the user says they completed or skipped a habit today.
   Args: habitName (string), status ("done" | "skipped").
4. get_app_summary: Call when the user asks for an overview of their habits or goals.

When you execute a tool call, accompany it with a short, helpful explanation of what you are doing.`;
}

/**
 * Primary Provider: Google Gemini
 */
async function callGemini(body: AiRequestBody, geminiKey: string): Promise<AiResponsePayload> {
  const systemInstructionText = buildSystemPrompt(body);

  // Translate messages into Gemini format
  const contents = body.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Potential models in order of priority
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

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

      clearTimeout(timeoutId);

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
      lastError = err instanceof Error ? err : new Error(String(err));
      // Continue to next Gemini candidate model if 404 or 503
      continue;
    }
  }

  throw lastError ?? new Error("Gemini invocation failed on all candidate models");
}

/**
 * Fallback Provider: Groq (OpenAI-compatible completions endpoint)
 */
async function callGroq(body: AiRequestBody, groqKey: string): Promise<AiResponsePayload> {
  const systemPrompt = buildSystemPrompt(body);

  const messages = [
    { role: "system", content: systemPrompt },
    ...body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Candidates on Groq: standard llama-3.1-8b-instant, with verified fallback
  const models = ["llama-3.1-8b-instant", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

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

      clearTimeout(timeoutId);

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
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            args: parsedArgs,
          });
        }
      }

      return {
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        providerUsed: "groq",
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError ?? new Error("Groq invocation failed on all candidate models");
}

/**
 * Main AI Request Handler implementing dual-provider fallback logic.
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

  const { geminiApiKey, groqApiKey } = getApiKeys();

  // Dual-Provider Pipeline: Primary Gemini -> Fallback Groq
  let result: AiResponsePayload | null = null;
  let geminiError: unknown = null;

  if (geminiApiKey) {
    try {
      result = await callGemini(body, geminiApiKey);
    } catch (err) {
      geminiError = err;
      console.warn(
        "[AI Provider] Google Gemini primary failed, gracefully dispatching fallback to Groq:",
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn("[AI Provider] No GEMINI_API_KEY detected, skipping to Groq fallback.");
  }

  if (!result) {
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({
          error: "All AI providers failed or missing keys",
          details: geminiError instanceof Error ? geminiError.message : "No keys",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      result = await callGroq(body, groqApiKey);
    } catch (groqErr) {
      console.error("[AI Provider] Both Gemini and Groq fallback failed:", groqErr);
      return new Response(
        JSON.stringify({
          error: "AI service temporarily unavailable. Please try again shortly.",
          details: groqErr instanceof Error ? groqErr.message : String(groqErr),
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
