import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('accessible archive nodes select in-app and keep source opening as a separate action', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /for \(const node of \[\.\.\.topicNodes\.slice\(0, 30\), \.\.\.videoNodes\.slice\(0, 30\), \.\.\.evidenceNodes\]\)/);
  assert.match(graph, /select\.setAttribute\('aria-pressed', 'false'\)/);
  assert.match(graph, /select\.addEventListener\('click', \(\) => \{[\s\S]*?selectNode\(node\); \}\)/);
  assert.match(graph, /const sourceLink = document\.createElement\('a'\)/);
  assert.match(graph, /sourceLink\.target = '_blank'/);
  assert.match(graph, /for \(const \[key, button\] of graphSelectionButtons\) button\.setAttribute\('aria-pressed', String\(key === `\$\{data\.kind\}:\$\{data\.id\}`\)\)/);
  assert.match(graph, /canvas\.addEventListener\('pointerdown', event => \{ const hitNode = hit\(event\)\[0\]\?\.object; if \(hitNode\) selectNode\(hitNode\); \}\)/);
  assert.match(graph, /class="universe-inspector" hidden role="region" aria-label="Selected archive node" aria-live="polite"><strong><\/strong><small><\/small>/);
  assert.match(graph, /3D archive map\. Use Browse featured archive nodes to select a topic, video, or citation/);
  assert.doesNotMatch(graph, /canvas\.tabIndex\s*=\s*0/);
});
