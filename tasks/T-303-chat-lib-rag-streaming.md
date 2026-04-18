# T-303 · `lib/ai/chat.ts` — RAG retrieval + streaming (Gemini → Groq)

**Status:** `review`
**Severity:** HIGH (core Phase 3)
**Blueprint ref:** §2.5 RAG flow, §6.7 chat API, §7.3 fallback chain, §12 Q-07
**Branch:** `task/T-303-chat-lib-rag-streaming`
**Assignee:** _(TBD)_
**Depends on:** T-301 (DDL), T-302 (embedTexts reuse). **BLOCKED until T-302 merged.**

## Context

Library layer cho chat: retrieve context RAG + build prompt + stream từ Gemini với fallback Groq. API route `/api/chat` (T-304) sẽ gọi các function này. Tách thành 2 file riêng giúp unit-test từng phần.

**Architect audit 2026-04-18 áp dụng:**
- `vibe_documents.raw_text` column được T-301 add + `/api/vibefy` lưu từ nay. Doc cũ không có → `pickSnippet` fallback chỉ dùng cards.
- `supabaseAdmin` import từ `@/utils/supabase`.
- 2 flag riêng: `DEBUG_FORCE_GEMINI_FAIL` (total outage) + `DEBUG_FORCE_CHAT_GEMINI_FAIL` (chỉ block streaming, để test Groq fallback độc lập).

**Key design decisions (blueprint §2.5 + Q-07):**
- Context = top-5 cards từ pgvector cosine + snippet raw_text ≤2000 ký tự (ưu tiên keyword match, fallback 2000 đầu).
- History cắt giữ 6 messages cuối (3 lượt) tránh token bloat.
- Streaming fallback chain: `gemini-2.0-flash → 2.0-flash-lite → 2.5-flash → Groq llama-3.3-70b`. Mỗi provider stream qua async iterator; nếu provider đầu timeout/fail TRƯỚC khi yield chunk nào → thử tiếp. Nếu đã yield ≥1 chunk rồi fail giữa chừng → KHÔNG restart (tránh duplicate text cho user), client nhận partial + error event.

## Files to touch
- `vibeseek/lib/ai/chat.ts` (NEW) — retrieve + prompt builder + streaming wrapper
- `vibeseek/lib/ai/prompts.ts` (APPEND `CHAT_SYSTEM_PROMPT` — KHÔNG xoá/sửa prompts cũ)
- `tasks/T-303-chat-lib-rag-streaming.md` (status updates)
- `AGENT_LOG.md`

