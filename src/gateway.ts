import { KeyPool } from './key-pool.js';
import {
  PROVIDERS,
  detectProvider,
  discoverKeysFromEnv,
  findProviderForModel,
  buildRequest,
  parseResponse,
  parseStreamChunk,
  estimateCost,
} from './registry.js';
import type { ProviderDef } from './registry.js';
import type {
  GatewayConfig,
  KeyInput,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  UsageLog,
  KeyState,
  TokenUsage,
} from './types.js';

export class LLMGateway {
  private pool: KeyPool;
  private config: GatewayConfig & { maxRetries: number; cooldownMs: number; timeoutMs: number };
  private providersByKey = new Map<string, ProviderDef>();

  constructor(config: GatewayConfig) {
    this.config = {
      ...config,
      maxRetries: config.maxRetries ?? 3,
      cooldownMs: config.cooldownMs ?? 60_000,
      timeoutMs: config.timeoutMs ?? 30_000,
    };
    this.pool = new KeyPool(this.config.cooldownMs);
    this.registerKeys(config.keys);
  }

  /**
   * Auto-discover keys from environment variables.
   * Scans for OPENAI_API_KEY, ANTHROPIC_KEY, GEMINI_API_KEY_1, DEEPSEEK_KEY, etc.
   */
  static fromEnv(
    overrides: Omit<GatewayConfig, 'keys'> = {},
    env?: Record<string, string | undefined>,
  ): LLMGateway {
    const discovered = discoverKeysFromEnv(env);
    if (discovered.length === 0) {
      throw new GatewayError('No API keys found in environment. Expected vars like OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.', 'CONFIG_ERROR');
    }
    return new LLMGateway({
      ...overrides,
      keys: discovered.map((d) => ({ key: d.key, provider: d.provider, label: d.label })),
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? this.config.defaultModel;
    if (!model) throw new GatewayError('No model specified and no defaultModel configured', 'CONFIG_ERROR');

    const fullRequest = { ...request, model, stream: false };
    const providers = this.resolveProviders(fullRequest);
    let lastError: Error | null = null;
    let attempt = 0;

    for (const providerDef of providers) {
      for (let retry = 0; retry < this.config.maxRetries; retry++) {
        const key = this.pool.getNextKey(providerDef.id);
        if (!key) break;

        attempt++;
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const start = Date.now();

        try {
          const { url, init } = buildRequest(providerDef, fullRequest, key.key);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
          init.signal = controller.signal;

          const res = await fetch(url, init);
          clearTimeout(timeout);

          if (res.status === 429) {
            this.pool.recordRateLimit(key);
            this.logUsage(requestId, providerDef.id, key, model, start, 'rate_limited', undefined, 'Rate limited');
            continue;
          }

          if (!res.ok) {
            const errorText = await res.text().catch(() => `HTTP ${res.status}`);
            this.pool.recordError(key);
            lastError = new GatewayError(`${providerDef.label}: ${errorText}`, 'PROVIDER_ERROR', res.status);
            this.logUsage(requestId, providerDef.id, key, model, start, 'error', undefined, errorText);
            continue;
          }

          const data = await res.json();
          const parsed = parseResponse(providerDef, data);
          parsed._gateway = {
            provider: providerDef.id,
            keyLabel: key.label,
            latencyMs: Date.now() - start,
            attempt,
          };

          this.pool.recordSuccess(key, parsed.usage.total_tokens);
          this.logUsage(requestId, providerDef.id, key, model, start, 'success', parsed.usage, undefined, request.metadata);

          return parsed;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.pool.recordError(key);
          if (msg.includes('abort')) {
            lastError = new GatewayError(`${providerDef.label}: timeout`, 'TIMEOUT');
          } else {
            lastError = err instanceof GatewayError ? err : new GatewayError(`${providerDef.label}: ${msg}`, 'NETWORK_ERROR');
          }
          this.logUsage(requestId, providerDef.id, key, model, start, 'error', undefined, msg);
        }
      }

      this.config.onAllKeysExhausted?.(providerDef.id);
    }

    throw lastError ?? new GatewayError('All providers and keys exhausted', 'ALL_EXHAUSTED');
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const model = request.model ?? this.config.defaultModel;
    if (!model) throw new GatewayError('No model specified and no defaultModel configured', 'CONFIG_ERROR');

    const fullRequest = { ...request, model, stream: true };
    const providers = this.resolveProviders(fullRequest);
    let lastError: Error | null = null;

    for (const providerDef of providers) {
      if (providerDef.format !== 'openai') {
        continue;
      }

      for (let retry = 0; retry < this.config.maxRetries; retry++) {
        const key = this.pool.getNextKey(providerDef.id);
        if (!key) break;

        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const start = Date.now();

        try {
          const { url, init } = buildRequest(providerDef, fullRequest, key.key);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs * 3);
          init.signal = controller.signal;

          const res = await fetch(url, init);
          clearTimeout(timeout);

          if (res.status === 429) {
            this.pool.recordRateLimit(key);
            continue;
          }

          if (!res.ok) {
            this.pool.recordError(key);
            lastError = new GatewayError(`${providerDef.label}: HTTP ${res.status}`, 'PROVIDER_ERROR', res.status);
            continue;
          }

          if (!res.body) throw new GatewayError('No response body for stream', 'PROVIDER_ERROR');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let totalTokens = 0;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                const chunk = parseStreamChunk(line);
                if (chunk) {
                  if (chunk.usage) totalTokens = chunk.usage.total_tokens;
                  yield chunk;
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          this.pool.recordSuccess(key, totalTokens);
          this.logUsage(requestId, providerDef.id, key, model, start, 'success', {
            prompt_tokens: 0, completion_tokens: 0, total_tokens: totalTokens,
          }, undefined, request.metadata);

          return;
        } catch (err) {
          if (err instanceof GatewayError) throw err;
          this.pool.recordError(key);
          lastError = new GatewayError(
            `${providerDef.label}: ${err instanceof Error ? err.message : String(err)}`,
            'NETWORK_ERROR',
          );
        }
      }
    }

    throw lastError ?? new GatewayError('All providers exhausted for streaming', 'ALL_EXHAUSTED');
  }

  /** Get health/stats for all registered keys */
  getStats() {
    return this.pool.getStats();
  }

  /** List all registered providers */
  getProviders() {
    return this.pool.getProviders();
  }

  // ── Private ──────────────────────────────────────────────────

  private registerKeys(keys: Array<string | KeyInput>): void {
    let autoIndex = 0;

    for (const input of keys) {
      const normalized: KeyInput = typeof input === 'string' ? { key: input } : input;
      const providerId = normalized.provider ?? detectProvider(normalized.key);

      if (!providerId) {
        throw new GatewayError(
          `Cannot auto-detect provider for key "${normalized.key.slice(0, 4)}****". ` +
          `Pass { key, provider: "deepseek" } explicitly.`,
          'CONFIG_ERROR',
        );
      }

      const providerDef = PROVIDERS[providerId];
      if (!providerDef) {
        throw new GatewayError(`Unknown provider "${providerId}". Known: ${Object.keys(PROVIDERS).join(', ')}`, 'CONFIG_ERROR');
      }

      autoIndex++;
      const label = normalized.label ?? `${providerId}-${autoIndex}`;
      const rpm = normalized.rpm ?? providerDef.defaultRpm;
      const tpm = normalized.tpm ?? 0;

      this.pool.addKey(normalized.key, providerId, label, rpm, tpm);
      this.providersByKey.set(normalized.key, providerDef);
    }
  }

  private resolveProviders(request: ChatRequest): ProviderDef[] {
    if (request.provider) {
      const def = PROVIDERS[request.provider];
      if (!def) throw new GatewayError(`Provider "${request.provider}" not found`, 'CONFIG_ERROR');
      return [def];
    }

    const registeredProviders = this.pool.getProviders();
    const modelProvider = findProviderForModel(request.model!);

    if (modelProvider && registeredProviders.includes(modelProvider.id)) {
      const others = registeredProviders
        .filter((id) => id !== modelProvider.id)
        .map((id) => PROVIDERS[id])
        .filter(Boolean) as ProviderDef[];
      return [modelProvider, ...others];
    }

    return registeredProviders.map((id) => PROVIDERS[id]).filter(Boolean) as ProviderDef[];
  }

  private logUsage(
    requestId: string,
    provider: string,
    key: KeyState,
    model: string,
    startMs: number,
    status: 'success' | 'rate_limited' | 'error',
    usage?: TokenUsage,
    error?: string,
    metadata?: Record<string, string>,
  ): void {
    if (!this.config.onUsage) return;

    const log: UsageLog = {
      requestId,
      provider,
      keyLabel: key.label,
      model,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      estimatedCostUsd: usage ? estimateCost(model, usage.prompt_tokens, usage.completion_tokens) : 0,
      latencyMs: Date.now() - startMs,
      status,
      error,
      metadata,
      timestamp: new Date(),
    };

    try {
      const result = this.config.onUsage(log);
      if (result instanceof Promise) result.catch(() => {});
    } catch {
      // spend tracking should never crash the gateway
    }
  }
}

export type GatewayErrorCode =
  | 'CONFIG_ERROR'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ALL_EXHAUSTED'
  | 'UNSUPPORTED';

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: GatewayErrorCode,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
