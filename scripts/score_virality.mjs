// Offline heuristic virality scorer for the search-index corpus.
// Rolling 60s windows (step 30s), scored 0-10 via scripts/lib/virality.mjs —
// heuristic proxies for the rubric validated against DOAC's real top Shorts
// (calibrate_virality.mjs: all 5 confirmed hits score >=7, 12-window random
// control max 6). Zero API spend. Non-max suppressed per episode so each
// moment appears once. Output: data/virality-scores.json for hand-verification
// of the top tier before any UI surfacing.
import { readFile, writeFile } from 'node:fs/promises';
import { scoreWindow, WINDOW_S, STEP_S } from './lib/virality.mjs';

// Feedback loop: real posting outcomes re-weight pattern families.
// viral +0.5, hit +0.25, ok +0.1, flop -0.25 per recorded outcome; clamp [0.5, 2].
const OUTCOME_DELTA = { viral: 0.5, hit: 0.25, ok: 0.1, flop: -0.25 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const outcomes = JSON.parse(await readFile(new URL('../data/virality-outcomes.json', import.meta.url), 'utf8').catch(() => '{"outcomes":[]}'));
const clusterWeights = {};
for (const o of outcomes.outcomes || []) {
  const delta = OUTCOME_DELTA[o.outcome] ?? 0;
  for (const c of o.clusters || []) clusterWeights[c] = clamp((clusterWeights[c] ?? 1) + delta, 0.5, 2);
}
if (Object.keys(clusterWeights).length) console.log('outcome re-weights:', clusterWeights);

const KEEP_TOP = 600;
const MIN_SCORE = 5;
const NMS_RADIUS_S = 90;

const index = JSON.parse(await readFile(new URL('../data/search-index.json', import.meta.url), 'utf8'));
const byEpisode = new Map();
for (const seg of index.segments) {
  if (!byEpisode.has(seg.episodeId)) byEpisode.set(seg.episodeId, []);
  byEpisode.get(seg.episodeId).push(seg);
}

const windows = [];
for (const segs of byEpisode.values()) {
  segs.sort((a, b) => Number(a.start) - Number(b.start));
  const epEnd = Number(segs[segs.length - 1].start);
  for (let t = 0; t <= epEnd - 20; t += STEP_S) {
    const inWin = segs.filter(s => Number(s.start) >= t && Number(s.start) < t + WINDOW_S);
    if (!inWin.length) continue;
    const r = scoreWindow(inWin.map(s => s.quote).join(' '), t, clusterWeights);
    if (!r || r.score < MIN_SCORE) continue;
    windows.push({
      episodeId: inWin[0].episodeId, videoId: inWin[0].videoId,
      episode: inWin[0].episode, guest: inWin[0].guest,
      start: t, end: t + WINDOW_S, score: r.score,
      tier: r.score >= 8.5 ? 'TOP CLIP' : r.score >= 7 ? 'STRONG' : 'SOLID',
      reasons: r.reasons, excerpt: r.text.slice(0, 240),
    });
  }
}
// non-max suppression: within an episode, keep the highest scorer per 90s span
windows.sort((a, b) => b.score - a.score);
const kept = [];
for (const w of windows) {
  const clash = kept.some(k => k.episodeId === w.episodeId && Math.abs(k.start - w.start) < NMS_RADIUS_S);
  if (!clash) kept.push(w);
}
const top = kept.slice(0, KEEP_TOP);

// Carry LLM judgments across index rebuilds: a window whose text still
// matches a previously scored window (same episode) keeps its llmScore even
// when its timestamp moved (e.g. the intro-montage remap). Without this,
// every rebuild wipes the LLM pass.
try {
  const prev = JSON.parse(await readFile(new URL('../data/virality-scores.json', import.meta.url), 'utf8'));
  const normWords = t => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean));
  const prevByEp = new Map();
  for (const w of prev.windows || []) {
    if (w.llmScore == null) continue;
    if (!prevByEp.has(w.videoId)) prevByEp.set(w.videoId, []);
    prevByEp.get(w.videoId).push({ words: normWords(w.excerpt), llmScore: w.llmScore });
  }
  let carried = 0;
  for (const w of top) {
    const words = normWords(w.excerpt);
    let best = 0, bestScore = null;
    for (const c of prevByEp.get(w.videoId) || []) {
      let inter = 0;
      for (const x of words) if (c.words.has(x)) inter++;
      const j = inter / (words.size + c.words.size - inter || 1);
      if (j > best) { best = j; bestScore = c.llmScore; }
    }
    if (best >= 0.5 && bestScore != null) {
      w.heuristicScore = w.score;
      w.llmScore = bestScore;
      w.score = bestScore;
      w.tier = bestScore >= 8.5 ? 'TOP CLIP' : bestScore >= 7 ? 'STRONG' : 'SOLID';
      carried++;
    }
  }
  if (carried) console.log(`llmScore carried across rebuild for ${carried} windows`);
} catch {}

const out = {
  generatedAt: new Date().toISOString(),
  method: `heuristic rubric proxies, ${WINDOW_S}s windows step ${STEP_S}, NMS ${NMS_RADIUS_S}s; rubric validated vs DOAC top shorts (hits >=7 vs random max 6, calibrate_virality.mjs)`,
  outcomeWeights: clusterWeights,
  outcomesUsed: (outcomes.outcomes || []).length,
  scoredWindows: kept.length,
  tiers: {
    topClip: kept.filter(w => w.score >= 8.5).length,
    strong: kept.filter(w => w.score >= 7 && w.score < 8.5).length,
    solid: kept.filter(w => w.score >= MIN_SCORE && w.score < 7).length,
  },
  windows: top,
};
await writeFile(new URL('../data/virality-scores.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(`kept>=${MIN_SCORE}: ${kept.length}, tiers:`, out.tiers);
console.log('top 25:');
for (const w of top.slice(0, 25)) console.log(`${w.score} ${w.tier} | ${(w.guest || '?').slice(0, 26).padEnd(26)} @${String(w.start).padStart(5)} | ${w.excerpt.slice(0, 80)}`);
