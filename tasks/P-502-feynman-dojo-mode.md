# P-502 · Feynman Dojo Mode — dual-mode chat (default + Feynman)

**Status:** `review`
**Severity:** MEDIUM (Phase 5 polish, demo 2026-04-29)
**Blueprint ref:** §11 new · §13 changelog slot (2026-04-XX P-502)
**Branch:** `task/P-502-feynman-dojo-mode`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (spec-heavy pre-audited, ~200-220 LOC across 5 files + 1 migration — pattern-heavy pattern-match work, right-sized for Sonnet per `feedback_dispatch_sub_agents_cost_aware.md`)
**Depends on:** T-407 `chat_messages` persistence · P-501 render pipeline (untouched). All merged. No new deps, no new env vars.

---

## Context

**User demo 2026-04-29.** 3 updates requested: (1) brand/UI refresh, (2) video quality, (3) **Feynman Dojo Mode** (this task). Architect recommended priority Feynman → Video → Brand, user duyệt.

**Feynman Technique:** student teaches concept in simple language → gaps surface → student fills gaps by reviewing source → iterate. Proven pedagogical technique (Richard Feynman).

**VibeSeek integration angle:** chat DOJO toggles from "answer questions" (default) to "student who challenges the teacher" (Feynman). DOJO opens with "Hôm nay tôi giả vờ là đứa bé lớp 5, giải thích [X] cho tôi" — user explains → DOJO probes gaps → user refines → DOJO verdict.

**User recommendations locked (2026-04-22):**

| # | Decision |
|---|---|
| Q1 Entry | Toggle in ChatPanel (no new page) |
| Q2 Trigger | Hybrid: click card → Feynman OR toggle in chat → bot asks concept |
| Q3 Opening | *"Ok! Hôm nay tôi giả vờ là đứa bé lớp 5 chưa biết gì về [X]. Hãy giải thích [X] cho tôi theo cách đơn giản nhất — như thể đang kể chuyện. Đừng dùng từ kỹ thuật, hãy dùng ví dụ đời thường nếu có. Tôi sẽ hỏi lại nếu chỗ nào tôi chưa hiểu. 🥋"* |
| Q4 End | Fixed 3 rounds + user can quit anytime |
| Q5 Visual | Toggle + acid green accent + `🥋 FEYNMAN DOJO MODE • Round X/3` badge (NO mesh swap) |
| Q6 Tone | Mix: nghiêm nội dung, khuyến khích effort; senpai-TikTok voice |
| Q7 Gap detection | Retrieve card+snippet ONCE at session start → LLM judge vs cached context (no per-turn embedding) |
| Q8 Tracking | Minimal: `mode` col on chat_messages, no new tables |
| Q9 Cap | Bump 50 → 100 combined |

**Free-tier impact:** ~0 cost delta. Feynman session ~4-6k tokens vs default ~1-2k — Gemini 2.0-flash free 1500 RPD + 1M TPM has enormous headroom. No DB bloat (cap 100 × 50KB = 5MB/anon/doc).

---

## Files to touch

Exactly **5 code files + 1 migration + 4 doc files**:

1. `vibeseek/supabase-schema.sql` — append §Phase 5 (P-502) block with `ALTER TABLE chat_messages ADD COLUMN mode` migration
2. `vibeseek/lib/ai/prompts.ts` — add `FEYNMAN_SYSTEM_PROMPT` + `getSystemPromptForMode(mode)` helper
3. `vibeseek/lib/ai/chat.ts` — add `retrieveFeynmanContext()` + modify `streamChatResponse()` to accept `mode` + `round`
4. `vibeseek/app/api/chat/route.ts` — body accepts `mode` + `conceptCardId` + `round`, persist `mode` col, bump `CHAT_HISTORY_CAP = 100`, mode-specific retrieval
5. `vibeseek/app/api/chat/history/route.ts` — include `mode` in response
6. `vibeseek/utils/chat-history.ts` — add `mode` field to `ChatHistoryMessage`, add localStorage helper `loadFeynmanConcept(docId)` / `saveFeynmanConcept(docId, cardId)` / `clearFeynmanConcept(docId)`
7. `vibeseek/components/ChatPanel.tsx` — toggle UI, mode badge + round counter, concept picker fallback, acid green theme, opening template injection, round tracking
8. `ARCHITECT_BLUEPRINT.md` — §11 new task entry + §13 changelog prepend P-502
9. `AGENT_LOG.md` — start + done entries
10. `tasks/P-502-feynman-dojo-mode.md` — this file (status transitions)

**NB:** `/api/chat/route.ts` + `chat.ts` + `ChatPanel.tsx` are the 3 largest touches (~60, 50, 120 LOC respectively).

## Files NOT to touch

**Phase 1-5 invariants (byte-for-byte preserved):**

