import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('closed mobile sidebar does not intercept main controls', () => {
  assert.match(css, /\.sidebar:not\(\.open\)\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.sidebar\.open\s*\{[^}]*pointer-events:\s*auto/s);
});

test('modal picker is constrained and scrollable on short viewports', () => {
  assert.match(css, /\.picker\s*\{[^}]*max-height:\s*calc\(100vh/s);
  assert.match(css, /\.picker\s*\{[^}]*overflow:\s*auto/s);
});
