# T-302 · `lib/ai/embeddings.ts` + `POST /api/embeddings/ensure`

**Status:** `done`
**Severity:** HIGH (foundation cho RAG retrieval)
**Blueprint ref:** §2.5 RAG flow, §6.6b API contract, §12 Q-06
**Branch:** `task/T-302-embeddings-lib-and-ensure-endpoint`
**Assignee:** _(TBD — Claude Opus / Sonnet executor)_
**Depends on:** T-301 (DDL apply + schema sync merged)

## Context

Sinh embedding cho Vibe Cards bằng Gemini `text-embedding-004` (768-dim, free 1500 req/day). **Lazy + idempotent** (Q-06): không fire-and-forget trong `/api/vibefy` — Vercel kill promise. Client mở `/chat/[documentId]` sẽ gọi `/api/embeddings/ensure` trước khi cho chat.

**Architect audit 2026-04-18 áp dụng:**
- `supabaseAdmin` import từ `@/utils/supabase` (confirmed — file có no-store fetch wrapper sẵn).
- `@google/genai@1.50.0` accepts `contents: string[]` trực tiếp, không cần `{ parts: [{ text }] }` wrapper.

**Critical lesson from Phase 2:** mọi Gemini-calling function phải có fallback hoặc clear error handling. Groq chưa có embedding API free → **không fallback embedding** → endpoint trả 503 rõ ràng khi Gemini fail, UI phải xử lý.

## Files to touch
- `vibeseek/lib/ai/embeddings.ts` (NEW) — core embed function, batching, retry
- `vibeseek/app/api/embeddings/ensure/route.ts` (NEW) — idempotent ensure endpoint
- `tasks/T-302-embeddings-lib-and-ensure-endpoint.md` (status updates)
- `AGENT_LOG.md` (start + done)

## Files NOT to touch
- `vibeseek/app/api/vibefy/route.ts` — KHÔNG add trigger embedding vào đây (lazy pattern)
- `vibeseek/app/api/chat/**` — T-304 scope
- `vibeseek/lib/ai/chat.ts` — T-303 scope
- Any UI file — T-305 scope
- `vibeseek/supabase-schema.sql` — T-301 scope
- `vibeseek/lib/ai/prompts.ts`, `processor.ts`, `quiz.ts` — không liên quan

## Architect's spec

### 1. `vibeseek/lib/ai/embeddings.ts`

```ts
import { GoogleGenAI } from '@google/genai'

const EMBED_MODEL = 'text-embedding-004'
const EMBED_DIM = 768
const BATCH_SIZE = 100 // Gemini embedContent API limit per request

const forceFailGemini = () => process.env.DEBUG_FORCE_GEMINI_FAIL === 'true'

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isRetriableEmbedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  return (
    message.includes('429') ||
    message.includes('500') ||
    message.includes('503') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('deadline')
  )
}

/**
 * Embed a batch of text inputs. Returns an array of 768-dim vectors in same order.
 * Retries up to 2 times on retriable errors with exponential backoff.
 * Throws if still failing — caller (API route) maps to 503 for UI.
 */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return []
  if (forceFailGemini()) {
    throw new Error('DEBUG_FORCE_GEMINI_FAIL active — simulating Gemini outage')
  }

  const genAI = getGenAI()
  const results: number[][] = []

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const batch = inputs.slice(start, start + BATCH_SIZE)
    let lastErr: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await genAI.models.embedContent({
          model: EMBED_MODEL,
          contents: batch, // @google/genai accepts string[] directly
        })
        const embeds = response.embeddings
        if (!embeds || embeds.length !== batch.length) {
          throw new Error(
            `Embedding count mismatch: expected ${batch.length}, got ${embeds?.length ?? 0}`
          )
        }
        for (const item of embeds) {
          const values = item.values
          if (!values || values.length !== EMBED_DIM) {
            throw new Error(
              `Embedding dim mismatch: expected ${EMBED_DIM}, got ${values?.length ?? 0}`
            )
          }
          results.push(values)
        }
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        if (!isRetriableEmbedError(err) || attempt === 2) {
          throw err
        }
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    if (lastErr) throw lastErr
  }

  return results
}

export const EMBEDDING_DIM = EMBED_DIM
```

