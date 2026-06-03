export function safeStorage(getter) {
  try {
    const storage = getter();
    const testKey = '__chat_llm_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

export const local = safeStorage(() => window.localStorage);
export const session = safeStorage(() => window.sessionStorage);

export function readJSON(storage, key, fallback = null) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
