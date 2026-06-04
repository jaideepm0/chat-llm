import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMarkdown } from '../src/markdown.js';

test('renderMarkdown safely escapes when markdown libraries are unavailable', () => {
  globalThis.window = {};

  assert.equal(
    renderMarkdown('<img src=x onerror=alert(1)> **hello**'),
    '&lt;img src=x onerror=alert(1)&gt; **hello**',
  );
});
