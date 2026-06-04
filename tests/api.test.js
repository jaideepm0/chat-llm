import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResponsesBody } from '../src/api.js';

test('buildResponsesBody includes current Responses API controls', () => {
  const body = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Plan the migration.',
    temperature: 0,
    maxOutputTokens: 1200,
    reasoningEffort: 'xhigh',
    reasoningSummary: 'auto',
    textVerbosity: 'low',
    promptCacheKey: 'chat-llm-default',
    promptCacheRetention: '24h',
    truncation: 'auto',
    safetyIdentifier: 'anon-user-hash',
    maxToolCalls: 8,
    store: false,
    includeEncryptedReasoning: true,
    webSearch: true,
    webSearchAllowedDomains: 'openai.com https://docs.github.com/path',
    webSearchBlockedDomains: 'example.com',
    webSearchContextSize: 'high',
    webSearchExternalAccess: false,
    webSearchReturnTokenBudget: 'unlimited',
  });

  assert.equal(body.temperature, 0);
  assert.equal(body.max_output_tokens, 1200);
  assert.deepEqual(body.reasoning, { effort: 'xhigh', summary: 'auto' });
  assert.deepEqual(body.text, { verbosity: 'low' });
  assert.equal(body.prompt_cache_key, 'chat-llm-default');
  assert.equal(body.prompt_cache_retention, '24h');
  assert.equal(body.truncation, 'auto');
  assert.equal(body.safety_identifier, 'anon-user-hash');
  assert.equal(body.max_tool_calls, 8);
  assert.deepEqual(body.include.sort(), [
    'reasoning.encrypted_content',
    'web_search_call.action.sources',
  ].sort());
  assert.deepEqual(body.tools, [{
    type: 'web_search',
    filters: {
      allowed_domains: ['openai.com', 'docs.github.com'],
      blocked_domains: ['example.com'],
    },
    search_context_size: 'high',
    external_web_access: false,
    return_token_budget: 'unlimited',
  }]);
});

test('buildResponsesBody omits invalid optional knobs instead of serializing NaN or empty values', () => {
  const body = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Hello',
    temperature: 'bad',
    maxOutputTokens: 0,
    textVerbosity: 'invalid',
    promptCacheRetention: 'forever',
    truncation: 'sideways',
    maxToolCalls: -1,
    store: false,
  });

  assert.equal('temperature' in body, false);
  assert.equal('max_output_tokens' in body, false);
  assert.equal('text' in body, false);
  assert.equal('prompt_cache_retention' in body, false);
  assert.equal('truncation' in body, false);
  assert.equal('max_tool_calls' in body, false);
});
