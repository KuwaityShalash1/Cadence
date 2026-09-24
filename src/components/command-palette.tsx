import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Bug,
  CalendarDays,
  ChartBar,
  Download,
  Keyboard,
  ListChecks,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";
import { buildBackupFileName, downloadJsonBackup, markBackupComplete } from "@/lib/backup";
import { toast } from "sonner";
import {
  dispatchOpenAddModal,
  FOCUS_HABIT_SEARCH_EVENT,
  OPEN_ARCHIVED_HABITS_EVENT,
} from "@/hooks/use-shortcuts";

/**
 * Cadence command palette (⌘K / Ctrl+K) — a headless `cmdk` menu inside a Radix
 * Dialog, styled entirely with Tailwind.
 *
 * Why a hand-rolled Dialog instead of `<Command.Dialog>`: cmdk's dialog renders
 * a bare Radix Content without a Title/Description, which Radix flags in
 * development. Composing Radix directly keeps the ARIA wiring (`role="dialog"`,
 * `aria-modal`, `aria-labelledby` → the visually hidden title) correct while
 * giving us full control over the glass-morphism skin.
 *
 * This module is deliberately NEVER imported eagerly: `CommandPaletteLoader`
 * pulls it in with a dynamic `import()` the first time it is actually needed,
 * so it costs nothing on first paint.
 */

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When flipped to `true` by the loader, immediately opens the shortcuts help dialog. */
  openShortcutsHelp?: boolean;
  /** Called once the loader's `openShortcutsHelp` signal has been consumed. */
  onShortcutsHelpOpenChange?: (open: boolean) => void;
}

/**
 * Feedback form opened by the "Report a Bug / Feedback" command.
 */
const FEEDBACK_URL = "https://tally.so/r/VLgMGy";

/** Route literals are typed so TanStack Router validates every target at build time. */
type NavigationTarget =
  "/" | "/calendar" | "/stats" | "/goals" | "/routines" | "/quit-tracker" | "/settings";

interface NavigationCommand {
  to: NavigationTarget;
  /** i18n key and its English fallback travel together so they never drift. */
  labelKey: string;
  label: string;
  /** Extra search terms appended to the item value (`cmdk` matches on it). */
  keywords: string;
  icon: LucideIcon;
  /** Single-key shortcut owned by `useShortcuts`, when the route has one. */
  shortcut?: string;
}

const NAVIGATION_COMMANDS: NavigationCommand[] = [
  {
    to: "/",
    labelKey: "command.goToday",
    label: "Go to Today",
    keywords: "home today dashboard habits",
    icon: Sun,
    shortcut: "T",
  },
  {
    to: "/calendar",
    labelKey: "command.goCalendar",
    label: "Go to Calendar",
    keywords: "calendar month history heatmap",
    icon: CalendarDays,
    shortcut: "C",
  },
  {
    to: "/stats",
    labelKey: "command.goAnalytics",
    label: "Go to Analytics",
    keywords: "analytics stats charts insights progress",
    icon: ChartBar,
    shortcut: "A",
  },
  {
    to: "/goals",
    labelKey: "command.goGoals",
    label: "Go to Goals",
    keywords: "goals targets objectives",
    icon: Target,
    shortcut: "G",
  },
  {
    to: "/routines",
    labelKey: "command.goRoutines",
    label: "Go to Routines",
    keywords: "routines checklist morning evening",
    icon: ListChecks,
    shortcut: "R",
  },
  {
    to: "/quit-tracker",
    labelKey: "command.goQuitTracker",
    label: "Go to Quit Tracker",
    keywords: "quit tracker addiction streak willpower",
    icon: ShieldAlert,
    shortcut: "Q",
  },
  {
    to: "/settings",
    labelKey: "command.goSettings",
    label: "Go to Settings",
    keywords: "settings preferences data theme language backup",
    icon: Settings,
    shortcut: "S",
  },
];

/**
 * Descendant styling mirrors the shadcn `CommandDialog` defaults in
 * `src/components/ui/command.tsx`, so rows and group headings stay identical to
 * every other command surface in the app. The panel itself is transparent: the
 * glass skin lives on the Radix Content.
 */
