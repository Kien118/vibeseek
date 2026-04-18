interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * Check + consume rate limit. Returns { ok: true } or { ok: false, retryAfterMs }.
 * Default: 10 requests / 60 seconds per key.
 *
 * NOTE: In-memory = per serverless instance. On Vercel with cold starts / multiple
 * regions this is lenient. Acceptable for MVP anti-spam, not for hard quota.
 * Phase 4: upgrade to Redis/Upstash for consistent cross-instance rate limiting.
 */
export function consume(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now }
  }
  b.count += 1
  return { ok: true }
}
