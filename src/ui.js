import { applyMarkdown, configureMarkdown, setPlainText } from './markdown.js';
import {
  addMessage,
  clearChatMessages,
  createChat,
  deleteChat,
  getActiveChat,
  listChats,
  load,
  patchDefaults,
  persist,
  renameChat,
  setActiveChat,
  setChatInstructions,
  setChatModel,
  setChatPreviousResponseId,
  store,
  togglePinChat,
  truncateAfterMessage,
  updateMessage,
} from './state.js';
import { DEFAULT_MODEL, MODEL_CATALOG, isReasoningModel, modelPricingLabel } from './models.js';
import {
  buildResponsesBody,
  estimateCostUSD,
  extractResponseId,
  extractTextAndAnnotationsFromResponse,
  fetchResponseById,
  getApiKey,
  injectCitationLinks,
  refreshAccountModels,
  setApiKey,
  streamResponses,
} from './api.js';
import { confirmDialog, toast } from './overlays.js';
import { debounce, escapeHtml, formatAgeShort, nowMs } from './utils.js';
import { local as localStorageSafe } from './storage.js';
import { getLocalToolDefinitions, runLocalToolCall } from './tools.js';

const THEME_KEY = 'chat_theme_preference';
const PRISM_LIGHT_ID = 'prism-light';
const PRISM_DARK_ID = 'prism-dark';
const COMPOSER_MAX_HEIGHT = 320;

const dom = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  sidebarOpen: document.getElementById('sidebar-open'),
  sidebarClose: document.getElementById('sidebar-close'),
  chatList: document.getElementById('chat-list'),
  chatSearch: document.getElementById('chat-search'),
  newChat: document.getElementById('new-chat'),
  newChatTop: document.getElementById('new-chat-top'),

  chatTitleButton: document.getElementById('chat-title-button'),
  chatTitleInput: document.getElementById('chat-title-input'),
  chatTitleMeta: document.getElementById('chat-title-meta'),
  navChatCount: document.getElementById('nav-chat-count'),
  navPinnedCount: document.getElementById('nav-pinned-count'),
  navLastUpdated: document.getElementById('nav-last-updated'),

  conversation: document.getElementById('conversation'),
  conversationInner: document.getElementById('conversation-inner'),
  messageTemplate: document.getElementById('message-template'),
  scrollBottom: document.getElementById('scroll-bottom'),

  composerForm: document.getElementById('composer-form'),
  userInput: document.getElementById('user-input'),
  sendButton: document.getElementById('send-button'),
  stopButton: document.getElementById('stop-button'),
  regenerateButton: document.getElementById('regenerate'),
  exportChatButton: document.getElementById('export-chat'),
  clearChatButton: document.getElementById('clear-chat'),

  themeToggle: document.getElementById('theme-toggle'),

  settingsOpenBtn: document.getElementById('settings-open'),
  settingsCloseBtn: document.getElementById('settings-close'),
  settingsDrawer: document.getElementById('settings-drawer'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  settingsForm: document.getElementById('settings-form'),
  apiKeyInput: document.getElementById('api-key'),
  apiBaseUrlInput: document.getElementById('api-base-url'),
  testConnectionBtn: document.getElementById('test-connection'),
  temperatureInput: document.getElementById('temperature'),
  topPInput: document.getElementById('top-p'),
  maxOutputTokensInput: document.getElementById('max-output-tokens'),
  reasoningEffortSelect: document.getElementById('reasoning-effort'),
  reasoningSummarySelect: document.getElementById('reasoning-summary'),
  textVerbositySelect: document.getElementById('text-verbosity'),
  truncationSelect: document.getElementById('truncation'),
  maxToolCallsInput: document.getElementById('max-tool-calls'),
  promptCacheKeyInput: document.getElementById('prompt-cache-key'),
  promptCacheRetentionSelect: document.getElementById('prompt-cache-retention'),
  safetyIdentifierInput: document.getElementById('safety-identifier'),
  webSearchCheckbox: document.getElementById('web-search'),
  webSearchDomainsInput: document.getElementById('web-search-domains'),
  webSearchBlockedDomainsInput: document.getElementById('web-search-blocked-domains'),
  webSearchContextSizeSelect: document.getElementById('web-search-context-size'),
  webSearchExternalAccessCheckbox: document.getElementById('web-search-live-access'),
  webSearchReturnTokenBudgetSelect: document.getElementById('web-search-return-token-budget'),
  localToolsCheckbox: document.getElementById('local-tools'),
  storeCheckbox: document.getElementById('store'),
  instructionsTextarea: document.getElementById('instructions'),

  modelPickerOpen: document.getElementById('model-picker-open'),
  activeModel: document.getElementById('active-model'),
  modelPickerBackdrop: document.getElementById('model-picker-backdrop'),
  modelPicker: document.getElementById('model-picker'),
  modelPickerClose: document.getElementById('model-picker-close'),
  modelSearch: document.getElementById('model-search'),
  modelList: document.getElementById('model-list'),
  modelsRefresh: document.getElementById('models-refresh'),
  modelCustomInput: document.getElementById('model-custom'),
  modelCustomApply: document.getElementById('model-custom-apply'),
  modeAuto: document.getElementById('mode-auto'),
  modeInstant: document.getElementById('mode-instant'),
  modeThinking: document.getElementById('mode-thinking'),

  commandOpen: document.getElementById('command-open'),
  commandBackdrop: document.getElementById('command-backdrop'),
  commandPalette: document.getElementById('command-palette'),
  commandClose: document.getElementById('command-close'),
  commandSearch: document.getElementById('command-search'),
  commandResults: document.getElementById('command-results'),

  brandCopy: document.querySelector('[data-copy="brand"]'),
  helperCopy: document.querySelector('[data-copy="helper"]'),
  composerHint: document.querySelector('[data-copy="composer"]'),

  railNewChat: document.getElementById('rail-new-chat'),
  railSearchOpen: document.getElementById('rail-search-open'),
  railModelOpen: document.getElementById('rail-model-open'),
  railSettingsOpen: document.getElementById('rail-settings-open'),
  workspaceModel: document.getElementById('workspace-model'),
  workspaceMode: document.getElementById('workspace-mode'),
  workspaceTools: document.getElementById('workspace-tools'),
  workspaceMessageCount: document.getElementById('workspace-message-count'),
  promptFillButtons: document.querySelectorAll('[data-prompt-fill]'),
  workspacePresetButtons: document.querySelectorAll('[data-workspace-preset]'),
  composerWebToggle: document.getElementById('composer-web-toggle'),
  composerToolsToggle: document.getElementById('composer-tools-toggle'),
  composerModeToggle: document.getElementById('composer-mode-toggle'),
  composerModelOpen: document.getElementById('composer-model-open'),
  toolCalcInput: document.getElementById('tool-calc-input'),
  toolCalcRun: document.getElementById('tool-calc-run'),
  toolCalcOutput: document.getElementById('tool-calc-output'),
  toolTimezoneInput: document.getElementById('tool-timezone-input'),
  toolTimezoneRun: document.getElementById('tool-timezone-run'),
  toolTimezoneOutput: document.getElementById('tool-timezone-output'),
  toolJsonInput: document.getElementById('tool-json-input'),
  toolJsonFormat: document.getElementById('tool-json-format'),
  toolJsonMinify: document.getElementById('tool-json-minify'),
  toolJsonCopy: document.getElementById('tool-json-copy'),
  toolJsonOutput: document.getElementById('tool-json-output'),
  toolTextInput: document.getElementById('tool-text-input'),
  toolTextWords: document.getElementById('tool-text-words'),
  toolTextChars: document.getElementById('tool-text-chars'),
  toolTextRead: document.getElementById('tool-text-read'),
};

