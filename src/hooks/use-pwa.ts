import { useCallback, useEffect, useState } from "react";

/**
 * Chromium's `beforeinstallprompt` event.
 *
 * The DOM lib ships no type for it, so the small surface Cadence relies on is
 * declared here. Safari and Firefox never fire the event, and the hook simply
 * degrades to "install not available" there.
 */
export interface BeforeInstallPromptEvent extends Event {
  /** Install targets the browser can use, e.g. `["web"]`. */
  readonly platforms: readonly string[];
  /** Resolves with the user's decision once the prompt is dismissed. */
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  /** Shows the native install prompt; must run inside a user gesture. */
  prompt: () => Promise<BeforeInstallPromptChoice>;
}

/** The user's answer to the native install prompt. */
export interface BeforeInstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

/** What the browser did with the native install prompt. */
export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** How a share attempt ended. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Optional overrides for the share payload. */
export interface ShareAppOptions {
  title?: string;
  text?: string;
  url?: string;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }

  interface Window {
    /**
     * Deferred install prompt, captured before React mounts by the inline
     * script in `src/routes/__root.tsx` and refreshed by the listeners this
     * hook registers. Keeping it on `window` means the prompt survives route
     * changes and remounts of the Settings screen.
     */
    __cadenceDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const SHARE_TITLE = "Cadence";
const SHARE_TEXT = "Cadence — a calm, offline-first habit tracker and routine planner.";

/** Used when the page has no usable origin (e.g. `file://` previews). */
const FALLBACK_SHARE_URL = "https://cadencepwa.vercel.app/";

/** Reads the deferred prompt stashed on `window`. SSR-safe. */
function readDeferredPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__cadenceDeferredInstallPrompt ?? null;
}

/** Replaces the stashed deferred prompt. SSR-safe. */
function writeDeferredPrompt(prompt: BeforeInstallPromptEvent | null): void {
  if (typeof window === "undefined") return;
  window.__cadenceDeferredInstallPrompt = prompt;
}

/**
 * True when Cadence already runs as an installed app: the `display-mode` media
 * query reports standalone (desktop, Android, iOS 16.4+) or iOS Safari exposes
 * its legacy `navigator.standalone` flag.
 */
function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;

  return displayModeStandalone || iosStandalone === true;
}

/** True when a rejection is the expected "user closed the share sheet". */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Public URL of the running app, used inside the share payload. */
function resolveShareUrl(): string {
  if (typeof window === "undefined") return FALLBACK_SHARE_URL;

  const { origin, href } = window.location;
  return origin && origin !== "null" ? href : FALLBACK_SHARE_URL;
}

/**
 * PWA (Progressive Web App) helpers for Cadence.
 *
 * Captures the deferred `beforeinstallprompt` event so the Settings screen can
 * offer an "Install App" action whenever the browser makes one available - and
 * never once the app itself already runs in standalone mode. It also exposes
 * `shareApp`, which uses the Web Share API and falls back to the clipboard.
 *
 * Every browser API is touched inside an effect or a callback, so the hook is
 * safe during SSR: `isInstallAvailable` is simply `false` until the client has
 * hydrated and the browser has handed over a prompt.
 *
 * @returns `isInstallAvailable` (render the install action only while true),
 *   `isStandalone`, `triggerInstall()` and `shareApp()`.
 */
export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

   useEffect(() => {
    if (typeof window === "undefined") return;

    // Hydration-safe: the first client render mirrors the server markup and the
    // real browser state is applied here instead.
    const syncFromStash = () => setDeferredPrompt(readDeferredPrompt());
    setIsStandalone(isStandaloneMode());
    syncFromStash();

    // The prompt can arrive at any moment, and installing or uninstalling the
    // app flips standalone mode - keep both reflected in the UI.
    window.addEventListener("beforeinstallprompt", syncFromStash);
    window.addEventListener("appinstalled", syncFromStash);

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setIsStandalone(isStandaloneMode());
    displayModeQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", syncFromStash);
      window.removeEventListener("appinstalled", syncFromStash);
      displayModeQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Storage persistence (navigator.storage.persist)
  // ---------------------------------------------------------------------------
  //
  // Requests persistent storage so the browser / mobile OS does not evict
  // IndexedDB (and our Dexie tables) when the device is under storage pressure.
  // Models the same SSR-safe pattern used elsewhere in this hook: only touches
  // `navigator` inside the effect.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.storage === "undefined") return;
    if (typeof navigator.storage.persist !== "function") return;

    navigator.storage
      .persist()
      .then((granted) => {
        if (granted) {
          console.log("[Cadence] Storage persistence granted — IndexedDB will not be cleared under storage pressure.");
        } else {
          console.warn("[Cadence] Storage persistence denied — IndexedDB may be cleared if the device runs low on storage.");
        }
      })
      .catch((err) => {
        console.warn("[Cadence] navigator.storage.persist() rejected", err);
      });
  }, []);

  /**
   * Shows the native install prompt. Call it from a click handler, because the
   * browser only allows the prompt from a user gesture. A deferred prompt is
   * single-use, so it is dropped as soon as it has been consumed.
   */
  const triggerInstall = useCallback(async (): Promise<InstallOutcome> => {
    const prompt = readDeferredPrompt();
    if (!prompt) return "unavailable";

    writeDeferredPrompt(null);
    setDeferredPrompt(null);

    try {
      const choice = await prompt.prompt();
      return choice.outcome;
    } catch (error) {
      console.warn("[Cadence] Install prompt could not be shown", error);
      return "unavailable";
    }
  }, []);

  /**
   * Shares Cadence through the Web Share API, falling back to copying a short
   * invite to the clipboard when the browser has no share sheet (typical for
   * desktop Firefox) or when the payload is rejected.
   *
   * @param options - Optional overrides for the title, text and URL.
   * @returns `"shared"`, `"copied"`, `"cancelled"` when the user closed the
   *   sheet, or `"failed"` when neither API could be used.
   */
  const shareApp = useCallback(async (options?: ShareAppOptions): Promise<ShareOutcome> => {
    if (typeof navigator === "undefined") return "failed";

    const payload = {
      title: options?.title ?? SHARE_TITLE,
      text: options?.text ?? SHARE_TEXT,
      url: options?.url ?? resolveShareUrl(),
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return "shared";
      } catch (error) {
        // Closing the sheet is a normal outcome, not a failure.
        if (isAbortError(error)) return "cancelled";
        console.warn("[Cadence] Web Share failed, falling back to the clipboard", error);
      }
    }

    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") return "failed";

    try {
      await clipboard.writeText(payload.text + "\n" + payload.url);
      return "copied";
    } catch (error) {
      console.warn("[Cadence] Clipboard copy failed", error);
      return "failed";
    }
  }, []);

  return {
    isInstallAvailable: deferredPrompt !== null && !isStandalone,
    isStandalone,
    triggerInstall,
    shareApp,
  };
}
