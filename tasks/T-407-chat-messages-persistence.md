# T-407 — `chat_messages` persistent DB (Q-09 reinstate)

> **Phase 5 · Status:** review · **Owner:** claude-opus-4-7 executor · **Dispatch:** after user duyệt spec
> **Base:** `main` (current tip `13c709b`) · **Expected PR diff:** 7 files (1 DDL + 2 API + 1 UI + 1 blueprint + task md + AGENT_LOG)

---

## Context

Phase 3 Q-09 (2026-04-17) deferred `chat_messages` DB table, MVP đi với localStorage client-only. Blueprint §5.2 (lines 377-388) để lại commented-out schema với comment `DEFERRED TO PHASE 4`. Phase 5 reinstate để:

1. **Cross-device sync** — user mở /chat/X trên device B (copy anon_id) thấy history device A.
2. **Future analytics** — count Q/A per doc, popular questions, unanswered patterns (không scope T-407, chỉ chuẩn bị data layer).
3. **Drop localStorage-only dependency** — F5 trong private mode / clear-storage user không mất history.

User approved 4 design calls (2026-04-20):

| ID | Decision | Why |
|---|---|---|
| Q-01 | **Hybrid** (localStorage = warm cache, DB = SSOT) | giữ UX Phase 3 đã verified (F-10 race-proof saveHistory), DB thêm cross-device mà không flash-of-empty |
| Q-02 | **Server-side save** trong `/api/chat` — user msg save trước stream, assistant msg save CHỈ khi `done=true AND tokensUsed > 0 AND assistantText.length > 0` | reliable kể cả client đóng tab; partial stream không persist rác |
| Q-03 | **Cap 50 per (anon_id, document_id)** — FIFO delete oldest | khớp `chat-history.ts` cap hiện tại; RAG chỉ dùng 6 msg gần nhất nên 50 thừa sức |
| Q-04 | **Soft abandon migration** — localStorage cũ vẫn đọc được, data MỚI mới save DB | MVP đồ án học tập, <5 active user, migration code dead-on-arrival |

---

## Files to touch (7)

1. `vibeseek/supabase-schema.sql` — **APPEND** §3 `chat_messages` DDL block (idempotent, service-role-only RLS)
2. `vibeseek/app/api/chat/route.ts` — **MODIFY** save user msg before stream open + save assistant msg + best-effort cap enforce after `done` event
3. `vibeseek/app/api/chat/history/route.ts` — **NEW** GET endpoint (query params `documentId` + `anonId`, returns last 50 ASC)
4. `vibeseek/components/ChatPanel.tsx` — **MODIFY** mount effect: fast-path localStorage → slow-path DB hydrate with `hasInteractedRef` guard + `send()` sets ref
5. `ARCHITECT_BLUEPRINT.md` — **MODIFY** §5.2 uncomment `chat_messages` block + §12 Q-09 → Resolved + §13 changelog entry + §2.5 note persistence = DB+localStorage hybrid
6. `tasks/T-407-chat-messages-persistence.md` — this file
7. `AGENT_LOG.md` — started + completed + architect close entries

---

## Files NOT to touch (protected regions)

### Phase 4 video invariants (grep sentinels, MUST return 0 lines):
- `vibeseek/scripts/render/render.mjs` — `PlayResX|splitNarrationLines|formatAssTime|speakable_narration|gradients=|\\fad`
- `vibeseek/lib/ai/processor.ts` — `OVERFLOW_RATIO|WORDS_PER_SECOND|speakable_narration`
- `vibeseek/lib/ai/prompts.ts` — `NGÂN SÁCH TỪ|PHIÊN ÂM CHO TTS|VIDEO_STORYBOARD_SYSTEM_PROMPT|CHAT_SYSTEM_PROMPT`