## Files NOT to touch
- `vibeseek/app/api/chat/**` — T-304 scope (sẽ consume lib này)
- `vibeseek/app/api/embeddings/**`, `lib/ai/embeddings.ts` — T-302 scope (import, don't modify)
- UI/component files — T-305 scope
- Other `lib/ai/*.ts` files — không liên quan

## Architect's spec

### 1. Append to `vibeseek/lib/ai/prompts.ts`

```ts
export const CHAT_SYSTEM_PROMPT = `Bạn là DOJO — trợ lý AI của VibeSeek, đối thoại với sinh viên Gen Z Việt Nam về tài liệu họ vừa upload.

NGUYÊN TẮC TRẢ LỜI:
- Chỉ trả lời dựa trên CONTEXT được cung cấp bên dưới (gồm các Vibe Cards + trích đoạn tài liệu gốc). KHÔNG bịa số liệu, KHÔNG suy diễn ngoài context.
- Nếu context không đủ để trả lời → thú nhận "Tài liệu không đề cập rõ phần này. Bạn thử hỏi cách khác hoặc upload thêm tài liệu nhé." — KHÔNG google, KHÔNG dùng kiến thức huấn luyện chung.
- Tiếng Việt thân thiện, tone như anh/chị khóa trên giảng bài cho khóa dưới. Ngắn gọn, dùng ví dụ cụ thể khi có.
- Có thể dùng bullet list hoặc code fence nếu giúp làm rõ.
- Tối đa 250 từ mỗi câu trả lời. Nếu dài hơn → cắt + hỏi "Bạn muốn mình giải thích sâu phần nào?"

FORMAT:
- Trả lời plaintext/markdown, KHÔNG json, KHÔNG prefix "DOJO:" (client tự render role).`
```

### 2. `vibeseek/lib/ai/chat.ts`

```ts
import { GoogleGenAI } from '@google/genai'
import { supabaseAdmin } from '@/utils/supabase' // architect audit 2026-04-18 — verified path
import { embedTexts } from './embeddings'
import { CHAT_SYSTEM_PROMPT } from './prompts'
import { groqChat } from './providers/groq' // note: current groqChat returns string non-streaming — see §4 below

export interface RetrievedCard {
  card_id: string
  title: string
  content: string
  distance: number
}

export interface RetrievedContext {
  cards: RetrievedCard[]
  textSnippet: string
  documentTitle: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_HISTORY_MESSAGES = 6
const MAX_SNIPPET_CHARS = 2000
const TOP_K = 5

// Two independent flags. `DEBUG_FORCE_GEMINI_FAIL` blocks EVERYTHING Gemini
// (including embed + chat) — useful to simulate complete Gemini outage.
// `DEBUG_FORCE_CHAT_GEMINI_FAIL` blocks only the chat streaming block, so
// retrieveContext (which uses embed) still works → lets you test Groq
// streaming fallback without also killing RAG retrieval.
const forceFailGemini = () => process.env.DEBUG_FORCE_GEMINI_FAIL === 'true'
const forceFailChatGemini = () =>
  forceFailGemini() || process.env.DEBUG_FORCE_CHAT_GEMINI_FAIL === 'true'

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isRetriableError(err: unknown): boolean {
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
 * Retrieve RAG context for a chat query.
 * 1. Embed the query (1 call).
 * 2. kNN search top-5 cards via pgvector cosine (`<=>` operator).
 * 3. Fetch document title + raw_text snippet (keyword-biased).
 *
 * Throws if no cards found or embedding fails — caller (route) maps to 404/503.
 */
export async function retrieveContext(
  documentId: string,
  query: string,
): Promise<RetrievedContext> {
  // 1. Document metadata + raw text
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('vibe_documents')
    .select('id, title, raw_text')
    .eq('id', documentId)
    .maybeSingle()

  if (docErr) throw new Error(`document query failed: ${docErr.message}`)
  if (!doc) throw new Error('document_not_found')

  // 2. Embed query
  const [queryVec] = await embedTexts([query])
  if (!queryVec) throw new Error('query embedding failed')

  // 3. kNN via RPC or direct SQL. Use rpc('match_card_embeddings', ...) — see §3.
  const { data: matches, error: matchErr } = await supabaseAdmin.rpc(
    'match_card_embeddings',
    {
      p_document_id: documentId,
      p_query_embedding: queryVec,
      p_match_count: TOP_K,
    },
  )

  if (matchErr) throw new Error(`knn rpc failed: ${matchErr.message}`)
  if (!matches || matches.length === 0) throw new Error('no_embeddings')

  const cards: RetrievedCard[] = matches.map((m: { card_id: string; title: string; content: string; distance: number }) => ({
    card_id: m.card_id,
    title: m.title,
    content: m.content,
    distance: Number(m.distance),
  }))

  // 4. Raw text snippet biased by first keyword of query (≥4 chars, Vietnamese-friendly)
  const rawText: string = doc.raw_text ?? ''
  const textSnippet = pickSnippet(rawText, query, MAX_SNIPPET_CHARS)

  return {
    cards,
    textSnippet,
    documentTitle: doc.title ?? 'Tài liệu',
  }
}

function pickSnippet(rawText: string, query: string, maxChars: number): string {
  if (rawText.length <= maxChars) return rawText
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 4)
  const lower = rawText.toLowerCase()
  for (const kw of keywords) {
    const pos = lower.indexOf(kw)
    if (pos >= 0) {
      const start = Math.max(0, pos - Math.floor(maxChars / 2))
      return rawText.slice(start, start + maxChars)
    }
  }
  return rawText.slice(0, maxChars)
}

function buildUserPrompt(context: RetrievedContext, history: ChatMessage[], message: string): string {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)
  const contextBlock = [
    `=== TÀI LIỆU: ${context.documentTitle} ===`,
    '',
    '# Vibe Cards liên quan (sắp xếp theo độ gần nhất):',
    ...context.cards.map((c, i) => `[${i + 1}] ${c.title}\n    ${c.content}`),
    '',
    '# Trích đoạn tài liệu gốc:',
    context.textSnippet,
    '=== HẾT CONTEXT ===',
  ].join('\n')

  const historyBlock = trimmedHistory.length
    ? '\n# Lịch sử trò chuyện (gần nhất):\n' +
      trimmedHistory.map(m => `${m.role === 'user' ? 'User' : 'DOJO'}: ${m.content}`).join('\n')
    : ''

  return `${contextBlock}${historyBlock}\n\n# Câu hỏi hiện tại của User:\n${message}\n\n# Trả lời của DOJO:`
}

