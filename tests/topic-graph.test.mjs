import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('topic graph contains concepts rather than transcript fragments', async () => {
  const graph = JSON.parse(await readFile(new URL('../public/topic-graph.json', import.meta.url)));
  const ids = new Set(graph.nodes.map(node => node.id));
  assert.ok(graph.nodes.length < 100, 'the graph should stay editorially legible');
  assert.ok(graph.nodes.some(node => node.label === 'mental health'));
  assert.ok(graph.nodes.some(node => node.label === 'financial freedom'));
  for (const label of ['able', 'person', 'keep', 'whatever', 'stuff', 'called']) assert.equal(graph.nodes.some(node => node.label === label), false, label);
  assert.ok(graph.edges.length > 0);
  assert.ok(graph.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)));
  assert.ok(graph.nodes.every(node => node.source && Number.isFinite(node.seconds)));
});
