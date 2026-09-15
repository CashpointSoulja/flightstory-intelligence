-- Shared editorial boards and source-bound clip review.
-- Additive: existing boards/clips remain readable; new writes go through the RPCs below.

alter table flightstory.research_boards
  add column if not exists create_request_id uuid;

alter table flightstory.clips
  add column if not exists board_id uuid,
  add column if not exists source_segment_id uuid,
  add column if not exists suggested_start_ms bigint,
  add column if not exists suggested_end_ms bigint,
  add column if not exists create_request_id uuid,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_decision text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists flightstory.clip_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  clip_id uuid not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  note text check (note is null or length(note) <= 2000),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, reviewed_by, request_id)
);

create unique index if not exists research_boards_id_workspace_key
  on flightstory.research_boards(id, workspace_id);
create unique index if not exists episodes_id_workspace_key
  on flightstory.episodes(id, workspace_id);
create unique index if not exists transcript_versions_id_episode_key
  on flightstory.transcript_versions(id, episode_id);
create unique index if not exists transcript_segments_id_version_key
  on flightstory.transcript_segments(id, transcript_version_id);
create unique index if not exists clips_id_workspace_key
  on flightstory.clips(id, workspace_id);
create unique index if not exists research_boards_create_request_key
  on flightstory.research_boards(workspace_id, owner_id, create_request_id)
  where create_request_id is not null;
create unique index if not exists clips_create_request_key
  on flightstory.clips(workspace_id, created_by, create_request_id)
  where create_request_id is not null;
create index if not exists clips_board_workspace_created_idx
  on flightstory.clips(workspace_id, board_id, created_at desc);