const runtime = {
  isProcessing: false,
  abortController: null,
  emptyStateEl: null,
  selectedCommandIndex: 0,
  editingMessageId: null,
};

const WORKSPACE_PRESETS = {
  writing: {
    label: 'Writing',
    defaults: { webSearch: false, localTools: false, reasoningEffort: 'medium', reasoningSummary: 'auto' },
    instructions: 'Write clearly, tighten structure, and prefer concise polished output unless asked otherwise.',
  },
  coding: {
    label: 'Coding',
    defaults: { webSearch: false, localTools: true, reasoningEffort: 'high', reasoningSummary: 'concise' },
    instructions: 'Be precise and implementation-first. Prefer concrete fixes, edge cases, and minimal working examples.',
  },
  research: {
    label: 'Research',
    defaults: { webSearch: true, localTools: false, reasoningEffort: 'high', reasoningSummary: 'concise' },
    instructions: 'Ground answers in verifiable sources, compare options carefully, and call out uncertainty explicitly.',
  },
};

const defaultCopy = {
  brand: `**Chat LLM**`,
  helper: `_API key stays in this tab session. For production, use a backend proxy._`,
  composer: `_Enter to send • Shift+Enter for a new line • Use quick toggles for tools and mode_`,
  empty: `# Chat with OpenAI via the Responses API

- Start a **New chat**
- Choose a model (top right)
- Add your API key in **Settings**
- Apply a **workspace preset** for writing, coding, or research

Tips:
- Press **Ctrl+K** to search chats
- Turn on **Web search** for citations
- Use the right-side **Browser tools** to calculate, format JSON, and inspect text`,
};

let copyContent = { ...defaultCopy };

function parseCopySections(source) {
  const pattern = /\[(\w+)\]([\s\S]*?)\[\/\1\]/g;
  const sections = {};
  let match;
  while ((match = pattern.exec(source))) sections[match[1]] = match[2].trim();
  return sections;
}

async function loadCopy() {
  if (!window.fetch || window.location.protocol === 'file:') return;
  try {
    const response = await fetch('content.md', { cache: 'no-store' });
    if (!response.ok) return;
    const text = await response.text();
    const sections = parseCopySections(text);
    if (Object.keys(sections).length) copyContent = { ...copyContent, ...sections };
  } catch {
    // ignore
  }
}

function applyCopy() {
  if (dom.brandCopy) applyMarkdown(dom.brandCopy, copyContent.brand || defaultCopy.brand);
  if (dom.helperCopy) applyMarkdown(dom.helperCopy, copyContent.helper || defaultCopy.helper);
  if (dom.composerHint) applyMarkdown(dom.composerHint, copyContent.composer || defaultCopy.composer);
}

function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', normalized);
  localStorageSafe?.setItem(THEME_KEY, normalized);

  const light = document.getElementById(PRISM_LIGHT_ID);
  const dark = document.getElementById(PRISM_DARK_ID);
  if (light && dark) {
    if (normalized === 'dark') {
      light.setAttribute('disabled', '');
      dark.removeAttribute('disabled');
    } else {
      dark.setAttribute('disabled', '');
      light.removeAttribute('disabled');
    }
  }
}

function loadThemePreference() {
  const stored = localStorageSafe?.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') applyTheme(stored);
}

function updateOverlayLock() {
  const locked = Boolean(
    dom.sidebarBackdrop?.classList.contains('open')
    || dom.drawerBackdrop?.classList.contains('open')
    || dom.modelPickerBackdrop?.classList.contains('open')
    || dom.commandBackdrop?.classList.contains('open'),
  );
  document.body.classList.toggle('overlay-open', locked);
}

function openSidebar() {
  dom.sidebar?.classList.add('open');
  dom.sidebarBackdrop?.classList.add('open');
  if (dom.sidebarBackdrop) dom.sidebarBackdrop.hidden = false;
  dom.sidebar?.setAttribute('aria-hidden', 'false');
  updateOverlayLock();
}

function closeSidebar() {
  dom.sidebar?.classList.remove('open');
  dom.sidebarBackdrop?.classList.remove('open');
  if (dom.sidebarBackdrop) dom.sidebarBackdrop.hidden = true;
  dom.sidebar?.setAttribute('aria-hidden', 'true');
  updateOverlayLock();
}

function openSettingsDrawer() {
  dom.settingsDrawer?.classList.add('open');
  dom.drawerBackdrop?.classList.add('open');
  if (dom.drawerBackdrop) dom.drawerBackdrop.hidden = false;
  dom.settingsDrawer?.setAttribute('aria-hidden', 'false');
  dom.settingsOpenBtn?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => dom.apiKeyInput?.focus());
  updateOverlayLock();
}

function closeSettingsDrawer() {
  dom.settingsDrawer?.classList.remove('open');
  dom.drawerBackdrop?.classList.remove('open');
  if (dom.drawerBackdrop) dom.drawerBackdrop.hidden = true;
  dom.settingsDrawer?.setAttribute('aria-hidden', 'true');
  dom.settingsOpenBtn?.setAttribute('aria-expanded', 'false');
  if (!runtime.isProcessing) dom.userInput?.focus();
  updateOverlayLock();
}

function openModelPicker() {
  dom.modelPicker?.classList.add('open');
  dom.modelPickerBackdrop?.classList.add('open');
  if (dom.modelPickerBackdrop) dom.modelPickerBackdrop.hidden = false;
  dom.modelPicker?.setAttribute('aria-hidden', 'false');
  dom.modelPickerOpen?.setAttribute('aria-expanded', 'true');
  renderModelList();
  requestAnimationFrame(() => dom.modelSearch?.focus());
  updateOverlayLock();
}

function closeModelPicker() {
  dom.modelPicker?.classList.remove('open');
  dom.modelPickerBackdrop?.classList.remove('open');
  if (dom.modelPickerBackdrop) dom.modelPickerBackdrop.hidden = true;
  dom.modelPicker?.setAttribute('aria-hidden', 'true');
  dom.modelPickerOpen?.setAttribute('aria-expanded', 'false');
  updateOverlayLock();
}

function openCommandPalette() {
  dom.commandPalette?.classList.add('open');
  dom.commandBackdrop?.classList.add('open');
  if (dom.commandBackdrop) dom.commandBackdrop.hidden = false;
  dom.commandPalette?.setAttribute('aria-hidden', 'false');
  runtime.selectedCommandIndex = 0;
  renderCommandResults();
  requestAnimationFrame(() => dom.commandSearch?.focus());
  updateOverlayLock();
}

function closeCommandPalette() {
  dom.commandPalette?.classList.remove('open');
  dom.commandBackdrop?.classList.remove('open');
  if (dom.commandBackdrop) dom.commandBackdrop.hidden = true;
  dom.commandPalette?.setAttribute('aria-hidden', 'true');
  dom.commandSearch.value = '';
  updateOverlayLock();
}

function isNearBottom(container, thresholdPx = 120) {
  if (!container) return true;
  const delta = container.scrollHeight - container.scrollTop - container.clientHeight;
  return delta < thresholdPx;
}

function scrollConversationToBottom({ force = false } = {}) {
  const container = dom.conversation;
  if (!container) return;
  if (!force && !isNearBottom(container)) return;
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  updateScrollButton();
}

function updateScrollButton() {
  if (!dom.scrollBottom) return;
  dom.scrollBottom.hidden = isNearBottom(dom.conversation);
}

function updateComposerState() {
  const hasText = Boolean(dom.userInput?.value.trim());
  if (dom.sendButton) dom.sendButton.disabled = runtime.isProcessing || !hasText;
  if (dom.userInput) dom.userInput.disabled = runtime.isProcessing;
  if (dom.stopButton) dom.stopButton.hidden = !runtime.isProcessing;
}