export interface StreamChunk {
  delta: string
}

/**
 * Stream a chat response. Yields text chunks. Swallows per-provider errors
 * to try next in chain, but only IF no chunk has been yielded yet.
 * If a provider yields ≥1 chunk then fails mid-stream, error propagates to caller.
 *
 * Consumer (route) is responsible for writing chunks into SSE stream.
 */
export async function* streamChatResponse(
  context: RetrievedContext,
  history: ChatMessage[],
  message: string,
): AsyncGenerator<StreamChunk, { tokensUsed: number }, void> {
  const userPrompt = buildUserPrompt(context, history, message)
  const geminiModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']

  let yieldedAny = false
  let totalChars = 0
  let lastErr: unknown = null

  if (!forceFailChatGemini()) {
    const genAI = getGenAI()
    for (const modelName of geminiModels) {
      if (yieldedAny) break
      try {
        const stream = await genAI.models.generateContentStream({
          model: modelName,
          contents: `${CHAT_SYSTEM_PROMPT}\n\n${userPrompt}`,
          config: { temperature: 0.7, maxOutputTokens: 2048 },
        })
        for await (const chunk of stream) {
          const text = chunk.text
          if (text) {
            yieldedAny = true
            totalChars += text.length
            yield { delta: text }
          }
        }
        return { tokensUsed: Math.ceil(totalChars / 4) }
      } catch (err) {
        lastErr = err
        if (yieldedAny) {
          // already sent partial — don't fall through, let caller handle
          throw err
        }
        if (!isRetriableError(err)) throw err
        console.warn(`[chat] ${modelName} failed, trying next`, err)
      }
    }
  }

  // Groq fallback — non-streaming now, simulate stream by yielding in chunks.
  // (Blueprint note: if performance suffers, upgrade groqChat to real streaming later.)
  if (!yieldedAny) {
    console.log('[chat] falling back to Groq')
    const full = await groqChat(
      [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model: 'llama-3.3-70b-versatile', temperature: 0.7 },
    )
    // chunk every ~40 chars to simulate progressive render
    const CHUNK = 40
    for (let i = 0; i < full.length; i += CHUNK) {
      yield { delta: full.slice(i, i + CHUNK) }
      totalChars += Math.min(CHUNK, full.length - i)
    }
    return { tokensUsed: Math.ceil(totalChars / 4) }
  }

  // Unreachable — if yielded, we returned earlier. Kept for type safety.
  throw lastErr ?? new Error('chat providers exhausted')
}
```

### 3. SQL RPC to create on Supabase Dashboard (Architect ownership — part of this task's delivery, verified by user)

**Run on Supabase Dashboard → SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION match_card_embeddings(
  p_document_id UUID,
  p_query_embedding vector(768),
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  card_id UUID,
  title TEXT,
  content TEXT,
  distance FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    c.id AS card_id,
    c.title,
    c.content,
    (e.embedding <=> p_query_embedding)::float AS distance
  FROM card_embeddings e
  JOIN vibe_cards c ON c.id = e.card_id
  WHERE e.document_id = p_document_id
  ORDER BY e.embedding <=> p_query_embedding ASC
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION match_card_embeddings(UUID, vector, INT) TO service_role, anon;
```

Append SQL y hệt vào cuối `vibeseek/supabase-schema.sql`.

### 4. Note về `groqChat` hiện tại

Hiện `providers/groq.ts` return `string` (non-streaming). Để giữ scope task này nhỏ, **KHÔNG refactor `groqChat`** — giữ nguyên API, T-303 simulate streaming bằng cách chunk output. Trade-off: user thấy Groq trả lời ngắt quãng không mượt bằng Gemini native stream. Chấp nhận được cho MVP. Phase 4 có thể upgrade thành `groqChatStream` nếu cần.

