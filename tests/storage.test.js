import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('writeJSON reports quota-style failures through a storage event', () => {
  const code = `
    import assert from 'node:assert/strict';
    import { pathToFileURL } from 'node:url';

    let eventType = '';
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    globalThis.window = {
      localStorage: null,
      sessionStorage: null,
      dispatchEvent(event) {
        eventType = event.type;
      },
    };

    const storage = await import(new URL('./src/storage.js', pathToFileURL(process.cwd() + '/')).href);
    const badStore = { setItem() { throw new Error('quota'); } };
    const ok = storage.writeJSON(badStore, 'x', { large: true });
    const okText = storage.writeText(badStore, 'theme', 'dark');

    assert.equal(ok, false);
    assert.equal(okText, false);
    assert.equal(eventType, 'chat-llm-storage-error');
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
