import type { ChatMessage, ChatRequest, ChatResponse, TokenUsage } from './types.js';

// ─── API Format ────────────────────────────────────────────────
// Every LLM API boils down to one of these 3 formats.
// "openai" covers OpenAI, DeepSeek, Qwen, Zhipu, Moonshot, Yi, Groq, Together, etc.

export type ApiFormat = 'openai' | 'anthropic' | 'gemini';
export type AuthStyle = 'bearer' | 'x-api-key' | 'query';

// ─── Provider Definition ──────────────────────────────────────

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  format: ApiFormat;
  authStyle: AuthStyle;
  extraHeaders?: Record<string, string>;
  keyPatterns: RegExp[];
  envPrefixes: string[];
  models: string[];
  defaultRpm: number;
  costs: Record<string, { prompt: number; completion: number }>;
}

// ─── Provider Registry ────────────────────────────────────────
// To add a new provider: add one object here. That's it.

export const PROVIDERS: Record<string, ProviderDef> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [/^sk-proj-/],
    envPrefixes: ['OPENAI'],
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini', 'o4-mini'],
    defaultRpm: 500,
    costs: {
      'gpt-4o': { prompt: 2.5, completion: 10 },
      'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
      'gpt-4-turbo': { prompt: 10, completion: 30 },
      'gpt-4': { prompt: 30, completion: 60 },
      'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
      'o1': { prompt: 15, completion: 60 },
      'o1-mini': { prompt: 3, completion: 12 },
      'o3-mini': { prompt: 1.1, completion: 4.4 },
      'o4-mini': { prompt: 1.1, completion: 4.4 },
    },
  },

  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    format: 'anthropic',
    authStyle: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    keyPatterns: [/^sk-ant-/],
    envPrefixes: ['ANTHROPIC', 'CLAUDE'],
    models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022'],
    defaultRpm: 300,
    costs: {
      'claude-opus-4-20250514': { prompt: 15, completion: 75 },
      'claude-sonnet-4-20250514': { prompt: 3, completion: 15 },
      'claude-haiku-3-5-20241022': { prompt: 0.8, completion: 4 },
    },
  },

  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    format: 'gemini',
    authStyle: 'query',
    keyPatterns: [/^AIza/],
    envPrefixes: ['GEMINI', 'GOOGLE_AI'],
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultRpm: 360,
    costs: {
      'gemini-2.5-pro': { prompt: 1.25, completion: 10 },
      'gemini-2.5-flash': { prompt: 0.15, completion: 0.6 },
      'gemini-2.0-flash': { prompt: 0.1, completion: 0.4 },
      'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
      'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
    },
  },

  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [/^sk-[a-f0-9]{48}$/],
    envPrefixes: ['DEEPSEEK'],
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultRpm: 300,
    costs: {
      'deepseek-chat': { prompt: 0.14, completion: 0.28 },
      'deepseek-coder': { prompt: 0.14, completion: 0.28 },
      'deepseek-reasoner': { prompt: 0.55, completion: 2.19 },
    },
  },

  qwen: {
    id: 'qwen',
    label: 'Alibaba Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['QWEN', 'DASHSCOPE', 'ALIBABA'],
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'qwen-vl-plus', 'qwen-coder-turbo'],
    defaultRpm: 300,
    costs: {
      'qwen-turbo': { prompt: 0.08, completion: 0.16 },
      'qwen-plus': { prompt: 0.4, completion: 0.8 },
      'qwen-max': { prompt: 1.6, completion: 3.2 },
      'qwen-long': { prompt: 0.04, completion: 0.08 },
      'qwen-coder-turbo': { prompt: 0.15, completion: 0.3 },
    },
  },

  zhipu: {
    id: 'zhipu',
    label: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['ZHIPU', 'GLM', 'CHATGLM'],
    models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-4-long', 'glm-4v'],
    defaultRpm: 300,
    costs: {
      'glm-4': { prompt: 1.4, completion: 1.4 },
      'glm-4-flash': { prompt: 0.01, completion: 0.01 },
      'glm-4-plus': { prompt: 0.7, completion: 0.7 },
      'glm-4-long': { prompt: 0.14, completion: 0.14 },
    },
  },

  moonshot: {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['MOONSHOT', 'KIMI'],
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultRpm: 300,
    costs: {
      'moonshot-v1-8k': { prompt: 0.15, completion: 0.15 },
      'moonshot-v1-32k': { prompt: 0.35, completion: 0.35 },
      'moonshot-v1-128k': { prompt: 0.85, completion: 0.85 },
    },
  },

  yi: {
    id: 'yi',
    label: '01.AI Yi',
    baseUrl: 'https://api.01.ai/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['YI', 'LINGYIWANWU'],
    models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-large-turbo'],
    defaultRpm: 300,
    costs: {
      'yi-large': { prompt: 2.5, completion: 2.5 },
      'yi-medium': { prompt: 0.36, completion: 0.36 },
      'yi-spark': { prompt: 0.12, completion: 0.12 },
      'yi-large-turbo': { prompt: 1.7, completion: 1.7 },
    },
  },

  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [/^gsk_/],
    envPrefixes: ['GROQ'],
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultRpm: 30,
    costs: {
      'llama-3.3-70b-versatile': { prompt: 0.59, completion: 0.79 },
      'llama-3.1-8b-instant': { prompt: 0.05, completion: 0.08 },
      'mixtral-8x7b-32768': { prompt: 0.24, completion: 0.24 },
    },
  },

  together: {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['TOGETHER'],
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1'],
    defaultRpm: 300,
    costs: {
      'meta-llama/Llama-3.3-70B-Instruct-Turbo': { prompt: 0.88, completion: 0.88 },
      'deepseek-ai/DeepSeek-R1': { prompt: 3.0, completion: 7.0 },
    },
  },

  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    format: 'openai',
    authStyle: 'bearer',
    keyPatterns: [],
    envPrefixes: ['MISTRAL'],
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
    defaultRpm: 300,
    costs: {
      'mistral-large-latest': { prompt: 2, completion: 6 },
      'mistral-small-latest': { prompt: 0.1, completion: 0.3 },
      'codestral-latest': { prompt: 0.3, completion: 0.9 },
    },
  },
};

