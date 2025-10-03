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
    settingsDetails: document.querySelector('.settings'),
    settingsSummary: document.querySelector('.settings summary'),
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
      model: 'gpt-4o-mini',
      temperature: 0.7
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
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hello"}]}'
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

      window.marked.setOptions({
        breaks: true,
        gfm: true,
        mangle: false,
        headerIds: false,
        renderer,
        highlight(code, lang) {
          if (window.hljs) {
            const language = lang && window.hljs.getLanguage(lang) ? lang : 'plaintext';
            return window.hljs.highlight(code, { language }).value;
          }
          return code;
        }
      });
    }

    if (window.hljs?.configure) {
      window.hljs.configure({ ignoreUnescapedHTML: true });
    }
  }

  function renderMarkdown(text) {
    if (!window.marked || !window.DOMPurify) {
      return text;
    }
    const raw = window.marked.parse(text);
    return window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }

  function applyMarkdown(element, markdown) {
    if (!element) return;
    element.innerHTML = renderMarkdown(markdown);
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
      dom.themeToggle.textContent = normalized === 'dark' ? 'Switch to light' : 'Switch to dark';
      dom.themeToggle.setAttribute('aria-pressed', normalized === 'dark' ? 'true' : 'false');
      dom.themeToggle.classList.toggle('btn-outline-secondary', normalized !== 'dark');
      dom.themeToggle.classList.toggle('btn-outline-light', normalized === 'dark');
    }
    if (storage) {
      storage.setItem(THEME_KEY, normalized);
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
      markdownHolder.style.maxWidth = '720px';
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
    cardEl.className = 'card shadow-sm flex-grow-1';
    metadataEl.className = 'message-metadata d-flex gap-2 small text-body-secondary mb-2';
    statusEl.className = 'status text-body-secondary';

    if (role === 'user') {
      avatarEl.classList.add('bg-dark', 'text-white');
      cardEl.classList.add('bg-dark', 'text-white');
      metadataEl.classList.add('text-white-50');
      statusEl.classList.add('text-white-50');
    } else {
      avatarEl.classList.add('bg-primary-subtle', 'text-primary');
      cardEl.classList.add('bg-body-secondary');
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
    scrollConversationToBottom();
    updateEmptyState();
    return messageEl;
  }

  function updateMessageElement(messageEl, { content, status, isLoading }) {
    const statusEl = messageEl.querySelector('.status');
    const contentEl = messageEl.querySelector('.message-content');
    const metadataEl = messageEl.querySelector('.message-metadata');
    const cardEl = messageEl.querySelector('.card');
    const isUser = messageEl.classList.contains('user');

    if (metadataEl) {
      metadataEl.classList.remove('text-white-50', 'text-body-secondary');
      metadataEl.classList.add(isUser ? 'text-white-50' : 'text-body-secondary');
    }

    if (cardEl) {
      cardEl.className = 'card border-0 shadow-sm flex-grow-1';
      if (isUser) {
        cardEl.classList.add('bg-dark', 'text-white');
      } else {
        cardEl.classList.add('bg-body-secondary');
      }
    }

    if (statusEl) {
      statusEl.classList.remove('text-white-50', 'text-body-secondary');
      statusEl.classList.add(isUser ? 'text-white-50' : 'text-body-secondary');
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: state.history,
          temperature
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error?.message || response.statusText || 'Request failed');
      }

      const payload = await response.json();
      const choice = payload.choices?.[0]?.message;
      const assistantContent = choice?.content?.trim();

      if (!assistantContent) {
        throw new Error('Received an empty response from the API.');
      }

      state.history.push({ role: 'assistant', content: assistantContent });
      updateMessageElement(assistantMessage, {
        content: assistantContent,
        status: '',
        isLoading: false
      });
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

    if (dom.settingsDetails) {
      dom.settingsDetails.open = false;
    }
    if (dom.settingsSummary) {
      const original = dom.settingsSummary.textContent;
      dom.settingsSummary.textContent = 'Settings ✓';
      setTimeout(() => {
        dom.settingsSummary.textContent = original;
      }, 2000);
    }
  }

  function autoResizeTextarea() {
    const textarea = dom.userInput;
    textarea.style.height = 'auto';
    const maxHeight = 240;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }

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

    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', handleThemeToggle);
    }

    dom.composerForm.addEventListener('submit', handleFormSubmit);
    dom.userInput.addEventListener('input', handleComposerInput);
    dom.userInput.addEventListener('keydown', handleComposerKeydown);
    dom.settingsForm.addEventListener('submit', handleSettingsSubmit);

    handleComposerInput();
  }

  document.addEventListener('DOMContentLoaded', activate);
})();
