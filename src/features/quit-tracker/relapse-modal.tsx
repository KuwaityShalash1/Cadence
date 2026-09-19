import { useState } from "react";
import { toast } from "sonner";
import { Users, Zap, Moon, Smartphone, NotebookPen, AlertTriangle } from "lucide-react";

import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import { playFailureSound } from "@/lib/sound";
import { TRIGGER_OPTIONS } from "./constants";

interface RelapseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitId: string;
  habitTitle: string;
}

export function RelapseModal({ open, onOpenChange, habitId, habitTitle }: RelapseModalProps) {
  const { recordRelapse, undoLastRelapse, badHabits } = useApp();
  const { t } = useTranslation();
  const [selectedTrigger, setSelectedTrigger] = useState<string>("stress");
  const [detailedReason, setDetailedReason] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrigger) {
      toast.error("Please select a trigger category");
      return;
    }

    // Snapshot the ENTIRE tracker BEFORE logging the relapse (deep clone).
    // A relapse doesn't just reset the quit date — it also prepends a
    // trigger record to the history, which alters the calculated trigger
    // percentages. The Undo action must restore all of it, not just the date.
    const tracker = badHabits.find((h) => h.id === habitId);
    const trackerSnapshot = tracker ? structuredClone(tracker) : null;

    recordRelapse(habitId, selectedTrigger, detailedReason);
    playFailureSound();
    toast.success(`Relapse logged for "${habitTitle}". Timer reset. Stay strong! 💪`, {
      action: trackerSnapshot
        ? {
            label: t("common.undo", "Undo"),
            onClick: () => undoLastRelapse(trackerSnapshot),
          }
        : undefined,
      duration: 5000, // Give them 5 seconds to undo
    });
    setDetailedReason("");
    setSelectedTrigger("stress");
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("relapseModal.title", "Record Relapse & Analyze Trigger")}
      description={t(
        "relapseModal.description",
        `Acknowledge what happened with "${habitTitle}". Reflecting helps build iron will.`,
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-6 py-2">
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            {t(
              "relapseModal.banner",
              "Relapsing is part of the journey. The key is understanding why it happened so you can prevent it next time.",
            )}
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">
            {t("relapseModal.triggerPrompt", "1. Real Contextual Trigger")}
          </Label>
          <div className="grid gap-2.5">
            {TRIGGER_OPTIONS.map((opt) => {
              const active = selectedTrigger === opt.id;
              const labelText = t(`trigger.${opt.id}`, opt.label);
              const descText = t(`trigger.${opt.id}Desc`, opt.description);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedTrigger(opt.id)}
                  className={cn(
                    "flex items-start gap-3.5 rounded-xl border p-3.5 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card text-card-foreground hover:bg-muted/50",
                  )}
                >
                  <span className="text-2xl shrink-0 pt-0.5">{opt.emoji}</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-semibold text-sm">{labelText}</p>
                    <p className="text-xs text-muted-foreground">{descText}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="detailed-reason" className="text-base font-semibold">
            {t("relapseModal.reasonPrompt", "2. Detailed Notes / Specific Context (Optional)")}
          </Label>
          <Textarea
            id="detailed-reason"
            value={detailedReason}
            onChange={(e) => setDetailedReason(e.target.value)}
            placeholder={t(
              "relapseModal.reasonPlaceholder",
              "What exactly were you doing or feeling right before? E.g., working late on project X...",
            )}
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11"
          >
            {t("settings.cancel", "Cancel")}
          </Button>
          <Button type="submit" variant="destructive" className="h-11 sm:min-w-40 font-semibold">
            {t("relapseModal.submit", "Reset Timer & Log")}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