// ─── Auto-Detection ────────────────────────────────────────────

export function detectProvider(key: string): string | null {
  for (const [id, def] of Object.entries(PROVIDERS)) {
    for (const pattern of def.keyPatterns) {
      if (pattern.test(key)) return id;
    }
  }
  if (/^sk-/.test(key)) return 'openai';
  return null;
}

export function discoverKeysFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Array<{ key: string; provider: string; label: string }> {
  const found: Array<{ key: string; provider: string; label: string }> = [];

  for (const [envName, value] of Object.entries(env)) {
    if (!value || value.length < 8) continue;

    for (const [providerId, def] of Object.entries(PROVIDERS)) {
      for (const prefix of def.envPrefixes) {
        const pattern = new RegExp(`^${prefix}_(?:API_)?KEY(?:_(\\d+))?$`, 'i');
        const match = envName.match(pattern);
        if (match) {
          const suffix = match[1] ? `-${match[1]}` : '';
          found.push({
            key: value,
            provider: providerId,
            label: `${providerId}${suffix}`,
          });
        }
      }
    }
  }

  return found;
}

// ─── Request Building (Dynamic) ────────────────────────────────
// 3 format functions handle all 11+ providers.

export function buildRequest(
  provider: ProviderDef,
  request: ChatRequest,
  apiKey: string,
): { url: string; init: RequestInit } {
  const headers = buildAuthHeaders(provider, apiKey);
  const FORMATS: Record<ApiFormat, () => { url: string; body: Record<string, unknown> }> = {
    openai: () => ({
      url: `${provider.baseUrl}/chat/completions`,
      body: buildOpenAIBody(request),
    }),
    anthropic: () => ({
      url: `${provider.baseUrl}/messages`,
      body: buildAnthropicBody(request),
    }),
    gemini: () => {
      const endpoint = request.stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
      return {
        url: `${provider.baseUrl}/models/${request.model}:${endpoint}key=${apiKey}`,
        body: buildGeminiBody(request),
      };
    },
  };

  const { url, body } = FORMATS[provider.format]();
  return {
    url,
    init: { method: 'POST', headers, body: JSON.stringify(body) } as RequestInit,
  };
}

