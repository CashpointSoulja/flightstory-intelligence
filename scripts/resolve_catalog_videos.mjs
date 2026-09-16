#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tokenise = value => new Set(String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 2));
export function titleSimilarity(expected, candidate) {
  const wanted = tokenise(expected), actual = tokenise(candidate);
  if (!wanted.size || !actual.size) return 0;
  let overlap = 0; for (const word of wanted) if (actual.has(word)) overlap += 1;
  return overlap / wanted.size;
}

export function chooseCandidate(episode, results, expectedChannelId) {
  return results.filter(result => result?.id && result.channel_id === expectedChannelId)
    .map(result => ({ ...result, titleScore: titleSimilarity(episode.title, result.title) }))
    .filter(result => result.titleScore >= 0.45)
    .sort((a, b) => b.titleScore - a.titleScore || String(a.id).localeCompare(String(b.id)))[0] || null;
}

const runSearch = query => new Promise((resolveSearch, reject) => {
  const child = spawn('yt-dlp', ['--flat-playlist', '--dump-single-json', '--skip-download', '--no-warnings', `ytsearch5:${query}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = ''; child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', code => code === 0 ? resolveSearch(out.trim()) : reject(new Error(err.trim().split('\n').at(-1) || `yt-dlp exited ${code}`)));
});

async function main() {
  const [catalogPath = 'public/catalog.json', outputPath = 'data/catalog-video-candidates.json', expectedChannelId, ...flags] = process.argv.slice(2);
  if (!expectedChannelId || flags.some(flag => flag !== '--include-ineligible')) throw new Error('Usage: node scripts/resolve_catalog_videos.mjs [catalog] [output] <expected-channel-id> [--include-ineligible]');
  const includeIneligible = flags.includes('--include-ineligible');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const episodes = catalog.episodes.filter(episode => includeIneligible || episode.eligibleForTranscription === true);
  const result = { generatedAt: new Date().toISOString(), expectedChannelId, source: catalog.source, sources: [], unresolved: [] };
  for (const [index, episode] of episodes.entries()) {
    try {
      const packet = JSON.parse(await runSearch(episode.title));
      const candidate = chooseCandidate(episode, packet.entries || [], expectedChannelId);
      if (!candidate) { result.unresolved.push({ episodeId: episode.id, title: episode.title, reason: 'No title match from the expected channel' }); }
      else result.sources.push({ episodeId: episode.id, videoId: candidate.id, channelId: expectedChannelId, rightsStatus: 'pending', approvalReference: '', matchedTitle: candidate.title, titleScore: candidate.titleScore });
    } catch (error) { result.unresolved.push({ episodeId: episode.id, title: episode.title, reason: error.message }); }
    console.log(`${index + 1}/${episodes.length} ${episode.title.slice(0, 70)}`);
  }
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ searched: episodes.length, candidates: result.sources.length, unresolved: result.unresolved.length, outputPath, rightsStatus: 'pending' }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
