import { local, readJSON, writeJSON } from './storage.js';
import { createId, nowMs } from './utils.js';
import { DEFAULT_MODEL } from './models.js';

const STORE_KEY = 'chat_llm_store_v4';
const LEGACY_KEY = 'chat_llm_state_v3';

const MAX_MESSAGES_PER_CHAT = 400;
const MAX_PINNED = 3;

function blankDefaults() {
  return {
    model: DEFAULT_MODEL,
    temperature: 1.0,
    maxOutputTokens: 0,
    reasoningEffort: 'medium',
    reasoningSummary: 'auto',
    webSearch: false,
    webSearchAllowedDomains: '',
    localTools: false,
    storeResponses: false,
    apiBaseUrl: 'https://api.openai.com',
  };
}

function blankStore() {
  return {
    version: 4,
    activeChatId: null,
    chats: [],
    defaults: blankDefaults(),
    accountModels: [],
  };
}

export const store = blankStore();

function sanitizeString(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

function sanitizeBool(v, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

function sanitizeNumber(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function sanitizeDefaults(d) {
  const out = blankDefaults();
  if (!d || typeof d !== 'object') return out;

  out.model = sanitizeString(d.model, out.model) || out.model;
  out.temperature = sanitizeNumber(d.temperature, out.temperature);
  out.maxOutputTokens = Math.max(0, sanitizeNumber(d.maxOutputTokens, out.maxOutputTokens));
  out.reasoningEffort = sanitizeString(d.reasoningEffort, out.reasoningEffort) || out.reasoningEffort;
  out.reasoningSummary = sanitizeString(d.reasoningSummary, out.reasoningSummary) || out.reasoningSummary;
  out.webSearch = sanitizeBool(d.webSearch, out.webSearch);
  out.webSearchAllowedDomains = sanitizeString(d.webSearchAllowedDomains, out.webSearchAllowedDomains);
  out.localTools = sanitizeBool(d.localTools, out.localTools);
  out.storeResponses = sanitizeBool(d.storeResponses, out.storeResponses);
  out.apiBaseUrl = sanitizeString(d.apiBaseUrl, out.apiBaseUrl) || out.apiBaseUrl;
  return out;
}

function sanitizeMessages(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const role = sanitizeString(m.role, '').trim();
    const content = sanitizeString(m.content, '');
    if (!role) continue;
    out.push({
      id: sanitizeString(m.id, '') || createId('msg'),
      role,
      content,
      createdAt: sanitizeNumber(m.createdAt, nowMs()),
      model: sanitizeString(m.model, '') || undefined,
      responseId: sanitizeString(m.responseId, '') || undefined,
      usage: m.usage && typeof m.usage === 'object' ? m.usage : undefined,
      annotations: Array.isArray(m.annotations) ? m.annotations : undefined,
      reasoningSummary: sanitizeString(m.reasoningSummary, '') || undefined,
    });
  }
  return out.slice(-MAX_MESSAGES_PER_CHAT);
}

function sanitizeChats(list, defaults) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const id = sanitizeString(c.id, '') || createId('chat');
    const title = sanitizeString(c.title, 'New chat') || 'New chat';
    const createdAt = sanitizeNumber(c.createdAt, nowMs());
    const updatedAt = sanitizeNumber(c.updatedAt, createdAt);
    const pinned = sanitizeBool(c.pinned, false);
    const model = sanitizeString(c.model, defaults.model) || defaults.model;
    const instructions = sanitizeString(c.instructions, '');
    const previousResponseId = sanitizeString(c.previousResponseId, '') || null;
    const messages = sanitizeMessages(c.messages);
    out.push({ id, title, createdAt, updatedAt, pinned, model, instructions, previousResponseId, messages });
  }
  return out;
}

function ensureActiveChat() {
  if (!store.chats.length) {
    const chat = createChat({ title: 'New chat' }, { persist: false });
    store.activeChatId = chat.id;
    return;
  }

  const found = store.chats.some((c) => c.id === store.activeChatId);
  if (!found) store.activeChatId = store.chats[0].id;
}

