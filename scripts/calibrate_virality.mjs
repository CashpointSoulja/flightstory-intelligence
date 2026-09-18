// Calibration: 5 hand-validated viral-hit windows (scored 9-10 vs rubric) must
// rank clearly above the 12 random control windows (hand-scored mean 2.5).
import { readFile } from 'node:fs/promises';
import { scoreWindow } from './lib/virality.mjs';

const index = JSON.parse(await readFile(new URL('../data/search-index.json', import.meta.url), 'utf8'));
const byEp = new Map();
for (const s of index.segments) { if (!byEp.has(s.episodeId)) byEp.set(s.episodeId, []); byEp.get(s.episodeId).push(s); }
const winText = (ep, lo, hi) => (byEp.get(ep) || []).filter(s => Number(s.start) >= lo && Number(s.start) <= hi).map(s => s.quote).join(' ');

const HITS = [
  ['HIT epstein 1.4M', 't38LbMVoPCs', 0, 90],
  ['HIT psychopath 3.8M', 'AcK_zgJjnoo', 0, 100],
  ['HIT black-plastic 4.5M', 'PyhmvAL-iYw', 3660, 3760],
  ['HIT receipts 2M', 'PyhmvAL-iYw', 3850, 3960],
  ['HIT karen-hao 1.5M', 'Cn8HBj8QAbk', 560, 680],
];
const RAND = [ // original seed-42 sample (Python), episodeId @ start
  ['R0 fat-loss', 'dmz--DQty8o', 3207], ['R1 neuroscientist', '7KTwmEGsY5g', 902],
  ['R2 brecka', '10enqcw2Qiw', 3116], ['R3 focus', 'kNOX7a7-kwQ', 359],
  ['R4 codie', 'IYu_PDPqKFc', 448], ['R5 hormozi', 'HwmwyBgzj8c', 2340],
  ['R6 mia', 'GHxXHKpMBm8', 1461], ['R7 lie-detector', 'AcK_zgJjnoo', 939],
  ['R8 peptides', 'jt5hHb6kzYM', 1244], ['R9 mitochondria', '6xlmaorRY0w', 1929],
  ['R10 insulin', 'gryta3KZKU4', 6792], ['R11 cancer-rant', 'kBm8Ho-_RXM', 4179],
];
const rows = [];
for (const [tag, ep, lo, hi] of HITS) {
  const r = scoreWindow(winText(ep, lo, hi), lo);
  rows.push({ tag, score: r ? r.score : -1, reasons: r ? r.reasons.join('; ') : 'FILTERED' });
}
for (const [tag, ep, start] of RAND) {
  const lo = Math.max(0, start - 20), hi = start + 60;
  const r = scoreWindow(winText(ep, lo, hi), lo);
  rows.push({ tag, score: r ? r.score : -1, reasons: r ? r.reasons.join('; ') : 'FILTERED' });
}
for (const r of rows) console.log(`${String(r.score).padStart(3)}  ${r.tag}  [${r.reasons}]`);
const hitMin = Math.min(...rows.slice(0, 5).map(r => r.score));
const randMax = Math.max(...rows.slice(5).map(r => r.score));
console.log(`\nhitMin=${hitMin} randMax=${randMax}`);
if (hitMin < randMax + 1) { console.log('FAIL: separation margin < 1'); process.exit(1); }
console.log('PASS: all hits rank above randoms with margin >= 1');
