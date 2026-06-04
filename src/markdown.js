import { escapeHtml } from './utils.js';

export function configureMarkdown() {
  const w = globalThis.window;
  if (!w?.marked) return;

  const renderer = new w.marked.Renderer();
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
      md: 'markdown',
    };
    return map[l] || l;
  }

  const originalCode = renderer.code;
  renderer.code = function codeRenderer(code, infoString, escaped) {
    const lang = normalizeLanguage(infoString);
    return originalCode.call(this, code, lang, escaped);
  };

  w.marked.setOptions({
    breaks: true,
    gfm: true,
    mangle: false,
    headerIds: false,
    renderer,
  });
}

export function renderMarkdown(text) {
  const w = globalThis.window;
  if (!w?.marked || !w?.DOMPurify) return escapeHtml(text || '');
  const raw = w.marked.parse(String(text || ''));
  return w.DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: ['open'],
  });
}

export function enhanceCodeBlocks(element) {
  if (!element) return;
  const blocks = element.querySelectorAll('pre > code');
  blocks.forEach((code) => {
    const pre = code.parentElement;
    if (!pre || pre.dataset.copyDecorated === 'true') return;
    pre.dataset.copyDecorated = 'true';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary copy-btn d-inline-flex align-items-center gap-1';
    btn.setAttribute('aria-label', 'Copy code');
    btn.textContent = 'Copy';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(code.textContent || '');
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-success');
        setTimeout(() => {
          btn.textContent = prev;
          btn.classList.add('btn-outline-secondary');
          btn.classList.remove('btn-success');
        }, 1000);
      } catch {
        // Clipboard requires secure context; ignore failures.
      }
    });
    pre.appendChild(btn);
  });
}

export function applyMarkdown(element, markdown) {
  if (!element) return;
  element.innerHTML = renderMarkdown(markdown);
  if (window.Prism?.highlightAllUnder) window.Prism.highlightAllUnder(element);
  enhanceCodeBlocks(element);
}

export function setPlainText(element, text) {
  if (!element) return;
  element.textContent = String(text || '');
}
