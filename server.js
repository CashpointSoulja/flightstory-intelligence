import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || '';
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

const evidence = [
  { id: 'vanessa-talk-too-much', episode: 'Vanessa Van Edwards: The Weird Trick That Makes People Like You', guest: 'Vanessa Van Edwards', videoId: 'q2cg1gEYWJQ', start: 0, end: 18, topic: 'conversation talk too much cues', quote: 'How do you know you talk too much? So, first thing is non-verbal cues. Someone is checking out if they are opening their mouth as if to say something. I call it like the open fish.', note: 'A practical conversational cue: notice when the other person is trying to enter the conversation.' },
  { id: 'vanessa-loneliness', episode: 'Vanessa Van Edwards: The Weird Trick That Makes People Like You', guest: 'Vanessa Van Edwards', videoId: 'q2cg1gEYWJQ', start: 33, end: 65, topic: 'conversation loneliness technology voice notes', quote: "And because we're having less conversations, one in six people worldwide are affected by loneliness. And I now more than ever am sending 9-minute voice notes to my friends.", note: 'A cultural observation: technology changes the amount and shape of human conversation.' },
  { id: 'vanessa-highlight', episode: 'Vanessa Van Edwards: The Weird Trick That Makes People Like You', guest: 'Vanessa Van Edwards', videoId: 'q2cg1gEYWJQ', start: 66, end: 81, topic: 'conversation networking questions highlight day', quote: 'The best conversation starter was actually what was the highlight of your day? Because the moment we asked how are you, what do you do? They ran out of things to talk about.', note: 'A tested conversation prompt that creates a richer opening than generic small talk.' }
];

function searchLocal(query) {
  const stopwords = new Set(['what', 'did', 'have', 'guests', 'guest', 'say', 'said', 'about', 'the', 'and', 'or', 'who', 'which', 'where', 'has', 'any', 'to', 'of', 'in', 'on', 'for', 'me', 'this', 'that']);
  const words = query.toLowerCase().split(/\W+/).filter(word => word.length > 2 && !stopwords.has(word));
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
    if (request.method === 'GET' && request.url === '/api/backend') {
      return send(response, 200, { provider: insforgeUrl ? 'insforge' : 'demo', configured: Boolean(insforgeUrl), project: insforgeUrl ? new URL(insforgeUrl).hostname : null });
    }
    if (request.method === 'GET' && request.url === '/api/config') {
      return send(response, 200, { insforgeUrl, insforgeAnonKey });
    }
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