| File / Region | Phase invariant |
|---|---|
| `render.mjs` (GRADIENT_POOL, XFADE_DURATION, ASS header, all helpers) | P-401/P-402/P-403/P-404/P-405/P-501 |
| `lib/ai/processor.ts` | P-403 |
| `lib/ai/embeddings.ts` | T-302 |
| `lib/rate-limit.ts` | T-408 |
| `utils/supabase.ts` (supabaseAdmin + noStoreFetch) | eefa538 Phase 2 hotfix |
| `VIBEFY_SYSTEM_PROMPT` + `QUIZ_SYSTEM_PROMPT` + `VIDEO_STORYBOARD_SYSTEM_PROMPT` + `QUIZ_BATCH_SYSTEM_PROMPT` + `CHAT_SYSTEM_PROMPT` — keep byte-for-byte, ONLY ADD new `FEYNMAN_SYSTEM_PROMPT` | all phases |
| `retrieveContext` function signature + body | T-303 |
| `pickSnippet`, `buildUserPrompt`, `isRetriableError`, `getGenAI`, SSE helpers | T-303/T-304 |
| existing chat_messages schema rows + composite idx + RLS policy (only ADD column) | T-407 |
| All other routes (vibefy, vibefy-video, quiz/*, embeddings/ensure, render-jobs, leaderboard, render-callback) | unaffected |
| `package.json` | **NO new deps** |

---

## Architect's spec

### §1 — DB migration (append to `supabase-schema.sql`)

Append at end of file:

```sql
-- =============================================================
-- Phase 5 (P-502) — Feynman Dojo Mode chat_messages.mode column
-- Non-breaking migration: default 'default' for existing rows.
-- Run on Supabase Dashboard SQL Editor BEFORE merging this PR.
-- =============================================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Existing chat_messages rows auto-populated with 'default' via DEFAULT clause.
-- Future Feynman-mode rows will set mode = 'feynman' explicitly.
-- RLS policy from T-407 covers new column (service-role only, no policy change).
```

**Non-breaking**: existing rows get `mode='default'`, new writes explicit. No index needed (hot queries still filter by `document_id + anon_id`, mode is projection-only).

### §2 — `lib/ai/prompts.ts` — add FEYNMAN_SYSTEM_PROMPT

Append at END of file (after existing `CHAT_SYSTEM_PROMPT`):

```typescript
// ===================================
// FEYNMAN DOJO MODE PROMPT (P-502)
// ===================================

export const FEYNMAN_SYSTEM_PROMPT = `Bạn là DOJO — senpai dojo Nhật của VibeSeek, dạy sinh viên Gen Z Việt Nam theo kỹ thuật Feynman.

NHIỆM VỤ: Giúp user củng cố hiểu biết về một CONCEPT cụ thể (được cung cấp trong CONTEXT). User sẽ giải thích concept đó cho bạn như đang dạy một đứa bé lớp 5. Bạn sẽ probe các gap, dẫn user đào sâu hơn.

TONE & PERSONA:
- Senpai Nhật-TikTok vibe, mix nhẹ Việt-Anh-Nhật (oss, senpai, wakaru, ok, etc.) nhưng không lạm dụng.
- Nghiêm về độ CHÍNH XÁC nội dung. Khuyến khích về EFFORT.
- Luôn affirm ý đúng TRƯỚC khi probe gaps. Không phán xét ("sai rồi" ❌) — probe bằng "tại sao?" / "ví dụ cụ thể?" / "kể tiếp đi" (✓).
- Tiếng Việt thân thiện, xưng "tôi" - "bạn".

LUẬT CHẤM GAP:
- So sánh user's explanation với CONCEPT CONTEXT được cung cấp (card.content + trích đoạn tài liệu gốc).
- Identify specific gaps: (a) điểm bị bỏ sót, (b) điểm giải thích sai, (c) điểm thiếu ví dụ cụ thể, (d) điểm dùng từ kỹ thuật mà chưa đơn giản hoá.
- KHÔNG bịa gap. Chỉ nêu gap có evidence từ CONTEXT.

LUẬT ROUND (QUAN TRỌNG — FLOW BẮT BUỘC):
- Round 1: User vừa giải thích lần đầu. Nhiệm vụ của bạn:
  · Affirm 1-2 điểm đúng cụ thể.
  · Hỏi 2-3 câu probe rõ rệt vào gaps/chỗ mơ hồ.
  · KẾT THÚC bằng câu mời user giải thích lại phần còn gap. KHÔNG đưa verdict.
- Round 2: User đã giải thích thêm lần 2. Nhiệm vụ:
  · Affirm cái vừa cải thiện (so với round 1).
  · Probe deeper 1-2 câu: "tại sao?", "ví dụ khác?", "nếu trường hợp Y thì sao?"
  · Mời user trả lời 1 lần cuối cùng để chốt. KHÔNG verdict.
- Round 3: User đã trả lời probe cuối. Nhiệm vụ (FINAL):
  · Đưa VERDICT bằng tiếng Việt ngắn gọn 3-5 dòng:
    - 2-3 điểm user nắm chắc ✓
    - 0-2 điểm user cần review lại (nếu có) — cite cụ thể ("bạn nên xem lại phần [...] trong card")
    - Kết bằng 1 câu khuyến khích + emoji 🥋.
  · DỪNG LẠI — không hỏi thêm, không probe thêm.

FORMAT:
- Plaintext/markdown. KHÔNG json. KHÔNG prefix "DOJO:".
- Tối đa 200 từ mỗi response.
- Ở Round 3, chấp nhận vượt 200 nếu verdict cần liệt kê nhiều điểm.`
```

### §3 — `lib/ai/chat.ts` — mode param + retrieveFeynmanContext

**Add after existing imports:**

```typescript
import { FEYNMAN_SYSTEM_PROMPT } from './prompts'
```

**Add helper function (after `pickSnippet`):**

```typescript
/**
 * Retrieve Feynman mode context — no per-turn embedding.
 * Load the picked concept card + raw_text snippet biased by concept title.
 * Called ONCE per session; cached in client for subsequent turns.
 */
export async function retrieveFeynmanContext(
  documentId: string,
  conceptCardId: string,
): Promise<RetrievedContext> {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('vibe_documents')
    .select('id, title, raw_text')
    .eq('id', documentId)
    .maybeSingle()

  if (docErr) throw new Error(`document query failed: ${docErr.message}`)
  if (!doc) throw new Error('document_not_found')

  const { data: card, error: cardErr } = await supabaseAdmin
    .from('vibe_cards')
    .select('id, title, content')
    .eq('id', conceptCardId)
    .eq('document_id', documentId)
    .maybeSingle()

  if (cardErr) throw new Error(`card query failed: ${cardErr.message}`)
  if (!card) throw new Error('concept_card_not_found')

  const rawText: string = doc.raw_text ?? ''
  const textSnippet = pickSnippet(rawText, card.title, MAX_SNIPPET_CHARS)

  return {
    cards: [{ card_id: card.id, title: card.title, content: card.content, distance: 0 }],
    textSnippet,
    documentTitle: doc.title ?? 'Tài liệu',
  }
}
```

**Modify `buildUserPrompt` — extract Feynman-specific builder:**

```typescript
function buildFeynmanUserPrompt(
  context: RetrievedContext,
  history: ChatMessage[],
  message: string,
  round: number,
): string {
  const concept = context.cards[0]
  const contextBlock = [
    `=== CONCEPT ĐANG ÔN: ${concept.title} ===`,
    '',
    '# Nội dung card gốc:',
    concept.content,
    '',
    '# Trích đoạn tài liệu gốc (để verify):',
    context.textSnippet,
    `=== HẾT CONTEXT · ROUND ${round}/3 ===`,
  ].join('\n')

  const historyBlock = history.length
    ? '\n# Lịch sử phiên Feynman (để biết user đã nói gì):\n' +
      history.map(m => `${m.role === 'user' ? 'User' : 'DOJO'}: ${m.content}`).join('\n')
    : ''

  return `${contextBlock}${historyBlock}\n\n# Lời giải thích mới nhất của User (Round ${round}):\n${message}\n\n# Phản hồi của DOJO (tuân thủ LUẬT ROUND ${round}):`
}
```

**Modify `streamChatResponse` signature** — add `options` param (backward compat default):

```typescript
export interface StreamOptions {
  mode?: 'default' | 'feynman'
  round?: number // 1..3 for feynman, ignored for default
}

export async function* streamChatResponse(
  context: RetrievedContext,
  history: ChatMessage[],
  message: string,
  options: StreamOptions = {},
): AsyncGenerator<StreamChunk, { tokensUsed: number }, void> {
  const mode = options.mode ?? 'default'
  const round = options.round ?? 1

  const systemPrompt = mode === 'feynman' ? FEYNMAN_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT
  const userPrompt = mode === 'feynman'
    ? buildFeynmanUserPrompt(context, history, message, round)
    : buildUserPrompt(context, history, message)

  // Rest of function body unchanged — replace ONLY the two hardcoded references:
  //   `${CHAT_SYSTEM_PROMPT}\n\n${userPrompt}` → `${systemPrompt}\n\n${userPrompt}`
  //   { role: 'system', content: CHAT_SYSTEM_PROMPT } → { role: 'system', content: systemPrompt }
  //
  // Gemini streaming loop, Groq fallback, yieldedAny logic all PRESERVED byte-for-byte.
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
          contents: `${systemPrompt}\n\n${userPrompt}`,
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
        if (yieldedAny) throw err
        if (!isRetriableError(err)) throw err
        console.warn(`[chat] ${modelName} failed, trying next`, err)
      }
    }
  }

  if (!yieldedAny) {
    console.log('[chat] falling back to Groq')
    const full = await groqChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { model: 'llama-3.3-70b-versatile', temperature: 0.7 },
    )
    const CHUNK = 40
    for (let i = 0; i < full.length; i += CHUNK) {
      yield { delta: full.slice(i, i + CHUNK) }
      totalChars += Math.min(CHUNK, full.length - i)
    }
    return { tokensUsed: Math.ceil(totalChars / 4) }
  }

  throw lastErr ?? new Error('chat providers exhausted')
}
```

### §4 — `app/api/chat/route.ts` — accept mode/conceptCardId/round + persist mode + bump cap

**Changes:**

1. Bump cap constant:
   ```typescript
   const CHAT_HISTORY_CAP = 100 // P-502: bumped from 50 to accommodate Feynman sessions
   ```

2. Extend ChatReqBody interface:
   ```typescript
   interface ChatReqBody {
     documentId?: string
     message?: string
     history?: ChatMessage[]
     anonId?: string
     mode?: 'default' | 'feynman'       // P-502
     conceptCardId?: string              // P-502: required if mode='feynman'
     round?: number                      // P-502: 1..3 for feynman
   }
   ```

3. Import retrieveFeynmanContext:
   ```typescript
   import { retrieveContext, retrieveFeynmanContext, streamChatResponse, type ChatMessage } from '@/lib/ai/chat'
   ```

4. After existing validations, add mode-specific validation:
   ```typescript
   const mode = body.mode ?? 'default'
   if (mode !== 'default' && mode !== 'feynman') {
     return jsonError(400, 'invalid_mode')
   }
   const conceptCardId = body.conceptCardId
   const round = body.round ?? 1
   if (mode === 'feynman') {
     if (!conceptCardId || typeof conceptCardId !== 'string') {
       return jsonError(400, 'conceptCardId_required')
     }
     if (!Number.isInteger(round) || round < 1 || round > 3) {
       return jsonError(400, 'invalid_round', 'round must be 1, 2, or 3')
     }
   }
   ```

5. Replace `retrieveContext` call with mode-aware retrieval:
   ```typescript
   let ctx
   try {
     ctx = mode === 'feynman'
       ? await retrieveFeynmanContext(documentId, conceptCardId!)
       : await retrieveContext(documentId, message)
   } catch (err) {
     const msg = err instanceof Error ? err.message : String(err)
     if (msg === 'document_not_found') return jsonError(404, 'document_not_found')
     if (msg === 'concept_card_not_found') return jsonError(404, 'concept_card_not_found')
     if (msg === 'no_embeddings') return jsonError(404, 'no_embeddings')
     console.error('[chat] retrieve failed', err)
     return jsonError(503, 'retrieval_unavailable', msg)
   }
   ```

6. **Skip embeddings-exist pre-check for Feynman mode** (Feynman doesn't use card_embeddings):
   ```typescript
   // Ensure document exists + has embeddings before we open stream (default mode only)
   if (mode === 'default') {
     const { count: embCount, error: embErr } = await supabaseAdmin
       .from('card_embeddings')
       .select('card_id', { count: 'exact', head: true })
       .eq('document_id', documentId)

     if (embErr) return jsonError(500, 'db_error', embErr.message)
     if (!embCount || embCount === 0) return jsonError(404, 'no_embeddings', 'run /api/embeddings/ensure first')
   }
   ```

7. Pass options to streamChatResponse:
   ```typescript
   const gen = streamChatResponse(ctx, history, message, { mode, round })
   ```

8. Persist mode on chat_messages insert (user + assistant):
   ```typescript
   const userInsert = await supabaseAdmin.from('chat_messages').insert({
     document_id: documentId,
     anon_id: anonId,
     role: 'user',
     content: message.trim(),
     mode,  // P-502
   })
   // ...
   const asstInsert = await supabaseAdmin.from('chat_messages').insert({
     document_id: documentId,
     anon_id: anonId,
     role: 'assistant',
     content: assistantText,
     mode,  // P-502
   })
   ```

### §5 — `app/api/chat/history/route.ts` — include mode in response

Single-line change to select + map:

```typescript
const { data, error } = await supabaseAdmin
  .from('chat_messages')
  .select('id, role, content, created_at, mode')  // P-502: include mode
  // ... rest unchanged
