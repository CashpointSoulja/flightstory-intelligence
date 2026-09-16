import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const episodeDir = process.argv[2] || 'data/episodes';
const output = process.argv[3] || 'public/video-links.json';
const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const key = process.env.OPENAI_API_KEY;
const files = (await readdir(episodeDir)).filter(file => file.endsWith('.json'));
const episodes = (await Promise.all(files.map(file => readFile(join(episodeDir, file), 'utf8').then(JSON.parse)))).filter(Boolean);
const enrichedEpisodes = await Promise.all(episodes.map(async episode => { try { const info = JSON.parse(await readFile(join(episodeDir, '..', 'raw', `${episode.id}.info.json`), 'utf8')); return { ...episode, channelId: info.channel_id }; } catch { return { ...episode, channelId: null }; } }));
const trustedEpisodes = enrichedEpisodes.filter(episode => episode.channelId === 'UCGq-a57w-aPwyi3pW7XLiHw');
const compact = episode => {
  const segments = episode.segments || []; const sampleCount = Math.min(16, segments.length);
  const samples = Array.from({ length: sampleCount }, (_, index) => segments[Math.floor(index * segments.length / sampleCount)]).filter(Boolean);
  return `${episode.title}\n${samples.map(segment => segment.text).join(' ')}`.slice(0, 8000);
};
const cosine = (a, b) => { let dot = 0; let aa = 0; let bb = 0; for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; aa += a[index] ** 2; bb += b[index] ** 2; } return dot / (Math.sqrt(aa) * Math.sqrt(bb)); };
const tokenise = value => new Set(String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 3));
const localSimilarity = (a, b) => { const left = tokenise(compact(a)), right = tokenise(compact(b)); let shared = 0; for (const word of left) if (right.has(word)) shared += 1; return shared / Math.sqrt(Math.max(left.size * right.size, 1)); };
let vectors = [];
if (key) for (let offset = 0; offset < trustedEpisodes.length; offset += 48) {
  const input = trustedEpisodes.slice(offset, offset + 48).map(compact);
  const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, input }) });
  if (!response.ok) throw new Error(`Embedding request failed (${response.status})`);
  const data = await response.json(); vectors.push(...data.data.sort((a, b) => a.index - b.index).map(item => item.embedding));
  console.log(`embedded ${Math.min(offset + input.length, trustedEpisodes.length)}/${trustedEpisodes.length}`);
}
const edges = new Map();
for (let left = 0; left < trustedEpisodes.length; left += 1) {
  const nearest = [];
  for (let right = 0; right < trustedEpisodes.length; right += 1) if (left !== right) nearest.push({ right, score: key ? cosine(vectors[left], vectors[right]) : localSimilarity(trustedEpisodes[left], trustedEpisodes[right]) });
  nearest.sort((a, b) => b.score - a.score).slice(0, 8).filter(item => item.score >= (key ? .35 : .08)).forEach(item => { const a = Math.min(left, item.right); const b = Math.max(left, item.right); edges.set(`${a}:${b}`, { source: `video-${a}`, target: `video-${b}`, score: Number(item.score.toFixed(4)), relationship: key ? 'semantic similarity across sampled transcript representation' : 'local token overlap across sampled transcript representation' }); });
}
const nodes = trustedEpisodes.map((episode, index) => ({ id: `video-${index}`, title: episode.title, source: episode.url, seconds: episode.segments?.[Math.floor((episode.segments.length - 1) * .5)]?.start || 0, duration: episode.durationSeconds, kind: 'video' }));
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), model: key ? model : 'local-token-overlap', method: key ? 'OpenAI embeddings over title and evenly sampled timestamped transcript segments' : 'Deterministic local token overlap over title and evenly sampled timestamped transcript segments', nodes, edges: [...edges.values()].sort((a, b) => b.score - a.score) }, null, 2));
console.log(JSON.stringify({ videos: nodes.length, connections: edges.size, output }));