### Other protected:
- `vibeseek/lib/ai/chat.ts` — `streamChatResponse` generator UNTOUCHED (save logic goes in route.ts wrapper only)
- `vibeseek/lib/ai/embeddings.ts` + `lib/ai/quiz.ts` + `lib/ai/providers/groq.ts`
- `vibeseek/utils/anon-id.ts` + `utils/supabase.ts` (keep `noStoreFetch` wiring as-is)
- `vibeseek/utils/chat-history.ts` — reused AS-IS (cap 50, early-return empty, SSR guard); NO deprecation comment
- `vibeseek/lib/rate-limit.ts` — reused, only add new key pattern `chat-history:${anonId}` with separate bucket
- `vibeseek/components/VideoPlayer.tsx` + `components/DocumentHistory.tsx` + `components/QuizCard.tsx` + `components/LeaderboardTable.tsx` + `components/VibePointsBadge.tsx`
- `vibeseek/app/api/embeddings/**` + `app/api/quiz/**` + `app/api/leaderboard/**` + `app/api/vibefy/**` + `app/api/vibefy-video/**` + `app/api/render-callback/**` + `app/api/profile/**`
- Any file under `vibeseek/app/dashboard/` / `app/chat/[documentId]/` / `app/quiz/[documentId]/` / `app/leaderboard/`

Scope fence grep pre-merge:
```bash
git diff main -- vibeseek/scripts/ vibeseek/lib/ vibeseek/utils/chat-history.ts vibeseek/utils/anon-id.ts vibeseek/utils/supabase.ts vibeseek/lib/rate-limit.ts
# Expect: 0 lines (only new imports in route.ts allowed from lib/rate-limit + utils/supabase)
```

---

## Architect spec

### §1. DDL — append to `vibeseek/supabase-schema.sql` (idempotent)

```sql
-- =============================================================
-- Phase 5 (T-407) — chat_messages persistence
-- Reinstates Q-09 deferred table (blueprint §5.2). Service-role-only RLS
-- (privacy: anon A must not read anon B's chat via public API).
-- Run on Supabase Dashboard SQL Editor before merging this PR.
-- =============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index matches the hot query pattern:
--   SELECT ... WHERE document_id = $1 AND anon_id = $2 ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS chat_messages_doc_anon_created_idx
  ON chat_messages(document_id, anon_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Service-role only — no public read (unlike quiz_attempts / card_embeddings).
-- API routes use supabaseAdmin; browser never queries chat_messages directly.
DROP POLICY IF EXISTS "chat_messages service only" ON chat_messages;
CREATE POLICY "chat_messages service only" ON chat_messages
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### §2. API — `vibeseek/app/api/chat/route.ts` (MODIFY)

Insert 2 save blocks into the existing `ReadableStream.start` body. Full rewrite of the stream body only — validation + rate-limit + embedding check + retrieveContext blocks at top UNTOUCHED.

```typescript
// (unchanged imports + helpers + validation + rate-limit + embedding check + ctx retrieve)

// === NEW: cap enforcer helper (module-level, above `export async function POST`) ===
const CHAT_HISTORY_CAP = 50

