# T-408 — Redis/Upstash rate-limit (cross-instance consistency)

> **Phase 5 · Status:** review · **Owner:** claude-sonnet-4-6 executor · **Dispatch:** 2026-04-20
> **Base:** `main` (current tip `f1da090`) · **Expected PR diff:** 8 files (1 lib rewrite + 2 API callers + package.json + .env.example + blueprint + task md + AGENT_LOG)

---

## Context

`vibeseek/lib/rate-limit.ts` hiện dùng in-memory `Map<string, Bucket>` — code comment Phase 3 T-304 đã flag tech debt: *"In-memory = per serverless instance. On Vercel with cold starts / multiple regions this is lenient. Acceptable for MVP anti-spam, not for hard quota. Phase 4: upgrade to Redis/Upstash for consistent cross-instance rate limiting."*

Phase 5 T-406 Vercel deploy (deferred — Kien118 GitHub App permission blocker) sẽ spawn nhiều serverless instance → in-memory buckets reset mỗi cold-start → user spam-click có thể bypass limit với mỗi instance fresh. T-408 unblock path cho T-406 ship production.

Khoá hôm nay sau T-407 chat_messages persist: 2 rate-limit sites — `/api/chat` (POST, `chat:${anonId}` 10/60s default) + `/api/chat/history` (GET, `chat-history:${anonId}` 30/60s). Khi user hydrate mount → GET /chat/history ngay, không tranh budget của POST. Pattern đã verified Test 7 (T-407 post-merge).

User approved 5 design calls (2026-04-20):

| ID | Decision | Why |
|---|---|---|
| Q1 | **Sync → async `consume()`** — breaking change, 2 callers bắt buộc `await consume(...)` | Upstash là HTTP call, wrap fake-sync = illusion + vẫn không cross-instance |
| Q2 | **Fixed window** (match current semantic) | Drop-in replace, minimum code change; sliding upgrade nếu user complain spam abuse sau |
| Q3 | **Fail-open** on Upstash unreachable | Rate-limit là anti-spam, không phải security; outage = UX degrade chứ không break |
| Q4 | **`@upstash/redis` SDK** (~8KB, official, type-safe) | Vs raw fetch — minor dep cost đổi readable + typed |
| Q5 | **`@upstash/ratelimit` helper** (~4KB, fixedWindow algorithm built-in) | Battle-tested, zero race, single API call vs manual INCR/EXPIRE |

---

## Files to touch (8)

1. `vibeseek/package.json` — ADD `@upstash/redis` + `@upstash/ratelimit` to `dependencies`
2. `vibeseek/lib/rate-limit.ts` — **REWRITE** (29 LOC → ~60 LOC): replace in-memory Map with Upstash client + Ratelimit helper; preserve `consume(key, limit?, windowMs?)` signature shape nhưng return `Promise<>` thay vì sync
3. `vibeseek/app/api/chat/route.ts` — **MODIFY 1 line**: `const rl = consume(...)` → `const rl = await consume(...)`
4. `vibeseek/app/api/chat/history/route.ts` — **MODIFY 1 line**: same await injection
5. `vibeseek/.env.local.example` — APPEND 2 vars: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
6. `ARCHITECT_BLUEPRINT.md` — §3 stack table (add Upstash row under "Rate limit"), §13 changelog prepend, §6.6/§6.6b note "rate-limit consistent cross-instance"
7. `tasks/T-408-redis-rate-limit.md` — this file
8. `AGENT_LOG.md` — entries

Final PR diff: ~8 files, ~100 LOC added, ~25 LOC removed.

---

## Files NOT to touch (protected regions)

### Phase 4 video invariants (grep sentinels, MUST return 0 lines):
- `vibeseek/scripts/render/render.mjs` — `PlayResX|splitNarrationLines|formatAssTime|speakable_narration|gradients=|\\fad`
- `vibeseek/lib/ai/processor.ts` — `OVERFLOW_RATIO|WORDS_PER_SECOND`
- `vibeseek/lib/ai/prompts.ts` — `NGÂN SÁCH TỪ|PHIÊN ÂM CHO TTS`

