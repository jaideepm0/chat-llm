import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResponsesBody, extractTextAndAnnotationsFromResponse } from '../src/api.js';

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

test('buildResponsesBody only serializes previous_response_id when one is provided', () => {
  const stateless = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Replay local history.',
    store: false,
    previousResponseId: null,
  });
  assert.equal('previous_response_id' in stateless, false);

  const stateful = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Continue stored chain.',
    store: true,
    previousResponseId: 'resp_123',
  });
  assert.equal(stateful.previous_response_id, 'resp_123');
});

test('buildResponsesBody never includes API keys in request payloads', () => {
  const body = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Hello',
    store: false,
    apiKey: 'sk-should-not-serialize',
  });
  assert.doesNotMatch(JSON.stringify(body), /sk-should-not-serialize/);
});

test('buildResponsesBody supports multimodal input plus current built-in tools', () => {
  const body = buildResponsesBody({
    model: 'gpt-5.5',
    input: 'Use the attached product notes and image.',
    inputAttachments: [
      { type: 'input_image', image_url: 'https://example.com/screen.png', detail: 'high' },
      { type: 'input_file', file_url: 'https://example.com/brief.pdf' },
    ],
    fileSearch: true,
    fileSearchVectorStoreIds: 'vs_docs, vs_api',
    fileSearchMaxResults: 7,
    includeFileSearchResults: true,
    imageGeneration: true,
    imageGenerationAction: 'auto',
    imageGenerationSize: '1024x1024',
    imageGenerationQuality: 'medium',
    imageGenerationPartialImages: 2,
    toolChoice: 'required',
    parallelToolCalls: false,
    background: true,
    serviceTier: 'flex',
    store: true,
  });

  assert.deepEqual(body.input, [{
    role: 'user',
    content: [
      { type: 'input_text', text: 'Use the attached product notes and image.' },
      { type: 'input_image', image_url: 'https://example.com/screen.png', detail: 'high' },
      { type: 'input_file', file_url: 'https://example.com/brief.pdf' },
    ],
  }]);
  assert.equal(body.tool_choice, 'required');
  assert.equal(body.parallel_tool_calls, false);
  assert.equal(body.background, true);
  assert.equal(body.service_tier, 'flex');
  assert.deepEqual(body.include, ['file_search_call.results']);
  assert.deepEqual(body.tools, [
    { type: 'file_search', vector_store_ids: ['vs_docs', 'vs_api'], max_num_results: 7 },
    {
      type: 'image_generation',
      action: 'auto',
      size: '1024x1024',
      quality: 'medium',
      partial_images: 2,
    },
  ]);
});

test('extractTextAndAnnotationsFromResponse returns generated image artifacts', () => {
  const out = extractTextAndAnnotationsFromResponse({
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Generated a concept.' }],
      },
      {
        type: 'image_generation_call',
        result: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        revised_prompt: 'A compact UI concept',
      },
    ],
  });

  assert.equal(out.outputText, 'Generated a concept.');
  assert.deepEqual(out.artifacts, [{
    type: 'image',
    mimeType: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    revisedPrompt: 'A compact UI concept',
  }]);
});
