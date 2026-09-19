import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChartBar as BarChart3,
  CalendarDays,
  ListChecks,
  Plus,
  Settings,
  Sun,
  Target,
  User,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  Menu,
  Moon,
  Monitor,
} from "lucide-react";
import type { ReactNode } from "react";

import { HabitEditorProvider, useHabitEditor } from "@/features/habits/habit-editor";
import { TimerDock } from "@/components/timer-dock";
import { Button } from "@/components/ui/button";
import { CadenceLogo } from "@/components/ui/CadenceLogo";

const LogoIcon = (props: { className?: string; [key: string]: any }) => (
  <CadenceLogo showText={false} iconClassName={props.className} {...props} />
);
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { playClickSound, playToggleSound } from "@/lib/sound";

const NAV_ITEMS = [
  { label: "Today", icon: Sun, to: "/" as const, exact: true },
  { label: "Calendar", icon: CalendarDays, to: "/calendar" as const, exact: false },
  { label: "Analytics", icon: BarChart3, to: "/stats" as const, exact: false },
  { label: "Goals", icon: Target, to: "/goals" as const, exact: false },
  { label: "Routines", icon: ListChecks, to: "/routines" as const, exact: false },
  { label: "Quit Tracker", icon: ShieldAlert, to: "/quit-tracker" as const, exact: false },
];

