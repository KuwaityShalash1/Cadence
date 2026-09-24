import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Global command palette controller (⌘K / Ctrl+K) for the Cadence PWA.
 *
 * Only this hook ships in the eagerly loaded entry bundle — the palette UI
 * itself lives in `src/components/command-palette.tsx`, a separate chunk that
 * `CommandPaletteLoader` fetches the first time it is needed. Mobile users who
 * never open the palette therefore download exactly the same JavaScript as
 * before the feature existed.
 */

/** Event any surface can dispatch to open the palette (e.g. a future button). */
export const OPEN_COMMAND_PALETTE_EVENT = "cadence:open-command-palette";

export interface CommandPaletteController {
  /** Whether the palette is currently visible. */
  open: boolean;
  /** Imperative setter; also wired to Radix Dialog's `onOpenChange`. */
  setOpen: (open: boolean) => void;
  /** Opens the palette (mounting its lazy chunk on demand). */
  openPalette: () => void;
  /** Flips the palette between open and closed — the ⌘K behaviour. */
  toggle: () => void;
  /**
   * True while the palette should be rendered. It latches on the first open and
   * deliberately stays `true` afterwards, so Radix can finish the exit
   * animation and restore focus instead of unmounting mid-transition.
   */
  mounted: boolean;
}

export function useCommandPalette(): CommandPaletteController {
  const [open, setOpenState] = useState(false);
  const [mounted, setMounted] = useState(false);

  const openPalette = useCallback(() => {
    setMounted(true);
    setOpenState(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  const toggle = useCallback(() => {
    setMounted(true);
    setOpenState((previous) => !previous);
  }, []);

  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  }, [toggle]);

  /**
   * ⌘K / Ctrl+K — attached globally to `window` in the CAPTURE phase.
   *
   * Crucial: We use the capture phase (`{ capture: true }`) so this listener
   * executes before the browser's default accelerators or any focused input can
   * consume the chord. Calling `event.preventDefault()` immediately stops Google
   * Chrome (and other Chromium browsers) from opening its native address/search bar.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore Alt combinations (e.g. Alt+Ctrl chords)
      if (event.altKey) return;

      const isK = event.key?.toLowerCase() === "k" || event.key === "K" || event.code === "KeyK";

      if ((event.ctrlKey || event.metaKey) && isK) {
        // Explicitly prevent browser default action immediately (Chrome search/address bar)
        event.preventDefault();
        event.stopPropagation();

        // IME composition and key auto-repeat must not flap the palette.
        if (event.isComposing || event.repeat) return;

        toggleRef.current();
      }
    };

    // Attach in the capture phase to intercept before native browser actions
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  /** Lets other components open the palette without importing the lazy chunk. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRequestOpen = () => openPalette();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onRequestOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onRequestOpen);
  }, [openPalette]);

  return { open, setOpen, openPalette, toggle, mounted };
}
