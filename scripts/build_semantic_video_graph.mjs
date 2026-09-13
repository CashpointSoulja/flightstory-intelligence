import { readdir, readFile, writeFile } from 'node:fs/promises';

const episodeDir = process.argv[2] || '/Users/whtnybiatch/doac-memory/data/episodes';
const output = process.argv[3] || 'public/video-links.json';
const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('OPENAI_API_KEY is required');
const files = (await readdir(episodeDir)).filter(file => file.endsWith('.json'));
const episodes = await Promise.all(files.map(file => readFile(`${episodeDir}/${file}`, 'utf8').then(JSON.parse)));
const compact = episode => {
  const segments = episode.segments || []; const sampleCount = Math.min(16, segments.length);
  const samples = Array.from({ length: sampleCount }, (_, index) => segments[Math.floor(index * segments.length / sampleCount)]).filter(Boolean);
  return `${episode.title}\n${samples.map(segment => segment.text).join(' ')}`.slice(0, 8000);
};
const vectors = [];
for (let offset = 0; offset < episodes.length; offset += 48) {
  const input = episodes.slice(offset, offset + 48).map(compact);
  const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, input }) });
  if (!response.ok) throw new Error(`Embedding request failed (${response.status})`);
  const data = await response.json();
  vectors.push(...data.data.sort((a, b) => a.index - b.index).map(item => item.embedding));
  console.log(`embedded ${Math.min(offset + input.length, episodes.length)}/${episodes.length}`);
}
const cosine = (a, b) => { let dot = 0; let aa = 0; let bb = 0; for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; aa += a[index] ** 2; bb += b[index] ** 2; } return dot / (Math.sqrt(aa) * Math.sqrt(bb)); };
const edges = new Map();
for (let left = 0; left < vectors.length; left += 1) {
  const nearest = [];
  for (let right = 0; right < vectors.length; right += 1) if (left !== right) nearest.push({ right, score: cosine(vectors[left], vectors[right]) });
  nearest.sort((a, b) => b.score - a.score).slice(0, 8).filter(item => item.score >= .35).forEach(item => { const a = Math.min(left, item.right); const b = Math.max(left, item.right); edges.set(`${a}:${b}`, { source: `video-${a}`, target: `video-${b}`, score: Number(item.score.toFixed(4)), relationship: 'semantic similarity across sampled transcript representation' }); });
}
const nodes = episodes.map((episode, index) => ({ id: `video-${index}`, title: episode.title, source: episode.url, seconds: episode.segments?.[0]?.start || 0, duration: episode.duration, kind: 'video' }));
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), model, method: 'OpenAI embeddings over title and evenly sampled timestamped transcript segments', nodes, edges: [...edges.values()].sort((a, b) => b.score - a.score) }, null, 2));
console.log(JSON.stringify({ videos: nodes.length, connections: edges.size, output }));
