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
let queue = JSON.parse(localStorage.getItem('flightstory-clips') || '[]');

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const watchUrl = item => `https://www.youtube.com/watch?v=${item.videoId}&t=${item.start}s`;
const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));

function renderQueue() {
  queueCount.textContent = queue.length;
  clipList.innerHTML = queue.length ? queue.map(item => `<div class="clip-item"><div><strong>${escapeHtml(item.episode)}</strong><small>${escapeHtml(item.guest)} · ${formatTime(item.start)}–${formatTime(item.end)}</small></div><a href="${watchUrl(item)}" target="_blank" rel="noreferrer">WATCH ↗</a></div>`).join('') : '<div class="clip-empty">No moments saved yet. Search the archive, then save evidence worth keeping.</div>';
}

function selectEvidence(item) {
  if (evidenceStatus) evidenceStatus.textContent = 'VERIFIED';
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
  if (current[0]) selectEvidence(current[0]); else { if (evidenceStatus) evidenceStatus.textContent = 'NOT FOUND'; evidenceContent.className = 'evidence-empty'; evidenceContent.innerHTML = '<div class="evidence-glow">∅</div><p>No supported moment found.<br>Try a different archive question.</p>'; }
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
  clips.insertAdjacentHTML('beforebegin', `<section class="discovery-layer" id="discovery-layer"><div class="discovery-intro"><span class="section-kicker">DISCOVERY LAYER</span><h2>See what the archive is connecting.</h2><p>Similarity earns attention. Evidence earns trust. Connections stay explainable and open back to the source moments.</p></div><div class="discovery-grid"><article class="signal-card"><div class="signal-meta"><span>LIVE CONNECTION</span><span>3 CITATIONS</span></div><h3>Conversation has observable signals.</h3><div class="signal-people"><span>One indexed guest</span><b>↔</b><span>Three source moments</span></div><p>Vanessa Van Edwards links talking too much, loneliness and better conversation starters. The transcript is the source of truth.</p><button class="signal-action" type="button" data-discovery-query="What did Vanessa Van Edwards say about talking too much?">Open evidence ↗</button></article><article class="signal-card opportunity"><div class="signal-meta"><span>INDEX STATUS</span><span>NEEDS TRANSCRIPTS</span></div><h3>The next connection is waiting in the archive.</h3><div class="signal-reasons"><span>367 catalogue records</span><span>1 transcript indexed</span><span>speaker labels next</span></div><p>New cross-guest connections become trustworthy as more episodes are transcribed and cited.</p><button class="signal-action" type="button" data-discovery-query="What did Vanessa Van Edwards say about conversation?">Review indexed evidence ↗</button></article></div></section>`);
  document.querySelectorAll('[data-discovery-query]').forEach(button => button.addEventListener('click', () => { query.value = button.dataset.discoveryQuery; form.requestSubmit(); window.scrollTo({ top: document.querySelector('#archive').offsetTop, behavior: 'smooth' }); }));
}

