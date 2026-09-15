import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/universe.src.js', import.meta.url), 'utf8');

function sourceFunction(name) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[^\\n]*\\}`));
  assert.ok(match, `missing ${name}`);
  return new Function(`return (${match[0]})`)();
}

test('map rendering is gated by visibility and reduced motion becomes demand-driven', () => {
  const canRender = sourceFunction('canRender');
  const shouldAnimate = sourceFunction('shouldAnimate');

  assert.equal(canRender({ ready: true, inView: true, visible: true }), true);
  assert.equal(canRender({ ready: false, inView: true, visible: true }), false);
  assert.equal(canRender({ ready: true, inView: false, visible: true }), false);
  assert.equal(canRender({ ready: true, inView: true, visible: false }), false);
  assert.equal(shouldAnimate({ reduced: false, inView: true, visible: true }), true);
  assert.equal(shouldAnimate({ reduced: true, inView: true, visible: true }), false);
  assert.equal(shouldAnimate({ reduced: false, inView: false, visible: true }), false);
  assert.equal(shouldAnimate({ reduced: false, inView: true, visible: false }), false);

  assert.match(source, /function requestRender\(\) \{\s*if \(!canRender\([\s\S]*?\) \|\| frameId !== null\) return;/);
  assert.match(source, /document\.addEventListener\('visibilitychange',[\s\S]*?stopRendering\(\)/);
  assert.match(source, /new IntersectionObserver\(\(\[entry\]\) => \{[\s\S]*?stopRendering\(\)/);
  assert.match(source, /controls\.addEventListener\('change', requestRender\)/);
  assert.match(source, /motionPreference\.addEventListener\('change'/);
  assert.match(source, /controls\.enableDamping = !reducedMotion/);
  assert.match(source, /@media\(prefers-reduced-motion:reduce\)\{\.universe-inspector\{transition:none\}\}/);
  assert.match(source, /const phase = reducedMotion \? \.5 :/);
  assert.match(source, /if \(shouldAnimate\(\{ reduced: reducedMotion, inView: stageInView, visible: pageVisible \}\)\) requestRender\(\)/);
});
