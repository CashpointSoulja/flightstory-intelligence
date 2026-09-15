import { formatTime, watchUrl } from './archive-ui.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const seconds = ms => (ms / 1000).toFixed(3).replace(/\.?0+$/, '');
const secondsToMs = value => {
  if (value === null || value === undefined || value === '') return null;
  const scaled = Number(value) * 1000;
  const rounded = Math.round(scaled);
  return Number.isFinite(scaled) && Math.abs(scaled - rounded) < 0.000001 && Number.isSafeInteger(rounded) ? rounded : null;
};

export function canSaveSharedDraft(input, boardId, saving) {
  return Boolean(input && boardId && !saving);
}

export function setReviewButtonsDisabled(card, disabled) {
  card.querySelectorAll('[data-review]').forEach(button => { button.disabled = disabled; });
}

export function citationClipInput(citation) {
  if (!citation || typeof citation.id !== 'string' || !UUID.test(citation.id)) return null;
  const startMs = Number.isSafeInteger(citation.start_ms) ? citation.start_ms : secondsToMs(citation.start);
  const endMs = Number.isSafeInteger(citation.end_ms) ? citation.end_ms : secondsToMs(citation.end);
  if (!Number.isSafeInteger(startMs) || startMs < 0 || !Number.isSafeInteger(endMs) || endMs <= startMs) return null;
  return {
    segmentId: citation.id,
    startMs,
    endMs,
    title: String(citation.episode || '').slice(0, 200),
    hook: String(citation.quote || '').slice(0, 2000)
  };
}