### T-407 chat_messages invariants:
- `vibeseek/app/api/chat/route.ts` — only L85 `consume(...)` call gets `await` prefix; enforceCap + assistantText + save blocks UNTOUCHED
- `vibeseek/app/api/chat/history/route.ts` — only L29 `consume(...)` call gets `await` prefix; rest UNTOUCHED
- `vibeseek/supabase-schema.sql` — ZERO touches
- `vibeseek/components/ChatPanel.tsx` — ZERO touches
- `vibeseek/utils/*` + `vibeseek/lib/ai/*` — ZERO touches

### Other protected:
- All `app/api/**` routes NOT chat (`/quiz`, `/leaderboard`, `/vibefy`, `/vibefy-video`, `/render-callback`, `/embeddings`, `/profile`) — không dùng rate-limit hiện tại, T-408 không add
- `vibeseek/components/*` (all), `app/**/page.tsx` (all)

Scope fence grep pre-merge:
```bash
git diff main -- vibeseek/scripts/ vibeseek/lib/ai/ vibeseek/supabase-schema.sql vibeseek/components/ vibeseek/utils/ vibeseek/app/api/embeddings vibeseek/app/api/leaderboard vibeseek/app/api/profile vibeseek/app/api/quiz vibeseek/app/api/render-callback vibeseek/app/api/vibefy vibeseek/app/api/vibefy-video vibeseek/app/dashboard vibeseek/app/chat vibeseek/app/leaderboard vibeseek/app/quiz
# Expect: 0 lines
```

---

## Architect spec

### §1. Package deps — `vibeseek/package.json`

Add 2 deps to `dependencies` (not devDeps — runtime needed):
```json
    "@upstash/ratelimit": "^2.0.0",
    "@upstash/redis": "^1.34.0",
```

Version strategy: `^2.0.0` / `^1.34.0` = current stable majors at 2026-04-20. Executor verify via `npm install` — if minor upgrade available, accept.

Install command (executor runs — do NOT run `npm install` if user dev server active; prefer `npm install --no-audit --no-fund` to keep log clean):
```bash
cd vibeseek && npm install --save @upstash/redis @upstash/ratelimit
```

### §2. Rewrite — `vibeseek/lib/rate-limit.ts`

Full replacement (NOT append — current in-memory `buckets` Map + `consume()` sync all go):

```typescript
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
```

Key design notes:
- **`prefix: 'vibeseek:rl'`** — namespace keys → no collision with future Upstash usage (e.g. if we add caching later). Actual Redis key = `vibeseek:rl:{limit}-{windowMs}:{userKey}` (prefix format per @upstash/ratelimit docs).
- **`analytics: false`** — Upstash Ratelimit offers analytics dashboard but costs 1 extra Redis op per request. MVP không cần analytics (có chat_messages table từ T-407 nếu muốn track). Turn on Phase 6+ nếu cần.
- **Cached limiter instances** (Map `${limit}:${windowMs}`) — hiện có 2 combos (10/60s + 30/60s), cache tối đa 2 entries. Future callers với combo mới sẽ expand naturally.
- **`reset` (unix ms)** → convert to `retryAfterMs` = max(0, reset − now). Math.max guards negative (reset đã pass).

### §3. Caller update — `vibeseek/app/api/chat/route.ts` (1 line diff)

```typescript
// Line ~85, inside POST function, BEFORE:
const rl = consume(`chat:${anonId}`)

// AFTER:
const rl = await consume(`chat:${anonId}`)
```

Everything else in file UNTOUCHED. (T-407 enforceCap / assistantText / save blocks all preserved.)

### §4. Caller update — `vibeseek/app/api/chat/history/route.ts` (1 line diff)

```typescript
// Line ~29, inside GET function, BEFORE:
const rl = consume(`chat-history:${anonId}`, HISTORY_RATE_LIMIT, HISTORY_RATE_WINDOW_MS)

// AFTER:
const rl = await consume(`chat-history:${anonId}`, HISTORY_RATE_LIMIT, HISTORY_RATE_WINDOW_MS)
```

### §5. `.env.local.example` — append 2 vars

