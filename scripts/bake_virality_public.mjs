// Bakes the private virality scores into public/virality.json: videoId +
// timestamp + score/tier ONLY (no transcript text), so the map UI can sort
// sub-topic moments by clip potential without exposing corpus content.
import { readFile, writeFile } from 'node:fs/promises';

const scores = JSON.parse(await readFile(new URL('../data/virality-scores.json', import.meta.url), 'utf8'));
const windows = (scores.windows || [])
  .filter(w => w.score >= 5)
  .map(({ videoId, start, end, score, tier }) => ({ videoId, start, end, score, tier }));
await writeFile(new URL('../public/virality.json', import.meta.url), `${JSON.stringify({ generatedAt: scores.generatedAt, windows }, null, 1)}\n`);
console.log(`public virality windows: ${windows.length}`);
