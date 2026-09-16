#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const [catalogPath = 'public/catalog.json', outputPath = 'data/approved-source-manifest.template.json'] = process.argv.slice(2);
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog.episodes)) throw new Error('Catalogue must contain an episodes array');
const sources = catalog.episodes.map(episode => ({
  episodeId: episode.id,
  videoId: '',
  channelId: '',
  rightsStatus: 'pending',
  approvalReference: '',
}));
await mkdir(outputPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: catalog.source, sources }, null, 2)}\n`);
console.log(`Wrote ${sources.length} source slots to ${outputPath}`);
