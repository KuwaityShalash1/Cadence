import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Check,
  CheckCircle2,
  AlertCircle,
  Trash2,
  WifiOff,
  Loader2,
  X,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Brain,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useTranslation } from "@/i18n/context";
import { addDays, todayKey } from "@/services/dates";
import { buildLogMap, consistencyScore, habitStats, streaks } from "@/services/stats";
import { useApp } from "@/stores/app-store";
import type {
  AiAppContext,
  AiRequestBody,
  AiResponsePayload,
  ChatMessage,
  PendingAction,
} from "@/types/ai";
import { isMutationTool } from "@/types/ai";
import { cn } from "@/lib/utils";
import { describeAction, executeAiToolCalls } from "./tool-executor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const STORAGE_KEY = "cadence_ai_chat_history_v1";

export const OPEN_AI_ASSISTANT_EVENT = "cadence:open-ai-assistant";
export const CLOSE_AI_ASSISTANT_EVENT = "cadence:close-ai-assistant";
export const TOGGLE_AI_ASSISTANT_EVENT = "cadence:toggle-ai-assistant";

export function openAiAssistant(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
  }
}

export function closeAiAssistant(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLOSE_AI_ASSISTANT_EVENT));
  }
}

export function toggleAiAssistant(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOGGLE_AI_ASSISTANT_EVENT));
  }
}

/**
 * Floating trigger button for the AI Assistant.
 * Stacks cleanly with other mobile action buttons or floats individually on desktop.
 */
export function AiAssistantTrigger({ className }: { className?: string }) {
  const { language } = useTranslation();
  const isOnline = useOnlineStatus();

  return (
    <button
      type="button"
      onClick={openAiAssistant}
      aria-label={language === "ar" ? "فتح المساعد الذكي" : "Open AI Assistant"}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-card/95 text-foreground shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:bg-card hover:shadow-primary/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        className,
      )}
    >
      <span className="relative flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-primary transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -top-1 -end-1 flex h-2.5 w-2.5">
          <span
            className={cn(
              "h-full w-full rounded-full",
              isOnline ? "bg-emerald-500" : "bg-muted-foreground",
            )}
          />
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Adaptive pacing delay thresholds (ms)
// ---------------------------------------------------------------------------
const SIMPLE_REPLY_MIN_MS = 600;
const COMPLEX_TOOL_MIN_MS = 1400;

/** Detects if the user's message implies a complex analytical or tool request. */
function isComplexRequest(text: string): boolean {
  const lowerText = text.toLowerCase();
  return (
    lowerText.includes("analyz") ||
    lowerText.includes("حلل") ||
    lowerText.includes("تحليل") ||
    lowerText.includes("ml") ||
    lowerText.includes("liter") ||
    lowerText.includes("minute") ||
    lowerText.includes("دقيق") ||
    lowerText.includes("km") ||
    lowerText.includes("progress") ||
    lowerText.includes("تقدم") ||
    lowerText.includes("delete") ||
    lowerText.includes("احذف") ||
    lowerText.includes("create") ||
    lowerText.includes("أضف") ||
    lowerText.includes("add")
  );
}

