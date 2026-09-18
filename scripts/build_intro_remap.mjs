// Intro-montage citation fix. DOAC episodes open with a trailer montage that
// quotes moments from later in the episode, so an indexed segment in the
// first 120s often cites text that is actually SAID later. This script finds,
// for every indexed intro segment, the real body occurrence in the raw
// corpus (word-shingle match) and writes data/intro-remap.json:
//   { "<segmentId>": { start, end, ratio } }
// Segments with no strong body match are true cold opens and keep their time.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const INTRO_S = 120;
// Verbatim-confidence rule: a body window must share at least 5 exact 8-word
// sequences with the intro quote (about one full sentence verbatim) to count
// as the real utterance; montage quotes that never repeat stay as cold opens.
const MIN_VERBATIM_HITS = 5;
const norm = t => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const shingles = (text, n = 8) => {
  const words = norm(text).split(' ');
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '));
  return set;
};

const corpusDir = new URL('../corpus/episodes/', import.meta.url).pathname;
const index = JSON.parse(await readFile(new URL('../data/search-index.json', import.meta.url), 'utf8'));
const introByEp = new Map();
for (const s of index.segments) {
  if (Number(s.start) >= INTRO_S) continue;
  if (!introByEp.has(s.episodeId)) introByEp.set(s.episodeId, []);
  introByEp.get(s.episodeId).push(s);
}

const remap = {};
let matched = 0, cold = 0, noCorpus = 0;
const corpusFiles = new Set(await readdir(corpusDir));
for (const [ep, segs] of introByEp) {
  const file = `${ep}.json`;
  if (!corpusFiles.has(file)) { noCorpus += segs.length; continue; }
  const raw = JSON.parse(await readFile(join(corpusDir, file), 'utf8'));
  // Match against rolling ~5-segment body windows: the intro quote is a long
  // montage extract, the real utterance spans several raw (10s) segments.
  const body = (raw.segments || []).filter(s => Number(s.start) >= INTRO_S && s.text);
  const WIN = 5;
  const windows = [];
  for (let i = 0; i + WIN <= body.length; i++) {
    const slice = body.slice(i, i + WIN);
    windows.push({ seg: slice[0], shingles: shingles(slice.map(s => s.text).join(' ')) });
  }
  for (const s of segs) {
    const probe = shingles(s.quote);
    if (!probe.size) { cold++; continue; }
    let best = { hits: 0, win: null };
    for (const w of windows) {
      let hits = 0;
      for (const sh of probe) if (w.shingles.has(sh)) hits++;
      if (hits > best.hits) best = { hits, win: w };
    }
    if (best.win && best.hits >= MIN_VERBATIM_HITS) {
      const dur = Number(s.end) - Number(s.start);
      remap[s.id] = { start: Number(best.win.seg.start), end: Number(best.win.seg.start) + (Number.isFinite(dur) && dur > 0 ? dur : 30), verbatimHits: best.hits };
      matched++;
    } else cold++;
  }
}
await writeFile(new URL('../data/intro-remap.json', import.meta.url), `${JSON.stringify({ generatedAt: new Date().toISOString(), introThresholdS: INTRO_S, verbatimShingle: 8, minVerbatimHits: MIN_VERBATIM_HITS, matched, coldOpensKept: cold, noCorpus, remap }, null, 1)}\n`);
console.log(JSON.stringify({ introSegments: matched + cold + noCorpus, matched, coldOpensKept: cold, noCorpus }));
