#!/usr/bin/env node
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function parseTimestamp(value) {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) return null;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}
export function parseVtt(text) {
  const cues = [];
  for (const block of text.replace(/^WEBVTT[^\n]*\n?/, '').split(/\n\s*\n/)) {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const timing = lines.findIndex(line => line.includes('-->'));
    if (timing < 0) continue;
    const [startRaw, endRaw] = lines[timing].split('-->').map(value => value.trim().split(/\s+/)[0]);
    const start = parseTimestamp(startRaw), end = parseTimestamp(endRaw);
    const cueText = lines.slice(timing + 1).join(' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (start !== null && end !== null && end >= start && cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}

async function main() {
  const [raw = 'data/raw', output = 'data/episodes'] = process.argv.slice(2);
  const files = await readdir(raw);
  const infoFiles = files.filter(file => file.endsWith('.info.json'));
  await mkdir(output, { recursive: true });
  let normalized = 0, missing = 0, cueCount = 0;
  for (const infoFile of infoFiles) {
    const id = infoFile.slice(0, -'.info.json'.length);
    const vtt = files.find(file => file === `${id}.en.vtt`) || files.find(file => file === `${id}.en-orig.vtt`);
    if (!vtt) { missing += 1; continue; }
    const info = JSON.parse(await readFile(join(raw, infoFile), 'utf8'));
    const segments = parseVtt(await readFile(join(raw, vtt), 'utf8'));
    if (!segments.length) continue;
    const episode = { id, title: info.title || id, url: info.webpage_url || `https://www.youtube.com/watch?v=${id}`, publishedAt: info.upload_date || null, durationSeconds: Number(info.duration) || null, segments, transcriptStatus: 'provisional', speakerStatus: 'unknown', source: { type: 'youtube-caption-vtt', file: vtt, channelId: info.channel_id || null } };
    await writeFile(join(output, `${id}.json`), `${JSON.stringify(episode, null, 2)}\n`);
    normalized += 1; cueCount += segments.length;
  }
  console.log(JSON.stringify({ metadata: infoFiles.length, normalized, missing, segments: cueCount, output }));
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