export function parseResponse(provider: ProviderDef, data: unknown): ChatResponse {
  const PARSERS: Record<ApiFormat, (d: unknown) => ChatResponse> = {
    openai: parseOpenAIFormat,
    anthropic: parseAnthropicFormat,
    gemini: parseGeminiFormat,
  };
  return PARSERS[provider.format](data);
}

export function parseStreamChunk(line: string): StreamChunkResult | null {
  const payload = extractSseData(line);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as StreamChunkResult;
  } catch {
    return null;
  }
}

export type StreamChunkResult = import('./types.js').StreamChunk & { usage?: TokenUsage };

/**
 * Returns a (possibly stateful) parser that turns one SSE line from the
 * provider into a normalized OpenAI-style stream chunk, or null if the
 * line carries no content. Create a fresh parser per stream.
 */
export function createStreamParser(provider: ProviderDef): (line: string) => StreamChunkResult | null {
  const FACTORIES: Record<ApiFormat, () => (line: string) => StreamChunkResult | null> = {
    openai: () => parseStreamChunk,
    anthropic: createAnthropicStreamParser,
    gemini: createGeminiStreamParser,
  };
  return FACTORIES[provider.format]();
}

function extractSseData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  return payload;
}

function createAnthropicStreamParser(): (line: string) => StreamChunkResult | null {
  let id = '';
  let model = '';
  let promptTokens = 0;
  let completionTokens = 0;

  return (line) => {
    const payload = extractSseData(line);
    if (!payload) return null;

    let event: {
      type?: string;
      message?: { id?: string; model?: string; usage?: { input_tokens?: number } };
      delta?: { text?: string; stop_reason?: string };
      usage?: { output_tokens?: number };
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return null;
    }

    const chunk = (delta: Partial<ChatMessage>, finishReason: string | null): StreamChunkResult => ({
      id,
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    });

    switch (event.type) {
      case 'message_start':
        id = event.message?.id ?? id;
        model = event.message?.model ?? model;
        promptTokens = event.message?.usage?.input_tokens ?? 0;
        return chunk({ role: 'assistant', content: '' }, null);
      case 'content_block_delta':
        if (!event.delta?.text) return null;
        return chunk({ content: event.delta.text }, null);
      case 'message_delta': {
        completionTokens = event.usage?.output_tokens ?? completionTokens;
        const stop = event.delta?.stop_reason;
        const final = chunk({}, stop === 'end_turn' ? 'stop' : stop ?? null);
        final.usage = {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        };
        return final;
      }
      default:
        return null;
    }
  };
}

function createGeminiStreamParser(): (line: string) => StreamChunkResult | null {
  const id = `gemini-${Date.now()}`;

  return (line) => {
    const payload = extractSseData(line);
    if (!payload) return null;

    let event: {
      modelVersion?: string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return null;
    }

    const candidate = event.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const finish = candidate?.finishReason;
    if (!text && !finish) return null;

    const result: StreamChunkResult = {
      id,
      object: 'chat.completion.chunk',
      model: event.modelVersion ?? 'gemini',
      choices: [{
        index: 0,
        delta: text ? { content: text } : {},
        finish_reason: finish ? (finish === 'STOP' ? 'stop' : finish) : null,
      }],
    };
    const meta = event.usageMetadata;
    if (meta) {
      result.usage = {
        prompt_tokens: meta.promptTokenCount ?? 0,
        completion_tokens: meta.candidatesTokenCount ?? 0,
        total_tokens: meta.totalTokenCount ?? 0,
      };
    }
    return result;
  };
}

// ─── Cost Estimation ──────────────────────────────────────────

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  for (const def of Object.values(PROVIDERS)) {
    const costs = def.costs[model];
    if (costs) {
      return (promptTokens / 1_000_000) * costs.prompt
        + (completionTokens / 1_000_000) * costs.completion;
    }
  }
  return 0;
}

// ─── Resolve model → provider ─────────────────────────────────

export function findProviderForModel(model: string): ProviderDef | null {
  for (const def of Object.values(PROVIDERS)) {
    if (def.models.includes(model)) return def;
  }
  return null;
}

