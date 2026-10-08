import { useState, useId, useTransition } from "react";
import {
  Download,
  Share2,
  Copy,
  Flame,
  Check,
  Sparkles,
  Smartphone,
  Square,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateStreakMilestoneImage, type ShareCardData } from "@/lib/share-card-generator";
import { triggerConfetti } from "@/lib/celebration";

interface ShareStreakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streak: number;
  longestStreak: number;
  weeklyRate: number;
  totalCompletions: number;
  level: {
    level: number;
    title: string;
  };
  userName: string;
  bestHabitName?: string;
}

export function ShareStreakModal({
  open,
  onOpenChange,
  streak,
  longestStreak,
  weeklyRate,
  totalCompletions,
  level,
  userName,
  bestHabitName,
}: ShareStreakModalProps) {
  const { t, isRtl } = useTranslation();
  const [format, setFormat] = useState<"story" | "square">("story");
  const [isGenerating, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // Generate card dataset with localized labels
  const getCardData = (fmt: "story" | "square"): ShareCardData => ({
    streak,
    longestStreak,
    weeklyRate,
    totalCompletions,
    level,
    userName,
    bestHabitName,
    format: fmt,
    labels: {
      milestoneBadge: t("shareCard.streakMilestone", "Streak Milestone"),
      dayStreak: t("shareCard.dayStreak", "Day Streak"),
      daysStreak: t("shareCard.daysStreak", "Days Streak"),
      weeklyConsistency: t("shareCard.weeklyConsistency", "7-Day Rate"),
      personalBest: t("shareCard.personalBest", "Longest"),
      totalCompleted: t("shareCard.totalCompleted", "Completed"),
      starHabit: t("shareCard.bestHabit", "Star Habit"),
      motto: t("shareCard.motto", "Small daily rhythms build legendary outcomes."),
      branding: t("shareCard.branding", "Cadence Habit Rhythm"),
    },
  });

  // Handle Web Share or download
  const handleShare = () => {
    startTransition(async () => {
      try {
        const cardData = getCardData(format);
        const { blob, file, dataUrl } = await generateStreakMilestoneImage(cardData);

        const shareTitle = `Cadence — ${streak} ${t("dashboard.days", "days")} streak!`;
        const shareText = `I've maintained a ${streak}-day habit streak with a ${weeklyRate}% weekly completion rate on Cadence! 🔥`;

        if (
          typeof navigator !== "undefined" &&
          navigator.share &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file],
          });
          toast.success(t("shareCard.sharedSuccess", "Card shared successfully!"));
          triggerConfetti();
        } else if (typeof navigator !== "undefined" && navigator.share) {
          // Native share without file support
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: window.location.origin,
          });
          toast.success(t("shareCard.sharedSuccess", "Card shared successfully!"));
          triggerConfetti();
        } else {
          // Fallback to downloading
          downloadBlob(blob, file.name);
          toast.success(t("shareCard.downloadSuccess", "Card downloaded!"));
          triggerConfetti();
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Failed to share milestone card:", err);
          toast.error(t("shareCard.error", "Could not generate or share image."));
        }
      }
    });
  };

  // Direct download handler
  const handleDownload = () => {
    startTransition(async () => {
      try {
        const cardData = getCardData(format);
        const { blob, file } = await generateStreakMilestoneImage(cardData);
        downloadBlob(blob, file.name);
        toast.success(t("shareCard.downloadSuccess", "Card downloaded!"));
        triggerConfetti();
      } catch (err) {
        console.error("Failed to download milestone image:", err);
        toast.error(t("shareCard.error", "Could not generate card."));
      }
    });
  };

  // Copy to clipboard handler
  const handleCopy = () => {
    startTransition(async () => {
      try {
        const cardData = getCardData(format);
        const { blob } = await generateStreakMilestoneImage(cardData);

        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);
          setCopied(true);
          toast.success(t("shareCard.copiedToast", "Image copied to clipboard!"));
          triggerConfetti();
          setTimeout(() => setCopied(false), 2500);
        } else {
          // Fallback download if clipboard image write unsupported
          handleDownload();
        }
      } catch (err) {
        console.error("Failed to copy image:", err);
        // Fallback to downloading
        handleDownload();
      }
    });
  };

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden bg-slate-950 border-slate-800 text-white shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-amber-400" />
                {t("shareCard.title", "Share Your Progress")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {t(
                  "shareCard.subtitle",
                  "Generate a sleek story card to celebrate your consistency.",
                )}
              </DialogDescription>
            </div>

            {/* Format Selector Pills */}
            <div className="inline-flex items-center rounded-lg bg-slate-800/90 p-1 border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setFormat("story")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                  format === "story"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-400 hover:text-white",
                )}
              >
                <Smartphone className="h-3 w-3" />
                <span>{t("shareCard.storyFormat", "Story 9:16")}</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("square")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                  format === "square"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-400 hover:text-white",
                )}
              >
                <Square className="h-3 w-3" />
                <span>{t("shareCard.squareFormat", "Card 1:1")}</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Live Card Aesthetic Preview */}
        <div className="p-5 flex flex-col items-center justify-center bg-slate-950/80">
          <div
            className={cn(
              "w-full max-w-[320px] rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-5 shadow-2xl relative overflow-hidden transition-all duration-300",
              format === "story" ? "aspect-[9/15]" : "aspect-square",
            )}
          >
            {/* Ambient Background Aura */}
            <div className="pointer-events-none absolute -top-12 -end-12 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -start-12 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Header Branding */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[11px] font-black tracking-widest text-amber-400 uppercase">
                    CADENCE
                  </span>
                  <span className="text-[9px] text-slate-400 tracking-wider font-semibold uppercase">
                    • HABIT RHYTHM
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="text-[9px] uppercase tracking-wider font-bold border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-0 h-4"
                >
                  {t("shareCard.streakMilestone", "Streak Milestone")}
                </Badge>

                <p className="text-xs font-semibold text-white pt-1">{userName}</p>
                <p className="text-[10px] text-slate-400">
                  Level {level.level} • {level.title}
                </p>
              </div>

              {/* Center Streak Hero */}
              <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
                <div className="relative grid h-24 w-24 sm:h-28 sm:w-28 place-items-center rounded-full bg-gradient-to-b from-amber-500/20 to-slate-900 border-2 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <Flame className="h-8 w-8 text-amber-500 fill-amber-500 mb-6 drop-shadow-md" />
                  <span className="absolute bottom-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {streak}
                  </span>
                </div>
                <span className="mt-2 text-[10px] font-black tracking-widest text-amber-400 uppercase">
                  {streak === 1
                    ? t("shareCard.dayStreak", "Day Streak")
                    : t("shareCard.daysStreak", "Days Streak")}
                </span>
              </div>

              {/* Metrics Capsules */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2">
                  <span className="block text-sm font-black text-emerald-400">{weeklyRate}%</span>
                  <span className="block text-[9px] text-slate-400 truncate">
                    {t("shareCard.weeklyConsistency", "7-Day Rate")}
                  </span>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2">
                  <span className="block text-sm font-black text-sky-400">{longestStreak}d</span>
                  <span className="block text-[9px] text-slate-400 truncate">
                    {t("shareCard.personalBest", "Longest")}
                  </span>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2">
                  <span className="block text-sm font-black text-purple-400">
                    {totalCompletions}
                  </span>
                  <span className="block text-[9px] text-slate-400 truncate">
                    {t("shareCard.totalCompleted", "Completed")}
                  </span>
                </div>
              </div>

              {/* Star habit if present & story format */}
              {format === "story" && bestHabitName && (
                <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="min-w-0 text-start">
                    <p className="text-[9px] font-semibold text-amber-300 uppercase tracking-wider">
                      {t("shareCard.bestHabit", "Star Habit")}
                    </p>
                    <p className="text-xs font-bold text-white truncate">{bestHabitName}</p>
                  </div>
                </div>
              )}

              {/* Footer Quote */}
              <div className="mt-2 pt-2 border-t border-white/5 text-center">
                <p className="text-[9px] italic text-slate-400">
                  “{t("shareCard.motto", "Small daily rhythms build legendary outcomes.")}”
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={isGenerating}
              className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-8"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 me-1 text-emerald-400" />
                  <span>{t("shareCard.copied", "Copied!")}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 me-1" />
                  <span>{t("shareCard.copyImage", "Copy Image")}</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isGenerating}
              className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 me-1" />
              <span>{t("shareCard.downloadPng", "Download PNG")}</span>
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleShare}
            disabled={isGenerating}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs h-8 gap-1.5 shadow-md shadow-amber-500/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t("shareCard.generating", "Generating...")}</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>{t("shareCard.shareNow", "Share Story")}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
