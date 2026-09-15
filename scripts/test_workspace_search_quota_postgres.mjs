import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const image = 'postgres:17';
const container = `flightstory-quota-test-${process.pid}-${randomUUID().slice(0, 8)}`;
const migration = await readFile(new URL('../migrations/20260915080400_workspace-search-quota.sql', import.meta.url), 'utf8');
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const userD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';

function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

function sqlFor(user, workspace, expression = `flightstory.consume_workspace_search_quota('${workspace}'::uuid)->>'allowed'`) {
  return `begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true); select ${expression}; commit;`;
}

function psql(sql, { allowFailure = false } = {}) {
  try {
    return { stdout: docker(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql }), stderr: '' };
  } catch (error) {
    if (!allowFailure) throw error;
    return { stdout: error.stdout?.toString() || '', stderr: error.stderr?.toString() || '' };
  }
}

async function quotaCall(user, workspace, expression) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim().split('\n').at(-1)) : reject(new Error(stderr || `psql exited with ${code}`)));
    child.stdin.end(sqlFor(user, workspace, expression));
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let started = false;
try {
  docker(['image', 'inspect', image]);
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const logs = docker(['logs', container]);
      if (logs.includes('PostgreSQL init process complete; ready for start up.')) {
        docker(['exec', container, 'pg_isready', '-U', 'postgres']);
        psql('select 1;');
        ready = true;
        break;
      }
    }
    catch { /* Wait until the entrypoint's final server, not the temporary initdb server, is ready. */ }
    if (!ready) await sleep(250);
  }
  assert.ok(ready, 'PostgreSQL 17 container did not become ready');

  const setup = `
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema flightstory;
    grant usage on schema flightstory to authenticated;
    create table flightstory.workspaces (id uuid primary key);
    create table flightstory.workspace_members (
      workspace_id uuid not null references flightstory.workspaces(id),
      user_id uuid not null references auth.users(id),
      primary key (workspace_id, user_id)
    );
    insert into auth.users values ('${userA}'), ('${userB}'), ('${userC}'), ('${userD}');
    insert into flightstory.workspaces values ('${workspaceA}'), ('${workspaceB}');
    insert into flightstory.workspace_members values
      ('${workspaceA}', '${userA}'), ('${workspaceA}', '${userB}'),
      ('${workspaceB}', '${userA}'), ('${workspaceA}', '${userD}');
  `;
  psql(`${setup}\n${migration}`);

  for (let i = 0; i < 20; i++) assert.equal(await quotaCall(userA, workspaceA), 'true', `request ${i + 1} should pass`);
  assert.equal(await quotaCall(userA, workspaceA, `flightstory.consume_workspace_search_quota('${workspaceA}'::uuid)->>'allowed'`), 'false', 'request 21 should be denied');
  const retry = psql(sqlFor(userA, workspaceA, `flightstory.consume_workspace_search_quota('${workspaceA}'::uuid)->>'retryAfterSeconds'`)).stdout.trim().split('\n').at(-1);
  assert.ok(Number(retry) >= 1 && Number(retry) <= 60, `retryAfterSeconds should be 1..60, got ${retry}`);

  assert.equal(await quotaCall(userB, workspaceA), 'true', 'another member has an independent quota');
  assert.equal(await quotaCall(userA, workspaceB), 'true', 'the same user has an independent quota per workspace');
  const deniedMembership = psql(sqlFor(userC, workspaceA), { allowFailure: true });
  assert.match(deniedMembership.stderr, /Workspace membership required/);

  psql(`update flightstory.workspace_search_quotas set window_start = to_timestamp(floor(extract(epoch from clock_timestamp()) / 60) * 60) - interval '60 seconds' where user_id = '${userA}' and workspace_id = '${workspaceA}';`);
  assert.equal(await quotaCall(userA, workspaceA), 'true', 'a request in the next fixed window starts a fresh quota');

  const epoch = Number(psql('select extract(epoch from clock_timestamp())::text;').stdout.trim());
  await sleep(60_000 - (epoch * 1000 % 60_000) + 1_500);
  const results = await Promise.all(Array.from({ length: 30 }, () => quotaCall(userD, workspaceA)));
  assert.equal(results.filter(value => value === 'true').length, 20, 'exactly 20 concurrent requests should pass');
  assert.equal(results.filter(value => value === 'false').length, 10, 'the remaining concurrent requests should be denied');

  console.log('PASS: fixed 20/60 quota, 429 retry value input, user/workspace isolation, membership check, window rollover, and 30-way atomic concurrency.');
} finally {
  if (started) {
    try { docker(['stop', container]); }
    catch { /* --rm may already have removed the disposable container. */ }
  }
}
