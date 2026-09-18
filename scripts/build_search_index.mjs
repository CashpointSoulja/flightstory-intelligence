import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] || 'data/episodes';
const output = process.argv[3] || 'data/search-index.json';
const files = (await readdir(dir)).filter(file => file.endsWith('.json'));
const rows = [];
for (const file of files) {
  const episode = JSON.parse(await readFile(join(dir, file), 'utf8'));
  let info;
  try { info = JSON.parse(await readFile(join(dir, '..', 'raw', `${episode.id}.info.json`), 'utf8')); } catch { info = { channel_id: episode.source?.channelId }; }
  // Filter on channel only when channel info exists; corpus pushes may not include raw/*.info.json.
  if (info.channel_id && info.channel_id !== 'UCGq-a57w-aPwyi3pW7XLiHw') continue;
  // Prefer the raw upload title when the episode JSON lacks one (or carries the bare video id).
  if ((!episode.title || episode.title === episode.id) && info.title) episode.title = info.title;
  const videoId = episode.url.match(/[?&]v=([^&]+)/)?.[1] || episode.id;
  const segments = episode.segments || [];
  const stride = Math.max(1, Math.floor(segments.length / 48));
  for (let index = 0; index < segments.length; index += stride) {
    const segment = segments[index];
    if (!segment?.text || segment.text.split(/\s+/).length < 8) continue;
    rows.push({ id: `${episode.id}:${index}`, episodeId: episode.id, episode: episode.title, guest: episode.title && episode.title !== episode.id && episode.title.includes(':') ? episode.title.split(':')[0] : (episode.title || episode.id), videoId, start: Number(segment.start) || 0, end: Number(segment.end) || Number(segment.start) || 0, quote: segment.text, searchText: `${episode.title} ${segment.text}`, transcriptStatus: 'provisional', speakerStatus: 'unknown' });
  }
}
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), sourceCount: new Set(rows.map(row => row.episodeId)).size, segments: rows }, null, 2));
console.log(JSON.stringify({ sources: new Set(rows.map(row => row.episodeId)).size, segments: rows.length, output }));