function autoResizeTextarea(textarea, maxHeight) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
}

function updateHeader() {
  const chat = getActiveChat();
  if (!chat) return;

  if (dom.chatTitleButton) dom.chatTitleButton.textContent = chat.title || 'New chat';

  if (dom.activeModel) dom.activeModel.textContent = chat.model || store.defaults.model || DEFAULT_MODEL;

  if (dom.chatTitleMeta) {
    dom.chatTitleMeta.hidden = false;
    dom.chatTitleMeta.textContent = chat.model || store.defaults.model || DEFAULT_MODEL;
  }

  renderWorkspaceSummary();
}

function modeLabelForEffort(effort) {
  if (effort === 'high' || effort === 'xhigh') return 'Thinking';
  if (effort === 'none' || effort === 'minimal' || effort === 'low') return 'Instant';
  return 'Auto';
}

function effortForMode(mode) {
  if (mode === 'thinking') return 'high';
  if (mode === 'instant') return 'low';
  return 'medium';
}

function renderWorkspaceSummary() {
  const chat = getActiveChat();
  const chats = listChats();
  const pinned = chats.filter((c) => c.pinned).length;

  if (dom.navChatCount) dom.navChatCount.textContent = String(chats.length);
  if (dom.navPinnedCount) dom.navPinnedCount.textContent = String(pinned);
  if (dom.navLastUpdated) dom.navLastUpdated.textContent = chat ? formatAgeShort(chat.updatedAt) : 'now';

  if (dom.workspaceModel) dom.workspaceModel.textContent = chat?.model || store.defaults.model || DEFAULT_MODEL;
  if (dom.workspaceMessageCount) dom.workspaceMessageCount.textContent = String(chat?.messages?.length || 0);

  const mode = modeLabelForEffort(store.defaults.reasoningEffort || 'medium');
  if (dom.workspaceMode) dom.workspaceMode.textContent = mode;
  if (dom.composerModeToggle) dom.composerModeToggle.textContent = `Mode: ${mode}`;

  const toolFlags = [];
  if (store.defaults.localTools) toolFlags.push('Local');
  if (store.defaults.webSearch) toolFlags.push('Web');
  if (dom.workspaceTools) dom.workspaceTools.textContent = toolFlags.length ? toolFlags.join(' + ') : 'Off';
  dom.composerWebToggle?.classList.toggle('active', Boolean(store.defaults.webSearch));
  dom.composerToolsToggle?.classList.toggle('active', Boolean(store.defaults.localTools));
}

function applyWorkspacePreset(name) {
  const preset = WORKSPACE_PRESETS[name];
  const chat = getActiveChat();
  if (!preset || !chat) return;

  patchDefaults(preset.defaults);
  setChatInstructions(chat.id, preset.instructions);
  applyStateToSettingsUI();
  renderWorkspaceSummary();
  toast(`${preset.label} workspace applied.`, { variant: 'success', timeoutMs: 1400 });
}

function cycleComposerMode() {
  const currentMode = modeLabelForEffort(store.defaults.reasoningEffort || 'medium').toLowerCase();
  const nextMode = currentMode === 'instant' ? 'auto' : currentMode === 'auto' ? 'thinking' : 'instant';
  patchDefaults({ reasoningEffort: effortForMode(nextMode) });
  applyStateToSettingsUI();
}

async function runCalculatorWidget() {
  const expression = String(dom.toolCalcInput?.value || '').trim();
  if (!expression) {
    if (dom.toolCalcOutput) dom.toolCalcOutput.textContent = 'Enter an expression.';
    return;
  }

  try {
    const out = await runLocalToolCall({
      name: 'calculator',
      argumentsJson: JSON.stringify({ expression }),
    });
    if (dom.toolCalcOutput) dom.toolCalcOutput.textContent = out;
  } catch (error) {
    if (dom.toolCalcOutput) dom.toolCalcOutput.textContent = error?.message || String(error);
  }
}

async function runClockWidget() {
  const timeZone = String(dom.toolTimezoneInput?.value || '').trim();
  try {
    const out = await runLocalToolCall({
      name: 'get_current_time',
      argumentsJson: JSON.stringify({ time_zone: timeZone || null }),
    });
    if (dom.toolTimezoneOutput) dom.toolTimezoneOutput.textContent = out;
  } catch (error) {
    if (dom.toolTimezoneOutput) dom.toolTimezoneOutput.textContent = error?.message || String(error);
  }
}

function formatJsonWidget({ minify = false } = {}) {
  const raw = String(dom.toolJsonInput?.value || '').trim();
  if (!raw) {
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = 'Paste JSON above first.';
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const formatted = minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
    if (dom.toolJsonInput) dom.toolJsonInput.value = formatted;
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = minify ? 'JSON minified.' : 'JSON formatted.';
  } catch (error) {
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = `Invalid JSON: ${error?.message || String(error)}`;
  }
}

async function copyJsonWidget() {
  const raw = String(dom.toolJsonInput?.value || '').trim();
  if (!raw) {
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = 'Nothing to copy.';
    return;
  }
  try {
    await navigator.clipboard.writeText(raw);
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = 'Copied to clipboard.';
  } catch {
    if (dom.toolJsonOutput) dom.toolJsonOutput.textContent = 'Copy failed.';
  }
}

function updateTextStatsWidget() {
  const text = String(dom.toolTextInput?.value || '');
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const minutes = words ? Math.max(1, Math.ceil(words / 200)) : 0;

  if (dom.toolTextWords) dom.toolTextWords.textContent = String(words);
  if (dom.toolTextChars) dom.toolTextChars.textContent = String(chars);
  if (dom.toolTextRead) dom.toolTextRead.textContent = `${minutes}m`;
}

function insertPromptTemplate(text) {
  const next = String(text || '').trim();
  if (!next || !dom.userInput) return;

  const current = String(dom.userInput.value || '');
  dom.userInput.value = current.trim() ? `${current.trim()}\n${next}` : next;
  autoResizeTextarea(dom.userInput, COMPOSER_MAX_HEIGHT);
  updateComposerState();
  dom.userInput.focus();
}

