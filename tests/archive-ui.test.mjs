import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatTime, isValidClipRange, isValidQuery, loadSavedItems, persistSavedItems, removeSavedItem, watchUrl } from '../public/archive-ui.js';
import { canSaveSharedDraft, citationClipInput, rangeEditInput, setReviewButtonsDisabled, sourceHeading } from '../public/shared-review.js';

test('formats whole and fractional seconds as readable timestamps', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(66), '01:06');
  assert.equal(formatTime(5.12), '00:05.12');
  assert.equal(formatTime(61.5), '01:01.50');
  assert.equal(formatTime(59.999), '01:00');
  assert.equal(formatTime(3661.5), '01:01:01.50');
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
  assert.match(html, /Public demo · 3 searchable excerpts\. Matches are local; no AI call\./);
  assert.doesNotMatch(app, /if\s*\(query\.value\)\s*form\.requestSubmit\(\)/);
});

test('citation cards expose keyboard button semantics and the result count stays on one line', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(app, /class="citation"[^>]*role="button" tabindex="0" aria-pressed="false"/);
  assert.match(app, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(app, /current\.length === 1 \? 'MOMENT' : 'MOMENTS'/);
  assert.match(styles, /\.result-count\{flex:0 0 auto;white-space:nowrap\}/);
  assert.match(styles, /\.results-head\{align-items:flex-start\}/);
});

test('selecting a citation synchronizes pressed state on every card', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /const selectedId = String\(item\.id\);[\s\S]*?document\.querySelectorAll\('\.citation'\)\.forEach\(node => \{\s*const selected = node\.dataset\.id === selectedId;[\s\S]*?node\.setAttribute\('aria-pressed', String\(selected\)\)/);
});

test('the interactive graph color token resolves from the root theme', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(styles, /:root\{[^}]*--lilac:\s*var\(--violet\)/);
  assert.match(graph, /var\(--lilac\)/);
});

test('describes AI results, local saves, and the distinct archive count scopes honestly', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(app, /result\.mode === 'local-demo' \? 'LOCAL MATCH · DEMO EXCERPTS'/);
  assert.match(app, /const answer = result\.mode === 'local-demo' \? '' : Array\.isArray\(result\.claims\)/);
  assert.match(app, /\['ai_match', 'ai-match'\]\.includes\(result\.mode\) \? 'AI MATCH · EXCERPTS ONLY'/);
  assert.match(app, /result\.mode === 'openai' \? 'AI SYNTHESIS'/);
  assert.match(app, /claim\.citationIds\.map\(id =>/);
  assert.match(app, /data-claim-source=/);
  assert.match(app, /content\.querySelectorAll\('\[data-claim-source\]'\)/);
  assert.doesNotMatch(app, /OPENAI GROUNDED/);
  assert.match(html, /Drafts are saved on this device only/);
  assert.match(html, /Graph videos/);
  assert.match(html, /SEARCHABLE DEMO/);
  assert.match(html, /Graph metadata/);
  assert.match(html, /transcript links/);
  assert.match(html, /eligible for transcription · <span data-archive-count="catalogueRecords">—<\/span> catalogued episodes/);
  assert.match(app, /SAMPLE THREAD/);
  assert.doesNotMatch(app, /LIVE CONNECTION/);
  assert.match(graph, /ARCHIVE MAP/);
  assert.doesNotMatch(graph, /EVIDENCE UNIVERSE/);
  assert.doesNotMatch(html, /matched excerpts are sent to OpenAI/);
  assert.match(auth, /Workspace search requires sign-in and FlightStory membership\. AI synthesis sends your question and matched excerpts to OpenAI/);
  assert.match(auth, /data-demo-search-count/);
  assert.match(auth, /demoSearchCount\.hidden = true/);
  assert.match(app, /Private source · public video link unavailable/);
  assert.doesNotMatch(app, /watch\?v=\$\{item\.videoId\}/);
});

test('separates the source time window from its provisional label', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /class="source-window"[^>]*>\$\{formatTime\(item\.start\)\}–\$\{formatTime\(item\.end\)\}<\/span> · <span class="provenance-tag">PROVISIONAL/);
});

test('clip drafts expose local edit and review state without implying a shared approval', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /Drafts <b id="queue-count">0/);
  assert.match(html, /<h2>Clip drafts<\/h2>/);
  assert.match(html, /Drafts are saved on this device only\./);
  assert.match(app, /Create local clip draft/);
  assert.match(app, /data-edit-cut=/);
  assert.match(app, /REVIEWED LOCALLY/);
  assert.match(app, /Finish the open edit first/);
  assert.match(app, /const saveDisabled = Boolean\(editingClipId\)/);
  assert.match(app, /if \(editingClipId\) return;/);
});

test('3D archive inspector and source actions stay hidden until a node is selected', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');
  assert.match(graph, /class="universe-inspector" hidden/);
  assert.match(graph, /data-open hidden/);
  assert.match(graph, /secondSource\.hidden = true/);
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
  assert.match(graph, /graphSummary\.textContent = 'Browse nodes as links'/);
  assert.doesNotMatch(graph, /\.universe-access(?:\s|,|\{)[^}]*display\s*:\s*none/);
});

test('citation metadata is readable and can wrap at mobile widths', async () => {
  const styles = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(styles, /@media\(max-width:650px\)\{\.citation-meta\{font-size:10px;line-height:1\.5;overflow-wrap:anywhere\}\}/);
});
