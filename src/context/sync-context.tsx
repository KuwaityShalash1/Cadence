import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/auth-context";
import { subscribeToSync, syncNow } from "@/lib/sync";
import { getPendingSyncCount } from "@/database/repository";
import type { SyncStatus } from "@/types";

export interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  /** Manually trigger background synchronization. */
  triggerSync: () => Promise<boolean>;
  /** Refresh count of items waiting to be pushed to cloud. */
  refreshPendingCount: () => Promise<number>;
}

const DEFAULT_SYNC_STATE: SyncContextType = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  syncStatus: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  triggerSync: async () => false,
  refreshPendingCount: async () => 0,
};

const SyncContext = createContext<SyncContextType | null>(null);

/**
 * Access the global background sync and network connectivity state.
 */
export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  return context ?? DEFAULT_SYNC_STATE;
}

/**
 * Convenience hook that exposes background sync state and online network status.
 */
export function useBackgroundSync(): SyncContextType {
  return useSync();
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle",
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isSyncingRef = useRef(false);

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (isSyncingRef.current) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return false;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus("syncing");

    try {
      const success = await syncNow();
      setSyncStatus("idle");
      setLastSyncedAt(new Date());
      await refreshPendingCount();
      return success;
    } catch (error) {
      console.error("Background sync failed gracefully:", error);
      setSyncStatus("error");
      return false;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      void refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // Initial count check and sync subscriber
  useEffect(() => {
    void refreshPendingCount();
    const unsubscribe = subscribeToSync(() => {
      void refreshPendingCount();
    });
    return unsubscribe;
  }, [refreshPendingCount]);

  // Listen for online and offline network events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Automatically trigger background sync when network connectivity is restored
      void triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
      isSyncingRef.current = false;
      setSyncStatus("offline");
      void refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check when authenticated session is present
    if (navigator.onLine && session) {
      void triggerSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [session, triggerSync, refreshPendingCount]);

  const value: SyncContextType = {
    isOnline,
    isSyncing,
    syncStatus,
    pendingCount,
    lastSyncedAt,
    triggerSync,
    refreshPendingCount,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