function renderChatList() {
  if (!dom.chatList) return;
  const q = (dom.chatSearch?.value || '').trim();
  const chats = listChats({ query: q });
  dom.chatList.replaceChildren();

  const groups = [
    { label: q ? 'Matches' : 'Pinned', items: chats.filter((chat) => chat.pinned) },
    { label: q ? 'More results' : 'Recent', items: chats.filter((chat) => !chat.pinned) },
  ];

  let rendered = 0;

  for (const group of groups) {
    if (!group.items.length && !(q && !rendered)) continue;

    const section = document.createElement('section');
    section.className = 'sidebar-section';

    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.textContent = group.label;
    section.appendChild(label);

    if (!group.items.length) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'No conversations found.';
      section.appendChild(empty);
      dom.chatList.appendChild(section);
      continue;
    }

    for (const chat of group.items) {
      rendered += 1;
      const row = document.createElement('div');
      row.className = `chat-row ${chat.id === store.activeChatId ? 'active' : ''}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-link p-0 text-body text-decoration-none chat-title';
      btn.textContent = chat.title || 'New chat';
      btn.title = `${chat.model} • ${formatAgeShort(chat.updatedAt)}`;
      btn.addEventListener('click', () => {
        setActiveChat(chat.id);
        updateHeader();
        applyStateToSettingsUI();
        renderConversation();
        renderChatList();
        closeSidebar();
      });

      const actions = document.createElement('div');
      actions.className = 'chat-actions';

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `btn btn-sm ${chat.pinned ? 'btn-dark' : 'btn-outline-secondary'}`;
      pin.title = chat.pinned ? 'Unpin' : 'Pin';
      pin.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
      pin.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = togglePinChat(chat.id);
        if (!ok) toast('Pinned chats are limited. Unpin one first.', { variant: 'warning' });
        renderChatList();
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-sm btn-outline-secondary';
      del.title = 'Delete';
      del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
      del.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = await confirmDialog({ title: 'Delete chat?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
        if (!ok) return;
        deleteChat(chat.id);
        updateHeader();
        applyStateToSettingsUI();
        renderConversation();
        renderChatList();
      });

      actions.append(pin, del);
      row.append(btn, actions);
      section.appendChild(row);
    }

    dom.chatList.appendChild(section);
  }

  renderWorkspaceSummary();
}

function ensureEmptyState() {
  if (runtime.emptyStateEl) return runtime.emptyStateEl;
  const el = document.createElement('div');
  el.className = 'empty-state w-100 text-body-secondary py-5 px-3';
  runtime.emptyStateEl = el;
  return el;
}

function renderEmptyState() {
  const container = dom.conversationInner;
  if (!container) return;

  const chat = getActiveChat();
  const hasMessages = Boolean(chat?.messages?.length);
  const empty = ensureEmptyState();

  empty.hidden = hasMessages;
  if (!empty.isConnected) container.appendChild(empty);

  if (!hasMessages) {
    const markdownHolder = document.createElement('div');
    markdownHolder.className = 'markdown-body mx-auto text-start';
    markdownHolder.style.maxWidth = 'var(--content-max)';
    applyMarkdown(markdownHolder, copyContent.empty || defaultCopy.empty);
    empty.replaceChildren(markdownHolder);
  }
}

function buildAssistantMarkdown(message) {
  const linked = injectCitationLinks(message.content, message.annotations || []);
  const reasoning = (message.reasoningSummary || '').trim();
  if (!reasoning) return linked;
  return `<details><summary>Reasoning summary</summary>\n\n${escapeHtml(reasoning)}\n\n</details>\n\n${linked}`;
}

function formatUsageFooter(modelId, usage) {
  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens;
  const reasoning = usage?.output_tokens_details?.reasoning_tokens;

  const parts = [];
  if (typeof input === 'number') parts.push(`in ${input}`);
  if (typeof cached === 'number' && cached > 0) parts.push(`cached ${cached}`);
  if (typeof output === 'number') parts.push(`out ${output}`);
  if (typeof reasoning === 'number' && reasoning > 0) parts.push(`reasoning ${reasoning}`);

  const cost = estimateCostUSD(modelId, usage);
  if (cost != null) parts.push(`~$${cost.toFixed(cost < 0.01 ? 5 : 4)}`);
  return parts.join(' • ');
}

function createMessageElement(message, { isStreaming = false } = {}) {
  const fragment = dom.messageTemplate.content.cloneNode(true);
  const messageEl = fragment.querySelector('.message');
  const avatarEl = fragment.querySelector('.avatar');
  const roleEl = fragment.querySelector('.role');
  const metaEl = fragment.querySelector('.meta');
  const contentEl = fragment.querySelector('.message-content');
  const footerEl = fragment.querySelector('.message-footer');
  const copyBtn = fragment.querySelector('.action-copy');
  const editBtn = fragment.querySelector('.action-edit');

  messageEl.dataset.messageId = message.id;
  messageEl.dataset.role = message.role;

  avatarEl.textContent = message.role === 'user' ? 'You' : 'AI';
  roleEl.textContent = message.role === 'user' ? 'You' : 'Assistant';

  const meta = message.role === 'assistant' ? (message.model || getActiveChat()?.model || DEFAULT_MODEL) : '';
  if (meta) {
    metaEl.hidden = false;
    metaEl.textContent = meta + (isStreaming ? ' • streaming…' : '');
  } else {
    metaEl.hidden = true;
  }

  if (message.role === 'assistant') {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(message.content || '');
        toast('Copied to clipboard.', { variant: 'success', timeoutMs: 1200 });
      } catch {
        toast('Copy failed.', { variant: 'warning', timeoutMs: 1800 });
      }
    });
  } else {
    editBtn.hidden = false;
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleEditUserMessage(message.id);
    });
  }

  if (message.role === 'assistant') {
    if (isStreaming) setPlainText(contentEl, message.content || '');
    else applyMarkdown(contentEl, buildAssistantMarkdown(message));
  } else {
    setPlainText(contentEl, message.content || '');
  }

  if (message.role === 'assistant' && message.usage) {
    footerEl.hidden = false;
    footerEl.textContent = formatUsageFooter(message.model || DEFAULT_MODEL, message.usage);
  } else {
    footerEl.hidden = true;
  }

  dom.conversationInner.appendChild(fragment);
  requestAnimationFrame(() => messageEl.classList.add('appear'));
  renderEmptyState();
  scrollConversationToBottom();
  updateScrollButton();
  return { messageEl, contentEl, metaEl, footerEl };
}

function renderConversation() {
  const chat = getActiveChat();
  if (!chat || !dom.conversationInner) return;
  runtime.editingMessageId = null;

  dom.conversationInner.replaceChildren();

  for (const m of chat.messages) createMessageElement(m);

  renderEmptyState();
  updateRegenerateButton();
  renderWorkspaceSummary();
}

function updateRegenerateButton() {
  const chat = getActiveChat();
  const hasUser = Boolean(chat?.messages?.some((m) => m.role === 'user'));
  if (dom.regenerateButton) dom.regenerateButton.hidden = !hasUser || runtime.isProcessing;
}

function applyStateToSettingsUI() {
  const chat = getActiveChat();
  if (!chat) return;

  dom.apiKeyInput.value = getApiKey();
  if (dom.apiBaseUrlInput) dom.apiBaseUrlInput.value = store.defaults.apiBaseUrl || 'https://api.openai.com';
  dom.temperatureInput.value = String(store.defaults.temperature ?? 1.0);
  if (dom.topPInput) dom.topPInput.value = String(store.defaults.topP ?? 0);
  dom.maxOutputTokensInput.value = String(store.defaults.maxOutputTokens ?? 0);
  dom.reasoningEffortSelect.value = store.defaults.reasoningEffort || 'medium';
  dom.reasoningSummarySelect.value = store.defaults.reasoningSummary || 'auto';
  if (dom.textVerbositySelect) dom.textVerbositySelect.value = store.defaults.textVerbosity || 'medium';
  if (dom.truncationSelect) dom.truncationSelect.value = store.defaults.truncation || 'disabled';
  if (dom.maxToolCallsInput) dom.maxToolCallsInput.value = String(store.defaults.maxToolCalls ?? 0);
  if (dom.promptCacheKeyInput) dom.promptCacheKeyInput.value = store.defaults.promptCacheKey || '';
  if (dom.promptCacheRetentionSelect) dom.promptCacheRetentionSelect.value = store.defaults.promptCacheRetention || '';
  if (dom.safetyIdentifierInput) dom.safetyIdentifierInput.value = store.defaults.safetyIdentifier || '';
  dom.webSearchCheckbox.checked = Boolean(store.defaults.webSearch);
  if (dom.webSearchDomainsInput) dom.webSearchDomainsInput.value = store.defaults.webSearchAllowedDomains || '';
  if (dom.webSearchBlockedDomainsInput) dom.webSearchBlockedDomainsInput.value = store.defaults.webSearchBlockedDomains || '';
  if (dom.webSearchContextSizeSelect) dom.webSearchContextSizeSelect.value = store.defaults.webSearchContextSize || 'medium';
  if (dom.webSearchExternalAccessCheckbox) dom.webSearchExternalAccessCheckbox.checked = store.defaults.webSearchExternalAccess !== false;
  if (dom.webSearchReturnTokenBudgetSelect) dom.webSearchReturnTokenBudgetSelect.value = store.defaults.webSearchReturnTokenBudget || 'default';
  if (dom.localToolsCheckbox) dom.localToolsCheckbox.checked = Boolean(store.defaults.localTools);
  dom.storeCheckbox.checked = Boolean(store.defaults.storeResponses);
  dom.instructionsTextarea.value = chat.instructions || '';

  const reasoning = isReasoningModel(chat.model || store.defaults.model || DEFAULT_MODEL);
  dom.reasoningEffortSelect.disabled = !reasoning;
  dom.reasoningSummarySelect.disabled = !reasoning;

  const mode = modeLabelForEffort(store.defaults.reasoningEffort || 'medium').toLowerCase();
  if (dom.modeAuto && dom.modeInstant && dom.modeThinking) {
    dom.modeAuto.checked = mode === 'auto';
    dom.modeInstant.checked = mode === 'instant';
    dom.modeThinking.checked = mode === 'thinking';
  }

  renderWorkspaceSummary();
}

function setProcessing(isProcessing) {
  runtime.isProcessing = isProcessing;
  updateComposerState();
  updateRegenerateButton();
  if (!isProcessing) requestAnimationFrame(() => dom.userInput?.focus());
}

function handleNewChat() {
  const chat = createChat({ title: 'New chat', model: store.defaults.model || DEFAULT_MODEL });
  updateHeader();
  applyStateToSettingsUI();
  renderConversation();
  renderChatList();
  closeSidebar();
  requestAnimationFrame(() => dom.userInput?.focus());
  return chat;
}

function autoTitleIfNeeded(firstUserText) {
  const chat = getActiveChat();
  if (!chat) return;
  if (chat.messages.filter((m) => m.role === 'user').length !== 1) return;
  if (chat.title && chat.title !== 'New chat' && chat.title !== 'Imported chat') return;
  const trimmed = String(firstUserText || '').trim();
  if (!trimmed) return;
  const title = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
  renameChat(chat.id, title);
}

async function handleSendMessage(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || runtime.isProcessing) return;

  if (window.location.protocol === 'file:') {
    toast('Open this app via http(s) (GitHub Pages works). File:// pages cannot call the OpenAI API.', { title: 'Network blocked', variant: 'warning' });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    openSettingsDrawer();
    return;
  }

  const chat = getActiveChat();
  if (!chat) return;

  const userMsg = addMessage(chat.id, { role: 'user', content: trimmed, createdAt: nowMs() });
  autoTitleIfNeeded(trimmed);
  createMessageElement(userMsg);
  renderChatList();
  scrollConversationToBottom({ force: true });

  await generateAssistant();
}

async function regenerateLast() {
  const chat = getActiveChat();
  if (!chat || runtime.isProcessing) return;
  if (window.location.protocol === 'file:') {
    toast('Open this app via http(s) (GitHub Pages works). File:// pages cannot call the OpenAI API.', { title: 'Network blocked', variant: 'warning' });
    return;
  }
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  truncateAfterMessage(chat.id, lastUser.id);
  renderConversation();
  await generateAssistant();
}

function handleEditUserMessage(messageId) {
  const chat = getActiveChat();
  if (!chat || runtime.isProcessing) return;
  const msg = chat.messages.find((m) => m.id === messageId);
  if (!msg || msg.role !== 'user') return;

  if (runtime.editingMessageId && runtime.editingMessageId !== msg.id) {
    toast('Finish editing the current message first.', { variant: 'warning' });
    return;
  }

  const selector = `[data-message-id="${msg.id}"]`;
  const el = dom.conversationInner?.querySelector(selector);
  const contentEl = el?.querySelector?.('.message-content');
  if (!contentEl) return;

  runtime.editingMessageId = msg.id;

  const textarea = document.createElement('textarea');
  textarea.className = 'form-control';
  textarea.rows = 4;
  textarea.value = msg.content || '';

  const actions = document.createElement('div');
  actions.className = 'd-flex justify-content-end gap-2 mt-2';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-sm btn-outline-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-sm btn-dark';
  saveBtn.textContent = 'Save';

  actions.append(cancelBtn, saveBtn);
  contentEl.replaceChildren(textarea, actions);

  const cancel = () => {
    runtime.editingMessageId = null;
    renderConversation();
  };

  const save = () => {
    const trimmed = String(textarea.value || '').trim();
    if (!trimmed) return toast('Message cannot be empty.', { variant: 'warning' });
    updateMessage(chat.id, msg.id, { content: trimmed });
    truncateAfterMessage(chat.id, msg.id);
    runtime.editingMessageId = null;
    renderConversation();
    generateAssistant();
  };

  cancelBtn.addEventListener('click', cancel);
  saveBtn.addEventListener('click', save);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    if (modKey && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function renderModelList() {
  if (!dom.modelList) return;
  const q = (dom.modelSearch?.value || '').trim().toLowerCase();
  dom.modelList.replaceChildren();

  const renderGroup = (title, items) => {
    if (!items.length) return;
    const header = document.createElement('div');
    header.className = 'small fw-semibold text-body-secondary mt-2';
    header.textContent = title;
    dom.modelList.appendChild(header);

    for (const m of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-secondary model-row p-3 d-flex justify-content-between align-items-start gap-3';
      btn.dataset.modelId = m.id;

      const left = document.createElement('div');
      left.className = 'text-start';

      const name = document.createElement('div');
      name.className = 'fw-semibold';
      name.textContent = m.title || m.id;

      const sub = document.createElement('div');
      sub.className = 'small text-body-secondary';
      sub.textContent = m.blurb || m.id;
      left.append(name, sub);
      if (m.deprecated) {
        const dep = document.createElement('div');
        dep.className = 'small text-danger-emphasis';
        dep.textContent = m.deprecated;
        left.appendChild(dep);
      }

      const right = document.createElement('div');
      right.className = 'text-end small text-body-secondary';
      right.textContent = m.pricing ? modelPricingLabel(m.pricing) : '';

      btn.append(left, right);
      btn.addEventListener('click', () => {
        const chat = getActiveChat();
        if (chat) setChatModel(chat.id, m.id);
        updateHeader();
        applyStateToSettingsUI();
        renderChatList();
        closeModelPicker();
      });

      dom.modelList.appendChild(btn);
    }
  };

  const filtered = MODEL_CATALOG.map((g) => ({
    group: g.group,
    models: g.models.filter((m) => {
      if (!q) return true;
      const hay = `${m.id} ${m.title || ''} ${m.blurb || ''} ${m.deprecated || ''}`.toLowerCase();
      return hay.includes(q);
    }),
  }));

  for (const g of filtered) renderGroup(g.group, g.models);

  if (store.accountModels?.length) {
    const extra = store.accountModels
      .map((id) => ({ id, title: id, blurb: 'From your account (no pricing info).', pricing: null }))
      .filter((m) => (!q ? true : m.id.toLowerCase().includes(q)));
    renderGroup('From your account', extra.slice(0, 60));
  }
}

function renderCommandResults() {
  if (!dom.commandResults) return;
  const q = (dom.commandSearch?.value || '').trim().toLowerCase();
  dom.commandResults.replaceChildren();

  const items = [];

  const addAction = (label, run) => items.push({ type: 'action', label, run });
  addAction('New chat', () => handleNewChat());
  addAction('Open settings', () => openSettingsDrawer());
  addAction('Choose model', () => openModelPicker());
  addAction('Toggle theme', () => applyTheme(document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'));
  addAction('Apply Writing workspace', () => applyWorkspacePreset('writing'));
  addAction('Apply Coding workspace', () => applyWorkspacePreset('coding'));
  addAction('Apply Research workspace', () => applyWorkspacePreset('research'));

  const chat = getActiveChat();
  if (chat?.messages?.length) addAction('Clear current chat', () => clearChat());

  const chats = listChats({ query: q });
  for (const c of chats) items.push({ type: 'chat', label: c.title, chatId: c.id, meta: c.model });

  const filtered = q
    ? items.filter((i) => i.type === 'chat' || i.label.toLowerCase().includes(q))
    : items;

  runtime.selectedCommandIndex = filtered.length
    ? Math.max(0, Math.min(runtime.selectedCommandIndex, filtered.length - 1))
    : 0;

  filtered.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-outline-secondary text-start p-2 d-flex justify-content-between align-items-center gap-3 ${index === runtime.selectedCommandIndex ? 'border-dark' : ''}`;
    btn.dataset.index = String(index);
    btn.dataset.kind = item.type;
    if (item.chatId) btn.dataset.chatId = item.chatId;
    btn.textContent = item.label;

    if (item.type === 'chat') {
      const right = document.createElement('span');
      right.className = 'small text-body-secondary';
      right.textContent = item.meta || '';
      btn.appendChild(right);
    }

    btn.addEventListener('click', () => runCommandItem(item));
    dom.commandResults.appendChild(btn);
  });
}

