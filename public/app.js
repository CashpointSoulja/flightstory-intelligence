import { formatTime, isValidClipRange, isValidQuery, loadSavedItems, persistSavedItems, removeSavedItem, watchUrl } from './archive-ui.js';

const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const content = document.querySelector('#results-content');
const evidenceContent = document.querySelector('#evidence-content');
const evidenceStatus = document.querySelector('.evidence-status');
const count = document.querySelector('#result-count');
const heading = document.querySelector('#question-heading');
const queueCount = document.querySelector('#queue-count');
const clipList = document.querySelector('#clip-list');
let current = [];
let queue = loadSavedItems(() => window.localStorage);
let searchRequest = 0;
let selectedEvidence = null;
let editingClipId = null;
const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const sourceAction = item => {
  const url = watchUrl(item);
  return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">WATCH ↗</a>` : '<span class="source-unavailable">Private source · public video link unavailable</span>';
};

// Clip preview: a YouTube player constrained to the clip window so a draft
// plays only its own section and stops at the out-point.
let clipPreviewApiPromise = null;
let clipPreviewPlayer = null;
let clipPreviewPoll = null;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!clipPreviewApiPromise) {
    clipPreviewApiPromise = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = resolve;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('YouTube player failed to load.'));
      document.head.appendChild(script);
    });
    clipPreviewApiPromise.catch(() => {});
  }
  return clipPreviewApiPromise;
}

function stopClipPreview() {
  if (clipPreviewPoll) { clearInterval(clipPreviewPoll); clipPreviewPoll = null; }
  if (clipPreviewPlayer && typeof clipPreviewPlayer.destroy === 'function') { try { clipPreviewPlayer.destroy(); } catch (error) {} }
  clipPreviewPlayer = null;
  const block = document.querySelector('#clip-preview');
  if (block) {
    block.hidden = true;
    block.querySelectorAll('#clip-preview-player, iframe').forEach(node => node.remove());
  }
}

function guardClipPreviewEnd(player, start, end) {
  if (clipPreviewPoll) clearInterval(clipPreviewPoll);
  clipPreviewPoll = setInterval(() => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    let position = 0;
    try { position = Number(player.getCurrentTime()) || 0; } catch (error) { return; }
    if (position >= end - 0.1) {
      try { player.pauseVideo(); player.seekTo(start, true); } catch (error) {}
      clearInterval(clipPreviewPoll);
      clipPreviewPoll = null;
    }
  }, 200);
}

function mountClipPreview(videoId, start, end, autoplay) {
  const block = document.querySelector('#clip-preview');
  if (!block) return;
  block.hidden = false;
  const note = block.querySelector('[data-preview-window]');
  if (note) note.textContent = `Preview ${formatTime(start)}\u2013${formatTime(end)} \u00b7 plays only this clip, then stops.`;
  const holder = block.querySelector('#clip-preview-player');
  if (clipPreviewPlayer && holder) {
    try {
      clipPreviewPlayer[autoplay ? 'loadVideoById' : 'cueVideoById']({ videoId, startSeconds: start, endSeconds: end });
      return;
    } catch (error) {}
  }
  if (clipPreviewPlayer) { try { clipPreviewPlayer.destroy(); } catch (error) {} clipPreviewPlayer = null; }
  if (!holder) {
    const fresh = document.createElement('div');
    fresh.id = 'clip-preview-player';
    block.insertBefore(fresh, note);
  }
  loadYouTubeApi().then(() => {
    if (!document.querySelector('#clip-preview-player')) return;
    clipPreviewPlayer = new YT.Player('clip-preview-player', {
      videoId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
      events: {
        onReady: event => {
          event.target[autoplay ? 'loadVideoById' : 'cueVideoById']({ videoId, startSeconds: start, endSeconds: end });
        },
        onStateChange: event => { if (window.YT && event.data === YT.PlayerState.PLAYING) guardClipPreviewEnd(event.target, start, end); },
        onError: () => {
          stopClipPreview();
          const block = document.querySelector('#clip-preview');
          const note = block && block.querySelector('[data-preview-window]');
          if (block && note) { block.hidden = false; note.textContent = 'Inline preview unavailable here - use the watch link to verify the cut.'; }
        }
      }
    });
  }).catch(() => stopClipPreview());
}

