import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Flame,
  Layers,
  LogOut,
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
  Settings,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { useAuth } from "@/auth/auth-context";
import { useSync } from "@/context/sync-context";
import { useApp } from "@/stores/app-store";
import { supabase } from "@/lib/supabase";
import { calculateGamificationStats, type GamificationBadge } from "@/services/gamification";
import { HabitIcon, getColorStyle } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { extractUserAvatarUrl, extractUserDisplayName } from "@/lib/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Map badge icon names to Lucide icons */
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
    case "Sparkles":
    default:
      return <Sparkles className={className} />;
  }
}

export function UserDashboard() {
  const { user: authUser, session, signOut, isConfigured } = useAuth();
  const { habits, logMap, settings } = useApp();
  const { isOnline, isSyncing, isRealtimeConnected, pendingCount, lastSyncedAt, triggerSync } =
    useSync();

  const [refreshedUser, setRefreshedUser] = useState<SupabaseUser | null>(null);
  const [isSyncTriggering, setIsSyncTriggering] = useState(false);

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

  const email = activeUser?.email ?? "Offline Guest Mode";
  const authProvider = activeUser?.app_metadata?.["provider"]
    ? String(activeUser.app_metadata["provider"]).toUpperCase()
    : session
      ? "SUPABASE"
      : "LOCAL";

  const memberSince = activeUser?.created_at
    ? new Date(activeUser.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Local Device";

  // Compute optimized gamification and streak statistics
  const stats = useMemo(() => calculateGamificationStats(habits, logMap), [habits, logMap]);

  const handleManualSync = async () => {
    if (isSyncTriggering || isSyncing) return;
    setIsSyncTriggering(true);
    try {
      const result = await triggerSync();
      if (result) {
        toast.success("Synchronized successfully with cloud.");
      } else {
        toast.info("Data is already up to date.");
      }
    } catch {
      toast.error("Failed to sync data with cloud.");
    } finally {
      setIsSyncTriggering(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully.");
    } catch {
      toast.error("Error signing out.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. User Profile & Cloud Sync Hero Card ────────────────────────── */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
        <div className="absolute end-0 top-0 h-48 w-48 -translate-y-12 translate-x-12 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* User Avatar + Identity */}
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  avatar={avatarUrl || (!avatarUrl && settings.avatar ? settings.avatar : undefined)}
                  name={fullName}
                  className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-border/80 shadow-md ring-4 ring-primary/10"
                  fallbackClassName="text-2xl font-bold"
                  iconClassName="h-10 w-10 text-muted-foreground"
                />
                {/* Realtime Live Indicator Dot */}
                <span
                  title={isRealtimeConnected ? "Realtime sync connected" : "Offline"}
                  className={cn(
                    "absolute bottom-1 end-1 h-4 w-4 rounded-full border-2 border-card ring-1",
                    isRealtimeConnected
                      ? "bg-emerald-500 ring-emerald-300 animate-pulse"
                      : isOnline
                        ? "bg-amber-400 ring-amber-200"
                        : "bg-slate-400 ring-slate-200",
                  )}
                />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate text-foreground">
                    {fullName}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5"
                  >
                    {authProvider}
                  </Badge>
                  {isRealtimeConnected && (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5"
                    >
                      <Radio className="h-3 w-3 animate-pulse" />
                      Live Sync
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground truncate">{email}</p>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Member since {memberSince}
                  </span>
                  {lastSyncedAt && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Synced{" "}
                      {new Date(lastSyncedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-amber-500 font-medium">
                      ({pendingCount} pending cloud upload)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9"
                onClick={handleManualSync}
                disabled={isSyncTriggering || isSyncing || !isOnline}
              >
                <RefreshCw
                  className={cn("h-4 w-4", (isSyncTriggering || isSyncing) && "animate-spin")}
                />
                <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
              </Button>

              <Link to="/settings">
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Button>
              </Link>

              {session ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </Button>
                  <DeleteAccountDialog />
                </div>
              ) : (
                <Link to="/auth">
                  <Button size="sm" className="gap-2 h-9 font-medium shadow-xs">
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Hero Gamification Statistics Grid ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Current Streak */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Streak
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
                <Flame className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.currentStreak}
              </span>
              <span className="text-xs font-medium text-muted-foreground">days</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.currentStreak > 0
                ? "Active streak in progress"
                : "Complete a habit today to start"}
            </p>
          </CardContent>
        </Card>

        {/* Longest Streak */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Longest Streak
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
              <span className="text-xs font-medium text-muted-foreground">days</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Personal all-time record</p>
          </CardContent>
        </Card>

        {/* Weekly Completion Rate */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Weekly Rate
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
            <p className="mt-1 text-xs text-muted-foreground">Last 7 days completion</p>
          </CardContent>
        </Card>

        {/* Monthly Completion Rate */}
        <Card className="border-border/70 bg-card/80 transition-all duration-200 hover:shadow-md">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Rate
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
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.perfectDaysCount} perfect days in last 30d
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
                  Level {stats.level.level} — {stats.level.title}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Keep completing habits daily to unlock higher ranks and milestone badges.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-xs px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              >
                {stats.xpPoints} XP
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Rank Progress</span>
                <span>{stats.level.progressPercentage}%</span>
              </div>
              <Progress value={stats.level.progressPercentage} className="h-2.5 rounded-full" />
              <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>{stats.level.currentXp} XP</span>
                <span>Next tier at {stats.level.nextLevelXp} XP</span>
              </div>
            </div>

            {/* Weekly Rhythm Mini Timeline */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  7-Day Rhythm
                </span>
                <span className="text-xs text-muted-foreground">
                  {stats.weeklyBreakdown.filter((d) => d.completed > 0).length} of 7 days active
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center">
                {stats.weeklyBreakdown.map((day) => (
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
                    <span className="text-[11px] font-semibold">{day.dayLabel}</span>
                    <span className="text-xs font-bold mt-1">
                      {day.completed}/{day.scheduled}
                    </span>
                    <span className="text-[9px] opacity-75 mt-0.5">
                      {day.scheduled > 0
                        ? `${Math.round((day.completed / day.scheduled) * 100)}%`
                        : "Rest"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Habit Streak Spotlight */}
        <Card className="border-border/80 flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Streak Leader
            </CardTitle>
            <CardDescription className="text-xs">
              Your most consistent habit right now.
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
                      <span>{stats.streakLeader.streak} days running streak</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep it going today to maintain your momentum!
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto opacity-50 mb-2" />
                <p className="text-xs">No active habit streaks yet.</p>
                <p className="text-[11px] mt-0.5">
                  Complete habits consecutively to unlock leaders.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Gamification Badges & Achievements ────────────────────────── */}
      <Card className="border-border/80">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Achievements & Badges
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Earn milestone badges as your consistency compounds over time.
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {stats.badges.filter((b) => b.unlocked).length} of {stats.badges.length} Unlocked
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.badges.map((badge: GamificationBadge) => (
              <div
                key={badge.id}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border transition-all",
                  badge.unlocked
                    ? "border-primary/30 bg-primary/5 text-foreground shadow-xs"
                    : "border-border/50 bg-muted/20 opacity-70",
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    badge.unlocked
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <BadgeIcon name={badge.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold truncate">{badge.title}</p>
                    {badge.unlocked ? (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{badge.progress}%</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
                  {!badge.unlocked && <Progress value={badge.progress} className="h-1.5 mt-2" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Account Security & Danger Zone ───────────────────────────── */}
      {session && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Account Security & Danger Zone
            </CardTitle>
            <CardDescription className="text-xs">
              Permanently delete your account, synced habits, streaks, and all cloud backups from Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Once deleted, your cloud account and habit history cannot be recovered.
            </p>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      )}

      {/* ── 6. Analytics Link & Data Overview Footer ─────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60 text-xs text-muted-foreground">
        <div>
          <span>Total Habits: </span>
          <strong className="text-foreground">{stats.activeHabitsCount}</strong>
          <span className="mx-2">•</span>
          <span>Total Completions: </span>
          <strong className="text-foreground">{stats.totalCompletions}</strong>
          <span className="mx-2">•</span>
          <span>Storage: </span>
          <strong className="text-foreground">IndexedDB (Offline-First) + Supabase Realtime</strong>
        </div>

        <Link
          to="/stats"
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          <span>Explore deep analytics & charts</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
