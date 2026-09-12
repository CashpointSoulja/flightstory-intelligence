#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const [file, workspaceId] = process.argv.slice(2);
if (!file || !workspaceId) {
  console.error('Usage: node scripts/import_catalog.mjs <catalog.json> <workspace-id>');
  process.exit(1);
}

const catalog = JSON.parse(await readFile(file, 'utf8'));
const entries = catalog.episodes.filter(entry => entry.eligibleForTranscription);
const quote = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const query = sql => JSON.parse(execFileSync('npx', ['--yes', '@insforge/cli', 'db', 'query', sql, '--json'], { encoding: 'utf8' }));

for (let offset = 0; offset < entries.length; offset += 50) {
  const values = entries.slice(offset, offset + 50).map(entry => `(${quote(workspaceId)}::uuid, ${quote(entry.title)}, ${quote(entry.publishedAt.slice(0, 10))}::date, ${entry.durationSeconds || 'null'}, ${quote(entry.id)}, ${quote(entry.audioUrl)}, 'catalogued', 'unknown')`).join(',');
  query(`insert into flightstory.episodes (workspace_id, title, publish_date, duration_seconds, source_guid, source_audio_url, status, rights_status) values ${values} on conflict (workspace_id, source_guid) do update set title = excluded.title, publish_date = excluded.publish_date, duration_seconds = excluded.duration_seconds, source_audio_url = excluded.source_audio_url`);
  console.log(`Imported catalogue entries ${Math.min(offset + 50, entries.length)}/${entries.length}`);
}

console.log(`Catalogue import complete: ${entries.length} long-form candidates.`);
