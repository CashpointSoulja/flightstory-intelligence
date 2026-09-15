-- Shared fixed-window quota for authenticated workspace transcript search.
-- This limits requests, not OpenAI spend in dollars.

create table if not exists flightstory.workspace_search_quotas (
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count between 1 and 20),
  primary key (workspace_id, user_id)
);

alter table flightstory.workspace_search_quotas enable row level security;
revoke all on table flightstory.workspace_search_quotas from public, anon, authenticated;

create or replace function flightstory.consume_workspace_search_quota(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  request_time timestamptz := clock_timestamp();
  current_window timestamptz;
  current_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (
    select 1 from flightstory.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = actor_id
  ) then
    raise exception using errcode = '42501', message = 'Workspace membership required';
  end if;

  current_window := to_timestamp(floor(extract(epoch from request_time) / 60) * 60);
  insert into flightstory.workspace_search_quotas as quota (workspace_id, user_id, window_start, request_count)
    values (target_workspace_id, actor_id, current_window, 1)
    on conflict (workspace_id, user_id) do update
      set window_start = excluded.window_start,
          request_count = case when quota.window_start <> excluded.window_start then 1 else quota.request_count + 1 end
      where quota.window_start <> excluded.window_start or quota.request_count < 20
    returning quota.request_count into current_count;

  if current_count is not null then
    return jsonb_build_object('allowed', true, 'retryAfterSeconds', 0, 'remaining', 20 - current_count);
  end if;
  return jsonb_build_object(
    'allowed', false,
    'retryAfterSeconds', greatest(1, ceil(extract(epoch from current_window + interval '60 seconds' - request_time))::integer),
    'remaining', 0
  );
end;
$$;

revoke all on function flightstory.consume_workspace_search_quota(uuid) from public, anon, authenticated;
grant execute on function flightstory.consume_workspace_search_quota(uuid) to authenticated;