const MOBILE_NAV = [
  { label: "Today", icon: Sun, to: "/" as const, exact: true },
  { label: "Routines", icon: ListChecks, to: "/routines" as const, exact: false },
  { label: "Goals", icon: Target, to: "/goals" as const, exact: false },
  { label: "Quit Tracker", icon: ShieldAlert, to: "/quit-tracker" as const, exact: false },
];

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function UserAvatar({
  avatar,
  name,
  className = "h-8 w-8",
}: {
  avatar?: string | undefined;
  name?: string | undefined;
  className?: string | undefined;
}) {
  const initials = getInitials(name);

  if (avatar) {
    if (
      avatar.startsWith("data:") ||
      avatar.startsWith("http://") ||
      avatar.startsWith("https://")
    ) {
      return (
        <Avatar className={className}>
          <AvatarImage src={avatar} alt={name?.trim() || "User"} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
            {initials || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      );
    }
    // Emoji avatar
    return (
      <Avatar className={className}>
        <AvatarFallback className="bg-primary/10 text-lg flex items-center justify-center">
          {avatar}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
        {initials || <User className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <HabitEditorProvider>
      <Shell>{children}</Shell>
    </HabitEditorProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const editor = useHabitEditor();
  const { settings, ready, isSidebarCollapsed, toggleSidebar } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [enableSidebarTransition, setEnableSidebarTransition] = useState(false);
  const displayName = settings.displayName?.trim() || "User";
  const isRtl = false;

  const handleToggleSidebar = () => {
    playToggleSound(!isSidebarCollapsed);
    toggleSidebar();
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Enable transitions one render after hydration so the first settled
    // sidebar state is painted without animating from the SSR placeholder.
    const frame = window.requestAnimationFrame(() => setEnableSidebarTransition(true));
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (isSidebarCollapsed) {
      document.documentElement.setAttribute("data-sidebar-collapsed", "true");
    } else {
      document.documentElement.removeAttribute("data-sidebar-collapsed");
    }
  }, [isSidebarCollapsed]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        data-collapsed={isSidebarCollapsed ? "true" : "false"}
        className={cn(
          "hidden md:flex flex-col h-screen border-r border-border bg-sidebar py-3 shrink-0 select-none overflow-hidden",
          !(isMounted && ready) && "invisible",
          enableSidebarTransition && "transition-[width] duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16 items-center" : "w-64 px-3",
        )}
      >
        {/* SIDEBAR HEADER CONTAINER */}
        <div
          className={cn(
            "flex h-14 w-full items-center border-b border-border/40 shrink-0",
            enableSidebarTransition && "transition-all duration-200",
            isSidebarCollapsed ? "justify-center px-0" : "justify-between px-3 mb-2",
          )}
        >
          {isSidebarCollapsed ? (
            /* COLLAPSED HEADER BUTTON - LOGO ALWAYS VISIBLE BY DEFAULT */
            <button
              onClick={handleToggleSidebar}
              type="button"
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-primary hover:bg-accent/60 transition-all duration-200 overflow-hidden"
              title="Expand Sidebar"
            >
              {/* Static Default Logo */}
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 group-hover:opacity-0 group-hover:scale-75 pointer-events-none">
                <CadenceLogo iconClassName="h-6 w-6 text-primary" showText={false} />
              </div>
              {/* Hover Arrow */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 pointer-events-none">
                <PanelLeftOpen className="h-5 w-5 text-foreground" />
              </div>
            </button>
          ) : (
            /* EXPANDED HEADER CONTAINER */
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CadenceLogo iconClassName="h-6 w-6 text-primary shrink-0" showText={false} />
                <span className="font-semibold text-base tracking-tight truncate">Cadence</span>
              </div>
              <button
                onClick={handleToggleSidebar}
                type="button"
                className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
                title="Collapse Sidebar"
              >
                <PanelLeft className="h-5 w-5 transition-all duration-200 group-hover:opacity-0 group-hover:scale-90 absolute" />
                <PanelLeftClose className="h-5 w-5 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 absolute" />
              </button>
            </div>
          )}
        </div>

        <nav
          className={cn(
            "flex flex-col gap-1.5 w-full flex-1",
            isSidebarCollapsed ? "items-center px-2" : "px-0",
          )}
        >
          {NAV_ITEMS.map((item) => {
            const linkContent = (
              <Link
                key={item.label}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className={cn(
                  "flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary",
                  isSidebarCollapsed ? "h-11 w-11 justify-center" : "h-10 w-full px-3 gap-3",
                )}
              >
                <item.icon className="h-[22px] w-[22px] shrink-0" />
                <span
                  className={cn(
                    "text-sm font-medium sidebar-label",
                    isSidebarCollapsed && "hidden",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            return isSidebarCollapsed ? (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side={isRtl ? "left" : "right"}>{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              linkContent
            );
          })}

          {(() => {
            const settingsLink = (
              <Link
                to="/settings"
                className={cn(
                  "flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary",
                  isSidebarCollapsed ? "h-11 w-11 justify-center" : "h-10 w-full px-3 gap-3",
                )}
              >
                <Settings className="h-[22px] w-[22px] shrink-0" />
                <span
                  className={cn(
                    "text-sm font-medium sidebar-label",
                    isSidebarCollapsed && "hidden",
                  )}
                >
                  Settings
                </span>
              </Link>
            );

            return (
              <div className="mt-auto flex flex-col items-center gap-1.5 w-full pt-2">
                {isSidebarCollapsed ? (
                  <Tooltip key="nav.settings">
                    <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                    <TooltipContent side={isRtl ? "left" : "right"}>Settings</TooltipContent>
                  </Tooltip>
                ) : (
                  settingsLink
                )}
              </div>
            );
          })()}
        </nav>
      </aside>

      <main className="flex-1 h-full overflow-y-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Top bar header with profile in top-right corner */}
        {/* Safe area top padding ensures the header sits below the iOS status bar / dynamic island */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:justify-end">
          <div className="md:hidden">
            <Link to="/" className="flex items-center">
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                <CadenceLogo iconClassName="w-6 h-6" textClassName="text-lg" />
              </div>
            </Link>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-full border border-border bg-card py-1 ps-1.5 pe-3 transition-colors hover:bg-accent"
          >
            <UserAvatar avatar={settings.avatar} name={settings.displayName} className="h-7 w-7" />
            <span className="max-w-32 truncate text-sm font-medium">{displayName}</span>
          </Link>
        </div>

        <div className="w-full max-w-6xl mx-auto px-6 py-6 pb-40 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
          {children}
        </div>
      </main>

      <TimerDock />

      {/* Mobile bottom nav */}
      <div className="block md:hidden border-t border-border bg-background fixed bottom-0 left-0 right-0 z-50">
        <div
          className="flex items-stretch justify-around px-2 pt-1"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </div>

      <ResponsiveSheet open={moreOpen} onOpenChange={setMoreOpen} title="More Navigation">
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              to="/calendar"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendar
            </Link>
            <Link
              to="/stats"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <BarChart3 className="h-5 w-5 text-primary" />
              Analytics
            </Link>
            <Link
              to="/settings"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Settings className="h-5 w-5 text-primary" />
              Settings
            </Link>
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
