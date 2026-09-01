import assert from 'node:assert/strict';
import test from 'node:test';

import { assessRequestPreflight, normalizeBaseUrl } from '../src/security.js';

const pagesLocation = { protocol: 'https:', hostname: 'chat.fenosys.com' };
const localLocation = { protocol: 'http:', hostname: '127.0.0.1' };

test('preflight blocks unsupported API modes and unsafe production endpoints', () => {
  const mode = assessRequestPreflight({
    defaults: { apiMode: 'realtime', apiBaseUrl: 'https://api.openai.com' },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });
  assert.equal(mode.status, 'block');
  assert.match(mode.blocks.join(' '), /Responses API/);

  const endpoint = assessRequestPreflight({
    defaults: { apiMode: 'responses', apiBaseUrl: 'https://example.com' },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });
  assert.equal(endpoint.status, 'block');
  assert.match(endpoint.blocks.join(' '), /api\.openai\.com/);
});

test('preflight allows localhost API bases only during local development', () => {
  const local = assessRequestPreflight({
    defaults: { apiMode: 'responses', apiBaseUrl: 'http://127.0.0.1:8787' },
    model: 'gpt-5.5',
    locationLike: localLocation,
  });
  assert.equal(local.status, 'allow');

  const hosted = assessRequestPreflight({
    defaults: { apiMode: 'responses', apiBaseUrl: 'http://127.0.0.1:8787' },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });
  assert.equal(hosted.status, 'block');
});

test('preflight returns confirm for expensive or stateful settings', () => {
  const result = assessRequestPreflight({
    defaults: {
      apiMode: 'responses',
      apiBaseUrl: 'https://api.openai.com',
      storeResponses: true,
      webSearch: true,
      webSearchReturnTokenBudget: 'unlimited',
      imageGeneration: true,
      backgroundMode: true,
      serviceTier: 'priority',
    },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });

  assert.equal(result.status, 'confirm');
  assert.equal(result.confirmations.length, 5);
  assert.match(result.confirmations.join(' '), /Image generation/);
});

test('preflight blocks capability conflicts before send', () => {
  const fileSearch = assessRequestPreflight({
    defaults: { apiMode: 'responses', apiBaseUrl: 'https://api.openai.com', fileSearch: true },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });
  assert.equal(fileSearch.status, 'block');
  assert.match(fileSearch.blocks.join(' '), /vector store ID/);

  const requiredTool = assessRequestPreflight({
    defaults: { apiMode: 'responses', apiBaseUrl: 'https://api.openai.com', toolChoice: 'required' },
    model: 'gpt-5.5',
    locationLike: pagesLocation,
  });
  assert.equal(requiredTool.status, 'block');
  assert.match(requiredTool.blocks.join(' '), /no tools are enabled/);
});

test('normalizeBaseUrl trims trailing slashes and defaults to OpenAI', () => {
  assert.equal(normalizeBaseUrl('https://api.openai.com///'), 'https://api.openai.com');
  assert.equal(normalizeBaseUrl(''), 'https://api.openai.com');
});