```env

# ===================================
# Upstash Redis (Phase 5 T-408 rate-limit)
# Free tier: 10k commands/day + 256MB storage
# Create DB at https://console.upstash.com/ → Region ap-southeast-1 (Singapore)
# Paste REST URL + Token from the "REST API" tab
# ===================================
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

### §6. Blueprint updates — `ARCHITECT_BLUEPRINT.md`

1. **§3 Stack table** — find the "Rate limit" row (nếu có) hoặc "Infrastructure" block, add line:
   ```
   | Rate limit | Upstash Redis (REST) + @upstash/ratelimit | Cross-instance fixed-window 10/60s chat + 30/60s history |
   ```
   Nếu chưa có row, add vào infrastructure section với same format.

2. **§13 Changelog** — prepend:
   ```
   ### 2026-04-20 — T-408 Redis rate-limit (Phase 5)
   - Replaced in-memory `Map` in `lib/rate-limit.ts` with Upstash `@upstash/ratelimit` fixed-window.
   - `consume()` now async — 2 caller sites updated (`/api/chat`, `/api/chat/history`).
   - Fail-open on Upstash unreachable (anti-spam, not security).
   - Unblocks T-406 Vercel deploy (cross-instance consistency).
   ```

3. **§6.6** (if exists as chat endpoint doc) or §6.7 — add note: *"Rate limit is Upstash-backed as of T-408 — consistent across serverless instances on Vercel."*

### §7. Task md + AGENT_LOG

- `tasks/T-408-redis-rate-limit.md` Status: draft → in-progress on start → review on PR open
- Decisions log D-1..D-N entries
- AGENT_LOG append under `## 2026-04-20`: `started` + `completed` events, format matches last 40 lines

---

## Acceptance criteria

| AC | Description | Verify by |
|---|---|---|
| AC-1 | `@upstash/redis` + `@upstash/ratelimit` added to `dependencies` (not devDeps) | `git diff package.json` |
| AC-2 | `lib/rate-limit.ts` fully replaced: no `buckets` Map, no sync `consume` | Code review |
| AC-3 | `consume()` signature: `async (key, limit=10, windowMs=60_000) => Promise<{ok}|{ok, retryAfterMs}>` | Code review + tsc |
| AC-4 | Lazy singleton `Redis` client + cached `Ratelimit` instances by `(limit, windowMs)` | Code review |
| AC-5 | `prefix: 'vibeseek:rl'` namespace set on every Ratelimit ctor | Code review |
| AC-6 | `app/api/chat/route.ts` adds `await` on `consume()` call — exactly 1 line diff | `git diff` |
| AC-7 | `app/api/chat/history/route.ts` adds `await` on `consume()` call — exactly 1 line diff | `git diff` |
| AC-8 | `.env.local.example` appends 2 Upstash vars with template URLs | `git diff` |
| AC-9 | Blueprint §3 + §13 updated per spec §6 | Code review |
| AC-10 | `npx tsc --noEmit` exit 0 | Architect review |
| AC-11 | Protected-region grep returns 0 lines (Phase 4 + T-407 sentinels) | Architect review |
| AC-12 | **Happy path:** 11 POST `/api/chat` burst with fixed anonId → 10×200 + 1×429 post-migrate | Architect curl |
| AC-13 | **Isolation:** 31 GET `/api/chat/history` burst with same anonId → 30×200 + 1×429; POST `/api/chat` with same anonId → still 200 (separate bucket) | Architect curl |
| AC-14 | **Cross-process:** kill dev server mid-window + restart + continue with same anonId → still rate-limited (vs in-memory which would reset) | Architect manual |
| AC-15 | **Fail-open:** temp set `UPSTASH_REDIS_REST_URL=https://invalid.upstash.io` → curl `/api/chat` → 200 (fail-open) + warn log visible | Architect manual |
| AC-16 | **Upstash dashboard:** keys `vibeseek:rl:*` appear during testing, TTL = ~60s | Architect check Upstash console |

---

## Failure modes (12)

