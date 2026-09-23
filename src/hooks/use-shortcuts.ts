import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

// Canonical event names for context-aware "Add New" shortcuts.
export const OPEN_ADD_MODAL_EVENT = "cadence:open-add-modal";
export const OPEN_ADD_HABIT_EVENT = "cadence:open-add-habit";
export const OPEN_ADD_GOAL_EVENT = "cadence:open-add-goal";
export const OPEN_ADD_ROUTINE_EVENT = "cadence:open-add-routine";
export const OPEN_ADD_QUIT_TRACKER_EVENT = "cadence:open-add-quit-tracker";

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
 * Shortcuts: N (add new), Cmd/Ctrl+K (focus search), T (go to Today).
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
        active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.isContentEditable;
      if (isInput) return;

      // Ignore IME composition and auto-repeat for single-press actions.
      if (e.isComposing) return;

      // Cmd+K / Ctrl+K: focus the primary search input on the page.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[aria-label*="search" i], input[placeholder*="search" i]',
        );
        if (searchInput) searchInput.focus();
        return;
      }

      // Modifier combos (except Cmd/Ctrl+K above) are not shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

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

      // T: go to the Today view.
      if (key === "t") {
        e.preventDefault();
        void navigateRef.current({ to: "/" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