create index if not exists clip_reviews_workspace_created_idx
  on flightstory.clip_reviews(workspace_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_episode_workspace_fk') then
    alter table flightstory.clips add constraint clips_episode_workspace_fk
      foreign key (episode_id, workspace_id) references flightstory.episodes(id, workspace_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_version_episode_fk') then
    alter table flightstory.clips add constraint clips_version_episode_fk
      foreign key (transcript_version_id, episode_id) references flightstory.transcript_versions(id, episode_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_source_segment_fk') then
    alter table flightstory.clips add constraint clips_source_segment_fk
      foreign key (source_segment_id) references flightstory.transcript_segments(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_segment_version_fk') then
    alter table flightstory.clips add constraint clips_segment_version_fk
      foreign key (source_segment_id, transcript_version_id) references flightstory.transcript_segments(id, transcript_version_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_board_workspace_fk') then
    alter table flightstory.clips add constraint clips_board_workspace_fk
      foreign key (board_id, workspace_id) references flightstory.research_boards(id, workspace_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_suggested_range_check') then
    alter table flightstory.clips add constraint clips_suggested_range_check
      check ((suggested_start_ms is null and suggested_end_ms is null) or
             (suggested_start_ms is not null and suggested_end_ms is not null and suggested_start_ms >= 0 and suggested_end_ms > suggested_start_ms)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clip_reviews'::regclass and conname = 'clip_reviews_clip_workspace_fk') then
    alter table flightstory.clip_reviews add constraint clip_reviews_clip_workspace_fk
      foreign key (clip_id, workspace_id) references flightstory.clips(id, workspace_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_review_metadata_check') then
    alter table flightstory.clips add constraint clips_review_metadata_check
      check ((review_decision is null and reviewed_by is null and reviewed_at is null) or
             (review_decision is not null and review_decision in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'flightstory.clips'::regclass and conname = 'clips_approval_requires_reviewer_check') then
    alter table flightstory.clips add constraint clips_approval_requires_reviewer_check
      check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null and review_decision = 'approved')) not valid;
  end if;
end;
$$;

-- Prior versions allowed clip creators to set approved without reviewer evidence.
update flightstory.clips set status = 'needs_review', updated_at = now()
  where status = 'approved' and (reviewed_by is null or reviewed_at is null or review_decision is distinct from 'approved');

alter table flightstory.clip_reviews enable row level security;
drop policy if exists boards_owner_read on flightstory.research_boards;
drop policy if exists boards_owner_write on flightstory.research_boards;
drop policy if exists boards_workspace_read on flightstory.research_boards;
drop policy if exists clips_member_read on flightstory.clips;
drop policy if exists clip_reviews_member_read on flightstory.clip_reviews;
create policy boards_workspace_read on flightstory.research_boards for select to authenticated
  using (flightstory.is_member(workspace_id));
create policy clips_member_read on flightstory.clips for select to authenticated using (
  flightstory.is_member(workspace_id)
  and exists (select 1 from flightstory.episodes e where e.id = episode_id and e.workspace_id = clips.workspace_id)
  and (board_id is null or exists (select 1 from flightstory.research_boards b where b.id = board_id and b.workspace_id = clips.workspace_id))
  and (transcript_version_id is null or exists (select 1 from flightstory.transcript_versions v where v.id = transcript_version_id and v.episode_id = clips.episode_id))
  and (source_segment_id is null or exists (select 1 from flightstory.transcript_segments s where s.id = source_segment_id and s.transcript_version_id = clips.transcript_version_id))
);
create policy clip_reviews_member_read on flightstory.clip_reviews for select to authenticated
  using (flightstory.is_member(workspace_id) and exists (
    select 1 from flightstory.clips c where c.id = clip_id and c.workspace_id = clip_reviews.workspace_id
  ));

-- Table writes are revoked so callers cannot bypass the checks in these functions.
revoke insert, update, delete on flightstory.research_boards, flightstory.clips from authenticated;
grant select on flightstory.research_boards, flightstory.clips, flightstory.clip_reviews to authenticated;
revoke all on flightstory.clip_reviews from anon, authenticated;
revoke all on flightstory.clip_reviews from public;
grant select on flightstory.clip_reviews to authenticated;

create or replace function flightstory.create_research_board(
  target_workspace_id uuid,
  board_name text,
  request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  existing flightstory.research_boards%rowtype;
  board_id uuid;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if request_id is null or board_name is null or length(trim(board_name)) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'A request id and board name of 1 to 160 characters are required';
  end if;
  select wm.role into actor_role from flightstory.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = actor_id for share of wm;
  if actor_role is null then raise exception using errcode = '42501', message = 'Workspace membership required'; end if;
  select b.* into existing from flightstory.research_boards b
    where b.workspace_id = target_workspace_id and b.owner_id = actor_id and b.create_request_id = request_id;
  if found then
    if existing.name <> trim(board_name) then raise exception using errcode = '22023', message = 'Request id was already used with different board details'; end if;
    return existing.id;
  end if;
  insert into flightstory.research_boards (workspace_id, owner_id, name, create_request_id)
    values (target_workspace_id, actor_id, trim(board_name), request_id)
    on conflict (workspace_id, owner_id, create_request_id) where create_request_id is not null do nothing
    returning id into board_id;
  if board_id is null then
    select b.* into existing from flightstory.research_boards b
      where b.workspace_id = target_workspace_id and b.owner_id = actor_id and b.create_request_id = request_id;
    if not found or existing.name <> trim(board_name) then raise exception using errcode = '22023', message = 'Request id was already used with different board details'; end if;
    return existing.id;
  end if;
  return board_id;
end;
$$;

create or replace function flightstory.save_clip_draft(
  target_board_id uuid,
  target_segment_id uuid,
  suggested_start_ms bigint,
  suggested_end_ms bigint,
  clip_title text,
  clip_hook text,
  request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  board_workspace uuid;
  existing flightstory.clips%rowtype;
  target_workspace uuid;
  target_episode uuid;
  target_version uuid;
  segment_start bigint;
  segment_end bigint;
  duration_ms bigint;
  clip_id uuid;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if request_id is null or suggested_start_ms is null or suggested_end_ms is null or suggested_start_ms < 0 or suggested_end_ms <= suggested_start_ms then
    raise exception using errcode = '22023', message = 'A request id and valid clip range are required';
  end if;
  select b.workspace_id, wm.role into board_workspace, actor_role
    from flightstory.research_boards b join flightstory.workspace_members wm on wm.workspace_id = b.workspace_id
    where b.id = target_board_id and wm.user_id = actor_id for share of b, wm;
  if not found then raise exception using errcode = 'P0002', message = 'Board not found'; end if;
  select c.* into existing from flightstory.clips c
    where c.workspace_id = board_workspace and c.created_by = actor_id and c.create_request_id = request_id;
  if found then
    if existing.board_id <> target_board_id or existing.source_segment_id <> target_segment_id
       or existing.suggested_start_ms <> suggested_start_ms or existing.suggested_end_ms <> suggested_end_ms
       or existing.title is distinct from nullif(trim(clip_title), '')
       or existing.hook is distinct from nullif(trim(clip_hook), '') then
      raise exception using errcode = '22023', message = 'Request id was already used with different clip details';
    end if;
    return existing.id;
  end if;
  select e.workspace_id, e.id, v.id, s.start_ms, s.end_ms, e.duration_seconds::bigint * 1000
    into target_workspace, target_episode, target_version, segment_start, segment_end, duration_ms
    from flightstory.transcript_segments s
    join flightstory.transcript_versions v on v.id = s.transcript_version_id
    join flightstory.episodes e on e.id = v.episode_id
    where s.id = target_segment_id and e.workspace_id = board_workspace
      and e.status = 'ready' and e.rights_status = 'approved' and e.duration_seconds is not null
      and v.status = 'canonical'
    for share of s, v, e;
  if not found then raise exception using errcode = '42501', message = 'Approved canonical source segment not found'; end if;
  if suggested_end_ms > duration_ms or suggested_start_ms > segment_start or suggested_end_ms < segment_end then
    raise exception using errcode = '22023', message = 'Suggested range must contain its source segment and fit the episode duration';
  end if;
  if clip_title is not null and length(trim(clip_title)) > 200 then raise exception using errcode = '22023', message = 'Title must be 200 characters or fewer'; end if;
  if clip_hook is not null and length(trim(clip_hook)) > 2000 then raise exception using errcode = '22023', message = 'Hook must be 2000 characters or fewer'; end if;
  insert into flightstory.clips (
    workspace_id, episode_id, created_by, transcript_version_id, source_segment_id, board_id,
    start_ms, end_ms, suggested_start_ms, suggested_end_ms, title, hook, status, create_request_id
  ) values (
    target_workspace, target_episode, actor_id, target_version, target_segment_id, target_board_id,
    suggested_start_ms, suggested_end_ms, suggested_start_ms, suggested_end_ms,
    nullif(trim(clip_title), ''), nullif(trim(clip_hook), ''), 'suggested', request_id
  ) on conflict (workspace_id, created_by, create_request_id) where create_request_id is not null do nothing
    returning id into clip_id;
  if clip_id is null then
    select c.* into existing from flightstory.clips c
      where c.workspace_id = target_workspace and c.created_by = actor_id and c.create_request_id = request_id;
    if not found or existing.board_id <> target_board_id or existing.source_segment_id <> target_segment_id
       or existing.suggested_start_ms <> suggested_start_ms or existing.suggested_end_ms <> suggested_end_ms
       or existing.title is distinct from nullif(trim(clip_title), '')
       or existing.hook is distinct from nullif(trim(clip_hook), '') then
      raise exception using errcode = '22023', message = 'Request id was already used with different clip details';
    end if;
    clip_id := existing.id;
  end if;
  return clip_id;
end;
$$;

create or replace function flightstory.edit_clip_draft(
  target_clip_id uuid,
  edited_start_ms bigint,
  edited_end_ms bigint,
  clip_title text,
  clip_hook text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  clip_row flightstory.clips%rowtype;
  episode_row flightstory.episodes%rowtype;
  joined_row record;
  version_status text;
  episode_status text;
  rights_status text;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select c, e into joined_row
    from flightstory.clips c join flightstory.episodes e on e.id = c.episode_id and e.workspace_id = c.workspace_id
    join flightstory.workspace_members wm on wm.workspace_id = c.workspace_id and wm.user_id = actor_id
    where c.id = target_clip_id
    for update of c for share of wm;
  if not found then raise exception using errcode = 'P0002', message = 'Clip not found'; end if;
  clip_row := joined_row.c;
  episode_row := joined_row.e;
  if clip_row.created_by <> actor_id then raise exception using errcode = '42501', message = 'Only the clip creator may edit this draft'; end if;
  if clip_row.status not in ('suggested', 'needs_review', 'rejected') then raise exception using errcode = '55000', message = 'This clip can no longer be edited'; end if;
  select e.status, e.rights_status, v.status into episode_status, rights_status, version_status
    from flightstory.episodes e join flightstory.transcript_versions v on v.episode_id = e.id
    where e.id = clip_row.episode_id and v.id = clip_row.transcript_version_id for share of e, v;
  if episode_status <> 'ready' or rights_status <> 'approved' or version_status <> 'canonical' then
    raise exception using errcode = '55000', message = 'The clip source is no longer approved and canonical';
  end if;
  if edited_start_ms is null or edited_end_ms is null or edited_start_ms < 0 or edited_end_ms <= edited_start_ms or episode_row.duration_seconds is null
     or edited_end_ms > episode_row.duration_seconds::bigint * 1000 then
    raise exception using errcode = '22023', message = 'Edited range must fit the known episode duration';
  end if;
  if clip_row.source_segment_id is null or not exists (
    select 1 from flightstory.transcript_segments s
      where s.id = clip_row.source_segment_id and s.transcript_version_id = clip_row.transcript_version_id
        and edited_start_ms < s.end_ms and edited_end_ms > s.start_ms
  ) then
    raise exception using errcode = '22023', message = 'Edited range must overlap its source transcript segment';
  end if;
  if clip_title is not null and length(trim(clip_title)) > 200 then raise exception using errcode = '22023', message = 'Title must be 200 characters or fewer'; end if;
  if clip_hook is not null and length(trim(clip_hook)) > 2000 then raise exception using errcode = '22023', message = 'Hook must be 2000 characters or fewer'; end if;
  update flightstory.clips set start_ms = edited_start_ms, end_ms = edited_end_ms,
    title = nullif(trim(clip_title), ''), hook = nullif(trim(clip_hook), ''), status = 'suggested',
    reviewed_by = null, reviewed_at = null, review_decision = null, updated_at = now()
    where id = target_clip_id;
end;
$$;

create or replace function flightstory.submit_clip_for_review(target_clip_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  clip_row flightstory.clips%rowtype;
  episode_row flightstory.episodes%rowtype;
  joined_row record;
  version_status text;
  episode_status text;
  rights_status text;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select c, e into joined_row
    from flightstory.clips c join flightstory.episodes e on e.id = c.episode_id and e.workspace_id = c.workspace_id
    join flightstory.workspace_members wm on wm.workspace_id = c.workspace_id and wm.user_id = actor_id
    where c.id = target_clip_id
    for update of c for share of wm;
  if not found then raise exception using errcode = 'P0002', message = 'Clip not found'; end if;
  clip_row := joined_row.c;
  episode_row := joined_row.e;
  if clip_row.created_by <> actor_id then raise exception using errcode = '42501', message = 'Only the clip creator may submit this draft'; end if;
  if clip_row.status not in ('suggested', 'needs_review') then raise exception using errcode = '55000', message = 'Only a saved draft can be submitted'; end if;
  select e.status, e.rights_status, v.status into episode_status, rights_status, version_status
    from flightstory.episodes e join flightstory.transcript_versions v on v.episode_id = e.id
    where e.id = clip_row.episode_id and v.id = clip_row.transcript_version_id for share of e, v;
  if episode_status <> 'ready' or rights_status <> 'approved' or version_status <> 'canonical'
     or episode_row.duration_seconds is null or clip_row.end_ms > episode_row.duration_seconds::bigint * 1000 then
    raise exception using errcode = '55000', message = 'The source must remain approved, canonical, and duration-verified';
  end if;
  if clip_row.source_segment_id is null or not exists (
    select 1 from flightstory.transcript_segments s where s.id = clip_row.source_segment_id
      and s.transcript_version_id = clip_row.transcript_version_id and clip_row.start_ms < s.end_ms and clip_row.end_ms > s.start_ms
  ) or (clip_row.board_id is not null and not exists (
    select 1 from flightstory.research_boards b where b.id = clip_row.board_id and b.workspace_id = clip_row.workspace_id
  )) then
    raise exception using errcode = '55000', message = 'The clip must retain valid source and board provenance';
  end if;
  if clip_row.status = 'needs_review' then return; end if;
  update flightstory.clips set status = 'needs_review', updated_at = now() where id = target_clip_id;
end;
$$;

create or replace function flightstory.review_clip(target_clip_id uuid, decision text, review_note text, request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, flightstory, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  clip_row flightstory.clips%rowtype;
  episode_row flightstory.episodes%rowtype;
  joined_row record;
  version_status text;
  episode_status text;
  rights_status text;
  previous_review flightstory.clip_reviews%rowtype;
  inserted_review_id uuid;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if decision is null or decision not in ('approved', 'rejected') or request_id is null or (review_note is not null and length(review_note) > 2000) then
    raise exception using errcode = '22023', message = 'Valid review decision, request id, and note are required';
  end if;
  select c, e, wm.role into joined_row
    from flightstory.clips c join flightstory.episodes e on e.id = c.episode_id and e.workspace_id = c.workspace_id
    join flightstory.workspace_members wm on wm.workspace_id = c.workspace_id and wm.user_id = actor_id
    where c.id = target_clip_id
    for update of c for share of wm;
  if not found then raise exception using errcode = 'P0002', message = 'Clip not found'; end if;
  clip_row := joined_row.c;
  episode_row := joined_row.e;
  actor_role := joined_row.role;
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception using errcode = '42501', message = 'Workspace owner or admin review required'; end if;
  if clip_row.created_by = actor_id then raise exception using errcode = '42501', message = 'Creators cannot review their own clips'; end if;
  select r.* into previous_review from flightstory.clip_reviews r
    where r.workspace_id = clip_row.workspace_id and r.reviewed_by = actor_id and r.request_id = review_clip.request_id;
  if found then
    if previous_review.clip_id <> target_clip_id or previous_review.decision <> review_clip.decision
       or previous_review.note is distinct from nullif(review_note, '') then
      raise exception using errcode = '22023', message = 'Request id was already used with different review details';
    end if;
    return;
  end if;
  if clip_row.status <> 'needs_review' then raise exception using errcode = '55000', message = 'Clip is not awaiting review'; end if;
  select e.status, e.rights_status, v.status into episode_status, rights_status, version_status
    from flightstory.episodes e join flightstory.transcript_versions v on v.episode_id = e.id
    where e.id = clip_row.episode_id and v.id = clip_row.transcript_version_id for share of e, v;
  if episode_status <> 'ready' or rights_status <> 'approved' or version_status <> 'canonical' then
    raise exception using errcode = '55000', message = 'The clip source is no longer approved and canonical';
  end if;
  if clip_row.source_segment_id is null or not exists (
    select 1 from flightstory.transcript_segments s where s.id = clip_row.source_segment_id
      and s.transcript_version_id = clip_row.transcript_version_id and clip_row.start_ms < s.end_ms and clip_row.end_ms > s.start_ms
  ) or (clip_row.board_id is not null and not exists (
    select 1 from flightstory.research_boards b where b.id = clip_row.board_id and b.workspace_id = clip_row.workspace_id
  )) then
    raise exception using errcode = '55000', message = 'The clip must retain valid source and board provenance';
  end if;
  insert into flightstory.clip_reviews (workspace_id, clip_id, reviewed_by, decision, note, request_id)
    values (clip_row.workspace_id, clip_row.id, actor_id, decision, nullif(review_note, ''), request_id)
    on conflict on constraint clip_reviews_workspace_id_reviewed_by_request_id_key do nothing
    returning id into inserted_review_id;
  if inserted_review_id is null then
    select r.* into previous_review from flightstory.clip_reviews r
      where r.workspace_id = clip_row.workspace_id and r.reviewed_by = actor_id and r.request_id = review_clip.request_id;
    if not found or previous_review.clip_id <> target_clip_id or previous_review.decision <> decision
       or previous_review.note is distinct from nullif(review_note, '') then
      raise exception using errcode = '22023', message = 'Request id was already used with different review details';
    end if;
    return;
  end if;
  update flightstory.clips set status = decision, reviewed_by = actor_id, reviewed_at = now(),
    review_decision = decision, updated_at = now() where id = target_clip_id;
end;
$$;

revoke all on function flightstory.create_research_board(uuid, text, uuid) from public, anon;
revoke all on function flightstory.save_clip_draft(uuid, uuid, bigint, bigint, text, text, uuid) from public, anon;
revoke all on function flightstory.edit_clip_draft(uuid, bigint, bigint, text, text) from public, anon;
revoke all on function flightstory.submit_clip_for_review(uuid) from public, anon;
revoke all on function flightstory.review_clip(uuid, text, text, uuid) from public, anon;
grant execute on function flightstory.create_research_board(uuid, text, uuid) to authenticated;
grant execute on function flightstory.save_clip_draft(uuid, uuid, bigint, bigint, text, text, uuid) to authenticated;
grant execute on function flightstory.edit_clip_draft(uuid, bigint, bigint, text, text) to authenticated;
grant execute on function flightstory.submit_clip_for_review(uuid) to authenticated;
grant execute on function flightstory.review_clip(uuid, text, text, uuid) to authenticated;