| # | Mode | Defense |
|---|---|---|
| 1 | `UPSTASH_REDIS_REST_URL`/`TOKEN` missing in env | `getRedis()` returns null → caller fail-opens + warn log; app works degraded (Q3 decision) |
| 2 | Upstash HTTP 5xx or network error | `try/catch` around `limiter.limit()` → fail-open + warn log (Q3) |
| 3 | Clock skew between Vercel instances | Upstash's `reset` is server-generated Unix timestamp; `Date.now() - reset` on client side may occasionally be slightly off but fixed-window bucket bound is Redis-side anchored — no real race |
| 4 | Key collision with future Redis usage | `prefix: 'vibeseek:rl'` namespace all ratelimit keys |
| 5 | Free tier 10k commands/day exhaust | MVP <5 users → ~1k commands/day, comfortable margin. If exceed: fail-open (still works, no limit) + warn log surfaces in dev console. Operational concern, not code bug. |
| 6 | Async `consume()` adds ~50-150ms network latency to every rate-limited request | Acceptable: chat POST is SSE stream (users don't notice ~100ms before first token); history GET is background hydrate (not UI-blocking). ap-southeast-1 region gives ~30-50ms from VN. |
| 7 | Sync-to-async breaking change breaks existing test/caller | Only 2 callers, both updated atomically in same PR; tsc catches any missed await as "Promise<...> is not assignable to {ok: boolean; ...}" |
| 8 | Cold-start latency on Vercel (first request from fresh instance) | First Upstash call ~200ms; subsequent ~50ms. Matches Supabase cold-start profile; SSE POST is already 500ms+ baseline (PDF text retrieval) so 200ms extra is lost in noise. |
| 9 | `@upstash/ratelimit` returns `success/limit/remaining/reset` shape; mapping to existing `{ok, retryAfterMs}` API | Spec §2 does explicit destructure + `retryAfterMs = max(0, reset - Date.now())` |
| 10 | Concurrent requests from same anonId racing for last token | `fixedWindow` is atomic at Redis layer (INCR + EXPIRE in single Lua eval); no race, exact limit enforced |
| 11 | Test hygiene: E2E burst test on same literal anonId may span bucket boundary → off-by-one | Phase 3 F-12 lesson: use literal fixed key + wait 60s between re-runs. Spec §Test plan documents this. |
| 12 | npm install `@upstash/*` fails on Windows (filepath, node-gyp, etc.) | Both packages are pure JS (no native bindings); should install clean. If fails: architect falls back to raw fetch REST implementation. |

---

## Local test plan (architect-runnable post-dispatch)

> Prereqs: Upstash DB created (Singapore), credentials in `.env.local`, dev server restarted (`cd vibeseek && npm run dev`) AFTER executor installs deps + applies code.

### Test 1 — tsc clean
```bash
cd vibeseek && npx tsc --noEmit
```
Exit 0 expected.

### Test 2 — Protected-region + sentinel grep
```bash
git diff main -- vibeseek/scripts/ vibeseek/lib/ai/ vibeseek/supabase-schema.sql vibeseek/components/ vibeseek/utils/ | wc -l
# Expect: 0

git diff main -- vibeseek/ | grep -E "PlayResX|splitNarrationLines|formatAssTime|speakable_narration|gradients=|\\\\fad|OVERFLOW_RATIO|WORDS_PER_SECOND|NGÂN SÁCH TỪ|PHIÊN ÂM CHO TTS|supabaseAdmin|chat_messages|CHAT_HISTORY_CAP|enforceCap|hasInteractedRef" | wc -l
# Expect: 0 (T-408 doesn't touch those regions)
```

### Test 3 — Happy path POST rate enforce
Fixed literal anonId per Phase 3 F-12 lesson. Wait 60s after any prior test.
```bash
DOC="d79cda98-1741-439e-8a62-8cbfced37b8d"  # same TTHCM doc as T-407
ANON="t408-rate-test-fixed-11111"
for i in {1..11}; do
  curl.exe -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"documentId\":\"$DOC\",\"message\":\"x\",\"history\":[],\"anonId\":\"$ANON\"}"
done | sort | uniq -c
```
Expected: `10 200` + `1 429` (or actually SSE 200 + 1 JSON 429 — uniq will reflect).

### Test 4 — Isolation (separate bucket)
```bash
ANON2="t408-history-only-22222"
for i in {1..31}; do
  curl.exe -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/chat/history?documentId=$DOC&anonId=$ANON2"
done | sort | uniq -c
# Expect: 30 200 + 1 429
```

Same anonId on POST still works (separate bucket key prefix `chat:` vs `chat-history:`):
```bash
curl.exe -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC\",\"message\":\"x\",\"history\":[],\"anonId\":\"$ANON2\"}"
# Expect: 200
```

### Test 5 — Cross-process consistency (the actual win)
Demonstrates Upstash ≠ in-memory:
1. Send 9 POST with `t408-cross-process-33333` → 9×200
2. **Kill dev server:** Ctrl+C in dev terminal (or `taskkill //F //IM node.exe` in another Git Bash)
3. Restart: `cd vibeseek && npm run dev`
4. Wait ~5s for Next.js ready
5. Send 2 more POST with SAME anonId → **1×200 + 1×429** (vs pre-T-408 which would be 2×200 because in-memory reset)

### Test 6 — Fail-open on Upstash unreachable
Edit `.env.local` temp:
```
UPSTASH_REDIS_REST_URL=https://definitely-not-a-real-db.upstash.io
```
Restart dev server. Send 15 POST burst with fresh anonId. Expected: all 15×200 (fail-open). `npm run dev` console should show `[rate-limit] Upstash error, fail-open: ...` warn per request.

Revert env var + restart dev server.

### Test 7 — Upstash console visual verify
Open https://console.upstash.com/ → DB → Data Browser tab. Filter keys by prefix `vibeseek:rl:`. Expected: see entries created during Tests 3-5, TTL ~60s countdown.

---

## Non-goals

- **Sliding window algorithm** — blueprint fixed window is intentional (Q2); sliding upgrade reserved for if user complains about boundary abuse.
- **Per-endpoint analytics** — `analytics: false` in Ratelimit ctor. Analytics deferred Phase 6+ (chat_messages already captures usage).
- **Multi-region Redis replication** — single-region ap-southeast-1 OK. VN user base.
- **Token bucket** — fixed window match current semantics. Token bucket = different UX (burst-friendly).
- **Rate-limit expansion to other endpoints** — `/api/vibefy`, `/api/quiz/generate` don't have rate-limit today; T-408 scope = existing 2 callers only. Additional endpoints = separate task.
- **Redis caching** (e.g. for embeddings or chat history) — orthogonal, Phase 6+.

---

## Decisions log (executor fills during implementation)

- D-1: Used `@upstash/ratelimit ^2.0.8` (resolved from `^2.0.0` spec floor) — latest stable minor, no breaking changes, accepted per spec "if minor upgrade available, accept".
- D-2: Used `@upstash/redis ^1.37.0` (resolved from `^1.34.0` spec floor) — same rationale, pure JS no native bindings, installed clean on Windows.
- D-3: `toDuration` helper typed as `` `${number} ms` `` template literal to satisfy `@upstash/ratelimit` `Duration` type without casting — avoids `@ts-ignore` per hard constraints.
- D-4: Lazy singleton `redisClient` is module-level (survives across requests in same instance), `limiters` Map also module-level — two entries max (10/60s + 30/60s), naturally bounded.
- D-5: Blueprint §6.6b (`POST /api/embeddings/ensure`) rate-limit note added to §6.7 (`POST /api/chat`) per spec §6 "§6.6/§6.6b note" instruction — both sections reference the same T-408 rate-limit upgrade; note placed at §6.7 as that is the directly rate-limited endpoint.

---

## Dependencies

- Upstash DB created + credentials pasted in `.env.local` (user-runnable, architect guided in session)
- `.env.local` already has Supabase + Gemini vars from prior phases
- Dev server will be restarted by user OR by architect for Test 5 (cross-process verify)

## DoD

- [ ] All 16 AC pass (AC-14/15/16 architect manual verify)
- [ ] 12 failure modes each have code-level defense
- [ ] Protected-region grep + sentinel grep return 0 lines
- [ ] `npx tsc --noEmit` exit 0
- [ ] No `npm run build` run (dev-server active)
- [ ] No smoke files committed
- [ ] PR opened with title `T-408: Redis rate-limit via Upstash (cross-instance consistency)`
- [ ] Unblock signal for T-406 Vercel deploy documented in close-commit
