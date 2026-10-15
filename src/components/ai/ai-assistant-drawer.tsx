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

export function AiAssistantDrawer() {
  const { habits, goals, habitLogs, badHabits, ...actions } = useApp();
  const { language, isRtl } = useTranslation();
  const isOnline = useOnlineStatus();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
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
   * Human-in-the-Loop: User explicitly approves and applies a proposed mutation action.
   */
  const handleApproveAction = async (messageId: string, actionId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.pendingActions) return;

    const action = targetMsg.pendingActions.find((a) => a.id === actionId);
    if (!action || action.status !== "pending") return;

    try {
      const results = await executeAiToolCalls([action.toolCall], {
        actions,
        habits,
        goals,
        badHabits,
        habitLogs,
        language: language === "ar" ? "ar" : "en",
      });

      const execResult = results[0];

      if (execResult?.success) {
        toast.success(execResult.summary);
      } else if (execResult) {
        toast.error(execResult.summary);
      }

      // Update action in state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.pendingActions) return m;
          return {
            ...m,
            pendingActions: m.pendingActions.map((a) =>
              a.id === actionId
                ? {
                    ...a,
                    status: "approved" as const,
                    executionResult: execResult,
                  }
                : a,
            ),
          };
        }),
      );

      // Add a system confirmation message to chat history
      const displayDesc =
        language === "ar" ? action.descriptionAr || action.description : action.description;
      const confirmMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "system",
        content:
          language === "ar"
            ? `تم تأكيد وتطبيق الإجراء: ${displayDesc}`
            : `Confirmed & applied action: ${displayDesc}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error("[Approval Execution Error]:", err);
      toast.error(
        language === "ar" ? "فشل في تطبيق الإجراء المقترح" : "Failed to apply proposed action",
      );
    }
  };

  /**
   * Human-in-the-Loop: User cancels a proposed mutation action.
   */
  const handleCancelAction = (messageId: string, actionId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.pendingActions) return;

    const action = targetMsg.pendingActions.find((a) => a.id === actionId);
    if (!action || action.status !== "pending") return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.pendingActions) return m;
        return {
          ...m,
          pendingActions: m.pendingActions.map((a) =>
            a.id === actionId ? { ...a, status: "cancelled" as const } : a,
          ),
        };
      }),
    );

    const displayDesc =
      language === "ar" ? action.descriptionAr || action.description : action.description;
    toast.info(language === "ar" ? "تم إلغاء الإجراء." : "Action cancelled.");

    const cancelMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "system",
      content:
        language === "ar"
          ? `تم إلغاء الإجراء المقترح: ${displayDesc}`
          : `Cancelled proposed action: ${displayDesc}`,
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
    setIsLoading(true);

    try {
      // Build comprehensive context of habits, goals, and analytics
      const today = todayKey();
      const logMap = buildLogMap(habitLogs);
      const activeHabits = habits.filter((h) => !h.archived);
      const overallConsistency = consistencyScore(activeHabits, logMap, 30);
      const startDate30d = addDays(today, -30);

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
        habits: activeHabits.map((h) => {
          const logId = `${h.id}:${today}`;
          const log = habitLogs.find((l) => l.id === logId);
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
            streak: streaks(h, logMap).current,
            icon: h.icon,
            goalId: h.goalId,
          };
        }),
        goals: goals.map((g) => ({
          id: g.id,
          name: g.name,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
          unit: g.unit || "",
        })),
        badHabits: (badHabits || []).map((bh) => ({
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

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server responded with status ${response.status}`);
      }

      const data = (await response.json()) as AiResponsePayload;

      // Distinguish tool types: Safe (read-only) vs. Mutations requiring explicit user approval
      const safeCalls = (data.toolCalls || []).filter((tc) => !isMutationTool(tc.name));
      const mutationCalls = (data.toolCalls || []).filter((tc) => isMutationTool(tc.name));

      // Execute safe read-only tools automatically behind the scenes
      let executionResults;
      if (safeCalls.length > 0) {
        executionResults = await executeAiToolCalls(safeCalls, {
          actions,
          habits,
          goals,
          badHabits,
          habitLogs,
          language: language === "ar" ? "ar" : "en",
        });

        for (const res of executionResults) {
          if (res.toolName === "get_analytics") {
            toast.info(res.summary);
          }
        }
      }

      // Propose mutation actions for Human-in-the-Loop review
      const pendingActions: PendingAction[] = mutationCalls.map((tc) => ({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        toolCall: tc,
        status: "pending",
        description: describeAction(tc, "en", { habits, goals, badHabits }),
        descriptionAr: describeAction(tc, "ar", { habits, goals, badHabits }),
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

                      {/* Human-in-the-Loop Pending & Approved Action Cards */}
                      {msg.pendingActions && msg.pendingActions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/50 space-y-2">
                          {msg.pendingActions.map((action) => {
                            const isPending = action.status === "pending";
                            const isApproved = action.status === "approved";
                            const isCancelled = action.status === "cancelled";
                            const isDeletion = action.toolCall.name.startsWith("delete_");
                            const displayDescription =
                              language === "ar"
                                ? action.descriptionAr || action.description
                                : action.description;

                            return (
                              <div
                                key={action.id}
                                className={cn(
                                  "rounded-xl border p-2.5 transition-all text-start",
                                  isPending && "bg-background/90 border-primary/40 shadow-xs",
                                  isApproved &&
                                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100",
                                  isCancelled &&
                                    "bg-muted/40 border-border/50 text-muted-foreground opacity-75",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    {isPending ? (
                                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                    ) : isApproved ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="text-[11px] font-semibold text-foreground">
                                      {isPending
                                        ? language === "ar"
                                          ? "إجراء مقترح"
                                          : "Proposed Action"
                                        : isApproved
                                          ? language === "ar"
                                            ? "تم التطبيق ✓"
                                            : "Applied ✓"
                                          : language === "ar"
                                            ? "ملغي"
                                            : "Cancelled"}
                                    </span>
                                  </div>

                                  {isPending && (
                                    <span
                                      className={cn(
                                        "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                                        isDeletion
                                          ? "bg-destructive/10 text-destructive border-destructive/20"
                                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                      )}
                                    >
                                      {language === "ar" ? "يتطلب موافقة" : "Requires Approval"}
                                    </span>
                                  )}
                                </div>

                                <p
                                  className={cn(
                                    "text-xs mt-1.5 font-medium text-foreground/90",
                                    isCancelled && "line-through text-muted-foreground",
                                  )}
                                >
                                  {displayDescription}
                                </p>

                                {isPending && isDeletion && (
                                  <p className="text-[10px] text-destructive/90 mt-1">
                                    {language === "ar"
                                      ? "تنبيه: سيتم حذف هذا العنصر بعد تأكيدك."
                                      : "Warning: This item will be permanently removed upon approval."}
                                  </p>
                                )}

                                {isApproved && action.executionResult && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                    {action.executionResult.summary}
                                  </p>
                                )}

                                {isPending && (
                                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleApproveAction(msg.id, action.id)}
                                      disabled={isLoading}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-xs transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      <Check className="h-3 w-3" />
                                      <span>
                                        {language === "ar" ? "موافقة وتطبيق" : "Approve & Apply"}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelAction(msg.id, action.id)}
                                      disabled={isLoading}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      <X className="h-3 w-3" />
                                      <span>{language === "ar" ? "إلغاء" : "Cancel"}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
                            {msg.providerUsed === "gemini" ? "✨ Gemini" : "⚡ Groq (fallback)"}
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

          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-es-sm bg-card border border-border/80 px-3.5 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>
                  {language === "ar"
                    ? "جاري التفكير ومعالجة الطلب..."
                    : "Thinking and processing..."}
                </span>
              </div>
            </div>
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
              className="flex-1 resize-none max-h-28 min-h-[40px] rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
