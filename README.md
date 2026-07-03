# @careob/llm-gateway

Lightweight LLM gateway for Node.js with multi-key rotation, rate-limit handling, provider failover, and spend tracking.

## Features

- **11+ providers** — OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, Together, Qwen, Zhipu, Moonshot, Yi
- **Key rotation** — round-robin across multiple API keys per provider
- **Rate-limit handling** — automatic cooldown and retry on 429s
- **Provider failover** — falls back to alternate providers when one is exhausted
- **Spend tracking** — per-request cost estimation and usage logging
- **Streaming** — SSE streaming support for OpenAI-compatible providers
- **Express middleware** — drop-in proxy for Express apps
- **Auto-discovery** — detects API keys from environment variables
- **Zero dependencies** — only uses `express` as an optional peer dependency

## Install

```bash
npm install @careob/llm-gateway
```

## Quick Start

```typescript
import { LLMGateway } from '@careob/llm-gateway';

const gateway = new LLMGateway({
  keys: [
    'sk-proj-your-openai-key',
    { key: 'sk-ant-your-anthropic-key', provider: 'anthropic' },
  ],
  defaultModel: 'gpt-4o',
});

const response = await gateway.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

### Auto-discover keys from environment

```typescript
// Reads OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.
const gateway = LLMGateway.fromEnv({ defaultModel: 'gpt-4o' });
```

## Multi-Key Rotation

Pass multiple keys for the same provider to distribute load:

```typescript
const gateway = new LLMGateway({
  keys: [
    { key: 'sk-proj-key-1', provider: 'openai', label: 'prod-1' },
    { key: 'sk-proj-key-2', provider: 'openai', label: 'prod-2' },
    { key: 'sk-proj-key-3', provider: 'openai', label: 'prod-3' },
  ],
  defaultModel: 'gpt-4o',
});
```

Keys are rotated round-robin. When a key hits a 429, it's automatically cooled down and the next key is used.

## Streaming

```typescript
for await (const chunk of gateway.chatStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a poem' }],
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

## Express Proxy

Mount the gateway as an API endpoint in your Express app:

```typescript
import express from 'express';
import { LLMGateway, createExpressProxy } from '@careob/llm-gateway';

const app = express();
app.use(express.json());

const gateway = LLMGateway.fromEnv({ defaultModel: 'gpt-4o' });
const proxy = createExpressProxy(gateway, {
  authorize: (req) => req.headers['x-api-key'] === 'your-secret',
  extractMetadata: (req) => ({ userId: req.headers['x-user-id'] as string }),
});

app.post('/v1/chat/completions', proxy.chatCompletions);
app.get('/v1/health', proxy.health);

app.listen(3000);
```

## Spend Tracking

```typescript
const gateway = new LLMGateway({
  keys: ['sk-proj-...'],
  defaultModel: 'gpt-4o',
  onUsage: (log) => {
    console.log(`${log.model} | ${log.totalTokens} tokens | $${log.estimatedCostUsd.toFixed(6)}`);
    // Save to your database, send to analytics, etc.
  },
  onAllKeysExhausted: (provider) => {
    console.warn(`All ${provider} keys exhausted!`);
  },
});
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `keys` | *required* | Array of API key strings or `KeyInput` objects |
| `defaultModel` | — | Model to use when not specified in request |
| `maxRetries` | `3` | Retries across keys before failing |
| `cooldownMs` | `60000` | Cooldown duration for rate-limited keys (ms) |
| `timeoutMs` | `30000` | Request timeout (ms) |
| `onUsage` | — | Callback for usage/spend logging |
| `onAllKeysExhausted` | — | Callback when all keys for a provider are exhausted |

### KeyInput

```typescript
{
  key: string;
  provider?: string;   // Auto-detected from key prefix if omitted
  rpm?: number;        // Requests per minute limit
  tpm?: number;        // Tokens per minute limit
  label?: string;      // Human-readable label (e.g. "prod-key-1")
}
```

## Supported Providers

| Provider | Format | Models |
|---|---|---|
| OpenAI | openai | gpt-4o, gpt-4o-mini, o1, o3-mini, o4-mini, ... |
| Anthropic | anthropic | claude-opus-4, claude-sonnet-4, claude-haiku-3.5 |
| Google Gemini | gemini | gemini-2.5-pro, gemini-2.5-flash, ... |
| DeepSeek | openai | deepseek-chat, deepseek-coder, deepseek-reasoner |
| Groq | openai | llama-3.3-70b, mixtral-8x7b, ... |
| Mistral | openai | mistral-large, mistral-small, codestral |
| Together AI | openai | Llama-3.3-70B, DeepSeek-R1, ... |
| Qwen | openai | qwen-turbo, qwen-plus, qwen-max |
| Zhipu | openai | glm-4, glm-4-flash, glm-4-plus |
| Moonshot | openai | moonshot-v1-8k/32k/128k |
| Yi | openai | yi-large, yi-medium, yi-spark |

## Health Check

```typescript
const stats = gateway.getStats();
// [{ provider: 'openai', label: 'prod-1', healthy: true, requestsThisMinute: 12, ... }]
```

## License

MIT
