import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../catalog/episodes.json', import.meta.url), 'utf8'));

test('catalogue covers the public DOAC RSS archive from 2023 onward', () => {
  assert.equal(catalog.source, 'https://audioboom.com/channels/5019925.rss');
  assert.ok(catalog.count >= 586);
  assert.equal(catalog.episodes.length, catalog.count);
  assert.equal(catalog.episodes.at(-1).publishedAt.slice(0, 10), '2023-01-02');
  const byYear = Object.fromEntries(Object.entries(Object.groupBy(catalog.episodes, episode => episode.publishedAt.slice(0, 4))).map(([year, episodes]) => [year, episodes.length]));
  assert.ok(byYear[2023] >= 156 && byYear[2024] >= 157 && byYear[2025] >= 162 && byYear[2026] >= 111);
  assert.ok(catalog.episodes.filter(episode => episode.eligibleForTranscription).length >= 385);
  assert.ok(catalog.episodes.every(episode => episode.id && episode.title && episode.audioUrl && episode.publishedAt));
});