export async function initSharedReview(auth) {
  if (auth?.searchAccessMode !== 'workspace' || !auth.user?.id) return;
  let root = document.querySelector('#shared-review');
  if (!root) {
    root = document.createElement('section');
    root.id = 'shared-review';
    root.className = 'shared-review';
    document.querySelector('footer')?.before(root);
  }
  if (root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  root.innerHTML = `<div class="shared-review-intro"><p class="eyebrow">TEAM WORKSPACE</p><h2>Shared clip review</h2><p>Save transcript moments to a board, then submit them for a teammate to review.</p></div>
    <div class="shared-review-tools"><label>Board<select data-board><option value="">Loading boards…</option></select></label><form data-create-board><label>New board<input name="name" maxlength="160" required placeholder="e.g. Campaign cutdowns"></label><button type="submit">Create board</button></form></div>
    <section class="shared-current" aria-labelledby="shared-current-title"><div><p class="eyebrow">SELECTED SOURCE</p><h3 id="shared-current-title">Choose a workspace citation</h3><p data-current-quote class="shared-quote">Select an evidence moment from the research results.</p><p data-current-meta class="shared-meta"></p></div><button type="button" data-save-source disabled>Save as shared draft</button></section>
    <p class="shared-status" data-shared-status role="status" aria-live="polite"></p><div class="shared-clips" data-shared-clips><p class="clip-empty">Choose a board to see its shared clips.</p></div>`;

  const boardSelect = root.querySelector('[data-board]');
  const status = root.querySelector('[data-shared-status]');
  const clips = root.querySelector('[data-shared-clips]');
  const saveButton = root.querySelector('[data-save-source]');
  let boards = [];
  let boardId = '';
  let savingDraft = false;
  let selectedCitation = window.selectedArchiveCitation || null;

  const api = async (path, method = 'GET', payload) => {
    const token = await auth.getAccessToken();
    if (!token) throw new Error('Your session expired. Sign in again to use shared review.');
    const response = await fetch(path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(payload ? { 'content-type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 401 ? 'Your session expired. Sign in again.' :
        response.status === 403 ? 'Your account does not have permission for this workspace action.' :
          result.error || 'The workspace could not complete that action. Try again.';
      throw new Error(message);
    }
    return result;
  };

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function renderCurrent() {
    const input = citationClipInput(selectedCitation);
    root.querySelector('#shared-current-title').textContent = sourceHeading(selectedCitation);
    root.querySelector('[data-current-quote]').textContent = selectedCitation?.quote || 'Select an evidence moment from the research results.';
    root.querySelector('[data-current-meta]').textContent = input
      ? `${selectedCitation.guest || 'Unknown guest'} · ${selectedCitation.episode || 'Untitled episode'} · ${formatTime(input.startMs / 1000)}–${formatTime(input.endMs / 1000)}`
      : selectedCitation ? 'This result is not a workspace transcript segment, so it cannot be saved to a shared board.' : '';
    saveButton.disabled = !canSaveSharedDraft(input, boardId, savingDraft);
    saveButton.textContent = input ? 'Save as shared draft' : 'Workspace citation required';
  }

  function renderClips(items = []) {
    clips.innerHTML = items.length ? items.map(clip => {
      const startMs = clip.start_ms;
      const endMs = clip.end_ms;
      const episode = clip.episode || {};
      const source = clip.source || {};
      const review = clip.latestReview || {};
      const statusLabel = String(clip.status || 'draft').replaceAll('_', ' ').toUpperCase();
      const sourceUrl = watchUrl({ videoId: episode.youtube_video_id, start: startMs / 1000 });
      const editableStatus = ['suggested', 'rejected'].includes(clip.status);
      const editable = editableStatus && clip.canEdit === true;
      const submit = clip.status === 'suggested' && clip.canEdit === true;
      const creatorMessage = clip.status === 'suggested'
        ? 'Only the clip creator can edit or submit this draft.'
        : 'Only the clip creator can edit this draft.';
      return `<article class="shared-clip" data-clip="${escapeHtml(clip.id)}" data-title="${escapeHtml(clip.title || '')}" data-hook="${escapeHtml(clip.hook || '')}"><div class="shared-clip-copy"><span class="shared-state">${escapeHtml(statusLabel)}</span><h3>${escapeHtml(clip.title || episode.title || 'Untitled clip')}</h3><p class="shared-meta">${escapeHtml(episode.guest || 'Unknown guest')} · ${formatTime(startMs / 1000)}–${formatTime(endMs / 1000)}</p><blockquote>${escapeHtml(source.text || clip.hook || 'Source transcript unavailable.')}</blockquote>${sourceUrl ? `<a class="shared-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Watch source ↗</a>` : ''}${review.note ? `<p class="review-note"><strong>${escapeHtml(review.decision || 'Review')}:</strong> ${escapeHtml(review.note)}</p>` : ''}</div>
        ${editable ? `<form data-range-form><label>In <small>seconds</small><input name="start" type="number" min="0" step="0.001" value="${seconds(startMs)}" required></label><label>Out <small>seconds</small><input name="end" type="number" min="0" step="0.001" value="${seconds(endMs)}" required></label><button type="submit">Save range</button></form>` : ''}
        <div class="shared-clip-actions">${submit ? '<button type="button" data-submit>Submit for review</button>' : ''}${editableStatus && !editable ? `<p>${creatorMessage}</p>` : ''}${clip.status === 'needs_review' && clip.canReview === true ? '<textarea data-review-note maxlength="2000" aria-label="Review note" placeholder="Add a note for the producer (optional)"></textarea><button type="button" data-review="approved">Approve</button><button type="button" data-review="rejected">Request changes</button>' : ''}${clip.status === 'needs_review' && clip.canReview !== true ? '<p>Waiting for an eligible teammate to review.</p>' : ''}</div></article>`;
    }).join('') : '<p class="clip-empty">No shared clips on this board yet.</p>';
  }

  async function loadClips() {
    renderCurrent();
    if (!boardId) { renderClips(); return; }
    clips.innerHTML = '<p class="clip-empty">Loading board clips…</p>';
    try { renderClips((await api(`/api/boards/${encodeURIComponent(boardId)}/clips`)).clips || []); }
    catch (error) { clips.innerHTML = ''; setStatus(error.message, 'error'); }
  }

  async function loadBoards(preferredId = '') {
    boardSelect.innerHTML = '<option value="">Loading boards…</option>';
    try {
      boards = (await api('/api/boards')).boards || [];
      boardSelect.innerHTML = `<option value="">Choose a board…</option>${boards.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join('')}`;
      boardId = boards.some(board => board.id === preferredId) ? preferredId : boards[0]?.id || '';
      boardSelect.value = boardId;
      if (!boards.length) setStatus('Create a board to start a shared review queue.');
      await loadClips();
    } catch (error) {
      boardSelect.innerHTML = '<option value="">Boards unavailable</option>';
      setStatus(error.message, 'error');
    }
  }

  window.addEventListener('archive:citation-selected', event => { selectedCitation = event.detail; renderCurrent(); });
  boardSelect.addEventListener('change', () => { boardId = boardSelect.value; setStatus(''); loadClips(); });
  root.querySelector('[data-create-board]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    if (!name) return;
    const button = form.querySelector('button'); button.disabled = true;
    try {
      const result = await api('/api/boards', 'POST', { name, requestId: crypto.randomUUID() });
      form.reset(); setStatus('Board created.'); await loadBoards(result.id);
    } catch (error) { setStatus(error.message, 'error'); }
    finally { button.disabled = false; }
  });
  saveButton.addEventListener('click', async () => {
    const input = citationClipInput(selectedCitation);
    if (!canSaveSharedDraft(input, boardId, savingDraft)) return;
    savingDraft = true;
    saveButton.disabled = true;
    try {
      await api('/api/clips', 'POST', { boardId, ...input, requestId: crypto.randomUUID() });
      setStatus('Shared draft saved to this board.'); await loadClips();
    } catch (error) { setStatus(error.message, 'error'); }
    finally { savingDraft = false; renderCurrent(); }
  });
  clips.addEventListener('submit', async event => {
    const form = event.target.closest('[data-range-form]');
    if (!form) return;
    event.preventDefault();
    const card = form.closest('[data-clip]');
    const payload = rangeEditInput(form.elements.start.value, form.elements.end.value, card.dataset);
    if (!payload) { setStatus('Enter a valid range: out must be after in.', 'error'); return; }
    try {
      await api(`/api/clips/${encodeURIComponent(card.dataset.clip)}/range`, 'PATCH', payload);
      setStatus('Range updated.'); await loadClips();
    } catch (error) { setStatus(error.message, 'error'); }
  });
  clips.addEventListener('click', async event => {
    const button = event.target.closest('[data-submit], [data-review]');
    if (!button) return;
    const card = button.closest('[data-clip]');
    if (button.hasAttribute('data-review') && button.disabled) return;
    if (button.hasAttribute('data-review')) setReviewButtonsDisabled(card, true);
    else button.disabled = true;
    try {
      if (button.hasAttribute('data-submit')) {
        await api(`/api/clips/${encodeURIComponent(card.dataset.clip)}/submit`, 'POST', {});
        setStatus('Clip submitted for review.');
      } else {
        await api(`/api/clips/${encodeURIComponent(card.dataset.clip)}/review`, 'POST', {
          decision: button.dataset.review,
          note: card.querySelector('[data-review-note]')?.value || '',
          requestId: crypto.randomUUID()
        });
        setStatus(button.dataset.review === 'approved' ? 'Clip approved.' : 'Changes requested.');
      }
      await loadClips();
    } catch (error) {
      setStatus(error.message, 'error');
      if (button.hasAttribute('data-review')) setReviewButtonsDisabled(card, false);
      else button.disabled = false;
    }
  });

  renderCurrent();
  await loadBoards();
}

export function rangeEditInput(startSeconds, endSeconds, clip) {
  const startMs = secondsToMs(startSeconds);
  const endMs = secondsToMs(endSeconds);
  if (startMs === null || endMs === null || startMs < 0 || endMs <= startMs) return null;
  return { startMs, endMs, title: clip.title || null, hook: clip.hook || null };
}

export function sourceHeading(citation) {
  return citation ? citation.episode || citation.guest || 'Selected source' : 'Choose a workspace citation';
}
