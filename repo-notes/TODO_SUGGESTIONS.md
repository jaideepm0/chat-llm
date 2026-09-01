# TODO / Suggestions (actionable)

## API correctness
- [x] Use `/v1/responses` as the only normal API mode.
- [x] Gate stored-response chaining behind the stored-response setting.
- [ ] Add more browser-level regression coverage for preflight blocked-send states.

## UX
- [x] Add Stop generating (AbortController).
- [x] Add Regenerate last answer.
- [x] Add chat export.
- [ ] Add a visible recovery workflow for storage quota failures.

## Performance
- [ ] Throttle streaming UI updates (e.g., requestAnimationFrame or 50–100ms debounce).
- [ ] Render markdown + Prism once at end (or only highlight code at end).

## Correctness
- [x] Fix temperature parsing to allow `0`.
- [x] Keep API keys memory-only by default with explicit tab-session opt-in.

## Security
- [x] Document the static BYOK security model.
- [x] Vendor runtime script/style assets.
- [x] Add CSP for the chat app shell.

## Accessibility
- [ ] Add ESC-to-close for drawer.
- [ ] Add focus trap when drawer is open.
- [ ] Reduce `aria-live` churn during streaming.