function renderQueue() {
  queueCount.textContent = queue.length;
  clipList.innerHTML = queue.length ? queue.map(item => {
    const id = String(item.id);
    const start = Number.isFinite(Number(item.start)) ? Number(item.start) : 0;
    const end = Number.isFinite(Number(item.end)) ? Number(item.end) : 0;
    const editing = editingClipId === id;
    const reviewed = item.reviewStatus === 'reviewed';
    const actions = editingClipId
      ? editing ? sourceAction({ ...item, start }) : '<span class="editing-lock">Finish the open edit first.</span>'
      : `${sourceAction({ ...item, start })}<button class="edit-cut" type="button" data-edit-saved="${escapeHtml(id)}" aria-expanded="false">EDIT CUT</button><button class="mark-reviewed" type="button" data-review-saved="${escapeHtml(id)}" aria-pressed="${reviewed}">${reviewed ? 'REOPEN' : 'MARK REVIEWED'}</button><button class="remove-saved" type="button" data-remove-saved="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(item.episode)} from clip drafts">REMOVE</button>`;
    return `<article class="clip-item"><div class="clip-summary"><strong>${escapeHtml(item.episode)}</strong><small>${escapeHtml(item.guest)} · ${formatTime(start)}–${formatTime(end)} · ${reviewed ? 'REVIEWED LOCALLY' : 'LOCAL DRAFT'}</small></div><div class="clip-actions">${actions}</div><form class="cut-editor" data-edit-cut="${escapeHtml(id)}"${editing ? '' : ' hidden'}><label>IN <small>seconds</small><input type="number" name="start" min="0" step="0.1" value="${start}" required></label><label>OUT <small>seconds</small><input type="number" name="end" min="0" step="0.1" value="${end}" required></label><p class="cut-note">Source duration unavailable · verify the out-point in the video.</p><div class="cut-actions"><button type="submit">Save range</button><button type="button" data-cancel-edit="${escapeHtml(id)}">Cancel</button></div><p class="cut-error" data-range-error role="status" aria-live="polite"></p></form></article>`;
  }).join('') : '<div class="clip-empty">No clip drafts yet. Search, then create a local draft.</div>';
}

function persistQueue(message = 'Saved on this device · not shared.') {
  const queueStatus = document.querySelector('#queue-status');
  const saved = persistSavedItems(() => window.localStorage, queue);
  if (queueStatus) queueStatus.textContent = saved ? message : 'Browser storage unavailable · changes will not survive reload.';
}

