# T-304 · `POST /api/chat` — Server-Sent Events streaming route

**Status:** `done`
**Severity:** HIGH
**Blueprint ref:** §2.5 chat flow, §6.7 API contract, §12 Q-08/Q-09
**Branch:** `task/T-304-chat-sse-api-route`
**Assignee:** _(TBD)_
**Depends on:** T-302 (embeddings ensure endpoint), T-303 (chat lib). **BLOCKED until both merged.**

## Context

API route SSE streaming. Thin wrapper quanh `retrieveContext + streamChatResponse` của T-303, wrap vào `ReadableStream` theo SSE protocol. Phải khớp đúng `runtime = 'nodejs'`, `maxDuration = 60` (Q-08), error events format, và rate-limit (chống spam).

**Architect audit 2026-04-18 áp dụng:**
- `supabaseAdmin` import từ `@/utils/supabase`.
- Backpressure guard: `controller.desiredSize === null` → client cancelled → abort generator + return (tránh leak generator).

**Key SSE gotchas:**
- Mỗi event `data: <json>\n\n` — hai newline bắt buộc.
- Header `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (tắt proxy buffering).
- Gemini SDK chạy trên Edge sẽ fail (import Node core) → **`runtime = 'nodejs'` bắt buộc**.
- Next.js 14 App Router `Response` trả `ReadableStream` hoạt động tốt trên Node runtime — không cần `experimental-edge`.

## Files to touch
- `vibeseek/app/api/chat/route.ts` (NEW) — SSE route
- `vibeseek/lib/rate-limit.ts` (NEW) — minimal in-memory rate limiter per anon_id
- `tasks/T-304-chat-sse-api-route.md` (status)
- `AGENT_LOG.md`

## Files NOT to touch
- `vibeseek/lib/ai/chat.ts` / `embeddings.ts` — T-302/T-303 scope (import only)
- `vibeseek/app/api/embeddings/**` — T-302 scope
- UI — T-305 scope
- `supabase-schema.sql` — T-301/T-303 scope

## Architect's spec

### 1. `vibeseek/lib/rate-limit.ts` (simple in-memory, per-instance)

```ts
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * Check + consume rate limit. Returns { ok: true } or { ok: false, retryAfterMs }.
 * Default: 10 requests / 60 seconds per key.
 *
 * NOTE: In-memory = per serverless instance. On Vercel with cold starts / multiple
 * regions this is lenient. Acceptable for MVP anti-spam, not for hard quota.
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
```

### 2. `vibeseek/app/api/chat/route.ts`

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase' // architect audit 2026-04-18 — verified
import { retrieveContext, streamChatResponse, type ChatMessage } from '@/lib/ai/chat'
import { consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatReqBody {
  documentId?: string
  message?: string
  history?: ChatMessage[]
  anonId?: string
}

function sseEvent(payload: unknown): Uint8Array {
  const text = `data: ${JSON.stringify(payload)}\n\n`
  return new TextEncoder().encode(text)
}

function jsonError(status: number, code: string, detail?: string) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  let body: ChatReqBody
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'invalid_json')
  }

  const { documentId, message, history = [], anonId } = body

  if (!documentId || typeof documentId !== 'string') {
    return jsonError(400, 'documentId_required')
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return jsonError(400, 'message_required')
  }
  if (message.length > 2000) {
    return jsonError(400, 'message_too_long', 'max 2000 chars')
  }
  if (!anonId || typeof anonId !== 'string') {
    return jsonError(400, 'anonId_required')
  }
  if (!Array.isArray(history)) {
    return jsonError(400, 'history_must_be_array')
  }

  // Rate limit per anonId
  const rl = consume(`chat:${anonId}`)
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retryAfterMs: rl.retryAfterMs }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    )
  }

  // Ensure document exists + has embeddings before we open stream
  const { count: embCount, error: embErr } = await supabaseAdmin
    .from('card_embeddings')
    .select('card_id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (embErr) return jsonError(500, 'db_error', embErr.message)
  if (!embCount || embCount === 0) return jsonError(404, 'no_embeddings', 'run /api/embeddings/ensure first')

  // Retrieve context BEFORE opening stream so retrieve errors map to HTTP codes
  let ctx
  try {
    ctx = await retrieveContext(documentId, message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'document_not_found') return jsonError(404, 'document_not_found')
    if (msg === 'no_embeddings') return jsonError(404, 'no_embeddings')
    console.error('[chat] retrieve failed', err)
    return jsonError(503, 'retrieval_unavailable', msg)
  }

  // Open SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const gen = streamChatResponse(ctx, history, message)
        let tokensUsed = 0
        while (true) {
          const { value, done } = await gen.next()
          if (done) {
            tokensUsed = (value && 'tokensUsed' in value) ? value.tokensUsed : 0
            break
          }
          // Backpressure / disconnect guard: client may have closed reader.
          // `desiredSize === null` means the stream has been cancelled.
          if (controller.desiredSize === null) {
            await gen.return?.(undefined as never)
            return
          }
          controller.enqueue(sseEvent({ delta: value.delta }))
        }
        controller.enqueue(sseEvent({ done: true, tokensUsed }))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[chat] stream failed', err)
        try {
          controller.enqueue(sseEvent({ error: msg, done: true }))
        } catch {}
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

## Acceptance criteria

- [ ] **AC-1:** `vibeseek/app/api/chat/route.ts` exists, exports `POST`, có `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` + `maxDuration = 60`.
- [ ] **AC-2:** `vibeseek/lib/rate-limit.ts` exists, exports `consume(key, limit?, windowMs?)`.
- [ ] **AC-3:** `cd vibeseek && npx tsc --noEmit` pass.
- [ ] **AC-4:** `cd vibeseek && npm run build` pass (Next.js statically pickup `/api/chat` route).
- [ ] **AC-5 (User-runnable):** Dev server + curl happy path — xem Local test plan Test 2.
- [ ] **AC-6:** Input validation — 5 error cases trả 400 đúng shape (missing documentId, missing message, empty message, message >2000, missing anonId).
- [ ] **AC-7:** Rate limit — request thứ 11 trong 60s → 429 `rate_limited`.
- [ ] **AC-8:** 404 `no_embeddings` khi document chưa embed.
- [ ] **AC-9:** SSE protocol — response header đúng (`text/event-stream`), body chứa `data: {...}\n\n` blocks, event cuối `{"done":true,"tokensUsed":N}`.

## Definition of Done
- [ ] All AC pass (AC-5..9 verify bằng curl trên dev server)
- [ ] AGENT_LOG.md start + done
- [ ] Task status → `review`
- [ ] PR opened
- [ ] Không để lại test script không dùng

## Failure modes (defensive checklist)

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Agent dùng Edge runtime → Gemini SDK crash import | Spec hardcode `runtime = 'nodejs'`. Review grep. |
| F-2 | Client timeout vì Vercel >60s | `maxDuration = 60`. Prompt bên T-303 đã giới hạn 250 words → response <30s thường. |
| F-3 | SSE event thiếu `\n\n` → client parser gom chunks sai | `sseEvent()` helper đảm bảo format. |
| F-4 | Error giữa stream → controller throw → 500 HTML body phá SSE contract | Wrap try/catch trong `start`, emit `data: {"error":...,"done":true}` + close. Status ban đầu đã 200 → không rollback được. Client handle error trong payload. |
| F-5 | Stream rò memory nếu client disconnect giữa chừng | `ReadableStream.cancel` sẽ được gọi bởi Next; generator `streamChatResponse` tự stop khi `controller.enqueue` fail? Actually không — cần kiểm tra `controller.desiredSize === null` trước enqueue. **Agent thêm check:** `if (controller.desiredSize === null) { break }` trong loop. |
| F-6 | Rate limiter reset với cold start → user spam được | Acceptable MVP (comment đã ghi). Phase 4 move to Redis/Upstash. |
| F-7 | Rate limiter map leak | `buckets` Map không prune entry cũ. Số anon_id hữu hạn (~trăm) trong dev → OK. Phase 4 add LRU. |
| F-8 | `history` chứa role lạ hoặc content là number → lib throw | T-303 `buildUserPrompt` dùng `m.role === 'user' ? 'User' : 'DOJO'` → invalid role fallback 'DOJO'. Content coerce string. Defensive enough. |
| F-9 | `message` chỉ whitespace → embed fail | Validate `message.trim().length === 0` → 400. |
| F-10 | Document không có raw_text (col chưa tồn tại trong schema cũ) | T-303 đã `doc.raw_text ?? ''`. OK. |
| F-11 | `supabase-admin` import path sai | Agent grep trước khi import. |
| F-12 | `count: 'exact', head: true` trả về số chính xác? | Supabase-js doc confirm có. Nếu câu này dùng sai, chỉnh sang fetch + count length. |
| F-13 | Server emit `data: ` quá nhanh → Next.js buffer chưa flush → user thấy chậm | `X-Accel-Buffering: no` header tắt proxy buffer. Dev server Node flush ngay. |
| F-14 | Test 2 fail trên Windows curl alias | User biết rule: `curl.exe` hoặc PowerShell `Invoke-WebRequest -UseBasicParsing`. Spec test plan dùng `curl.exe`. |

## Local test plan (15 phút)

### Test 1 — tsc + build
```bash
cd vibeseek
npx tsc --noEmit
npm run build
```
Expected: both pass; build log hiện `ƒ /api/chat` (dynamic route).

### Test 2 — Happy path stream
Prereq: `/api/embeddings/ensure` đã chạy cho `<docId>` (T-302 Test 3).

Windows bash:
```bash
cd vibeseek && npm run dev
# (new terminal)
curl.exe -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<UUID>","message":"Tóm tắt tài liệu này giúp tôi","history":[],"anonId":"test-anon-001"}'
```
Expected output (streaming):
```
data: {"delta":"Tóm tắt "}

data: {"delta":"ngắn gọn..."}

...

data: {"done":true,"tokensUsed":XYZ}

```
Verify progressive — text đến theo đợt, không dump 1 phát cuối.

### Test 3 — Invalid input
```bash
curl.exe -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" -d '{}'
# Expected: 400 {"error":"documentId_required"}

curl.exe -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<UUID>","message":"","anonId":"x"}'
# Expected: 400 {"error":"message_required"}

curl.exe -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<UUID>","message":"test","anonId":null}'
# Expected: 400 {"error":"anonId_required"}
```

### Test 4 — Rate limit
Bash loop 12 lần:
```bash
for i in {1..12}; do
  curl.exe -s -o /dev/null -w "req $i: %{http_code}\n" \
    -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"documentId":"<UUID>","message":"hi","anonId":"rl-test"}'
done
```
Expected: req 1–10 → 200, req 11–12 → 429.

### Test 5 — No embeddings
Dùng `<UUID>` có cards nhưng không embeddings (xoá sạch: `DELETE FROM card_embeddings WHERE document_id = '<UUID>';` trên Dashboard).
```bash
curl.exe -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<UUID>","message":"hi","anonId":"test"}'
```
Expected: 404 `{"error":"no_embeddings","detail":"run /api/embeddings/ensure first"}`.

### Test 6 — Error mid-stream (Force Groq fallback path)
Set `DEBUG_FORCE_GEMINI_FAIL=true` + `DEBUG_FORCE_CHAT_GEMINI_FAIL=true` (từ T-303 extra flag). Restart. Run Test 2 curl.
Expected: response vẫn 200 + streams Groq chunks (40-char-spaced).

Nếu embed fail (chat không retrieve được): 503 `retrieval_unavailable` — đó cũng là failure mode valid.

## Non-goals (KHÔNG làm)
- KHÔNG modify `lib/ai/chat.ts` hoặc `embeddings.ts` (import only).
- KHÔNG persist chat vào DB — Q-09 chốt client-only.
- KHÔNG UI — T-305.
- KHÔNG dùng Redis / Upstash — in-memory rate limit OK cho MVP.
- KHÔNG thêm auth / anon_id validation ngoài "exists + string" — anon_id là public identifier, không bí mật.

## Questions / Blockers
_(none)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- **Phase 2 lessons preempt:** explicit Node runtime (F-1 = quiz/vibefy đã quên), SSE error-as-event không HTTP 500 (F-4), rate limit không blanket 429-only retriable (F-rate quiz), validation trước khi open stream (fail fast).
- **Review MUST curl test 2 + 3 + 4** — quyết định chất lượng review chặt.
- Đếm SSE `\n\n` trong raw response — dùng `curl -N -v` thấy raw bytes.
- Agent red flags: dùng `export const runtime = 'edge'`, persist message vào DB, stream qua `Response.body = ...` dạng Blob (không phải ReadableStream).
