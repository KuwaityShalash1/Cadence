import { useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";

import type { CommandPaletteProps } from "@/components/command-palette";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useTranslation } from "@/i18n/context";

/**
 * ⌘K / Ctrl+K launcher for the Cadence command palette.
 *
 * This module is the only part of the feature that ships in the eagerly loaded
 * entry bundle — a few hundred bytes of state plus an idle warm-up. The palette
 * itself (`src/components/command-palette.tsx`, together with `cmdk`, which
 * `vite.config.ts` pins to its own vendor chunk) is fetched with a dynamic
 * `import()` only when it is actually needed, so the initial JavaScript payload
 * that Lighthouse measures is unchanged.
 */

/** Props contract of the lazily loaded palette chunk. */
type CommandPaletteComponent = ComponentType<CommandPaletteProps>;

type CommandPaletteModule = typeof import("@/components/command-palette");

/**
 * Warm the chunk after the page has finished loading so the first ⌘K opens
 * instantly and the service worker's `/assets/*` cache already holds the file
 * for offline use.
 *
 * Set to `false` to keep the chunk strictly on-demand: the palette then loads
 * on the first key press only (a fraction of a second later, and never at all
 * if the shortcut is never used).
 */
const PREFETCH_ON_IDLE = true;

/** Idle deadline for the warm-up; keeps it well clear of first paint. */
const PREFETCH_IDLE_TIMEOUT_MS = 3000;
/** Fallback delay for browsers without `requestIdleCallback` (Safari). */
const PREFETCH_FALLBACK_DELAY_MS = 2000;

/** Single entry point for the dynamic import (on-demand and warm-up share it). */
function loadCommandPaletteChunk(): Promise<CommandPaletteModule> {
  return import("@/components/command-palette");
}

/**
 * Skip the warm-up on metered or very slow connections — those users prefer the
 * smaller transfer over an instant palette. `navigator.connection` is
 * Chromium-only, so every other browser keeps the default behaviour.
 */
function isMeteredOrSlowConnection(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  const effectiveType = connection.effectiveType ?? "";
  return effectiveType === "slow-2g" || effectiveType === "2g";
}

function warmCommandPaletteChunk(): void {
  if (typeof window === "undefined") return;
  if (isMeteredOrSlowConnection()) return;

  const load = () => {
    // A failed warm-up is harmless: the next ⌘K retries through the on-demand
    // path, which surfaces the error to the user.
    void loadCommandPaletteChunk().catch(() => undefined);
  };

  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(load, { timeout: PREFETCH_IDLE_TIMEOUT_MS });
      return;
    }
    window.setTimeout(load, PREFETCH_FALLBACK_DELAY_MS);
  };

  // Never compete with the critical path — wait for `load` (past LCP) first.
  if (document.readyState === "complete") {
    schedule();
    return;
  }
  window.addEventListener("load", schedule, { once: true });
}

export function CommandPaletteLoader() {
  const { open, setOpen, mounted } = useCommandPalette();
  const { t } = useTranslation();
  const [Palette, setPalette] = useState<CommandPaletteComponent | null>(null);

  useEffect(() => {
    if (!PREFETCH_ON_IDLE) return;
    warmCommandPaletteChunk();
  }, []);

  /**
   * Fetch the palette chunk the first time it is requested. If the import fails
   * (e.g. the very first visit happens offline, before the service worker has
   * cached the chunk), the palette closes with a toast instead of leaving an
   * invisible dead shortcut behind — and the next ⌘K retries from scratch.
   */
  useEffect(() => {
    if (!open || Palette) return;
    let cancelled = false;

    loadCommandPaletteChunk()
      .then((module) => {
        if (cancelled) return;
        // Function updater: the component itself is the state value.
        setPalette(() => module.CommandPalette);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[Cadence] Failed to load the command palette", error);
        setOpen(false);
        toast.error(t("command.loadError", "Couldn't load the command palette. Please try again."));
      });

    return () => {
      cancelled = true;
    };
  }, [open, Palette, setOpen, t]);

  // Stays unmounted (so SSR output and the initial payload are untouched) until
  // the first press; afterwards it remains mounted so Radix can finish the exit
  // animation and restore focus instead of unmounting mid-transition.
  if (!mounted || !Palette) return null;

  return <Palette open={open} onOpenChange={setOpen} />;
}