## Acceptance criteria

- [ ] **AC-1:** `vibeseek/lib/ai/prompts.ts` append `CHAT_SYSTEM_PROMPT` (không xoá/sửa prompt cũ). `grep -c "export const" vibeseek/lib/ai/prompts.ts` trước/sau chênh đúng 1.
- [ ] **AC-2:** `vibeseek/lib/ai/chat.ts` exports: `retrieveContext`, `streamChatResponse`, types `RetrievedCard`/`RetrievedContext`/`ChatMessage`/`StreamChunk`.
- [ ] **AC-3:** `cd vibeseek && npx tsc --noEmit` pass.
- [ ] **AC-4:** `cd vibeseek && npm run build` pass.
- [ ] **AC-5 (User-runnable):** RPC function `match_card_embeddings` tạo trên Supabase Dashboard. Verify:
  ```sql
  SELECT proname, pronargs FROM pg_proc WHERE proname = 'match_card_embeddings';
  ```
  Expected 1 row, `pronargs = 3`.
- [ ] **AC-6 (User-runnable):** Smoke RPC trực tiếp qua SQL Editor (với doc đã có embeddings từ T-302 smoke):
  ```sql
  SELECT card_id, title, distance
  FROM match_card_embeddings(
    '<documentId>'::uuid,
    (SELECT embedding FROM card_embeddings WHERE document_id = '<documentId>'::uuid LIMIT 1),
    3
  );
  ```
  Expected: 3 rows, distance tăng dần, row đầu distance ≈ 0 (cùng card).
- [ ] **AC-7:** Smoke script (tạm) verify `retrieveContext + streamChatResponse` happy path — xem Local test plan.

## Definition of Done
- [ ] All AC pass (AC-5/6/7 chạy trên dev server/DB thật)
- [ ] AGENT_LOG.md start + done
- [ ] Task status → `review`
- [ ] PR opened
- [ ] Smoke file xoá trước commit

## Failure modes (defensive checklist)

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Query embed fail mid-retrieve | Throw rõ message → caller (T-304) map 503. Không fallback local embedding. |
| F-2 | RPC không tồn tại (user quên chạy SQL) | `matchErr.message` contain "function match_card_embeddings(...) does not exist" → caller biết hướng dẫn chạy SQL. |
| F-3 | `raw_text` NULL (doc cũ trước khi schema có column) | `rawText = doc.raw_text ?? ''` — empty string OK, pickSnippet trả '' → prompt vẫn có cards. |
| F-4 | query rỗng "" → embed fail | Caller validate trước khi gọi. retrieveContext vẫn tự phòng: embed cố gắng; nếu lỗi propagate. |
| F-5 | Gemini stream timeout 60s middle of response | yieldedAny=true → throw propagates; SSE route gửi error event, client render partial. |
| F-6 | Gemini streaming ignores maxOutputTokens và trả quá dài | Config `maxOutputTokens: 2048` — đủ cho 250-word answer. |
| F-7 | Groq fallback chunk quá chậm (40-char/chunk loop) trên ≤2000-char response = ~50 chunks | Mỗi chunk render instant, user experience chấp nhận. |
| F-8 | History quá dài → token explosion | Hardcap `slice(-6)` — 3 lượt, đủ context, rẻ. |
| F-9 | DEBUG_FORCE_GEMINI_FAIL → skip Gemini block hoàn toàn → chỉ chạm Groq | `forceFailGemini()` check ở đầu loop Gemini. Test 3 verify. |
| F-10 | pgvector RPC signature drift — param name/type không khớp | Spec hardcode `p_document_id UUID / p_query_embedding vector(768) / p_match_count INT`. SQL SSOT file lưu đúng. |
| F-11 | kwargs Supabase rpc() require pascalCase vs snakeCase nhầm | Supabase-js truyền lowercase param names → khớp `p_document_id` etc. Verify Test 7. |
| F-12 | `supabase-admin` import path khác nơi | Agent grep `supabaseAdmin` trong repo trước khi import — T-302 đã phải làm y hệt. |

## Local test plan (15 phút)

