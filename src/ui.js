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
  resetStore,
  setActiveChat,
  setChatInstructions,
  setChatModel,
  setChatPreviousResponseId,
  store,
  togglePinChat,
  truncateAfterMessage,
  updateMessage,
} from './state.js?v=20260604-state-reset';
import { DEFAULT_MODEL, MODEL_CATALOG, isReasoningModel, modelPricingLabel } from './models.js';
import {
  buildResponsesBody,
  estimateCostUSD,
  extractResponseId,
  extractTextAndAnnotationsFromResponse,
  fetchResponseById,
  clearApiKey,
  getApiKey,
  injectCitationLinks,
  refreshAccountModels,
  setApiKey,
  setApiKeyPersistence,
  streamResponses,
} from './api.js';
import { confirmDialog, toast } from './overlays.js';
import { debounce, escapeHtml, formatAgeShort, nowMs } from './utils.js';
import { local as localStorageSafe, writeText } from './storage.js';
import { assessRequestPreflight, normalizeBaseUrl } from './security.js';
import { formatToolError, getLocalToolDefinitions, runLocalToolCall } from './tools.js';

const THEME_KEY = 'chat_theme_preference';
const SIDEBAR_KEY = 'chat_sidebar_preference';
const PRISM_LIGHT_ID = 'prism-light';
const PRISM_DARK_ID = 'prism-dark';
const COMPOSER_MAX_HEIGHT = 320;