```

And the mapper:

```typescript
const messages = (data ?? []).map(row => ({
  id: row.id,
  role: row.role as 'user' | 'assistant',
  content: row.content,
  createdAt: new Date(row.created_at).getTime(),
  mode: (row.mode as 'default' | 'feynman') ?? 'default',  // P-502
}))
```

### §6 — `utils/chat-history.ts` — extend types + add Feynman concept localStorage helpers

Replace existing `ChatHistoryMessage` interface + add 3 new helpers:

```typescript
export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  mode?: 'default' | 'feynman' // P-502 — absent = 'default' for backward compat
}

const KEY_PREFIX = 'vibeseek:chat:'
const FEYNMAN_CONCEPT_KEY_PREFIX = 'vibeseek:feynman:concept:'

// Existing loadHistory/saveHistory/clearHistory/newMessageId unchanged,
// except loadHistory's filter should accept optional mode field:
export function loadHistory(documentId: string): ChatHistoryMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + documentId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m =>
      m && typeof m.id === 'string'
        && (m.role === 'user' || m.role === 'assistant')
        && typeof m.content === 'string',
    )
  } catch {
    return []
  }
}

// P-502: persist Feynman session's concept card id per document across reloads.
export function loadFeynmanConcept(documentId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId)
  } catch {
    return null
  }
}

