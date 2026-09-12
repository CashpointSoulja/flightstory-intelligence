create schema if not exists flightstory;
create extension if not exists vector with schema extensions;

create table flightstory.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table flightstory.workspace_members (
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table flightstory.episodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  title text not null,
  guest text,
  publish_date date,
  youtube_video_id text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  status text not null default 'catalogued' check (status in ('catalogued', 'processing', 'ready', 'failed', 'archived')),
  rights_status text not null default 'unknown' check (rights_status in ('unknown', 'approved', 'restricted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table flightstory.episode_assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references flightstory.episodes(id) on delete cascade,
  kind text not null check (kind in ('source_video', 'proxy_video', 'audio', 'thumbnail', 'transcript_json', 'clip_render')),
  storage_path text not null,
  checksum text,
  source_time_offset_ms integer not null default 0,
  available boolean not null default false,
  created_at timestamptz not null default now(),
  unique (episode_id, kind, storage_path)
);

create table flightstory.transcript_versions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references flightstory.episodes(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null default 'provisional' check (status in ('provisional', 'canonical', 'superseded', 'failed')),
  speaker_mapping_verified boolean not null default false,
  source_asset_id uuid references flightstory.episode_assets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table flightstory.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_version_id uuid not null references flightstory.transcript_versions(id) on delete cascade,
  segment_index integer not null check (segment_index >= 0),
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms > start_ms),
  text text not null check (length(trim(text)) > 0),
  speaker_label text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  words jsonb not null default '[]'::jsonb,
  search_text tsvector generated always as (to_tsvector('english', text)) stored,
  embedding extensions.vector(1536),
  unique (transcript_version_id, segment_index)
);

create table flightstory.research_boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table flightstory.clips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  episode_id uuid not null references flightstory.episodes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  transcript_version_id uuid references flightstory.transcript_versions(id) on delete set null,
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms > start_ms),
  title text,
  hook text,
  opportunity_score numeric(5,2) check (opportunity_score is null or opportunity_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  status text not null default 'suggested' check (status in ('suggested', 'needs_review', 'approved', 'rejected', 'rendering', 'ready')),
  render_storage_path text,
  created_at timestamptz not null default now()
);

create table flightstory.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references flightstory.workspaces(id) on delete cascade,
  episode_id uuid references flightstory.episodes(id) on delete cascade,
  clip_id uuid references flightstory.clips(id) on delete cascade,
  kind text not null check (kind in ('ingest', 'transcribe', 'embed', 'analyse', 'render_clip')),
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transcript_segments_search_idx on flightstory.transcript_segments using gin(search_text);
create index transcript_segments_embedding_idx on flightstory.transcript_segments using hnsw (embedding vector_cosine_ops);
create index episodes_workspace_idx on flightstory.episodes(workspace_id, publish_date desc);
create index clips_workspace_idx on flightstory.clips(workspace_id, status, created_at desc);

create or replace function flightstory.is_member(target_workspace uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from flightstory.workspace_members
    where workspace_id = target_workspace and user_id = (select auth.uid())
  );
$$;

alter table flightstory.workspaces enable row level security;
alter table flightstory.workspace_members enable row level security;
alter table flightstory.episodes enable row level security;
alter table flightstory.episode_assets enable row level security;
alter table flightstory.transcript_versions enable row level security;
alter table flightstory.transcript_segments enable row level security;
alter table flightstory.research_boards enable row level security;
alter table flightstory.clips enable row level security;
alter table flightstory.processing_jobs enable row level security;

create policy workspace_members_read on flightstory.workspaces for select using (flightstory.is_member(id));
create policy workspace_members_self_read on flightstory.workspace_members for select using (user_id = (select auth.uid()));
create policy episodes_member_read on flightstory.episodes for select using (flightstory.is_member(workspace_id));
create policy assets_member_read on flightstory.episode_assets for select using (exists (select 1 from flightstory.episodes e where e.id = episode_id and flightstory.is_member(e.workspace_id)));
create policy transcripts_member_read on flightstory.transcript_versions for select using (exists (select 1 from flightstory.episodes e where e.id = episode_id and flightstory.is_member(e.workspace_id)));
create policy segments_member_read on flightstory.transcript_segments for select using (exists (select 1 from flightstory.transcript_versions v join flightstory.episodes e on e.id = v.episode_id where v.id = transcript_version_id and flightstory.is_member(e.workspace_id)));
create policy boards_owner_read on flightstory.research_boards for select using (flightstory.is_member(workspace_id) and owner_id = (select auth.uid()));
create policy boards_owner_write on flightstory.research_boards for all using (flightstory.is_member(workspace_id) and owner_id = (select auth.uid())) with check (flightstory.is_member(workspace_id) and owner_id = (select auth.uid()));
create policy clips_member_read on flightstory.clips for select using (flightstory.is_member(workspace_id));
create policy clips_owner_write on flightstory.clips for all using (flightstory.is_member(workspace_id) and created_by = (select auth.uid())) with check (flightstory.is_member(workspace_id) and created_by = (select auth.uid()));
create policy jobs_member_read on flightstory.processing_jobs for select using (flightstory.is_member(workspace_id));

revoke all on schema flightstory from anon;
grant usage on schema flightstory to authenticated;
grant select on all tables in schema flightstory to authenticated;
grant insert, update, delete on flightstory.research_boards, flightstory.clips to authenticated;