const dom = {
  appShell: document.querySelector('[data-app-shell]'),
  sidebar: document.getElementById('conversation-rail'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  inspectorBackdrop: document.getElementById('inspector-backdrop'),
  inspectorToggle: document.getElementById('inspector-toggle'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
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
  apiKeySessionCheckbox: document.getElementById('api-key-session'),
  apiBaseUrlInput: document.getElementById('api-base-url'),
  testConnectionBtn: document.getElementById('test-connection'),
  privacyResetBtn: document.getElementById('privacy-reset'),
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
  apiModeSelect: document.getElementById('api-mode'),
  toolChoiceSelect: document.getElementById('tool-choice'),
  parallelToolCallsCheckbox: document.getElementById('parallel-tool-calls'),
  backgroundModeCheckbox: document.getElementById('background-mode'),
  serviceTierSelect: document.getElementById('service-tier'),
  attachmentImageUrlInput: document.getElementById('attachment-image-url'),
  attachmentFileUrlInput: document.getElementById('attachment-file-url'),
  attachmentChips: document.getElementById('attachment-chips'),
  fileSearchCheckbox: document.getElementById('file-search'),
  fileSearchVectorStoresInput: document.getElementById('file-search-vector-stores'),
  fileSearchMaxResultsInput: document.getElementById('file-search-max-results'),
  includeFileSearchResultsCheckbox: document.getElementById('include-file-search-results'),
  imageGenerationCheckbox: document.getElementById('image-generation'),
  imageGenerationActionSelect: document.getElementById('image-generation-action'),
  imageGenerationSizeSelect: document.getElementById('image-generation-size'),
  imageGenerationQualitySelect: document.getElementById('image-generation-quality'),
  imageGenerationPartialImagesInput: document.getElementById('image-generation-partial-images'),
  requestPreview: document.getElementById('request-preview'),
  copyRequestButton: document.getElementById('copy-request'),
  inspectorTabs: document.querySelectorAll('[data-panel-tab]'),
  inspectorSections: document.querySelectorAll('[data-panel-section]'),

  modelPickerOpen: document.getElementById('model-picker-open'),
  activeModel: document.getElementById('active-model'),
  connectionStatus: document.getElementById('connection-status'),
  connectionStatusLabel: document.getElementById('connection-status-label'),
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
  hydratingControls: true,
  inspectorInteractionStarted: false,
  controlSyncTimer: null,
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

const EMPTY_PROMPTS = [
  {
    label: 'Explain code',
    prompt: 'Explain this code clearly and point out any edge cases.',
  },
  {
    label: 'Debug an error',
    prompt: 'Help me debug this error. Ask for missing context if needed.',
  },
  {
    label: 'Summarize text',
    prompt: 'Summarize this into the key points and next actions.',
  },
  {
    label: 'Compare options',
    prompt: 'Compare the best options in a concise table with a recommendation.',
  },
];

const defaultCopy = {
  brand: `**Chat LLM**`,
  helper: ``,
  composer: ``,
  empty: `Start a new conversation`,
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
  writeText(localStorageSafe, THEME_KEY, normalized);

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

function isDesktopSidebarLayout() {
  return window.matchMedia('(min-width: 992px)').matches;
}

function setSidebarCollapsed(collapsed, { persistPreference = true } = {}) {
  const desktop = isDesktopSidebarLayout();
  const shouldCollapse = Boolean(collapsed && desktop);

  dom.appShell?.classList.toggle('sidebar-collapsed', shouldCollapse);

  if (persistPreference) {
    writeText(localStorageSafe, SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
  }

  if (dom.sidebarToggle) {
    dom.sidebarToggle.setAttribute('aria-pressed', shouldCollapse ? 'true' : 'false');
    dom.sidebarToggle.setAttribute('aria-label', shouldCollapse ? 'Expand sidebar' : 'Collapse sidebar');
  }

  if (dom.sidebar) {
    const hidden = shouldCollapse || (!desktop && !dom.sidebar.classList.contains('open'));
    dom.sidebar.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }
}

function syncSidebarPreference() {
  const pref = localStorageSafe?.getItem(SIDEBAR_KEY);
  setSidebarCollapsed(pref === 'collapsed', { persistPreference: false });
}

function toggleSidebarRail() {
  if (!isDesktopSidebarLayout()) {
    openSidebar();
    return;
  }
  setSidebarCollapsed(!dom.appShell?.classList.contains('sidebar-collapsed'));
}

function syncResponsiveChrome() {
  syncInspectorBackdrop();
  syncSidebarPreference();
}

function updateOverlayLock() {
  const locked = Boolean(
    dom.sidebarBackdrop?.classList.contains('open')
    || dom.inspectorBackdrop?.classList.contains('open')
    || dom.drawerBackdrop?.classList.contains('open')
    || dom.modelPickerBackdrop?.classList.contains('open')
    || dom.commandBackdrop?.classList.contains('open'),
  );
  document.body.classList.toggle('overlay-open', locked);
}

function openSidebar() {
  if (isDesktopSidebarLayout()) {
    setSidebarCollapsed(false);
    return;
  }
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
  const hidden = !isDesktopSidebarLayout() || dom.appShell?.classList.contains('sidebar-collapsed');
  dom.sidebar?.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  updateOverlayLock();
}

function shouldOverlayInspector() {
  return window.matchMedia('(max-width: 1320px)').matches;
}

function syncInspectorBackdrop() {
  const isOpen = dom.appShell?.classList.contains('inspector-open');
  const overlay = Boolean(isOpen && shouldOverlayInspector());
  dom.inspectorBackdrop?.classList.toggle('open', overlay);
  if (dom.inspectorBackdrop) dom.inspectorBackdrop.hidden = !overlay;
  updateOverlayLock();
}

function openInspector() {
  closeSidebar();
  dom.appShell?.classList.add('inspector-open');
  dom.inspectorToggle?.setAttribute('aria-expanded', 'true');
  document.getElementById('run-inspector')?.setAttribute('aria-hidden', 'false');
  syncInspectorBackdrop();
}

function closeInspector() {
  dom.appShell?.classList.remove('inspector-open');
  dom.inspectorToggle?.setAttribute('aria-expanded', 'false');
  document.getElementById('run-inspector')?.setAttribute('aria-hidden', 'true');
  dom.inspectorBackdrop?.classList.remove('open');
  if (dom.inspectorBackdrop) dom.inspectorBackdrop.hidden = true;
  updateOverlayLock();
}

function toggleInspector() {
  if (dom.appShell?.classList.contains('inspector-open')) closeInspector();
  else openInspector();
}

function openSettingsDrawer() {
  closeInspector();
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
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
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

function updateConnectionStatus() {
  const ready = Boolean(getApiKey());
  dom.connectionStatus?.classList.toggle('ready', ready);
  if (dom.connectionStatusLabel) dom.connectionStatusLabel.textContent = ready ? 'Ready' : 'No key';
  if (dom.connectionStatus) {
    dom.connectionStatus.title = ready ? 'API key is set for this tab.' : 'Add an API key to send messages.';
  }
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
  if (store.defaults.fileSearch) toolFlags.push('Files');
  if (store.defaults.imageGeneration) toolFlags.push('Images');
  if (dom.workspaceTools) dom.workspaceTools.textContent = toolFlags.length ? toolFlags.join(' + ') : 'Off';
  dom.composerWebToggle?.classList.toggle('active', Boolean(store.defaults.webSearch));
  dom.composerToolsToggle?.classList.toggle('active', Boolean(store.defaults.localTools));
  renderAttachmentChips();
  renderRequestPreview();
  updateConnectionStatus();
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

function parseUrlLines(value) {
  return String(value || '')
    .split(/[\n,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function getInputAttachments() {
  const images = parseUrlLines(store.defaults.inputImageUrls).map((url) => ({
    type: 'input_image',
    image_url: url,
    detail: 'auto',
  }));
  const files = parseUrlLines(store.defaults.inputFileUrls).map((url) => ({
    type: 'input_file',
    file_url: url,
  }));
  return [...images, ...files];
}

function renderAttachmentChips() {
  if (!dom.attachmentChips) return;
  const attachments = getInputAttachments();
  dom.attachmentChips.replaceChildren();
  if (!attachments.length) {
    const empty = document.createElement('span');
    empty.className = 'attachment-empty';
    empty.textContent = 'No turn attachments.';
    dom.attachmentChips.appendChild(empty);
    return;
  }

  attachments.forEach((item, index) => {
    const chip = document.createElement('span');
    chip.className = 'attachment-chip';
    chip.textContent = `${item.type === 'input_image' ? 'Image' : 'File'} ${index + 1}`;
    chip.title = item.image_url || item.file_url || '';
    dom.attachmentChips.appendChild(chip);
  });
}

function buildPreviewBody() {
  const chat = getActiveChat();
  const model = chat?.model || store.defaults.model || DEFAULT_MODEL;
  const sampleInput = chat?.messages?.length
    ? chat.messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-4)
    : [{ role: 'user', content: 'Your next message will appear here.' }];

  return buildResponsesBody({
    model,
    messages: sampleInput,
    instructions: chat?.instructions || '',
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
    fileSearch: store.defaults.fileSearch,
    fileSearchVectorStoreIds: store.defaults.fileSearchVectorStoreIds,
    fileSearchMaxResults: store.defaults.fileSearchMaxResults,
    includeFileSearchResults: store.defaults.includeFileSearchResults,
    imageGeneration: store.defaults.imageGeneration,
    imageGenerationAction: store.defaults.imageGenerationAction,
    imageGenerationSize: store.defaults.imageGenerationSize,
    imageGenerationQuality: store.defaults.imageGenerationQuality,
    imageGenerationPartialImages: store.defaults.imageGenerationPartialImages,
    inputAttachments: getInputAttachments(),
    extraTools: store.defaults.localTools ? getLocalToolDefinitions() : [],
    store: store.defaults.storeResponses,
    includeEncryptedReasoning: isReasoningModel(model) && !store.defaults.storeResponses,
    toolChoice: store.defaults.toolChoice,
    parallelToolCalls: store.defaults.parallelToolCalls,
    background: store.defaults.backgroundMode,
    serviceTier: store.defaults.serviceTier,
  });
}

function renderRequestPreview() {
  if (!dom.requestPreview) return;
  try {
    dom.requestPreview.textContent = JSON.stringify(buildPreviewBody(), null, 2);
  } catch (error) {
    dom.requestPreview.textContent = JSON.stringify({ error: error?.message || String(error) }, null, 2);
  }
}

async function copyRequestPreview() {
  const text = dom.requestPreview?.textContent || JSON.stringify(buildPreviewBody(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('API request copied.', { variant: 'success', timeoutMs: 1200 });
  } catch {
    toast('Copy failed.', { variant: 'warning', timeoutMs: 1800 });
  }
}

function exportCurrentChat() {
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
}

function markInspectorInteraction() {
  runtime.inspectorInteractionStarted = true;
  runtime.hydratingControls = false;
  if (runtime.controlSyncTimer) {
    window.clearInterval(runtime.controlSyncTimer);
    runtime.controlSyncTimer = null;
  }
}

function patchInspectorDefaults() {
  if (runtime.hydratingControls || !runtime.inspectorInteractionStarted) return;
  patchDefaults({
    apiMode: dom.apiModeSelect?.value || store.defaults.apiMode,
    toolChoice: dom.toolChoiceSelect?.value || store.defaults.toolChoice,
    parallelToolCalls: Boolean(dom.parallelToolCallsCheckbox?.checked),
    backgroundMode: Boolean(dom.backgroundModeCheckbox?.checked),
    serviceTier: dom.serviceTierSelect?.value || store.defaults.serviceTier,
    inputImageUrls: String(dom.attachmentImageUrlInput?.value || '').trim(),
    inputFileUrls: String(dom.attachmentFileUrlInput?.value || '').trim(),
    fileSearch: Boolean(dom.fileSearchCheckbox?.checked),
    fileSearchVectorStoreIds: String(dom.fileSearchVectorStoresInput?.value || '').trim(),
    fileSearchMaxResults: Math.max(0, parseInt(dom.fileSearchMaxResultsInput?.value || '0', 10) || 0),
    includeFileSearchResults: Boolean(dom.includeFileSearchResultsCheckbox?.checked),
    imageGeneration: Boolean(dom.imageGenerationCheckbox?.checked),
    imageGenerationAction: dom.imageGenerationActionSelect?.value || store.defaults.imageGenerationAction,
    imageGenerationSize: dom.imageGenerationSizeSelect?.value || store.defaults.imageGenerationSize,
    imageGenerationQuality: dom.imageGenerationQualitySelect?.value || store.defaults.imageGenerationQuality,
    imageGenerationPartialImages: Math.max(0, parseInt(dom.imageGenerationPartialImagesInput?.value || '0', 10) || 0),
  });
  renderWorkspaceSummary();
}

function switchInspectorPanel(panel) {
  const target = String(panel || 'run');
  dom.inspectorTabs?.forEach((btn) => {
    const active = btn.getAttribute('data-panel-tab') === target;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  dom.inspectorSections?.forEach((section) => {
    section.hidden = section.getAttribute('data-panel-section') !== target;
  });
}

function syncControlsFromState() {
  applyStateToSettingsUI();
  renderAttachmentChips();
  renderRequestPreview();
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
    const inner = document.createElement('div');
    inner.className = 'empty-state-inner';

    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';

    const title = document.createElement('h1');
    title.textContent = copyContent.empty || defaultCopy.empty;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choose a starter, apply a workspace, or type your own message.';

    const grid = document.createElement('div');
    grid.className = 'prompt-chip-grid';

    for (const item of EMPTY_PROMPTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-chip';
      btn.textContent = item.label;
      btn.addEventListener('click', () => insertPromptTemplate(item.prompt));
      grid.appendChild(btn);
    }

    const presetStrip = document.createElement('div');
    presetStrip.className = 'preset-strip';
    for (const [name, preset] of Object.entries(WORKSPACE_PRESETS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => applyWorkspacePreset(name));
      presetStrip.appendChild(btn);
    }

    inner.append(icon, title, subtitle, grid, presetStrip);
    empty.replaceChildren(inner);
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
  const artifactsEl = fragment.querySelector('.message-artifacts');
  const traceEl = fragment.querySelector('.message-trace');
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
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.title = 'Copy';
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
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    editBtn.title = 'Edit';
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

  renderMessageArtifacts(artifactsEl, message.artifacts || []);
  renderMessageTrace(traceEl, message.trace || []);

  dom.conversationInner.appendChild(fragment);
  requestAnimationFrame(() => messageEl.classList.add('appear'));
  renderEmptyState();
  scrollConversationToBottom();
  updateScrollButton();
  return { messageEl, contentEl, metaEl, footerEl };
}

function renderMessageArtifacts(container, artifacts) {
  if (!container) return;
  container.replaceChildren();
  const list = Array.isArray(artifacts) ? artifacts : [];
  container.hidden = !list.length;
  if (!list.length) return;

  for (const artifact of list) {
    if (!artifact || artifact.type !== 'image' || !artifact.data) continue;

    const figure = document.createElement('figure');
    figure.className = 'artifact-figure';

    const img = document.createElement('img');
    img.alt = artifact.revisedPrompt || 'Generated image';
    img.loading = 'lazy';
    img.src = `data:${artifact.mimeType || 'image/png'};base64,${artifact.data}`;
    figure.appendChild(img);

    if (artifact.revisedPrompt) {
      const caption = document.createElement('figcaption');
      caption.textContent = artifact.revisedPrompt;
      figure.appendChild(caption);
    }

    const actions = document.createElement('div');
    actions.className = 'artifact-actions mt-2';
    const download = document.createElement('a');
    download.className = 'btn btn-sm btn-outline-secondary';
    download.href = img.src;
    download.download = 'chat-llm-image.png';
    download.textContent = 'Download image';
    actions.appendChild(download);
    figure.appendChild(actions);

    container.appendChild(figure);
  }
}

function renderMessageTrace(container, trace) {
  if (!container) return;
  const items = Array.isArray(trace) ? trace : [];
  container.replaceChildren();
  container.hidden = !items.length;
  if (!items.length) return;

  const label = document.createElement('span');
  label.className = 'trace-label';
  label.textContent = 'Run: ';
  container.appendChild(label);

  items.slice(-8).forEach((item, index) => {
    if (index) container.append(document.createTextNode(' · '));
    const chip = document.createElement('span');
    chip.className = `trace-chip trace-${item.status || 'info'}`;
    chip.dataset.kind = item.status || 'info';
    chip.textContent = item.label || item.type || 'event';
    chip.title = item.detail || '';
    container.appendChild(chip);
  });
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
  if (dom.clearChatButton) dom.clearChatButton.hidden = !chat?.messages?.length;
  if (dom.regenerateButton) dom.regenerateButton.hidden = !hasUser || runtime.isProcessing;
}

function applyStateToSettingsUI() {
  const chat = getActiveChat();
  if (!chat) return;

  dom.apiKeyInput.value = getApiKey();
  if (dom.apiKeySessionCheckbox) dom.apiKeySessionCheckbox.checked = store.defaults.keyPersistence === 'session';
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
  if (dom.apiModeSelect) dom.apiModeSelect.value = store.defaults.apiMode || 'responses';
  if (dom.toolChoiceSelect) dom.toolChoiceSelect.value = store.defaults.toolChoice || 'auto';
  if (dom.parallelToolCallsCheckbox) dom.parallelToolCallsCheckbox.checked = store.defaults.parallelToolCalls !== false;
  if (dom.backgroundModeCheckbox) dom.backgroundModeCheckbox.checked = Boolean(store.defaults.backgroundMode);
  if (dom.serviceTierSelect) dom.serviceTierSelect.value = store.defaults.serviceTier || 'auto';
  if (dom.attachmentImageUrlInput) dom.attachmentImageUrlInput.value = store.defaults.inputImageUrls || '';
  if (dom.attachmentFileUrlInput) dom.attachmentFileUrlInput.value = store.defaults.inputFileUrls || '';
  if (dom.fileSearchCheckbox) dom.fileSearchCheckbox.checked = Boolean(store.defaults.fileSearch);
  if (dom.fileSearchVectorStoresInput) dom.fileSearchVectorStoresInput.value = store.defaults.fileSearchVectorStoreIds || '';
  if (dom.fileSearchMaxResultsInput) dom.fileSearchMaxResultsInput.value = String(store.defaults.fileSearchMaxResults ?? 0);
  if (dom.includeFileSearchResultsCheckbox) dom.includeFileSearchResultsCheckbox.checked = Boolean(store.defaults.includeFileSearchResults);
  if (dom.imageGenerationCheckbox) dom.imageGenerationCheckbox.checked = Boolean(store.defaults.imageGeneration);
  if (dom.imageGenerationActionSelect) dom.imageGenerationActionSelect.value = store.defaults.imageGenerationAction || 'auto';
  if (dom.imageGenerationSizeSelect) dom.imageGenerationSizeSelect.value = store.defaults.imageGenerationSize || 'auto';
  if (dom.imageGenerationQualitySelect) dom.imageGenerationQualitySelect.value = store.defaults.imageGenerationQuality || 'auto';
  if (dom.imageGenerationPartialImagesInput) dom.imageGenerationPartialImagesInput.value = String(store.defaults.imageGenerationPartialImages ?? 0);
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

  const addAction = (label, run, meta = 'Action') => items.push({ type: 'action', label, meta, run });
  addAction('New chat', () => handleNewChat(), 'Chat');
  addAction('Choose model', () => openModelPicker(), 'Model');
  addAction('Open API playground', () => openInspector(), 'API');
  addAction('Copy API request', () => copyRequestPreview(), 'API');
  addAction('Open settings', () => openSettingsDrawer(), 'Setup');
  addAction('Privacy reset', () => privacyReset(), 'Safety');
  addAction('Toggle sidebar', () => toggleSidebarRail(), 'View');
  addAction('Toggle theme', () => applyTheme(document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'), 'View');
  addAction(`${store.defaults.webSearch ? 'Disable' : 'Enable'} web search`, () => {
    patchDefaults({ webSearch: !store.defaults.webSearch });
    applyStateToSettingsUI();
  }, 'Tool');
  addAction(`${store.defaults.localTools ? 'Disable' : 'Enable'} local tools`, () => {
    patchDefaults({ localTools: !store.defaults.localTools });
    applyStateToSettingsUI();
  }, 'Tool');
  addAction('Apply Writing workspace', () => applyWorkspacePreset('writing'), 'Preset');
  addAction('Apply Coding workspace', () => applyWorkspacePreset('coding'), 'Preset');
  addAction('Apply Research workspace', () => applyWorkspacePreset('research'), 'Preset');

  const chat = getActiveChat();
  if (chat?.messages?.some((m) => m.role === 'user')) addAction('Regenerate response', () => regenerateLast(), 'Chat');
  if (chat?.messages?.length) addAction('Export chat', () => exportCurrentChat(), 'Chat');
  if (chat?.messages?.length) addAction('Clear current chat', () => clearChat());

  const chats = listChats({ query: q });
  for (const c of chats) items.push({ type: 'chat', label: c.title, chatId: c.id, meta: c.model });

  const filtered = q
    ? items.filter((i) => `${i.label} ${i.meta || ''}`.toLowerCase().includes(q) || i.type === 'chat')
    : items;

  runtime.selectedCommandIndex = filtered.length
    ? Math.max(0, Math.min(runtime.selectedCommandIndex, filtered.length - 1))
    : 0;

  filtered.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `command-item ${index === runtime.selectedCommandIndex ? 'active' : ''}`;
    btn.dataset.index = String(index);
    btn.dataset.kind = item.type;
    if (item.chatId) btn.dataset.chatId = item.chatId;
    btn.setAttribute('aria-label', `${item.label || 'Untitled'} ${item.meta || item.type}`);

    const label = document.createElement('span');
    label.className = 'command-label';
    label.textContent = item.label || 'Untitled';

    const meta = document.createElement('span');
    meta.className = 'command-meta';
    meta.textContent = item.meta || item.type;

    btn.append(label, meta);

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

async function privacyReset() {
  const ok = await confirmDialog({
    title: 'Privacy reset?',
    message: 'This clears the API key, chats, settings, cached model list, and local app state in this browser.',
    confirmText: 'Reset',
    danger: true,
  });
  if (!ok) return;
  clearApiKey();
  resetStore();
  setApiKeyPersistence(store.defaults.keyPersistence || 'memory');
  updateHeader();
  applyStateToSettingsUI();
  renderConversation();
  renderChatList();
  toast('Local app data cleared.', { variant: 'success', timeoutMs: 1600 });
}

async function ensureRequestAllowed(chat) {
  const model = chat?.model || store.defaults.model || DEFAULT_MODEL;
  const result = assessRequestPreflight({
    defaults: store.defaults,
    model,
    baseUrl: store.defaults.apiBaseUrl,
    locationLike: window.location,
  });

  if (result.status === 'block') {
    toast(result.blocks.join(' '), { title: 'Request blocked', variant: 'warning', timeoutMs: 6200 });
    return false;
  }

  if (result.status === 'confirm') {
    const ok = await confirmDialog({
      title: 'Confirm request settings',
      message: result.confirmations.join('\n\n'),
      confirmText: 'Send',
      danger: true,
    });
    return ok;
  }

  return true;
}

async function generateAssistant() {
  const chat = getActiveChat();
  const apiKey = getApiKey();
  if (!chat || !apiKey) return;

  const allowed = await ensureRequestAllowed(chat);
  if (!allowed) return;

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
  let artifacts = [];
  let responseId = null;
  let usage = null;
  const runTrace = [];
  const addTrace = (type, label, detail = '', status = 'info') => {
    runTrace.push({ type, label, detail, status, createdAt: nowMs() });
  };

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
      fileSearch: store.defaults.fileSearch,
      fileSearchVectorStoreIds: store.defaults.fileSearchVectorStoreIds,
      fileSearchMaxResults: store.defaults.fileSearchMaxResults,
      includeFileSearchResults: store.defaults.includeFileSearchResults,
      imageGeneration: store.defaults.imageGeneration,
      imageGenerationAction: store.defaults.imageGenerationAction,
      imageGenerationSize: store.defaults.imageGenerationSize,
      imageGenerationQuality: store.defaults.imageGenerationQuality,
      imageGenerationPartialImages: store.defaults.imageGenerationPartialImages,
      inputAttachments: getInputAttachments(),
      extraTools,
      store: store.defaults.storeResponses,
      includeEncryptedReasoning: isReasoningModel(model) && !store.defaults.storeResponses,
      toolChoice: store.defaults.toolChoice,
      parallelToolCalls: store.defaults.parallelToolCalls,
      background: store.defaults.backgroundMode,
      serviceTier: store.defaults.serviceTier,
    };

    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
    const statefulBody = store.defaults.storeResponses && chat.previousResponseId && lastUser
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
            const extracted = extractTextAndAnnotationsFromResponse(evt.response);
            if (!outputText && extracted.outputText) outputText = extracted.outputText;
            if (!reasoningSummary && extracted.reasoningSummary) reasoningSummary = extracted.reasoningSummary;
            if (extracted.annotations.length) annotations = extracted.annotations;
            if (extracted.artifacts?.length) artifacts = extracted.artifacts;
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
          addTrace('tool_call', `tool ${c.name}`, c.arguments || '', 'info');
          try {
            const out = await runLocalToolCall({ name: c.name, argumentsJson: c.arguments });
            outputs.push({ type: 'function_call_output', call_id: c.call_id, output: out });
            addTrace('tool_result', `${c.name} ok`, out, 'success');
          } catch (e) {
            const formatted = formatToolError(e);
            outputs.push({ type: 'function_call_output', call_id: c.call_id, output: formatted });
            addTrace('tool_error', `${c.name} error`, e?.message || String(e), 'error');
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
    let usedStatefulFallback = false;
    for (const attempt of bodies) {
      try {
        ran = true;
        addTrace('request', attempt.kind === 'stateful' ? 'stateful request' : 'history request', '', 'info');
        await runWithLocalTools(attempt.body);
        lastErr = null;
        break;
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        lastErr = err;
        if (attempt.kind === 'stateful') {
          // If stateful chaining fails, drop the chain and retry with full history.
          usedStatefulFallback = true;
          addTrace('fallback', 'retried with history', err?.message || String(err), 'warning');
          setChatPreviousResponseId(chat.id, null);
          outputText = '';
          reasoningSummary = '';
          annotations = [];
          artifacts = [];
          responseId = null;
          usage = null;
          continue;
        }
      }
    }

    if (!ran) throw new Error('No request was sent.');
    if (lastErr) throw lastErr;
    if (usedStatefulFallback) {
      toast('Stored response chain failed; retried with full local history.', { title: 'State reset', variant: 'warning', timeoutMs: 3600 });
    }
    addTrace('completed', 'completed', '', 'success');

    if (!outputText.trim() && !artifacts.length) throw new Error('Received an empty response.');
    if (!outputText.trim() && artifacts.length) outputText = 'Generated image artifact.';

    if (store.defaults.storeResponses && responseId) {
      try {
        const full = await fetchResponseById({ apiKey, baseUrl: store.defaults.apiBaseUrl, responseId });
        const extracted = extractTextAndAnnotationsFromResponse(full);
        if (extracted.outputText) outputText = extracted.outputText;
        if (extracted.reasoningSummary) reasoningSummary = extracted.reasoningSummary;
        if (extracted.annotations.length) annotations = extracted.annotations;
        if (extracted.artifacts?.length) artifacts = extracted.artifacts;
        usage = full?.usage || usage;
      } catch {
        // ignore
      }
    }

    const finalMsg = {
      content: outputText,
      responseId: store.defaults.storeResponses ? responseId || undefined : undefined,
      annotations,
      artifacts,
      reasoningSummary,
      usage,
      trace: runTrace,
    };

    updateMessage(chat.id, assistantMsg.id, finalMsg);

    const md = buildAssistantMarkdown({ ...assistantMsg, ...finalMsg });
    applyMarkdown(contentEl, md);
    renderMessageArtifacts(messageEl.querySelector('.message-artifacts'), artifacts);
    renderMessageTrace(messageEl.querySelector('.message-trace'), runTrace);
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
      addTrace('cancelled', 'cancelled', '', 'warning');
      const cancelled = `${outputText}\n\n[Cancelled]`.trim();
      updateMessage(chat.id, assistantMsg.id, { content: cancelled, trace: runTrace });
      setPlainText(contentEl, cancelled);
      renderMessageTrace(messageEl.querySelector('.message-trace'), runTrace);
      if (metaEl) metaEl.textContent = `${chat.model} • cancelled`;
    } else {
      addTrace('error', 'error', error?.message || String(error), 'error');
      let detail = error?.message || String(error);
      if (detail === 'Failed to fetch' || detail === 'Load failed') {
        detail = 'Network error (Failed to fetch). Check your connection, API key, and API base URL (Settings → API).';
      }
      const msg = `Warning: ${detail}`;
      updateMessage(chat.id, assistantMsg.id, { content: msg, trace: runTrace });
      setPlainText(contentEl, msg);
      renderMessageTrace(messageEl.querySelector('.message-trace'), runTrace);
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
  const preflight = assessRequestPreflight({
    defaults: { ...store.defaults, apiBaseUrl: baseUrl, apiMode: 'responses' },
    model: getActiveChat()?.model || store.defaults.model || DEFAULT_MODEL,
    baseUrl,
    locationLike: window.location,
  });
  if (preflight.status === 'block') {
    toast(preflight.blocks.join(' '), { title: 'Connection blocked', variant: 'warning', timeoutMs: 5200 });
    return;
  }

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
  window.addEventListener('chat-llm-storage-error', () => {
    toast('Browser storage is full or unavailable. Export or clear chats, then try again.', {
      title: 'Storage warning',
      variant: 'warning',
      timeoutMs: 5200,
    });
  });

  dom.sidebarToggle?.addEventListener('click', toggleSidebarRail);
  dom.sidebarOpen?.addEventListener('click', openSidebar);
  dom.sidebarClose?.addEventListener('click', closeSidebar);
  dom.sidebarBackdrop?.addEventListener('click', closeSidebar);
  dom.inspectorToggle?.addEventListener('click', toggleInspector);
  dom.inspectorBackdrop?.addEventListener('click', closeInspector);
  window.addEventListener('resize', debounce(syncResponsiveChrome, 80));
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
  dom.settingsCloseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeSettingsDrawer();
  }, { capture: true });
  dom.drawerBackdrop?.addEventListener('click', closeSettingsDrawer);
  dom.testConnectionBtn?.addEventListener('click', testConnection);
  dom.privacyResetBtn?.addEventListener('click', privacyReset);
  dom.connectionStatus?.addEventListener('click', () => {
    closeSidebar();
    openSettingsDrawer();
  });

  dom.settingsDrawer?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-settings-jump]');
    if (!btn) return;
    const id = btn.getAttribute('data-settings-jump');
    const el = id ? document.getElementById(id) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  dom.settingsForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    const keyPersistence = dom.apiKeySessionCheckbox?.checked ? 'session' : 'memory';
    setApiKey(dom.apiKeyInput?.value || '', { persistence: keyPersistence });

    patchDefaults({
      apiBaseUrl: normalizeBaseUrl(dom.apiBaseUrlInput?.value || store.defaults.apiBaseUrl),
      keyPersistence,
      temperature: Number(dom.temperatureInput?.value),
      topP: Number(dom.topPInput?.value),
      maxOutputTokens: Math.max(0, parseInt(dom.maxOutputTokensInput?.value || '0', 10) || 0),
      reasoningEffort: dom.reasoningEffortSelect?.value || store.defaults.reasoningEffort,
      reasoningSummary: dom.reasoningSummarySelect?.value || store.defaults.reasoningSummary,
      textVerbosity: dom.textVerbositySelect?.value || store.defaults.textVerbosity,
      truncation: dom.truncationSelect?.value || store.defaults.truncation,
      maxToolCalls: Math.max(0, parseInt(dom.maxToolCallsInput?.value || '0', 10) || 0),
      apiMode: dom.apiModeSelect?.value || store.defaults.apiMode,
      toolChoice: dom.toolChoiceSelect?.value || store.defaults.toolChoice,
      parallelToolCalls: Boolean(dom.parallelToolCallsCheckbox?.checked),
      backgroundMode: Boolean(dom.backgroundModeCheckbox?.checked),
      serviceTier: dom.serviceTierSelect?.value || store.defaults.serviceTier,
      promptCacheKey: String(dom.promptCacheKeyInput?.value || '').trim(),
      promptCacheRetention: dom.promptCacheRetentionSelect?.value || '',
      safetyIdentifier: String(dom.safetyIdentifierInput?.value || '').trim(),
      webSearch: Boolean(dom.webSearchCheckbox?.checked),
      webSearchAllowedDomains: String(dom.webSearchDomainsInput?.value || '').trim(),
      webSearchBlockedDomains: String(dom.webSearchBlockedDomainsInput?.value || '').trim(),
      webSearchContextSize: dom.webSearchContextSizeSelect?.value || store.defaults.webSearchContextSize,
      webSearchExternalAccess: Boolean(dom.webSearchExternalAccessCheckbox?.checked),
      webSearchReturnTokenBudget: dom.webSearchReturnTokenBudgetSelect?.value || store.defaults.webSearchReturnTokenBudget,
      fileSearch: Boolean(dom.fileSearchCheckbox?.checked),
      fileSearchVectorStoreIds: String(dom.fileSearchVectorStoresInput?.value || '').trim(),
      fileSearchMaxResults: Math.max(0, parseInt(dom.fileSearchMaxResultsInput?.value || '0', 10) || 0),
      includeFileSearchResults: Boolean(dom.includeFileSearchResultsCheckbox?.checked),
      imageGeneration: Boolean(dom.imageGenerationCheckbox?.checked),
      imageGenerationAction: dom.imageGenerationActionSelect?.value || store.defaults.imageGenerationAction,
      imageGenerationSize: dom.imageGenerationSizeSelect?.value || store.defaults.imageGenerationSize,
      imageGenerationQuality: dom.imageGenerationQualitySelect?.value || store.defaults.imageGenerationQuality,
      imageGenerationPartialImages: Math.max(0, parseInt(dom.imageGenerationPartialImagesInput?.value || '0', 10) || 0),
      inputImageUrls: String(dom.attachmentImageUrlInput?.value || '').trim(),
      inputFileUrls: String(dom.attachmentFileUrlInput?.value || '').trim(),
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
    const preflight = assessRequestPreflight({
      defaults: store.defaults,
      model: getActiveChat()?.model || store.defaults.model || DEFAULT_MODEL,
      baseUrl: store.defaults.apiBaseUrl,
      locationLike: window.location,
    });
    if (preflight.status === 'block') {
      toast(preflight.blocks.join(' '), { title: 'Refresh blocked', variant: 'warning', timeoutMs: 5200 });
      return;
    }
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
  dom.copyRequestButton?.addEventListener('click', copyRequestPreview);

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
  dom.inspectorTabs?.forEach((btn) => {
    btn.addEventListener('click', () => switchInspectorPanel(btn.getAttribute('data-panel-tab')));
  });
  [
    dom.apiModeSelect,
    dom.toolChoiceSelect,
    dom.parallelToolCallsCheckbox,
    dom.backgroundModeCheckbox,
    dom.serviceTierSelect,
    dom.attachmentImageUrlInput,
    dom.attachmentFileUrlInput,
    dom.fileSearchCheckbox,
    dom.fileSearchVectorStoresInput,
    dom.fileSearchMaxResultsInput,
    dom.includeFileSearchResultsCheckbox,
    dom.imageGenerationCheckbox,
    dom.imageGenerationActionSelect,
    dom.imageGenerationSizeSelect,
    dom.imageGenerationQualitySelect,
    dom.imageGenerationPartialImagesInput,
  ].forEach((control) => {
    control?.addEventListener('pointerdown', markInspectorInteraction);
    control?.addEventListener('keydown', markInspectorInteraction);
    control?.addEventListener('change', patchInspectorDefaults);
    if (control?.tagName === 'TEXTAREA' || control?.tagName === 'INPUT') {
      control.addEventListener('input', debounce(patchInspectorDefaults, 160));
    }
  });

  dom.exportChatButton?.addEventListener('click', exportCurrentChat);

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
      if (dom.appShell?.classList.contains('inspector-open')) return closeInspector();
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
  if (runtime.controlSyncTimer) {
    window.clearInterval(runtime.controlSyncTimer);
    runtime.controlSyncTimer = null;
  }
  runtime.hydratingControls = true;
  runtime.inspectorInteractionStarted = false;
  loadThemePreference();
  syncSidebarPreference();
  configureMarkdown();
  load();
  setApiKeyPersistence(store.defaults.keyPersistence || 'memory');
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
  if (dom.toolTimezoneOutput) runClockWidget();

  bindUI();
  switchInspectorPanel('run');
  requestAnimationFrame(syncControlsFromState);
  [120, 500, 1200, 2400].forEach((delay) => window.setTimeout(syncControlsFromState, delay));
  runtime.controlSyncTimer = window.setInterval(() => {
    if (runtime.inspectorInteractionStarted) {
      window.clearInterval(runtime.controlSyncTimer);
      runtime.controlSyncTimer = null;
      return;
    }
    syncControlsFromState();
  }, 500);
  window.setTimeout(() => {
    syncControlsFromState();
    runtime.hydratingControls = false;
  }, 3200);
  window.setTimeout(() => {
    if (runtime.controlSyncTimer) {
      window.clearInterval(runtime.controlSyncTimer);
      runtime.controlSyncTimer = null;
    }
  }, 15000);
}
