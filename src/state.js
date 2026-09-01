import { local, readJSON, writeJSON } from './storage.js';
import { createId, nowMs } from './utils.js';
import { DEFAULT_MODEL } from './models.js';

const STORE_KEY = 'chat_llm_store_v5';
const LEGACY_STORE_KEY = 'chat_llm_store_v4';
const LEGACY_KEY = 'chat_llm_state_v3';

const MAX_MESSAGES_PER_CHAT = 400;
const MAX_PINNED = 3;
export const MAX_MESSAGE_CONTENT_CHARS = 120_000;
export const MAX_REASONING_SUMMARY_CHARS = 20_000;
export const MAX_ARTIFACT_DATA_CHARS = 1_500_000;
export const MAX_TRACE_ITEMS_PER_MESSAGE = 40;
const MAX_TRACE_DETAIL_CHARS = 1_000;
const REASONING_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
const REASONING_SUMMARIES = new Set(['none', 'auto', 'concise', 'detailed']);
const TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);
const TRUNCATION_MODES = new Set(['disabled', 'auto']);
const CACHE_RETENTIONS = new Set(['', 'in_memory', '24h']);
const SEARCH_CONTEXT_SIZES = new Set(['low', 'medium', 'high']);
const SEARCH_TOKEN_BUDGETS = new Set(['default', 'unlimited']);
const API_MODES = new Set(['responses']);
const TOOL_CHOICES = new Set(['auto', 'required', 'none']);
const SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'priority']);
const IMAGE_ACTIONS = new Set(['auto', 'generate', 'edit']);
const IMAGE_SIZES = new Set(['auto', '1024x1024', '1024x1536', '1536x1024']);
const IMAGE_QUALITIES = new Set(['auto', 'low', 'medium', 'high']);
const KEY_PERSISTENCE_MODES = new Set(['memory', 'session']);

function blankDefaults() {
  return {
    model: DEFAULT_MODEL,
    temperature: 1.0,
    topP: 0,
    maxOutputTokens: 0,
    reasoningEffort: 'medium',
    reasoningSummary: 'auto',
    textVerbosity: 'medium',
    truncation: 'disabled',
    promptCacheKey: '',
    promptCacheRetention: '',
    safetyIdentifier: '',
    maxToolCalls: 0,
    apiMode: 'responses',
    toolChoice: 'auto',
    parallelToolCalls: true,
    backgroundMode: false,
    serviceTier: 'auto',
    webSearch: false,
    webSearchAllowedDomains: '',
    webSearchBlockedDomains: '',
    webSearchContextSize: 'medium',
    webSearchExternalAccess: true,
    webSearchReturnTokenBudget: 'default',
    fileSearch: false,
    fileSearchVectorStoreIds: '',
    fileSearchMaxResults: 0,
    includeFileSearchResults: false,
    imageGeneration: false,
    imageGenerationAction: 'auto',
    imageGenerationSize: 'auto',
    imageGenerationQuality: 'auto',
    imageGenerationPartialImages: 0,
    inputImageUrls: '',
    inputFileUrls: '',
    localTools: false,
    storeResponses: false,
    keyPersistence: 'memory',
    apiBaseUrl: 'https://api.openai.com',
  };
}

