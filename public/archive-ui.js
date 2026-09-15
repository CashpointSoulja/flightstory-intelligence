export function formatTime(value) {
  const seconds = Number(value);
  const centiseconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 100)) : 0;
  const totalMinutes = Math.floor(centiseconds / 6000);
  const remainder = centiseconds % 6000;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const wholeSeconds = Math.floor(remainder / 100);
  const fraction = remainder % 100;
  const clock = hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : String(minutes).padStart(2, '0');
  return `${clock}:${String(wholeSeconds).padStart(2, '0')}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

export function watchUrl(item) {
  const videoId = typeof item?.videoId === 'string' ? item.videoId.trim() : '';
  if (!videoId) return null;
  const start = Number(item.start);
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Number.isFinite(start) ? Math.max(0, start) : 0}s`;
}

export function removeSavedItem(items, id) {
  return items.filter(item => String(item.id) !== String(id));
}

export function isValidQuery(value) {
  return typeof value === 'string' && value.trim().length >= 2 && value.length <= 500;
}

export function isValidClipRange(startValue, endValue, durationSeconds) {
  const start = Number(startValue);
  const end = Number(endValue);
  const duration = durationSeconds == null ? NaN : Number(durationSeconds);
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && (!Number.isFinite(duration) || duration <= 0 || end <= duration);
}

export function graphLayerVisibility(layer) {
  return { topics: layer === 'topics', videos: layer === 'videos', evidence: layer === 'evidence' };
}

export function graphNodeIsVisible(layer, kind) {
  return kind === 'core' || kind === 'connection' && layer === 'videos' || graphLayerVisibility(layer)[kind] === true;
}

export function loadSavedItems(storageProvider) {
  try {
    const parsed = JSON.parse(storageProvider().getItem('flightstory-clips') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedItems(storageProvider, items) {
  try {
    storageProvider().setItem('flightstory-clips', JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