function selectEvidence(item, options = {}) {
  selectedEvidence = item;
  window.selectedArchiveCitation = item;
  window.dispatchEvent(new CustomEvent('archive:citation-selected', { detail: item }));
  if (evidenceStatus) evidenceStatus.textContent = 'INDEXED';
  const selectedId = String(item.id);
  document.querySelectorAll('.citation').forEach(node => {
    const selected = node.dataset.id === selectedId;
    node.classList.toggle('selected', selected);
    node.setAttribute('aria-current', String(selected));
  });
  evidenceContent.className = 'evidence-card';
  const savedClip = queue.find(savedItem => String(savedItem.id) === String(item.id));
  const saved = Boolean(savedClip);
  const saveDisabled = Boolean(editingClipId);
  const url = watchUrl(item);
  const sourceLink = url ? `<a class="watch" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">▶ Watch from ${formatTime(Math.round(item.start))}</a>` : '<p class="source-unavailable">Private source · public video link unavailable</p>';
  evidenceContent.innerHTML = `<span class="guest">${escapeHtml(item.guest).toUpperCase()}</span>${item.virality && item.virality.score >= 7 ? `<span class="virality-badge virality-${item.virality.tier === 'TOP CLIP' ? 'top' : 'strong'}">${escapeHtml(item.virality.tier)} · ${escapeHtml(String(item.virality.score))}</span>` : ''}<h3>${escapeHtml(item.episode)}</h3><div class="transcript">“${escapeHtml(item.quote)}”</div>${sourceLink}<div class="clip-presets" role="group" aria-label="Create clip length"><span>${saved ? 'SAVED' : 'CREATE CLIP'}</span>${[15,30,60,90].map(seconds => `<button type="button" data-clip-seconds="${seconds}" aria-pressed="${Boolean(savedClip && Number(savedClip.requestedDuration) === seconds)}"${saveDisabled ? ' disabled title="Finish or cancel the open cut edit first."' : ''}>${seconds}s</button>`).join('')}</div><p class="clip-note">${saved ? 'Clip saved on this device. Pick another length to replace it.' : 'Pick a length to create the clip.'} Source window ${formatTime(item.start)}–${formatTime(item.end)} · ${item.mapMatch ? 'archive map topic match; open the source to find the exact moment.' : 'provisional transcript excerpt; verify in the source before review.'}</p>`;
  evidenceContent.querySelectorAll('[data-clip-seconds]').forEach(button => button.onclick = () => {
    const duration = Number(button.dataset.clipSeconds); const center = (Number(item.start) + Number(item.end)) / 2;
    const clip = { ...item, start: Math.max(0, center - duration / 2), end: center + duration / 2, requestedDuration: duration, reviewStatus: 'draft' };
    queue = [...queue.filter(savedItem => String(savedItem.id) !== String(item.id)), clip]; persistQueue(`${duration}s clip draft created.`); renderQueue(); selectEvidence(item, { autoplayPreview: true });
  });
  if (item.videoId) {
    const previewStart = savedClip ? Number(savedClip.start) : Number(item.start);
    const previewEnd = savedClip ? Number(savedClip.end) : Number(item.end);
    mountClipPreview(String(item.videoId), previewStart, previewEnd, Boolean(options.autoplayPreview));
  } else {
    stopClipPreview();
  }
}

function renderResults(result) {
  current = result.citations || [];
  const isError = result.mode === 'error';
  content.setAttribute('aria-busy', 'false');
  count.textContent = isError ? 'TRY AGAIN' : current.length ? `${current.length} ${current.length === 1 ? 'MOMENT' : 'MOMENTS'}` : 'NO MATCH';
  const source = isError ? 'ARCHIVE ERROR' : result.mode === 'ai-topic-map' ? 'GPT SPARK · TOPIC MATCH' : result.mode === 'topic-map' ? 'ARCHIVE MAP · TOPIC MATCH' : result.mode === 'local-demo' ? 'LOCAL MATCH · DEMO EXCERPTS' : ['ai_match', 'ai-match'].includes(result.mode) ? 'AI MATCH · EXCERPTS ONLY' : result.mode === 'openai' ? 'GPT SPARK · FAST AI PASS' : 'LOCAL FALLBACK';
  const citationNumbers = new Map(current.map((item, index) => [String(item.id), index + 1]));
  const answer = result.mode === 'local-demo' ? '' : Array.isArray(result.claims)
    ? result.claims.length
      ? `<div class="claim-list">${result.claims.map(claim => `<p class="answer-claim">${escapeHtml(claim.text)} <span class="claim-sources">${claim.citationIds.map(id => { const number = citationNumbers.get(String(id)); return number ? `<button class="claim-source" type="button" data-claim-source="${escapeHtml(id)}" aria-label="Open source ${number}">[${number}]</button>` : ''; }).join(' ')}</span></p>`).join('')}</div>`
      : `<div class="answer">${escapeHtml(result.refusal || result.answer || 'I could not verify that in the indexed archive.')}</div>`
    : `<div class="answer">${escapeHtml(result.answer || '')}</div>`;
  content.innerHTML = `<div class="source-row"><span class="source-dot"></span>${source} · ${isError ? 'SEARCH UNAVAILABLE' : current.length ? 'EVIDENCE FOUND' : 'ARCHIVE REFUSAL'}</div>${answer}${current.map((item, index) => { const saved = queue.some(savedItem => String(savedItem.id) === String(item.id)); return `<article class="citation" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-current="false"><span class="citation-index">0${index + 1}</span><div><div class="citation-title">${escapeHtml(item.quote)}</div><div class="citation-meta"><span class="source-window">${formatTime(item.start)}–${formatTime(item.end)}</span> · <span class="provenance-tag">${item.mapMatch ? 'MAP MATCH' : 'PROVISIONAL'}</span>${item.virality && item.virality.score >= 7 ? ` · <span class="virality-badge virality-${item.virality.tier === 'TOP CLIP' ? 'top' : 'strong'}">${escapeHtml(item.virality.tier)} · ${escapeHtml(String(item.virality.score))}</span>` : ''} · ${escapeHtml(item.guest)} · ${escapeHtml(item.episode)}</div></div><button class="citation-save" type="button" data-save-citation="${escapeHtml(item.id)}">${saved ? 'SAVED' : 'CREATE CLIP'}</button><span class="citation-arrow">↗</span></article>`; }).join('')}`;
  current.forEach(item => {
    const card = document.querySelector(`[data-id="${item.id}"]`);
    card.addEventListener('click', () => selectEvidence(item));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEvidence(item); }
    });
  });
  content.querySelectorAll('[data-save-citation]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const item = current.find(candidate => String(candidate.id) === button.dataset.saveCitation);
    if (!item) return;
    selectEvidence(item);
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.querySelector('#evidence-panel').scrollIntoView({ behavior, block: 'nearest' });
  }));
  content.querySelectorAll('[data-claim-source]').forEach(button => button.addEventListener('click', () => {
    const item = current.find(candidate => String(candidate.id) === button.dataset.claimSource);
    if (!item) return;
    selectEvidence(item);
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.querySelector('#evidence-panel').scrollIntoView({ behavior, block: 'nearest' });
  }));
  if (current[0]) selectEvidence(current[0]); else { selectedEvidence = null; window.selectedArchiveCitation = null; window.dispatchEvent(new CustomEvent('archive:citation-selected', { detail: null })); if (evidenceStatus) evidenceStatus.textContent = isError ? 'UNAVAILABLE' : 'NOT FOUND'; stopClipPreview(); evidenceContent.className = 'evidence-empty'; evidenceContent.innerHTML = `<div class="evidence-glow">∅</div><p>${isError ? 'Search could not complete.' : 'No supported moment found.'}<br>${isError ? 'Try again shortly.' : 'Try a different archive question.'}</p>`; }
  document.querySelector('#search-status').textContent = isError ? 'The archive could not complete the search. Try again shortly.' : current.length ? `${current.length} source moment${current.length === 1 ? '' : 's'} found. Evidence is shown below.` : 'No supported source moment found.';
}

