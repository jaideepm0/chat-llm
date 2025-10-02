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
    settingsSummary: document.querySelector('.settings summary')
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

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    <p><strong>Start a conversation</strong></p>
    <p>Ask a question or describe what you need. Shift + Enter inserts a new line.</p>
  `;

  function preferredStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      console.warn('localStorage unavailable', error);
      return null;
    }
  }

  const storage = preferredStorage();

  function loadSettings() {
    if (!storage) return;
    const apiKey = storage.getItem('openai_api_key');
    const model = storage.getItem('openai_model');
    const temperature = storage.getItem('openai_temperature');

    if (apiKey) state.settings.apiKey = apiKey;
    if (model) state.settings.model = model;
    if (temperature && !Number.isNaN(Number(temperature))) {
      state.settings.temperature = Number(temperature);
    }
  }

  function persistSettings() {
    if (!storage) return;
    storage.setItem('openai_api_key', state.settings.apiKey);
    storage.setItem('openai_model', state.settings.model);
    storage.setItem('openai_temperature', String(state.settings.temperature));
  }

  function applySettingsToForm() {
    dom.apiKeyInput.value = state.settings.apiKey;
    dom.modelSelect.value = state.settings.model;
    dom.temperatureInput.value = state.settings.temperature;
  }

  function updateEmptyState() {
    const hasMessages = state.history.length > 0 || dom.conversation.querySelector('.message');
    emptyState.hidden = hasMessages;
    if (!emptyState.isConnected) {
      dom.conversation.appendChild(emptyState);
    }
  }

  function configureMarkdown() {
    if (window.marked) {
      window.marked.setOptions({
        breaks: true,
        gfm: true,
        mangle: false,
        headerIds: false,
        highlight(code, lang) {
          if (window.hljs) {
            if (lang && window.hljs.getLanguage(lang)) {
              return window.hljs.highlight(code, { language: lang }).value;
            }
            return window.hljs.highlightAuto(code).value;
          }
          return code;
        }
      });
    }
  }

  function renderMarkdown(text) {
    if (!window.marked || !window.DOMPurify) {
      return text;
    }
    const raw = window.marked.parse(text);
    return window.DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true }
    });
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
    const contentEl = fragment.querySelector('.message-content');

    messageEl.classList.add(role);
    avatarEl.textContent = role === 'user' ? 'You' : 'AI';
    avatarEl.setAttribute('aria-label', role === 'user' ? 'You' : 'Assistant');
    roleEl.textContent = role === 'user' ? 'You' : 'Assistant';

    if (status) {
      statusEl.textContent = status;
      statusEl.hidden = false;
      statusEl.setAttribute('aria-hidden', 'false');
    } else {
      statusEl.hidden = true;
      statusEl.setAttribute('aria-hidden', 'true');
    }

    if (content) {
      contentEl.innerHTML = renderMarkdown(content);
    }

    if (isLoading) {
      messageEl.dataset.loading = 'true';
    }

    dom.conversation.appendChild(fragment);
    scrollConversationToBottom();
    updateEmptyState();
    return messageEl;
  }

  function updateMessageElement(messageEl, { content, status, isLoading }) {
    const statusEl = messageEl.querySelector('.status');
    const contentEl = messageEl.querySelector('.message-content');

    if (typeof status !== 'undefined') {
      if (status) {
        statusEl.textContent = status;
        statusEl.hidden = false;
        statusEl.setAttribute('aria-hidden', 'false');
      } else {
        statusEl.textContent = '';
        statusEl.hidden = true;
        statusEl.setAttribute('aria-hidden', 'true');
      }
    }

    if (typeof content !== 'undefined') {
      contentEl.innerHTML = renderMarkdown(content);
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

  function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
    dom.sendButton.disabled = isProcessing;
    dom.userInput.disabled = isProcessing;
    if (!isProcessing) {
      dom.userInput.focus();
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

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
    sendMessage(value);
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    state.settings.apiKey = dom.apiKeyInput.value.trim();
    state.settings.model = dom.modelSelect.value;
    state.settings.temperature = Number(dom.temperatureInput.value) || 0.7;
    persistSettings();
    if (dom.settingsDetails) {
      dom.settingsDetails.open = false;
    }
    if (dom.settingsSummary) {
      dom.settingsSummary.classList.add('saved');
      dom.settingsSummary.textContent = 'Settings ✓';
      setTimeout(() => {
        dom.settingsSummary.textContent = 'Settings';
        dom.settingsSummary.classList.remove('saved');
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
    dom.sendButton.disabled = !dom.userInput.value.trim();
  }

  function handleComposerKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      dom.composerForm.requestSubmit();
    }
  }

  function activate() {
    loadSettings();
    applySettingsToForm();
    configureMarkdown();
    updateEmptyState();
    autoResizeTextarea();

    dom.composerForm.addEventListener('submit', handleFormSubmit);
    dom.userInput.addEventListener('input', handleComposerInput);
    dom.userInput.addEventListener('keydown', handleComposerKeydown);
    dom.settingsForm.addEventListener('submit', handleSettingsSubmit);

    handleComposerInput();
  }

  document.addEventListener('DOMContentLoaded', activate);
})();
