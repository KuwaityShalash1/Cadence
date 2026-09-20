import { useEffect, useState } from "react";

/**
 * Tracks the browser's connectivity flag.
 *
 * Returns `true` during SSR and on the first client render so the hydrated
 * markup is identical, then syncs with `navigator.onLine` inside an effect.
 * The value is a UI hint only — Cadence never gates a feature on it, because
 * habits, logs, routines and settings all live in IndexedDB.
 *
 * Note that `navigator.onLine` reports the OS network interface, not real
 * reachability, which is exactly the granularity needed here.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const sync = () => setIsOnline(navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return isOnline;
}
