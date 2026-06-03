[brand]
**Chat LLM**

Workspace for OpenAI Responses API chats.
[/brand]

[helper]
_API key is stored in this tab session only (`sessionStorage`). For production, use a backend proxy._
[/helper]

[empty]
# Chat with OpenAI via the Responses API

Quick start:
- Add your API key in **Settings**
- Pick a model (top bar)
- Choose a **workspace preset** for writing, coding, or research
- Toggle **web search** or **local tools** from the composer
- Press **Ctrl+K** to search chats

Example curl:
```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.2","input":"Say hello","stream":false}'
```

Use the right rail for quick browser tools, prompt inserts, and reusable workspace modes.

[/empty]
