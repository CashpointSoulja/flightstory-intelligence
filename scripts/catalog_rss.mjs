#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const feedUrl = 'https://audioboom.com/channels/5019925.rss';
const cutoff = new Date(process.argv[2] || '2023-01-01T00:00:00Z');
const output = process.argv[3] || 'catalog/episodes.json';

const xml = await fetch(feedUrl).then(response => {
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
  return response.text();
});

const decode = value => value.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
const tag = (item, name) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] || '');
const attr = (item, name, attribute) => item.match(new RegExp(`<${name}[^>]*\\s${attribute}="([^"]+)"`))?.[1] || null;

const entries = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => {
  const item = match[1];
  const date = tag(item, 'pubDate');
  const title = tag(item, 'title');
  const durationSeconds = Number(tag(item, 'itunes:duration')) || null;
  const shortFormTitle = /\b(moment|clip|short|trailer|teaser|highlight|replay)\b/i.test(title);
  return {
    id: tag(item, 'guid'),
    title,
    publishedAt: date ? new Date(date).toISOString() : null,
    durationSeconds,
    audioUrl: attr(item, 'enclosure', 'url'),
    link: tag(item, 'link'),
    contentType: durationSeconds >= 2700 && !shortFormTitle ? 'long_form_episode' : 'short_form_or_moment',
    eligibleForTranscription: durationSeconds >= 2700 && !shortFormTitle
  };
}).filter(entry => entry.publishedAt && new Date(entry.publishedAt) >= cutoff && entry.title && entry.audioUrl);

entries.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
await mkdir(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await writeFile(output, `${JSON.stringify({ source: feedUrl, cutoff: cutoff.toISOString(), generatedAt: new Date().toISOString(), count: entries.length, episodes: entries }, null, 2)}\n`);
console.log(`Wrote ${entries.length} catalogue entries to ${output}`);
