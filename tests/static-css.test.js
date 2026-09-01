import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('visual system uses the supplied template fonts and palette', () => {
  assert.match(css, /--font:\s*"Helvetica Neue", Helvetica, system-ui/);
  assert.match(css, /--serif:\s*Georgia, serif/);
  assert.match(css, /--mono:\s*ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace/);
  assert.match(css, /--bg:\s*#fbfbfb/);
  assert.match(css, /--text:\s*#15181b/);
  assert.match(css, /--muted:\s*#5a6672/);
  assert.match(css, /--accent:\s*#0f5b6d/);
  assert.match(css, /--border:\s*#e4e7eb/);
  assert.match(css, /--radius:\s*6px/);
  assert.match(css, /--bs-body-color-rgb:\s*21,\s*24,\s*27/);
  assert.match(css, /--bs-body-bg-rgb:\s*251,\s*251,\s*251/);
});

test('closed mobile sidebar does not intercept main controls', () => {
  assert.match(css, /\.sidebar:not\(\.open\)\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.sidebar\.open\s*\{[^}]*pointer-events:\s*auto/s);
});

test('desktop sidebar can collapse to reclaim chat real estate', () => {
  assert.match(css, /\.app-shell\.sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*0 minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.app-shell\.sidebar-collapsed \.conversation-rail\s*\{[^}]*width:\s*0/s);
  assert.match(css, /\.app-shell\.sidebar-collapsed \.conversation-rail\s*\{[^}]*pointer-events:\s*none/s);
});

test('modal picker is constrained and scrollable on short viewports', () => {
  assert.match(css, /\.picker\s*\{[^}]*max-height:\s*calc\(100vh/s);
  assert.match(css, /\.picker\s*\{[^}]*overflow:\s*auto/s);
});

test('advanced inspector is opt-in so chat gets the default workspace', () => {
  assert.match(css, /\.workspace-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.app-shell\.inspector-open \.workspace-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(330px,\s*var\(--rail-width\)\)/s);
  assert.match(css, /\.app-shell:not\(\.inspector-open\) \.inspector-panel\s*\{[^}]*display:\s*none !important/s);
});

test('connection and command surfaces use compact native components', () => {
  assert.match(css, /\.status-button\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.status-button\.ready \.status-dot\s*\{[^}]*background:\s*var\(--success\)/s);
  assert.match(css, /\.command-results\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.settings-advanced\s*\{[^}]*border:\s*1px solid var\(--border-soft\)/s);
});

test('advanced inspector becomes an overlay before it steals chat width', () => {
  assert.match(css, /@media \(max-width:\s*1320px\)\s*\{[\s\S]*?\.inspector-panel\s*\{[\s\S]*?position:\s*fixed/s);
  assert.match(css, /@media \(max-width:\s*1320px\)\s*\{[\s\S]*?\.inspector-panel\s*\{[\s\S]*?width:\s*min\(92vw,\s*390px\)/s);
  assert.match(css, /@media \(min-width:\s*1320\.02px\)\s*\{[\s\S]*?\.inspector-backdrop\s*\{[\s\S]*?display:\s*none !important/s);
});
