create table if not exists public.cadence_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  record_id text not null,
  data jsonb,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, store_name, record_id)
);

create index if not exists cadence_sync_records_user_updated_idx
  on public.cadence_sync_records (user_id, updated_at);

alter table public.cadence_sync_records enable row level security;

create policy "Users can read their own sync records"
  on public.cadence_sync_records for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sync records"
  on public.cadence_sync_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sync records"
  on public.cadence_sync_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own sync records"
  on public.cadence_sync_records for delete
  using (auth.uid() = user_id);

create or replace function public.upsert_cadence_sync_record(
  p_store_name text,
  p_record_id text,
  p_data jsonb,
  p_updated_at timestamptz,
  p_deleted boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cadence_sync_records (
    user_id, store_name, record_id, data, updated_at, deleted
  )
  values (
    auth.uid(), p_store_name, p_record_id, p_data, p_updated_at, p_deleted
  )
  on conflict (user_id, store_name, record_id) do update
  set data = excluded.data,
      updated_at = excluded.updated_at,
      deleted = excluded.deleted
  where excluded.updated_at > cadence_sync_records.updated_at;
end;
$$;