### Test 1 — tsc + build
```bash
cd vibeseek
npx tsc --noEmit
npm run build
```
Expected: both pass, `.next/server/chunks` có reference tới `lib/ai/chat`.

### Test 2 — RPC created (AC-5/6 above)
User chạy SQL trong Supabase Dashboard theo §3 spec. Verify bằng 2 query AC-5 và AC-6.

### Test 3 — Smoke chat lib
Agent tạo TẠM `vibeseek/scripts/smoke-chat.ts`:
```ts
import { retrieveContext, streamChatResponse } from '@/lib/ai/chat'

async function main() {
  const docId = process.argv[2]
  if (!docId) throw new Error('Usage: tsx smoke-chat.ts <documentId>')

  console.log('--- retrieveContext ---')
  const ctx = await retrieveContext(docId, 'Giải thích thuật toán sort đi')
  console.log('Cards:', ctx.cards.length, 'titles:', ctx.cards.map(c => c.title))
  console.log('Snippet chars:', ctx.textSnippet.length)
  console.log('Doc title:', ctx.documentTitle)

  console.log('--- streamChatResponse ---')
  const stream = streamChatResponse(ctx, [], 'Giải thích thuật toán sort đi')
  let total = ''
  for await (const chunk of stream) {
    process.stdout.write(chunk.delta)
    total += chunk.delta
  }
  console.log('\n--- done, total chars:', total.length)
}
main().catch(err => { console.error(err); process.exit(1) })
```
Chạy: `cd vibeseek && npx tsx scripts/smoke-chat.ts <docId>`
Expected: Cards array có 5 entries, snippet chars ≤2000, stream print text real-time. **Xoá file.**

### Test 4 — Force Groq streaming fallback
Dùng flag `DEBUG_FORCE_CHAT_GEMINI_FAIL=true` — chỉ block chat-block, embed vẫn work → retrieveContext OK, chỉ stream phần fallback sang Groq:
```bash
cd vibeseek
DEBUG_FORCE_CHAT_GEMINI_FAIL=true npx tsx scripts/smoke-chat.ts <docId>
```
Expected: retrieveContext pass, stream có log `[chat] falling back to Groq`, output chunks 40-char giả streaming. Câu trả lời vẫn đầy đủ.

### Test 4b — Force TOTAL Gemini outage
```bash
DEBUG_FORCE_GEMINI_FAIL=true npx tsx scripts/smoke-chat.ts <docId>
```
Expected: retrieveContext throw ngay ở bước embed (`DEBUG_FORCE_GEMINI_FAIL active...`). Stream không chạm. Caller (T-304) sẽ map 503.

### Test 5 — Empty history
Smoke gọi `streamChatResponse(ctx, [], "hello")` — expected: không crash, return 1 câu chào hỏi/thú nhận thiếu context.

### Test 6 — Long history (trim)
Smoke gọi với `history = Array(20).fill({role:'user', content:'x'})` → verify prompt build chỉ đưa 6 messages. Inspect bằng `console.log(userPrompt)` thêm vào smoke tạm.

## Non-goals (KHÔNG làm)
- KHÔNG viết API route — T-304.
- KHÔNG upgrade `providers/groq.ts` sang streaming — giữ chunk-simulate.
- KHÔNG UI — T-305.
- KHÔNG lưu chat vào DB — Q-09 chốt client-only.
- KHÔNG modify `embeddings.ts` (import only) — T-302 scope đã đóng.
- KHÔNG modify `supabase-admin` — đã fix Phase 2.
- KHÔNG commit smoke scripts.

## Questions / Blockers
_(none)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- **Phase 2 lessons applied:** retry classifier comprehensive (F-1 checklist Phase 2), Gemini fallback chain explicit (F-1 item 4 lessons), `maxOutputTokens 2048` safe cho chat (item 1 về 16384 chỉ cho batch JSON; chat không JSON, 2048 đủ), no `useRef` / Strict Mode concerns ở server lib (không áp dụng).
- **Review PHẢI thao tác smoke Test 3 + Test 4** trên dev thật — không chỉ tsc.
- Agent red flag: modify `groq.ts` (out of scope), viết `/api/chat` route (T-304 scope), viết UI (T-305 scope).
- Verify RPC signature với user trước approve — nếu tên/kiểu param lệch, T-304 sẽ fail silent ở production.
