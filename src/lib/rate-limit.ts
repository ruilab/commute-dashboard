/**
 * Simple in-memory rate limiter for API routes.
 * Uses a token-bucket algorithm per key.
 * No DB dependency — keeps state in process memory (resets on cold start).
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitConfig {
  maxTokens: number; // max requests in window
  refillRate: number; // tokens per second
}

const CONFIGS: Record<string, RateLimitConfig> = {
  "checkin-sync": { maxTokens: 30, refillRate: 0.5 }, // 30 req, refill 1/2s
  "push-subscribe": { maxTokens: 5, refillRate: 0.1 }, // 5 req, refill 1/10s
  widget: { maxTokens: 20, refillRate: 0.33 }, // 20 req, refill 1/3s
  cron: { maxTokens: 3, refillRate: 0.05 }, // 3 req, refill 1/20s
  "feature-request": { maxTokens: 5, refillRate: 0.02 }, // 5 req, refill 1/50s
  default: { maxTokens: 60, refillRate: 1 },
};

export function checkRateLimit(
  userId: string,
  endpoint: string
): { allowed: boolean; remaining: number; retryAfterSec: number | null } {
  const key = `${userId}:${endpoint}`;
  const config = CONFIGS[endpoint] || CONFIGS.default;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.maxTokens,
    bucket.tokens + elapsed * config.refillRate
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: null };
  }

  const retryAfterSec = Math.ceil((1 - bucket.tokens) / config.refillRate);
  return { allowed: false, remaining: 0, retryAfterSec };
}
