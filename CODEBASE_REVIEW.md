# Codebase Review and Next Steps

## What Exists
- Static GitHub Pages app shell in `app.html`, supported by vanilla ESM modules under `src/`.
- Direct browser-to-OpenAI Responses API streaming calls; no backend, proxy, build step, or server-side secret custody.
- Vendored browser dependencies in `assets/vendor/` with a CSP that keeps scripts/styles on `self`.
- Multi-chat browser persistence, model picker, request preview, local tools, web/file/image tools, and explicit stored-response mode.
- Static docs/homepage in `index.html`, `docs/`, `content.md`, `site.css`, `robots.txt`, and `sitemap.xml`.

## Current Risks
- **Static BYOK limits:** API keys are browser-visible by design. Memory-only storage lowers accidental persistence risk, but it is not secret custody.
- **Cost controls:** Web search, image generation, stored responses, background mode, and priority tier need explicit user confirmation before sends.
- **Storage pressure:** Browser localStorage is small; oversized messages and generated image payloads must be capped or excluded from persistence.
- **Tool robustness:** Local tools need strict schema handling, timeouts, argument caps, output caps, and structured failure traces.
- **Endpoint safety:** Normal GitHub Pages mode should call OpenAI only; localhost custom bases are development-only.

## Implemented Direction
1. Use `/v1/responses` only.
2. Keep the deployment pure static and BYOK.
3. Vendor external script/style assets instead of loading CDNs at runtime.
4. Make API key persistence explicit: memory by default, optional tab-session mode.
5. Gate `previous_response_id` chaining behind `storeResponses`.
6. Add preflight checks before API calls and confirmations for high-cost or stateful settings.

## Remaining Architectural Opportunities
1. Add a focused browser smoke suite for the most important static UI flows.
2. Add throttled markdown rendering during streaming to reduce repeated parse/sanitize/highlight work.
3. Add stronger accessibility affordances for drawers/modals, especially focus trapping.
4. Add an import/export recovery flow that is visible when storage quota handling fails.
