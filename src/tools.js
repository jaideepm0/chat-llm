const MAX_ARGUMENT_JSON_CHARS = 4_096;
const MAX_TOOL_OUTPUT_CHARS = 8_000;
const DEFAULT_TOOL_TIMEOUT_MS = 2_000;

export class ToolExecutionError extends Error {
  constructor(message, code = 'tool_error') {
    super(message);
    this.name = 'ToolExecutionError';
    this.code = code;
  }
}

function getExprEvalParser() {
  const Parser = globalThis?.exprEval?.Parser;
  if (!Parser) throw new ToolExecutionError('Calculator library is missing. Refresh the page.', 'missing_dependency');
  return Parser;
}

function safeJsonParse(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  const raw = String(value).trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw };
  }
}

function toCompactString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function calcTool(args) {
  const expression = typeof args?.expression === 'string' ? args.expression.trim() : '';
  if (!expression) throw new ToolExecutionError('Missing `expression`.', 'invalid_arguments');
  if (expression.length > 500) throw new ToolExecutionError('Expression is too long.', 'arguments_too_large');
  const Parser = getExprEvalParser();
  const parser = new Parser();
  const result = parser.evaluate(expression, {});
  if (typeof result === 'number' && Number.isFinite(result)) return String(result);
  return toCompactString(result);
}

function timeTool(args) {
  const rawTimeZone = args?.time_zone;
  const timeZone = typeof rawTimeZone === 'string' ? rawTimeZone.trim() : '';
  if (timeZone.length > 128) throw new ToolExecutionError('Time zone is too long.', 'arguments_too_large');
  const now = new Date();
  const iso = now.toISOString();

  if (!timeZone) return iso;

  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
  return `${fmt.format(now)} (${iso})`;
}

const LOCAL_TOOLS = [
  {
    definition: {
      type: 'function',
      name: 'calculator',
      description: 'Evaluate a math expression (e.g. "(2+2)*8").',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate.' },
        },
        required: ['expression'],
      },
    },
    run: calcTool,
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  },
  {
    definition: {
      type: 'function',
      name: 'get_current_time',
      description: 'Get the current time. Optionally provide an IANA time zone (e.g. "America/Los_Angeles").',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          time_zone: { type: ['string', 'null'], description: 'IANA time zone name, or null for the local ISO timestamp.' },
        },
        required: ['time_zone'],
      },
    },
    run: timeTool,
    timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  },
];

export function getLocalToolDefinitions() {
  return LOCAL_TOOLS.map((t) => t.definition);
}

export function hasLocalTool(name) {
  return LOCAL_TOOLS.some((t) => t.definition.name === name);
}

function capToolOutput(value) {
  const out = toCompactString(value);
  if (out.length <= MAX_TOOL_OUTPUT_CHARS) return out;
  return `${out.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n[Tool output truncated]`;
}

function withTimeout(run, timeoutMs, name) {
  let timer = null;
  return Promise.race([
    Promise.resolve().then(run),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ToolExecutionError(`Tool timed out: ${name}`, 'timeout')), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function formatToolError(error) {
  return JSON.stringify({
    error: {
      code: error?.code || 'tool_error',
      message: error?.message || String(error),
    },
  });
}

export async function runLocalToolCall({ name, argumentsJson }) {
  const tool = LOCAL_TOOLS.find((t) => t.definition.name === name);
  if (!tool) throw new ToolExecutionError(`Unknown tool: ${name}`, 'unknown_tool');
  if (String(argumentsJson || '').length > MAX_ARGUMENT_JSON_CHARS) {
    throw new ToolExecutionError('Tool arguments are too large.', 'arguments_too_large');
  }
  const args = safeJsonParse(argumentsJson);
  if (args && typeof args === 'object' && typeof args.__raw === 'string') {
    throw new ToolExecutionError('Invalid tool arguments (expected JSON).', 'invalid_json');
  }
  const out = await withTimeout(() => tool.run(args), tool.timeoutMs || DEFAULT_TOOL_TIMEOUT_MS, name);
  return capToolOutput(out);
}
