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
      {
        name: "log_habit_progress",
        description:
          "Log quantitative progress for a numeric/duration habit by incrementing or setting its current value. Use this INSTEAD of log_habit when the user reports partial progress (e.g., '500ml of water', '30 mins of meditation'). ALWAYS inspect the habit's unit and target from context BEFORE calling, and convert the user's amount to the habit's base unit.",
        parameters: {
          type: "OBJECT",
          properties: {
            habitId: {
              type: "STRING",
              description: "Optional exact ID of the habit.",
            },
            habitName: {
              type: "STRING",
              description: "The name of the habit (e.g., 'Drink Water').",
            },
            amount: {
              type: "NUMBER",
              description:
                "The amount in the habit's BASE unit after unit conversion (e.g., 0.5 for 500ml when unit is L, 0.5 for 30min when unit is hours).",
            },
            mode: {
              type: "STRING",
              enum: ["increment", "set"],
              description:
                "'increment': add amount to current value. 'set': set current value directly.",
            },
          },
          required: ["amount", "mode"],
        },
      },
      {
        name: "create_routine",
        description:
          "Create a new daily/weekly routine (e.g., 'Morning Routine', 'روتين الصباح', 'Evening Routine', 'روتين المساء') with steps optionally linked to existing or newly created habits.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description: "The name of the routine (e.g., 'Morning Routine', 'روتين الصباح').",
            },
            schedule: {
              type: "STRING",
              enum: ["everyday", "weekdays", "weekends"],
              description: "Schedule frequency for the routine.",
            },
            timeOfDay: {
              type: "STRING",
              enum: ["morning", "afternoon", "evening", "anytime"],
              description: "Optional time of day classification for the routine.",
            },
            habitNames: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "List of habit names to automatically include as steps in this routine.",
            },
            steps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING", description: "Title of the step." },
                  habitName: { type: "STRING", description: "Optional habit name linked to this step." },
                },
                required: ["title"],
              },
              description: "Detailed list of routine steps.",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "delete_routine",
        description: "Permanently delete an existing routine by name or ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            routineId: {
              type: "STRING",
              description: "Optional exact ID of the routine to delete.",
            },
            routineName: {
              type: "STRING",
              description: "The name of the routine to delete (e.g., 'Morning Routine').",
            },
          },
        },
      },
      {
        name: "clear_all_data",
        description:
          "Wipe or reset all data for specific sections or everything. Use this when the user says 'امسح كل حاجة / ابدأ من جديد / reset all / clear habits / wipe goals'.",
        parameters: {
          type: "OBJECT",
          properties: {
            sections: {
              type: "ARRAY",
              items: {
                type: "STRING",
                enum: ["habits", "bad_habits", "goals", "routines", "all"],
              },
              description: "Sections to wipe: 'habits', 'bad_habits', 'goals', 'routines', or 'all'.",
            },
          },
          required: ["sections"],
        },
      },
      {
        name: "batch_operations",
        description:
          "Execute multiple tool operations in a single plan (e.g., creating 5 habits, 1 quit tracker, and 2 routines together). Use this whenever proposing a multi-step plan so that all actions are included at once.",
        parameters: {
          type: "OBJECT",
          properties: {
            operations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  actionType: {
                    type: "STRING",
                    description: "Name of the tool to execute (e.g. 'create_habit', 'create_routine', 'delete_habit').",
                  },
                  payload: {
                    type: "OBJECT",
                    description: "Arguments matching the specified action tool parameters.",
                  },
                },
                required: ["actionType", "payload"],
              },
              description: "Array of operations to execute in this batch plan.",
            },
          },
          required: ["operations"],
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
  {
    type: "function",
    function: {
      name: "log_habit_progress",
      description:
        "Log quantitative progress for a numeric/duration habit by incrementing or setting its current value. Use this INSTEAD of log_habit when the user reports partial progress (e.g., '500ml of water', '30 mins of meditation'). ALWAYS inspect the habit's unit and target from context BEFORE calling, and convert the user's amount to the habit's base unit.",
      parameters: {
        type: "object",
        properties: {
          habitId: {
            type: "string",
            description: "Optional exact ID of the habit.",
          },
          habitName: {
            type: "string",
            description: "The name of the habit (e.g., 'Drink Water').",
          },
          amount: {
            type: "number",
            description:
              "The amount in the habit's BASE unit after unit conversion (e.g., 0.5 for 500ml when unit is L, 0.5 for 30min when unit is hours).",
          },
          mode: {
            type: "string",
            enum: ["increment", "set"],
            description:
              "'increment': add amount to current value. 'set': set current value directly.",
          },
        },
        required: ["amount", "mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_routine",
      description:
        "Create a new daily/weekly routine (e.g., 'Morning Routine', 'روتين الصباح', 'Evening Routine', 'روتين المساء') with steps optionally linked to existing or newly created habits.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the routine (e.g., 'Morning Routine', 'روتين الصباح').",
          },
          schedule: {
            type: "string",
            enum: ["everyday", "weekdays", "weekends"],
            description: "Schedule frequency for the routine.",
          },
          timeOfDay: {
            type: "string",
            enum: ["morning", "afternoon", "evening", "anytime"],
            description: "Optional time of day classification for the routine.",
          },
          habitNames: {
            type: "array",
            items: { type: "string" },
            description: "List of habit names to automatically include as steps in this routine.",
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Title of the step." },
                habitName: { type: "string", description: "Optional habit name linked to this step." },
              },
              required: ["title"],
            },
            description: "Detailed list of routine steps.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_routine",
      description: "Permanently delete an existing routine by name or ID.",
      parameters: {
        type: "object",
        properties: {
          routineId: {
            type: "string",
            description: "Optional exact ID of the routine to delete.",
          },
          routineName: {
            type: "string",
            description: "The name of the routine to delete (e.g., 'Morning Routine').",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_all_data",
      description:
        "Wipe or reset all data for specific sections or everything. Use this when the user says 'امسح كل حاجة / ابدأ من جديد / reset all / clear habits / wipe goals'.",
      parameters: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "string",
              enum: ["habits", "bad_habits", "goals", "routines", "all"],
            },
            description: "Sections to wipe: 'habits', 'bad_habits', 'goals', 'routines', or 'all'.",
          },
        },
        required: ["sections"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "batch_operations",
      description:
        "Execute multiple tool operations in a single plan (e.g., creating 5 habits, 1 quit tracker, and 2 routines together). Use this whenever proposing a multi-step plan so that all actions are included at once.",
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                actionType: {
                  type: "string",
                  description: "Name of the tool to execute (e.g. 'create_habit', 'create_routine', 'delete_habit').",
                },
                payload: {
                  type: "object",
                  description: "Arguments matching the specified action tool parameters.",
                },
              },
              required: ["actionType", "payload"],
            },
            description: "Array of operations to execute in this batch plan.",
          },
        },
        required: ["operations"],
      },
    },
  },
];

