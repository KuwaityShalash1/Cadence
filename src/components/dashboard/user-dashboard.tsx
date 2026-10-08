import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Cloud,
  CloudOff,
  Crown,
  Flame,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  User,
  Zap,
  ArrowRight,
  Radio,
  Clock,
  LogIn,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { useAuth } from "@/auth/auth-context";
import { useTranslation } from "@/i18n";
import { useSync } from "@/context/sync-context";
import { useApp } from "@/stores/app-store";
import { supabase } from "@/lib/supabase";
import { calculateGamificationStats } from "@/services/gamification";
import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import { extractUserAvatarUrl, extractUserDisplayName } from "@/lib/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AchievementsSection } from "./achievements-section";


export function UserDashboard() {
  const { t, language } = useTranslation();
  const { user: authUser, session, isConfigured } = useAuth();
  const { habits, logMap, settings } = useApp();
  const { isOnline, isSyncing, isRealtimeConnected, pendingCount, lastSyncedAt } = useSync();

  const [refreshedUser, setRefreshedUser] = useState<SupabaseUser | null>(null);

  // Retrieve latest authenticated user metadata from Supabase
  useEffect(() => {
    if (isConfigured && session) {
      let isMounted = true;
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!error && data?.user && isMounted) {
          setRefreshedUser(data.user);
        }
      });
      return () => {
        isMounted = false;
      };
    }
    return undefined;
  }, [isConfigured, session]);

  const activeUser = refreshedUser ?? authUser;

  // Extract metadata attributes directly from Supabase session metadata with sensible fallbacks
  const fullName = extractUserDisplayName(activeUser, settings.displayName);
  const avatarUrl = extractUserAvatarUrl(activeUser, settings.avatar);

  const email = activeUser?.email ?? t("dashboard.guestMode", "Offline Guest Mode");
  const authProvider = activeUser?.app_metadata?.["provider"]
    ? String(activeUser.app_metadata["provider"]).toUpperCase()
    : session
      ? "SUPABASE"
      : "LOCAL";

  const memberSince = activeUser?.created_at
    ? new Date(activeUser.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Compute optimized gamification and streak statistics
  const stats = useMemo(() => calculateGamificationStats(habits, logMap), [habits, logMap]);

  return (
    <div className="space-y-6">
      {/* ── 1. Condensed User Profile & Cloud Sync Bar ─────────────────── */}
      <Card className="border-border/80 bg-card/90 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* User Avatar + Identity (Compact) */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  avatar={
                    avatarUrl || (!avatarUrl && settings.avatar ? settings.avatar : undefined)
                  }
                  name={fullName}
                  className="h-10 w-10 border border-border/80 shadow-2xs"
                  fallbackClassName="text-sm font-semibold"
                  iconClassName="h-5 w-5 text-muted-foreground"
                />
                {/* Realtime Live Indicator Dot */}
                <span
                  title={
                    isRealtimeConnected
                      ? t("dashboard.realtimeConnected", "Realtime sync connected")
                      : t("dashboard.offline", "Offline")
                  }
                  className={cn(
                    "absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card ring-1",
                    isRealtimeConnected
                      ? "bg-emerald-500 ring-emerald-300 animate-pulse"
                      : isOnline
                        ? "bg-amber-400 ring-amber-200"
                        : "bg-slate-400 ring-slate-200",
                  )}
                />
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate text-foreground">
                    {fullName}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-medium tracking-wide uppercase px-1.5 py-0 h-4"
                  >
                    {authProvider}
                  </Badge>
                  {isRealtimeConnected && (
                    <Badge
                      variant="outline"
                      className="text-[9px] gap-1 font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 h-4"
                    >
                      <Radio className="h-2.5 w-2.5 animate-pulse" />
                      {t("dashboard.liveSync", "Live Sync")}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                  <span className="truncate">{email}</span>
                  <span className="hidden md:inline-flex items-center gap-1">
                    •{" "}
                    {memberSince
                      ? t("dashboard.memberSince", { date: memberSince })
                      : t("dashboard.localDevice", "Local Device")}
                  </span>
                  {lastSyncedAt && (
                    <span className="hidden sm:inline-flex items-center gap-1">
                      •{" "}
                      {t("dashboard.syncedAt", {
                        time: new Date(lastSyncedAt).toLocaleTimeString(
                          language === "ar" ? "ar-SA" : "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        ),
                      })}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-amber-500 font-medium">
                      • {t("dashboard.pendingUpload", { count: pendingCount })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sync status indicator + Quick Actions */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground select-none"
                aria-live="polite"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-foreground">{t("dashboard.syncing", "Syncing…")}</span>
                  </>
                ) : !isOnline ? (
                  <>
                    <CloudOff className="h-3 w-3 text-muted-foreground" />
                    <span>{t("dashboard.offline", "Offline")}</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3 text-emerald-500" />
                    <span className="text-foreground/90">{t("dashboard.synced", "Synced")}</span>
                  </>
                )}
              </div>

              {!session && (
                <Link to="/auth">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 px-2.5 text-xs font-medium"
                  >
                    <LogIn className="h-3 w-3" />
                    <span>{t("dashboard.signIn", "Sign In")}</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Gamification Statistics Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Current Streak — Primary Gamification Metric */}
        <Card className="relative overflow-hidden border-amber-500/40 dark:border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card dark:from-amber-500/20 dark:via-card/90 dark:to-card ring-1 ring-amber-500/20 dark:ring-amber-500/30 shadow-xs shadow-amber-500/10 transition-all duration-200 hover:shadow-md hover:border-amber-500/60">
          <div className="absolute -top-8 -end-8 h-28 w-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <CardHeader className="p-4 pb-2 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {t("dashboard.currentStreak", "Current Streak")}
                </span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {t("dashboard.hero", "Hero")}
                </span>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30">
                <Flame className="h-5 w-5 fill-current" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 relative z-10">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                {stats.currentStreak}
              </span>
              <span className="text-sm font-semibold text-amber-600/90 dark:text-amber-400/90">
                {t("dashboard.days", "days")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              {stats.currentStreak > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <span className="font-medium text-foreground/90">
                    {t("dashboard.activeStreakInProgress", "Active streak in progress")}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {t("dashboard.completeHabitTodayToStart", "Complete a habit today to start")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Longest Streak */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md hover:border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard.longestStreak", "Longest Streak")}
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.longestStreak}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {t("dashboard.days", "days")}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("dashboard.personalRecord", "Personal all-time record")}
            </p>
          </CardContent>
        </Card>

        {/* Weekly Completion Rate */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md hover:border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard.weeklyRate", "Weekly Rate")}
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Target className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.weeklyRate}%
              </span>
              {stats.weeklyTrend !== 0 && (
                <span
                  className={cn(
                    "flex items-center text-xs font-medium",
                    stats.weeklyTrend > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-500",
                  )}
                >
                  {stats.weeklyTrend > 0 ? (
                    <TrendingUp className="h-3 w-3 me-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 me-0.5" />
                  )}
                  {Math.abs(stats.weeklyTrend)}%
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("dashboard.last7DaysCompletion", "Last 7 days completion")}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Completion Rate */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md hover:border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard.monthlyRate", "Monthly Rate")}
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.monthlyRate}%
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("dashboard.perfectDaysIn30d", { count: stats.perfectDaysCount })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Gamification Level Progression & Weekly Rhythm ────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Level Progression */}
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t("dashboard.levelDisplay", {
                    level: stats.level.level,
                    title: t(`dashboard.level.${stats.level.title}`, stats.level.title),
                  })}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t(
                    "dashboard.levelDesc",
                    "Keep completing habits daily to unlock higher ranks and milestone badges.",
                  )}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-xs px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              >
                {t("dashboard.xp", { count: stats.xpPoints })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{t("dashboard.rankProgress", "Rank Progress")}</span>
                <span>{stats.level.progressPercentage}%</span>
              </div>
              <Progress value={stats.level.progressPercentage} className="h-2.5 rounded-full" />
              <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>{t("dashboard.xp", { count: stats.level.currentXp })}</span>
                <span>{t("dashboard.nextTierAt", { xp: stats.level.nextLevelXp })}</span>
              </div>
            </div>

            {/* Weekly Rhythm Mini Timeline */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.sevenDayRhythm", "7-Day Rhythm")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.daysActiveRatio", {
                    count: stats.weeklyBreakdown.filter((d) => d.completed > 0).length,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center">
                {stats.weeklyBreakdown.map((day) => {
                  const formattedDayLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
                    language === "ar" ? "ar-SA" : "en-US",
                    { weekday: "narrow" },
                  );
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                        day.isComplete
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : day.completed > 0
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/40 text-muted-foreground",
                        day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    >
                      <span className="text-[11px] font-semibold">{formattedDayLabel}</span>
                      <span className="text-xs font-bold mt-1">
                        {day.completed}/{day.scheduled}
                      </span>
                      <span className="text-[9px] opacity-75 mt-0.5">
                        {day.scheduled > 0
                          ? `${Math.round((day.completed / day.scheduled) * 100)}%`
                          : t("dashboard.rest", "Rest")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Habit Streak Spotlight */}
        <Card className="border-border/80 flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              {t("dashboard.streakLeader", "Streak Leader")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("dashboard.streakLeaderDesc", "Your most consistent habit right now.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
            {stats.streakLeader ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const habitAccent = getColorStyle(stats.streakLeader.color);
                    return (
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={habitAccent.style}
                      >
                        <HabitIcon
                          name={stats.streakLeader.icon}
                          className="h-5 w-5"
                          style={{ color: habitAccent.rawColor }}
                        />
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">
                      {stats.streakLeader.name}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      <span>
                        {t("dashboard.daysRunningStreak", { count: stats.streakLeader.streak })}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.keepItGoing", "Keep it going today to maintain your momentum!")}
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto opacity-50 mb-2" />
                <p className="text-xs">
                  {t("dashboard.noActiveStreaks", "No active habit streaks yet.")}
                </p>
                <p className="text-[11px] mt-0.5">
                  {t(
                    "dashboard.unlockLeadersDesc",
                    "Complete habits consecutively to unlock leaders.",
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Gamification Badges & Achievements ────────────────────────── */}
      <AchievementsSection badges={stats.badges} />

      {/* ── 6. Analytics Link & Data Overview Footer ─────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60 text-xs text-muted-foreground">
        <div>
          <span>{t("dashboard.totalHabits", "Total Habits:")} </span>
          <strong className="text-foreground">{stats.activeHabitsCount}</strong>
          <span className="mx-2">•</span>
          <span>{t("dashboard.totalCompletions", "Total Completions:")} </span>
          <strong className="text-foreground">{stats.totalCompletions}</strong>
          <span className="mx-2">•</span>
          <span>{t("dashboard.storage", "Storage:")} </span>
          <strong className="text-foreground">
            {t("dashboard.storageDesc", "IndexedDB (Offline-First) + Supabase Realtime")}
          </strong>
        </div>

        <Link
          to="/stats"
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          <span>{t("dashboard.exploreAnalytics", "Explore deep analytics & charts")}</span>
          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
