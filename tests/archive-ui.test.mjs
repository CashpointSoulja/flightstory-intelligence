import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatTime, graphLayerVisibility, graphNodeIsVisible, isValidClipRange, isValidQuery, loadSavedItems, nearestNodeWithinRadius, persistSavedItems, removeSavedItem, watchUrl } from '../public/archive-ui.js';
import { boardClipsPageUrl, canSaveSharedDraft, citationClipInput, isValidClipPage, mergeClipPage, rangeEditInput, setReviewButtonsDisabled, sourceHeading } from '../public/shared-review.js';

test('formats whole and fractional seconds as readable timestamps', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(66), '01:06');
  assert.equal(formatTime(5.12), '00:05.12');
  assert.equal(formatTime(61.5), '01:01.50');
  assert.equal(formatTime(59.999), '01:00');
  assert.equal(formatTime(3661.5), '01:01:01.50');
});

test('graph layer state shows exactly its selected node family', () => {
  const nodeKindByLayer = { topics: 'topic', videos: 'video', evidence: 'evidence' };
  assert.deepEqual(graphLayerVisibility('topics'), { topics: true, videos: false, evidence: false });
  assert.deepEqual(graphLayerVisibility('videos'), { topics: false, videos: true, evidence: false });
  assert.deepEqual(graphLayerVisibility('evidence'), { topics: false, videos: false, evidence: true });
  for (const layer of ['topics', 'videos', 'evidence']) {
    assert.equal(graphNodeIsVisible(layer, 'core'), true);
    for (const kind of ['topic', 'video', 'evidence']) assert.equal(graphNodeIsVisible(layer, kind), kind === nodeKindByLayer[layer]);
    assert.equal(graphNodeIsVisible(layer, 'connection'), layer === 'videos');
  }
});

test('nearby graph dots get a small pointer target without selecting empty map space', () => {
  const topic = { kind: 'topic' };
  const closer = { node: topic, x: 12, y: 13 };
  const farther = { node: { kind: 'video' }, x: 17, y: 12 };
  assert.equal(nearestNodeWithinRadius([farther, closer], 10, 10), topic);
  assert.equal(nearestNodeWithinRadius([closer], 21, 10), null);
});

test('only creates YouTube links when a source has a video id', () => {
  assert.equal(watchUrl({ videoId: 'video-123', start: 5.5 }), 'https://www.youtube.com/watch?v=video-123&t=5.5s');
  assert.equal(watchUrl({ start: 5 }), null);
  assert.equal(watchUrl({ videoId: '  ', start: 5 }), null);
});

test('validates editable clip ranges and checks duration only when known', () => {
  assert.equal(isValidClipRange(0, 18), true);
  assert.equal(isValidClipRange(18, 18), false);
  assert.equal(isValidClipRange(-1, 18), false);
  assert.equal(isValidClipRange(0, 20, 18), false);
  assert.equal(isValidClipRange(0, 18, 20), true);
});

test('shared drafts accept the workspace search response and preserve its exact millisecond bounds', () => {
  const citation = { id: '11111111-1111-4111-8111-111111111112', start: 10453.123, end: 10468.987, episode: 'Episode', quote: 'Source moment' };
  assert.deepEqual(citationClipInput(citation), { segmentId: citation.id, startMs: 10453123, endMs: 10468987, title: 'Episode', hook: 'Source moment' });
  assert.deepEqual(citationClipInput({ ...citation, start_ms: 10453123, end_ms: 10468987 }).startMs, 10453123);
  assert.equal(citationClipInput({ ...citation, id: 'demo-citation' }), null);
  assert.equal(citationClipInput({ ...citation, end: citation.start }), null);
  assert.equal(citationClipInput({ ...citation, start: 10453.1231 }), null);
});

