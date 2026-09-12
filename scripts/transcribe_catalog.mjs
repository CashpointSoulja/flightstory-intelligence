import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const catalog = JSON.parse(await readFile('public/catalog.json', 'utf8')).episodes.filter(item => item.eligibleForTranscription);
const raw = '/Users/whtnybiatch/doac-memory/data/raw';
const progressPath = '/Users/whtnybiatch/doac-memory/data/catalog-progress.json';
await mkdir(raw, { recursive: true });
let progress;
try { progress = JSON.parse(await readFile(progressPath, 'utf8')); } catch { progress = { completed: {}, failed: {} }; }

const run = (args) => new Promise((resolve, reject) => {
  const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = '';
  child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim().split('\n').at(-1) || `yt-dlp exited ${code}`)));
});
const save = () => writeFile(progressPath, JSON.stringify(progress, null, 2));
const pending = catalog.filter(item => !progress.completed[item.id] && !progress.failed[item.id]);
let cursor = 0; let done = Object.keys(progress.completed).length; let failed = Object.keys(progress.failed).length;
async function worker() {
  while (cursor < pending.length) {
    const item = pending[cursor++];
    try {
      const id = await run(['--flat-playlist', '--playlist-end', '1', '--quiet', '--no-warnings', `ytsearch1:${item.title} Diary of a CEO`, '--print', '%(id)s']);
      if (!id || id.includes('\n')) throw new Error('ambiguous YouTube match');
      await run(['--write-auto-subs', '--sub-langs', 'en.*', '--sub-format', 'vtt', '--skip-download', '--write-info-json', '-o', `${raw}/%(id)s`, `https://www.youtube.com/watch?v=${id}`]);
      progress.completed[item.id] = { youtubeId: id, title: item.title }; done += 1;
      console.log(`OK ${done}/${catalog.length} ${id} ${item.title.slice(0, 72)}`);
    } catch (error) { progress.failed[item.id] = { title: item.title, error: error.message }; failed += 1; console.log(`FAIL ${failed} ${item.title.slice(0, 60)} :: ${error.message}`); }
    await save();
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
console.log(JSON.stringify({ total: catalog.length, completed: done, failed, pending: catalog.length - done - failed, progressPath }));
