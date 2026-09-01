import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appHtml = await readFile(new URL('../app.html', import.meta.url), 'utf8');
const setupHtml = await readFile(new URL('../docs/setup.html', import.meta.url), 'utf8');
const apiHtml = await readFile(new URL('../docs/api.html', import.meta.url), 'utf8');
const privacyHtml = await readFile(new URL('../docs/privacy.html', import.meta.url), 'utf8');
const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

test('homepage is crawlable and points users to app and docs', () => {
  assert.match(indexHtml, /<meta name="description"/);
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/chat\.fenosys\.com\/"/);
  assert.match(indexHtml, /application\/ld\+json/);
  assert.match(indexHtml, /href="app\.html"/);
  assert.match(indexHtml, /href="docs\/setup\.html"/);
  assert.doesNotMatch(indexHtml, /data-app-shell/);
});

test('app page owns the chat shell while docs own long-form details', () => {
  assert.match(appHtml, /data-app-shell/);
  assert.match(appHtml, /href="docs\/setup\.html"/);
  assert.match(setupHtml, /Setup Chat LLM/);
  assert.match(apiHtml, /API support in Chat LLM/);
  assert.match(privacyHtml, /Privacy and security notes/);
});

test('docs describe the pure GitHub Pages BYOK security model accurately', () => {
  const docs = `${setupHtml}\n${apiHtml}\n${privacyHtml}`;
  assert.match(docs, /memory-only by default/);
  assert.match(docs, /pure GitHub Pages/);
  assert.match(docs, /BYOK/);
  assert.match(apiHtml, /Responses API only/);
  assert.doesNotMatch(docs, /chat\.completions|chat\/completions/);
  assert.doesNotMatch(docs, /CDN assets/);
  assert.doesNotMatch(docs, /backend proxy that owns API keys/);
});

test('robots and sitemap expose all static entry points', () => {
  assert.match(robots, /Sitemap: https:\/\/chat\.fenosys\.com\/sitemap\.xml/);
  for (const url of [
    'https://chat.fenosys.com/',
    'https://chat.fenosys.com/app.html',
    'https://chat.fenosys.com/docs/setup.html',
    'https://chat.fenosys.com/docs/api.html',
    'https://chat.fenosys.com/docs/privacy.html',
  ]) {
    assert.match(sitemap, new RegExp(url.replaceAll('.', '\\.').replaceAll('/', '\\/')));
  }
});