async function initEvidenceUniverse() {
  const art = document.querySelector('.hero-art');
  if (!art) return;
  const moments = [
    { query: 'How do you know you talk too much?', label: 'TALK TOO MUCH', guest: 'VANESSA VAN EDWARDS', time: '00:00', x: 22, y: 62, tone: 'lilac' },
    { query: 'What is the best conversation starter?', label: 'HIGHLIGHT OF YOUR DAY', guest: 'VANESSA VAN EDWARDS', time: '01:06', x: 72, y: 31, tone: 'mint' },
    { query: 'How does technology affect loneliness?', label: 'LESS CONVERSATION', guest: 'VANESSA VAN EDWARDS', time: '00:33', x: 77, y: 73, tone: 'copper' }
  ];
  const style = document.createElement('style');
  style.textContent = `
    .hero-art{background:radial-gradient(circle at 50% 48%,rgba(199,167,255,.13),transparent 20%),#08080d}
    .hero-art img{display:none}.universe-grid{position:absolute;inset:0;opacity:.18;background:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:72px 72px}.universe-svg{position:absolute;inset:7% 7% 8%;width:86%;height:84%;overflow:visible}.universe-svg path,.universe-svg line{fill:none;stroke:rgba(199,167,255,.45);stroke-width:.7}.universe-core{position:absolute;left:50%;top:49%;transform:translate(-50%,-50%);width:76px;height:76px;border:1px solid rgba(199,167,255,.7);border-radius:50%;display:grid;place-items:center;color:#f3f0ed;background:radial-gradient(circle,rgba(199,167,255,.48),rgba(199,167,255,.06) 58%,transparent 70%);box-shadow:0 0 42px rgba(199,167,255,.28);font:18px Georgia,serif;z-index:2}.universe-core small{position:absolute;top:calc(100% + 9px);white-space:nowrap;color:#aaa2b4;font:9px 'DM Mono';letter-spacing:.13em}.universe-node{position:absolute;z-index:3;transform:translate(-50%,-50%);border:0;background:none;color:var(--paper);text-align:left;cursor:pointer;padding:7px}.universe-node .node-dot{display:block;width:12px;height:12px;border-radius:50%;background:var(--lilac);box-shadow:0 0 0 5px rgba(199,167,255,.12),0 0 23px 7px rgba(199,167,255,.6);margin:auto}.universe-node.mint .node-dot{background:var(--mint);box-shadow:0 0 0 5px rgba(182,243,212,.11),0 0 23px 7px rgba(182,243,212,.5)}.universe-node.copper .node-dot{background:var(--copper);box-shadow:0 0 0 5px rgba(220,152,105,.12),0 0 23px 7px rgba(220,152,105,.5)}.universe-node:hover .node-dot,.universe-node:focus-visible .node-dot{transform:scale(1.22)}.node-label{display:block;margin-top:11px;white-space:nowrap;font:10px 'DM Mono';letter-spacing:.09em;color:#eeeaf0}.node-meta{display:block;margin-top:5px;white-space:nowrap;font:9px 'DM Mono';color:#938a9e}.universe-header,.universe-footer{position:absolute;z-index:4;font:10px 'DM Mono';letter-spacing:.14em;color:var(--paper)}.universe-header{left:18px;top:18px}.universe-header span{color:var(--muted);margin-left:11px}.universe-footer{right:18px;bottom:18px;text-align:right;color:var(--lilac);line-height:1.5}.universe-footer small{display:block;color:#8b8393;font-size:9px}.universe-caption{position:absolute;z-index:4;left:50%;top:calc(49% + 55px);transform:translateX(-50%);font:9px 'DM Mono';letter-spacing:.1em;color:#857c8e;white-space:nowrap}@media(max-width:700px){.node-label{font-size:8px}.node-meta{font-size:8px}.universe-node{padding:4px}.universe-core{width:62px;height:62px}.universe-caption{font-size:8px}}
  `;
  document.head.appendChild(style);
  art.innerHTML = `<div class="universe-grid" aria-hidden="true"></div><div class="universe-header">EVIDENCE UNIVERSE <span>3 LIVE MOMENTS</span></div><svg class="universe-svg" viewBox="0 0 100 100" aria-hidden="true"><path d="M4 63 C24 10,74 7,96 31 C72 59,38 77,4 63Z"/><path d="M14 91 C25 34,67 19,88 75 C60 92,35 95,14 91Z"/><path d="M7 31 C37 17,72 29,94 88"/><line x1="50" y1="49" x2="22" y2="62"/><line x1="50" y1="49" x2="72" y2="31"/><line x1="50" y1="49" x2="77" y2="73"/></svg><div class="universe-core">✦<small>CONVERSATION</small></div><div class="universe-caption">SELECT A MOMENT TO INSPECT THE SOURCE</div>${moments.map(moment => `<button class="universe-node ${moment.tone}" type="button" style="left:${moment.x}%;top:${moment.y}%" data-universe-query="${moment.query}"><span class="node-dot"></span><span class="node-label">${moment.label}</span><span class="node-meta">${moment.guest} · ${moment.time}</span></button>`).join('')}<div class="universe-footer">THE KNOWLEDGE<br>IS IN THERE<small>EVERY POINT IS A CITATION</small></div>`;
  art.querySelectorAll('[data-universe-query]').forEach(node => node.addEventListener('click', () => { query.value = node.dataset.universeQuery; form.requestSubmit(); window.scrollTo({ top: document.querySelector('#archive').offsetTop, behavior: 'smooth' }); }));
  const catalogue = await fetch('/api/catalog').then(response => response.ok ? response.json() : []).catch(() => []);
  const nodes = catalogue.slice(0, 140).map((episode, index) => { const angle = index * 2.399963; const radius = 12 + ((index * 37) % 38); return { episode, x: 50 + Math.cos(angle) * radius, y: 49 + Math.sin(angle) * radius * .72 }; });
  const edges = nodes.filter((_, index) => index % 2 === 0).map((node, index) => { const target = nodes[(index * 11 + 17) % nodes.length]; return `<line x1="${node.x.toFixed(2)}" y1="${node.y.toFixed(2)}" x2="${target.x.toFixed(2)}" y2="${target.y.toFixed(2)}"/>`; }).join('');
  art.querySelector('.universe-svg')?.insertAdjacentHTML('beforeend', edges);
  const universeMeta = art.querySelector('.universe-header span');
  if (universeMeta) universeMeta.textContent = `3 EVIDENCE · ${catalogue.length} EPISODES`;
  const nodeStyle = document.createElement('style');
  nodeStyle.textContent = '.universe-svg line{stroke:rgba(199,167,255,.16);stroke-width:.35}.catalog-node{position:absolute;z-index:1;width:5px;height:5px;border:0;border-radius:50%;background:rgba(243,240,237,.42);box-shadow:0 0 8px rgba(243,240,237,.18);padding:0;cursor:pointer}.catalog-node:hover,.catalog-node:focus-visible{background:var(--paper);box-shadow:0 0 0 5px rgba(243,240,237,.08),0 0 15px rgba(243,240,237,.8);outline:0}';
  document.head.appendChild(nodeStyle);
  art.insertAdjacentHTML('beforeend', nodes.map(({ episode, x, y }) => `<button class="catalog-node" type="button" style="left:${x}%;top:${y}%" title="${escapeHtml(episode.title)}" aria-label="Catalogue episode: ${escapeHtml(episode.title)}" data-universe-query="${escapeHtml(episode.title)}"></button>`).join(''));
  art.querySelectorAll('.catalog-node').forEach(node => node.addEventListener('click', () => { query.value = node.dataset.universeQuery; form.requestSubmit(); window.scrollTo({ top: document.querySelector('#archive').offsetTop, behavior: 'smooth' }); }));
}