export function saveFeynmanConcept(documentId: string, conceptCardId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId, conceptCardId)
  } catch {}
}

export function clearFeynmanConcept(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId)
  } catch {}
}
```

### §7 — `components/ChatPanel.tsx` — toggle + badge + round counter + concept picker + acid green theme

**Props extension:** accept optional cards list + initial mode/cardId (from dashboard click):

```typescript
interface Props {
  documentId: string
  cards?: Array<{ id: string; title: string }> // P-502: needed for concept picker
  initialMode?: 'default' | 'feynman'          // P-502: set by caller when user clicks "Feynman" button on card
  initialConceptCardId?: string                 // P-502: card user clicked
}
```

**New state hooks (add to existing useState block):**

```typescript
const [mode, setMode] = useState<'default' | 'feynman'>(initialMode ?? 'default')
const [conceptCardId, setConceptCardId] = useState<string | null>(initialConceptCardId ?? null)
const [round, setRound] = useState(1) // 1..3 in Feynman mode, unused in default
const [needConceptPicker, setNeedConceptPicker] = useState(false)
```

**Hydrate Feynman concept from localStorage on mount:**

```typescript
useEffect(() => {
  if (mode === 'feynman' && !conceptCardId) {
    const saved = loadFeynmanConcept(documentId)
    if (saved) setConceptCardId(saved)
  }
}, [documentId, mode, conceptCardId])
```

**Toggle handler:**

```typescript
const handleToggleMode = (nextMode: 'default' | 'feynman') => {
  if (nextMode === 'feynman') {
    const picked = conceptCardId ?? loadFeynmanConcept(documentId)
    if (!picked) {
      setNeedConceptPicker(true)
      return
    }
    startFeynmanSession(picked)
  } else {
    setMode('default')
    setRound(1)
    setNeedConceptPicker(false)
    clearFeynmanConcept(documentId)
  }
}
```

**Start Feynman session (injects opening template client-side — NO API call):**

```typescript
const startFeynmanSession = async (cardId: string) => {
  const card = cards?.find(c => c.id === cardId)
  const conceptTitle = card?.title ?? 'concept này'
  saveFeynmanConcept(documentId, cardId)
  setConceptCardId(cardId)
  setMode('feynman')
  setRound(1)
  setNeedConceptPicker(false)

  // Inject opening template as first assistant message (client-side only — NOT persisted to DB).
  const openingText = `Ok! Hôm nay tôi giả vờ là đứa bé lớp 5 chưa biết gì về **${conceptTitle}**. Hãy giải thích ${conceptTitle} cho tôi theo cách đơn giản nhất — như thể đang kể chuyện. Đừng dùng từ kỹ thuật, hãy dùng ví dụ đời thường nếu có. Tôi sẽ hỏi lại nếu chỗ nào tôi chưa hiểu. 🥋`

  const opening: ChatHistoryMessage = {
    id: newMessageId(),
    role: 'assistant',
    content: openingText,
    createdAt: Date.now(),
    mode: 'feynman',
  }
  setMessages(prev => [...prev, opening])
}
```

**Modify `send()` to include mode/conceptCardId/round in body + increment round after response:**

```typescript
async function send() {
  const text = input.trim()
  if (!text || phase === 'streaming' || phase !== 'ready') return
  // Feynman mode: block input after round 3
  if (mode === 'feynman' && round > 3) return
  hasInteractedRef.current = true

  // ... existing userMsg creation, setMessages, etc ...

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        message: text,
        history: historyForApi,
        anonId: getOrCreateAnonId() ?? 'anon-unknown',
        // P-502 extensions:
        mode,
        ...(mode === 'feynman' ? { conceptCardId, round } : {}),
      }),
      signal: controller.signal,
    })

    // ... existing stream reading logic unchanged ...

  } finally {
    // After successful round in Feynman mode, increment for next send
    if (mode === 'feynman' && round < 3) {
      setRound(prev => prev + 1)
    }
    // ... rest of finally block ...
  }
}
```

**UI additions (JSX):**

Above the scroll area, add mode toggle header:

```tsx
<div className={`border-b px-4 py-2 flex items-center justify-between ${mode === 'feynman' ? 'border-lime-300 bg-lime-50' : 'border-gray-200 bg-white'}`}>
  <div className="flex items-center gap-2 text-xs">
    {mode === 'feynman' && (
      <span className="font-mono text-lime-700">🥋 FEYNMAN DOJO • Round {Math.min(round, 3)}/3</span>
    )}
    {mode === 'default' && (
      <span className="font-mono text-gray-500">DEFAULT CHAT</span>
    )}
  </div>
  <div className="flex items-center gap-1.5 text-xs">
    <button
      className={`px-2 py-0.5 rounded ${mode === 'default' ? 'bg-pink-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
      onClick={() => handleToggleMode('default')}
    >Default</button>
    <button
      className={`px-2 py-0.5 rounded ${mode === 'feynman' ? 'bg-lime-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
      onClick={() => handleToggleMode('feynman')}
    >🥋 Feynman</button>
  </div>
</div>
```

Concept picker overlay (rendered when `needConceptPicker === true`):

```tsx
{needConceptPicker && (
  <div className="px-4 py-3 border-b border-lime-300 bg-lime-50">
    <p className="text-sm mb-2 text-gray-700">Bạn muốn ôn concept nào?</p>
    <div className="flex flex-wrap gap-2">
      {(cards ?? []).slice(0, 8).map(c => (
        <button
          key={c.id}
          className="px-3 py-1 text-xs rounded-full border border-lime-400 text-lime-800 hover:bg-lime-100"
          onClick={() => startFeynmanSession(c.id)}
        >🥋 {c.title}</button>
      ))}
      <button
        className="px-3 py-1 text-xs rounded-full text-gray-500"
        onClick={() => setNeedConceptPicker(false)}
      >Hủy</button>
    </div>
  </div>
)}
```

Bubble color accents in Feynman mode (user=lime, assistant=gray-50):

```tsx
<div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
  m.role === 'user'
    ? (m.mode === 'feynman' ? 'bg-lime-500 text-white' : 'bg-pink-500 text-white')
    : 'bg-gray-100 text-gray-900'
}`}>
```

Send button acid green when Feynman:

```tsx
<button
  type="submit"
  className={`px-4 py-2 text-white rounded-lg disabled:opacity-40 ${mode === 'feynman' ? 'bg-lime-500' : 'bg-pink-500'}`}
  disabled={phase !== 'ready' || input.trim().length === 0 || (mode === 'feynman' && round > 3)}
>
  {mode === 'feynman' && round > 3 ? 'Xong' : 'Gửi'}
</button>
```

Session-complete CTA (after round 3 verdict received):

```tsx
{mode === 'feynman' && round > 3 && (
  <div className="px-4 py-3 border-t border-lime-300 bg-lime-50 flex items-center justify-between text-xs">
    <span className="text-lime-800">🥋 Session hoàn tất!</span>
    <div className="flex gap-2">
      <button
        className="px-3 py-1 rounded border border-lime-500 text-lime-700 hover:bg-lime-100"
        onClick={() => { clearFeynmanConcept(documentId); setNeedConceptPicker(true) }}
      >Concept khác</button>
      <button
        className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
        onClick={() => handleToggleMode('default')}
      >Chat thường</button>
    </div>
  </div>
)}
```

**Note on placeholder text:**

```tsx
placeholder={mode === 'feynman' ? 'Giải thích concept cho DOJO...' : 'Hỏi DOJO điều gì đó về tài liệu...'}
```

### §8 — Dashboard integration (optional scope note)

To support Q2(a) "click card → Feynman", dashboard's card grid would need a "🥋 Feynman" button per card that routes to `/chat/[documentId]?mode=feynman&cardId=X`. **DEFER to a follow-up task or stretch goal** if time is tight — users can still use in-chat toggle + concept picker fallback (Q2b). If executor has time, add this button + wire query params via `useSearchParams` on chat page. Scope: ~30 LOC in dashboard + chat page.

**MVP without dashboard integration:** user goes to chat page → toggles Feynman → concept picker shows → pick card → session starts. This is adequate for demo. Dashboard wiring is nice-to-have.

---

## Acceptance criteria

### Core (required)

- [ ] **AC-1:** DB migration ran successfully in Supabase Dashboard. `\d chat_messages` shows `mode text not null default 'default'`. Existing rows auto-populated.
- [ ] **AC-2:** `FEYNMAN_SYSTEM_PROMPT` exported from `lib/ai/prompts.ts`. Existing `CHAT_SYSTEM_PROMPT` byte-for-byte unchanged.
- [ ] **AC-3:** `retrieveFeynmanContext(documentId, conceptCardId)` exported from `lib/ai/chat.ts`, loads card + raw_text snippet biased by card title, no embedding call.
- [ ] **AC-4:** `streamChatResponse` accepts `options: { mode, round }`, picks prompt + prompt builder based on mode. Default behavior preserved when options absent.
- [ ] **AC-5:** `/api/chat` route accepts `mode, conceptCardId, round` in body; validates `round ∈ {1,2,3}` for Feynman; skips embeddings pre-check when Feynman; persists `mode` col on both user + assistant inserts.
- [ ] **AC-6:** `/api/chat` cap constant bumped 50 → 100.
- [ ] **AC-7:** `/api/chat/history` returns `mode` field on each message.
- [ ] **AC-8:** `ChatPanel` has toggle UI (Default ⟷ 🥋 Feynman), acid green theme when Feynman active, mode badge + round counter displayed, concept picker fallback.
- [ ] **AC-9:** Feynman session opening message injected client-side only (not persisted to DB). Round counter advances 1 → 2 → 3 after each successful API response.
- [ ] **AC-10:** After round 3 response, input disabled + session-complete CTA shown ("Concept khác" + "Chat thường").
- [ ] **AC-11:** `npx tsc --noEmit` exit 0.

### Quality + testing

- [ ] **AC-12:** Protected-region grep on final diff returns zero matches for: `CHAT_SYSTEM_PROMPT` (should appear only as re-reference in chat.ts, not modified), `VIBEFY_SYSTEM_PROMPT`, `QUIZ_SYSTEM_PROMPT`, `VIDEO_STORYBOARD_SYSTEM_PROMPT`, `PlayResX`, `gradients=`, `XFADE_DURATION`, `GRADIENT_POOL`, `retrieveContext` (function signature — new sibling added, original untouched).
- [ ] **AC-13:** Local dev smoke — toggle Feynman, pick a card, explain something for round 1, verify DOJO responds with probe-style questions (not verdict). Round 2 response = deeper probe. Round 3 response = verdict.
- [ ] **AC-14:** Local dev smoke — default chat unchanged end-to-end (toggle off, send query, get RAG-grounded answer).
- [ ] **AC-15:** F5 reload on `/chat/[documentId]` mid-Feynman-session: round resets to 1 (by design — round is ephemeral client state), messages hydrate from DB + localStorage, Feynman concept restored from localStorage.

### Deploy

- [ ] **AC-16:** `vercel --prod --yes` redeploy successful, `X-Vercel-Id: sin1::sin1::` verified post-deploy.
- [ ] **AC-17 (User-runnable):** user prod browser E2E: toggle Feynman + pick concept + 3-round explanation flow + verdict displayed + can switch back to Default chat. No regression on default chat polling / hydration.

---

## Definition of Done

- All AC pass
- AGENT_LOG start + done entries
- Task status transitions: `spec` → `review` (executor PR) → `done` (after merge + redeploy + smoke)
- PR opened against `main` with title `P-502: Feynman Dojo Mode — dual-mode chat`
- No new deps (verify `package.json` + `package-lock.json` diff = 0 lines)
- DB migration applied to Supabase before PR merge (AC-1 gate)
- Post-merge: `cd vibeseek && npx tsc --noEmit && vercel --prod --yes` per deploy protocol
- SESSION_HANDOFF §Step 11 updated with post-P-502 status
- State snapshot created `memory/project_vibeseek_state_2026_04_XX_phase5_p502.md`
- Blueprint §13 P-502 entry prepended

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | DB migration not applied before PR merge | AC-1 is a gate. Architect review checks migration applied via `SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'mode'` before approving. |
| F-2 | `CHAT_SYSTEM_PROMPT` accidentally modified or deleted | AC-12 sentinel grep. Architect review line-by-line diff on prompts.ts. |
| F-3 | `retrieveContext` signature changed, breaks default chat | `retrieveFeynmanContext` is NEW function, not a modification. AC-4 + AC-14 verify default unchanged. |
| F-4 | `round` param off-by-one (client sends 1 vs server expects 0) | Server validates `round ∈ {1,2,3}`, returns 400 on violation. Client initializes `round=1` at session start, increments AFTER successful response. |
| F-5 | Opening template not persisted → lost on reload | Intentional (Q8 minimal tracking). Reconstructed from `loadFeynmanConcept(docId)` + card title lookup on hydrate. If localStorage cleared, user re-picks card, session restarts cleanly. |
| F-6 | LLM ignores FEYNMAN_SYSTEM_PROMPT round rules, gives verdict on round 1 | Prompt explicitly says "Round 1: KHÔNG đưa verdict" + "Round 3: FINAL — DỪNG LẠI". Temperature 0.7 gives some variance but rule is clear. If still misbehaves, tune prompt post-merge. |
| F-7 | Feynman session exceeds 60s maxDuration on round 3 verdict (context + history longest) | maxDuration = 60s is plenty; history of 3 rounds ≈ 2k tokens + 2k output = well within Gemini 2.0-flash throughput (~200 tokens/s). |
| F-8 | Gemini 2.0-flash retuses Feynman prompt (safety filter) | Fallback chain: 2.0-flash → 2.0-flash-lite → 2.5-flash → Groq llama-3.3-70b. FEYNMAN_SYSTEM_PROMPT is pedagogical, no safety trigger expected. |
| F-9 | `conceptCardId` points to card from different document (cross-doc attack) | `retrieveFeynmanContext` filters `card.document_id = documentId`; returns `concept_card_not_found` (404) otherwise. |
| F-10 | User toggles between modes mid-session, loses round progress | Expected + acceptable. Toggling to Default resets `round=1`, `conceptCardId=null`, clears `feynmanConcept` localStorage. User can re-pick card to restart. |
| F-11 | chat_messages cap 100 fills up fast with Feynman + default combined → eviction disrupts history | 100 rows × user's 1-2 docs × light use = ~weeks of use. Demo single-session: never hit. Monitor post-demo via Supabase dashboard. |
| F-12 | Acid green theme clashes with existing UI palette | Lime-500 + lime-50 + lime-300 border are Tailwind defaults close to `#bef264` acid in design tokens. If clashing, architect can nudge to `bg-lime-400` during review. |
| F-13 | Concept picker shows 0 cards (new document not yet processed) | Fallback: picker shows "Chưa có card nào. Quay lại dashboard để upload." + button to `/dashboard`. Rare edge case. |
| F-14 | Backward compat break: old clients send no `mode` → server should default to 'default' | Server default `mode = body.mode ?? 'default'`. Old clients work unchanged. |
| F-15 | localStorage quota filled → saveFeynmanConcept silently fails | Existing try/catch pattern in chat-history.ts. Feynman mode falls back to in-memory state for that session, lost on reload — acceptable degradation. |

---

## Local test plan

### Test 1 — Syntax + type check (30s)
```bash
cd D:/Wangnhat/Study/VibeCode/vibeseek
npx tsc --noEmit
```
Expected: exit 0.

### Test 2 — DB migration smoke (1min)
Apply migration in Supabase Dashboard SQL Editor. Verify:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages' AND column_name = 'mode';
-- Expected: mode | text | 'default'::text | NO

SELECT DISTINCT mode FROM chat_messages;
-- Expected: 'default' (all existing rows)
```

### Test 3 — Default chat regression (2min local dev)
1. `npm run dev`
2. Open `/chat/[someExistingDocId]`
3. Send normal query "Tóm tắt tài liệu"
4. Expected: RAG-grounded response, same format as pre-P-502.
5. F5 → history hydrates, last assistant msg shows.

### Test 4 — Feynman happy path (5min local dev)
1. Toggle Feynman → concept picker shows → pick card
2. Verify opening template injected as first assistant msg
3. Mode badge shows "🥋 FEYNMAN DOJO • Round 1/3"
4. Send user explanation → observe DOJO round-1 probe (not verdict)
5. Send refinement → observe round-2 deeper probe
6. Send final → observe round-3 verdict with affirm + review areas
7. Input disabled, CTA shown "Concept khác" + "Chat thường"
8. Click "Chat thường" → mode resets to default, toggle snaps back
9. F5 → history hydrates all Feynman messages persisted (minus opening template which is client-only)

### Test 5 — Edge cases (3min)
- Send round 4 via curl bypassing client (should 400)
- Send with `mode='invalid'` (should 400 invalid_mode)
- Send Feynman without conceptCardId (should 400)
- Send conceptCardId from different document (should 404 concept_card_not_found)
- Rate-limit: spam 11 Feynman msgs → 10×200 + 1×429 (same bucket as default chat)

### Test 6 — Prompt behavior check (10min, architect review — read 3 real-world transcripts)
Executor should record a transcript of 1 full Feynman session against real document + attach to PR description. Architect judges tone + round behavior + whether verdict is actually a verdict (not another probe).

---

## Non-goals (KHÔNG làm)

- KHÔNG tạo `feynman_sessions` table (Q8 answer = minimal)
- KHÔNG tích hợp leaderboard / vibe_points (defer Phase 6+)
- KHÔNG DOJO mascot 3D pose swap (out of 2-day scope)
- KHÔNG hỗ trợ > 3 rounds (fixed design)
- KHÔNG LLM auto-detect session end (fixed 3 rounds per Q4)
- KHÔNG SSML voice change for Feynman (chat is text only)
- KHÔNG add RLS policy change (service-role continues to cover new col)
- KHÔNG dashboard card "🥋 Feynman" button (scope note §8 — defer or executor stretch)
- KHÔNG multilingual support (Vietnamese only per current app)
- KHÔNG save Feynman session transcript as standalone artifact (concept card acts as anchor)
- KHÔNG add retry-to-round logic ("try round 2 again") — session proceeds linearly
- KHÔNG opening-template-per-card customization — same template, substitute title only

---

## Decisions log

- **D-1** `startFeynmanSession` implemented as a non-async function (spec shows `async` but no await calls inside). Simplified to sync to avoid stale closure with `round` state — cleaner and matches pattern of other toggle handlers in the file.
- **D-2** Round increment placed in `finally` block on condition `round <= 3` (not `round < 3` as spec shows `if (mode === 'feynman' && round < 3)`). Adjusted to `round <= 3` so the round advances from 3 → 4 after the final response, enabling the `round > 3` session-complete CTA and disabling the input. This is the correct behavior per AC-10.
- **D-3** `userMsg` in `send()` includes `mode: mode === 'feynman' ? 'feynman' : undefined` to carry mode through the client-side message list (enables mode-aware bubble color on user messages). Opening template message (client-only) also carries `mode: 'feynman'`.
- **D-4** Concept picker fallback shows "Chưa có card nào. Quay lại dashboard để upload." when `cards` prop is empty or undefined — covers F-13 edge case.
- **D-5** `handleToggleMode` is a const arrow function (not `async function`) per ChatPanel convention (existing `send` is the only async function in the component). Consistent with existing code style.
- **D-6** `retrieveFeynmanContext` placed after `pickSnippet` (which it calls) and before `buildUserPrompt` — maintains logical top-down read order: helpers first, prompt builders second, stream function last.
- **D-7** `buildFeynmanUserPrompt` placed after `buildUserPrompt` (its sibling) to group both prompt builders together before `StreamChunk` and `StreamOptions` interfaces.

---

## Notes for reviewer

### Dispatch model decision
- **Sonnet** per `feedback_dispatch_sub_agents_cost_aware.md` (user directive 2026-04-22): this task is pattern-heavy, scope ~200-220 LOC, spec-heavy-pre-audited, no novel algorithm. Sonnet comfortable. Opus 4.7 dispatch unjustified.
- Architect pre-audit + this spec = heavy context work done. Executor mostly translates spec to code.

### Key risk areas for review
1. **CHAT_SYSTEM_PROMPT untouched** — byte-for-byte verify via `git diff main vibeseek/lib/ai/prompts.ts` looking for ONLY additions after the existing prompt block.
2. **`retrieveContext` signature preserved** — verify no changes to existing function, only a NEW sibling `retrieveFeynmanContext`.
3. **Default mode end-to-end unchanged** — Test 3 must pass. No regression on current chat behavior.
4. **Round progression logic** — client state machine must increment AFTER response, not before. Edge case: if response fails, round shouldn't advance.

### Executor reminders
- **DB migration:** append to `supabase-schema.sql` at END (after existing T-407 block). User will apply in Supabase Dashboard before merging PR.
- **AGENT_LOG entries:** start + done per T-407 / P-501 pattern. Record any prompt-tuning decisions in Decisions log.
- **Commit style:** match existing commits (Co-Authored-By: Sonnet 4.6, descriptive body).
- **Scope discipline:** §8 dashboard integration is OPTIONAL. Only add if core AC-1..AC-17 complete and time remaining. Otherwise defer.
- **Protected-region grep** (AC-12) before committing — executor runs this themselves.
- **If scope creeps past ~300 LOC** in render.mjs or route.ts, pause + flag architect. Don't silently expand.

### Architect review gates
1. Migration applied in Supabase Dashboard (manual verify)
2. tsc clean
3. Protected-region grep clean
4. Local dev smoke: default chat unchanged, Feynman 3-round flow works
5. Prompt behavior transcript attached to PR (F-6 verify)
6. Post-merge: redeploy + AC-17 user browser smoke
