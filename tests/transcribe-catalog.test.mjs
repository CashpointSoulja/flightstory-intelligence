import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectApprovedSources, transcribeApprovedSource } from '../scripts/transcribe_catalog.mjs';
import { chooseCandidate, titleSimilarity } from '../scripts/resolve_catalog_videos.mjs';

const eligible = { id: 'ep-1', title: 'Long interview', eligibleForTranscription: true };
const notEligible = { id: 'ep-2', title: 'Short clip', eligibleForTranscription: false };
const approved = {
  episodeId: 'ep-1', videoId: 'abcdefghijk', channelId: 'UC1234567890123456789012',
  rightsStatus: 'approved', approvalReference: 'rights-ticket-42'
};
const manifest = sources => ({ sources });

test('catalogue resolver keeps only exact channel matches and meaningful title matches', () => {
  assert.ok(titleSimilarity('The Money Habit and Financial Freedom', 'The Money Habit and Financial Freedom | DOAC'), 0.8);
  assert.equal(chooseCandidate({ title: 'The Money Habit' }, [{ id: 'wrongwrong01', channel_id: 'other', title: 'The Money Habit' }, { id: 'rightvideo01', channel_id: approved.channelId, title: 'The Money Habit | Steven Bartlett' }], approved.channelId).id, 'rightvideo01');
  assert.equal(chooseCandidate({ title: 'A Completely Different Conversation' }, [{ id: 'rightvideo01', channel_id: approved.channelId, title: 'The Money Habit' }], approved.channelId), null);
});

test('missing or malformed manifests are rejected before selection', () => {
  assert.throws(() => selectApprovedSources(undefined, [eligible]), /manifest/);
  assert.throws(() => selectApprovedSources({}, [eligible]), /sources array/);
  assert.throws(() => selectApprovedSources(manifest([]), [eligible]), /non-empty/);
});

test('manifest entries for ineligible episodes are rejected', () => {
  assert.throws(() => selectApprovedSources(manifest([approved, { ...approved, episodeId: 'ep-2' }]), [eligible, notEligible]), /not eligible/);
  assert.deepEqual(selectApprovedSources(manifest([approved]), [eligible]).map(({ episode }) => episode.id), ['ep-1']);
});

test('CLI without a manifest exits before creating output or invoking yt-dlp', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'flightstory-transcribe-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const bin = join(temp, 'bin');
  await mkdir(bin);
  const marker = join(temp, 'yt-dlp-called');
  const fakeYtDlp = join(bin, 'yt-dlp');
  await writeFile(fakeYtDlp, `#!/bin/sh\ntouch '${marker}'\n`);
  await chmod(fakeYtDlp, 0o755);
  const raw = join(temp, 'data', 'raw');
  const progress = join(raw, 'catalog-progress.json');
  const script = fileURLToPath(new URL('../scripts/transcribe_catalog.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: temp,
    encoding: 'utf8',
    env: { ...process.env, PATH: bin }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:.*approved-source-manifest/);
  assert.equal(existsSync(raw), false);
  assert.equal(existsSync(marker), false);
});

test('short-form catalogue entries require an explicit bulk opt-in', () => {
  const short = { id: 'ep-short', title: 'Short moment', eligibleForTranscription: false };
  const source = { ...approved, episodeId: short.id };
  assert.throws(() => selectApprovedSources(manifest([source]), [short]), /not eligible/);
  assert.deepEqual(selectApprovedSources(manifest([source]), [short], { includeIneligible: true }).map(({ episode }) => episode.id), ['ep-short']);
});

test('manifest requires approved rights, an approval reference, an exact video ID, and an expected channel', () => {
  for (const source of [
    { ...approved, rightsStatus: 'unknown' },
    { ...approved, approvalReference: '  ' },
    { ...approved, videoId: 'title-search-not-id' },
    { ...approved, channelId: '' }
  ]) assert.throws(() => selectApprovedSources(manifest([source]), [eligible]), /required|approved|valid exact/i);
});

test('unknown catalogue entries fail closed', () => {
  assert.throws(() => selectApprovedSources(manifest([{ ...approved, episodeId: 'missing' }]), [eligible]), /Unknown catalogue episode/);
});

test('metadata must match both approved video and channel before captions are requested', async () => {
  for (const metadata of [
    { id: 'lmnopqrstuv', channel_id: approved.channelId },
    { id: approved.videoId, channel_id: 'UC0000000000000000000000' }
  ]) {
    const calls = [];
    await assert.rejects(transcribeApprovedSource({ source: approved, episode: eligible, raw: '/tmp/raw', run: async args => {
      calls.push(args);
      return JSON.stringify(metadata);
    } }), /mismatch/);
    assert.equal(calls.length, 1, 'captions must not be requested after a metadata mismatch');
  }
});

test('captions are requested only after exact metadata verification', async () => {
  const calls = [];
  await transcribeApprovedSource({ source: approved, episode: eligible, raw: '/tmp/raw', run: async args => {
    calls.push(args);
    return calls.length === 1 ? JSON.stringify({ id: approved.videoId, channel_id: approved.channelId }) : '';
  } });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('--dump-single-json'));
  assert.ok(calls[1].includes('--write-auto-subs'));
  assert.ok(calls[0].at(-1).endsWith(approved.videoId));
  assert.equal(calls[0].at(-1), calls[1].at(-1));
});

import { parseTimestamp, parseVtt } from '../scripts/normalize_vtt.mjs';
test('VTT normalizer preserves cue boundaries and readable text', () => {
  assert.equal(parseTimestamp('00:01:02.500'), 62.5);
  assert.equal(parseTimestamp('01:02.500'), 62.5);
  assert.deepEqual(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:03.500\n<c.green>Hello &amp; world</c>\n\n2\n00:00:04,000 --> 00:00:05,000\nSecond cue'), [
    { start: 1, end: 3.5, text: 'Hello & world' },
    { start: 4, end: 5, text: 'Second cue' },
  ]);
});
