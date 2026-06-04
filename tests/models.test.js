import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_MODEL, MODEL_CATALOG, getModelInfo } from '../src/models.js';

test('catalog contains current GPT-5.5 and GPT-5.4 standard pricing', () => {
  assert.deepEqual(getModelInfo('gpt-5.5')?.pricing, { in: 5, cached: 0.5, out: 30 });
  assert.deepEqual(getModelInfo('gpt-5.5-pro')?.pricing, { in: 30, cached: null, out: 180 });
  assert.deepEqual(getModelInfo('gpt-5.4-mini')?.pricing, { in: 0.75, cached: 0.075, out: 4.5 });
});

test('default model is present in the visible catalog', () => {
  assert.ok(getModelInfo(DEFAULT_MODEL), `DEFAULT_MODEL ${DEFAULT_MODEL} must be in MODEL_CATALOG`);
});

test('legacy search preview models are marked deprecated', () => {
  const deprecated = MODEL_CATALOG
    .flatMap((group) => group.models)
    .filter((model) => model.id.includes('search-preview'));

  assert.ok(deprecated.length > 0);
  assert.ok(deprecated.every((model) => model.deprecated));
});
