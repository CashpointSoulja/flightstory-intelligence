alter table flightstory.workspaces
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists workspaces_owner_id_idx on flightstory.workspaces(owner_id);
create index if not exists workspace_members_user_id_idx on flightstory.workspace_members(user_id);
create index if not exists research_boards_workspace_id_idx on flightstory.research_boards(workspace_id);
create index if not exists research_boards_owner_id_idx on flightstory.research_boards(owner_id);
create index if not exists clips_episode_id_idx on flightstory.clips(episode_id);
create index if not exists clips_created_by_idx on flightstory.clips(created_by);
create index if not exists clips_transcript_version_id_idx on flightstory.clips(transcript_version_id);
create index if not exists transcript_versions_episode_id_idx on flightstory.transcript_versions(episode_id);
create index if not exists transcript_versions_source_asset_id_idx on flightstory.transcript_versions(source_asset_id);
create index if not exists processing_jobs_workspace_id_idx on flightstory.processing_jobs(workspace_id);
create index if not exists processing_jobs_episode_id_idx on flightstory.processing_jobs(episode_id);
create index if not exists processing_jobs_clip_id_idx on flightstory.processing_jobs(clip_id);

drop policy if exists workspace_create on flightstory.workspaces;
create policy workspace_create on flightstory.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists workspace_member_self_create on flightstory.workspace_members;
create policy workspace_member_self_create on flightstory.workspace_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from flightstory.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))
  );

create or replace function flightstory.bootstrap_workspace(workspace_name text)
returns uuid
language plpgsql
security invoker
set search_path = flightstory, public
as $$
declare
  new_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(workspace_name)) not between 1 and 120 then
    raise exception 'Workspace name must be between 1 and 120 characters';
  end if;

  select wm.workspace_id into new_workspace_id
  from flightstory.workspace_members wm
  where wm.user_id = (select auth.uid())
  order by wm.created_at
  limit 1;
  if new_workspace_id is not null then
    return new_workspace_id;
  end if;

  insert into flightstory.workspaces (name, owner_id)
  values (trim(workspace_name), (select auth.uid()))
  returning id into new_workspace_id;
  insert into flightstory.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, (select auth.uid()), 'owner');
  return new_workspace_id;
end;
$$;

revoke all on function flightstory.bootstrap_workspace(text) from public;
grant execute on function flightstory.bootstrap_workspace(text) to authenticated;
