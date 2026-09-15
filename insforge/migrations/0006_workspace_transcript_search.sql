create or replace function flightstory.search_transcript_segments(
  search_query text,
  target_workspace_id uuid,
  result_limit integer default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = flightstory, public
as $$
  with query_terms as (
    select websearch_to_tsquery('english', search_query) as query
  ), eligible as (
    select
      s.id::text as id,
      e.id::text as episode_id,
      e.title as episode,
      e.guest,
      e.youtube_video_id as video_id,
      s.start_ms,
      s.end_ms,
      s.text as quote,
      s.search_text,
      query_terms.query
    from flightstory.transcript_segments s
    join flightstory.transcript_versions v on v.id = s.transcript_version_id
    join flightstory.episodes e on e.id = v.episode_id
    cross join query_terms
    where e.workspace_id = target_workspace_id
      and e.status = 'ready'
      and e.rights_status = 'approved'
      and v.status = 'canonical'
      and flightstory.is_member(target_workspace_id)
  ), matched as (
    select *, ts_rank_cd(search_text, query) as rank
    from eligible
    where search_text @@ query
    order by rank desc, start_ms
    limit least(greatest(coalesce(result_limit, 24), 1), 24)
  )
  select jsonb_build_object(
    'availableCount', (select count(*) from eligible),
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'episodeId', episode_id,
        'episode', episode,
        'guest', guest,
        'videoId', video_id,
        'start', start_ms::numeric / 1000,
        'end', end_ms::numeric / 1000,
        'quote', quote
      ) order by rank desc, start_ms)
      from matched
    ), '[]'::jsonb)
  );
$$;

revoke all on function flightstory.search_transcript_segments(text, uuid, integer) from public;
grant execute on function flightstory.search_transcript_segments(text, uuid, integer) to authenticated;
