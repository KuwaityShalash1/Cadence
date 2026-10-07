-- ==============================================================================
-- Migration: 003_delete_user_account.sql
-- Description: RPC function enabling authenticated users to delete their own account.
-- Notes:
--   To execute user deletion from the client side without exposing the service_role key,
--   this PostgreSQL function runs with SECURITY DEFINER privileges. It permanently
--   removes the caller's record from auth.users.
--
--   Because public.cadence_sync_records references auth.users(id) with ON DELETE CASCADE,
--   all associated sync records will automatically be removed by the database engine.
-- ==============================================================================

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Unauthorized: No active authenticated session found.';
  end if;

  -- 1. Explicitly clean up user sync records (in addition to ON DELETE CASCADE)
  delete from public.cadence_sync_records
  where user_id = current_user_id;

  -- 2. Delete user from auth.users schema
  delete from auth.users
  where id = current_user_id;
end;
$$;

-- Grant execution permissions strictly to authenticated users
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;

