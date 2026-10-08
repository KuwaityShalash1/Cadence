import { useState, useMemo } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Crown,
  Flame,
  Layers,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Target,
  Trophy,
  PartyPopper,
} from "lucide-react";

import type { GamificationBadge, BadgeRarity } from "@/services/gamification";
import { useTranslation } from "@/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { triggerBadgeUnlockCelebration } from "@/lib/celebration";

type FilterTab = "all" | "unlocked" | "in_progress";

interface AchievementsSectionProps {
  badges: GamificationBadge[];
  className?: string;
  onBadgeUnlocked?: (badge: GamificationBadge) => void;
}

/** Render appropriate Lucide icon by name */
function BadgeIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "Flame":
      return <Flame className={className} />;
    case "Crown":
      return <Crown className={className} />;
    case "Award":
      return <Award className={className} />;
    case "Target":
      return <Target className={className} />;
    case "Layers":
      return <Layers className={className} />;
    case "Sunrise":
      return <Sunrise className={className} />;
    case "Moon":
      return <Moon className={className} />;
    case "ShieldCheck":
      return <ShieldCheck className={className} />;
    case "Trophy":
      return <Trophy className={className} />;
    case "Sparkles":
    default:
      return <Sparkles className={className} />;
  }
}

/** Visual tier configuration for Bronze, Silver, Gold, and Legendary/Holographic */
const RARITY_CONFIG: Record<
  BadgeRarity,
  {
    nameKey: string;
    defaultName: string;
    unlockedCard: string;
    unlockedIconBox: string;
    unlockedRarityBadge: string;
    lockedRarityBadge: string;
    unlockedGlowClass: string;
    progressClass: string;
    gradientRing: string;
  }
> = {
  bronze: {
    nameKey: "dashboard.badgeRarityBronze",
    defaultName: "Bronze",
    unlockedCard:
      "badge-tier-bronze-unlocked hover:shadow-lg hover:shadow-amber-900/20 dark:hover:shadow-amber-900/30",
    unlockedIconBox:
      "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 text-amber-50 shadow-md shadow-amber-900/30 ring-1 ring-amber-400/50",
    unlockedRarityBadge: "bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-600/30",
    lockedRarityBadge:
      "bg-amber-950/10 text-amber-800/80 dark:text-amber-400/70 border-amber-800/20",
    unlockedGlowClass: "shadow-[0_0_14px_rgba(217,119,6,0.3)]",
    progressClass: "bg-amber-600",
    gradientRing: "from-amber-600 to-amber-800",
  },
  silver: {
    nameKey: "dashboard.badgeRaritySilver",
    defaultName: "Silver",
    unlockedCard:
      "badge-tier-silver-unlocked hover:shadow-lg hover:shadow-slate-500/20 dark:hover:shadow-slate-500/25",
    unlockedIconBox:
      "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-slate-50 shadow-md shadow-slate-700/30 ring-1 ring-slate-300/60",
    unlockedRarityBadge: "bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-400/30",
    lockedRarityBadge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/20",
    unlockedGlowClass: "shadow-[0_0_16px_rgba(148,163,184,0.35)]",
    progressClass: "bg-slate-500",
    gradientRing: "from-slate-300 to-slate-500",
  },
  gold: {
    nameKey: "dashboard.badgeRarityGold",
    defaultName: "Gold",
    unlockedCard:
      "badge-tier-gold-unlocked hover:shadow-xl hover:shadow-amber-500/30 dark:hover:shadow-amber-500/35",
    unlockedIconBox:
      "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-amber-950 shadow-md shadow-amber-500/40 ring-1 ring-amber-200/80",
    unlockedRarityBadge:
      "bg-amber-400/20 text-amber-900 dark:text-amber-200 border-amber-400/50 font-bold",
    lockedRarityBadge: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-400/20",
    unlockedGlowClass: "shadow-[0_0_22px_rgba(245,158,11,0.4)]",
    progressClass: "bg-amber-500",
    gradientRing: "from-amber-400 to-yellow-500",
  },
  diamond: {
    nameKey: "dashboard.badgeRarityLegendary",
    defaultName: "Legendary",
    unlockedCard:
      "badge-tier-legendary-unlocked hover:shadow-2xl hover:shadow-purple-500/35 dark:hover:shadow-purple-500/40 overflow-hidden",
    unlockedIconBox:
      "bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 text-white shadow-xl shadow-purple-500/40 ring-1 ring-cyan-200/80 animate-holographic-prism",
    unlockedRarityBadge:
      "bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 text-purple-900 dark:text-purple-200 border-purple-400/60 font-bold shadow-xs",
    lockedRarityBadge: "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-400/20",
    unlockedGlowClass: "shadow-[0_0_26px_rgba(168,85,247,0.45),0_0_12px_rgba(6,182,212,0.35)]",
    progressClass: "bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500",
    gradientRing: "from-cyan-400 via-purple-500 to-pink-500",
  },
};

