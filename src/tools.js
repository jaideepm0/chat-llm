function getExprEvalParser() {
  const Parser = globalThis?.exprEval?.Parser;
  if (!Parser) throw new Error('Calculator library is missing. Refresh the page.');
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
  if (!expression) throw new Error('Missing `expression`.');
  const Parser = getExprEvalParser();
  const parser = new Parser();
  const result = parser.evaluate(expression, {});
  if (typeof result === 'number' && Number.isFinite(result)) return String(result);
  return toCompactString(result);
}

function timeTool(args) {
  const timeZone = typeof args?.time_zone === 'string' ? args.time_zone.trim() : '';
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
          time_zone: { type: 'string', description: 'IANA time zone name.' },
        },
        required: [],
      },
    },
    run: timeTool,
  },
];

export function getLocalToolDefinitions() {
  return LOCAL_TOOLS.map((t) => t.definition);
}

export function hasLocalTool(name) {
  return LOCAL_TOOLS.some((t) => t.definition.name === name);
}

export async function runLocalToolCall({ name, argumentsJson }) {
  const tool = LOCAL_TOOLS.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const args = safeJsonParse(argumentsJson);
  if (args && typeof args === 'object' && typeof args.__raw === 'string') {
    throw new Error('Invalid tool arguments (expected JSON).');
  }
  const out = await tool.run(args);
  return toCompactString(out);
}

