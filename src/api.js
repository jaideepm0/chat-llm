import { session } from './storage.js';
import { escapeAttr, escapeHtml } from './utils.js';
import { getModelInfo, isReasoningModel } from './models.js';

const API_KEY_SS = 'chat_llm_api_key_v1';
const DEFAULT_BASE_URL = 'https://api.openai.com';

export function getApiKey() {
  return (session?.getItem(API_KEY_SS) || '').trim();
}

export function setApiKey(key) {
  const v = String(key || '').trim();
  session?.setItem(API_KEY_SS, v);
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function makeUrl(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function parseAllowedDomains(input) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(',') : String(input);
  return raw
    .split(/[,\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/^https?:\/\//i, ''))
    .map((x) => x.split(/[/?#]/)[0])
    .map((x) => x.replace(/\/$/, ''))
    .map((x) => x.toLowerCase())
    .filter(Boolean);
}

export async function refreshAccountModels({ apiKey, baseUrl } = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('Add your API key in Settings first.');

  const res = await fetch(makeUrl(baseUrl, '/v1/models'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!res.ok) throw new Error(await readAPIError(res));
  const json = await res.json();
  const ids = (json?.data || [])
    .map((m) => m?.id)
    .filter((id) => typeof id === 'string')
    .filter((id) => /^(gpt-|o\d|codex|computer-use)/.test(id))
    .sort();

  return ids;
}

export function buildResponsesBody({
  model,
  messages,
  input,
  inputItems,
  previousResponseId,
  instructions,
  temperature,
  maxOutputTokens,
  reasoningEffort,
  reasoningSummary,
  textVerbosity,
  webSearch,
  webSearchAllowedDomains,
  webSearchBlockedDomains,
  webSearchContextSize,
  webSearchExternalAccess,
  webSearchReturnTokenBudget,
  extraTools,
  store,
  includeEncryptedReasoning,
  promptCacheKey,
  promptCacheRetention,
  truncation,
  safetyIdentifier,
  maxToolCalls,
  topP,
}) {
  const body = {
    model,
    input: typeof inputItems !== 'undefined'
      ? inputItems
      : typeof input !== 'undefined'
        ? input
        : (messages || []).map((m) => ({
          role: m.role,
          content: [{ type: 'input_text', text: String(m.content || '') }],
        })),
    stream: true,
    store: Boolean(store),
  };

  const instr = String(instructions || '').trim();
  if (instr) body.instructions = instr;

  const prev = String(previousResponseId || '').trim();
  if (prev) body.previous_response_id = prev;

  if (Number(maxOutputTokens) > 0) body.max_output_tokens = Number(maxOutputTokens);

  const temp = Number(temperature);
  if (Number.isFinite(temp) && temp >= 0 && temp <= 2) body.temperature = temp;

  const topPValue = Number(topP);
  if (Number.isFinite(topPValue) && topPValue > 0 && topPValue <= 1) body.top_p = topPValue;

  if (['low', 'medium', 'high'].includes(textVerbosity)) {
    body.text = { ...(body.text || {}), verbosity: textVerbosity };
  }

  const cacheKey = String(promptCacheKey || '').trim();
  if (cacheKey) body.prompt_cache_key = cacheKey.slice(0, 64);

  if (['in_memory', '24h'].includes(promptCacheRetention)) body.prompt_cache_retention = promptCacheRetention;
  if (['auto', 'disabled'].includes(truncation)) body.truncation = truncation;

  const safety = String(safetyIdentifier || '').trim();
  if (safety) body.safety_identifier = safety.slice(0, 64);

  const maxTools = Number(maxToolCalls);
  if (Number.isInteger(maxTools) && maxTools > 0) body.max_tool_calls = maxTools;

  const toolDefs = [];
  const include = [];
  if (webSearch) {
    const tool = { type: 'web_search' };
    const allowed = parseAllowedDomains(webSearchAllowedDomains);
    const blocked = parseAllowedDomains(webSearchBlockedDomains);
    if (allowed.length || blocked.length) {
      tool.filters = {};
      if (allowed.length) tool.filters.allowed_domains = allowed;
      if (blocked.length) tool.filters.blocked_domains = blocked;
    }
    if (['low', 'medium', 'high'].includes(webSearchContextSize)) tool.search_context_size = webSearchContextSize;
    if (typeof webSearchExternalAccess === 'boolean') tool.external_web_access = webSearchExternalAccess;
    if (['default', 'unlimited'].includes(webSearchReturnTokenBudget)) tool.return_token_budget = webSearchReturnTokenBudget;
    toolDefs.push(tool);
    include.push('web_search_call.action.sources');
  }
  if (Array.isArray(extraTools) && extraTools.length) toolDefs.push(...extraTools);
  if (toolDefs.length) {
    body.tools = toolDefs;
    body.tool_choice = 'auto';
  }
  if (includeEncryptedReasoning) include.push('reasoning.encrypted_content');
  if (include.length) body.include = [...new Set(include)];

  if (isReasoningModel(model)) {
    body.reasoning = { effort: reasoningEffort || 'medium' };
    if (reasoningSummary && reasoningSummary !== 'none') body.reasoning.summary = reasoningSummary;
  }

  return body;
}

export async function streamResponses({
  apiKey,
  baseUrl,
  body,
  signal,
  onEvent,
}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('Missing API key.');

  const res = await fetch(makeUrl(baseUrl, '/v1/responses'), {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  await streamSSE(res, onEvent);
}

export async function fetchResponseById({ apiKey, baseUrl, responseId } = {}) {
  const key = String(apiKey || '').trim();
  const id = String(responseId || '').trim();
  const res = await fetch(makeUrl(baseUrl, `/v1/responses/${encodeURIComponent(id)}`), {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!res.ok) throw new Error(await readAPIError(res));
  return res.json();
}

export function extractResponseId(evt) {
  const id = evt?.response?.id || evt?.response_id || evt?.id;
  if (typeof id === 'string' && id.startsWith('resp_')) return id;
  return null;
}

export function extractTextAndAnnotationsFromResponse(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  let outputText = '';
  let reasoningSummary = '';
  const annotations = [];

  for (const item of output) {
    if (item?.type === 'reasoning' && Array.isArray(item.summary)) {
      for (const part of item.summary) {
        if (part?.type === 'summary_text' && typeof part.text === 'string') reasoningSummary += part.text;
      }
    }

    if (item?.type !== 'message' || item?.role !== 'assistant' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        const offset = outputText.length;
        outputText += part.text;
        if (Array.isArray(part.annotations)) {
          for (const ann of part.annotations) {
            if (ann && typeof ann === 'object' && typeof ann.start_index === 'number' && typeof ann.end_index === 'number') {
              annotations.push({
                ...ann,
                start_index: ann.start_index + offset,
                end_index: ann.end_index + offset,
              });
            }
          }
        }
      }

      if (part?.type === 'refusal' && typeof part.refusal === 'string') {
        outputText += part.refusal;
      }
    }
  }

  return { outputText, reasoningSummary, annotations };
}

export function injectCitationLinks(text, annotations) {
  if (!text || !Array.isArray(annotations) || !annotations.length) return String(text || '');

  const candidates = annotations
    .filter((a) => a && typeof a === 'object' && typeof a.start_index === 'number' && typeof a.end_index === 'number')
    .filter((a) => typeof a.url === 'string' && a.url)
    .sort((a, b) => b.start_index - a.start_index);

  let out = String(text);
  for (const a of candidates) {
    const start = a.start_index;
    const end = a.end_index;
    if (start < 0 || end <= start || end > out.length) continue;
    const label = escapeHtml(out.slice(start, end));
    const href = escapeAttr(a.url);
    const title = escapeAttr(a.title || a.url);
    out = `${out.slice(0, start)}<a href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">${label}</a>${out.slice(end)}`;
  }
  return out;
}

export function estimateCostUSD(modelId, usage) {
  const info = getModelInfo(modelId);
  const pricing = info?.pricing;
  if (!pricing) return null;

  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  if (typeof input !== 'number' || typeof output !== 'number') return null;

  const cached = typeof usage?.input_tokens_details?.cached_tokens === 'number' ? usage.input_tokens_details.cached_tokens : 0;
  const normalInput = Math.max(0, input - cached);

  const inputCost = (normalInput / 1_000_000) * pricing.in;
  const cachedCost = pricing.cached == null ? 0 : (cached / 1_000_000) * pricing.cached;
  const outputCost = (output / 1_000_000) * pricing.out;
  return inputCost + cachedCost + outputCost;
}

async function streamSSE(res, onEvent) {
  if (!res.ok) throw new Error(await readAPIError(res));
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming is not supported in this environment.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    while (true) {
      const sep = buffer.indexOf('\n\n');
      if (sep === -1) break;
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLines = rawEvent
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart());

      if (!dataLines.length) continue;
      const data = dataLines.join('\n').trim();
      if (!data) continue;
      if (data === '[DONE]') return;

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      onEvent?.(parsed);
    }
  }
}

async function readAPIError(res) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    const msg = j?.error?.message || j?.message || text;
    return `[${res.status}] ${msg}`;
  } catch {
    return `[${res.status}] ${text || res.statusText || 'Request failed'}`;
  }
}
