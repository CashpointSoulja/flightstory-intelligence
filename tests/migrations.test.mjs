import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const insforgePath = new URL('../insforge/migrations/0007_shared_clip_review.sql', import.meta.url);
const supabasePath = new URL('../supabase/migrations/0007_shared_clip_review.sql', import.meta.url);
const quotaInsforgePath = new URL('../insforge/migrations/0008_workspace_search_quota.sql', import.meta.url);
const quotaSupabasePath = new URL('../supabase/migrations/0008_workspace_search_quota.sql', import.meta.url);

test('canonical InsForge migrations match the reviewed InsForge drafts', async () => {
  const pairs = [
    [
      new URL('../migrations/20260915080324_workspace-transcript-search.sql', import.meta.url),
      new URL('../insforge/migrations/0006_workspace_transcript_search.sql', import.meta.url)
    ],
    [
      new URL('../migrations/20260915080328_shared-clip-review.sql', import.meta.url),
      new URL('../insforge/migrations/0007_shared_clip_review.sql', import.meta.url)
    ],
    [
      new URL('../migrations/20260915080400_workspace-search-quota.sql', import.meta.url),
      new URL('../insforge/migrations/0008_workspace_search_quota.sql', import.meta.url)
    ]
  ];
  for (const [canonicalPath, reviewedPath] of pairs) {
    assert.equal(await readFile(canonicalPath, 'utf8'), await readFile(reviewedPath, 'utf8'));
  }
});

test('workspace search quota is shared, membership-checked, and fixed by the database', async () => {
  const [insforge, supabase] = await Promise.all([readFile(quotaInsforgePath, 'utf8'), readFile(quotaSupabasePath, 'utf8')]);
  assert.equal(insforge, supabase);
  assert.match(insforge, /primary key \(workspace_id, user_id\)/);
  assert.match(insforge, /wm\.workspace_id = target_workspace_id and wm\.user_id = actor_id/);
  assert.match(insforge, /security definer[\s\S]*set search_path = pg_catalog, flightstory, auth, pg_temp/);
  assert.match(insforge, /quota\.request_count < 20/);
  assert.match(insforge, /extract\(epoch from request_time\) \/ 60/);
  assert.match(insforge, /interval '60 seconds'/);
  assert.match(insforge, /revoke all on table flightstory\.workspace_search_quotas from public, anon, authenticated/);
  assert.match(insforge, /revoke all on function flightstory\.consume_workspace_search_quota\(uuid\) from public, anon, authenticated/);
  assert.match(insforge, /grant execute on function flightstory\.consume_workspace_search_quota\(uuid\) to authenticated/);
  assert.doesNotMatch(insforge, /limit_per_window|window_seconds|request_limit/);
});

test('shared clip review migration stays mirrored and re-runnable', async () => {
  const [insforge, supabase] = await Promise.all([readFile(insforgePath, 'utf8'), readFile(supabasePath, 'utf8')]);
  assert.equal(insforge, supabase);
  assert.match(insforge, /add column if not exists create_request_id/);
  assert.match(insforge, /create table if not exists flightstory\.clip_reviews/);
  assert.match(insforge, /create unique index if not exists clips_create_request_key/);
  assert.match(insforge, /drop policy if exists boards_workspace_read/);
  assert.match(insforge, /create or replace function flightstory\.save_clip_draft/);
});

test('new clips bind workspace, episode, transcript version, segment, and board together', async () => {
  const sql = await readFile(insforgePath, 'utf8');
  for (const constraint of [
    'clips_episode_workspace_fk', 'clips_version_episode_fk', 'clips_source_segment_fk',
    'clips_segment_version_fk', 'clips_board_workspace_fk', 'clip_reviews_clip_workspace_fk'
  ]) assert.match(sql, new RegExp(`constraint ${constraint}\\s+foreign key`));
  assert.match(sql, /foreign key \(episode_id, workspace_id\) references flightstory\.episodes\(id, workspace_id\) not valid/);
  assert.match(sql, /foreign key \(source_segment_id, transcript_version_id\) references flightstory\.transcript_segments\(id, transcript_version_id\) not valid/);
  assert.match(sql, /source_segment_id, board_id/);
  assert.match(sql, /e\.rights_status = 'approved'/);
  assert.match(sql, /v\.status = 'canonical'/);
});

test('authenticated clip mutations are limited to checked, idempotent RPCs', async () => {
  const sql = await readFile(insforgePath, 'utf8');
  assert.match(sql, /revoke insert, update, delete on flightstory\.research_boards, flightstory\.clips from authenticated/);
  assert.equal((sql.match(/set search_path = pg_catalog, flightstory, auth, pg_temp/g) || []).length, 5);
  assert.doesNotMatch(sql, /set search_path = [^\n]*\bpublic\b/);
  for (const [name, signature] of [
    ['create_research_board', 'uuid, text, uuid'],
    ['save_clip_draft', 'uuid, uuid, bigint, bigint, text, text, uuid'],
    ['edit_clip_draft', 'uuid, bigint, bigint, text, text'],
    ['submit_clip_for_review', 'uuid'],
    ['review_clip', 'uuid, text, text, uuid']
  ]) {
    const functionSql = sql.match(new RegExp(`create or replace function flightstory\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
    assert.ok(functionSql, `missing ${name}`);
    assert.match(functionSql, /security definer/);
    assert.match(functionSql, /auth\.uid\(\)/);
    assert.match(sql, new RegExp(`grant execute on function flightstory\\.${name}\\(${signature.replaceAll(', ', ',\\s*')}\\) to authenticated`));
    assert.match(sql, new RegExp(`revoke all on function flightstory\\.${name}\\(${signature.replaceAll(', ', ',\\s*')}\\) from public, anon`));
  }
  assert.match(sql, /on conflict \(workspace_id, created_by, create_request_id\)/);
  assert.equal((sql.match(/into joined_row/g) || []).length, 3);
  assert.doesNotMatch(sql, /into clip_row, episode_row/);
  assert.match(sql, /Creators cannot review their own clips/);
  assert.match(sql, /actor_role is null or actor_role not in \('owner', 'admin'\)/);
  assert.match(sql, /insert into flightstory\.clip_reviews/);
  const reviewSql = sql.match(/create or replace function flightstory\.review_clip\([\s\S]*?\$\$;/)?.[0];
  assert.match(reviewSql, /on conflict on constraint clip_reviews_workspace_id_reviewed_by_request_id_key do nothing\s+returning id into inserted_review_id/);
  assert.match(reviewSql, /if inserted_review_id is null then[\s\S]*?if not found or previous_review\.clip_id <> target_clip_id or previous_review\.decision <> decision[\s\S]*?return;/);
});