function deslopInterface() {
  const eyebrow = document.querySelector('.eyebrow');
  if (eyebrow) eyebrow.innerHTML = 'A LIVING ARCHIVE FOR BETTER DECISIONS';
  document.querySelectorAll('.rail-heading span').forEach(node => node.remove());
  document.querySelectorAll('.signal-meta span:last-child').forEach(node => { if (node.textContent.includes('%') || node.textContent.includes('/')) node.textContent = 'REVIEW'; });
  document.querySelectorAll('.signal-bars').forEach(node => { node.innerHTML = '<span>clear opening</span><span>complete thought</span><span>context review</span>'; node.className = 'signal-reasons'; });
  const style = document.createElement('style');
  style.textContent = '.signal-reasons{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 15px}.signal-reasons span{color:var(--muted);font:9px "DM Mono";border-bottom:1px solid rgba(199,167,255,.35);padding-bottom:4px}';
  document.head.appendChild(style);
  const footer = document.querySelector('footer');
  if (footer) footer.innerHTML = '<span>FLIGHTSTORY INTELLIGENCE</span><span>Search the archive. Verify the moment.</span>';
}

renderQueue();
initDiscovery();
deslopInterface();
if (query.value) form.requestSubmit();
fetch('/api/backend').then(response => response.json()).then(status => {
  const archiveMeta = document.querySelector('.rail-item.active small');
  if (archiveMeta) archiveMeta.textContent = '0 indexed, 367 catalogue candidates';
  const badge = document.querySelector('.status');
  if (badge && status.configured) badge.innerHTML = '<span></span> InsForge linked';
}).catch(() => {});
const authScript = document.createElement('script');
authScript.type = 'module';
authScript.src = '/auth.js';
document.body.appendChild(authScript);
const universeScript = document.createElement('script');
universeScript.type = 'module';
universeScript.src = '/universe.js';
document.body.appendChild(universeScript);