// ─── Shared Internals ─────────────────────────────────────────

function buildAuthHeaders(provider: ProviderDef, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const AUTH: Record<AuthStyle, () => void> = {
    bearer: () => { headers['Authorization'] = `Bearer ${apiKey}`; },
    'x-api-key': () => { headers['x-api-key'] = apiKey; },
    query: () => {},
  };
  AUTH[provider.authStyle]();
  if (provider.extraHeaders) Object.assign(headers, provider.extraHeaders);
  return headers;
}

function splitSystemMessages(messages: ChatMessage[]): { system: string | undefined; rest: Array<{ role: string; content: string }> } {
  let system: string | undefined;
  const rest: Array<{ role: string; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') system = (system ? system + '\n' : '') + msg.content;
    else rest.push({ role: msg.role, content: msg.content });
  }
  return { system, rest };
}

function buildOpenAIBody(req: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.model, messages: req.messages };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.stream !== undefined) body.stream = req.stream;
  if (req.tools) body.tools = req.tools;
  if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
  if (req.response_format) body.response_format = req.response_format;
  if (req.stream) body.stream_options = { include_usage: true };
  return body;
}

function buildAnthropicBody(req: ChatRequest): Record<string, unknown> {
  const { system, rest } = splitSystemMessages(req.messages);
  const body: Record<string, unknown> = { model: req.model, messages: rest, max_tokens: req.max_tokens ?? 4096 };
  if (system) body.system = system;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.stream !== undefined) body.stream = req.stream;
  return body;
}

function buildGeminiBody(req: ChatRequest): Record<string, unknown> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  let systemText: string | undefined;
  for (const msg of req.messages) {
    if (msg.role === 'system') systemText = (systemText ? systemText + '\n' : '') + msg.content;
    else contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
  }
  const body: Record<string, unknown> = { contents };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  const genConfig: Record<string, unknown> = {};
  if (req.temperature !== undefined) genConfig.temperature = req.temperature;
  if (req.max_tokens !== undefined) genConfig.maxOutputTokens = req.max_tokens;
  if (req.top_p !== undefined) genConfig.topP = req.top_p;
  if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;
  return body;
}

function parseOpenAIFormat(data: unknown): ChatResponse {
  const raw = data as Record<string, unknown>;
  const usage = (raw.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }) as TokenUsage;
  return {
    id: (raw.id as string) ?? `gen-${Date.now()}`,
    object: (raw.object as string) ?? 'chat.completion',
    model: raw.model as string,
    choices: raw.choices as ChatResponse['choices'],
    usage,
    _gateway: { provider: '', keyLabel: '', latencyMs: 0, attempt: 0 },
  };
}

function parseAnthropicFormat(data: unknown): ChatResponse {
  const raw = data as {
    id: string;
    content: Array<{ type: string; text: string }>;
    model: string;
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  };
  const text = raw.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return {
    id: raw.id,
    object: 'chat.completion',
    model: raw.model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: raw.stop_reason === 'end_turn' ? 'stop' : raw.stop_reason }],
    usage: { prompt_tokens: raw.usage.input_tokens, completion_tokens: raw.usage.output_tokens, total_tokens: raw.usage.input_tokens + raw.usage.output_tokens },
    _gateway: { provider: '', keyLabel: '', latencyMs: 0, attempt: 0 },
  };
}

function parseGeminiFormat(data: unknown): ChatResponse {
  const raw = data as {
    candidates?: Array<{ content: { parts: Array<{ text: string }>; role: string }; finishReason: string }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
  };
  const candidate = raw.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
  const meta = raw.usageMetadata;
  return {
    id: `gemini-${Date.now()}`,
    object: 'chat.completion',
    model: 'gemini',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : (candidate?.finishReason ?? 'stop') }],
    usage: { prompt_tokens: meta?.promptTokenCount ?? 0, completion_tokens: meta?.candidatesTokenCount ?? 0, total_tokens: meta?.totalTokenCount ?? 0 },
    _gateway: { provider: '', keyLabel: '', latencyMs: 0, attempt: 0 },
  };
}
