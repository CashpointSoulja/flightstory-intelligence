create or replace function flightstory.list_episodes()
returns setof flightstory.episodes
language sql
stable
security invoker
set search_path = flightstory, public
as $$
  select e.*
  from flightstory.episodes e
  where flightstory.is_member(e.workspace_id)
  order by e.publish_date desc nulls last, e.created_at desc;
$$;

revoke all on function flightstory.list_episodes() from public;
grant execute on function flightstory.list_episodes() to authenticated;