const COMMAND_ROOT_CLASSES = cn(
  "flex h-full w-full flex-col rounded-none bg-transparent text-popover-foreground",
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground",
  "[&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0",
  "[&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:text-sm",
);

/**
 * Row skin: the active option gets a soft primary tint instead of the flat
 * `bg-accent` used by plain popovers, so the highlighted row reads clearly on a
 * translucent panel in both themes.
 */
const COMMAND_ITEM_CLASSES = cn(
  "text-foreground data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary cursor-pointer",
);

/** Small key-cap used by shortcut hints and badges. */
function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/70 bg-muted/70 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs select-none",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** "⌘K" on Apple platforms, "Ctrl K" everywhere else (resolved after mount). */
function useShortcutHint(): string {
  const [hint, setHint] = useState("Ctrl K");

  useEffect(() => {
    if (/mac|iphone|ipad|ipod/i.test(navigator.userAgent)) setHint("⌘K");
  }, []);

  return hint;
}

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcutHint: string;
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs sm:text-sm">
      <span className="text-foreground/90">{label}</span>
      <Kbd className="border-border/80 bg-muted/60 px-2 text-[10px] font-medium text-muted-foreground shadow-xs">
        {shortcut}
      </Kbd>
    </div>
  );
}

function ShortcutsHelpDialog({ open, onOpenChange, shortcutHint }: ShortcutsHelpDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Keyboard className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold">
              {t("shortcuts.title", "Keyboard Shortcuts")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              "shortcuts.description",
              "Navigate and manage Cadence with speed using single-key shortcuts.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 pb-1">
          {/* Navigation group */}
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("shortcuts.groupNavigation", "Navigation")}
            </h4>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <ShortcutRow label={t("command.goToday", "Today")} shortcut="T" />
              <ShortcutRow label={t("command.goCalendar", "Calendar")} shortcut="C" />
              <ShortcutRow label={t("command.goAnalytics", "Analytics")} shortcut="A" />
              <ShortcutRow label={t("command.goGoals", "Goals")} shortcut="G" />
              <ShortcutRow label={t("command.goRoutines", "Routines")} shortcut="R" />
              <ShortcutRow label={t("command.goQuitTracker", "Quit Tracker")} shortcut="Q" />
              <ShortcutRow label={t("command.goSettings", "Settings")} shortcut="S" />
            </div>
          </div>

          {/* Quick Actions group */}
          <div className="border-t border-border/60 pt-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("shortcuts.groupActions", "Actions")}
            </h4>
            <div className="space-y-1">
              <ShortcutRow label={t("command.title", "Command Palette")} shortcut={shortcutHint} />
              <ShortcutRow
                label={t("command.createHabit", "New Habit / Context Item")}
                shortcut="N"
              />
              <ShortcutRow label={t("command.searchPage", "Search Current Page")} shortcut="/" />
              <ShortcutRow label={t("command.shortcutsHelp", "Shortcuts Help")} shortcut="?" />
            </div>
          </div>

          {/* Command Palette Controls */}
          <div className="border-t border-border/60 pt-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("shortcuts.groupPalette", "Command Palette Controls")}
            </h4>
            <div className="space-y-1">
              <ShortcutRow label={t("command.footerNavigate", "Navigate items")} shortcut="↑ / ↓" />
              <ShortcutRow label={t("command.footerSelect", "Select action")} shortcut="↵ Enter" />
              <ShortcutRow label={t("command.footerClose", "Close")} shortcut="Esc" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  openShortcutsHelp,
  onShortcutsHelpOpenChange,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { settings, updateSettings, exportData } = useApp();
  const { t } = useTranslation();
  const shortcutHint = useShortcutHint();

  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Sync the external "open shortcuts help" signal (driven by the always-mounted
  // loader) into local state. This lets the `?` shortcut work even before the
  // palette chunk has ever been opened via ⌘K.
  useEffect(() => {
    if (openShortcutsHelp) {
      setShortcutsHelpOpen(true);
      onShortcutsHelpOpenChange?.(false); // acknowledge / reset the signal
    }
  }, [openShortcutsHelp, onShortcutsHelpOpenChange]);
  const feedbackAnchorRef = useRef<HTMLAnchorElement | null>(null);
  /**
   * The feedback row renders a real anchor (`target="_blank"` +
   * `rel="noopener noreferrer"`), and `asChild` merges cmdk's click handler onto
   * that same anchor. A pointer click therefore both navigates AND fires
   * `onSelect`; this flag tells the two activation paths apart so a single
   * gesture can never open two tabs.
   */
  const feedbackOpenedByPointerRef = useRef(false);

  /** Close first: Radix then restores focus before the action changes the view. */
  const runCommand = useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const handleFeedbackSelect = useCallback(() => {
    onOpenChange(false);
    // Pointer activation already opened the tab through the anchor itself.
    if (feedbackOpenedByPointerRef.current) {
      feedbackOpenedByPointerRef.current = false;
      return;
    }
    // Keyboard activation (Enter): still inside the key event's user
    // activation, so the popup is allowed.
    window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer");
  }, [onOpenChange]);

  const handleCreateHabit = useCallback(() => {
    dispatchOpenAddModal("habit");
  }, []);

  const openArchivedHabits = useCallback(() => {
    if (window.location.pathname !== "/") {
      void navigate({ to: "/" }).then(() => {
        window.setTimeout(() => {
          window.dispatchEvent(new Event(OPEN_ARCHIVED_HABITS_EVENT));
        }, 120);
      });
    } else {
      window.dispatchEvent(new Event(OPEN_ARCHIVED_HABITS_EVENT));
    }
  }, [navigate]);

  /**
   * Context-aware search focus: targets the search input on the *current* page
   * rather than always navigating to Today first.
   *
   * Strategy:
   *  1. Query the live DOM for any `input[type="search"]` that is visible (i.e.
   *     not hidden by `display:none` or `visibility:hidden`). Goals, Routines,
   *     Quit Tracker, and Today all render one when they have content.
   *  2. If found → focus it in place. No navigation needed.
   *  3. If not found (Settings, Calendar, Stats — pages with no search bar) →
   *     navigate to "/" and focus Today's search bar after the route settles,
   *     reusing the same `FOCUS_HABIT_SEARCH_EVENT` that Today already handles.
   *
   * The 100ms delay after closing the palette gives Radix time to finish its
   * exit animation and return focus to the trigger before we steal it again.
   */
  const focusPageSearch = useCallback(() => {
    window.setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>("input[type='search']");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        return;
      }
      // No search bar on this page — fall back to Today.
      void navigate({ to: "/" }).then(() => {
        window.setTimeout(() => {
          window.dispatchEvent(new Event(FOCUS_HABIT_SEARCH_EVENT));
        }, 120);
      });
    }, 100);
  }, [navigate]);

  const handleExportBackup = useCallback(() => {
    const json = exportData();
    downloadJsonBackup(json, buildBackupFileName());
    markBackupComplete();
    toast.success(t("command.exportSuccess", "Habits exported successfully"));
  }, [exportData, t]);

  // Reset the pointer flag on every open so a stale value can never swallow the
  // next keyboard activation.
  useEffect(() => {
    if (open) feedbackOpenedByPointerRef.current = false;
  }, [open]);


  const feedbackLabel = t("command.feedback", "Report a Bug / Feedback");

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          {/* Glass scrim: blurs and saturates the page behind the palette. */}
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-[60] bg-background/40 backdrop-blur-md backdrop-saturate-150 dark:bg-black/60",
              "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            )}
          />
          {/*
            Flex wrapper (same technique as `src/components/ui/dialog.tsx`) does the
            centering/top-aligning, leaving the panel free to animate with
            zoom + slide without a competing `translate-x` utility.
          */}
          <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh] sm:pt-[14vh]">
            <DialogPrimitive.Content
              className={cn(
                "relative pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border/60",
                // Glass-morphism panel: translucent + blurred so the page behind
                // stays readable around it instead of being fully masked.
                "bg-background/85 text-foreground shadow-2xl backdrop-blur-xl backdrop-saturate-150",
                "dark:border-border/80 dark:bg-popover/85 dark:text-popover-foreground",
                "duration-200 outline-none",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
              )}
            >
              {/* Visually hidden, but this is what screen readers announce for the
                  dialog (Radix wires aria-labelledby / aria-describedby). */}
              <DialogPrimitive.Title className="sr-only">
                {t("command.title", "Command Palette")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                {t(
                  "command.description",
                  "Search for a screen to open or an action to run, then press Enter.",
                )}
              </DialogPrimitive.Description>

              <Command
                label={t("command.title", "Command Palette")}
                loop
                className={COMMAND_ROOT_CLASSES}
              >
                <CommandInput
                  autoFocus
                  placeholder={t("command.placeholder", "Search commands…")}
                  className="h-12 text-base md:text-sm"
                />
                {/*
                  `min(55vh, 20rem)` keeps the panel inside the viewport on small
                  landscape screens, and overscroll containment stops the page
                  behind from scrolling when the list hits its end.
                  Scrollbar is completely hidden using arbitrary Tailwind values + no-scrollbar.
                */}
                <CommandList className="max-h-[min(55vh,20rem)] overscroll-contain px-2 py-2 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
                  <CommandEmpty>{t("command.empty", "No matching commands.")}</CommandEmpty>

                  {/* Navigation Group */}
                  <CommandGroup heading={t("command.groupNavigation", "Navigation")}>
                    {NAVIGATION_COMMANDS.map((item) => {
                      const label = t(item.labelKey, item.label);
                      return (
                        <CommandItem
                          key={item.to}
                          value={`${label} ${item.keywords}`}
                          onSelect={() => runCommand(() => void navigate({ to: item.to }))}
                          className={COMMAND_ITEM_CLASSES}
                        >
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{label}</span>
                          {item.shortcut ? (
                            <CommandShortcut>
                              <Kbd className="border-border/80 bg-muted/60 text-muted-foreground shadow-xs">
                                {item.shortcut}
                              </Kbd>
                            </CommandShortcut>
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>

                  <CommandSeparator className="my-1" />

                  {/* Habit Actions Group */}
                  <CommandGroup heading={t("command.groupHabits", "Habit Actions")}>
                    <CommandItem
                      value={`${t("command.createHabit", "Create New Habit")} new habit add tracker task`}
                      onSelect={() => runCommand(handleCreateHabit)}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.createHabit", "Create New Habit")}</span>
                      <CommandShortcut>
                        <Kbd className="border-border/80 bg-muted/60 text-muted-foreground shadow-xs">
                          N
                        </Kbd>
                      </CommandShortcut>
                    </CommandItem>

                    <CommandItem
                      value={`${t("command.viewArchivedHabits", "View Archived Habits")} archive archived habits restore list`}
                      onSelect={() => runCommand(openArchivedHabits)}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.viewArchivedHabits", "View Archived Habits")}</span>
                    </CommandItem>

                    <CommandItem
                      value={`${t("command.searchPage", "Search Current Page")} search find filter habits goals routines tracker query`}
                      onSelect={() => runCommand(focusPageSearch)}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.searchPage", "Search Current Page")}</span>
                      <CommandShortcut>
                        <Kbd className="border-border/80 bg-muted/60 text-muted-foreground shadow-xs">
                          /
                        </Kbd>
                      </CommandShortcut>
                    </CommandItem>
                  </CommandGroup>

                  <CommandSeparator className="my-1" />

                  {/* Data & System Group */}
                  <CommandGroup heading={t("command.groupDataSystem", "Data & System")}>
                    <CommandItem
                      value={`${t("command.exportData", "Export Habits (Backup)")} export habits backup json download data`}
                      onSelect={() => runCommand(handleExportBackup)}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.exportData", "Export Habits (Backup)")}</span>
                      <CommandShortcut className="text-[10px]">JSON</CommandShortcut>
                    </CommandItem>

                    <CommandItem
                      value={`${t("command.themeDark", "Dark Mode")} theme appearance dark mode night`}
                      onSelect={() =>
                        runCommand(() => {
                          updateSettings({ theme: "dark" });
                          toast.success(t("command.themeUpdatedDark", "Switched to Dark Mode"));
                        })
                      }
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.themeDark", "Dark Mode")}</span>
                      {settings.theme === "dark" ? (
                        <CommandShortcut className="text-[10px] font-medium text-primary">
                          {t("command.active", "Active")}
                        </CommandShortcut>
                      ) : null}
                    </CommandItem>

                    <CommandItem
                      value={`${t("command.themeLight", "Light Mode")} theme appearance light mode day`}
                      onSelect={() =>
                        runCommand(() => {
                          updateSettings({ theme: "light" });
                          toast.success(t("command.themeUpdatedLight", "Switched to Light Mode"));
                        })
                      }
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Sun className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.themeLight", "Light Mode")}</span>
                      {settings.theme === "light" ? (
                        <CommandShortcut className="text-[10px] font-medium text-primary">
                          {t("command.active", "Active")}
                        </CommandShortcut>
                      ) : null}
                    </CommandItem>

                    <CommandItem
                      value={`${t("command.themeSystem", "System")} theme appearance system auto os`}
                      onSelect={() =>
                        runCommand(() => {
                          updateSettings({ theme: "system" });
                          toast.success(
                            t("command.themeUpdatedSystem", "Switched to System theme"),
                          );
                        })
                      }
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.themeSystem", "System")}</span>
                      {settings.theme === "system" ? (
                        <CommandShortcut className="text-[10px] font-medium text-primary">
                          {t("command.active", "Active")}
                        </CommandShortcut>
                      ) : null}
                    </CommandItem>
                  </CommandGroup>

                  <CommandSeparator className="my-1" />

                  {/* Help Group */}
                  <CommandGroup heading={t("command.groupHelp", "Help")}>
                    <CommandItem
                      value={`${t("command.shortcutsHelp", "Keyboard Shortcuts Help")} shortcuts keyboard hotkeys keys help commands`}
                      onSelect={() => runCommand(() => setShortcutsHelpOpen(true))}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <Keyboard className="h-4 w-4 text-muted-foreground" />
                      <span>{t("command.shortcutsHelp", "Keyboard Shortcuts Help")}</span>
                      <CommandShortcut>
                        <Kbd className="border-border/80 bg-muted/60 text-muted-foreground shadow-xs">
                          ?
                        </Kbd>
                      </CommandShortcut>
                    </CommandItem>

                    {/* Feedback row */}
                    <CommandItem
                      asChild
                      value={`${feedbackLabel} bug report feedback issue contact support tally`}
                      onSelect={handleFeedbackSelect}
                      className={COMMAND_ITEM_CLASSES}
                    >
                      <a
                        ref={feedbackAnchorRef}
                        href={FEEDBACK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          feedbackOpenedByPointerRef.current = true;
                        }}
                      >
                        <Bug className="h-4 w-4 text-muted-foreground" />
                        <span>{feedbackLabel}</span>
                        <CommandShortcut className="text-[10px]">
                          {t("command.newTab", "New tab")}
                        </CommandShortcut>
                      </a>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>

                {/* Decorative: the listbox above is what assistive tech reads. */}
                <div
                  aria-hidden="true"
                  className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    <span className="ml-0.5">{t("command.footerNavigate", "to navigate")}</span>
                    <Kbd>↵</Kbd>
                    <span className="ml-0.5">{t("command.footerSelect", "to select")}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>Esc</Kbd>
                    <span className="ml-0.5">{t("command.footerClose", "to close")}</span>
                    <Kbd>{shortcutHint}</Kbd>
                  </span>
                </div>
              </Command>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Keyboard Shortcuts Help Dialog */}
      <ShortcutsHelpDialog
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
        shortcutHint={shortcutHint}
      />
    </>
  );
}

export default CommandPalette;
