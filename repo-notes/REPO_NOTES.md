# Repository notes: chat-llm

## 1) What this repo is
A lightweight, **single-page, static** chat UI that calls the **OpenAI Responses API** directly from the browser using `fetch()` with **streaming** enabled.

- **No build step**: plain `app.html`, static CSS, and vanilla ESM modules under `src/`.
- UI built with vendored **Bootstrap 5** + GitHub Markdown CSS.
- Message rendering via vendored **marked** (Markdown) + **DOMPurify** (sanitization) + **Prism** (syntax highlighting).
- Designed for GitHub Pages BYOK deployment: no backend, no proxy, no shared key, and no server-side secret custody.

## 2) Repository contents & structure
Top-level files:

- `index.html` — crawlable homepage.
- `app.html` — UI shell, layout, templates, CSP, and vendored asset references.
- `src/` — main app logic (state, API streaming, security preflight, UI events, tools, models).
- `content.md` — optional copy/markdown overrides (brand text, helper text, empty-state help).
- `README.md` — quick start + feature list.
- `favicon.svg` — gradient chat icon.
- `assets/vendor/` — vendored static browser dependencies.
- `CNAME` — GitHub Pages custom domain `chat.fenosys.com`.
- `LICENSE` — MIT.

Local-only / untracked (present in your working tree right now):

- `CODEBASE_REVIEW.md` — a solid internal review doc listing risks + next steps.
- `llm-call.js` — placeholder / incomplete helper, not referenced by the app.
- `archive/` — exists locally but ignored by `.gitignore`.

Git status (in your current checkout): `CODEBASE_REVIEW.md` and `llm-call.js` are untracked.

## 3) UX + feature walkthrough (as implemented)
### Settings drawer
- API key entry (`type=password`) with memory-only default and explicit tab-session persistence.
- Model dropdown: GPT-5 family, Codex, o-series, GPT-4.1 family, and tool-specific model IDs.
- Responses API controls including reasoning, verbosity, service tier, stored responses, tools, and request preview.

### Conversation
- System prompt box at top; becomes “Applied” (badge + green border) when non-empty.
- Message composer at bottom with autosizing textarea.
- Enter sends, Shift+Enter newline.

### Theming
- Light/dark toggle sets `data-bs-theme` and swaps Prism CSS (light vs okaidia).

### Markdown + code
- Markdown render via `marked.parse()` and sanitize via `DOMPurify`.
- Code blocks are highlighted with Prism.
- Each code block gets a “Copy” button (clipboard API).

## 4) Streaming implementation details
- Uses `fetch('https://api.openai.com/v1/responses', { stream: true })`.
- Reads `response.body.getReader()` and incrementally parses Responses API SSE events.
- Accumulates content, reasoning summaries, citations, image artifacts, tool calls, usage, and response IDs.
- Gates `previous_response_id` chaining behind stored-response mode and falls back to full local history if a stored chain fails.

This is straightforward and works, but can get expensive for long outputs because each chunk triggers:
- Markdown parse + sanitize
- Prism highlighting
- DOM updates

## 5) Notable issues / risks
### A) Client-side API key exposure (expected for this style)
Key is entered in the browser and sent directly to OpenAI.
- Fine for personal/local use.
- Not a shared-key SaaS architecture: no server-side rate limiting, abuse prevention, or secret custody.

### B) Clipboard behavior depends on secure context
`navigator.clipboard` generally requires **HTTPS** (or localhost). If opened from `file:` or insecure contexts, copy may fail.

### C) Accessibility gaps
- Drawer doesn’t implement focus trap.
- No Escape-to-close.
- Frequent streaming `aria-live` updates may be noisy for screen readers.

### D) Storage pressure
Persisted chats and settings must fit inside browser storage limits. Oversized generated artifacts should remain session-only or be exported.

## 6) Design choices I like
- Simple architecture: plain ESM modules without a build system.
- Markdown sanitization via DOMPurify is the correct default.
- Copy buttons per code block are a good UX touch.
- Explicit preflight/confirmation before risky request modes matches the static deployment model.

## 7) Practical improvements (high impact, low effort)
1. **Optimize streaming rendering**:
   - Append plain text during stream.
   - Render markdown + Prism once at the end (or throttle updates).
2. **Improve drawer UX**:
   - Focus management, ESC close.
3. **Expand browser smoke coverage**:
   - Load, settings, preview, blocked send, and privacy reset flows.

## 8) Suggested repo hygiene
- If `CODEBASE_REVIEW.md` is meant to be kept, consider committing it (it’s useful).
- Consider adding a minimal `CONTRIBUTING.md` and/or a short “Security / Key handling” note.

## 9) Quick “mental model” of the code
- `app.html` provides:
  - layout + settings markup
  - message template
  - CSP + vendored script/style imports
- `src/ui.js` coordinates UI composition, shortcuts, settings, preview, and streaming lifecycle.
- `src/api.js` handles Responses API and model refresh fetches.
- `src/security.js` performs static preflight checks before API calls.
- `src/state.js` owns store migration, capped persistence, and chat state.
- `src/tools.js` owns local function-tool definitions and guarded execution.