function focusResults() {
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  document.querySelector('#archive').scrollIntoView({ behavior, block: 'start' });
  heading.focus({ preventScroll: true });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const value = query.value.trim();
  if (!isValidQuery(value)) {
    query.setCustomValidity('Enter a question between 2 and 500 characters.');
    query.reportValidity();
    document.querySelector('#search-status').textContent = 'Enter a question between 2 and 500 characters.';
    return;
  }
  query.setCustomValidity('');
  const request = ++searchRequest;
  heading.textContent = value;
  count.textContent = 'SEARCHING';
  content.setAttribute('aria-busy', 'true');
  document.querySelector('#search-status').textContent = 'Searching public-source archive. Results will appear here.';
  if (evidenceStatus) evidenceStatus.textContent = 'WAITING';
  evidenceContent.className = 'evidence-empty';
  evidenceContent.innerHTML = '<span>○</span><p>Checking the new question…</p>';
  content.innerHTML = '<div class="welcome"><div class="welcome-node">◌</div><h3>Following the signal…</h3><p>Searching the indexed conversations and checking the evidence.</p></div>';
  focusResults();
  try {
    const headers = { 'content-type': 'application/json' };
    const token = await window.flightstoryAuth?.getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch('/api/search', { method: 'POST', headers, body: JSON.stringify({ query: value }) });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const error = new Error(failure.error || 'Search could not complete.');
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    if (request === searchRequest) renderResults(result);
  } catch (error) {
    const message = error.status === 401 ? 'Sign in with GitHub to search this workspace.' : error.status === 403 ? 'Your account does not have access to this workspace.' : error.status === 503 ? error.message : 'The archive could not complete this search. Try again shortly.';
    if (request === searchRequest) renderResults({ answer: message, citations: [], mode: 'error' });
  }
});

