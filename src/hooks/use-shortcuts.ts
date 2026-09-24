import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

// Canonical event names for context-aware "Add New" shortcuts.
export const OPEN_ADD_MODAL_EVENT = "cadence:open-add-modal";
export const OPEN_ADD_HABIT_EVENT = "cadence:open-add-habit";
export const OPEN_ADD_GOAL_EVENT = "cadence:open-add-goal";
export const OPEN_ADD_ROUTINE_EVENT = "cadence:open-add-routine";
export const OPEN_ADD_QUIT_TRACKER_EVENT = "cadence:open-add-quit-tracker";

// Canonical event names for habit actions and help modals.
export const OPEN_ARCHIVED_HABITS_EVENT = "cadence:open-archived-habits";
export const FOCUS_HABIT_SEARCH_EVENT = "cadence:focus-habit-search";
export const OPEN_SHORTCUTS_HELP_EVENT = "cadence:open-shortcuts-help";

export type AddModalEntity = "habit" | "goal" | "routine" | "quit-tracker";

export interface OpenAddModalDetail {
  entity: AddModalEntity;
}

// Dispatch generic + entity-specific events for opening an add form.
export function dispatchOpenAddModal(entity: AddModalEntity): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenAddModalDetail>(OPEN_ADD_MODAL_EVENT, { detail: { entity } }),
  );
  switch (entity) {
    case "goal":
      window.dispatchEvent(new Event(OPEN_ADD_GOAL_EVENT));
      break;
    case "routine":
      window.dispatchEvent(new Event(OPEN_ADD_ROUTINE_EVENT));
      break;
    case "quit-tracker":
      window.dispatchEvent(new Event(OPEN_ADD_QUIT_TRACKER_EVENT));
      break;
    case "habit":
    default:
      window.dispatchEvent(new Event(OPEN_ADD_HABIT_EVENT));
      break;
  }
}

// Subscribe to the "Add New" shortcut event(s) for a single entity.
export function useAddModalListener(entity: AddModalEntity, onOpen: () => void): void {
  const handlerRef = useRef(onOpen);
  useEffect(() => {
    handlerRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const specificEvent =
      entity === "goal"
        ? OPEN_ADD_GOAL_EVENT
        : entity === "routine"
          ? OPEN_ADD_ROUTINE_EVENT
          : entity === "quit-tracker"
            ? OPEN_ADD_QUIT_TRACKER_EVENT
            : OPEN_ADD_HABIT_EVENT;

    const onSpecific = () => handlerRef.current();
    const onGeneric = (e: Event) => {
      const detail = (e as CustomEvent<OpenAddModalDetail>).detail;
      if (detail?.entity === entity) handlerRef.current();
    };

    window.addEventListener(specificEvent, onSpecific);
    window.addEventListener(OPEN_ADD_MODAL_EVENT, onGeneric);
    return () => {
      window.removeEventListener(specificEvent, onSpecific);
      window.removeEventListener(OPEN_ADD_MODAL_EVENT, onGeneric);
    };
  }, [entity]);
}

/**
 * Global, zero-dependency keyboard shortcuts for the Cadence PWA.
 * Attaches a single keydown listener; context-aware via TanStack Router.
 *
 * Single-key Navigation Shortcuts (when NOT typing inside inputs):
 * - T: Today (/)
 * - C: Calendar (/calendar)
 * - A: Analytics (/stats)
 * - G: Goals (/goals)
 * - R: Routines (/routines)
 * - Q: Quit Tracker (/quit-tracker)
 * - S: Settings (/settings)
 * - N: Add New (context-aware: habit, goal, routine, or quit tracker)
 * - /: Focus the search bar (skipped when already inside an input/textarea)
 * - ?: Open Keyboard Shortcuts Help
 *
 * Cmd/Ctrl+K is deliberately NOT handled here: it belongs to the command
 * palette (`useCommandPalette` in src/hooks/use-command-palette.ts), which owns
 * the chord globally. Two listeners on the same chord would fight over focus
 * and call `preventDefault()` twice.
 *
 * Mount once at the top level (inside RootComponent in __root.tsx).
 */
export function useShortcuts(): void {
  const location = useLocation();
  const navigate = useNavigate();

  // Refs keep the single window listener fresh without re-attaching.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      // CRITICAL safety guard: never hijack keystrokes while typing.
      const active = document.activeElement as HTMLElement | null;
      const isInput =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.tagName === "SELECT" ||
        active?.isContentEditable;
      if (isInput) return;

      // Ignore IME composition and auto-repeat for single-press actions.
      if (e.isComposing) return;

      // Explicitly prevent Chrome default search bar if Ctrl+K / Cmd+K reaches this listener
      const isK = e.key?.toLowerCase() === "k" || e.key === "K" || e.code === "KeyK";
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        return;
      }

      // Modifier combos are not plain single-key shortcuts. (Cmd/Ctrl+K is
      // owned by the command palette — see the note in the hook docs above.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

      // Help modal shortcut: Shift+/ or ?
      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new Event(OPEN_SHORTCUTS_HELP_EVENT));
        return;
      }

      const key = e.key.toLowerCase();
      const pathname = pathnameRef.current ?? "";

      // N: context-aware Add New, dispatched as an event for Vaul sheets.
      if (key === "n") {
        if (pathname.includes("/goals")) dispatchOpenAddModal("goal");
        else if (pathname.includes("/quit-tracker")) dispatchOpenAddModal("quit-tracker");
        else if (pathname.includes("/routines")) dispatchOpenAddModal("routine");
        else dispatchOpenAddModal("habit");
        return;
      }

      // /: Focus the search bar on the active page.
      if (e.key === "/") {
        e.preventDefault();
        (document.querySelector('input[type="search"]') as HTMLInputElement | null)?.focus();
        return;
      }

      // Main pages global single-key navigation:
      switch (key) {
        case "t":
          e.preventDefault();
          void navigateRef.current({ to: "/" });
          break;
        case "c":
          e.preventDefault();
          void navigateRef.current({ to: "/calendar" });
          break;
        case "a":
          e.preventDefault();
          void navigateRef.current({ to: "/stats" });
          break;
        case "g":
          e.preventDefault();
          void navigateRef.current({ to: "/goals" });
          break;
        case "r":
          e.preventDefault();
          void navigateRef.current({ to: "/routines" });
          break;
        case "q":
          e.preventDefault();
          void navigateRef.current({ to: "/quit-tracker" });
          break;
        case "s":
          e.preventDefault();
          void navigateRef.current({ to: "/settings" });
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