function migrateLegacyIfNeeded() {
  const legacy = readJSON(local, LEGACY_KEY, null);
  if (!legacy) return false;
  const defaults = sanitizeDefaults(legacy?.settings);

  const chat = {
    id: createId('chat'),
    title: 'Imported chat',
    createdAt: nowMs(),
    updatedAt: nowMs(),
    pinned: false,
    model: defaults.model,
    instructions: sanitizeString(legacy?.settings?.instructions, ''),
    previousResponseId: null,
    messages: Array.isArray(legacy?.history)
      ? legacy.history.map((m) => ({
        id: createId('msg'),
        role: sanitizeString(m?.role, ''),
        content: sanitizeString(m?.content, ''),
        createdAt: nowMs(),
      })).filter((m) => m.role)
      : [],
  };

  Object.assign(store, blankStore());
  store.defaults = defaults;
  store.accountModels = Array.isArray(legacy?.accountModels) ? legacy.accountModels.filter((x) => typeof x === 'string') : [];
  store.chats = [chat];
  store.activeChatId = chat.id;
  try {
    local?.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  persist();
  return true;
}

export function load() {
  const saved = readJSON(local, STORE_KEY, null);
  if (!saved) {
    migrateLegacyIfNeeded();
    ensureActiveChat();
    persist();
    return;
  }

  const defaults = sanitizeDefaults(saved?.defaults);
  store.defaults = defaults;
  store.accountModels = Array.isArray(saved?.accountModels) ? saved.accountModels.filter((x) => typeof x === 'string') : [];
  store.chats = sanitizeChats(saved?.chats, defaults);
  store.activeChatId = sanitizeString(saved?.activeChatId, '') || null;

  ensureActiveChat();
}

export function persist() {
  writeJSON(local, STORE_KEY, {
    version: store.version,
    activeChatId: store.activeChatId,
    defaults: store.defaults,
    chats: store.chats,
    accountModels: store.accountModels,
  });
}

export function listChats({ query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const sorted = [...store.chats].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  if (!q) return sorted;
  return sorted.filter((c) => {
    if (c.title.toLowerCase().includes(q)) return true;
    return Array.isArray(c.messages) && c.messages.some((m) => String(m?.content || '').toLowerCase().includes(q));
  });
}

export function getActiveChat() {
  return store.chats.find((c) => c.id === store.activeChatId) || null;
}

export function setActiveChat(chatId) {
  const id = String(chatId || '').trim();
  if (!id) return;
  const exists = store.chats.some((c) => c.id === id);
  if (!exists) return;
  store.activeChatId = id;
  persist();
}

export function createChat({ title, model } = {}, { persist: shouldPersist = true } = {}) {
  const chat = {
    id: createId('chat'),
    title: sanitizeString(title, 'New chat') || 'New chat',
    createdAt: nowMs(),
    updatedAt: nowMs(),
    pinned: false,
    model: sanitizeString(model, store.defaults.model) || store.defaults.model,
    instructions: '',
    previousResponseId: null,
    messages: [],
  };
  store.chats.unshift(chat);
  store.activeChatId = chat.id;
  if (shouldPersist) persist();
  return chat;
}

export function renameChat(chatId, title) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  const next = sanitizeString(title, '').trim();
  if (!next) return;
  chat.title = next;
  chat.updatedAt = nowMs();
  persist();
}

export function deleteChat(chatId) {
  const idx = store.chats.findIndex((c) => c.id === chatId);
  if (idx === -1) return;
  store.chats.splice(idx, 1);
  if (!store.chats.length) createChat({}, { persist: false });
  if (store.activeChatId === chatId) store.activeChatId = store.chats[0].id;
  persist();
}

export function togglePinChat(chatId) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  if (!chat.pinned) {
    const pinnedCount = store.chats.filter((c) => c.pinned).length;
    if (pinnedCount >= MAX_PINNED) return false;
  }
  chat.pinned = !chat.pinned;
  chat.updatedAt = nowMs();
  persist();
  return true;
}

export function setChatModel(chatId, model) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  const id = sanitizeString(model, '').trim();
  if (!id) return;
  chat.model = id;
  chat.updatedAt = nowMs();
  store.defaults.model = id;
  persist();
}

export function setChatInstructions(chatId, instructions) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.instructions = sanitizeString(instructions, '');
  chat.updatedAt = nowMs();
  persist();
}

export function setChatPreviousResponseId(chatId, previousResponseId) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  const next = sanitizeString(previousResponseId, '') || null;
  chat.previousResponseId = next;
  chat.updatedAt = nowMs();
  persist();
}

export function patchDefaults(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(store.defaults, sanitizeDefaults({ ...store.defaults, ...patch }));
  persist();
}

export function clearChatMessages(chatId) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.messages = [];
  chat.previousResponseId = null;
  chat.updatedAt = nowMs();
  persist();
}

export function addMessage(chatId, message) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return null;
  const role = sanitizeString(message?.role, '').trim();
  const content = sanitizeString(message?.content, '');
  if (!role) return null;

  const msg = {
    id: sanitizeString(message?.id, '') || createId('msg'),
    role,
    content,
    createdAt: sanitizeNumber(message?.createdAt, nowMs()),
    model: sanitizeString(message?.model, '') || undefined,
    responseId: sanitizeString(message?.responseId, '') || undefined,
    usage: message?.usage && typeof message.usage === 'object' ? message.usage : undefined,
    annotations: Array.isArray(message?.annotations) ? message.annotations : undefined,
    reasoningSummary: sanitizeString(message?.reasoningSummary, '') || undefined,
  };

  chat.messages.push(msg);
  if (chat.messages.length > MAX_MESSAGES_PER_CHAT) chat.messages = chat.messages.slice(-MAX_MESSAGES_PER_CHAT);
  chat.updatedAt = nowMs();
  persist();
  return msg;
}

export function updateMessage(chatId, messageId, patch) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return null;
  const msg = chat.messages.find((m) => m.id === messageId);
  if (!msg) return null;
  Object.assign(msg, patch || {});
  if (msg.role === 'assistant' && typeof msg.responseId === 'string' && msg.responseId.startsWith('resp_')) {
    chat.previousResponseId = msg.responseId;
  }
  chat.updatedAt = nowMs();
  persist();
  return msg;
}

export function truncateAfterMessage(chatId, messageId) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return false;
  const idx = chat.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return false;
  chat.messages = chat.messages.slice(0, idx + 1);
  const lastAssistant = [...chat.messages].reverse().find((m) => m.role === 'assistant' && typeof m.responseId === 'string');
  chat.previousResponseId = lastAssistant?.responseId || null;
  chat.updatedAt = nowMs();
  persist();
  return true;
}