clipList.addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-saved]');
  if (editButton) {
    const id = editButton.dataset.editSaved;
    editingClipId = editingClipId === id ? null : id;
    renderQueue();
    if (selectedEvidence) selectEvidence(selectedEvidence);
    clipList.querySelector(`[data-edit-cut="${CSS.escape(id)}"] input[name="start"]`)?.focus();
    return;
  }
  const cancelButton = event.target.closest('[data-cancel-edit]');
  if (cancelButton) { editingClipId = null; renderQueue(); if (selectedEvidence) selectEvidence(selectedEvidence); return; }
  const reviewButton = event.target.closest('[data-review-saved]');
  if (reviewButton) {
    if (editingClipId) return;
    const id = reviewButton.dataset.reviewSaved;
    queue = queue.map(item => String(item.id) === id ? { ...item, reviewStatus: item.reviewStatus === 'reviewed' ? 'draft' : 'reviewed' } : item);
    persistQueue(); renderQueue();
    if (selectedEvidence) selectEvidence(selectedEvidence);
    const queueStatus = document.querySelector('#queue-status');
    if (queueStatus) queueStatus.textContent = 'Review state is local · not shared.';
    return;
  }
  const button = event.target.closest('[data-remove-saved]');
  if (!button) return;
  if (editingClipId) return;
  queue = removeSavedItem(queue, button.dataset.removeSaved);
  persistQueue('Draft removed from this device.');
  renderQueue();
  if (selectedEvidence) selectEvidence(selectedEvidence);
});

clipList.addEventListener('submit', event => {
  const editor = event.target.closest('[data-edit-cut]');
  if (!editor) return;
  event.preventDefault();
  const id = editor.dataset.editCut;
  const item = queue.find(candidate => String(candidate.id) === id);
  if (!item) return;
  const start = Number(editor.elements.namedItem('start').value);
  const end = Number(editor.elements.namedItem('end').value);
  const error = editor.querySelector('[data-range-error]');
  if (!isValidClipRange(start, end, item.durationSeconds)) {
    error.textContent = 'Out must be after in; both times must be zero or later.';
    return;
  }
  queue = queue.map(candidate => String(candidate.id) === id ? { ...candidate, start, end, reviewStatus: 'draft' } : candidate);
  editingClipId = null;
  persistQueue(); renderQueue();
  if (selectedEvidence) selectEvidence(String(selectedEvidence.id) === id ? queue.find(candidate => String(candidate.id) === id) : selectedEvidence);
  const queueStatus = document.querySelector('#queue-status');
  if (queueStatus) queueStatus.textContent = 'Cut range updated locally. Verify the source before review.';
});

const sampleQuestion = 'What did Vanessa Van Edwards say about talking too much?';
query.addEventListener('input', () => query.setCustomValidity(''));
document.querySelector('#sample-question').addEventListener('click', () => {
  query.value = sampleQuestion;
  query.focus();
  document.querySelector('#search-status').textContent = 'Example question filled. Review it and press Search.';
});

function setArchiveCount(name, value) {
  if (!Number.isFinite(Number(value))) return;
  document.querySelectorAll(`[data-archive-count="${name}"]`).forEach(node => { node.textContent = Number(value).toLocaleString(); });
}

window.addEventListener('archive:counts', ({ detail }) => { for (const [name, value] of Object.entries(detail)) setArchiveCount(name, value); });
async function fetchIndexStatus() {
  const response = await fetch('/api/index-status');
  if (response.ok) return response.json();
  const [catalog, graph, links] = await Promise.all(['/catalog.json', '/topic-graph.json', '/video-links.json'].map(path => fetch(path).then(result => result.json())));
  return { catalogueRecords: catalog.episodes.length, eligibleEpisodes: catalog.episodes.filter(item => item.eligibleForTranscription).length, graphTranscripts: graph.transcriptCount, topics: graph.nodes.length, graphEpisodes: links.nodes.filter(item => item.kind === 'video').length, semanticLinks: links.edges.length };
}
fetchIndexStatus().then(status => {
  if (!status) return;
  setArchiveCount('topics', status.topics);
  setArchiveCount('episodes', status.graphEpisodes);
  setArchiveCount('graphTranscripts', status.graphTranscripts);
  setArchiveCount('transcriptSources', status.transcriptSources);
  setArchiveCount('transcriptSegments', status.transcriptSegments);
  setArchiveCount('eligibleEpisodes', status.eligibleEpisodes);
  setArchiveCount('catalogueRecords', status.catalogueRecords);
}).catch(() => {});

