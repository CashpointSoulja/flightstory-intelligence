#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const [file, workspaceId] = process.argv.slice(2);
if (!file || !workspaceId) {
  console.error('Usage: node scripts/import_episode.mjs <episode.json> <workspace-id>');
  process.exit(1);
}

const episode = JSON.parse(await readFile(file, 'utf8'));
if (!episode.id || !episode.title || !Array.isArray(episode.segments) || !episode.segments.length) throw new Error('Episode JSON needs id, title, and non-empty segments.');

const sqlQuote = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const query = sql => JSON.parse(execFileSync('npx', ['--yes', '@insforge/cli', 'db', 'query', sql, '--json'], { encoding: 'utf8' }));
const firstId = result => result.rows?.[0]?.id;

const existing = query(`select id from flightstory.episodes where workspace_id = ${sqlQuote(workspaceId)}::uuid and youtube_video_id = ${sqlQuote(episode.id)} limit 1`);
if (firstId(existing)) {
  console.log(`Episode already exists: ${firstId(existing)}`);
  process.exit(0);
}

const episodeRow = query(`insert into flightstory.episodes (workspace_id, title, publish_date, youtube_video_id, duration_seconds, status, rights_status) values (${sqlQuote(workspaceId)}::uuid, ${sqlQuote(episode.title)}, ${episode.upload_date ? sqlQuote(`${episode.upload_date.slice(0, 4)}-${episode.upload_date.slice(4, 6)}-${episode.upload_date.slice(6, 8)}`) : 'null'}::date, ${sqlQuote(episode.id)}, ${Number(episode.duration) || 'null'}, 'ready', 'unknown') returning id`);
const episodeId = firstId(episodeRow);
if (!episodeId) throw new Error('Episode insert did not return an id.');

const versionRow = query(`insert into flightstory.transcript_versions (episode_id, provider, model, status) values (${sqlQuote(episodeId)}::uuid, 'youtube-captions', 'doac-memory-parser', 'provisional') returning id`);
const versionId = firstId(versionRow);
if (!versionId) throw new Error('Transcript version insert did not return an id.');

for (let offset = 0; offset < episode.segments.length; offset += 100) {
  const values = episode.segments.slice(offset, offset + 100).map((segment, index) => `(${sqlQuote(versionId)}::uuid, ${offset + index}, ${Math.round(Number(segment.start) * 1000)}, ${Math.max(Math.round(Number(segment.end) * 1000), Math.round(Number(segment.start) * 1000) + 1)}, ${sqlQuote(segment.text)})`).join(',');
  query(`insert into flightstory.transcript_segments (transcript_version_id, segment_index, start_ms, end_ms, text) values ${values}`);
  console.log(`Imported segments ${Math.min(offset + 100, episode.segments.length)}/${episode.segments.length}`);
}

console.log(`Imported ${episode.title} (${episodeId}) as transcript-only evidence.`);
