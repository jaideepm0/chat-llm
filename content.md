[brand]
**OpenAI Chat**

Talk with the OpenAI chat.completions API.
[/brand]

[helper]
_Key is kept only for this browser session. Provide it again whenever you reload._
[/helper]

[empty]
# Talk to LLM through API by simple configuration.

Quick start:
- Set OPENAI_API_KEY in your environment or paste it in the session helper.
- Choose model, temperature, and max tokens in the configuration.
- Send a chat message and receive the completion (supports streaming).

Example curl:
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hello"}]}'
```

Tips:
- Use lower temperature (0.0-0.3) for deterministic outputs.
- Use system messages for high-level instructions and behavior.

[/empty]