### 2. `vibeseek/app/api/embeddings/ensure/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { embedTexts } from '@/lib/ai/embeddings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const documentId = body.documentId
  if (!documentId || typeof documentId !== 'string') {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  // Fetch cards for this document
  const { data: cards, error: cardsErr } = await supabaseAdmin
    .from('vibe_cards')
    .select('id, title, content')
    .eq('document_id', documentId)
    .order('order_index', { ascending: true })

  if (cardsErr) {
    console.error('[ensure] cards query error', cardsErr)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  if (!cards || cards.length === 0) {
    return NextResponse.json({ error: 'no_cards_for_document' }, { status: 404 })
  }

  // Check which cards already have embeddings
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('card_embeddings')
    .select('card_id')
    .eq('document_id', documentId)

  if (existErr) {
    console.error('[ensure] existing query error', existErr)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const existingIds = new Set((existing ?? []).map(r => r.card_id))
  const missing = cards.filter(c => !existingIds.has(c.id))

  if (missing.length === 0) {
    return NextResponse.json({ ready: true, count: cards.length, generated: 0 })
  }

  // Generate embeddings for missing cards
  const texts = missing.map(c => `${c.title}\n${c.content}`)
  let vectors: number[][]
  try {
    vectors = await embedTexts(texts)
  } catch (err) {
    console.error('[ensure] embed failed', err)
    return NextResponse.json(
      { error: 'embedding_unavailable', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }

  // Insert — pgvector accepts array-as-JSON via supabase-js when column type is vector.
  // Use "upsert onConflict: card_id ignoreDuplicates" in case of race.
  const rows = missing.map((card, idx) => ({
    card_id: card.id,
    document_id: documentId,
    embedding: vectors[idx] as unknown as string, // supabase-js serializes as JSON, postgres casts to vector
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('card_embeddings')
    .upsert(rows, { onConflict: 'card_id', ignoreDuplicates: true })

  if (insertErr) {
    console.error('[ensure] insert failed', insertErr)
    return NextResponse.json({ error: 'db_insert_error', detail: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ready: true,
    count: cards.length,
    generated: missing.length,
  })
}
```

**Import path verified (architect audit 2026-04-18):** `supabaseAdmin` xuất từ `vibeseek/utils/supabase.ts`. Dùng đúng `import { supabaseAdmin } from '@/utils/supabase'`. File đã có `no-store fetch` wrapper từ Phase 2 hotfix — không cần chỉnh.

## Acceptance criteria

- [ ] **AC-1:** `vibeseek/lib/ai/embeddings.ts` exports `embedTexts(inputs: string[]): Promise<number[][]>` + const `EMBEDDING_DIM = 768`.
- [ ] **AC-2:** `vibeseek/app/api/embeddings/ensure/route.ts` exports `POST` handler + có 3 route config: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60`.
- [ ] **AC-3:** `cd vibeseek && npx tsc --noEmit` pass.
- [ ] **AC-4:** `cd vibeseek && npm run build` pass (verify route được Next.js pickup, không lỗi import).
- [ ] **AC-5:** `DEBUG_FORCE_GEMINI_FAIL=true` env → `embedTexts(['test'])` throw ngay câu đầu, không gọi Gemini (verify bằng smoke script ở Local test plan).
- [ ] **AC-6:** Endpoint idempotent: gọi 2 lần liên tiếp với cùng `documentId` → lần 1 `generated > 0`, lần 2 `generated = 0`, không lỗi duplicate-key.
- [ ] **AC-7:** Endpoint trả 404 `no_cards_for_document` nếu documentId không có card nào.
- [ ] **AC-8:** Endpoint trả 503 `embedding_unavailable` khi `DEBUG_FORCE_GEMINI_FAIL=true` (verify bằng curl trong Local test plan).

## Definition of Done
- [ ] All AC pass (AC-6/7/8 chạy được lúc dev server chạy thật)
- [ ] AGENT_LOG.md entry `started` + `completed`
- [ ] Task status → `review`
- [ ] PR opened
- [ ] Smoke script xoá trước khi commit (agent TUYỆT ĐỐI không commit `scripts/smoke-*.ts`)

## Failure modes (defensive checklist — BẮT BUỘC pre-empt trong code)

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Gemini 429/503 giữa batch → partial insert → retry sẽ lệch | Batch-level try/catch + retry 3 lần. Chỉ insert SAU KHI toàn bộ batch embed xong. |
| F-2 | Empty `cards` → gọi `embedContent` với `[]` → lỗi hoặc waste request | Sort-circuit `if inputs.length === 0 return []` trong lib + 404 trong route. |
| F-3 | `response.embeddings.length !== batch.length` — Gemini drop 1 item | Shape validation, throw → retry. |
| F-4 | `values.length !== 768` — model sai | Shape validation, throw. |
| F-5 | Duplicate insert race (2 tab cùng mở chat page) | `upsert + ignoreDuplicates + onConflict: card_id` — DB layer handles. KHÔNG check-then-insert. |
| F-6 | Next.js fetch cache làm Supabase read stale → nghĩ chưa có embedding, re-generate tốn quota | Phase 2 đã fix: `supabaseAdmin` wrap `fetch` với `cache: 'no-store'`. Verify import path đúng file đã fix. |
| F-7 | Agent quên `export const runtime = 'nodejs'` → Next.js chạy Edge runtime mặc định → Gemini SDK fail | Explicit config top of route file — spec chỉ rõ. Review catch. |
| F-8 | Agent add fire-and-forget call trong `/api/vibefy` "for speed" | Spec "Files NOT to touch" cấm. Review catch. |
| F-9 | `DEBUG_FORCE_GEMINI_FAIL` leak vào production env | Flag check chỉ hoạt động khi `process.env.DEBUG_FORCE_GEMINI_FAIL === 'true'`. Document README/env.local.example = dev only. |
| F-10 | pgvector upsert fail vì format vector sai (array vs JSON string) | Supabase-js serializes JS array → JSON → postgres casts to `vector`. Nếu lỗi, agent thử `"[1,2,3,...]"` string literal. Test smoke verify row insert. |
| F-11 | Insert fail không log đủ → user stuck | `console.error` kèm detail; return JSON có `detail` field. |
| F-12 | Token limit — card title + content > 2048 token (model max 2048) | Cards title ≤10 từ + content ≤3 câu (blueprint §7.1) → dư giới hạn. Không cần truncate MVP. |

## Local test plan (10 phút — user chạy sau khi agent push PR)

### Setup
Dev server đang chạy (`cd vibeseek && npm run dev` → port 3000). Có sẵn 1 doc với cards (nếu chưa, upload PDF qua dashboard).

### Test 1 — Smoke script cho lib
Agent tạo TẠM `vibeseek/scripts/smoke-embeddings.ts`:
```ts
import { embedTexts, EMBEDDING_DIM } from '@/lib/ai/embeddings'

async function main() {
  const vecs = await embedTexts([
    'Bubble Sort is a simple sorting algorithm.',
    'Quick Sort uses divide and conquer.',
  ])
  console.log('vector count:', vecs.length)
  console.log('dim[0]:', vecs[0].length, 'expected', EMBEDDING_DIM)
  console.log('first 5 values[0]:', vecs[0].slice(0, 5))
}
main().catch(err => { console.error(err); process.exit(1) })
```
Chạy: `cd vibeseek && npx tsx scripts/smoke-embeddings.ts`
Expected: `vector count: 2 / dim[0]: 768 / first 5 values: [<floats>]`
**Xoá file sau khi verify — KHÔNG commit.**

### Test 2 — Force-fail flag
```bash
cd vibeseek
DEBUG_FORCE_GEMINI_FAIL=true npx tsx scripts/smoke-embeddings.ts
```
Expected: throw `DEBUG_FORCE_GEMINI_FAIL active — simulating Gemini outage`, exit 1.

### Test 3 — Endpoint happy path (dev server)
Lấy 1 `documentId` có sẵn từ Supabase Dashboard (table `vibe_documents`). Gọi:
```bash
curl -X POST http://localhost:3000/api/embeddings/ensure \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<PASTE_UUID>"}'
```
Expected response: `{"ready":true,"count":10,"generated":10}` (hoặc count khớp số card thật).
Verify DB: SQL Editor → `SELECT COUNT(*) FROM card_embeddings WHERE document_id = '<UUID>';` → match `count`.

### Test 4 — Endpoint idempotent
Gọi lại đúng lệnh curl Test 3.
Expected: `{"ready":true,"count":10,"generated":0}` — không insert thêm, không lỗi.

### Test 5 — 404 no cards
```bash
curl -X POST http://localhost:3000/api/embeddings/ensure \
  -H "Content-Type: application/json" \
  -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'
```
Expected: HTTP 404, body `{"error":"no_cards_for_document"}`.

### Test 6 — 503 force-fail
Set env trong `.env.local`: thêm `DEBUG_FORCE_GEMINI_FAIL=true`. Restart dev server. Chạy Test 3 với một `documentId` mới (hoặc xoá embeddings cũ):
```sql
DELETE FROM card_embeddings WHERE document_id = '<UUID>';
```
Rồi curl:
```bash
curl -i -X POST http://localhost:3000/api/embeddings/ensure \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<UUID>"}'
```
Expected: HTTP 503, body `{"error":"embedding_unavailable","detail":"DEBUG_FORCE_GEMINI_FAIL active ..."}`.
**Sau test xoá `DEBUG_FORCE_GEMINI_FAIL=true` khỏi `.env.local`.**

## Non-goals (KHÔNG làm)
- KHÔNG add trigger sinh embedding từ `/api/vibefy` (Q-06 chốt lazy pattern).
- KHÔNG add Groq fallback cho embeddings (Groq không cung cấp embedding API free tier — xác định ở Q-06 discussion).
- KHÔNG viết RAG retrieval hoặc chat logic — T-303/T-304.
- KHÔNG tạo UI nào — T-305.
- KHÔNG modify `supabaseAdmin` client — đã fix Phase 2.
- KHÔNG commit file `scripts/smoke-*.ts` (gitignored + phải xoá sau test).

## Questions / Blockers
_(none at spec time)_

## Decisions log

**D-1: Model name changed from `text-embedding-004` to `gemini-embedding-001`**
- `text-embedding-004` returns 404 via `@google/genai@1.50.0` SDK (confirmed via both SDK call and direct REST to `generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`).
- `gemini-embedding-001` is Google's documented successor, accessible via the new SDK.
- Using `config: { outputDimensionality: 768 }` parameter to match the existing `vector(768)` column in `card_embeddings` (T-301 DDL, already applied to Supabase).
- Smoke test verified: 2 vectors × 768 dims with real floats. DB column compatibility maintained.

**D-2: Smoke test results (2026-04-18)**
- `embedTexts(['Bubble Sort...', 'Quick Sort...'])` → `vector count: 2 / dim[0]: 768` ✓
- `DEBUG_FORCE_GEMINI_FAIL=true` → throws immediately, exit 1 ✓
- Smoke script deleted before commit ✓

## Notes for reviewer
- **Phase 2 lessons applied preemptively:** retry classifier bao gồm 429/500/503/UNAVAILABLE/overloaded/deadline (F-1); shape validation 2 tầng (F-3/F-4); upsert onConflict thay check-then-insert (F-5); `supabaseAdmin` no-store fetch đã baseline (F-6); explicit `runtime = 'nodejs'` (F-7).
- **Grep check trước approve:** `grep -r "embedContent" vibeseek/lib` chỉ nên có trong `embeddings.ts`. `grep -r "embeddings/ensure" vibeseek/app` chỉ 1 route file.
- **Review phải CHẠY Test 3/4/5/6** trên dev server thật (Phase 3 pipeline rule — không chỉ tsc/build).
- Agent scope-creep red flags: thêm `/api/vibefy` edits, thêm Groq code path, thêm UI skeleton.
