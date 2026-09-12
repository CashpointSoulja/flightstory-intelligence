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
    .signal-meta{display:flex;justify-content:space-between;color:var(--lilac);font:10px 'DM Mono';letter-spacing:.1em}.signal-meta span:last-child{color:var(--muted);font-size:9px}
    .signal-card h3{font-size:20px;letter-spacing:-.04em;margin:26px 0 16px}.signal-card p{color:var(--muted);font-size:12px;line-height:1.6;max-width:480px}.signal-people{display:flex;align-items:center;gap:13px;font:10px 'DM Mono';color:var(--paper)}.signal-people b{font-size:17px;color:var(--lilac);font-weight:400}.signal-action{border:0;background:none;color:var(--lilac);font:10px 'DM Mono';padding:0;cursor:pointer;margin-top:14px}.signal-bars{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:0 0 15px}.signal-bars span{font:9px 'DM Mono';color:var(--muted)}.signal-bars i{display:block;height:3px;background:var(--mint);margin-top:7px}
    @media(max-width:700px){.discovery-layer{padding:50px 20px}.discovery-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  clips.insertAdjacentHTML('beforebegin', `<section class="discovery-layer" id="discovery-layer"><div class="discovery-intro"><span class="section-kicker">DISCOVERY LAYER</span><h2>See what the archive is connecting.</h2><p>Similarity earns attention. Evidence earns trust. Connections stay explainable and open back to the source moments.</p></div><div class="discovery-grid"><article class="signal-card"><div class="signal-meta"><span>BRIDGE / 02</span><span>84% RELATED</span></div><h3>Confidence is a behaviour.</h3><div class="signal-people"><span>Mel Robbins</span><b>↔</b><span>Alex Hormozi</span></div><p>Two guests, two worlds, one shared mechanism: action creates the proof confidence needs.</p><button class="signal-action" type="button" data-discovery-query="What have guests said about confidence?">Open connection ↗</button></article><article class="signal-card opportunity"><div class="signal-meta"><span>CLIP OPPORTUNITY</span><span>82 / 100</span></div><h3>Failure is an event, not an identity.</h3><div class="signal-bars"><span><i style="width:92%"></i>HOOK</span><span><i style="width:78%"></i>PAYOFF</span><span><i style="width:66%"></i>CONTEXT</span></div><p>Clear opening · emotional tension · complete thought · context review required.</p><button class="signal-action" type="button" data-discovery-query="Find moments about failure and identity">Review moment ↗</button></article></div></section>`);
  document.querySelectorAll('[data-discovery-query]').forEach(button => button.addEventListener('click', () => { query.value = button.dataset.discoveryQuery; form.requestSubmit(); window.scrollTo({ top: document.querySelector('#archive').offsetTop, behavior: 'smooth' }); }));
}

renderQueue();
initDiscovery();
fetch('/api/backend').then(response => response.json()).then(status => {
  const badge = document.querySelector('.status');
  if (badge && status.configured) badge.innerHTML = '<span></span> InsForge backend linked';
}).catch(() => {});
