// ─── Key & Provider Config ─────────────────────────────────────

export interface KeyInput {
  key: string;
  /** Provider name — auto-detected from key prefix if omitted */
  provider?: string;
  /** Requests per minute limit. Default: from provider registry */
  rpm?: number;
  /** Tokens per minute limit. Optional */
  tpm?: number;
  /** Human label (e.g. "prod-key-1"). Auto-generated if omitted */
  label?: string;
}

export interface GatewayConfig {
  /** API keys — strings auto-detect provider; objects allow explicit control */
  keys: Array<string | KeyInput>;
  /** Default model to use when not specified in request */
  defaultModel?: string;
  /**
   * Cross-provider fallback chains, keyed by primary model.
   * e.g. { 'gpt-4o': ['claude-sonnet-4-20250514', 'gemini-2.5-flash'] }
   * When all keys for the primary model's provider are exhausted, the
   * request is retried with the mapped models on their own providers.
   */
  fallbackModels?: Record<string, string[]>;
  /** Retries across keys before failing. Default: 3 */
  maxRetries?: number;
  /** Cooldown ms for a rate-limited key. Default: 60000 */
  cooldownMs?: number;
  /** Request timeout ms. Default: 30000 */
  timeoutMs?: number;
  /** Called after every LLM request for logging/tracking */
  onUsage?: (log: UsageLog) => void | Promise<void>;
  /** Called when all keys for a provider are exhausted */
  onAllKeysExhausted?: (provider: string) => void;
}

// ─── Chat Types (OpenAI-compatible surface) ────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  /** Force a specific provider by name */
  provider?: string;
  /** Ordered fallback models to try if this model's provider is exhausted. Overrides GatewayConfig.fallbackModels */
  fallbackModels?: string[];
  /** Metadata for spend tracking */
  metadata?: Record<string, string>;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  model: string;
  choices: ChatChoice[];
  usage: TokenUsage;
  _gateway: {
    provider: string;
    keyLabel: string;
    latencyMs: number;
    attempt: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
}

// ─── Usage Logging ─────────────────────────────────────────────

export interface UsageLog {
  requestId: string;
  provider: string;
  keyLabel: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: 'success' | 'rate_limited' | 'error';
  error?: string;
  metadata?: Record<string, string>;
  timestamp: Date;
}

// ─── Internal Key State ────────────────────────────────────────

export interface KeyState {
  key: string;
  provider: string;
  label: string;
  rpm: number;
  tpm: number;
  requestsThisMinute: number;
  tokensThisMinute: number;
  minuteStart: number;
  cooldownUntil: number;
  totalRequests: number;
  totalErrors: number;
  healthy: boolean;
}