function runCommandItem(item) {
  if (item.type === 'action') item.run?.();
  if (item.type === 'chat') {
    setActiveChat(item.chatId);
    updateHeader();
    applyStateToSettingsUI();
    renderConversation();
    renderChatList();
  }
  closeCommandPalette();
}

async function clearChat() {
  const chat = getActiveChat();
  if (!chat) return;
  const ok = await confirmDialog({ title: 'Clear conversation?', message: 'This will remove all messages in this chat.', confirmText: 'Clear', danger: true });
  if (!ok) return;
  clearChatMessages(chat.id);
  renderConversation();
  renderChatList();
}

async function generateAssistant() {
  const chat = getActiveChat();
  const apiKey = getApiKey();
  if (!chat || !apiKey) return;

  runtime.abortController = new AbortController();
  setProcessing(true);

  const assistantMsg = addMessage(chat.id, {
    role: 'assistant',
    content: '',
    createdAt: nowMs(),
    model: chat.model || store.defaults.model || DEFAULT_MODEL,
  });

  const { messageEl, contentEl, metaEl, footerEl } = createMessageElement(assistantMsg, { isStreaming: true });

  let outputText = '';
  let reasoningSummary = '';
  let annotations = [];
  let responseId = null;
  let usage = null;

  let scheduled = false;
  const scheduleRender = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      setPlainText(contentEl, outputText);
      scrollConversationToBottom();
      updateScrollButton();
    });
  };

  try {
    if (window.location.protocol === 'file:') throw new Error('Open this app via http(s) (GitHub Pages works). File:// pages cannot call the OpenAI API.');

    const model = chat.model || store.defaults.model || DEFAULT_MODEL;
    const extraTools = store.defaults.localTools ? getLocalToolDefinitions() : [];

    const requestDefaults = {
      model,
      instructions: chat.instructions || '',
      temperature: store.defaults.temperature,
      topP: store.defaults.topP,
      maxOutputTokens: store.defaults.maxOutputTokens,
      reasoningEffort: store.defaults.reasoningEffort,
      reasoningSummary: store.defaults.reasoningSummary,
      textVerbosity: store.defaults.textVerbosity,
      truncation: store.defaults.truncation,
      promptCacheKey: store.defaults.promptCacheKey,
      promptCacheRetention: store.defaults.promptCacheRetention,
      safetyIdentifier: store.defaults.safetyIdentifier,
      maxToolCalls: store.defaults.maxToolCalls,
      webSearch: store.defaults.webSearch,
      webSearchAllowedDomains: store.defaults.webSearchAllowedDomains,
      webSearchBlockedDomains: store.defaults.webSearchBlockedDomains,
      webSearchContextSize: store.defaults.webSearchContextSize,
      webSearchExternalAccess: store.defaults.webSearchExternalAccess,
      webSearchReturnTokenBudget: store.defaults.webSearchReturnTokenBudget,
      extraTools,
      store: store.defaults.storeResponses,
      includeEncryptedReasoning: isReasoningModel(model) && !store.defaults.storeResponses,
    };

    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
    const statefulBody = chat.previousResponseId && lastUser
      ? buildResponsesBody({
        ...requestDefaults,
        input: String(lastUser.content || ''),
        previousResponseId: chat.previousResponseId,
      })
      : null;

    const historyBody = buildResponsesBody({
      ...requestDefaults,
      messages: chat.messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.id !== assistantMsg.id),
    });

    const bodies = statefulBody ? [{ kind: 'stateful', body: statefulBody }, { kind: 'history', body: historyBody }] : [{ kind: 'history', body: historyBody }];

    const runSingleResponse = async (body) => {
      const toolCalls = [];
      let outputItems = [];

      await streamResponses({
        apiKey,
        baseUrl: store.defaults.apiBaseUrl,
        body,
        signal: runtime.abortController.signal,
        onEvent: (evt) => {
          const maybeId = extractResponseId(evt);
          if (maybeId) responseId = maybeId;

          if (evt?.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            outputText += evt.delta;
            scheduleRender();
            if (metaEl) {
              metaEl.hidden = false;
              metaEl.textContent = `${chat.model} • streaming…`;
            }
            return;
          }

          if (evt?.type === 'response.output_text.done' && typeof evt.text === 'string') {
            if (evt.text.length >= outputText.length) outputText = evt.text;
            scheduleRender();
            return;
          }

          if (evt?.type === 'response.refusal.delta' && typeof evt.delta === 'string') {
            outputText += evt.delta;
            scheduleRender();
            return;
          }

          if (evt?.type === 'response.refusal.done' && typeof evt.refusal === 'string') {
            if (evt.refusal.length >= outputText.length) outputText = evt.refusal;
            scheduleRender();
            return;
          }

          if (evt?.type === 'response.reasoning_summary_text.delta' && typeof evt.delta === 'string') {
            reasoningSummary += evt.delta;
            return;
          }

          if (evt?.type === 'response.reasoning_summary_text.done' && typeof evt.text === 'string') {
            if (evt.text.length >= reasoningSummary.length) reasoningSummary = evt.text;
            return;
          }

          if (typeof evt?.type === 'string' && evt.type.startsWith('response.web_search_call.')) {
            if (metaEl) {
              metaEl.hidden = false;
              metaEl.textContent = `${chat.model} • searching…`;
            }
            return;
          }

          if (evt?.type === 'response.output_text.annotation.added') {
            const ann = evt.annotation || evt.data?.annotation || evt.data || null;
            if (ann && typeof ann === 'object') annotations.push(ann);
            return;
          }

          if (evt?.type === 'response.completed') {
            if (evt?.response?.usage) usage = evt.response.usage;
            const out = Array.isArray(evt?.response?.output) ? evt.response.output : [];
            outputItems = out;
            for (const item of out) {
              if (!item || typeof item !== 'object' || item.type !== 'function_call') continue;
              if (typeof item.call_id !== 'string' || typeof item.name !== 'string') continue;
              toolCalls.push({ call_id: item.call_id, name: item.name, arguments: item.arguments });
            }
            if (toolCalls.length && metaEl) {
              metaEl.hidden = false;
              metaEl.textContent = `${chat.model} • tool call…`;
            }
          }

          if (evt?.type === 'error') {
            const msg = evt.error?.message || evt.message || 'OpenAI error';
            throw new Error(msg);
          }
        },
      });

      return { toolCalls, outputItems };
    };

    const runWithLocalTools = async (firstBody) => {
      let current = firstBody;
      const maxRounds = 4;

      for (let round = 0; round <= maxRounds; round += 1) {
        const result = await runSingleResponse(current);
        const calls = result.toolCalls || [];
        if (!store.defaults.localTools || !calls.length) return;
        if (store.defaults.storeResponses && !responseId) throw new Error('Missing response id for tool calls.');

        if (metaEl) {
          metaEl.hidden = false;
          metaEl.textContent = `${chat.model} • running tools…`;
        }

        const outputs = [];
        for (const c of calls) {
          try {
            const out = await runLocalToolCall({ name: c.name, argumentsJson: c.arguments });
            outputs.push({ type: 'function_call_output', call_id: c.call_id, output: out });
          } catch (e) {
            outputs.push({ type: 'function_call_output', call_id: c.call_id, output: `Error: ${e?.message || String(e)}` });
          }
        }

        const inputItems = store.defaults.storeResponses
          ? outputs
          : [...(result.outputItems || []), ...outputs];

        current = buildResponsesBody({
          ...requestDefaults,
          inputItems,
          previousResponseId: store.defaults.storeResponses ? responseId : null,
        });
      }

      throw new Error('Too many tool calls (possible loop).');
    };

    let ran = false;
    let lastErr = null;
    for (const attempt of bodies) {
      try {
        ran = true;
        await runWithLocalTools(attempt.body);
        lastErr = null;
        break;
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        lastErr = err;
        if (attempt.kind === 'stateful') {
          // If stateful chaining fails, drop the chain and retry with full history.
          setChatPreviousResponseId(chat.id, null);
          outputText = '';
          reasoningSummary = '';
          annotations = [];
          responseId = null;
          usage = null;
          continue;
        }
      }
    }

    if (!ran) throw new Error('No request was sent.');
    if (lastErr) throw lastErr;

    if (!outputText.trim()) throw new Error('Received an empty response.');

    if (store.defaults.storeResponses && responseId) {
      try {
        const full = await fetchResponseById({ apiKey, baseUrl: store.defaults.apiBaseUrl, responseId });
        const extracted = extractTextAndAnnotationsFromResponse(full);
        if (extracted.outputText) outputText = extracted.outputText;
        if (extracted.reasoningSummary) reasoningSummary = extracted.reasoningSummary;
        if (extracted.annotations.length) annotations = extracted.annotations;
        usage = full?.usage || usage;
      } catch {
        // ignore
      }
    }

    const finalMsg = {
      content: outputText,
      responseId: responseId || undefined,
      annotations,
      reasoningSummary,
      usage,
    };

    updateMessage(chat.id, assistantMsg.id, finalMsg);

    const md = buildAssistantMarkdown({ ...assistantMsg, ...finalMsg });
    applyMarkdown(contentEl, md);
    if (metaEl) {
      metaEl.hidden = false;
      metaEl.textContent = `${chat.model}`;
    }
    if (footerEl) {
      if (usage) {
        footerEl.hidden = false;
        footerEl.textContent = formatUsageFooter(chat.model, usage);
      } else {
        footerEl.hidden = true;
      }
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const cancelled = `${outputText}\n\n[Cancelled]`.trim();
      updateMessage(chat.id, assistantMsg.id, { content: cancelled });
      setPlainText(contentEl, cancelled);
      if (metaEl) metaEl.textContent = `${chat.model} • cancelled`;
    } else {
      let detail = error?.message || String(error);
      if (detail === 'Failed to fetch' || detail === 'Load failed') {
        detail = 'Network error (Failed to fetch). Check your connection, API key, and API base URL (Settings → API).';
      }
      const msg = `⚠️ ${detail}`;
      updateMessage(chat.id, assistantMsg.id, { content: msg });
      setPlainText(contentEl, msg);
      if (metaEl) metaEl.textContent = `${chat.model} • error`;
    }
  } finally {
    runtime.abortController = null;
    setProcessing(false);
    renderChatList();
  }
}

