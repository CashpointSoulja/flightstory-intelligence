import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function selectApprovedSources(manifest, catalogEpisodes) {
  if (!manifest || !Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error('Approved-source manifest must contain a non-empty sources array');
  }
  if (!Array.isArray(catalogEpisodes)) throw new Error('Episode catalogue is invalid');

  const episodes = new Map(catalogEpisodes.map(episode => [episode.id, episode]));
  const seenEpisodes = new Set();
  const selected = [];
  for (const source of manifest.sources) {
    if (!source || typeof source !== 'object' || typeof source.episodeId !== 'string') {
      throw new Error('Each manifest source must include an episodeId');
    }
    const episode = episodes.get(source.episodeId);
    if (!episode) throw new Error(`Unknown catalogue episode: ${source.episodeId}`);
    if (episode.eligibleForTranscription !== true) throw new Error(`Episode is not eligible for transcription: ${source.episodeId}`);
    if (seenEpisodes.has(source.episodeId)) throw new Error(`Duplicate manifest episode: ${source.episodeId}`);
    seenEpisodes.add(source.episodeId);
    if (source.rightsStatus !== 'approved') throw new Error(`Rights are not approved for ${source.episodeId}`);
    if (typeof source.approvalReference !== 'string' || !source.approvalReference.trim()) {
      throw new Error(`Approval reference is required for ${source.episodeId}`);
    }
    if (typeof source.videoId !== 'string' || !/^[\w-]{11}$/.test(source.videoId)) {
      throw new Error(`A valid exact YouTube video ID is required for ${source.episodeId}`);
    }
    if (typeof source.channelId !== 'string' || !source.channelId.trim()) {
      throw new Error(`Expected channel ID is required for ${source.episodeId}`);
    }
    selected.push({ source, episode });
  }
  return selected;
}

export function validateVideoMetadata(metadata, source) {
  if (metadata?.id !== source.videoId) throw new Error(`YouTube video ID mismatch for ${source.episodeId}`);
  if (metadata?.channel_id !== source.channelId) throw new Error(`YouTube channel ID mismatch for ${source.episodeId}`);
}

const runCommand = (args) => new Promise((resolve, reject) => {
  const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = '';
  child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim().split('\n').at(-1) || `yt-dlp exited ${code}`)));
});

export async function transcribeApprovedSource({ source, episode, raw, run = runCommand }) {
  const url = `https://www.youtube.com/watch?v=${source.videoId}`;
  const text = await run(['--no-playlist', '--skip-download', '--quiet', '--no-warnings', '--dump-single-json', url]);
  let metadata;
  try { metadata = JSON.parse(text); } catch { throw new Error(`Invalid yt-dlp metadata for ${source.episodeId}`); }
  validateVideoMetadata(metadata, source);
  await run(['--write-auto-subs', '--sub-langs', 'en.*', '--sub-format', 'vtt', '--skip-download', '--write-info-json', '-o', join(raw, '%(id)s'), url]);
  return { youtubeId: source.videoId, channelId: source.channelId, approvalReference: source.approvalReference, title: episode.title };
}

async function main() {
  const [manifestPath, rawArg, progressArg] = process.argv.slice(2);
  if (!manifestPath) throw new Error('Usage: node scripts/transcribe_catalog.mjs <approved-source-manifest.json> [raw-output-directory] [progress-file]');
  const raw = rawArg || 'data/raw';
  const progressPath = progressArg || join(raw, 'catalog-progress.json');
  const catalog = JSON.parse(await readFile('public/catalog.json', 'utf8')).episodes;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const sources = selectApprovedSources(manifest, catalog);
  await mkdir(raw, { recursive: true });

  let progress;
  try { progress = JSON.parse(await readFile(progressPath, 'utf8')); } catch { progress = { completed: {}, failed: {} }; }
  progress.completed ||= {};
  progress.failed ||= {};
  const matches = (entry, source) => entry?.youtubeId === source.videoId && entry?.channelId === source.channelId && entry?.approvalReference === source.approvalReference;
  const completed = sources.filter(({ source }) => matches(progress.completed[source.episodeId], source));
  const failedSources = sources.filter(({ source }) => !matches(progress.completed[source.episodeId], source) && matches(progress.failed[source.episodeId], source));
  const pending = sources.filter(({ source }) => !matches(progress.completed[source.episodeId], source) && !matches(progress.failed[source.episodeId], source));
  let cursor = 0; let done = completed.length; let failed = failedSources.length;
  let saveQueue = Promise.resolve();
  const save = () => {
    saveQueue = saveQueue.then(async () => {
      const tempPath = `${progressPath}.${process.pid}.tmp`;
      await writeFile(tempPath, JSON.stringify(progress, null, 2));
      await rename(tempPath, progressPath);
    });
    return saveQueue;
  };

  async function worker() {
    while (cursor < pending.length) {
      const { source, episode } = pending[cursor++];
      try {
        progress.completed[source.episodeId] = await transcribeApprovedSource({ source, episode, raw });
        delete progress.failed[source.episodeId]; done += 1;
        console.log(`OK ${done}/${sources.length} ${source.videoId} ${episode.title.slice(0, 72)}`);
      } catch (error) {
        progress.failed[source.episodeId] = { youtubeId: source.videoId, channelId: source.channelId, approvalReference: source.approvalReference, title: episode.title, error: error.message };
        failed += 1; console.log(`FAIL ${failed} ${episode.title.slice(0, 60)} :: ${error.message}`);
      }
      await save();
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  console.log(JSON.stringify({ total: sources.length, completed: done, failed, pending: sources.length - done - failed, progressPath }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
