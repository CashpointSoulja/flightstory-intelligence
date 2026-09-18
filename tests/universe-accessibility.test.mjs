import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('floating labels are limited to the twelve most frequent topics', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /const topicLabels = \[\.\.\.topicNodes\]\.sort\(\(a, b\) => b\.userData\.occurrences - a\.userData\.occurrences\)\.slice\(0, 12\)\.map/);
  assert.equal((graph.match(/label\.className = 'universe-node-label'/g) || []).length, 1);
});

test('rendered edges use percentile thresholds while inspection retains all connections', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  for (const [prefix, source, field, percentile] of [['topic', 'graph', 'weight', '85'], ['video', 'videoGraph', 'score', '90']]) {
    assert.ok(graph.includes(`const ${prefix}EdgeWeights = ${source}.edges.map(edge => edge.${field}).sort((a, b) => a - b)`));
    assert.ok(graph.includes(`${prefix}EdgeWeights[Math.floor(${prefix}EdgeWeights.length * .${percentile})] ?? Infinity`));
    assert.ok(graph.includes(`${source}.edges.filter(edge => edge.${field} >= ${prefix}EdgeThreshold)`));
    assert.ok(graph.includes(`for (const edge of visible${prefix === 'topic' ? 'Topic' : 'Video'}Edges)`));
    assert.ok(graph.includes(`for (const edge of ${source}.edges) if (edge.source === data.id || edge.target === data.id)`));
  }
  assert.match(graph, /visibleTopicEdges\.slice\(0, 18\)/);
});

test('accessible archive nodes select in-app and keep source opening as a separate action', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /for \(const node of \[\.\.\.topicNodes\.slice\(0, 30\), \.\.\.videoNodes\.slice\(0, 30\), \.\.\.evidenceNodes\]\)/);
  assert.match(graph, /select\.setAttribute\('aria-pressed', 'false'\)/);
  assert.match(graph, /select\.addEventListener\('click', \(\) => \{[\s\S]*?selectNode\(node\); \}\)/);
  assert.match(graph, /const sourceLink = document\.createElement\('a'\)/);
  assert.match(graph, /sourceLink\.target = '_blank'/);
  assert.match(graph, /for \(const \[key, button\] of graphSelectionButtons\) button\.setAttribute\('aria-pressed', String\(key === `\$\{data\.kind\}:\$\{data\.id\}`\)\)/);
  assert.match(graph, /canvas\.addEventListener\('pointerdown', event => \{ const hitNode = hit\(event, true\)\[0\]\?\.object; if \(hitNode\) selectNode\(hitNode\); \}\)/);
  assert.match(graph, /class="universe-inspector" hidden tabindex="-1" role="region" aria-label="Selected archive node" aria-live="polite"><strong><\/strong><small><\/small>/);
  assert.match(graph, /3D archive map\. Use Browse featured archive nodes to select a topic, video, or citation/);
  assert.doesNotMatch(graph, /canvas\.tabIndex\s*=\s*0/);
});

test('selecting an archive node moves focus to its inspector', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /class="universe-inspector" hidden tabindex="-1" role="region" aria-label="Selected archive node" aria-live="polite"/);
  assert.match(graph, /inspector\.classList\.add\('visible'\);\s*inspector\.focus\(\{ preventScroll: true \}\);/);
});

test('3D clicks fall back to nearby visible nodes only after an exact raycast misses', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /const intersections = raycaster\.intersectObjects\(visibleNodes\);\s*if \(intersections\.length \|\| !pointerDown\) return intersections;/);
  assert.match(graph, /nearestNodeWithinRadius\(projected, event\.clientX, event\.clientY\)/);
});

test('topic inspectors expose linked transcript moments with timestamped source links', async () => {
  const graph = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

  assert.match(graph, /data\.kind === 'topic' \? \(data\.sources \|\| \[\]\) : \[\]/);
  assert.match(graph, /link\.textContent = `\$\{moment\.title\} · \$\{formatTime\(moment\.seconds\)\} ↗`/);
  assert.match(graph, /nodeSourceUrl\(\{ source: moment\.url, seconds: moment\.seconds \}\)/);
  assert.match(graph, /setAttribute\('aria-label', 'Linked transcript moments'\)/);
});
