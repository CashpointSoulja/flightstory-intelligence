import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const evidence = [
  { id: 'hormozi-confidence', episode: 'The Diary Of A CEO with Alex Hormozi', guest: 'Alex Hormozi', videoId: 'hormozi-demo', start: 2472, end: 2538, topic: 'confidence', quote: 'Confidence is not something you wait for. It is built by keeping promises to yourself, especially the small ones.', note: 'A practical view: confidence follows evidence of action.' },
  { id: 'robbins-action', episode: 'The Diary Of A CEO with Mel Robbins', guest: 'Mel Robbins', videoId: 'robbins-demo', start: 4110, end: 4172, topic: 'confidence', quote: 'You do not need to feel ready to begin. The movement creates the feeling that you were waiting for.', note: 'A behavioural view: action comes before confidence.' },
  { id: 'huberman-focus', episode: 'The Diary Of A CEO with Dr Andrew Huberman', guest: 'Dr Andrew Huberman', videoId: 'huberman-demo', start: 2472, end: 2554, topic: 'dopamine focus attention', quote: 'Dopamine is less about pleasure than it is about motivation, pursuit and the willingness to keep attention on a goal.', note: 'A neuroscience view: dopamine helps sustain pursuit.' },
  { id: 'smith-failure', episode: 'The Diary Of A CEO with Dr Julie Smith', guest: 'Dr Julie Smith', videoId: 'smith-demo', start: 1728, end: 1796, topic: 'failure identity', quote: 'Failure is an event, not an identity. The story you attach to it determines whether you can use it.', note: 'A therapeutic view: separate what happened from who you are.' }
];

function searchLocal(query) {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  const ranked = evidence.map(item => ({ item, score: words.reduce((score, word) => score + ((item.topic + ' ' + item.quote + ' ' + item.note).toLowerCase().includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  const matches = ranked.filter(({ score }) => score > 0).slice(0, 4).map(({ item }) => item);
  if (!matches.length) return { answer: 'I could not verify that in the indexed archive. Try a topic such as confidence, dopamine, focus, failure or identity.', citations: [], mode: 'local-fallback' };
  return { answer: `${matches.length} relevant moments are indexed. Across these conversations, the archive suggests that ${matches[0].note.toLowerCase()} The evidence below keeps the interpretation tied to the original episode.`, citations: matches, mode: 'local-fallback' };
}

function instructions() {
  return 'You are FlightStory Intelligence, a private archive search tool. Answer only from the supplied transcript evidence. If the evidence does not support the question, say exactly that you could not verify it in the indexed archive. Do not invent speakers, quotes, episode titles or timestamps. Return strict JSON with keys answer (string), citationIds (array of evidence ids).';
}

async function searchOpenAI(query) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, input: [{ role: 'system', content: instructions() }, { role: 'user', content: `Question: ${query}\n\nEvidence:\n${evidence.map(item => JSON.stringify(item)).join('\n')}` }], temperature: 0.2 }) });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
  const data = await response.json();
  const parsed = JSON.parse(data.output_text);
  return { answer: parsed.answer, citations: evidence.filter(item => parsed.citationIds?.includes(item.id)), mode: 'openai' };
}

async function body(request) { let value = ''; for await (const chunk of request) value += chunk; return JSON.parse(value || '{}'); }
function send(response, status, data, type = 'application/json') { response.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); response.end(type === 'application/json' ? JSON.stringify(data) : data); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/search') {
      const { query } = await body(request);
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 500) return send(response, 400, { error: 'Enter a question between 2 and 500 characters.' });
      let result;
      try { result = await searchOpenAI(query.trim()); } catch (error) { result = null; }
      send(response, 200, result || searchLocal(query.trim()));
      return;
    }
    const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
    const file = join(root, 'public', requested);
    if (!file.startsWith(join(root, 'public'))) return send(response, 403, { error: 'Forbidden' });
    send(response, 200, await readFile(file), types[extname(file)] || 'application/octet-stream');
  } catch (error) { send(response, error.code === 'ENOENT' ? 404 : 500, { error: 'The archive could not complete that request.' }); }
});
server.listen(port, () => console.log(`FlightStory Intelligence running at http://localhost:${port}`));
