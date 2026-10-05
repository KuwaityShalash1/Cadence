import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { getPendingTodayCount } from "@/services/stats";
import { todayKey } from "@/services/dates";

declare global {
  interface Navigator {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

/**
 * Updates the app icon badge via the Web Badging API (`navigator.setAppBadge` / `navigator.clearAppBadge`).
 * Safe for non-Chromium browsers, mobile platforms lacking support, and SSR environments.
 *
 * @param count - Number of pending habits to show on the badge.
 */
export function syncAppBadge(count: number): void {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
    return;
  }

  try {
    if (count > 0) {
      navigator.setAppBadge?.(count).catch(() => {
        // Silently swallow errors (e.g. if unsupported or permission denied)
      });
    } else {
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge?.().catch(() => {});
      } else {
        navigator.setAppBadge?.(0).catch(() => {});
      }
    }
  } catch {
    // Feature-detection guard for unsupported environments
  }
}

/**
 * Hook to automatically synchronize the PWA App Icon Badge with the user's
 * pending habits for today.
 *
 * Live updates whenever habits, completion logs, or day boundaries change.
 */
export function useAppBadge(): void {
  const { habits, logMap, ready } = useAppStore();

  useEffect(() => {
    // Feature detection check: bail out early if Web Badging API is unsupported
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
      return;
    }

    // Do not alter badges until the store has loaded from IndexedDB
    if (!ready) {
      return;
    }

    const updateBadge = () => {
      const today = todayKey();
      const count = getPendingTodayCount(habits, logMap, today);
      syncAppBadge(count);
    };

    // Immediate sync on dependency change
    updateBadge();

    // Re-evaluate when app gains focus or visibility state changes (e.g. crossing midnight)
    const handleVisibilityOrFocus = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        updateBadge();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [habits, logMap, ready]);
}

