// Stamps video-links.json with indexedVideoCount: how many of the map's
// video nodes actually have transcripts in the search index. Keeps the
// universe header honest about searchable corpus coverage.
import { readFile, writeFile } from 'node:fs/promises';

const links = JSON.parse(await readFile(new URL('../public/video-links.json', import.meta.url), 'utf8'));
const index = JSON.parse(await readFile(new URL('../data/search-index.json', import.meta.url), 'utf8'));
const indexed = new Set(index.segments.map(segment => segment.videoId));
const count = links.nodes.filter(node => {
  const match = /[?&]v=([\w-]{11})/.exec(node.source || '');
  return match && indexed.has(match[1]);
}).length;
links.indexedVideoCount = count;
await writeFile(new URL('../public/video-links.json', import.meta.url), `${JSON.stringify(links, null, 1)}\n`);
console.log(`indexedVideoCount=${count} of ${links.nodes.length} graph videos`);
