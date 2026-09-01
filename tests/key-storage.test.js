import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('API key custody is memory-only unless session persistence is explicit', () => {
  const code = `
    import assert from 'node:assert/strict';
    import { pathToFileURL } from 'node:url';

    function makeStorage() {
      const map = new Map();
      return {
        failWrites: false,
        getItem: (key) => map.has(key) ? map.get(key) : null,
        setItem(key, value) {
          if (this.failWrites) throw new Error('quota');
          map.set(key, String(value));
        },
        removeItem: (key) => map.delete(key),
        clear: () => map.clear(),
      };
    }

    let storageWarning = '';
    const sessionStorage = makeStorage();
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    globalThis.window = {
      localStorage: makeStorage(),
      sessionStorage,
      dispatchEvent(event) {
        storageWarning = event.type;
      },
    };

    const api = await import(new URL('./src/api.js', pathToFileURL(process.cwd() + '/')).href);
    api.setApiKey('sk-memory');
    assert.equal(api.getApiKey(), 'sk-memory');
    assert.equal(sessionStorage.getItem('chat_llm_api_key_v1'), null);

    api.setApiKey('sk-session', { persistence: 'session' });
    assert.equal(api.getApiKeyPersistence(), 'session');
    assert.equal(sessionStorage.getItem('chat_llm_api_key_v1'), 'sk-session');

    api.setApiKeyPersistence('memory');
    assert.equal(api.getApiKeyPersistence(), 'memory');
    assert.equal(api.getApiKey(), 'sk-session');
    assert.equal(sessionStorage.getItem('chat_llm_api_key_v1'), null);

    api.setApiKeyPersistence('session');
    sessionStorage.failWrites = true;
    api.setApiKey('sk-quota-fallback', { persistence: 'session' });
    assert.equal(api.getApiKey(), 'sk-quota-fallback');
    assert.equal(storageWarning, 'chat-llm-storage-error');

    api.clearApiKey();
    assert.equal(api.getApiKey(), '');
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