/**
 * Builds the system prompt injecting current application context (habits, goals, date, analytics).
 * Includes holistic coaching context: local time, completion rate, quantitative habit state,
 * unit conversion rules, and chain-of-thought reasoning instructions.
 */
function buildSystemPrompt(body: AiRequestBody): string {
  const localHour = body.context?.localHour ?? new Date().getHours();
  const todayCompletionRate = body.context?.todayCompletionRate ?? 0;

  // Describe time of day for coaching context
  const timeOfDayLabel =
    localHour >= 5 && localHour < 12
      ? "Morning"
      : localHour >= 12 && localHour < 17
        ? "Afternoon"
        : localHour >= 17 && localHour < 21
          ? "Evening"
          : "Night";

  const habitsContext = body.context?.habits
    ? body.context.habits
        .map(
          (h) =>
            `- [ID: "${h.id || ""}"] ${h.name} (${h.schedule}, ${h.isCompletedToday ? "completed today" : "pending today"}, target: ${h.target} ${h.unit || ""}${h.currentValue !== undefined ? `, currentValue: ${h.currentValue}` : ""}, streak: ${h.streak ?? 0}${h.icon ? `, icon: ${h.icon}` : ""}${h.goalId ? `, linkedGoalId: ${h.goalId}` : ""})`,
        )
        .join("\n")
    : "No habits tracked yet.";

  const routinesContext =
    body.context?.routines && body.context.routines.length > 0
      ? body.context.routines
          .map(
            (r) =>
              `- [ID: "${r.id || ""}"] "${r.name}" (${r.steps?.length ?? 0} steps: ${(r.steps || []).map((s) => s.title).join(", ")})`,
          )
          .join("\n")
      : "No routines created yet.";

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

CURRENT TIME CONTEXT:
- Local Time: ${timeOfDayLabel} (hour: ${localHour})
- Today's Overall Completion Rate: ${Math.round(todayCompletionRate * 100)}% of habits done

OPERATIONAL LAWS (MUST BE STRICTLY OBEYED AT ALL TIMES):
1. LAW 1 — ZERO TEXT CONFIRMATION BEFORE TOOL CALLS:
   Your tool calls DO NOT mutate the database immediately; they render an interactive 'Approval Card' with Approve/Reject buttons in the user's UI. Therefore, NEVER ask "Are you sure?" or "Reply yes to start" or "Should I proceed?" in text before emitting tool calls! Whenever the user asks to delete items, add habits, create routines, clear data, or agrees to build a plan, emit ALL corresponding tool calls IMMEDIATELY in the exact same turn.

2. LAW 2 — COMPLETE PLAN EXECUTION (NO DRIP-FEEDING):
   If you propose a plan with multiple items (e.g. 5 habits, 1 quit tracker, and 2 routines), you MUST emit ALL tool calls in that exact same response (either as parallel tool calls or grouped inside \`batch_operations\`). NEVER emit just 1 tool call and leave the rest as plain text! When asked to create or delete multiple things, handle EVERY requested item in this single turn.

3. LAW 3 — LIVE CONTEXT IS ABSOLUTE TRUTH:
   The \`CURRENT USER CONTEXT\` block below reflects the real-time database state. Never attempt to delete or modify an item that is no longer listed in \`CURRENT USER CONTEXT\`, even if it was mentioned earlier in the chat history. If an item is already absent from the context, acknowledge it is already gone and do not re-emit deletion tool calls.

4. LAW 4 — SMART SEMANTIC TYPO CORRECTION:
   Users often type quickly with keyboard typos (especially in Arabic, e.g. "قراة" -> "قراءة", "رياصة" -> "رياضة", "شرب ما" -> "شرب الماء", "smokng" -> "Quit Smoking"). NEVER copy raw user typos into habit, goal, routine, or quit-tracker names. Always understand the intended meaning and write a clean, grammatically correct, motivating title in the proper language.

COACHING PHILOSOPHY & PROACTIVE AGENT BEHAVIOR:
You are an observant, empathetic coach who is AWARE of the current time of day and the user's current completion rate.
- Good morning (5–11): Energetically greet them, recap what's pending today.
- Afternoon slump (12–16): Nudge them on pending habits, check if they need momentum.
- Evening wind-down (17–20): Celebrate completed habits, gently prompt remaining ones.
- Late night (21+): Be gentle — acknowledge fatigue, suggest what can still realistically be done and what can be frozen/skipped.
- If the user feels overwhelmed or the completion rate is below 40%, PROACTIVELY suggest freezing low-priority habits or doing partial completions rather than pushing for perfection.
- When you notice a struggling streak (0 completions in 3+ days), proactively diagnose the root cause and suggest a schedule adjustment.
- Spot patterns, celebrate winning streaks, and identify struggling routines.
- Call \`get_analytics\` whenever you need deeper metrics on consistency, streaks, or completion rates.

DEEP REASONING MODE (Chain-of-Thought):
For ANY complex request — especially unit conversions, analytics interpretation, multi-step plans, or habit coaching advice — you MUST think step-by-step BEFORE formulating your answer or tool arguments.
Wrap your internal reasoning inside <think>...</think> tags at the very start of your response.
Only the final, clean answer comes after the </think> closing tag.
Example format:
<think>
1. The user wants to build a morning routine with 3 habits: drinking 500ml water, 10 min stretch, 15 min reading.
2. I should correct any typos and normalize units: "Drink Water" (target: 2, unit: L -> 500ml is 0.5L), "Stretching" (10 mins), "Reading" (15 mins).
3. I will propose create_habit for any new habits, and create_routine for "Morning Routine" grouping them.
4. I will emit all tool calls in this turn without asking for text confirmation.
</think>
I've put together your morning routine plan! Review and approve the changes below to apply them to Cadence.

CRITICAL UNIT CONVERSION RULE:
ALWAYS inspect the target habit's \`unit\` and \`target\` in the context BEFORE calling \`log_habit_progress\`.
- If the habit is tracked in Liters ('L', target: 3) and the user says 'I drank 500ml', you MUST convert 500ml -> 0.5L and pass amount: 0.5.
- If the habit unit is 'hours' and the user says '30 minutes', convert: 30 / 60 = 0.5, pass amount: 0.5.
- If the habit unit is 'km' and the user says '500m', convert: 500 / 1000 = 0.5, pass amount: 0.5.
- Always normalize the user's input to match the habit's base unit before calling the tool.
- For boolean habits with no unit, use \`log_habit\` with status 'done' or 'skipped' instead.

CURRENT USER CONTEXT:
Habits:
${habitsContext}

Routines:
${routinesContext}

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
   - Args: name (string, req), schedule ("everyday" | "weekdays" | "weekends", req), color (string, opt), icon (string, opt), goalId (string, opt).
2. delete_habit: Propose deleting an existing habit.
   - Args: habitId (string, opt), habitName (string, opt).
3. create_routine: Propose creating a new routine (e.g., Morning Routine, Evening Routine) grouping habits.
   - Args: name (string, req), schedule ("everyday" | "weekdays" | "weekends", opt), timeOfDay ("morning" | "afternoon" | "evening" | "anytime", opt), habitNames (string[], opt), steps (array of { title, habitName }, opt).
4. delete_routine: Propose deleting an existing routine.
   - Args: routineId (string, opt), routineName (string, opt).
5. create_bad_habit: Propose creating a quit tracker entry.
   - Args: name (string, req), triggerCategory (string, opt), limit (number, opt).
6. delete_bad_habit: Propose deleting a quit tracker / bad habit.
   - Args: badHabitId (string, opt), badHabitName (string, opt).
7. create_goal: Propose creating a target milestone goal.
   - Args: name (string, req), targetValue (number, req), unit (string, opt).
8. delete_goal: Propose deleting an existing goal.
   - Args: goalId (string, opt), goalName (string, opt).
9. clear_all_data: Propose clearing/wiping all data or specific sections.
   - Args: sections (array of "habits" | "bad_habits" | "goals" | "routines" | "all", req).
10. batch_operations: Propose executing multiple actions in one batch plan.
    - Args: operations (array of { actionType: string, payload: object }, req).
11. log_habit: Mark a boolean habit as 'done' or 'skipped' for today.
    - Args: habitName (string, req), status ("done" | "skipped", req).
12. log_habit_progress: Log partial/quantitative progress for a numeric habit. Use INSTEAD of log_habit for numeric habits.
    - Args: habitId (string, opt), habitName (string, opt), amount (number, req — already converted to base unit), mode ("increment" | "set", req).
13. get_analytics: Retrieve deep streaks, completion rates, and consistency statistics.
    - Args: habitName (string, opt), timeRangeDays (number, opt).
14. get_app_summary: Retrieve an overview summary of current habits and goals.
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
 * Unwraps batch_operations into flat individual tool calls so that multi-step plans
 * can be proposed either via parallel tool calling or via a single batch wrapper.
 */
function unwrapToolCalls(rawCalls: ToolCallPayload[]): ToolCallPayload[] {
  const unwrapped: ToolCallPayload[] = [];
  for (const tc of rawCalls) {
    if (tc.name === "batch_operations" && tc.args && Array.isArray(tc.args["operations"])) {
      const ops = tc.args["operations"] as Array<{
        actionType?: string;
        name?: string;
        payload?: Record<string, unknown>;
        args?: Record<string, unknown>;
      }>;
      for (const op of ops) {
        const opName = op.actionType || op.name;
        if (opName) {
          unwrapped.push({
            name: opName,
            args: op.payload || op.args || {},
          });
        }
      }
    } else {
      unwrapped.push(tc);
    }
  }
  return unwrapped;
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

        const unwrapped = unwrapToolCalls(toolCalls);

        return {
          text: text.trim(),
          toolCalls: unwrapped.length > 0 ? unwrapped : undefined,
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
            parallel_tool_calls: true,
            temperature: 0.2,
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

        const rawContent = choice.message.content || "";
        // Extract chain-of-thought reasoning from <think>...</think> tags before stripping
        const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(rawContent);
        const reasoning = thinkMatch ? thinkMatch[1]!.trim() : undefined;
        let text = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

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

        const unwrapped = unwrapToolCalls(toolCalls);

        return {
          text,
          toolCalls: unwrapped.length > 0 ? unwrapped : undefined,
          providerUsed: "groq",
          ...(reasoning !== undefined ? { reasoning } : {}),
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
