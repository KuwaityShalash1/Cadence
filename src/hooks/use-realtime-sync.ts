import { useEffect, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import {
  getRealtimeStatus,
  setupRealtimeSubscription,
  subscribeToRealtimeStatus,
  type RealtimeSyncStatus,
} from "@/lib/realtime";

export interface UseRealtimeSyncOptions {
  /** Optional custom tables to subscribe to in addition to cadence_sync_records */
  additionalTables?: string[] | undefined;
  /** Set to false to disable subscription */
  enabled?: boolean | undefined;
}

export interface UseRealtimeSyncResult {
  status: RealtimeSyncStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isError: boolean;
  isDisabled: boolean;
}

/**
 * Custom React hook that establishes and manages a Supabase Realtime subscription
 * for the authenticated user, automatically tearing it down on unmount to prevent memory leaks.
 */
export function useRealtimeSync(options: UseRealtimeSyncOptions = {}): UseRealtimeSyncResult {
  const { additionalTables, enabled = true } = options;
  const { user, isConfigured } = useAuth();
  const [status, setStatus] = useState<RealtimeSyncStatus>(() =>
    !isConfigured ? "disabled" : getRealtimeStatus(),
  );

  // Subscribe to global realtime connection status
  useEffect(() => {
    const unsubscribeStatus = subscribeToRealtimeStatus(setStatus);
    return unsubscribeStatus;
  }, []);

  // Set up Supabase Realtime channel when authenticated, tear down on unmount or user change
  useEffect(() => {
    if (!enabled || !isConfigured || !user?.id) {
      return undefined;
    }

    const cleanup = setupRealtimeSubscription({
      userId: user.id,
      onStatusChange: setStatus,
      additionalTables,
    });

    return () => {
      cleanup();
    };
  }, [enabled, isConfigured, user?.id, additionalTables]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isError: status === "error",
    isDisabled: status === "disabled",
  };
}
