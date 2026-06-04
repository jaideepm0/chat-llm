import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalToolDefinitions } from '../src/tools.js';

test('strict local tool schemas make optional values nullable and required', () => {
  const timeTool = getLocalToolDefinitions().find((tool) => tool.name === 'get_current_time');

  assert.equal(timeTool.strict, true);
  assert.deepEqual(timeTool.parameters.required, ['time_zone']);
  assert.deepEqual(timeTool.parameters.properties.time_zone.type, ['string', 'null']);
});
