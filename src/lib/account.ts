import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface DeleteAccountResult {
  success: boolean;
  error?: string | undefined;
}

/**
 * ==============================================================================
 * SUPABASE ACCOUNT DELETION SERVICE
 * ==============================================================================
 *
 * NOTE ON SUPABASE CLIENT-SIDE AUTH RESTRICTIONS:
 * Standard Supabase client libraries running in a browser with the public `anon`
 * key cannot invoke `supabase.auth.admin.deleteUser()` because administrative auth
 * actions strictly require the private `service_role` key.
 *
 * Exposing the `service_role` key in frontend code would create severe security
 * vulnerabilities. Therefore, Cadence employs the recommended Supabase architectural
 * pattern:
 *
 * 1. An RPC function (`delete_user_account`) with `SECURITY DEFINER` executes in PostgreSQL
 *    as a trusted procedure, safely deleting the authenticated user (`auth.uid()`)
 *    from `auth.users`.
 * 2. Foreign keys with `ON DELETE CASCADE` or explicit table deletes clean up
 *    `public.cadence_sync_records`.
 * 3. The client calls `supabase.rpc("delete_user_account")` and then finishes by
 *    calling `supabase.auth.signOut()`.
 *
 * --- WHAT NEEDS TO BE CONFIGURED IN THE SUPABASE DASHBOARD ---
 * If not already applied via `supabase/migrations/003_delete_user_account.sql`,
 * execute the following SQL in the Supabase Dashboard (SQL Editor -> New Query):
 *
 * ```sql
 * create or replace function public.delete_user_account()
 * returns void
 * language plpgsql
 * security definer
 * set search_path = public
 * as $$
 * declare
 *   current_user_id uuid;
 * begin
 *   current_user_id := auth.uid();
 *   if current_user_id is null then
 *     raise exception 'Unauthorized: No active authenticated session found.';
 *   end if;
 *   delete from public.cadence_sync_records where user_id = current_user_id;
 *   delete from auth.users where id = current_user_id;
 * end;
 * $$;
 *
 * revoke all on function public.delete_user_account() from public;
 * grant execute on function public.delete_user_account() to authenticated;
 * ```
 */
export async function deleteUserAccount(user: User): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase is not configured in this environment.",
    };
  }

  try {
    const userId = user.id;

    // 1. Explicitly remove all cloud sync records belonging to this user
    const { error: dataDeleteError } = await supabase
      .from("cadence_sync_records")
      .delete()
      .eq("user_id", userId);

    if (dataDeleteError) {
      console.warn("Failed to delete user records from cadence_sync_records:", dataDeleteError);
    }

    // 2. Invoke the server-side RPC procedure to delete the user from auth.users
    const { error: rpcError } = await supabase.rpc("delete_user_account");

    if (rpcError) {
      console.error(
        "Supabase RPC 'delete_user_account' returned an error. Ensure the SQL function has been deployed in the Supabase Dashboard:",
        rpcError,
      );
      return {
        success: false,
        error: rpcError.message || "Failed to delete account on the server.",
      };
    }

    // 3. Complete client-side sign out to clear session tokens and storage
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.warn("Error signing out after account deletion:", signOutError);
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Unexpected error during account deletion:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete account.",
    };
  }
}

