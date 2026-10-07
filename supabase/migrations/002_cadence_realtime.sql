-- Phase 3: Enable Supabase Realtime for cadence_sync_records
-- This script adds public.cadence_sync_records to the supabase_realtime publication
-- to stream INSERT, UPDATE, and DELETE Postgres change events to connected clients.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cadence_sync_records'
  ) then
    alter publication supabase_realtime add table public.cadence_sync_records;
  end if;
end $$;

-- Set replica identity to full so that UPDATE and DELETE change records
-- broadcast full record context to subscriber channels.
alter table public.cadence_sync_records replica identity full;