function initDiscovery() {
  const clips = document.querySelector('#clips');
  if (!clips || document.querySelector('#discovery-layer')) return;
  const style = document.createElement('style');
  style.textContent = `
    .discovery-layer{padding:70px 42px;border-bottom:1px solid var(--line)}
    .discovery-layer h2{font-size:30px;letter-spacing:-.06em;margin:12px 0 8px;max-width:560px}
    .discovery-intro{max-width:560px}.discovery-intro p{color:var(--muted);font-size:12px;line-height:1.7;margin:0}
    .discovery-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}
    .signal-card{min-height:225px;padding:22px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}
    .signal-card.opportunity{background:radial-gradient(circle at 100% 0,rgba(182,243,212,.12),transparent 38%),rgba(255,255,255,.025)}
    .signal-meta{display:flex;justify-content:space-between;color:var(--violet);font:10px 'DM Mono';letter-spacing:.1em}.signal-meta span:last-child{color:var(--muted);font-size:9px}
    .signal-card h3{font-size:20px;letter-spacing:-.04em;margin:26px 0 16px}.signal-card p{color:var(--muted);font-size:12px;line-height:1.6;max-width:480px}.signal-people{display:flex;align-items:center;gap:13px;font:10px 'DM Mono';color:var(--paper)}.signal-people b{font-size:17px;color:var(--violet);font-weight:400}.signal-action{border:0;background:none;color:var(--violet);font:10px 'DM Mono';padding:0;cursor:pointer;margin-top:14px}.signal-reasons{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 15px}.signal-reasons span{color:var(--muted);font:9px 'DM Mono';border-bottom:1px solid rgba(199,167,255,.35);padding-bottom:4px}
    @media(max-width:700px){.discovery-layer{padding:50px 20px}.discovery-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  clips.insertAdjacentHTML('beforebegin', `<section class="discovery-layer" id="discovery-layer"><div class="discovery-intro"><span class="section-kicker">DISCOVERY LAYER</span><h2>See what the archive is connecting.</h2><p>Similarity earns attention. Evidence earns trust. Connections stay explainable and open back to source moments.</p></div><div class="discovery-grid"><article class="signal-card"><div class="signal-meta"><span>SAMPLE THREAD</span><span><b data-archive-count="evidence">—</b> CITATIONS</span></div><h3>Conversation has observable signals.</h3><div class="signal-people"><span>One indexed guest</span><b>↔</b><span><b data-archive-count="evidence">—</b> source moments</span></div><p>Vanessa Van Edwards links talking too much, loneliness and better conversation starters. Transcript wording is provisional; open the source to verify.</p><button class="signal-action" type="button" data-discovery-query="What did Vanessa Van Edwards say about talking too much?">Open evidence ↗</button></article><article class="signal-card opportunity"><div class="signal-meta"><span>GRAPH METADATA</span><span><b data-archive-count="topics">—</b> TOPICS</span></div><h3>The next connection is waiting in the archive.</h3><div class="signal-reasons"><span><b data-archive-count="eligibleEpisodes">—</b> eligible for transcription · <b data-archive-count="catalogueRecords">—</b> catalogued episodes</span><span><b data-archive-count="graphTranscripts">—</b> transcript links mapped</span></div><p>Search coverage appears with each result. Every supported moment links back to its source.</p><button class="signal-action" type="button" data-discovery-query="What did Vanessa Van Edwards say about conversation?">Review indexed evidence ↗</button></article></div></section>`);

}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-discovery-query]');
  if (!button) return;
  query.value = button.dataset.discoveryQuery;
  form.requestSubmit();
});

renderQueue();
initDiscovery();
const authScript = document.createElement('script');
authScript.type = 'module';
authScript.src = '/auth.js';
document.body.appendChild(authScript);
const universeScript = document.createElement('script');
universeScript.type = 'module';
universeScript.src = '/universe.js';
document.body.appendChild(universeScript);