test('editing a shared range keeps the clip title and hook in the PATCH payload', () => {
  assert.deepEqual(rangeEditInput('10453.123', '10468.987', { title: 'Keep this title', hook: 'Keep this hook' }), {
    startMs: 10453123, endMs: 10468987, title: 'Keep this title', hook: 'Keep this hook'
  });
  assert.equal(rangeEditInput('5', '4', { title: 'T', hook: 'H' }), null);
});

test('shared source heading changes from its prompt to the selected episode', () => {
  assert.equal(sourceHeading(null), 'Choose a workspace citation');
  assert.equal(sourceHeading({ guest: 'Guest', episode: 'Episode title' }), 'Episode title');
  assert.equal(sourceHeading({ guest: 'Guest' }), 'Guest');
});

test('shared draft saving stays locked across citation changes until the request settles', () => {
  const input = { segmentId: 'segment' };
  assert.equal(canSaveSharedDraft(input, 'board', false), true);
  assert.equal(canSaveSharedDraft(input, 'board', true), false);
  assert.equal(canSaveSharedDraft(null, 'board', false), false);
  assert.equal(canSaveSharedDraft(input, '', false), false);
});

test('shared clip pages validate their cursor and append without losing or duplicating loaded clips', () => {
  const firstPage = { clips: [{ id: 'a' }, { id: 'b' }], hasMore: true, nextOffset: 2 };
  const secondPage = { clips: [{ id: 'b' }, { id: 'c' }], hasMore: false, nextOffset: null };
  assert.equal(isValidClipPage(firstPage, 0), true);
  assert.equal(isValidClipPage(secondPage, 2), true);
  assert.equal(isValidClipPage({ ...firstPage, nextOffset: 50 }, 0), false);
  assert.equal(isValidClipPage({ clips: [], hasMore: true, nextOffset: 0 }, 0), false);
  assert.deepEqual(mergeClipPage(firstPage.clips, secondPage.clips), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.equal(boardClipsPageUrl('board/id', 50), '/api/boards/board%2Fid/clips?offset=50');
});

test('shared queue exposes an accessible Load older clips action and mutation refresh keeps loaded pages', async () => {
  const ui = await readFile(new URL('../public/shared-review.js', import.meta.url), 'utf8');
  assert.match(ui, /data-load-more aria-label="Load older clips"/);
  assert.match(ui, /async function loadOlderClips\(button\)/);
  assert.match(ui, /function appendClipPage\(items\)[\s\S]*?clips\.insertAdjacentHTML\('beforeend', items\.map\(renderClip\)/);
  assert.match(ui, /appendClipPage\(newClips\)/);
  assert.match(ui, /const keepCount = preserveLoaded \? loadedClips\.length : 0/);
  assert.match(ui, /while \(items\.length < keepCount && page\.hasMore\)/);
  assert.match(ui, /async function refreshAfterMutation\(\)\s*\{\s*await loadClips\(\{ preserveLoaded: true \}\)/);
  assert.equal((ui.match(/await refreshAfterMutation\(\)/g) || []).length, 3, 'save, edit, and submit/review refresh the pages already loaded');
  assert.match(ui, /const moreButton = event\.target\.closest\('\[data-load-more\]'\)/);
});

test('review decision buttons disable together and can recover after a failed request', async () => {
  const buttons = [{ disabled: false }, { disabled: false }];
  const card = { querySelectorAll: selector => selector === '[data-review]' ? buttons : [] };
  setReviewButtonsDisabled(card, true);
  assert.deepEqual(buttons.map(button => button.disabled), [true, true]);
  setReviewButtonsDisabled(card, false);
  assert.deepEqual(buttons.map(button => button.disabled), [false, false]);

  const ui = await readFile(new URL('../public/shared-review.js', import.meta.url), 'utf8');
  assert.match(ui, /if \(button\.hasAttribute\('data-review'\)\) setReviewButtonsDisabled\(card, true\);[\s\S]*?await api\([\s\S]*?catch \(error\) \{[\s\S]*?if \(button\.hasAttribute\('data-review'\)\) setReviewButtonsDisabled\(card, false\)/);
});

test('shared review initializes only for a signed-in workspace user', async () => {
  const ui = await readFile(new URL('../public/shared-review.js', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');
  assert.match(ui, /import \{ formatTime, watchUrl \} from '\.\/archive-ui\.js'/);
  assert.match(ui, /auth\?\.searchAccessMode !== 'workspace' \|\| !auth\.user\?\.id/);
  assert.match(auth, /if \(data\?\.user\)[\s\S]*?searchAccessMode: config\.searchAccessMode[\s\S]*?initSharedReview\(window\.flightstoryAuth\)/);
  assert.match(ui, /const startMs = clip\.start_ms;[\s\S]*?const endMs = clip\.end_ms;/);
  assert.match(ui, /const editableStatus = \['suggested', 'rejected'\]\.includes\(clip\.status\);\s*const editable = editableStatus && clip\.canEdit === true/);
  assert.match(ui, /const submit = clip\.status === 'suggested' && clip\.canEdit === true/);
  assert.match(ui, /Only the clip creator can edit or submit this draft\./);
  assert.match(ui, /clip\.status === 'needs_review' && clip\.canReview === true \? '<textarea data-review-note/);
  assert.match(ui, /Waiting for an eligible teammate to review\./);
});

test('removes only the selected saved moment', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(removeSavedItem(items, 'b'), [{ id: 'a' }, { id: 'c' }]);
  assert.deepEqual(removeSavedItem(items, 'missing'), items);
});

test('validates trimmed questions within the supported length', () => {
  assert.equal(isValidQuery(' a '), false);
  assert.equal(isValidQuery('  ok  '), true);
  assert.equal(isValidQuery('x'.repeat(501)), false);
});

test('recovers from malformed or unavailable saved-item storage', () => {
  assert.deepEqual(loadSavedItems(() => ({ getItem: () => '{' })), []);
  assert.deepEqual(loadSavedItems(() => { throw new Error('blocked'); }), []);
  assert.equal(persistSavedItems(() => { throw new Error('blocked'); }, []), false);
});

test('starts with no prefilled or automatic search', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="query"[^>]*value=""[^>]*minlength="2"[^>]*maxlength="500"/);
  assert.match(html, /Choose a topic\.<br><em>Find a clip\.<\/em>/);
  assert.match(html, /Choose a topic…/);
  assert.doesNotMatch(app, /if\s*\(query\.value\)\s*form\.requestSubmit\(\)/);
});

test('citation cards expose keyboard button semantics and the result count stays on one line', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(app, /class="citation"[^>]*role="button" tabindex="0" aria-current="false"/);
  assert.doesNotMatch(app, /class="citation"[^>]*aria-pressed=/);
  assert.match(app, /if \(event\.key === 'Enter' \|\| event\.key === ' '\) \{ event\.preventDefault\(\); selectEvidence\(item\); \}/);
  assert.match(app, /current\.length === 1 \? 'MOMENT' : 'MOMENTS'/);
  assert.match(styles, /\.result-count\{flex:0 0 auto;white-space:nowrap\}/);
  assert.match(styles, /\.results-head\{align-items:flex-start\}/);
});

test('selecting a citation synchronizes the single current source on every card', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /const selectedId = String\(item\.id\);[\s\S]*?document\.querySelectorAll\('\.citation'\)\.forEach\(node => \{\s*const selected = node\.dataset\.id === selectedId;[\s\S]*?node\.setAttribute\('aria-current', String\(selected\)\)/);
});

test('the interactive graph color token resolves from the root theme', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(styles, /:root\{[^}]*--lilac:\s*var\(--violet\)/);
  assert.match(graph, /var\(--lilac\)/);
});

test('workspace toggle sits with the composer and the old draft label is gone', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('workspace-switch') > html.indexOf('class="composer"'));
  assert.doesNotMatch(html.split('</header>')[0], />Drafts\s/);
});

test('describes AI results, local saves, and the distinct archive count scopes honestly', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(app, /result\.mode === 'local-demo' \? 'LOCAL MATCH · DEMO EXCERPTS'/);
  assert.match(app, /const answer = result\.mode === 'local-demo' \? '' : Array\.isArray\(result\.claims\)/);
  assert.match(app, /\['ai_match', 'ai-match'\]\.includes\(result\.mode\) \? 'AI MATCH · EXCERPTS ONLY'/);
  assert.match(app, /result\.mode === 'openai' \? 'GPT SPARK · FAST AI PASS'/);
  assert.match(app, /claim\.citationIds\.map\(id =>/);
  assert.match(app, /data-claim-source=/);
  assert.match(app, /content\.querySelectorAll\('\[data-claim-source\]'\)/);
  assert.doesNotMatch(app, /OPENAI GROUNDED/);
  assert.match(html, /Clip-ready moments saved on this device/);
  assert.match(html, /Graph videos/);
  assert.match(html, /SEARCHABLE DEMO/);
  assert.match(html, /Graph metadata only/);
  assert.match(html, /transcript links/);
  assert.match(html, /eligible for transcription · <span data-archive-count="catalogueRecords">—<\/span> catalogued episodes/);
  assert.match(app, /SAMPLE THREAD/);
  assert.doesNotMatch(app, /LIVE CONNECTION/);
  assert.match(graph, /ARCHIVE MAP/);
  assert.doesNotMatch(graph, /EVIDENCE UNIVERSE/);
  assert.match(html, /GPT Spark finds moments to publish/);
  assert.match(auth, /Search the public archive demo instantly - no sign-in needed\. FlightStory team: sign in for the full corpus/);
  assert.match(auth, /Full-corpus workspace search active\. GPT Spark sends your question and matched excerpts to OpenAI/);
  assert.match(auth, /data-demo-search-count/);
  assert.match(auth, /demoSearchCount\.hidden = true/);
  assert.match(app, /Private source · public video link unavailable/);
  assert.doesNotMatch(app, /watch\?v=\$\{item\.videoId\}/);
});

test('loads trending archive topics and submits their natural questions through discovery chips', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="trending-topics"[^>]*hidden><p[^>]*class="eyebrow">TRENDING IN THE ARCHIVE/);
  assert.match(app, /async function initTrendingTopics\(\)[\s\S]*fetch\('\/topic-graph\.json'\)/);
  assert.match(app, /if \(!response\.ok\) return/);
  assert.match(app, /graph\.nodes\.sort\(\(a, b\) => b\.occurrences - a\.occurrences\)\.slice\(0, 6\)/);
  assert.ok(app.includes('data-discovery-query="${escapeHtml(`What do guests say about ${label}?`)}"'));
  assert.ok(app.includes('${escapeHtml(label)} · <span>${escapeHtml(mentions.format(occurrences).toLowerCase())} mentions</span>'));
  assert.match(app, /notation: 'compact', maximumFractionDigits: 1/);
  assert.match(app, /event\.target\.closest\('\[data-discovery-query\]'\)[\s\S]*query\.value = button\.dataset\.discoveryQuery;\s*form\.requestSubmit\(\)/);
  assert.match(app, /catch \{\s*strip\.hidden = true/);
  assert.match(app, /\ninitTrendingTopics\(\);/);
});

