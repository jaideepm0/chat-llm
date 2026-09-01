const DEFAULT_BASE_URL = 'https://api.openai.com';
const OPENAI_HOSTS = new Set(['api.openai.com']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function parseUrl(baseUrl) {
  try {
    return new URL(normalizeBaseUrl(baseUrl));
  } catch {
    return null;
  }
}

export function isLocalRuntime(locationLike = globalThis.location) {
  const host = String(locationLike?.hostname || '').toLowerCase();
  return LOCAL_HOSTS.has(host);
}

export function isOpenAIBaseUrl(baseUrl) {
  const url = parseUrl(baseUrl);
  return Boolean(url && url.protocol === 'https:' && OPENAI_HOSTS.has(url.hostname.toLowerCase()));
}

export function isLocalBaseUrl(baseUrl) {
  const url = parseUrl(baseUrl);
  return Boolean(url && LOCAL_HOSTS.has(url.hostname.toLowerCase()) && ['http:', 'https:'].includes(url.protocol));
}

function listFromCommaText(value) {
  return String(value || '')
    .split(/[,\n\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function assessRequestPreflight({
  defaults = {},
  model = '',
  baseUrl,
  locationLike = globalThis.location,
} = {}) {
  const blocks = [];
  const confirmations = [];
  const warnings = [];
  const effectiveBaseUrl = normalizeBaseUrl(baseUrl || defaults.apiBaseUrl);

  if (String(locationLike?.protocol || '') === 'file:') {
    blocks.push('Open this app via http(s); file:// pages cannot call the OpenAI API.');
  }

  if (defaults.apiMode && defaults.apiMode !== 'responses') {
    blocks.push('Only the Responses API surface is implemented in the pure GitHub Pages app.');
  }

  if (!isOpenAIBaseUrl(effectiveBaseUrl)) {
    if (!(isLocalRuntime(locationLike) && isLocalBaseUrl(effectiveBaseUrl))) {
      blocks.push('Pure GitHub Pages mode allows only https://api.openai.com. Localhost API URLs are allowed only during local development.');
    }
  }

  if (defaults.fileSearch && !listFromCommaText(defaults.fileSearchVectorStoreIds).length) {
    blocks.push('File search needs at least one vector store ID.');
  }

  if (defaults.webSearch && /^gpt-5/.test(model) && defaults.reasoningEffort === 'minimal') {
    blocks.push('Web search is not supported with GPT-5 minimal reasoning. Choose low, medium, high, or xhigh.');
  }

  if (defaults.toolChoice === 'required' && !defaults.webSearch && !defaults.fileSearch && !defaults.imageGeneration && !defaults.localTools) {
    blocks.push('Tool choice is required, but no tools are enabled.');
  }

  if (defaults.storeResponses) confirmations.push('Stored responses keep server-side conversation state and may be retrievable by response ID.');
  if (defaults.webSearch && defaults.webSearchReturnTokenBudget === 'unlimited') confirmations.push('Unlimited web search token budget can increase latency and cost.');
  if (defaults.imageGeneration) confirmations.push('Image generation can add tool cost and large generated artifacts.');
  if (defaults.backgroundMode) confirmations.push('Background mode can keep a request running after the initial connection.');
  if (defaults.serviceTier === 'priority') confirmations.push('Priority service tier can increase spend.');

  if (defaults.webSearch && defaults.webSearchExternalAccess === false) {
    warnings.push('Web search is cache-only because external web access is disabled.');
  }

  if (blocks.length) return { status: 'block', blocks, confirmations, warnings };
  if (confirmations.length) return { status: 'confirm', blocks, confirmations, warnings };
  return { status: 'allow', blocks, confirmations, warnings };
}