// ---------------------------------------------------------------------------
// Reasoning Disclosure Panel
// ---------------------------------------------------------------------------
function ReasoningPanel({
  reasoning,
  language,
}: {
  reasoning: string;
  language: "ar" | "en";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-primary/80 hover:bg-primary/10 transition-colors"
      >
        <Brain className="h-3 w-3 shrink-0" />
        <span className="flex-1 text-start">
          {language === "ar" ? "عرض خطوات التفكير" : "View Reasoning"}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-primary/15">
          <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground font-mono leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified Batch Approval Card
// ---------------------------------------------------------------------------
interface BatchApprovalCardProps {
  messageId: string;
  pendingActions: PendingAction[];
  language: "ar" | "en";
  isLoading: boolean;
  onApproveSelected: (messageId: string, selectedIds: string[]) => Promise<void>;
  onRejectAll: (messageId: string) => void;
}

function BatchApprovalCard({
  messageId,
  pendingActions,
  language,
  isLoading,
  onApproveSelected,
  onRejectAll,
}: BatchApprovalCardProps) {
  const isAr = language === "ar";

  // All pending items; approved/cancelled items are shown as resolved
  const pendingItems = pendingActions.filter((a) => a.status === "pending");
  const resolvedItems = pendingActions.filter((a) => a.status !== "pending");
  const allResolved = pendingItems.length === 0;

  // Checkbox state per action ID (default: checked)
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const a of pendingActions) {
      initial[a.id] = a.checked !== false; // defaults to true
    }
    return initial;
  });

  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [isApproving, setIsApproving] = useState(false);

  const selectedCount = pendingItems.filter((a) => checked[a.id]).length;

  const toggleCheck = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllCheck = () => {
    const allChecked = pendingItems.every((a) => checked[a.id]);
    const newState: Record<string, boolean> = { ...checked };
    for (const a of pendingItems) {
      newState[a.id] = !allChecked;
    }
    setChecked(newState);
  };

  const handleApproveSelected = async () => {
    const selectedIds = pendingItems.filter((a) => checked[a.id]).map((a) => a.id);
    if (selectedIds.length === 0) return;
    setIsApproving(true);
    try {
      await onApproveSelected(messageId, selectedIds);
    } finally {
      setIsApproving(false);
    }
  };

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (allResolved && resolvedItems.length > 0) {
    // Compact summary view after all actions are resolved
    return (
      <div className="mt-2.5 pt-2 border-t border-border/50 space-y-1.5">
        {resolvedItems.map((action) => {
          const isApproved = action.status === "approved";
          const displayDescription =
            isAr ? action.descriptionAr || action.description : action.description;
          return (
            <div
              key={action.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]",
                isApproved
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted/50 border border-border/50 text-muted-foreground line-through",
              )}
            >
              {isApproved ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{displayDescription}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2 border-t border-border/50">
      {/* Card header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/15 border border-amber-500/30">
          <Sparkles className="h-3 w-3 text-amber-500" />
        </div>
        <span className="text-[11px] font-semibold text-foreground">
          {isAr ? "التعديلات المقترحة" : "Proposed Changes"}
        </span>
        <span className="ms-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          {isAr ? `يتطلب موافقة` : `Requires Approval`}
        </span>
      </div>

      {/* Select all row */}
      {pendingItems.length > 1 && (
        <button
          type="button"
          onClick={toggleAllCheck}
          className="flex items-center gap-1.5 w-full px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-1.5"
        >
          {pendingItems.every((a) => checked[a.id]) ? (
            <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <Square className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{isAr ? "تحديد الكل" : "Select all"}</span>
        </button>
      )}

      {/* Pending action list */}
      <div className="space-y-1.5">
        {pendingItems.map((action) => {
          const isDeletion = action.toolCall.name.startsWith("delete_");
          const displayDescription =
            isAr ? action.descriptionAr || action.description : action.description;
          const isExpanded = expandedDetails[action.id];
          const isChecked = checked[action.id] ?? true;

          return (
            <div
              key={action.id}
              className={cn(
                "rounded-xl border transition-all",
                isChecked
                  ? isDeletion
                    ? "bg-destructive/5 border-destructive/30"
                    : "bg-background/90 border-primary/30 shadow-xs"
                  : "bg-muted/30 border-border/50 opacity-60",
              )}
            >
              <div className="flex items-start gap-2 px-2.5 py-2">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleCheck(action.id)}
                  className="mt-0.5 shrink-0 transition-colors"
                  aria-label={isChecked ? (isAr ? "إلغاء التحديد" : "Uncheck") : (isAr ? "تحديد" : "Check")}
                >
                  {isChecked ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[11px] font-medium",
                      isDeletion ? "text-destructive" : "text-foreground/90",
                    )}
                  >
                    {displayDescription}
                  </p>
                  {isDeletion && (
                    <p className="text-[10px] text-destructive/70 mt-0.5">
                      {isAr
                        ? "تنبيه: هذا الإجراء دائم."
                        : "Warning: This action is permanent."}
                    </p>
                  )}
                </div>

                {/* Details toggle */}
                <button
                  type="button"
                  onClick={() => toggleDetails(action.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isExpanded ? "Collapse details" : "Expand details"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Expandable raw parameters */}
              {isExpanded && (
                <div className="px-2.5 pb-2 border-t border-border/40">
                  <pre className="mt-1.5 text-[10px] font-mono text-muted-foreground bg-muted/40 rounded p-1.5 overflow-x-auto">
                    {JSON.stringify(action.toolCall.args, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show already-resolved items compactly if mixed state */}
      {resolvedItems.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {resolvedItems.map((action) => {
            const isApproved = action.status === "approved";
            const displayDescription =
              isAr ? action.descriptionAr || action.description : action.description;
            return (
              <div
                key={action.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1 text-[10px]",
                  isApproved
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground line-through",
                )}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 shrink-0" />
                )}
                <span>{displayDescription}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Master action buttons */}
      {pendingItems.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleApproveSelected()}
            disabled={isLoading || isApproving || selectedCount === 0}
            className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isApproving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <span>
              {isAr
                ? `موافقة وتطبيق المحدد (${selectedCount})`
                : `Approve & Apply Selected (${selectedCount})`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onRejectAll(messageId)}
            disabled={isLoading || isApproving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] transition-all active:scale-95 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            <span>{isAr ? "إلغاء الكل" : "Reject All"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading indicator with adaptive message
// ---------------------------------------------------------------------------
function LoadingIndicator({
  isComplex,
  language,
}: {
  isComplex: boolean;
  language: "ar" | "en";
}) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-start gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-2xl rounded-es-sm bg-card border border-border/80 px-3.5 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>
            {isComplex
              ? language === "ar"
                ? `جاري تحليل العادات وحساب التغييرات${dots}`
                : `Analyzing habits & calculating changes${dots}`
              : language === "ar"
                ? `جاري التفكير${dots}`
                : `Thinking${dots}`}
          </span>
        </div>
        {isComplex && (
          <div className="mt-1.5 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full bg-primary/30 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer
// ---------------------------------------------------------------------------
export function AiAssistantDrawer() {
  const store = useApp();
  const storeRef = useRef(store);
  storeRef.current = store;

  const { habits, goals, habitLogs, badHabits, ...actions } = store;
  const { language, isRtl } = useTranslation();
  const isOnline = useOnlineStatus();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplexLoading, setIsComplexLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as ChatMessage[];
    } catch {
      // Ignore parse errors from stale localStorage
    }
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync message history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore quota errors
    }
  }, [messages]);

  // Scroll to bottom when messages change or loading starts
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input on drawer open if online
  useEffect(() => {
    if (!isOpen || !isOnline) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, isOnline]);

  // Global event listener to toggle or open AI drawer from external triggers
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleToggle = () => setIsOpen((prev) => !prev);

    window.addEventListener(OPEN_AI_ASSISTANT_EVENT, handleOpen);
    window.addEventListener(CLOSE_AI_ASSISTANT_EVENT, handleClose);
    window.addEventListener(TOGGLE_AI_ASSISTANT_EVENT, handleToggle);

    return () => {
      window.removeEventListener(OPEN_AI_ASSISTANT_EVENT, handleOpen);
      window.removeEventListener(CLOSE_AI_ASSISTANT_EVENT, handleClose);
      window.removeEventListener(TOGGLE_AI_ASSISTANT_EVENT, handleToggle);
    };
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Human-in-the-Loop: Batch approve selected pending actions.
   */
  const handleApproveSelected = async (messageId: string, selectedActionIds: string[]) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg?.pendingActions) return;

    const actionsToExecute = targetMsg.pendingActions.filter(
      (a) => selectedActionIds.includes(a.id) && a.status === "pending",
    );
    if (actionsToExecute.length === 0) return;

    try {
      const toolCalls = actionsToExecute.map((a) => a.toolCall);
      const freshStore = storeRef.current;
      const results = await executeAiToolCalls(toolCalls, {
        actions: freshStore,
        habits: freshStore.habits,
        goals: freshStore.goals,
        routines: freshStore.routines,
        badHabits: freshStore.badHabits,
        habitLogs: freshStore.habitLogs,
        language: language === "ar" ? "ar" : "en",
      });

      // Show toast for each result
      for (const res of results) {
        if (res.success) {
          toast.success(res.summary);
        } else {
          toast.error(res.summary);
        }
      }

      // Update action statuses and attach execution results
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.pendingActions) return m;
          const updatedActions = m.pendingActions.map((a) => {
            if (!selectedActionIds.includes(a.id) || a.status !== "pending") return a;
            const execResult = results.find((r) => r.toolName === a.toolCall.name);
            return {
              ...a,
              status: "approved" as const,
              executionResult: execResult,
            };
          });
          return { ...m, pendingActions: updatedActions };
        }),
      );

      // Add a batch confirmation system message
      const appliedCount = results.filter((r) => r.success).length;
      const confirmMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "system",
        content:
          language === "ar"
            ? `تم تطبيق ${appliedCount} من ${actionsToExecute.length} إجراء بنجاح.`
            : `Applied ${appliedCount} of ${actionsToExecute.length} action(s) successfully.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error("[Batch Approval Execution Error]:", err);
      toast.error(
        language === "ar" ? "فشل في تطبيق الإجراءات المقترحة" : "Failed to apply proposed actions",
      );
    }
  };

  /**
   * Human-in-the-Loop: Reject all pending actions for a message.
   */
  const handleRejectAll = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.pendingActions) return m;
        return {
          ...m,
          pendingActions: m.pendingActions.map((a) =>
            a.status === "pending" ? { ...a, status: "cancelled" as const } : a,
          ),
        };
      }),
    );
    toast.info(language === "ar" ? "تم إلغاء جميع التعديلات المقترحة." : "All proposed actions cancelled.");

    const cancelMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "system",
      content:
        language === "ar"
          ? "تم إلغاء جميع التعديلات المقترحة."
          : "All proposed changes were cancelled.",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    if (!isOnline) {
      toast.error(
        language === "ar"
          ? "يتطلب المساعد الذكي اتصالاً بالإنترنت."
          : "AI assistant requires an internet connection.",
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const complex = isComplexRequest(text);
    setIsLoading(true);
    setIsComplexLoading(complex);

    // Adaptive pacing: record the start time so we can enforce a minimum "thinking" duration
    const requestStartTime = Date.now();
    const minDelayMs = complex ? COMPLEX_TOOL_MIN_MS : SIMPLE_REPLY_MIN_MS;

    try {
      // Build comprehensive context of habits, routines, goals, and analytics from live store
      const liveStore = storeRef.current;
      const liveHabits = liveStore.habits;
      const liveGoals = liveStore.goals;
      const liveRoutines = liveStore.routines || [];
      const liveBadHabits = liveStore.badHabits || [];
      const liveLogs = liveStore.habitLogs;

      const today = todayKey();
      const logMap = buildLogMap(liveLogs);
      const activeHabits = liveHabits.filter((h) => !h.archived);
      const overallConsistency = consistencyScore(activeHabits, logMap, 30);
      const startDate30d = addDays(today, -30);

      // Compute today's completion rate
      const completedToday = activeHabits.filter((h) => {
        const log = liveLogs.find((l) => l.habitId === h.id && l.date === today);
        return log?.status === "complete" || (log && log.value >= log.target);
      }).length;
      const todayCompletionRate =
        activeHabits.length > 0 ? completedToday / activeHabits.length : 0;

      const habitPerformance = activeHabits.map((h) => {
        const stats = habitStats(h, logMap, startDate30d, today);
        const streakInfo = streaks(h, logMap);
        return {
          id: h.id,
          name: h.name,
          currentStreak: streakInfo.current,
          bestStreak: streakInfo.best,
          completionRate30d: stats.completionRate,
          totalCompletions: stats.totalCompletions,
        };
      });

      const appContext: AiAppContext = {
        language: language === "ar" ? "ar" : "en",
        localHour: new Date().getHours(),
        todayCompletionRate,
        habits: activeHabits.map((h) => {
          const logId = `${h.id}:${today}`;
          const log = liveLogs.find((l) => l.id === logId);
          const isCompletedToday = log?.status === "complete" || (log && log.value >= log.target);

          let scheduleStr = "daily";
          if (h.schedule.type === "weekdays") {
            scheduleStr = h.schedule.days.length === 5 ? "weekdays" : "custom days";
          }

          return {
            id: h.id,
            name: h.name,
            type: h.type,
            target: h.target,
            unit: h.unit,
            schedule: scheduleStr,
            isCompletedToday: Boolean(isCompletedToday),
            currentValue: log?.value,
            streak: streaks(h, logMap).current,
            icon: h.icon,
            goalId: h.goalId,
          };
        }),
        routines: liveRoutines.map((r) => ({
          id: r.id,
          name: r.name,
          schedule: r.schedule?.type,
          steps: (r.steps || []).map((s) => ({
            id: s.id,
            title: s.title,
            habitId: s.habitId,
          })),
        })),
        goals: liveGoals.map((g) => ({
          id: g.id,
          name: g.name,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
          unit: g.unit || "",
        })),
        badHabits: liveBadHabits.map((bh) => ({
          id: bh.id,
          name: bh.title,
          strategy: bh.strategy ?? "cold-turkey",
          limitValue: bh.limitValue,
          daysClean: Math.floor(Math.max(0, Date.now() - bh.quitDate) / (1000 * 60 * 60 * 24)),
        })),
        analytics: {
          overallConsistencyScore: overallConsistency,
          habitPerformance,
        },
      };

      const requestBody: AiRequestBody = {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        context: appContext,
      };

      // Fire the API request
      const fetchPromise = fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Enforce minimum pacing delay in parallel with the network request
      const [response] = await Promise.all([
        fetchPromise,
        new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(0, minDelayMs - (Date.now() - requestStartTime))),
        ),
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error((errorData as { error?: string } | null)?.error ?? `Server responded with status ${response.status}`);
      }

      const data = (await response.json()) as AiResponsePayload;

      // Distinguish tool types: Safe (read-only) vs. Mutations requiring explicit user approval
      const safeCalls = (data.toolCalls || []).filter((tc) => !isMutationTool(tc.name));
      const mutationCalls = (data.toolCalls || []).filter((tc) => isMutationTool(tc.name));

      // Execute safe read-only tools automatically behind the scenes
      let executionResults;
      if (safeCalls.length > 0) {
        executionResults = await executeAiToolCalls(safeCalls, {
          actions: liveStore,
          habits: liveHabits,
          goals: liveGoals,
          routines: liveRoutines,
          badHabits: liveBadHabits,
          habitLogs: liveLogs,
          language: language === "ar" ? "ar" : "en",
        });

        for (const res of executionResults) {
          if (res.toolName === "get_analytics") {
            toast.info(res.summary);
          }
        }
      }

      // Filter out delete actions targeting items that are already absent from the store
      const validMutationCalls = mutationCalls.filter((tc) => {
        if (tc.name === "delete_habit") {
          const habitId = String(tc.args?.["habitId"] || "").trim();
          const habitName = String(tc.args?.["habitName"] || "").trim().toLowerCase();
          const exists = liveHabits.some(
            (h) => (habitId && h.id === habitId) || (habitName && h.name.trim().toLowerCase() === habitName),
          );
          return exists;
        }
        if (tc.name === "delete_bad_habit") {
          const bhId = String(tc.args?.["badHabitId"] || "").trim();
          const bhName = String(tc.args?.["badHabitName"] || "").trim().toLowerCase();
          const exists = liveBadHabits.some(
            (b) => (bhId && b.id === bhId) || (bhName && b.title.trim().toLowerCase() === bhName),
          );
          return exists;
        }
        if (tc.name === "delete_goal") {
          const goalId = String(tc.args?.["goalId"] || "").trim();
          const goalName = String(tc.args?.["goalName"] || "").trim().toLowerCase();
          const exists = liveGoals.some(
            (g) => (goalId && g.id === goalId) || (goalName && g.name.trim().toLowerCase() === goalName),
          );
          return exists;
        }
        if (tc.name === "delete_routine") {
          const routineId = String(tc.args?.["routineId"] || "").trim();
          const routineName = String(tc.args?.["routineName"] || "").trim().toLowerCase();
          const exists = liveRoutines.some(
            (r) => (routineId && r.id === routineId) || (routineName && r.name.trim().toLowerCase() === routineName),
          );
          return exists;
        }
        return true;
      });

      // Propose mutation actions for Human-in-the-Loop review (all checked by default)
      const pendingActions: PendingAction[] = validMutationCalls.map((tc) => ({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        toolCall: tc,
        status: "pending",
        description: describeAction(tc, "en", {
          habits: liveHabits,
          goals: liveGoals,
          badHabits: liveBadHabits,
          routines: liveRoutines,
        }),
        descriptionAr: describeAction(tc, "ar", {
          habits: liveHabits,
          goals: liveGoals,
          badHabits: liveBadHabits,
          routines: liveRoutines,
        }),
        checked: true,
      }));

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content:
          data.text ||
          (pendingActions.length > 0
            ? language === "ar"
              ? "لقد اقترحت بعض التغييرات. يرجى مراجعتها وتأكيدها أدناه:"
              : "I have proposed some changes. Please review and approve them below:"
            : language === "ar"
              ? "تم تنفيذ الإجراء المطلوب."
              : "Action executed."),
        toolCalls: data.toolCalls,
        executionResults,
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
        reasoning: data.reasoning,
        providerUsed: data.providerUsed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error("[AI Assistant Request Error]:", err);
      const errorMessageText = err instanceof Error ? err.message : String(err);

      const errorAssistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content:
          language === "ar"
            ? `عذراً، حدث خطأ أثناء معالجة الطلب: ${errorMessageText}`
            : `Sorry, an error occurred while processing your request: ${errorMessageText}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
      setIsComplexLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const suggestions =
    language === "ar"
      ? [
          "أضف عادة: قراءة 20 دقيقة كل يوم",
          "كيف هو معدل استمراريتي هذا الشهر؟",
          "احذف عادة قراءة 20 دقيقة",
          "حلل عاداتي واقترح تحسينات مناسبة",
        ]
      : [
          "Add habit: Read 20 mins everyday",
          "How is my consistency this month?",
          "Delete habit Read 20 mins",
          "Analyze my habits and suggest improvements",
        ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full flex-col p-0 sm:max-w-md bg-background border-border text-foreground shadow-2xl overflow-hidden",
          "pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1rem)]",
          "[&>button]:top-[max(calc(env(safe-area-inset-top)+0.875rem),1.5rem)] sm:[&>button]:top-4",
        )}
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border/70 px-4 py-3 sm:px-6 pe-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-start">
              <SheetTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                {language === "ar" ? "مساعد كادنس" : "Cadence AI"}
                <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">
                  Agent
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "مدرب عادات ذكي مع موافقة مباشرة على التعديلات"
                  : "Smart habit coach with Human-in-the-Loop approval"}
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title={language === "ar" ? "مسح المحادثة" : "Clear conversation"}
                aria-label={language === "ar" ? "مسح المحادثة" : "Clear conversation"}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Offline Safety Banner */}
        {!isOnline && (
          <div className="flex items-start gap-2.5 bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-xs text-amber-500 dark:text-amber-400">
            <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {language === "ar"
                ? "يتطلب المساعد الذكي اتصالاً بالإنترنت. تظل عاداتك وأهدافك المحلية تعمل بشكل كامل دون اتصال."
                : "AI assistant requires an internet connection. Your offline habits and goals remain fully functional."}
            </p>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-sm font-semibold text-foreground">
                  {language === "ar"
                    ? "مرحباً! أنا مدرب العادات الذكي"
                    : "Hello! I am your AI Habit Coach"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? "يمكنني تحليل أدائك، اقتراح تعديلات أو حذف عادات، وإنشاء أهداف جديدة. لن يتم تطبيق أي تعديل دون موافقتك الصريحة."
                    : "I can analyze your streaks, recommend dropping or scaling habits, and track goals. No changes are applied without your approval."}
                </p>
              </div>

              {/* Suggestion Chips */}
              <div className="w-full pt-4 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground text-start">
                  {language === "ar" ? "اقتراحات سريعة:" : "Quick suggestions:"}
                </p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => void handleSendMessage(suggestion)}
                      disabled={!isOnline || isLoading}
                      className="w-full text-start text-xs rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-foreground/90 hover:bg-card hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      ✨ {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              // System Messages (confirmation or cancellation pills)
              if (msg.role === "system") {
                return (
                  <div key={msg.id} className="flex w-full justify-center my-1.5 px-4">
                    <div className="flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/60 px-3 py-1 text-[11px] text-muted-foreground shadow-xs">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-start gap-2 max-w-[85%]">
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20 mt-0.5">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-ee-sm"
                          : "bg-card border border-border/80 text-foreground rounded-es-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Chain-of-Thought Reasoning Panel */}
                      {msg.reasoning && (
                        <ReasoningPanel
                          reasoning={msg.reasoning}
                          language={language === "ar" ? "ar" : "en"}
                        />
                      )}

                      {/* Unified Batch Approval Card */}
                      {msg.pendingActions && msg.pendingActions.length > 0 && (
                        <BatchApprovalCard
                          messageId={msg.id}
                          pendingActions={msg.pendingActions}
                          language={language === "ar" ? "ar" : "en"}
                          isLoading={isLoading}
                          onApproveSelected={(msgId, ids) => handleApproveSelected(msgId, ids)}
                          onRejectAll={handleRejectAll}
                        />
                      )}

                      {/* Safe Read-Only Tool Execution Cards */}
                      {msg.executionResults && msg.executionResults.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/50 space-y-1.5">
                          {msg.executionResults.map((res, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] ${
                                res.success
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-destructive/10 text-destructive border border-destructive/20"
                              }`}
                            >
                              {res.success ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              )}
                              <span>{res.summary}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Provider badge */}
                      {msg.role === "assistant" && msg.providerUsed && (
                        <div className="mt-1.5 flex items-center justify-end">
                          <span className="text-[9px] font-mono tracking-tight text-muted-foreground/75">
                            {msg.providerUsed === "gemini" ? "✨ Gemini" : "⚡ Groq"}
                          </span>
                        </div>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border mt-0.5">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Adaptive Loading Indicator */}
          {isLoading && (
            <LoadingIndicator
              isComplex={isComplexLoading}
              language={language === "ar" ? "ar" : "en"}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="border-t border-border/70 p-3 bg-card/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isOnline || isLoading}
              rows={1}
              placeholder={
                !isOnline
                  ? language === "ar"
                    ? "غير متاح دون اتصال..."
                    : "Unavailable offline..."
                  : language === "ar"
                    ? "اسأل أي شيء، اطلب تحليلاً، أو اقترح تغيير عادة..."
                    : "Ask advice, request analytics, or manage habits..."
              }
              className="flex-1 resize-none max-h-28 min-h-[40px] rounded-xl border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={!input.trim() || !isOnline || isLoading}
              aria-label={language === "ar" ? "إرسال الرسالة" : "Send message"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              )}
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
