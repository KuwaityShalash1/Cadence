import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { useTranslation } from "@/i18n/context";
import { hasUserBeenMigrated, mergeLocalDataToCloud } from "@/lib/data-merge";
import type { MigrationResult, MigrationStats, MigrationStatus } from "@/types";

export interface UseLocalCloudMigrationOptions {
  /**
   * Whether migration should automatically run when a user session is detected.
   * Defaults to true.
   */
  autoMigrate?: boolean;
  /**
   * Whether to show a toast message when offline data is merged.
   * Defaults to true.
   */
  notifyOnSuccess?: boolean;
  /**
   * Optional callback invoked after a successful migration.
   */
  onSuccess?: (result: MigrationResult) => void;
  /**
   * Optional callback invoked if migration encounters an error.
   */
  onError?: (error: string) => void;
}

export interface UseLocalCloudMigrationReturn {
  status: MigrationStatus;
  isMigrating: boolean;
  isSuccess: boolean;
  isError: boolean;
  stats: MigrationStats | null;
  error: string | null;
  /**
   * Manually trigger the migration flow (supports force flag).
   */
  runMigration: (options?: { force?: boolean }) => Promise<MigrationResult | null>;
}

/**
 * React hook that detects when a user successfully authenticates with Supabase
 * and performs a local-to-cloud data merge with conflict resolution.
 */
export function useLocalCloudMigration(
  options: UseLocalCloudMigrationOptions = {},
): UseLocalCloudMigrationReturn {
  const { t } = useTranslation();
  const { autoMigrate = true, notifyOnSuccess = true, onSuccess, onError } = options;
  const { session, user } = useAuth();

  const [status, setStatus] = useState<MigrationStatus>("idle");
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track executed users in this session to prevent redundant triggers
  const lastMigratedUserRef = useRef<string | null>(null);
  const isMigratingRef = useRef(false);

  const runMigration = useCallback(
    async (runOptions?: { force?: boolean }): Promise<MigrationResult | null> => {
      const userId = user?.id ?? session?.user?.id;
      if (!userId) {
        return null;
      }

      const force = runOptions?.force ?? false;
      if (!force && hasUserBeenMigrated(userId) && lastMigratedUserRef.current === userId) {
        return null;
      }

      if (isMigratingRef.current) {
        return null;
      }

      isMigratingRef.current = true;
      setStatus("migrating");
      setError(null);

      try {
        const result = await mergeLocalDataToCloud(userId, { force });

        if (result.success) {
          lastMigratedUserRef.current = userId;
          setStatus("success");
          setStats(result.stats);

          // Only notify if local habits or logs were actively merged/uploaded
          const hasUploadedData =
            result.stats.habitsUpserted > 0 ||
            result.stats.habitsResolved > 0 ||
            result.stats.logsUpserted > 0 ||
            result.stats.logsResolved > 0;

          if (notifyOnSuccess && hasUploadedData) {
            const count = result.stats.habitsUpserted + result.stats.habitsResolved;
            const habitText =
              count === 1 ? t("habit.singular", "habit") : t("habit.plural", "habits");
            toast.success(
              t(
                "migration.syncedSuccess",
                `Synced ${count} offline ${habitText} with your cloud account.`,
                { count, habitText },
              ),
            );
          }

          onSuccess?.(result);
          return result;
        } else {
          const errMsg =
            result.error ?? t("migration.failedMerge", "Failed to merge data with cloud.");
          setStatus("error");
          setError(errMsg);
          onError?.(errMsg);
          return result;
        }
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : t("migration.unexpectedError", "Unexpected migration failure");
        setStatus("error");
        setError(errMsg);
        onError?.(errMsg);
        return {
          success: false,
          stats: {
            habitsChecked: 0,
            habitsUpserted: 0,
            habitsResolved: 0,
            logsChecked: 0,
            logsUpserted: 0,
            logsResolved: 0,
            durationMs: 0,
          },
          error: errMsg,
        };
      } finally {
        isMigratingRef.current = false;
      }
    },
    [notifyOnSuccess, onError, onSuccess, session?.user?.id, user?.id],
  );

  useEffect(() => {
    const userId = user?.id ?? session?.user?.id;
    if (!autoMigrate || !userId) return;

    // Trigger migration automatically when an authenticated session is established
    void runMigration();
  }, [autoMigrate, runMigration, session?.user?.id, user?.id]);

  return {
    status,
    isMigrating: status === "migrating",
    isSuccess: status === "success",
    isError: status === "error",
    stats,
    error,
    runMigration,
  };
}
