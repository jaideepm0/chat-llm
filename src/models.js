// Prices from https://platform.openai.com/docs/pricing (Standard tier, per 1M tokens).
export const DEFAULT_MODEL = 'gpt-5-mini';

export const MODEL_CATALOG = [
  {
    group: 'GPT‑5',
    models: [
      { id: 'gpt-5.2', title: 'GPT‑5.2', blurb: 'Newest flagship model.', pricing: { in: 1.75, cached: 0.175, out: 14.0 } },
      { id: 'gpt-5.2-pro', title: 'GPT‑5.2 Pro', blurb: 'Highest-quality GPT‑5.2 tier.', pricing: { in: 21.0, cached: null, out: 168.0 } },
      { id: 'gpt-5.1', title: 'GPT‑5.1', blurb: 'Strong general model.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5', title: 'GPT‑5', blurb: 'General reasoning + tools.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5-pro', title: 'GPT‑5 Pro', blurb: 'Highest-quality GPT‑5 tier.', pricing: { in: 15.0, cached: null, out: 120.0 } },
      { id: 'gpt-5-mini', title: 'GPT‑5 mini', blurb: 'Fast + cost-effective.', pricing: { in: 0.25, cached: 0.025, out: 2.0 } },
      { id: 'gpt-5-nano', title: 'GPT‑5 nano', blurb: 'Cheapest GPT‑5 tier.', pricing: { in: 0.05, cached: 0.005, out: 0.4 } },
    ],
  },
  {
    group: 'GPT‑5 (aliases)',
    models: [
      { id: 'gpt-5.2-chat-latest', title: 'GPT‑5.2 (chat-latest)', blurb: 'Latest chat snapshot alias.', pricing: { in: 1.75, cached: 0.175, out: 14.0 } },
      { id: 'gpt-5.1-chat-latest', title: 'GPT‑5.1 (chat-latest)', blurb: 'Latest chat snapshot alias.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5-chat-latest', title: 'GPT‑5 (chat-latest)', blurb: 'Latest chat snapshot alias.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
    ],
  },
  {
    group: 'Coding (Codex)',
    models: [
      { id: 'gpt-5.2-codex', title: 'GPT‑5.2 Codex', blurb: 'Coding-focused GPT‑5.2.', pricing: { in: 1.75, cached: 0.175, out: 14.0 } },
      { id: 'gpt-5.1-codex-max', title: 'GPT‑5.1 Codex Max', blurb: 'Coding-focused GPT‑5.1 (max).', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5.1-codex', title: 'GPT‑5.1 Codex', blurb: 'Coding-focused GPT‑5.1.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5-codex', title: 'GPT‑5 Codex', blurb: 'Coding-focused GPT‑5.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-5.1-codex-mini', title: 'GPT‑5.1 Codex mini', blurb: 'Budget Codex model.', pricing: { in: 0.25, cached: 0.025, out: 2.0 } },
      { id: 'codex-mini-latest', title: 'Codex mini (latest)', blurb: 'Lightweight coding model.', pricing: { in: 1.5, cached: 0.375, out: 6.0 } },
    ],
  },
  {
    group: 'Reasoning (o‑series)',
    models: [
      { id: 'o4-mini', title: 'o4‑mini', blurb: 'Fast reasoning model.', pricing: { in: 1.1, cached: 0.275, out: 4.4 } },
      { id: 'o4-mini-deep-research', title: 'o4‑mini deep research', blurb: 'Research-focused variant.', pricing: { in: 2.0, cached: 0.5, out: 8.0 } },
      { id: 'o3', title: 'o3', blurb: 'Strong reasoning model.', pricing: { in: 2.0, cached: 0.5, out: 8.0 } },
      { id: 'o3-mini', title: 'o3‑mini', blurb: 'Budget reasoning model.', pricing: { in: 1.1, cached: 0.55, out: 4.4 } },
      { id: 'o3-pro', title: 'o3‑pro', blurb: 'High-end reasoning model.', pricing: { in: 20.0, cached: null, out: 80.0 } },
      { id: 'o3-deep-research', title: 'o3 deep research', blurb: 'Research-focused reasoning.', pricing: { in: 10.0, cached: 2.5, out: 40.0 } },
      { id: 'o1', title: 'o1', blurb: 'Legacy reasoning model.', pricing: { in: 15.0, cached: 7.5, out: 60.0 } },
      { id: 'o1-mini', title: 'o1‑mini', blurb: 'Budget legacy reasoning.', pricing: { in: 1.1, cached: 0.55, out: 4.4 } },
      { id: 'o1-pro', title: 'o1‑pro', blurb: 'High-end legacy reasoning.', pricing: { in: 150.0, cached: null, out: 600.0 } },
    ],
  },
  {
    group: 'GPT‑4.1',
    models: [
      { id: 'gpt-4.1', title: 'GPT‑4.1', blurb: 'Strong general model.', pricing: { in: 2.0, cached: 0.5, out: 8.0 } },
      { id: 'gpt-4.1-mini', title: 'GPT‑4.1 mini', blurb: 'Great default for most chats.', pricing: { in: 0.4, cached: 0.1, out: 1.6 } },
      { id: 'gpt-4.1-nano', title: 'GPT‑4.1 nano', blurb: 'Small + cheap.', pricing: { in: 0.1, cached: 0.025, out: 0.4 } },
    ],
  },
  {
    group: 'GPT‑4o',
    models: [
      { id: 'gpt-4o', title: 'GPT‑4o', blurb: 'Multimodal general model.', pricing: { in: 2.5, cached: 1.25, out: 10.0 } },
      { id: 'gpt-4o-mini', title: 'GPT‑4o mini', blurb: 'Cheaper 4o variant.', pricing: { in: 0.15, cached: 0.075, out: 0.6 } },
    ],
  },
  {
    group: 'Audio (preview)',
    models: [
      { id: 'gpt-4o-audio-preview', title: 'GPT‑4o audio (preview)', blurb: 'Audio-capable variant (UI support TBD).', pricing: { in: 2.5, cached: null, out: 10.0 } },
      { id: 'gpt-4o-mini-audio-preview', title: 'GPT‑4o mini audio (preview)', blurb: 'Cheaper audio-capable variant (UI support TBD).', pricing: { in: 0.15, cached: null, out: 0.6 } },
    ],
  },
  {
    group: 'Realtime (preview)',
    models: [
      { id: 'gpt-4o-realtime-preview', title: 'GPT‑4o realtime (preview)', blurb: 'Realtime API model (UI support TBD).', pricing: { in: 5.0, cached: null, out: 20.0 } },
      { id: 'gpt-4o-mini-realtime-preview', title: 'GPT‑4o mini realtime (preview)', blurb: 'Cheaper realtime model (UI support TBD).', pricing: { in: 0.6, cached: null, out: 2.4 } },
    ],
  },
  {
    group: 'Search',
    models: [
      { id: 'gpt-5-search-api', title: 'GPT‑5 Search API', blurb: 'Search-specialized model.', pricing: { in: 1.25, cached: 0.125, out: 10.0 } },
      { id: 'gpt-4o-search-preview', title: 'GPT‑4o search preview', blurb: 'Search preview model.', pricing: { in: 2.5, cached: null, out: 10.0 } },
      { id: 'gpt-4o-mini-search-preview', title: 'GPT‑4o mini search preview', blurb: 'Cheaper search preview.', pricing: { in: 0.15, cached: null, out: 0.6 } },
    ],
  },
  {
    group: 'Computer Use',
    models: [
      { id: 'computer-use-preview', title: 'Computer Use (preview)', blurb: 'Agentic UI-driving model.', pricing: { in: 3.0, cached: null, out: 12.0 } },
    ],
  },
];

export function getModelInfo(modelId) {
  for (const group of MODEL_CATALOG) {
    for (const m of group.models) {
      if (m.id === modelId) return m;
    }
  }
  return null;
}

export function isReasoningModel(modelId) {
  return /^o\d/.test(modelId) || /^gpt-5/.test(modelId);
}

export function formatDollarsPer1M(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toFixed(Number(value) >= 10 ? 2 : 3).replace(/0+$/, '').replace(/\.$/, '')}`;
}

export function modelPricingLabel(pricing) {
  if (!pricing) return '';
  const input = formatDollarsPer1M(pricing.in);
  const output = formatDollarsPer1M(pricing.out);
  const cached = pricing.cached == null ? null : formatDollarsPer1M(pricing.cached);
  return cached ? `${input} in • ${cached} cached • ${output} out` : `${input} in • ${output} out`;
}
