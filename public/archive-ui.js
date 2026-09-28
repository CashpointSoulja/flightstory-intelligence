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
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Number.isFinite(start) ? Math.max(0, Math.round(start)) : 0}s`;
}

export function removeSavedItem(items, id) {
  return items.filter(item => String(item.id) !== String(id));
}

export function isValidQuery(value) {
  return typeof value === 'string' && value.trim().length >= 2 && value.length <= 500;
}

export const MIN_CLIP_START_S = 120;

export function startsInContent(item) {
  return Number(item?.start) >= MIN_CLIP_START_S;
}

export function floorClipWindow(startValue, endValue) {
  const start = Number(startValue);
  const duration = Number(endValue) - start;
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return { start, end: Number(endValue) };
  const floored = Math.max(MIN_CLIP_START_S, start);
  return { start: floored, end: floored + duration };
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
  return kind === 'core' || kind === 'connection' && layer === 'videos' || kind === 'topic' && layer === 'topics' || kind === 'video' && layer === 'videos' || kind === 'evidence' && layer === 'evidence';
}

export function nearestNodeWithinRadius(points, x, y, radius = 8) {
  let nearest = null;
  let nearestDistance = radius * radius;
  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance <= nearestDistance) {
      nearest = point.node;
      nearestDistance = distance;
    }
  }
  return nearest;
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
