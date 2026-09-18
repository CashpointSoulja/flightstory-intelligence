// Feedback loop: record that a moment was posted to socials and how it
// performed. The scorer re-weights pattern families from these outcomes
// (viral +0.5, hit +0.25, ok +0.1, flop -0.25 per family; clamp [0.5, 2]),
// so the heuristic drifts toward what actually performs for DOAC.
// Usage: node scripts/mark_posted.mjs --videoId X --start 123 --outcome hit [--views 1200000] [--notes "..." ]
//        node scripts/mark_posted.mjs --report
import { readFile, writeFile } from 'node:fs/promises';
import { scoreWindow } from './lib/virality.mjs';

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : null; };
const path = new URL('../data/virality-outcomes.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8').catch(() => '{"outcomes":[]}'));
data.outcomes ??= [];

if (args.includes('--report')) {
  const tally = {};
  for (const o of data.outcomes) for (const c of o.clusters || []) {
    tally[c] ??= { viral: 0, hit: 0, ok: 0, flop: 0 };
    tally[c][o.outcome] = (tally[c][o.outcome] || 0) + 1;
  }
  console.log(JSON.stringify({ total: data.outcomes.length, perCluster: tally }, null, 1));
  process.exit(0);
}

const videoId = arg('videoId');
const start = Number(arg('start'));
const outcome = arg('outcome');
if (!videoId || !Number.isFinite(start) || !['flop', 'ok', 'hit', 'viral'].includes(outcome)) {
  console.error('Usage: --videoId X --start N --outcome flop|ok|hit|viral [--views N] [--notes "..."]');
  process.exit(1);
}

// Tag the outcome with the heuristic's own read of that window, so re-weights
// attach to the pattern families the scorer actually saw.
const index = JSON.parse(await readFile(new URL('../data/search-index.json', import.meta.url), 'utf8'));
const segs = index.segments.filter(s => s.videoId === videoId && Number(s.start) >= start - 20 && Number(s.start) < start + 60);
const scored = segs.length ? scoreWindow(segs.map(s => s.quote).join(' '), Math.max(0, start - 20)) : null;
const clusters = scored ? scored.reasons.flatMap(r => (r.startsWith('patterns: ') ? r.slice(10).split(',') : [])) : [];

data.outcomes.push({
  videoId, start, outcome,
  views: Number(arg('views')) || null,
  notes: arg('notes') || null,
  postedAt: new Date().toISOString(),
  heuristicScore: scored ? scored.score : null,
  clusters,
});
await writeFile(path, `${JSON.stringify(data, null, 1)}\n`);
console.log(`Recorded ${outcome} for ${videoId}@${start}s (heuristic ${scored ? scored.score : 'unscored'}, clusters: ${clusters.join(', ') || 'none'}). Total outcomes: ${data.outcomes.length}. Re-run scripts/score_virality.mjs + bake_virality_public.mjs to apply re-weights.`);
