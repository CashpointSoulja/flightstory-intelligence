const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const content = document.querySelector('#results-content');
const evidenceContent = document.querySelector('#evidence-content');
const count = document.querySelector('#result-count');
const heading = document.querySelector('#question-heading');
const queueCount = document.querySelector('#queue-count');
const clipList = document.querySelector('#clip-list');
let current = [];
let queue = JSON.parse(localStorage.getItem('flightstory-clips') || '[]');

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const watchUrl = item => `https://www.youtube.com/watch?v=${item.videoId}&t=${item.start}s`;
const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));

function renderQueue() {
  queueCount.textContent = queue.length;
  clipList.innerHTML = queue.length ? queue.map(item => `<div class="clip-item"><div><strong>${escapeHtml(item.episode)}</strong><small>${escapeHtml(item.guest)} · ${formatTime(item.start)}–${formatTime(item.end)}</small></div><a href="${watchUrl(item)}" target="_blank" rel="noreferrer">WATCH ↗</a></div>`).join('') : '<div class="clip-empty">No moments saved yet. Search the archive, then save evidence worth keeping.</div>';
}

function selectEvidence(item) {
  document.querySelectorAll('.citation').forEach(node => node.classList.toggle('selected', node.dataset.id === item.id));
  evidenceContent.className = 'evidence-card';
  evidenceContent.innerHTML = `<span class="guest">${escapeHtml(item.guest).toUpperCase()}</span><h3>${escapeHtml(item.episode)}</h3><div class="transcript">“${escapeHtml(item.quote)}”</div><a class="watch" href="${watchUrl(item)}" target="_blank" rel="noreferrer">▶ Watch from ${formatTime(item.start)}</a><button class="save" id="save-moment">＋ Save to clip queue</button><p class="clip-note">Timestamp verified against the indexed transcript. Speaker attribution is based on episode metadata.</p>`;
  document.querySelector('#save-moment').onclick = () => { if (!queue.some(saved => saved.id === item.id)) { queue.push(item); localStorage.setItem('flightstory-clips', JSON.stringify(queue)); renderQueue(); document.querySelector('#save-moment').textContent = '✓ Saved to clip queue'; } };
}

function renderResults(result) {
  current = result.citations || [];
  count.textContent = current.length ? `${current.length} MOMENTS` : 'NO MATCH';
  const source = result.mode === 'openai' ? 'OPENAI GROUNDED' : 'LOCAL FALLBACK';
  content.innerHTML = `<div class="source-row"><span class="source-dot"></span>${source} · ${current.length ? 'EVIDENCE FOUND' : 'ARCHIVE REFUSAL'}</div><div class="answer">${escapeHtml(result.answer)}</div>${current.map((item, index) => `<article class="citation" data-id="${item.id}"><span class="citation-index">0${index + 1}</span><div><div class="citation-title">${escapeHtml(item.quote)}</div><div class="citation-meta"><time>${formatTime(item.start)}</time>${escapeHtml(item.guest)} · ${escapeHtml(item.episode)}</div></div><span class="citation-arrow">↗</span></article>`).join('')}`;
  current.forEach(item => document.querySelector(`[data-id="${item.id}"]`).onclick = () => selectEvidence(item));
  if (current[0]) selectEvidence(current[0]); else { evidenceContent.className = 'evidence-empty'; evidenceContent.innerHTML = '<div class="evidence-glow">∅</div><p>No supported moment found.<br>Try a different archive question.</p>'; }
}

form.addEventListener('submit', async event => { event.preventDefault(); const value = query.value.trim(); if (!value) return; heading.textContent = value; count.textContent = 'SEARCHING'; content.innerHTML = '<div class="welcome"><div class="welcome-node">◌</div><h3>Following the signal…</h3><p>Searching the indexed conversations and checking the evidence.</p></div>'; try { const response = await fetch('/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: value }) }); renderResults(await response.json()); } catch { renderResults({ answer: 'The archive is temporarily unavailable. Check that the local server is running.', citations: [], mode: 'local-fallback' }); } });
renderQueue();