export function AchievementsSection({ badges, className }: AchievementsSectionProps) {
  const { t, isRtl } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedBadge, setSelectedBadge] = useState<GamificationBadge | null>(null);

  const unlockedCount = useMemo(() => badges.filter((b) => b.unlocked).length, [badges]);
  const inProgressCount = badges.length - unlockedCount;

  const filteredBadges = useMemo(() => {
    switch (activeFilter) {
      case "unlocked":
        return badges.filter((b) => b.unlocked);
      case "in_progress":
        return badges.filter((b) => !b.unlocked);
      case "all":
      default:
        return badges;
    }
  }, [badges, activeFilter]);

  /** Helper to determine the remaining description */
  const getRemainingMessage = (badge: GamificationBadge): string => {
    if (badge.unlocked) {
      return t("dashboard.badgeUnlockedTooltip", "Unlocked! Milestone achieved.");
    }
    if (badge.id === "badge-early-bird") {
      return t("dashboard.badgeRemainingEarly", "Complete before 8:00 AM");
    }
    if (badge.id === "badge-night-owl") {
      return t("dashboard.badgeRemainingNight", "Complete after 10:00 PM");
    }
    if (badge.unit === "%") {
      const diff = Math.max(0, badge.targetValue - badge.currentValue);
      return t("dashboard.badgeRemainingPercent", { count: diff });
    }
    if (badge.unit === "days") {
      const diff = Math.max(0, badge.targetValue - badge.currentValue);
      return t("dashboard.badgeRemainingDays", { count: diff });
    }
    if (badge.unit === "habits") {
      const diff = Math.max(0, badge.targetValue - badge.currentValue);
      return t("dashboard.badgeRemainingHabits", { count: diff });
    }
    if (badge.unit === "completions") {
      const diff = Math.max(0, badge.targetValue - badge.currentValue);
      return t("dashboard.badgeRemainingCompletions", { count: diff });
    }
    const diff = Math.max(0, badge.targetValue - badge.currentValue);
    return `${diff} remaining`;
  };

  /** Helper to format the counter text on locked badges */
  const getLockedCounter = (badge: GamificationBadge): string => {
    if (badge.id === "badge-early-bird") {
      return "< 8:00 AM";
    }
    if (badge.id === "badge-night-owl") {
      return "> 10:00 PM";
    }
    if (badge.unit === "%") {
      return `${badge.currentValue}% / ${badge.targetValue}%`;
    }
    return `${badge.currentValue} / ${badge.targetValue}`;
  };

  const handleBadgeClick = (badge: GamificationBadge) => {
    setSelectedBadge(badge);
    if (badge.unlocked) {
      triggerBadgeUnlockCelebration(badge.rarity);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className={cn("border-border/80 overflow-hidden", className)}>
        <CardHeader className="p-5 pb-4 border-b border-border/50 bg-card/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Award className="h-4 w-4" />
                </span>
                {t("dashboard.achievementsBadges", "Achievements & Badges")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t(
                  "dashboard.achievementsDesc",
                  "Earn milestone badges as your consistency compounds over time.",
                )}
              </CardDescription>
            </div>

            {/* Overall unlocked counter pill */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {t("dashboard.badgesUnlockedRatio", {
                    unlocked: unlockedCount,
                    total: badges.length,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
          <div className="mt-4 flex items-center gap-1.5 border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{t("dashboard.badgeFilterAll", "All")}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px]",
                  activeFilter === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {badges.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("unlocked")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                activeFilter === "unlocked"
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Check className="h-3 w-3" />
              <span>{t("dashboard.badgeFilterUnlocked", "Unlocked")}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px]",
                  activeFilter === "unlocked"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {unlockedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("in_progress")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                activeFilter === "in_progress"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Lock className="h-3 w-3" />
              <span>{t("dashboard.badgeFilterInProgress", "In Progress")}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px]",
                  activeFilter === "in_progress"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {inProgressCount}
              </span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-4">
          {filteredBadges.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t("dashboard.badgeEmptyFilter", "No badges in this filter.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredBadges.map((badge: GamificationBadge) => {
                const config = RARITY_CONFIG[badge.rarity] ?? RARITY_CONFIG.bronze;
                const remainingText = getRemainingMessage(badge);
                const lockedCounter = getLockedCounter(badge);

                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleBadgeClick(badge)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleBadgeClick(badge);
                          }
                        }}
                        className={cn(
                          "group relative flex flex-col justify-between p-3.5 rounded-xl border text-start transition-all duration-300 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                          badge.unlocked
                            ? cn(
                                config.unlockedCard,
                                "scale-100 hover:scale-[1.03] transition-transform",
                              )
                            : "border-border/60 bg-muted/20 opacity-80 hover:opacity-100 hover:border-border",
                        )}
                      >
                        {/* Shimmer effect for Legendary/Diamond badges */}
                        {badge.unlocked && badge.rarity === "diamond" && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                          >
                            <div className="animate-badge-sheen absolute -inset-full bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent" />
                          </div>
                        )}

                        {/* Warm glow for Gold badges */}
                        {badge.unlocked && badge.rarity === "gold" && (
                          <div
                            aria-hidden="true"
                            className={cn(
                              "pointer-events-none absolute -top-10 h-24 w-24 rounded-full bg-amber-400/20 blur-xl animate-badge-pulse-glow",
                              isRtl ? "-left-10" : "-right-10",
                            )}
                          />
                        )}

                        {/* Top row: Icon + Rarity & Status pills */}
                        <div className="flex items-start gap-3">
                          {/* Badge Icon container */}
                          <div
                            className={cn(
                              "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-all duration-300",
                              badge.unlocked
                                ? config.unlockedIconBox
                                : "bg-muted/70 text-muted-foreground border border-border/50",
                            )}
                          >
                            <BadgeIcon name={badge.icon} className="h-5 w-5" />

                            {/* Locked miniature indicator */}
                            {!badge.unlocked && (
                              <div
                                className={cn(
                                  "absolute -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-background border border-border shadow-xs text-muted-foreground",
                                  isRtl ? "-left-1" : "-right-1",
                                )}
                              >
                                <Lock className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>

                          {/* Titles and Pills */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold truncate text-foreground">
                                {t(`dashboard.badge.${badge.id}.title`, badge.title)}
                              </p>

                              {/* Rarity & Unlocked status pills */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border",
                                    badge.unlocked
                                      ? config.unlockedRarityBadge
                                      : config.lockedRarityBadge,
                                  )}
                                >
                                  {t(config.nameKey, config.defaultName)}
                                </span>

                                {badge.unlocked ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {t("dashboard.badgeUnlocked", "Unlocked")}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                                    {lockedCounter}
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {t(`dashboard.badge.${badge.id}.desc`, badge.description)}
                            </p>
                          </div>
                        </div>

                        {/* Bottom row: Progress bar & remaining counter for locked badges */}
                        {!badge.unlocked && (
                          <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/80">
                                {remainingText}
                              </span>
                              <span className="font-semibold text-foreground/90">
                                {badge.progress}%
                              </span>
                            </div>
                            <Progress value={badge.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>

                    <TooltipContent side="top" className="max-w-xs text-xs space-y-1 p-2.5">
                      <div className="flex items-center justify-between gap-2 border-b border-primary-foreground/20 pb-1 font-semibold">
                        <span>{t(`dashboard.badge.${badge.id}.title`, badge.title)}</span>
                        <span className="text-[10px] opacity-80 uppercase">
                          {t(config.nameKey, config.defaultName)}
                        </span>
                      </div>
                      <p className="opacity-90">
                        {t(`dashboard.badge.${badge.id}.desc`, badge.description)}
                      </p>
                      <div className="text-[11px] pt-1 text-primary-foreground/90 font-medium">
                        {badge.unlocked ? (
                          <span className="flex items-center gap-1 text-emerald-300">
                            <Check className="h-3 w-3" />
                            {t("dashboard.badgeUnlockedTooltip", "Unlocked! Milestone achieved.")}
                          </span>
                        ) : (
                          <span>{remainingText}</span>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Badge Detail & Celebration Dialog ─────────────────────────────── */}
      {selectedBadge && (
        <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
          <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden bg-card border-border shadow-2xl">
            {(() => {
              const config = RARITY_CONFIG[selectedBadge.rarity] ?? RARITY_CONFIG.bronze;
              const title = t(`dashboard.badge.${selectedBadge.id}.title`, selectedBadge.title);
              const desc = t(`dashboard.badge.${selectedBadge.id}.desc`, selectedBadge.description);

              return (
                <div>
                  <DialogHeader className="p-6 pb-4 text-center items-center border-b border-border/50 bg-muted/20">
                    {/* Enlarged Badge Icon with Tier Halo */}
                    <div
                      className={cn(
                        "grid h-20 w-20 place-items-center rounded-2xl mb-3 transition-transform hover:scale-105",
                        selectedBadge.unlocked
                          ? config.unlockedIconBox
                          : "bg-muted text-muted-foreground border border-border/60",
                        selectedBadge.unlocked && config.unlockedGlowClass,
                      )}
                    >
                      <BadgeIcon name={selectedBadge.icon} className="h-10 w-10" />
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "uppercase text-[10px] tracking-wider font-bold px-2 py-0.5",
                          selectedBadge.unlocked
                            ? config.unlockedRarityBadge
                            : config.lockedRarityBadge,
                        )}
                      >
                        {t(config.nameKey, config.defaultName)}
                      </Badge>
                      {selectedBadge.unlocked && (
                        <Badge
                          variant="default"
                          className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <Check className="h-3 w-3 me-1" />
                          {t("dashboard.badgeUnlocked", "Unlocked")}
                        </Badge>
                      )}
                    </div>

                    <DialogTitle className="text-lg font-bold text-foreground">{title}</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground max-w-xs mt-1">
                      {desc}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-5 space-y-4 text-center">
                    {selectedBadge.unlocked ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                          {t("dashboard.badgeUnlockedTooltip", "Unlocked! Milestone achieved.")}
                        </div>

                        <Button
                          type="button"
                          onClick={() => triggerBadgeUnlockCelebration(selectedBadge.rarity)}
                          className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs h-9 shadow-md shadow-amber-500/20"
                        >
                          <PartyPopper className="h-4 w-4" />
                          <span>{t("dashboard.badgeCelebrateAgain", "Celebrate Again!")}</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5 text-start">
                          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                            <span>{t("dashboard.progress", "Progress")}</span>
                            <span>{selectedBadge.progress}%</span>
                          </div>
                          <Progress value={selectedBadge.progress} className="h-2" />
                          <p className="text-[11px] text-muted-foreground text-center pt-1">
                            {getRemainingMessage(selectedBadge)}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedBadge(null)}
                      className="w-full text-xs h-8"
                    >
                      {t("dashboard.close", "Close")}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </TooltipProvider>
  );
}
