# Chat LLM (OpenAI Chat UI)

A lightweight, single‑page web app to chat with OpenAI's `chat.completions` API. It runs fully client‑side, supports streaming responses, theming, etc...

Default model: `gpt-4.1-mini`.

## Features
- Streaming chat via `https://api.openai.com/v1/chat/completions`
- Model and temperature controls
- System prompt editor; prompt is applied automatically when non‑empty with clear visual indication
- Smooth message appearance animations and tidy UI
- Light/Dark theme toggle with Prism code highlighting
- Copy‑to‑clipboard buttons on code blocks
- Markdown rendering with sanitization (DOMPurify)

## Quick Start
- Open `index.html` in a browser (or serve the folder statically).
- Click Settings (top right) and paste your OpenAI API key (`sk-...`).
- Leave the default model as `gpt-4.1-mini` or select another.
- Optionally set temperature.
- Type a message and hit Enter to send (Shift+Enter for a new line).

Note: Your API key is only used in this session within your browser tab and is not persisted to disk by the app.

## System Prompt
- Edit the system prompt at the top of the conversation.
- If non‑empty, it is applied to the next requests automatically.
- The UI shows an “Applied” badge and a green border when active. Text persists across reloads.

## Example curl
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1-mini","messages":[{"role":"user","content":"Say hello"}]}'
```

## Development Notes
- No build step required; all dependencies are loaded from CDNs.
- `script.js` handles UI state, streaming, sanitization, and rendering.
- The app uses smooth scrolling and small UI transitions for a polished feel.

## License
See `LICENSE` for details.
