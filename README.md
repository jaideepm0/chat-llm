# Chat LLM (GitHub Pages–compatible)

A fully static chat UI that talks to OpenAI via `POST /v1/responses` (streaming). Designed to work on GitHub Pages (no backend, no build step), with a crawlable homepage and separate documentation pages.

## Features

- Responses API streaming (`text/event-stream`)
- ChatGPT-like sidebar with chat history (pin, delete) + multi-chat persistence
- Command palette / search (`Ctrl+K`) for chats + actions
- ChatGPT-style model picker (curated list + optional `GET /v1/models` refresh)
- Reasoning controls (effort, readable summaries, text verbosity)
- Optional Web Search tool with citations, domain filters, context size, and token budget controls
- Optional local tools (calculator + time) via function calling
- Optional usage + cost estimate per response (requires `store: true`)
- Stop, regenerate, edit user messages, export chat JSON, light/dark theme

## Run it

- GitHub Pages: enable Pages for the repo root. The homepage is `/`; the app is `/app.html`.
- Local dev: run a static server (recommended so `content.md` can be fetched): `python3 -m http.server 8000` then open `http://localhost:8000`.
- Tests: run `npm run verify` for syntax checks and Node regression tests.

## OpenAI API

- Endpoint: `POST https://api.openai.com/v1/responses`
- Key request fields used by this app: `model`, `input`, `stream`, `max_output_tokens`, `temperature`, `top_p`, `text.verbosity`, `reasoning`, `truncation`, `prompt_cache_key`, `prompt_cache_retention`, `safety_identifier`, `tools`, `max_tool_calls`, and `include`
- Multi-turn efficiency: prefers `previous_response_id` chaining when stored responses are enabled and falls back to full history if chaining fails
- Stateless local tool loops preserve response output items, including reasoning/function-call context, when `store` is off
- Optional: supports Responses API function tools (local calculator + time) with strict schemas

This repo intentionally does **not** use `chat.completions`.

## Code layout

- `index.html`: crawlable homepage for search engines and product discovery
- `app.html`: static app shell (GitHub Pages compatible)
- `docs/`: setup, API feature, and privacy pages
- `robots.txt` / `sitemap.xml`: static SEO crawl hints
- `styles.css`: app styles (no build step)
- `site.css`: homepage and docs styles
- `src/app.js`: entrypoint
- `src/ui.js`: UI + UX wiring (sidebar, modals, shortcuts)
- `src/api.js`: `v1/responses` streaming + optional `v1/models` refresh
- `src/security.js`: static preflight checks for endpoint, risky settings, and capability conflicts
- `src/state.js`: persisted store (multiple chats)
- `src/models.js`: curated model catalog + Standard-tier pricing labels

## Models & pricing (Standard tier)

Prices per 1M tokens (input / cached input / output). Source of truth: `https://platform.openai.com/docs/pricing` (prices can change). Last verified: 2026-06-04.

|Model|Input|Cached input|Output|
|---|---:|---:|---:|
|gpt-5.5|$5.00|$0.50|$30.00|
|gpt-5.5-pro|$30.00|—|$180.00|
|gpt-5.4|$2.50|$0.25|$15.00|
|gpt-5.4-mini|$0.75|$0.075|$4.50|
|gpt-5.4-nano|$0.20|$0.02|$1.25|
|gpt-5.4-pro|$30.00|—|$180.00|
|gpt-5.2|$1.75|$0.175|$14.00|
|gpt-5.2-pro|$21.00|—|$168.00|
|gpt-5.1|$1.25|$0.125|$10.00|
|gpt-5|$1.25|$0.125|$10.00|
|gpt-5-pro|$15.00|—|$120.00|
|gpt-5-mini|$0.25|$0.025|$2.00|
|gpt-5-nano|$0.05|$0.005|$0.40|
|gpt-5.2-chat-latest|$1.75|$0.175|$14.00|
|gpt-5.1-chat-latest|$1.25|$0.125|$10.00|
|gpt-5-chat-latest|$1.25|$0.125|$10.00|
|gpt-5.2-codex|$1.75|$0.175|$14.00|
|gpt-5.1-codex-max|$1.25|$0.125|$10.00|
|gpt-5.1-codex|$1.25|$0.125|$10.00|
|gpt-5-codex|$1.25|$0.125|$10.00|
|gpt-5.1-codex-mini|$0.25|$0.025|$2.00|
|codex-mini-latest|$1.50|$0.375|$6.00|
|o4-mini|$1.10|$0.275|$4.40|
|o4-mini-deep-research|$2.00|$0.50|$8.00|
|o3|$2.00|$0.50|$8.00|
|o3-mini|$1.10|$0.55|$4.40|
|o3-pro|$20.00|—|$80.00|
|o3-deep-research|$10.00|$2.50|$40.00|
|o1|$15.00|$7.50|$60.00|
|o1-mini|$1.10|$0.55|$4.40|
|o1-pro|$150.00|—|$600.00|
|gpt-4.1|$2.00|$0.50|$8.00|
|gpt-4.1-mini|$0.40|$0.10|$1.60|
|gpt-4.1-nano|$0.10|$0.025|$0.40|
|gpt-4o|$2.50|$1.25|$10.00|
|gpt-4o-mini|$0.15|$0.075|$0.60|
|gpt-4o-audio-preview|$2.50|—|$10.00|
|gpt-4o-mini-audio-preview|$0.15|—|$0.60|
|gpt-4o-realtime-preview|$5.00|—|$20.00|
|gpt-4o-mini-realtime-preview|$0.60|—|$2.40|
|gpt-4o-search-preview|$2.50|—|$10.00|
|gpt-4o-mini-search-preview|$0.15|—|$0.60|
|gpt-5-search-api|$1.25|$0.125|$10.00|
|computer-use-preview|$3.00|—|$12.00|

## Web search pricing (quick note)

The web search tool is billed separately from model tokens (tool calls + search content tokens). See `https://platform.openai.com/docs/pricing` for the exact rules and exceptions.

## Security (honest constraints)

- This is a pure GitHub Pages BYOK app. There is no backend, no proxy, no shared public key, and no server-side secret custody.
- API keys are memory-only by default. Users can explicitly opt in to `sessionStorage` for the current tab session.
- Requests are sent directly from the browser to OpenAI, so API keys are visible to the browser runtime and browser extensions.
- The app blocks non-OpenAI API base URLs in normal GitHub Pages mode and only allows localhost endpoints during local development.
- External script/style CDNs are vendored into `assets/vendor/`; the app CSP keeps scripts and styles on `self` and limits API connections to OpenAI plus localhost development.
- UI output is sanitized with DOMPurify. Chat export, request preview, logs, toasts, and persisted defaults intentionally exclude API keys.

## Customize copy

Edit `content.md` to change the landing copy and helper text.
