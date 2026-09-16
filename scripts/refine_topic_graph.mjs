import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2] || 'data/search-index.json';
const output = process.argv[3] || 'public/topic-graph.json';
const data = JSON.parse(await readFile(input, 'utf8'));
const previous = JSON.parse(await readFile('public/topic-graph.json', 'utf8'));
const stopwords = new Set('a about after all also am an and are as at be because been before being but by can could did do does doing down during each for from get got had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of on once only or other our ours ourselves out over own said same she should so some such than that the their theirs them themselves then there these they this those through to too under up very was we were what when where which while who why will with would you your yours yourself yourselves'.split(/\s+/));
const generic = new Set('able again almost absolutely another around asked asking back become called came cant certain come coming could done especially everybody everyone everything fact feel feeling find first found goes good great happened happens hard healthy help important interesting keep know lets like little look lovely making maybe might much new nothing often people person part point powerful really said says show someone something stuff successful sure take talking tell terms thats thing things think thought times today together wanted way whatever whole went work working wrong years'.split(/\s+/));
const conceptRoots = /meaning|purpose|identity|conscious|exist|philosoph|spiritual|relig|faith|belief|death|life|soul|mind|mental|brain|trauma|anx|depress|lonel|emotion|happi|suffer|relationship|marriage|family|love|trust|power|wealth|money|capital|business|success|failure|leader|educat|parent|mascul|feminin|culture|societ|politic|freedom|responsib|moral|truth|attention|technolog|artificial|future|creativ|health|addict|sleep|diet|exercise|invest|work|career|human|conversation/i;
const tokenise = text => text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).map(word => word.replace(/^['-]+|['-]+$/g, '').replaceAll("'", '')).filter(Boolean);
const meaningful = word => word.length > 3 && !stopwords.has(word) && !generic.has(word) && !/^\d+$/.test(word);
const segments = (data.segments || []).filter(segment => typeof segment.quote === 'string' && segment.quote.trim());
const occurrences = new Map();
for (const segment of segments) {
  const words = tokenise(segment.quote);
  const candidates = new Set();
  for (let start = 0; start < words.length; start += 1) for (let length = 1; length <= 4 && start + length <= words.length; length += 1) {
    const phraseWords = words.slice(start, start + length);
    const content = phraseWords.filter(meaningful);
    if (content.length < (length === 1 ? 1 : 2) || content.length !== phraseWords.filter(word => !stopwords.has(word)).length) continue;
    const trimmed = phraseWords.slice();
    while (trimmed.length && stopwords.has(trimmed[0])) trimmed.shift();
    while (trimmed.length && stopwords.has(trimmed.at(-1))) trimmed.pop();
    const phrase = trimmed.join(' ');
    if (trimmed.length >= 1 && conceptRoots.test(phrase) && trimmed.every(meaningful)) candidates.add(phrase);
  }
  for (const phrase of candidates) {
    const item = occurrences.get(phrase) || { phrase, segments: new Set(), episodes: new Set(), source: segment.videoId, seconds: segment.start, sourceTitle: segment.episode };
    item.segments.add(segment.id); item.episodes.add(segment.episodeId); occurrences.set(phrase, item);
  }
}
const concepts = [...occurrences.values()].filter(item => item.segments.size >= 3 && item.episodes.size >= 2).sort((a, b) => (b.phrase.split(' ').length > 1) - (a.phrase.split(' ').length > 1) || b.episodes.size - a.episodes.size || b.segments.size - a.segments.size || a.phrase.localeCompare(b.phrase)).slice(0, 70);
const nodes = concepts.map((item, index) => ({ id: `topic-${index + 1}`, label: item.phrase, occurrences: item.segments.size, episodeCount: item.episodes.size, seconds: item.seconds || 0, source: `https://www.youtube.com/watch?v=${encodeURIComponent(item.source)}`, sourceTitle: item.sourceTitle }));
const bySegment = new Map();
const byEpisode = new Map();
for (const [index, item] of concepts.entries()) for (const segmentId of item.segments) { const list = bySegment.get(segmentId) || []; list.push(index); bySegment.set(segmentId, list); }
for (const [index, item] of concepts.entries()) for (const episodeId of item.episodes) { const list = byEpisode.get(episodeId) || []; list.push(index); byEpisode.set(episodeId, list); }
const pairCounts = new Map();
for (const list of bySegment.values()) for (let left = 0; left < list.length; left += 1) for (let right = left + 1; right < list.length; right += 1) { const key = list[left] < list[right] ? `${list[left]}:${list[right]}` : `${list[right]}:${list[left]}`; pairCounts.set(key, (pairCounts.get(key) || 0) + 1); }
for (const list of byEpisode.values()) for (let left = 0; left < list.length; left += 1) for (let right = left + 1; right < list.length; right += 1) { const key = list[left] < list[right] ? `${list[left]}:${list[right]}` : `${list[right]}:${list[left]}`; pairCounts.set(key, (pairCounts.get(key) || 0) + .25); }
const edges = [...pairCounts].map(([key, sharedSegments]) => { const [left, right] = key.split(':').map(Number); return { source: nodes[left].id, target: nodes[right].id, weight: Number((sharedSegments * 4).toFixed(2)), sharedSegments: Math.round(sharedSegments), reason: sharedSegments >= 1 ? 'co-mentioned in transcript segment' : 'appears in the same conversation archive' }; }).sort((a, b) => b.weight - a.weight).slice(0, 12000);
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), transcriptCount: data.sourceCount, rejectedTranscripts: 0, nodes, edges }, null, 2));
console.log(JSON.stringify({ transcriptSegments: segments.length, concepts: nodes.length, connections: edges.length, output }));
