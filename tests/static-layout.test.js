import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('frontend exposes the overhauled three-pane app shell', () => {
  for (const marker of [
    'data-app-shell',
    'id="conversation-rail"',
    'id="chat-workbench"',
    'id="run-inspector"',
    'id="sidebar-toggle"',
    'id="inspector-toggle"',
    'id="inspector-backdrop"',
    'id="connection-status"',
    'data-panel-tab="run"',
    'data-panel-tab="model"',
    'data-panel-tab="tools"',
    'data-panel-tab="sources"',
    'data-panel-tab="api"',
  ]) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
});

test('frontend includes current API controls and attachment inputs', () => {
  for (const id of [
    'api-key-session',
    'privacy-reset',
    'api-mode',
    'tool-choice',
    'parallel-tool-calls',
    'background-mode',
    'service-tier',
    'attachment-image-url',
    'attachment-file-url',
    'file-search',
    'file-search-vector-stores',
    'file-search-max-results',
    'include-file-search-results',
    'image-generation',
    'image-generation-action',
    'image-generation-size',
    'image-generation-quality',
    'request-preview',
    'copy-request',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test('app shell vendors runtime dependencies instead of loading script or style CDNs', () => {
  assert.doesNotMatch(html, /cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com/);
  for (const asset of [
    'assets/vendor/bootstrap.min.css',
    'assets/vendor/github-markdown.min.css',
    'assets/vendor/prism.min.css',
    'assets/vendor/marked.min.js',
    'assets/vendor/purify.min.js',
    'assets/vendor/prism.min.js',
    'assets/vendor/expr-eval.min.js',
  ]) {
    assert.match(html, new RegExp(asset.replaceAll('.', '\\.')));
  }
});

test('app CSP keeps scripts and styles local while limiting API connections', () => {
  const match = html.match(/Content-Security-Policy" content="([^"]+)"/);
  assert.ok(match, 'missing CSP meta tag');
  const csp = match[1];

  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.openai\.com http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\*/);
  assert.doesNotMatch(csp, /script-src[^;]*https:/);
  assert.doesNotMatch(csp, /style-src[^;]*https:/);
});

test('stateful request generation is gated by the stored-response setting', async () => {
  const ui = await readFile(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /const statefulBody = store\.defaults\.storeResponses && chat\.previousResponseId && lastUser/);
  assert.match(ui, /setChatPreviousResponseId\(chat\.id, null\)/);
  assert.match(ui, /retried with full local history/);
});

test('desktop header avoids duplicating the persistent new chat command', () => {
  assert.match(html, /class="[^"]*d-lg-none[^"]*" id="new-chat-top"/);
});

test('app shell uses the supplied local font stack instead of external display fonts', () => {
  assert.match(html, /styles\.css\?v=20260605-chat-playground-1/);
  assert.match(html, /src\/app\.js\?v=20260605-chat-playground-1/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|Manrope|IBM\+Plex/);
});

test('meta CSP avoids directives browsers ignore outside response headers', () => {
  assert.doesNotMatch(html, /frame-ancestors/);
});

test('visual system uses a static app shell without gradient/orb decoration', () => {
  assert.match(css, /\.app-shell\s*\{/);
  assert.match(css, /\.inspector-panel\s*\{/);
  assert.match(css, /\.composer\s*\{/);
  assert.doesNotMatch(css, /radial-gradient|gradient orb|bokeh/i);
});

test('secondary playground actions are available without occupying the default topbar', () => {
  assert.match(html, /class="chat-surface-actions" hidden/);
  assert.match(html, /id="copy-request"/);
  assert.match(html, /id="command-results" class="command-results"/);
  assert.match(html, /aria-label="Toggle API playground"/);
});

test('advanced settings are progressively disclosed', () => {
  assert.match(html, /<details class="settings-advanced">\s*<summary>Advanced generation<\/summary>/);
  assert.match(html, /<details class="settings-advanced">\s*<summary>Web search tuning<\/summary>/);
});