test('separates the source time window from its provisional label', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /class="source-window"[^>]*>\$\{formatTime\(item\.start\)\}–\$\{formatTime\(item\.end\)\}<\/span> · <span class="provenance-tag">\$\{item\.mapMatch \? 'MAP MATCH' : 'PROVISIONAL'\}<\/span> · \$\{escapeHtml\(item\.guest\)\}/);
});

test('mobile map filters stay visible as a compact horizontal strip and quiet copy remains readable', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(styles, /@media\(max-width:650px\)\{\.rail\{display:flex;[^}]*overflow-x:auto/);
  assert.match(styles, /\.rail>\.eyebrow,\.rail-rule,\.index-status\{display:none\}/);
  assert.match(styles, /\.layer\{flex:0 0 auto;width:auto[^}]*white-space:nowrap\}/);
  assert.match(styles, /\.index-status small,\.clip-empty,footer\{color:var\(--muted\)\}/);
});

test('clip drafts expose local edit and review state without implying a shared approval', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(html, /Clips <b id="queue-count">0/);
  assert.match(html, /<h2>Clip drafts<\/h2>/);
  assert.match(html, /Clip-ready moments saved on this device\./);
  assert.match(app, /const saveLabel = saveDisabled \? 'Finish cut edit first' : saved \? '✓ Saved · Remove from drafts' : 'Add to drafts'/);
  assert.match(app, /<button class="save" id="save-moment" type="button"/);
  assert.doesNotMatch(app, /id="save-moment"[^>]*aria-pressed=/);
  assert.match(app, /persistQueue\(isSaved \? 'Draft removed from this device\.' : 'Draft saved on this device · not shared\.'\)/);
  assert.match(app, /document\.querySelector\('#save-moment'\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /\.clip-item a:focus-visible,\.save:focus-visible,\.searchbox button:focus-visible\{outline:2px solid var\(--violet\);outline-offset:3px\}/);
  assert.match(app, /data-edit-cut=/);
  assert.match(app, /REVIEWED LOCALLY/);
  assert.match(app, /Finish the open edit first/);
  assert.match(app, /const saveDisabled = Boolean\(editingClipId\)/);
  assert.match(app, /if \(editingClipId\) return;/);
});

