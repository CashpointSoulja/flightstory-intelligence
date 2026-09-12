import { readdir, readFile, writeFile } from 'node:fs/promises';

const episodeDir = process.argv[2] || '/Users/whtnybiatch/doac-memory/data/episodes';
const output = process.argv[3] || 'public/topic-graph.json';
const files = (await readdir(episodeDir)).filter(file => file.endsWith('.json'));
const episodes = await Promise.all(files.map(file => readFile(`${episodeDir}/${file}`, 'utf8').then(JSON.parse)));
const stopwords = new Set('a about after all also am an and are as at be because been before being but by can could did do does doing down during each for from get got had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of on once only or other our ours ourselves out over own said same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who why will with would you your yours yourself yourselves'.split(/\s+/));
const generic = new Set('like know right people think youre its going want make really time day thing things way say saying said come came feel feeling got get getting take taking use used using look looking see seeing good better best lot lots kind sort much many little big first last new even still back mean means maybe always never someone something anything every everyone talking talk talks ask asking question questions tell told telling give given need needs work working made makes does doing'.split(/\s+/));
const tokenise = text => text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).map(word => word.replace(/^['-]+|['-]+$/g, '')).filter(word => word.length > 3 && !stopwords.has(word) && !generic.has(word) && !/^\d+$/.test(word));
const occurrences = new Map();
for (const episode of episodes) for (const [segmentIndex, segment] of (episode.segments || []).entries()) {
  const key = `${episode.id}:${segmentIndex}`; const words = new Set(tokenise(segment.text || ''));
  for (const word of words) { const item = occurrences.get(word) || { word, keys: new Set(), episodes: new Set(), first: segment.start || 0, source: episode.url }; item.keys.add(key); item.episodes.add(episode.id); occurrences.set(word, item); }
}
const candidates = [...occurrences.values()].filter(item => item.keys.size >= 3).sort((a, b) => b.keys.size - a.keys.size).slice(0, 1000);
const nodes = candidates.map((item, index) => ({ id: `topic-${index + 1}`, label: item.word, occurrences: item.keys.size, episodeCount: item.episodes.size, seconds: item.first, source: item.source }));
const keyToNodes = new Map(); candidates.forEach((item, index) => item.keys.forEach(key => { const list = keyToNodes.get(key) || []; list.push(index); keyToNodes.set(key, list); }));
const pairCounts = new Map();
for (const list of keyToNodes.values()) for (let left = 0; left < list.length; left += 1) for (let right = left + 1; right < list.length; right += 1) {
  const a = list[left]; const b = list[right]; const key = a < b ? `${a}:${b}` : `${b}:${a}`; pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
}
const edges = [...pairCounts].map(([key, sharedSegments]) => { const [left, right] = key.split(':').map(Number); return { source: nodes[left].id, target: nodes[right].id, weight: sharedSegments * 4, sharedSegments, reason: 'co-mentioned in transcript segment' }; });
edges.sort((a, b) => b.weight - a.weight);
const selected = edges.slice(0, Math.min(edges.length, 12000));
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), transcriptCount: episodes.length, nodes, edges: selected }, null, 2));
console.log(JSON.stringify({ episodes: episodes.length, nodes: nodes.length, connections: selected.length, output }));
