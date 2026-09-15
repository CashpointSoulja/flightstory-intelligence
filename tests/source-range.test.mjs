import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('result and selected-source views show the full source window while the link opens at its start', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /class="source-window">\$\{formatTime\(item\.start\)\}–\$\{formatTime\(item\.end\)\}/);
  assert.match(app, /Source window \$\{formatTime\(item\.start\)\}–\$\{formatTime\(item\.end\)\}/);
  assert.match(app, /▶ Watch from \$\{formatTime\(item\.start\)\}/);
});