test('390px layout keeps archive navigation and separates map labels, inspector, and controls', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(styles, /\.topbar nav a\{display:inline-flex;align-items:center;font-size:11px;white-space:nowrap\}/);
  assert.match(styles, /\.topbar \.status\{display:none\}/);
  assert.match(styles, /\.universe-heading span\{display:block!important/);
  assert.match(styles, /\.universe-inspector\{left:12px!important;right:12px!important;top:58px!important;bottom:auto!important;width:auto!important;max-width:none!important/);
  assert.match(styles, /\.universe-hint\{left:12px!important;right:12px!important;top:auto!important;bottom:71px!important;height:auto!important[^}]*white-space:normal!important/);
  assert.match(styles, /\.universe-foot\{left:12px!important;right:12px!important;bottom:44px!important/);
  assert.match(styles, /\.universe-foot small\{display:none!important\}/);
  assert.match(styles, /\.universe-controls\{top:auto!important;right:12px!important;bottom:10px!important\}/);
});

test('3D archive inspector and source actions stay hidden until a node is selected', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(graph, /class="universe-inspector" hidden/);
  assert.match(graph, /data-open hidden/);
  assert.doesNotMatch(graph, /Open second source/);
  assert.match(graph, /let selected = null/);
  assert.match(graph, /inspector\.hidden = false/);
  assert.doesNotMatch(graph, /selectNode\(evidenceNodes\[0\]\)/);
});

test('mobile archive map reduces label clutter but keeps controls and accessible node links', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(graph, /@media\(max-width:700px\)\{\.universe-node-label,\.universe-map-key\{display:none\}/);
  assert.match(styles, /@media\(max-width:700px\)\{\.universe-node-label,\.universe-map-key\{display:none!important\}\}/);
  assert.match(graph, /\.universe-controls\{top:auto;right:12px;bottom:12px\}/);
  assert.match(graph, /graphSummary\.textContent = 'Browse featured archive nodes'/);
  assert.doesNotMatch(graph, /\.universe-access(?:\s|,|\{)[^}]*display\s*:\s*none/);
});

test('map layer controls sync button state and visibility while the accessible link list retains citations', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(html, /data-graph-layer="topics" aria-pressed="true" disabled/);
  assert.match(html, /data-graph-layer="videos" aria-pressed="false" disabled/);
  assert.match(html, /data-graph-layer="evidence" aria-pressed="false" disabled/);
  assert.match(styles, /\.layer:disabled\{opacity:\.45;cursor:wait\}/);
  assert.match(graph, /button\.classList\.toggle\('active', active\);\s*button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(graph, /topicLabels\.forEach\(\(\{ label \}\) => \{ label\.hidden = !visible\.topics; \}\)/);
  assert.match(graph, /topicBackgrounds\.forEach\(background => \{ background\.visible = visible\.topics; \}\)/);
  assert.match(graph, /graphLines\.visible = visible\.topics/);
  assert.match(graph, /videoLines\.visible = visible\.videos/);
  assert.match(graph, /evidenceCoreLines\.forEach\(line => \{ line\.visible = visible\.evidence; \}\)/);
  assert.match(graph, /visibleNodes = nodes\.filter\(node => graphNodeIsVisible\(layer, node\.userData\.kind\)\)/);
  assert.match(graph, /raycaster\.intersectObjects\(visibleNodes\)/);
  assert.match(graph, /let requestedGraphLayer = 'topics'/);
  assert.match(graph, /setGraphLayer\(requestedGraphLayer\)/);
  assert.match(graph, /setGraphLayer\('evidence'\); camera\.position\.set/);
  assert.match(graph, /CITATION · \$\{data\.guest\} · \$\{data\.title\}/);
  assert.match(graph, /Browse featured archive nodes/);
});

test('map controls queue the latest layer choice while graph data loads', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  const graphFetch = graph.indexOf("const catalogue = await fetch('/api/catalog')");
  const bind = graph.indexOf('graphLayerButtons.forEach(button => button.addEventListener');
  const syncDefault = graph.indexOf('setGraphLayer(requestedGraphLayer)');
  const enable = graph.indexOf('graphLayerButtons.forEach(button => { button.disabled = false; })');
  assert.ok(bind >= 0 && bind < syncDefault && syncDefault < enable && enable < graphFetch);
  assert.ok(graph.indexOf("stage.querySelector('[data-reset]').addEventListener") < graphFetch);
  assert.ok(graph.indexOf("stage.querySelector('[data-focus]').addEventListener") < graphFetch);
  assert.match(graph, /requestedGraphLayer = layer;[\s\S]*?applyGraphLayer\?\.\(layer\)/);
  assert.ok(graph.indexOf('applyGraphLayer = layer =>') < graph.lastIndexOf('setGraphLayer(requestedGraphLayer)'));
});

test('citation metadata is readable and can wrap at mobile widths', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(styles, /@media\(max-width:650px\)\{\.citation-meta\{font-size:10px;line-height:1\.5;overflow-wrap:anywhere\}\}/);
});

test('archive graph exposes concepts rather than generic transcript fragments', async () => {
  const graph = JSON.parse(await readFile(new URL('../public/topic-graph.json', import.meta.url), 'utf8'));
  const labels = new Set(graph.nodes.map(node => node.label));
  for (const fragment of ['able', 'person', 'keep', 'might', 'again', 'whatever']) assert.equal(labels.has(fragment), false, fragment);
  for (const concept of ['brain', 'love', 'money', 'health', 'conversation', 'meaning', 'truth']) {
    assert.equal(labels.has(concept), true, concept);
  }
  const nodeIds = new Set(graph.nodes.map(node => node.id));
  assert.ok(graph.edges.every(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)));
});

test('transcript result cards expose a direct local draft action', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /data-save-citation=/);
  assert.match(app, /event\.stopPropagation\(\);[\s\S]*?toggleSaved\(item\)/);
});
