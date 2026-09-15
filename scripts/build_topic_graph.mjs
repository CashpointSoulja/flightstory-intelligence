import { readFile, writeFile } from 'node:fs/promises';

const source = process.argv[2] || 'data/episodes/q2cg1gEYWJQ.json';
const output = process.argv[3] || 'public/topic-graph.json';
const data = JSON.parse(await readFile(source, 'utf8'));
const stopwords = new Set('a about after all also am an and are as at be because been before being but by can could did do does doing down during each for from get got had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of on once only or other our ours ourselves out over own said same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who why will with would you your yours yourself yourselves'.split(/\s+/));
const generic = new Set('like know right people think youre its going want make really just time day thing things way say saying said come came feel feeling got get getting take taking use used using look looking see seeing good better best lot lots kind sort much many little big first last new even still back mean means maybe always never someone something anything every everyone talking talk talks ask asking question questions tell told telling give given need needs work working make made makes does doing'.split(/\s+/));
const segments = data.segments.filter(segment => typeof segment.text === 'string' && segment.text.trim());
const tokenise = text => text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).map(word => word.replace(/^['-]+|['-]+$/g, '')).filter(word => word.length > 3 && !stopwords.has(word) && !generic.has(word) && !/^\d+$/.test(word));
const occurrences = new Map();
for (const [index, segment] of segments.entries()) {
  const unique = new Set(tokenise(segment.text));
  for (const word of unique) {
    const item = occurrences.get(word) || { word, count: 0, segmentIndexes: [], seconds: segment.start ?? 0 };
    item.count += 1; item.segmentIndexes.push(index); occurrences.set(word, item);
  }
}
const candidates = [...occurrences.values()].filter(item => item.count >= 2).sort((a, b) => b.count - a.count).slice(0, 700);
const nodes = candidates.map((item, index) => ({ id: `topic-${index + 1}`, label: item.word, occurrences: item.count, seconds: item.seconds, source: data.url }));
const edges = [];
const overlap = (a, b) => {
  const set = new Set(a.segmentIndexes); let shared = 0;
  for (const index of b.segmentIndexes) if (set.has(index)) shared += 1;
  return shared;
};
for (let left = 0; left < candidates.length; left += 1) for (let right = left + 1; right < candidates.length; right += 1) {
  const sharedSegments = overlap(candidates[left], candidates[right]);
  const distance = Math.abs(candidates[left].seconds - candidates[right].seconds);
  const proximity = distance < 180 ? 1 : distance < 600 ? .35 : 0;
  const weight = sharedSegments * 4 + proximity;
  if (weight > 0) edges.push({ source: nodes[left].id, target: nodes[right].id, weight: Number(weight.toFixed(2)), sharedSegments, reason: sharedSegments ? 'co-mentioned in transcript segments' : 'appears within the same conversation window' });
}
edges.sort((a, b) => b.weight - a.weight);
const selected = edges.slice(0, Math.max(1800, Math.min(edges.length, 5000)));
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), transcript: { id: data.id, title: data.title, url: data.url, segments: segments.length }, nodes, edges: selected }, null, 2));
console.log(JSON.stringify({ nodes: nodes.length, connections: selected.length, transcriptSegments: segments.length, output }));
