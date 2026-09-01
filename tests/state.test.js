import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_ARTIFACT_DATA_CHARS,
  MAX_MESSAGE_CONTENT_CHARS,
  addMessage,
  getActiveChat,
  load,
  patchDefaults,
  resetStore,
  store,
  updateMessage,
} from '../src/state.js';

test('defaults persist current API surface controls', () => {
  load();
  patchDefaults({
    apiMode: 'responses',
    toolChoice: 'required',
    parallelToolCalls: false,
    backgroundMode: true,
    serviceTier: 'flex',
    fileSearch: true,
    fileSearchVectorStoreIds: 'vs_docs, vs_api',
    fileSearchMaxResults: 9,
    includeFileSearchResults: true,
    imageGeneration: true,
    imageGenerationAction: 'edit',
    imageGenerationSize: '1536x1024',
    imageGenerationQuality: 'high',
    imageGenerationPartialImages: 3,
    inputImageUrls: 'https://example.com/a.png',
    inputFileUrls: 'https://example.com/a.pdf',
    keyPersistence: 'session',
  });

  assert.equal(store.defaults.apiMode, 'responses');
  assert.equal(store.defaults.toolChoice, 'required');
  assert.equal(store.defaults.parallelToolCalls, false);
  assert.equal(store.defaults.backgroundMode, true);
  assert.equal(store.defaults.serviceTier, 'flex');
  assert.equal(store.defaults.fileSearch, true);
  assert.equal(store.defaults.fileSearchVectorStoreIds, 'vs_docs, vs_api');
  assert.equal(store.defaults.fileSearchMaxResults, 9);
  assert.equal(store.defaults.includeFileSearchResults, true);
  assert.equal(store.defaults.imageGeneration, true);
  assert.equal(store.defaults.imageGenerationAction, 'edit');
  assert.equal(store.defaults.imageGenerationSize, '1536x1024');
  assert.equal(store.defaults.imageGenerationQuality, 'high');
  assert.equal(store.defaults.imageGenerationPartialImages, 3);
  assert.equal(store.defaults.inputImageUrls, 'https://example.com/a.png');
  assert.equal(store.defaults.inputFileUrls, 'https://example.com/a.pdf');
  assert.equal(store.defaults.keyPersistence, 'session');
});

test('load resets defaults when no saved store exists', () => {
  patchDefaults({
    fileSearch: true,
    fileSearchVectorStoreIds: 'vs_stale',
    imageGeneration: true,
    inputImageUrls: 'https://example.com/stale.png',
  });

  load();

  assert.equal(store.defaults.fileSearch, false);
  assert.equal(store.defaults.fileSearchVectorStoreIds, '');
  assert.equal(store.defaults.imageGeneration, false);
  assert.equal(store.defaults.inputImageUrls, '');
  assert.equal(store.defaults.keyPersistence, 'memory');
  assert.equal(store.version, 5);
});

test('assistant response chains are cleared when stored responses are disabled or missing ids', () => {
  resetStore();
  patchDefaults({ storeResponses: true });
  const chat = getActiveChat();

  const first = addMessage(chat.id, { role: 'assistant', content: 'stored' });
  updateMessage(chat.id, first.id, { responseId: 'resp_123', content: 'stored' });
  assert.equal(chat.previousResponseId, 'resp_123');

  patchDefaults({ storeResponses: false });
  const second = addMessage(chat.id, { role: 'assistant', content: 'local only' });
  updateMessage(chat.id, second.id, { content: 'local only' });
  assert.equal(chat.previousResponseId, null);
});

test('persisted messages cap content and omit oversized image payloads', () => {
  resetStore();
  const chat = getActiveChat();
  const data = 'a'.repeat(MAX_ARTIFACT_DATA_CHARS + 1);
  const message = addMessage(chat.id, {
    role: 'assistant',
    content: 'x'.repeat(MAX_MESSAGE_CONTENT_CHARS + 1),
    artifacts: [{ type: 'image', mimeType: 'image/png', data }],
  });

  assert.equal(message.content.length, MAX_MESSAGE_CONTENT_CHARS);
  assert.equal(message.artifacts.length, 1);
  assert.equal(message.artifacts[0].data, '');
  assert.equal(message.artifacts[0].omitted, true);
  assert.equal(message.artifacts[0].originalBytes, data.length);
});
