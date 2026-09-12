create or replace function flightstory.bootstrap_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
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

  select workspace_id into new_workspace_id
  from workspace_members
  where user_id = (select auth.uid())
  order by created_at
  limit 1;
  if new_workspace_id is not null then
    return new_workspace_id;
  end if;

  insert into workspaces (name) values (trim(workspace_name)) returning id into new_workspace_id;
  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, (select auth.uid()), 'owner');
  return new_workspace_id;
end;
$$;

revoke all on function flightstory.bootstrap_workspace(text) from public;
grant execute on function flightstory.bootstrap_workspace(text) to authenticated;
