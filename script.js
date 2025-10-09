(() => {
  const dom = {
    conversation: document.getElementById('conversation'),
    messageTemplate: document.getElementById('message-template'),
    composerForm: document.getElementById('composer-form'),
    userInput: document.getElementById('user-input'),
    sendButton: document.getElementById('send-button'),
    settingsForm: document.getElementById('settings-form'),
    apiKeyInput: document.getElementById('api-key'),
    modelSelect: document.getElementById('model'),
    temperatureInput: document.getElementById('temperature'),
    settingsDrawer: document.getElementById('settings-drawer'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    settingsOpenBtn: document.getElementById('settings-open'),
    settingsCloseBtn: document.getElementById('settings-close'),
    systemForm: document.getElementById('system-form'),
    systemPromptUI: document.getElementById('system-prompt-ui'),
    systemStatus: document.getElementById('system-status'),
    systemCard: document.getElementById('system-card'),
    brandCopy: document.querySelector('[data-copy="brand"]'),
    helperCopy: document.querySelector('[data-copy="helper"]'),
    composerHint: document.querySelector('[data-copy="composer"]'),
    themeToggle: document.getElementById('theme-toggle'),
    conversationInner: document.getElementById('conversation-inner')
  };

  const state = {
    history: [],
    isProcessing: false,
    settings: {
      apiKey: '',
      systemPrompt: '',
      model: 'gpt-4.1-mini',
      temperature: 1.0
    }
  };

  const defaultCopy = {
    brand: `**OpenAI Chat**

Talk with the OpenAI chat.completions API.`,
    helper: `_Key is kept only for this browser session. Provide it again whenever you reload._`,
    composer: `_Shift + Enter inserts a new line. You can paste code snippets or Markdown for better formatting._`,
    empty: `# Talk to LLM through API by simple configuration.

Quick start:
- Set OPENAI_API_KEY in your environment or paste it in the session helper.
- Choose model, temperature, and max tokens in the configuration.
- Send a chat message and receive the completion (supports streaming).

Example curl:
\`\`\`bash
curl https://api.openai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4.1-mini","messages":[{"role":"user","content":"Say hello"}]}'
\`\`\`

Tips:
- Use lower temperature (0.0-0.3) for deterministic outputs.
- Use system messages for high-level instructions and behavior.`
  };

  let copyContent = { ...defaultCopy };
  let emptyStateMarkdown = copyContent.empty;

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state w-100 text-center text-body-secondary py-5 px-3';

  const storage = (() => {
    try {
      return window.localStorage;
    } catch (error) {
      console.warn('localStorage unavailable', error);
      return null;
    }
  })();

  const THEME_KEY = 'chat_theme_preference';
  const COMPOSER_MAX_HEIGHT = 320;
  const STORAGE_KEYS = {
    systemPrompt: 'chat_system_prompt',
  };
  const PRISM_LIGHT_ID = 'prism-light';
  const PRISM_DARK_ID = 'prism-dark';

  function configureMarkdown() {
    if (window.marked) {
      const renderer = new window.marked.Renderer();
      const originalLink = renderer.link;

      renderer.link = function linkRenderer(href, title, text) {
        const html = originalLink.call(this, href, title, text);
        if (href && /^https?:/i.test(href)) {
          return html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
        }
        return html;
      };

      function normalizeLanguage(lang) {
        if (!lang) return '';
        const l = String(lang).toLowerCase().trim();
        const map = {
          js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
          sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
          py: 'python',
          yml: 'yaml',
          md: 'markdown'
        };
        return map[l] || l;
      }

      // Normalize language for Prism but let Marked output default
      const originalCode = renderer.code;
      renderer.code = function codeRenderer(code, infoString, escaped) {
        const lang = normalizeLanguage(infoString);
        return originalCode.call(this, code, lang, escaped);
      };

      window.marked.setOptions({
        breaks: true,
        gfm: true,
        mangle: false,
        headerIds: false,
        renderer
      });
    }

    // Prism does not need configuration here; we'll highlight after insertion
  }

  function renderMarkdown(text) {
    if (!window.marked || !window.DOMPurify) {
      return text;
    }
    const raw = window.marked.parse(text);
    return window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }

  function enhanceCodeBlocks(element) {
    if (!element) return;
    const blocks = element.querySelectorAll('pre > code');
    blocks.forEach(code => {
      const pre = code.parentElement;
      if (!pre || pre.dataset.copyDecorated === 'true') return;
      pre.dataset.copyDecorated = 'true';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-secondary copy-btn d-inline-flex align-items-center gap-1';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span class="visually-hidden">Copy</span>';
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const text = code.textContent || '';
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.innerHTML;
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span class="visually-hidden">Copied</span>';
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-success');
          setTimeout(() => {
            btn.innerHTML = prev;
            btn.classList.add('btn-outline-secondary');
            btn.classList.remove('btn-success');
          }, 1200);
        } catch (err) {
          console.warn('Copy failed', err);
        }
      });
      pre.appendChild(btn);
    });
  }

  function applyMarkdown(element, markdown) {
    if (!element) return;
    element.innerHTML = renderMarkdown(markdown);
    // Highlight code blocks within this element using Prism
    if (window.Prism?.highlightAllUnder) {
      window.Prism.highlightAllUnder(element);
    }
    enhanceCodeBlocks(element);
  }

  function parseCopySections(source) {
    const pattern = /\[(\w+)\]([\s\S]*?)\[\/\1\]/g;
    const sections = {};
    let match;
    while ((match = pattern.exec(source))) {
      sections[match[1]] = match[2].trim();
    }
    return sections;
  }

  function applyTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', normalized);
    if (dom.themeToggle) {
      dom.themeToggle.setAttribute('aria-pressed', normalized === 'dark' ? 'true' : 'false');
      dom.themeToggle.setAttribute('title', normalized === 'dark' ? 'Switch to light' : 'Switch to dark');
      dom.themeToggle.setAttribute('aria-label', normalized === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      dom.themeToggle.classList.toggle('btn-outline-secondary', normalized !== 'dark');
      dom.themeToggle.classList.toggle('btn-outline-light', normalized === 'dark');
    }
    if (storage) {
      storage.setItem(THEME_KEY, normalized);
    }

    // Toggle PrismCSS styles to match theme for uniform code blocks
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
    const stored = storage?.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      applyTheme(stored);
    } else {
      applyTheme(document.documentElement.getAttribute('data-bs-theme') || 'light');
    }
  }

  function handleThemeToggle() {
    const current = document.documentElement.getAttribute('data-bs-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function mergeCopy(markdownText) {
    if (!markdownText) return false;
    const sections = parseCopySections(markdownText);
    if (!Object.keys(sections).length) {
      return false;
    }
    copyContent = { ...copyContent, ...sections };
    if (sections.empty) {
      emptyStateMarkdown = sections.empty;
    }
    applyCopy();
    return true;
  }

  async function loadCopy() {
    const inlineScript = document.getElementById('copy-inline');
    const inlineText = inlineScript ? inlineScript.textContent.trim() : '';
    mergeCopy(inlineText);

    if (!window.fetch || window.location.protocol === 'file:') {
      return;
    }

    try {
      const response = await fetch('content.md', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const text = await response.text();
      mergeCopy(text);
    } catch (error) {
      if (!inlineText) {
        console.warn('content.md could not be loaded; falling back to defaults.', error);
        applyCopy();
      }
    }
  }

  function applyCopy() {
    if (dom.brandCopy) {
      applyMarkdown(dom.brandCopy, copyContent.brand);
    }
    if (dom.helperCopy) {
      applyMarkdown(dom.helperCopy, copyContent.helper);
    }
    if (dom.composerHint) {
      applyMarkdown(dom.composerHint, copyContent.composer);
    }
    updateEmptyState();
  }

  function updateEmptyState() {
    const container = dom.conversationInner || dom.conversation;
    const hasMessages = state.history.length > 0 || container?.querySelector('.message');
    emptyState.hidden = hasMessages;
    if (!emptyState.isConnected && container) {
      container.appendChild(emptyState);
    }
    if (!hasMessages) {
      const markdownHolder = document.createElement('div');
      markdownHolder.className = 'markdown-body mx-auto text-start';
      markdownHolder.style.maxWidth = 'var(--content-max)';
      applyMarkdown(markdownHolder, emptyStateMarkdown);
      emptyState.replaceChildren(markdownHolder);
    }
  }

  function scrollConversationToBottom() {
    dom.conversation.scrollTo({
      top: dom.conversation.scrollHeight,
      behavior: 'smooth'
    });
  }

  function createMessageElement(role, { content = '', status = '', isLoading = false } = {}) {
    const fragment = dom.messageTemplate.content.cloneNode(true);
    const messageEl = fragment.querySelector('.message');
    const avatarEl = fragment.querySelector('.avatar');
    const roleEl = fragment.querySelector('.role');
    const statusEl = fragment.querySelector('.status');
    const metadataEl = fragment.querySelector('.message-metadata');
    const cardEl = fragment.querySelector('.card');
    const contentEl = fragment.querySelector('.message-content');
    messageEl.classList.add(role);
    avatarEl.textContent = role === 'user' ? 'You' : 'AI';
    avatarEl.setAttribute('aria-label', role === 'user' ? 'You' : 'Assistant');
    roleEl.textContent = role === 'user' ? 'You' : 'Assistant';
    contentEl.classList.add('markdown-body');

    avatarEl.className = 'avatar rounded-circle d-flex align-items-center justify-content-center fw-semibold';
    cardEl.className = 'card shadow-sm border-0 flex-grow-1';
    metadataEl.className = 'message-metadata d-flex gap-2 small text-body-secondary mb-2';
    statusEl.className = 'status text-body-secondary';

    if (role === 'user') {
      avatarEl.classList.add('bg-dark', 'text-white');
    } else {
      avatarEl.classList.add('bg-primary-subtle', 'text-primary');
    }

    if (status) {
      statusEl.textContent = status;
      statusEl.hidden = false;
      statusEl.setAttribute('aria-hidden', 'false');
    } else {
      statusEl.hidden = true;
      statusEl.setAttribute('aria-hidden', 'true');
    }

    if (content) {
      applyMarkdown(contentEl, content);
    }

    if (isLoading) {
      messageEl.dataset.loading = 'true';
    }

    const container = dom.conversationInner || dom.conversation;
    container.appendChild(fragment);
    // smooth appear
    requestAnimationFrame(() => {
      messageEl.classList.add('appear');
    });
    scrollConversationToBottom();
    updateEmptyState();
    return messageEl;
  }

  function updateMessageElement(messageEl, { content, status, isLoading }) {
    const statusEl = messageEl.querySelector('.status');
    const contentEl = messageEl.querySelector('.message-content');
    const metadataEl = messageEl.querySelector('.message-metadata');
    const cardEl = messageEl.querySelector('.card');

    if (metadataEl) {
      metadataEl.classList.remove('text-white-50', 'text-body-secondary');
      metadataEl.classList.add('text-body-secondary');
    }

    if (cardEl) {
      cardEl.className = 'card shadow-sm border-0 flex-grow-1';
    }

    if (statusEl) {
      statusEl.classList.remove('text-white-50', 'text-body-secondary');
      statusEl.classList.add('text-body-secondary');
    }

    if (typeof status !== 'undefined') {
      if (status) {
        if (statusEl) {
          statusEl.textContent = status;
          statusEl.hidden = false;
          statusEl.setAttribute('aria-hidden', 'false');
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.hidden = true;
          statusEl.setAttribute('aria-hidden', 'true');
        }
      }
    }

    if (typeof content !== 'undefined') {
      applyMarkdown(contentEl, content);
    }

    if (typeof isLoading !== 'undefined') {
      if (isLoading) {
        messageEl.dataset.loading = 'true';
      } else {
        delete messageEl.dataset.loading;
      }
    }

    scrollConversationToBottom();
  }

  function applySettingsToForm() {
    dom.apiKeyInput.value = state.settings.apiKey;
    dom.modelSelect.value = state.settings.model;
    dom.temperatureInput.value = state.settings.temperature;
  }

  function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
    const hasMessage = Boolean(dom.userInput.value.trim());
    dom.sendButton.disabled = isProcessing || !hasMessage;
    dom.userInput.disabled = isProcessing;
    if (!isProcessing) {
      dom.userInput.focus();
      autoResizeTextarea();
    }
  }

  function modelSupportsTemperature(model) {
    return !(model?.startsWith('gpt-5'));
  }

  function applyModelAffordances() {
    const model = dom.modelSelect.value;
    const supportsTemp = modelSupportsTemperature(model);
    dom.temperatureInput.disabled = !supportsTemp;
    const wrapper = dom.temperatureInput.closest('.d-grid');
    if (wrapper) {
      wrapper.classList.toggle('opacity-50', !supportsTemp);
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || state.isProcessing) return;

    createMessageElement('user', { content: trimmed });

    const assistantMessage = createMessageElement('assistant', {
      content: '',
      status: 'Thinking…',
      isLoading: true
    });

    const { apiKey, model, temperature } = state.settings;

    if (!apiKey) {
      updateMessageElement(assistantMessage, {
        content: 'Please add your OpenAI API key in the settings before sending messages.',
        status: '',
        isLoading: false
      });
      return;
    }

    state.history.push({ role: 'user', content: trimmed });
    setProcessing(true);

    try {
      const requestBody = {
        model,
        // Prepend system prompt if non-empty
        messages: (state.settings.systemPrompt?.trim())
          ? [{ role: 'system', content: state.settings.systemPrompt.trim() }, ...state.history]
          : [...state.history]
      };
      if (modelSupportsTemperature(model)) {
        requestBody.temperature = temperature;
      }

      // Streaming fetch
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ ...requestBody, stream: true })
      });

      if (!response.ok) {
        let errorMessage = response.statusText || 'Request failed';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error?.message || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming is not supported in this environment.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';
      updateMessageElement(assistantMessage, { status: 'Streaming…', isLoading: true });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            break;
          }
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const contentPiece = delta?.content || '';
            if (contentPiece) {
              fullText += contentPiece;
              updateMessageElement(assistantMessage, { content: fullText, status: 'Streaming…', isLoading: true });
            }
          } catch (_) {
            // ignore malformed lines
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error('Received an empty response from the API.');
      }

      state.history.push({ role: 'assistant', content: fullText });
      updateMessageElement(assistantMessage, { content: fullText, status: '', isLoading: false });
    } catch (error) {
      console.error(error);
      updateMessageElement(assistantMessage, {
        content: `⚠️ ${error.message}`,
        status: '',
        isLoading: false
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    if (state.isProcessing) return;
    const value = dom.userInput.value;
    dom.userInput.value = '';
    autoResizeTextarea();
    handleComposerInput();
    sendMessage(value);
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    state.settings.apiKey = dom.apiKeyInput.value.trim();
    state.settings.model = dom.modelSelect.value;
    state.settings.temperature = Number(dom.temperatureInput.value) || 0.7;

    closeSettingsDrawer();

    applyModelAffordances();
  }

// No explicit submit/apply; presence of text decides application

function updateSystemUI() {
  const hasPrompt = !!state.settings.systemPrompt?.trim();
  // Badge
  if (dom.systemStatus) {
    dom.systemStatus.textContent = hasPrompt ? 'Applied' : '';
    dom.systemStatus.hidden = !hasPrompt;
    dom.systemStatus.classList.toggle('show', hasPrompt);
    dom.systemStatus.classList.toggle('text-bg-success', hasPrompt);
    dom.systemStatus.classList.toggle('text-bg-secondary', !hasPrompt);
  }
  // Card border
  if (dom.systemCard) {
    dom.systemCard.classList.toggle('border-success', hasPrompt);
    dom.systemCard.classList.toggle('border-2', hasPrompt);
  }
}

  function openSettingsDrawer() {
    dom.settingsDrawer?.classList.add('open');
    dom.drawerBackdrop?.classList.add('open');
    if (dom.drawerBackdrop) dom.drawerBackdrop.hidden = false;
    dom.settingsDrawer?.setAttribute('aria-hidden', 'false');
  }

  function closeSettingsDrawer() {
    dom.settingsDrawer?.classList.remove('open');
    dom.drawerBackdrop?.classList.remove('open');
    if (dom.drawerBackdrop) dom.drawerBackdrop.hidden = true;
    dom.settingsDrawer?.setAttribute('aria-hidden', 'true');
  }

  function autoResizeTextarea() {
    const textarea = dom.userInput;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }

  function autoResizeSystemPrompt() {
    const ta = dom.systemPromptUI;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = 400;
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`;
  }

  function handleSystemInput() {
    const val = (dom.systemPromptUI?.value || '').trim();
    state.settings.systemPrompt = val;
    storage?.setItem(STORAGE_KEYS.systemPrompt, state.settings.systemPrompt);
    updateSystemUI();
  }

  // updateSystemStatusBadge merged into updateSystemUI()

  function handleComposerInput() {
    autoResizeTextarea();
    dom.sendButton.disabled = state.isProcessing || !dom.userInput.value.trim();
  }

  function handleComposerKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      dom.composerForm.requestSubmit();
    }
  }

  function activate() {
    loadThemePreference();
    configureMarkdown();
    applySettingsToForm();
    applyCopy();
    loadCopy();
    autoResizeTextarea();
    autoResizeSystemPrompt();

    // restore persisted system prompt
    try {
      const persistedPrompt = storage?.getItem(STORAGE_KEYS.systemPrompt);
      if (persistedPrompt) {
        state.settings.systemPrompt = persistedPrompt;
        if (dom.systemPromptUI) dom.systemPromptUI.value = persistedPrompt;
      }
    } catch (_) {}
    updateSystemUI();

    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', handleThemeToggle);
    }

    dom.composerForm.addEventListener('submit', handleFormSubmit);
    dom.userInput.addEventListener('input', handleComposerInput);
    dom.userInput.addEventListener('keydown', handleComposerKeydown);
    dom.settingsForm.addEventListener('submit', handleSettingsSubmit);
    dom.modelSelect.addEventListener('change', applyModelAffordances);
    // Prevent system form submit to avoid page reload
    dom.systemForm && dom.systemForm.addEventListener('submit', (e) => e.preventDefault());
    dom.systemPromptUI && (dom.systemPromptUI.value = state.settings.systemPrompt || '');
    dom.systemPromptUI && dom.systemPromptUI.addEventListener('input', autoResizeSystemPrompt);
    dom.systemPromptUI && dom.systemPromptUI.addEventListener('input', handleSystemInput);
    dom.settingsOpenBtn?.addEventListener('click', openSettingsDrawer);
    dom.settingsCloseBtn?.addEventListener('click', closeSettingsDrawer);
    dom.drawerBackdrop?.addEventListener('click', closeSettingsDrawer);
    handleComposerInput();
    applyModelAffordances();
  }

  document.addEventListener('DOMContentLoaded', activate);
})();
