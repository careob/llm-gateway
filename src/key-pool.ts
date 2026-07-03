import type { KeyState } from './types.js';

export class KeyPool {
  private keys: KeyState[] = [];
  private roundRobinIndex = 0;

  constructor(private cooldownMs: number) {}

  addKey(key: string, provider: string, label: string, rpm: number, tpm: number): void {
    this.keys.push({
      key,
      provider,
      label,
      rpm,
      tpm,
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      minuteStart: Date.now(),
      cooldownUntil: 0,
      totalRequests: 0,
      totalErrors: 0,
      healthy: true,
    });
  }

  getNextKey(provider: string): KeyState | null {
    const candidates = this.keys.filter((k) => k.provider === provider);
    if (candidates.length === 0) return null;

    const now = Date.now();
    const startIdx = this.roundRobinIndex % candidates.length;

    for (let i = 0; i < candidates.length; i++) {
      const idx = (startIdx + i) % candidates.length;
      const key = candidates[idx];

      if (now - key.minuteStart > 60_000) {
        key.requestsThisMinute = 0;
        key.tokensThisMinute = 0;
        key.minuteStart = now;
      }

      if (key.cooldownUntil > now) continue;
      if (!key.healthy) {
        if (key.cooldownUntil <= now) key.healthy = true;
        else continue;
      }
      if (key.requestsThisMinute >= key.rpm) continue;
      if (key.tpm > 0 && key.tokensThisMinute >= key.tpm) continue;

      this.roundRobinIndex = idx + 1;
      return key;
    }

    return null;
  }

  recordSuccess(key: KeyState, tokens: number): void {
    key.requestsThisMinute++;
    key.tokensThisMinute += tokens;
    key.totalRequests++;
  }

  recordRateLimit(key: KeyState): void {
    key.cooldownUntil = Date.now() + this.cooldownMs;
    key.healthy = false;
    key.totalErrors++;
  }

  recordError(key: KeyState): void {
    key.totalErrors++;
  }

  getProviders(): string[] {
    return [...new Set(this.keys.map((k) => k.provider))];
  }

  getStats() {
    return this.keys.map((k) => ({
      provider: k.provider,
      label: k.label,
      healthy: k.healthy && k.cooldownUntil <= Date.now(),
      requestsThisMinute: k.requestsThisMinute,
      totalRequests: k.totalRequests,
      totalErrors: k.totalErrors,
      cooldownUntil: k.cooldownUntil,
    }));
  }
}