async function enforceCap(docId: string, anonId: string): Promise<void> {
  const { count, error: countErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', docId)
    .eq('anon_id', anonId)

  if (countErr || !count || count <= CHAT_HISTORY_CAP) return

  const overflow = count - CHAT_HISTORY_CAP
  const { data: victims } = await supabaseAdmin
    .from('chat_messages')
    .select('id')
    .eq('document_id', docId)
    .eq('anon_id', anonId)
    .order('created_at', { ascending: true })
    .limit(overflow)

  if (!victims || victims.length === 0) return

  await supabaseAdmin
    .from('chat_messages')
    .delete()
    .in('id', victims.map(v => v.id))
}

// === MODIFIED: ReadableStream body ===
const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
    let assistantText = ''
    try {
      // Persist user message before opening stream (best-effort — don't block on failure)
      const userInsert = await supabaseAdmin.from('chat_messages').insert({
        document_id: documentId,
        anon_id: anonId,
        role: 'user',
        content: message.trim(),
      })
      if (userInsert.error) {
        console.warn('[chat] user msg persist failed', userInsert.error.message)
      }

      const gen = streamChatResponse(ctx, history, message)
      let tokensUsed = 0
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          tokensUsed = (value && 'tokensUsed' in value) ? value.tokensUsed : 0
          break
        }
        if (controller.desiredSize === null) {
          await gen.return?.(undefined as never)
          return
        }
        assistantText += value.delta
        controller.enqueue(sseEvent({ delta: value.delta }))
      }

      // Persist assistant message ONLY on successful completion with content.
      // Reaching here means while-loop broke on `done=true` (not `desiredSize===null` abort).
      if (tokensUsed > 0 && assistantText.length > 0) {
        const asstInsert = await supabaseAdmin.from('chat_messages').insert({
          document_id: documentId,
          anon_id: anonId,
          role: 'assistant',
          content: assistantText,
        })
        if (asstInsert.error) {
          console.warn('[chat] assistant msg persist failed', asstInsert.error.message)
        }

        // Best-effort cap enforce — don't block SSE close
        enforceCap(documentId, anonId).catch(err =>
          console.warn('[chat] enforceCap failed', err)
        )
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
```

### §3. API — `vibeseek/app/api/chat/history/route.ts` (NEW)

```typescript
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Separate rate-limit key from POST /api/chat so mount-time hydrate doesn't
// eat into the user's send budget. Higher limit since this is read-only.
const HISTORY_RATE_LIMIT = 30
const HISTORY_RATE_WINDOW_MS = 60_000
const HISTORY_FETCH_LIMIT = 50

function jsonError(status: number, code: string, detail?: string) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')
  const anonId = url.searchParams.get('anonId')

  if (!documentId) return jsonError(400, 'documentId_required')
  if (!anonId) return jsonError(400, 'anonId_required')

  const rl = consume(`chat-history:${anonId}`, HISTORY_RATE_LIMIT, HISTORY_RATE_WINDOW_MS)
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

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('document_id', documentId)
    .eq('anon_id', anonId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_FETCH_LIMIT)

  if (error) return jsonError(500, 'db_error', error.message)

  const messages = (data ?? []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
  }))

  return new Response(JSON.stringify({ messages }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### §4. UI — `vibeseek/components/ChatPanel.tsx` (MODIFY)

Replace the single load effect with a 2-layer hydrate effect + add `hasInteractedRef`. The persist effect (saveHistory) stays unchanged — continues writing-through to localStorage cache.

```typescript
// === Near other imports ===
import { getOrCreateAnonId, peekAnonId } from '@/utils/anon-id'

// === Inside component body, near other refs ===
const hasInteractedRef = useRef(false)

// === REPLACE existing "Load history once on mount" effect (lines 24-27) ===
// Hydrate strategy:
//   Fast path: paint localStorage cache immediately (no flash-of-empty).
//   Slow path: fetch DB authoritative history; replace cache if user hasn't
//              interacted yet. localStorage is write-through cache for next mount.
useEffect(() => {
  let ignore = false
  hasInteractedRef.current = false  // reset per doc (route change may not remount)
  const cached = loadHistory(documentId)
  if (cached.length > 0) setMessages(cached)

  const anonId = peekAnonId()
  if (!anonId) return () => { ignore = true }

  const qs = new URLSearchParams({ documentId, anonId }).toString()
  fetch(`/api/chat/history?${qs}`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (ignore) return
      if (hasInteractedRef.current) return  // user already typed — don't clobber
      if (data && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages)
        saveHistory(documentId, data.messages)  // write-through cache
      }
    })
    .catch(err => {
      console.warn('[chat] history fetch failed, using localStorage cache', err)
    })

  return () => { ignore = true }
}, [documentId])

// === MODIFY send() — first line inside the function ===
async function send() {
  const text = input.trim()
  if (!text || phase === 'streaming' || phase !== 'ready') return
  hasInteractedRef.current = true  // NEW — lock out DB hydrate overwrite
  // ... rest unchanged
}
```

Everything else in `ChatPanel.tsx` UNTOUCHED (ensure-embeddings effect, persist effect, scroll effect, abort cleanup, JSX).

### §5. Blueprint updates — `ARCHITECT_BLUEPRINT.md`

1. **§5.2** — uncomment the `CREATE TABLE chat_messages` + index block; update comment from `DEFERRED TO PHASE 4` → `Enabled in Phase 5 T-407 (2026-04-20)`. Match the DDL shape in spec §1 exactly (the existing commented block has slightly different columns — use the final spec version).
2. **§2.5** — update the "History persistence" paragraph:
   ```
   History persistence: DB + localStorage hybrid (Phase 5 T-407).
   - DB (chat_messages) = SSOT, source for cross-device hydrate on mount.
   - localStorage = warm cache; survives between DB fetches, prevents flash-of-empty.
   - Server-side save in /api/chat (user msg before stream, assistant msg only on done=true with content).
   - Cap 50 per (anon_id, document_id), FIFO delete via best-effort async enforce.
   ```
3. **§12 Open Questions** — move Q-09 entry to Resolved section with note: `Resolved 2026-04-20 (T-407): reinstated as hybrid DB + localStorage cache per Q-01/Q-02/Q-03/Q-04 design approval.`
4. **§13 Changelog** — add new entry at top:
   ```
   ### 2026-04-20 — T-407 chat_messages persistence (Phase 5)
   - Reinstated chat_messages table (Q-09 resolved hybrid).
   - API: /api/chat saves user + assistant msgs; new GET /api/chat/history for cross-device hydrate.
   - UI: ChatPanel 2-layer hydrate (localStorage fast + DB slow), hasInteractedRef guard.
   - Cap 50 per (anon_id, doc_id), service-role-only RLS.
   ```

---

## Acceptance criteria

| AC | Description | Verify by |
|---|---|---|
| AC-1 | DDL idempotent: apply twice in SQL Editor, both succeed, table exists | User Dashboard SQL Editor (§User test plan Test 1) |
| AC-2 | RLS service-role-only: anon client SELECT returns empty; supabaseAdmin INSERT+SELECT work | Architect one-off node script during review (§Local test plan Test 2) — not committed |
| AC-3 | `/api/chat` imports `supabaseAdmin` from `@/utils/supabase` (no new client instantiation) | `git diff` grep |
| AC-4 | POST `/api/chat` saves user row BEFORE opening stream (verify row appears within 100ms of POST start) | Test 3 curl + SQL |
| AC-5 | POST `/api/chat` saves assistant row ONLY when `done=true` AND `tokensUsed > 0` AND `assistantText.length > 0` | Test 4 (abort mid-stream) + SQL |
| AC-6 | POST `/api/chat` enforces cap 50: after 51st persisted msg, row count stabilizes at 50, oldest dropped | Test 6 curl + SQL |
| AC-7 | GET `/api/chat/history?documentId=X&anonId=Y` returns `{messages: [{id, role, content, createdAt}]}` ordered ASC by created_at | Test 5 curl |
| AC-8 | GET endpoint returns 400 on missing `documentId` OR `anonId` | Test 5b curl |
| AC-9 | GET endpoint rate-limit uses separate key `chat-history:${anonId}` (30/60s); does NOT decrement POST `/api/chat` budget | Test 7 curl |
| AC-10 | ChatPanel mount: localStorage cache paints first; DB fetch replaces cache if DB non-empty | User E2E (§User test plan Test 8) |
| AC-11 | `hasInteractedRef.current = true` inside `send()` first line; DB hydrate promise resolves post-typing skips setMessages | Code review + Test 9 |
| AC-12 | `saveHistory(documentId, messages)` persist effect remains unchanged; writes-through DB hydrate result to localStorage | Code review |
| AC-13 | Blueprint §5.2 uncommented + §12 Q-09 Resolved + §13 changelog + §2.5 note | `git diff ARCHITECT_BLUEPRINT.md` |
| AC-14 | `npx tsc --noEmit` exit 0 | Architect review |
| AC-15 | Protected-region grep (see Files NOT to touch) returns 0 lines | Architect review |
| AC-16 | **User-runnable E2E:** send 2 msgs, hard F5 reload, messages reappear from DB (verify with DevTools Network tab showing `/api/chat/history` 200) | User browser test |
| AC-17 | **User-runnable E2E:** copy anon_id to incognito window, open `/chat/<documentId>` same doc — messages from original session appear | User browser test |

---

## Failure modes (15)

| # | Mode | Defense |
|---|---|---|
| 1 | Race: DB hydrate lands after user typed → DB overwrites user msg | `hasInteractedRef.current` guard set in `send()` first line |
| 2 | User-msg DB save fails (DB down) before stream | `console.warn` + continue; stream opens normally; msg shown in UI (cached locally after), next reload missing |
| 3 | Partial assistant stream (abort, 503, client close) | Gate on `tokensUsed > 0 && assistantText.length > 0`; partial = not persisted |
| 4 | Cap enforcement runs concurrent with another POST → over-delete | Acceptable: cap is soft, `enforceCap` selects by oldest + deletes by id |
| 5 | Next.js fetch cache poisoning on GET history | `supabaseAdmin` already wired `noStoreFetch` (Phase 2 F-5 preempted) |
| 6 | Strict Mode double-fire hydrate effect → second fire wipes user msg | Canonical `let ignore = false` + `hasInteractedRef` double-guard |
| 7 | `peekAnonId()` returns null (private mode, SSR) | Skip DB fetch, localStorage-only mode; log nothing |
| 8 | Existing user with localStorage data, first chat after T-407 deploy | DB empty → hydrate skip apply, localStorage keeps showing; new msgs start persisting DB forward (soft abandon per Q-04) |
| 9 | RLS misconfig denies service-role INSERT | `auth.role() = 'service_role'` policy pattern verified against existing `card_embeddings`/`quiz_attempts`; Test 2 catches this |
| 10 | `document_id` FK violation (doc deleted mid-chat) | Insert fails with 23503; warn log; stream continues; row not saved (acceptable) |
| 11 | Duplicate save on double-POST (user spam-clicks Send before state transitions) | Existing `phase === 'streaming'` guard blocks double-send; no defense needed server-side |
| 12 | GET /api/chat/history 429 on every mount (rate limit exhaust shared bucket) | Separate key `chat-history:${anonId}`, 30/60s — 3× normal `/api/chat` POST budget |
| 13 | Very long assistant message (>8192 chars from maxOutputTokens=2048 × ~4 chars/token) | DB TEXT column unlimited; API route streams chunks but `assistantText` accumulator OK up to ~10k |
| 14 | Client closes tab mid-stream (`controller.desiredSize === null`) | Existing `gen.return + return` path; user msg already saved; assistant skipped (desired) |
| 15 | GET history returns empty array but localStorage has cache | Skip apply (`data.messages.length > 0` condition); localStorage cache shows unchanged |

---

## Local test plan (7 tests, user-runnable)

> Prerequisites: dev server running (`cd vibeseek && npm run dev`), DDL from §1 applied in Supabase Dashboard SQL Editor, replace `$DOC_ID` with a real `vibe_documents.id` that has `card_embeddings` rows, replace `$ANON_ID` with a fixed literal UUID (e.g. `11111111-2222-3333-4444-555555555555`). Wait 60s between rate-limit test re-runs (Phase 3 lesson — bucket TTL).

### Test 1 — DDL idempotent (user Dashboard)
Paste §1 DDL into Supabase SQL Editor, run. Verify: `chat_messages` table appears in Tables, index `chat_messages_doc_anon_created_idx` in Indexes, policy `chat_messages service only` in Policies. Re-run same SQL — all statements succeed (CREATE IF NOT EXISTS, DROP POLICY IF EXISTS → CREATE).

### Test 2 — RLS smoke (architect review, NOT committed)
Architect runs this one-off during review via `npx tsx -e "..."` or a temp file that gets `git clean`-ed. Executor does NOT ship this.
```typescript
// Run once during architect review (temp file or inline tsx -e):
import { supabaseAdmin, supabase } from '@/utils/supabase'
const DOC = '$DOC_ID', ANON = '$ANON_ID'
// Admin INSERT
const ins = await supabaseAdmin.from('chat_messages').insert({
  document_id: DOC, anon_id: ANON, role: 'user', content: 'rls-smoke',
})
console.log('admin insert:', ins.error ? `FAIL ${ins.error.message}` : 'OK')
// Anon SELECT — must return []
const anon = await supabase.from('chat_messages').select('*').eq('anon_id', ANON)
console.log('anon select:', anon.data?.length === 0 ? 'OK (blocked)' : 'FAIL (leaked)')
// Cleanup
await supabaseAdmin.from('chat_messages').delete().eq('anon_id', ANON).eq('content', 'rls-smoke')
```
Expected: `admin insert: OK`, `anon select: OK (blocked)`.

### Test 3 — Happy path send + DB persist
```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC_ID\",\"message\":\"Test T-407\",\"history\":[],\"anonId\":\"$ANON_ID\"}"
```
Expected: SSE stream with `data: {"delta":...}` chunks + final `data: {"done":true,"tokensUsed":N}`.

SQL verify:
```sql
SELECT role, LEFT(content, 40) AS preview, created_at
FROM chat_messages
WHERE document_id = '$DOC_ID' AND anon_id = '$ANON_ID'
ORDER BY created_at ASC;
```
Expected: 2 rows — first `user` (`Test T-407`), second `assistant` (response text).

### Test 4 — Abort mid-stream (partial skip)
```bash
# curl --max-time 0.5 works on Git Bash Windows; `timeout` command portability varies
curl --max-time 0.5 -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC_ID\",\"message\":\"Abort test\",\"history\":[],\"anonId\":\"$ANON_ID\"}" || true
```
SQL verify:
```sql
SELECT role, content FROM chat_messages
WHERE anon_id = '$ANON_ID' AND content LIKE '%Abort test%' OR content LIKE '%answer%'
ORDER BY created_at DESC LIMIT 5;
```
Expected: `user` row with `Abort test` exists; NO `assistant` row for this turn (or if Gemini was too fast, may complete — re-run with shorter timeout if needed).

### Test 5 — GET history
```bash
curl "http://localhost:3000/api/chat/history?documentId=$DOC_ID&anonId=$ANON_ID" | jq
```
Expected: `{"messages":[{"id":"...","role":"user","content":"...","createdAt":...}, ...]}` ordered ASC by createdAt.

### Test 5b — GET history validation
```bash
curl -i "http://localhost:3000/api/chat/history?anonId=$ANON_ID"
# Expected: HTTP 400 {"error":"documentId_required"}
curl -i "http://localhost:3000/api/chat/history?documentId=$DOC_ID"
# Expected: HTTP 400 {"error":"anonId_required"}
```

### Test 6 — Cap enforce (architect review, NOT committed)
Architect pre-seeds 51 rows via inline `npx tsx -e` or temp script (same pattern as Test 2 — do NOT commit). Example seed:
```typescript
// Inline: npx tsx -e "..."
import { supabaseAdmin } from '@/utils/supabase'
const DOC = '$DOC_ID', ANON = '$ANON_ID'
const rows = Array.from({ length: 51 }, (_, i) => ({
  document_id: DOC, anon_id: ANON, role: i % 2 === 0 ? 'user' : 'assistant',
  content: `seed-${i}`,
  created_at: new Date(Date.now() - (52 - i) * 1000).toISOString(),
}))
await supabaseAdmin.from('chat_messages').insert(rows)
```
Then POST one more via Test 3. After ~500ms async settle:
```sql
SELECT COUNT(*) FROM chat_messages
WHERE document_id = '$DOC_ID' AND anon_id = '$ANON_ID';
```
Expected: count = 50 (oldest dropped).

### Test 7 — Rate limit isolation
```bash
# Use fixed literal key (NOT Date.now()) per Phase 3 lesson — wait 60s since last Test 5 run
for i in {1..31}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3000/api/chat/history?documentId=$DOC_ID&anonId=rate-test-11111"
done | tail -5
```
Expected: first 30 return `200`, 31st returns `429`. Separately: POST `/api/chat` with same `anonId=rate-test-11111` still returns 200 (separate bucket).

### Test 8 — User E2E hydrate (browser)
1. Open `http://localhost:3000/chat/$DOC_ID` fresh incognito.
2. Send 2 msgs: "Câu 1" + "Câu 2". Wait for both responses.
3. DevTools → Application → Local Storage — verify `vibeseek:chat:$DOC_ID` has 4 entries.
4. Hard F5 (Ctrl+Shift+R).
5. **Expected:** messages reappear. DevTools → Network tab shows `/api/chat/history` request with 200 returning 4 messages.

### Test 9 — Interaction race (browser, no code mod)
1. DevTools → Network tab → throttle dropdown → **Slow 3G** (delays all network ~2s round-trip).
2. Hard F5 (Ctrl+Shift+R). GET `/api/chat/history` pending in Network tab (~2s).
3. WHILE the request is still pending, type "Race msg" and click Gửi.
4. **Expected:** typed message stays visible after `/api/chat/history` resolves — UI does NOT revert to DB-only state. Verify local state has: [...DB_messages, user's "Race msg", assistant response]. Reset throttle to "No throttling" after test.
5. **Regression signal:** if the typed msg disappears when history request completes → `hasInteractedRef` guard missing/broken.

---

## Non-goals

- **Real-time cross-device sync** — MVP: hydrate only on mount. Active session stays local. User must F5 / open new tab to sync.
- **Client sends `userMsgId` / `assistantMsgId`** — server generates IDs (gen_random_uuid). Merge-by-id in hydrate is best-effort via `hasInteractedRef` guard, not strict ID matching.
- **Offline queue** — if DB is down at POST time, user msg doesn't persist; no retry-on-reconnect. Acceptable for MVP.
- **Delete / edit message API** — not in scope. User can only wipe via `clearHistory()` localStorage (which doesn't touch DB). Admin cleanup via SQL only.
- **Chat export / analytics** — schema supports it but no endpoints in T-407.
- **Migration of existing localStorage → DB** — Q-04 soft abandon.
- **Rate-limit upgrade to Redis** — orthogonal; deferred until T-406 Vercel deploy needs cross-instance consistency.

---

## Decisions log (executor fills during implementation)

- D-1: **No deviation from spec §1..§5.** All 4 code edits + schema append applied byte-for-byte from the pre-audited spec. No new exports, no new deps, no changes to protected regions.
- D-2: **Rate-limit signature verified at implementation time.** `consume(key, limit, windowMs)` signature in `vibeseek/lib/rate-limit.ts` confirmed to accept positional args as spec §3 calls it (`consume(\`chat-history:${anonId}\`, 30, 60_000)`) — no rate-limit module edit needed.
- D-3: **CHAT_HISTORY_CAP placed as module-level const above `export async function POST`** (spec §2 wording), with an inline TODO-style comment tying it to T-407. `enforceCap` uses `supabaseAdmin` already imported (no new import).
- D-4: **`assistantText` accumulator placed inside `start(controller)` scope** (not module-level) to reset per stream — avoids leak across concurrent POSTs. Matches spec §2 literal code block.
- D-5: **Task file was untracked at start of session.** `tasks/T-407-chat-messages-persistence.md` arrived as ?? in `git status` (architect dropped the spec, executor picked it up on this branch). Included in PR diff (file #6 of 7).
- D-6: **AGENT_LOG `## 2026-04-20` section already existed** (contained the T-406 deferred Vercel entry — last line of file). Appended two new bullets under that same section chronologically, per Phase 4 Lesson 16 format (`- **HH:MM** [T-407] claude-opus-4-7 executor <event>. <note>`).

---

## Dependencies

- Supabase Dashboard SQL Editor access (user-runnable, architect can't)
- `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already present per Phase 3)
- `card_embeddings` rows for test `$DOC_ID` (existing from any previously-uploaded PDF)

## DoD

- [ ] All 17 AC pass
- [ ] Spec's 15 failure modes each have code-level defense
- [ ] Protected-region grep returns 0 lines
- [ ] `npx tsc --noEmit` exit 0
- [ ] No smoke files committed (RLS verify = architect review step, not executor artifact)
- [ ] Task md + AGENT_LOG entries (started + completed)
- [ ] PR opened with title `T-407: chat_messages persistence (Q-09 reinstate)`
- [ ] User SQL Dashboard Test 1 applied before architect merge
