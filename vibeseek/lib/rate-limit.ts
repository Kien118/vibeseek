import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Cross-instance rate limit via Upstash Redis.
 * Replaces in-memory Map from Phase 3 T-304 — serverless cold-start
 * bucket reset + multi-region lenience fixed as of Phase 5 T-408.
 *
 * Fail-open semantics: if Upstash is unreachable OR credentials missing,
 * the call returns { ok: true } and logs a warning. Rate-limit is
 * anti-spam, not security — service degradation should not break UX.
 */

// Lazy singleton Redis client — created on first call, reused thereafter.
// Constructor is cheap but we avoid firing on cold starts where rate-limit
// is never checked (e.g. static page renders).
let redisClient: Redis | null = null
function getRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return null // caller fail-opens + warn-logs
  }
  redisClient = new Redis({ url, token })
  return redisClient
}

// Cache Ratelimit instances keyed by (limit, windowMs) — two callers
// today: (10, 60_000) for chat POST + (30, 60_000) for history GET.
// Caching avoids re-instantiating the helper on every request.
const limiters = new Map<string, Ratelimit>()

function toDuration(ms: number): `${number} ms` {
  return `${ms} ms`
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const cacheKey = `${limit}:${windowMs}`
  const cached = limiters.get(cacheKey)
  if (cached) return cached
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, toDuration(windowMs)),
    analytics: false,
    prefix: 'vibeseek:rl',
  })
  limiters.set(cacheKey, rl)
  return rl
}

/**
 * Check + consume rate limit. Returns { ok: true } or { ok: false, retryAfterMs }.
 * Default: 10 requests / 60 seconds per key.
 *
 * Breaking change vs T-304: function is async now. Callers must `await`.
 */
export async function consume(
  key: string,
  limit = 10,
  windowMs = 60_000,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const limiter = getLimiter(limit, windowMs)
  if (!limiter) {
    console.warn('[rate-limit] Upstash not configured — fail-open')
    return { ok: true }
  }
  try {
    const { success, reset } = await limiter.limit(key)
    if (success) return { ok: true }
    const retryAfterMs = Math.max(0, reset - Date.now())
    return { ok: false, retryAfterMs }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[rate-limit] Upstash error, fail-open:', msg)
    return { ok: true }
  }
}