function blankStore() {
  return {
    version: 5,
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

function capString(v, maxChars, fallback = '') {
  const s = sanitizeString(v, fallback);
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

function sanitizeBool(v, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

function sanitizeChoice(v, fallback, allowed) {
  const next = sanitizeString(v, fallback).trim();
  return allowed.has(next) ? next : fallback;
}

function sanitizeNumber(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function sanitizeDefaults(d) {
  const out = blankDefaults();
  if (!d || typeof d !== 'object') return out;

  out.model = sanitizeString(d.model, out.model) || out.model;
  out.temperature = Math.min(2, Math.max(0, sanitizeNumber(d.temperature, out.temperature)));
  out.topP = Math.min(1, Math.max(0, sanitizeNumber(d.topP, out.topP)));
  out.maxOutputTokens = Math.max(0, sanitizeNumber(d.maxOutputTokens, out.maxOutputTokens));
  out.reasoningEffort = sanitizeChoice(d.reasoningEffort, out.reasoningEffort, REASONING_EFFORTS);
  out.reasoningSummary = sanitizeChoice(d.reasoningSummary, out.reasoningSummary, REASONING_SUMMARIES);
  out.textVerbosity = sanitizeChoice(d.textVerbosity, out.textVerbosity, TEXT_VERBOSITIES);
  out.truncation = sanitizeChoice(d.truncation, out.truncation, TRUNCATION_MODES);
  out.promptCacheKey = sanitizeString(d.promptCacheKey, out.promptCacheKey).trim().slice(0, 64);
  out.promptCacheRetention = sanitizeChoice(d.promptCacheRetention, out.promptCacheRetention, CACHE_RETENTIONS);
  out.safetyIdentifier = sanitizeString(d.safetyIdentifier, out.safetyIdentifier).trim().slice(0, 64);
  out.maxToolCalls = Math.max(0, Math.floor(sanitizeNumber(d.maxToolCalls, out.maxToolCalls)));
  out.apiMode = sanitizeChoice(d.apiMode, out.apiMode, API_MODES);
  out.toolChoice = sanitizeChoice(d.toolChoice, out.toolChoice, TOOL_CHOICES);
  out.parallelToolCalls = sanitizeBool(d.parallelToolCalls, out.parallelToolCalls);
  out.backgroundMode = sanitizeBool(d.backgroundMode, out.backgroundMode);
  out.serviceTier = sanitizeChoice(d.serviceTier, out.serviceTier, SERVICE_TIERS);
  out.webSearch = sanitizeBool(d.webSearch, out.webSearch);
  out.webSearchAllowedDomains = sanitizeString(d.webSearchAllowedDomains, out.webSearchAllowedDomains);
  out.webSearchBlockedDomains = sanitizeString(d.webSearchBlockedDomains, out.webSearchBlockedDomains);
  out.webSearchContextSize = sanitizeChoice(d.webSearchContextSize, out.webSearchContextSize, SEARCH_CONTEXT_SIZES);
  out.webSearchExternalAccess = sanitizeBool(d.webSearchExternalAccess, out.webSearchExternalAccess);
  out.webSearchReturnTokenBudget = sanitizeChoice(d.webSearchReturnTokenBudget, out.webSearchReturnTokenBudget, SEARCH_TOKEN_BUDGETS);
  out.fileSearch = sanitizeBool(d.fileSearch, out.fileSearch);
  out.fileSearchVectorStoreIds = sanitizeString(d.fileSearchVectorStoreIds, out.fileSearchVectorStoreIds);
  out.fileSearchMaxResults = Math.max(0, Math.floor(sanitizeNumber(d.fileSearchMaxResults, out.fileSearchMaxResults)));
  out.includeFileSearchResults = sanitizeBool(d.includeFileSearchResults, out.includeFileSearchResults);
  out.imageGeneration = sanitizeBool(d.imageGeneration, out.imageGeneration);
  out.imageGenerationAction = sanitizeChoice(d.imageGenerationAction, out.imageGenerationAction, IMAGE_ACTIONS);
  out.imageGenerationSize = sanitizeChoice(d.imageGenerationSize, out.imageGenerationSize, IMAGE_SIZES);
  out.imageGenerationQuality = sanitizeChoice(d.imageGenerationQuality, out.imageGenerationQuality, IMAGE_QUALITIES);
  out.imageGenerationPartialImages = Math.max(0, Math.min(3, Math.floor(sanitizeNumber(d.imageGenerationPartialImages, out.imageGenerationPartialImages))));
  out.inputImageUrls = sanitizeString(d.inputImageUrls, out.inputImageUrls);
  out.inputFileUrls = sanitizeString(d.inputFileUrls, out.inputFileUrls);
  out.localTools = sanitizeBool(d.localTools, out.localTools);
  out.storeResponses = sanitizeBool(d.storeResponses, out.storeResponses);
  out.keyPersistence = sanitizeChoice(d.keyPersistence, out.keyPersistence, KEY_PERSISTENCE_MODES);
  out.apiBaseUrl = sanitizeString(d.apiBaseUrl, out.apiBaseUrl) || out.apiBaseUrl;
  return out;
}

function sanitizeArtifacts(list, { persistSafe = true } = {}) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    if (sanitizeString(item.type, '') !== 'image') continue;
    const data = sanitizeString(item.data, '').trim();
    const omitted = sanitizeBool(item.omitted, false);
    if (!data && !omitted) continue;
    const tooLarge = persistSafe && data.length > MAX_ARTIFACT_DATA_CHARS;
    out.push({
      type: 'image',
      mimeType: sanitizeString(item.mimeType, 'image/png') || 'image/png',
      data: tooLarge ? '' : data,
      omitted: tooLarge || omitted || undefined,
      originalBytes: tooLarge ? data.length : sanitizeNumber(item.originalBytes, 0) || undefined,
      revisedPrompt: capString(item.revisedPrompt, 2_000) || undefined,
    });
  }
  return out.slice(0, 20);
}

function sanitizeTrace(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    out.push({
      type: capString(item.type, 64),
      label: capString(item.label, 96),
      status: capString(item.status, 32),
      detail: capString(item.detail, MAX_TRACE_DETAIL_CHARS),
      createdAt: sanitizeNumber(item.createdAt, nowMs()),
    });
  }
  return out.slice(-MAX_TRACE_ITEMS_PER_MESSAGE);
}

function sanitizeMessages(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const role = sanitizeString(m.role, '').trim();
    const content = capString(m.content, MAX_MESSAGE_CONTENT_CHARS);
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
      artifacts: sanitizeArtifacts(m.artifacts),
      reasoningSummary: capString(m.reasoningSummary, MAX_REASONING_SUMMARY_CHARS) || undefined,
      trace: sanitizeTrace(m.trace),
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
  const saved = readJSON(local, STORE_KEY, null) || readJSON(local, LEGACY_STORE_KEY, null);
  if (!saved) {
    Object.assign(store, blankStore());
    if (migrateLegacyIfNeeded()) return;
    ensureActiveChat();
    persist();
    return;
  }

  Object.assign(store, blankStore());
  const defaults = sanitizeDefaults(saved?.defaults);
  store.defaults = defaults;
  store.accountModels = Array.isArray(saved?.accountModels) ? saved.accountModels.filter((x) => typeof x === 'string') : [];
  store.chats = sanitizeChats(saved?.chats, defaults);
  store.activeChatId = sanitizeString(saved?.activeChatId, '') || null;

  ensureActiveChat();
  if (saved?.version !== store.version) persist();
}

export function persist() {
  return writeJSON(local, STORE_KEY, {
    version: store.version,
    activeChatId: store.activeChatId,
    defaults: store.defaults,
    chats: store.chats,
    accountModels: store.accountModels,
  });
}

export function resetStore() {
  Object.assign(store, blankStore());
  ensureActiveChat();
  try {
    local?.removeItem(STORE_KEY);
    local?.removeItem(LEGACY_STORE_KEY);
    local?.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  persist();
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
    content: capString(content, MAX_MESSAGE_CONTENT_CHARS),
    createdAt: sanitizeNumber(message?.createdAt, nowMs()),
    model: sanitizeString(message?.model, '') || undefined,
    responseId: sanitizeString(message?.responseId, '') || undefined,
    usage: message?.usage && typeof message.usage === 'object' ? message.usage : undefined,
    annotations: Array.isArray(message?.annotations) ? message.annotations : undefined,
    artifacts: sanitizeArtifacts(message?.artifacts),
    reasoningSummary: capString(message?.reasoningSummary, MAX_REASONING_SUMMARY_CHARS) || undefined,
    trace: sanitizeTrace(message?.trace),
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
  const next = patch || {};
  Object.assign(msg, {
    ...next,
    content: typeof next.content === 'string' ? capString(next.content, MAX_MESSAGE_CONTENT_CHARS) : msg.content,
    reasoningSummary: typeof next.reasoningSummary === 'string' ? capString(next.reasoningSummary, MAX_REASONING_SUMMARY_CHARS) : msg.reasoningSummary,
    artifacts: Array.isArray(next.artifacts) ? sanitizeArtifacts(next.artifacts) : msg.artifacts,
    trace: Array.isArray(next.trace) ? sanitizeTrace(next.trace) : msg.trace,
  });
  if (msg.role === 'assistant' && store.defaults.storeResponses && typeof msg.responseId === 'string' && msg.responseId.startsWith('resp_')) {
    chat.previousResponseId = msg.responseId;
  } else if (msg.role === 'assistant') {
    chat.previousResponseId = null;
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
