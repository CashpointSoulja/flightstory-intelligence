// Apply data/intro-remap.json (from build_intro_remap.mjs) to the search
// indexes: intro-montage segment citations move to the timestamp where the
// quote is actually said in the episode body. True cold opens are untouched.
import { readFile, writeFile } from 'node:fs/promises';

const remap = (JSON.parse(await readFile(new URL('../data/intro-remap.json', import.meta.url), 'utf8'))).remap;
for (const path of ['../data/search-index.json', '../public/demo-index.json']) {
  const url = new URL(path, import.meta.url);
  const index = JSON.parse(await readFile(url, 'utf8'));
  let applied = 0;
  for (const s of index.segments) {
    const r = remap[s.id];
    if (!r) continue;
    s.start = r.start;
    s.end = r.end;
    s.introRemapped = true;
    applied++;
  }
  await writeFile(url, `${JSON.stringify(index, null, path.includes('demo') ? 1 : 2)}\n`);
  console.log(`${path}: ${applied} intro citations moved to their real in-episode timestamps`);
}