async function testConnection() {
  const key = String(dom.apiKeyInput?.value || getApiKey() || '').trim();
  if (!key) return toast('Add your API key first.', { title: 'Missing API key', variant: 'warning' });

  const baseUrl = String(dom.apiBaseUrlInput?.value || store.defaults.apiBaseUrl || '').trim() || store.defaults.apiBaseUrl;

  try {
    if (dom.testConnectionBtn) dom.testConnectionBtn.disabled = true;
    const ids = await refreshAccountModels({ apiKey: key, baseUrl });
    store.accountModels = ids;
    persist();
    toast(`OK. Found ${ids.length} models on your account.`, { title: 'Connection OK', variant: 'success' });
  } catch (e) {
    toast(e?.message || String(e), { title: 'Connection failed', variant: 'danger' });
  } finally {
    if (dom.testConnectionBtn) dom.testConnectionBtn.disabled = false;
  }
}

function bindUI() {
  dom.sidebarOpen?.addEventListener('click', openSidebar);
  dom.sidebarClose?.addEventListener('click', closeSidebar);
  dom.sidebarBackdrop?.addEventListener('click', closeSidebar);
  dom.scrollBottom?.addEventListener('click', () => scrollConversationToBottom({ force: true }));

  dom.newChat?.addEventListener('click', handleNewChat);
  dom.newChatTop?.addEventListener('click', handleNewChat);
  dom.railNewChat?.addEventListener('click', handleNewChat);
  dom.railSearchOpen?.addEventListener('click', openCommandPalette);
  dom.railModelOpen?.addEventListener('click', openModelPicker);
  dom.railSettingsOpen?.addEventListener('click', openSettingsDrawer);

  dom.chatSearch?.addEventListener('input', debounce(renderChatList, 80));

  dom.clearChatButton?.addEventListener('click', clearChat);

  dom.settingsOpenBtn?.addEventListener('click', () => {
    closeSidebar();
    openSettingsDrawer();
  });
  dom.settingsCloseBtn?.addEventListener('click', closeSettingsDrawer);
  dom.drawerBackdrop?.addEventListener('click', closeSettingsDrawer);
  dom.testConnectionBtn?.addEventListener('click', testConnection);

  dom.settingsDrawer?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-settings-jump]');
    if (!btn) return;
    const id = btn.getAttribute('data-settings-jump');
    const el = id ? document.getElementById(id) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  dom.settingsForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    setApiKey(dom.apiKeyInput?.value || '');

    patchDefaults({
      apiBaseUrl: String(dom.apiBaseUrlInput?.value || '').trim() || store.defaults.apiBaseUrl,
      temperature: Number(dom.temperatureInput?.value),
      topP: Number(dom.topPInput?.value),
      maxOutputTokens: Math.max(0, parseInt(dom.maxOutputTokensInput?.value || '0', 10) || 0),
      reasoningEffort: dom.reasoningEffortSelect?.value || store.defaults.reasoningEffort,
      reasoningSummary: dom.reasoningSummarySelect?.value || store.defaults.reasoningSummary,
      textVerbosity: dom.textVerbositySelect?.value || store.defaults.textVerbosity,
      truncation: dom.truncationSelect?.value || store.defaults.truncation,
      maxToolCalls: Math.max(0, parseInt(dom.maxToolCallsInput?.value || '0', 10) || 0),
      promptCacheKey: String(dom.promptCacheKeyInput?.value || '').trim(),
      promptCacheRetention: dom.promptCacheRetentionSelect?.value || '',
      safetyIdentifier: String(dom.safetyIdentifierInput?.value || '').trim(),
      webSearch: Boolean(dom.webSearchCheckbox?.checked),
      webSearchAllowedDomains: String(dom.webSearchDomainsInput?.value || '').trim(),
      webSearchBlockedDomains: String(dom.webSearchBlockedDomainsInput?.value || '').trim(),
      webSearchContextSize: dom.webSearchContextSizeSelect?.value || store.defaults.webSearchContextSize,
      webSearchExternalAccess: Boolean(dom.webSearchExternalAccessCheckbox?.checked),
      webSearchReturnTokenBudget: dom.webSearchReturnTokenBudgetSelect?.value || store.defaults.webSearchReturnTokenBudget,
      localTools: Boolean(dom.localToolsCheckbox?.checked),
      storeResponses: Boolean(dom.storeCheckbox?.checked),
    });

    const chat = getActiveChat();
    if (chat) setChatInstructions(chat.id, dom.instructionsTextarea?.value || '');

    applyStateToSettingsUI();
    closeSettingsDrawer();
  });

  dom.themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-bs-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  dom.modelPickerOpen?.addEventListener('click', openModelPicker);
  dom.modelPickerClose?.addEventListener('click', closeModelPicker);
  dom.modelPickerBackdrop?.addEventListener('click', closeModelPicker);
  dom.modelSearch?.addEventListener('input', renderModelList);

  dom.modelsRefresh?.addEventListener('click', async () => {
    try {
      dom.modelsRefresh.disabled = true;
      const ids = await refreshAccountModels({ apiKey: getApiKey(), baseUrl: store.defaults.apiBaseUrl });
      store.accountModels = ids;
      persist();
      renderModelList();
    } catch (e) {
      toast(e?.message || String(e), { title: 'Refresh failed', variant: 'danger' });
    } finally {
      dom.modelsRefresh.disabled = false;
    }
  });

  dom.modelCustomApply?.addEventListener('click', () => {
    const id = String(dom.modelCustomInput?.value || '').trim();
    const chat = getActiveChat();
    if (!id || !chat) return;
    setChatModel(chat.id, id);
    updateHeader();
    applyStateToSettingsUI();
    renderChatList();
    closeModelPicker();
  });

  const applyMode = (mode) => {
    patchDefaults({ reasoningEffort: effortForMode(mode) });
    applyStateToSettingsUI();
  };

  dom.modeAuto?.addEventListener('change', () => dom.modeAuto.checked && applyMode('auto'));
  dom.modeInstant?.addEventListener('change', () => dom.modeInstant.checked && applyMode('instant'));
  dom.modeThinking?.addEventListener('change', () => dom.modeThinking.checked && applyMode('thinking'));

  dom.commandOpen?.addEventListener('click', openCommandPalette);
  dom.commandClose?.addEventListener('click', closeCommandPalette);
  dom.commandBackdrop?.addEventListener('click', closeCommandPalette);
  dom.commandSearch?.addEventListener('input', debounce(renderCommandResults, 80));

  dom.commandSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      runtime.selectedCommandIndex += 1;
      renderCommandResults();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      runtime.selectedCommandIndex = Math.max(0, runtime.selectedCommandIndex - 1);
      renderCommandResults();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const btn = dom.commandResults?.querySelector(`button[data-index="${runtime.selectedCommandIndex}"]`);
      btn?.click();
    }
  });

  dom.stopButton?.addEventListener('click', () => runtime.abortController?.abort());
  dom.regenerateButton?.addEventListener('click', regenerateLast);

  dom.toolCalcRun?.addEventListener('click', runCalculatorWidget);
  dom.toolCalcInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCalculatorWidget();
    }
  });

  dom.toolTimezoneRun?.addEventListener('click', runClockWidget);
  dom.toolTimezoneInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runClockWidget();
    }
  });

  dom.toolJsonFormat?.addEventListener('click', () => formatJsonWidget());
  dom.toolJsonMinify?.addEventListener('click', () => formatJsonWidget({ minify: true }));
  dom.toolJsonCopy?.addEventListener('click', copyJsonWidget);
  dom.toolTextInput?.addEventListener('input', updateTextStatsWidget);
  dom.composerWebToggle?.addEventListener('click', () => {
    patchDefaults({ webSearch: !store.defaults.webSearch });
    applyStateToSettingsUI();
  });
  dom.composerToolsToggle?.addEventListener('click', () => {
    patchDefaults({ localTools: !store.defaults.localTools });
    applyStateToSettingsUI();
  });
  dom.composerModeToggle?.addEventListener('click', cycleComposerMode);
  dom.composerModelOpen?.addEventListener('click', openModelPicker);
  dom.promptFillButtons?.forEach((btn) => {
    btn.addEventListener('click', () => insertPromptTemplate(btn.getAttribute('data-prompt-fill')));
  });
  dom.workspacePresetButtons?.forEach((btn) => {
    btn.addEventListener('click', () => applyWorkspacePreset(btn.getAttribute('data-workspace-preset')));
  });

  dom.exportChatButton?.addEventListener('click', () => {
    const chat = getActiveChat();
    if (!chat) return;
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify({ chat, defaults: store.defaults }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-llm-${now}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  dom.composerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = dom.userInput?.value || '';
    dom.userInput.value = '';
    autoResizeTextarea(dom.userInput, COMPOSER_MAX_HEIGHT);
    updateComposerState();
    handleSendMessage(value);
  });

  dom.userInput?.addEventListener('input', () => {
    autoResizeTextarea(dom.userInput, COMPOSER_MAX_HEIGHT);
    updateComposerState();
  });

  dom.userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dom.composerForm.requestSubmit();
    }
  });

  dom.chatTitleButton?.addEventListener('click', () => {
    const chat = getActiveChat();
    if (!chat) return;
    dom.chatTitleInput.hidden = false;
    dom.chatTitleInput.value = chat.title || 'New chat';
    dom.chatTitleButton.hidden = true;
    requestAnimationFrame(() => dom.chatTitleInput?.focus());
  });

  const finishRename = (commit) => {
    const chat = getActiveChat();
    if (!chat) return;
    if (commit) {
      const next = String(dom.chatTitleInput.value || '').trim();
      if (next) renameChat(chat.id, next);
    }
    dom.chatTitleButton.hidden = false;
    dom.chatTitleInput.hidden = true;
    updateHeader();
    renderChatList();
  };

  dom.chatTitleInput?.addEventListener('blur', () => finishRename(true));
  dom.chatTitleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishRename(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finishRename(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.commandPalette?.classList.contains('open')) return closeCommandPalette();
      if (dom.modelPicker?.classList.contains('open')) return closeModelPicker();
      if (dom.settingsDrawer?.classList.contains('open')) return closeSettingsDrawer();
      if (dom.sidebar?.classList.contains('open')) return closeSidebar();
    }

    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }

    if (modKey && e.key === ',') {
      e.preventDefault();
      openSettingsDrawer();
    }
  });

  dom.conversation?.addEventListener('scroll', debounce(updateScrollButton, 50));
}

export async function initApp() {
  loadThemePreference();
  configureMarkdown();
  load();
  await loadCopy();
  applyCopy();

  if (!store.chats.length) createChat({ title: 'New chat' });
  if (!getActiveChat()) setActiveChat(store.chats[0]?.id);

  updateHeader();
  applyStateToSettingsUI();
  renderConversation();
  renderChatList();
  updateComposerState();
  autoResizeTextarea(dom.userInput, COMPOSER_MAX_HEIGHT);
  renderWorkspaceSummary();
  updateTextStatsWidget();
  runClockWidget();

  bindUI();
}
