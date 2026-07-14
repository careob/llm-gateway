import type { Request, Response } from 'express';
import { LLMGateway, GatewayError } from './gateway.js';
import type { ChatRequest } from './types.js';

export interface ProxyOptions {
  /** Optional auth check before proxying. Return true to allow. */
  authorize?: (req: Request) => boolean | Promise<boolean>;
  /** Extract metadata from request for spend tracking */
  extractMetadata?: (req: Request) => Record<string, string>;
}

/**
 * Returns Express route handlers you can mount on any route.
 *
 * Usage:
 *   const proxy = createExpressProxy(gateway);
 *   app.post('/llm/v1/chat/completions', proxy.chatCompletions);
 *   app.get('/llm/v1/health', proxy.health);
 */
export function createExpressProxy(gateway: LLMGateway, options: ProxyOptions = {}) {
  const chatCompletions = async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;
    if (!body?.messages) {
      res.status(400).json({ error: 'messages is required' });
      return;
    }

    if (options.authorize) {
      try {
        const allowed = await options.authorize(req);
        if (!allowed) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      } catch {
        res.status(401).json({ error: 'Authorization failed' });
        return;
      }
    }

    const metadata = options.extractMetadata?.(req);
    const request: ChatRequest = {
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      top_p: body.top_p,
      stream: body.stream,
      tools: body.tools,
      tool_choice: body.tool_choice,
      response_format: body.response_format,
      provider: body.provider,
      fallbackModels: body.fallbackModels,
      metadata,
    };

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        for await (const chunk of gateway.chatStream(request)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        const ge = err instanceof GatewayError ? err : new GatewayError(String(err), 'PROVIDER_ERROR');
        res.write(`data: ${JSON.stringify({ error: ge.message, code: ge.code })}\n\n`);
        res.end();
      }
      return;
    }

    try {
      const response = await gateway.chat(request);
      res.json(response);
    } catch (err) {
      const ge = err instanceof GatewayError ? err : new GatewayError(String(err), 'PROVIDER_ERROR');
      res.status(ge.statusCode ?? 502).json({
        error: { message: ge.message, code: ge.code },
      });
    }
  };

  const health = (_req: Request, res: Response) => {
    const stats = gateway.getStats();
    const healthy = stats.some((s) => s.healthy);
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      keys: stats,
    });
  };

  return { chatCompletions, health };
}
