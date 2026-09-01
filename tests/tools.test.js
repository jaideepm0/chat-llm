import assert from 'node:assert/strict';
import test from 'node:test';

import { formatToolError, getLocalToolDefinitions, runLocalToolCall } from '../src/tools.js';

test('strict local tool schemas make optional values nullable and required', () => {
  const timeTool = getLocalToolDefinitions().find((tool) => tool.name === 'get_current_time');

  assert.equal(timeTool.strict, true);
  assert.deepEqual(timeTool.parameters.required, ['time_zone']);
  assert.deepEqual(timeTool.parameters.properties.time_zone.type, ['string', 'null']);
});

test('local tools reject oversized arguments and invalid JSON', async () => {
  await assert.rejects(
    () => runLocalToolCall({ name: 'get_current_time', argumentsJson: 'x'.repeat(4097) }),
    { code: 'arguments_too_large' },
  );

  await assert.rejects(
    () => runLocalToolCall({ name: 'get_current_time', argumentsJson: '{bad json' }),
    { code: 'invalid_json' },
  );
});

test('local tools enforce per-tool argument limits', async () => {
  await assert.rejects(
    () => runLocalToolCall({
      name: 'get_current_time',
      argumentsJson: JSON.stringify({ time_zone: 'A'.repeat(129) }),
    }),
    { code: 'arguments_too_large' },
  );
});

test('local tool outputs are capped and marked as truncated', async () => {
  const previous = globalThis.exprEval;
  globalThis.exprEval = {
    Parser: class Parser {
      evaluate() {
        return 'z'.repeat(9000);
      }
    },
  };

  try {
    const out = await runLocalToolCall({
      name: 'calculator',
      argumentsJson: JSON.stringify({ expression: '1 + 1' }),
    });
    assert.ok(out.length < 8100);
    assert.match(out, /\[Tool output truncated\]/);
  } finally {
    globalThis.exprEval = previous;
  }
});

test('tool errors are returned as structured JSON payloads', () => {
  const formatted = JSON.parse(formatToolError(Object.assign(new Error('Nope'), { code: 'invalid_arguments' })));
  assert.deepEqual(formatted, {
    error: {
      code: 'invalid_arguments',
      message: 'Nope',
    },
  });
});
