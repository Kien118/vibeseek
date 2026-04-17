# T-305 · `ChatPanel.tsx` + `/chat/[documentId]` page + dashboard link

**Status:** `todo`
**Severity:** HIGH (Phase 3 UX)
**Blueprint ref:** §2.5 chat flow, §6.6b/§6.7 APIs, §12 Q-09
**Branch:** `task/T-305-chat-panel-and-page`
**Assignee:** _(TBD)_
**Depends on:** T-301, T-302, T-304. **BLOCKED until T-304 merged.**

## Context

UI cho Phase 3: trang `/chat/[documentId]` với component `<ChatPanel>` consume SSE từ `/api/chat`. Ensure embeddings lần đầu qua `/api/embeddings/ensure`. Lưu history client-side (localStorage, Q-09). Link từ dashboard sang chat page, tương tự `/quiz/[documentId]` button đã có.

**Architect audit 2026-04-18 áp dụng:**
- Anon-id util export `getOrCreateAnonId()` (KHÔNG phải `getAnonId`) — returns `string | null`.
- Dashboard quiz button đã dùng gradient `indigo-500 → fuchsia-500` trong `rounded-full` pill. Chat button gradient `pink-500 → purple-500` cùng style pill cho consistency.

**Strict Mode rules (học từ Phase 2):**
- Effect dùng `let ignore = false` / `return () => { ignore = true }` canonical.
- List render dùng `key={msg.id}` để reset DOM instance nếu cần.
- Không `useRef` guard chống double-fire; chống duplicate ensure-call bằng idempotent server (đã có).

## Files to touch
- `vibeseek/components/ChatPanel.tsx` (NEW)
- `vibeseek/app/chat/[documentId]/page.tsx` (NEW)
- `vibeseek/app/dashboard/page.tsx` (MODIFY — add "💬 Chat với DOJO" link next to Quiz button)
- `vibeseek/utils/chat-history.ts` (NEW — localStorage helpers, SSR-safe)
- `tasks/T-305-chat-panel-and-page.md` (status)
- `AGENT_LOG.md`

## Files NOT to touch
- `vibeseek/app/api/chat/route.ts`, `/api/embeddings/ensure/route.ts` — T-302/T-304 scope (consume via fetch only)
- `vibeseek/lib/ai/*` — not touched from UI
- `vibeseek/supabase-schema.sql` — T-301 scope
- `vibeseek/app/layout.tsx` — không cần thay đổi cho chat page (VibePointsBadge auto-render)
- `vibeseek/components/VibePointsBadge.tsx` — không liên quan chat
- Existing components/pages không liệt kê trong "Files to touch"

## Architect's spec

### 1. `vibeseek/utils/chat-history.ts` — SSR-safe localStorage helpers

```ts
export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

const KEY_PREFIX = 'vibeseek:chat:'

export function loadHistory(documentId: string): ChatHistoryMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + documentId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m =>
      m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    )
  } catch {
    return []
  }
}

export function saveHistory(documentId: string, messages: ChatHistoryMessage[]): void {
  if (typeof window === 'undefined') return
  try {
    // Cap at 50 messages to avoid localStorage bloat
    const trimmed = messages.slice(-50)
    window.localStorage.setItem(KEY_PREFIX + documentId, JSON.stringify(trimmed))
  } catch {
    // quota exceeded or privacy mode — silently ignore
  }
}

export function clearHistory(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY_PREFIX + documentId)
  } catch {}
}

export function newMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
```

### 2. `vibeseek/components/ChatPanel.tsx` — main chat UI

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { getOrCreateAnonId } from '@/utils/anon-id' // architect audit 2026-04-18 — exact export name
import {
  loadHistory, saveHistory, newMessageId, type ChatHistoryMessage,
} from '@/utils/chat-history'

type Phase = 'ensuring' | 'ready' | 'ensure-error' | 'streaming'

interface Props {
  documentId: string
}

export default function ChatPanel({ documentId }: Props) {
  const [phase, setPhase] = useState<Phase>('ensuring')
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load history once on mount
  useEffect(() => {
    setMessages(loadHistory(documentId))
  }, [documentId])

  // Ensure embeddings on mount (idempotent)
  useEffect(() => {
    let ignore = false
    setPhase('ensuring')
    setEnsureError(null)

    fetch('/api/embeddings/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (ignore) return
        if (!res.ok) {
          setEnsureError(data.error || `HTTP ${res.status}`)
          setPhase('ensure-error')
          return
        }
        setPhase('ready')
      })
      .catch(err => {
        if (ignore) return
        setEnsureError(err instanceof Error ? err.message : String(err))
        setPhase('ensure-error')
      })

    return () => { ignore = true }
  }, [documentId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingId])

  // Persist history on change
  useEffect(() => {
    saveHistory(documentId, messages)
  }, [documentId, messages])

  async function send() {
    const text = input.trim()
    if (!text || phase === 'streaming' || phase !== 'ready') return

    const userMsg: ChatHistoryMessage = {
      id: newMessageId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    const assistantId = newMessageId()
    const historyForApi = messages.map(m => ({ role: m.role, content: m.content })) // keep full history; server trims

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() },
    ])
    setInput('')
    setStreamingId(assistantId)
    setPhase('streaming')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          message: text,
          history: historyForApi,
          anonId: getOrCreateAnonId() ?? 'anon-unknown',
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const errText = `Lỗi: ${errBody.error || res.status}${errBody.detail ? ' — ' + errBody.detail : ''}`
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errText } : m))
        return
      }

      if (!res.body) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: '⚠️ Không đọc được stream' } : m))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let done = false
      let assistantText = ''

      while (!done) {
        const { value, done: rDone } = await reader.read()
        done = rDone
        if (value) buf += decoder.decode(value, { stream: true })

        // Parse SSE events separated by \n\n
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const rawEvent = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const line = rawEvent.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.error) {
              assistantText += `\n\n⚠️ ${payload.error}`
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m))
              done = true
              break
            }
            if (payload.delta) {
              assistantText += payload.delta
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m))
            }
            if (payload.done) { done = true; break }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const msg = err instanceof Error ? err.message : String(err)
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m))
      }
    } finally {
      abortRef.current = null
      setStreamingId(null)
      setPhase('ready')
    }
  }

  // Cleanup: abort in-flight on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl shadow-sm border border-gray-200">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {phase === 'ensuring' && (
          <p className="text-gray-500 text-sm">⏳ Đang chuẩn bị bộ nhớ cho DOJO...</p>
        )}
        {phase === 'ensure-error' && (
          <div className="text-red-600 text-sm">
            ⚠️ Không chuẩn bị được embeddings: {ensureError}.
            <button
              className="ml-2 underline"
              onClick={() => window.location.reload()}
            >
              Thử lại
            </button>
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {m.content || (streamingId === m.id ? '...' : '')}
            </div>
          </div>
        ))}
      </div>
      <form
        className="border-t border-gray-200 p-3 flex gap-2"
        onSubmit={e => { e.preventDefault(); send() }}
      >
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
          placeholder="Hỏi DOJO điều gì đó về tài liệu..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={phase !== 'ready'}
          maxLength={2000}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-pink-500 text-white rounded-lg disabled:opacity-40"
          disabled={phase !== 'ready' || input.trim().length === 0}
        >
          Gửi
        </button>
      </form>
    </div>
  )
}
```

### 3. `vibeseek/app/chat/[documentId]/page.tsx`

```tsx
import Link from 'next/link'
import ChatPanel from '@/components/ChatPanel'

export const dynamic = 'force-dynamic'

interface Props {
  params: { documentId: string }
}

export default function ChatPage({ params }: Props) {
  const { documentId } = params
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💬 Chat với DOJO</h1>
        <Link href="/dashboard" className="text-sm text-pink-600 underline">← Về Dashboard</Link>
      </header>
      <ChatPanel documentId={documentId} />
      <p className="text-xs text-gray-500">
        DOJO chỉ trả lời dựa trên tài liệu bạn đã upload. Câu trả lời có thể sai — kiểm tra chéo với tài liệu gốc.
      </p>
    </main>
  )
}
```

### 4. `vibeseek/app/dashboard/page.tsx` — add chat link next to quiz button

**Architect audit 2026-04-18** — pattern quiz button hiện tại trong `app/dashboard/page.tsx` ~line 177-182:

```tsx
<Link
  href={`/quiz/${documentId}`}
  className="inline-block mt-2 px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
>
  🎯 Làm Quiz
</Link>
```

**Yêu cầu cụ thể:** wrap QUIZ button + CHAT button trong 1 div `flex flex-wrap gap-2 mt-2`, xoá `mt-2` khỏi className quiz button (đẩy lên parent). Chat button dùng gradient khác cho phân biệt (pink→purple thay indigo→fuchsia):

```tsx
{documentId && documentId !== 'local' && (
  <div className="flex flex-wrap gap-2 mt-2">
    <Link
      href={`/quiz/${documentId}`}
      className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
    >
      🎯 Làm Quiz
    </Link>
    <Link
      href={`/chat/${documentId}`}
      className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
    >
      💬 Chat với DOJO
    </Link>
  </div>
)}
```

**Agent phải:**
- Edit đúng block hiện có, KHÔNG tạo block mới song song.
- Giữ nguyên `{documentId && documentId !== 'local' && (...)}` guard.
- KHÔNG đổi structure parent `<div className="dashboard-result-header">`.

## Acceptance criteria

- [ ] **AC-1:** `vibeseek/components/ChatPanel.tsx` render: ensuring state → ready state → input + messages list.
- [ ] **AC-2:** `vibeseek/utils/chat-history.ts` exports `loadHistory`, `saveHistory`, `clearHistory`, `newMessageId`, type `ChatHistoryMessage`. All SSR-safe (`typeof window === 'undefined'` guard).
- [ ] **AC-3:** `vibeseek/app/chat/[documentId]/page.tsx` route chạy được (visit `/chat/<uuid>` → render page, không 404).
- [ ] **AC-4:** Dashboard thêm link "💬 Chat với DOJO" → `/chat/${doc.id}` cho mỗi doc. Không ảnh hưởng quiz button.
- [ ] **AC-5:** `cd vibeseek && npx tsc --noEmit` pass.
- [ ] **AC-6:** `cd vibeseek && npm run build` pass (tĩnh check dynamic route + client component boundary).
- [ ] **AC-7 (User-runnable):** E2E — upload PDF → cards tạo → dashboard → click "Chat với DOJO" → chat page load → gõ "Tóm tắt tài liệu đi" → text stream progressively → message lưu localStorage (reload page → message giữ nguyên).
- [ ] **AC-8 (User-runnable):** Reload nhiều lần → không sinh embeddings trùng (ensure idempotent server + client chỉ cần ensure 1 lần/load). Check DB `SELECT count(*) FROM card_embeddings WHERE document_id=...` — số không tăng.
- [ ] **AC-9 (User-runnable):** Strict Mode safe — dev mode (Strict Mode ON), mount chat page → check Network tab: `/api/embeddings/ensure` chỉ bắn 1 hoặc 2 lần (Strict Mode có thể fire 2 lần nhưng server idempotent → không side effect). Không có duplicate card_embeddings row.

## Definition of Done
- [ ] All AC pass, E2E smoothly
- [ ] AGENT_LOG.md start + done
- [ ] Task status → `review`
- [ ] PR opened
- [ ] Không có `console.log` debug sót (trừ `console.error` hợp lệ)

## Failure modes (defensive checklist)

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Strict Mode double-fire ensure → duplicate embeddings | Server idempotent (T-302 F-5). Client dùng `ignore` pattern, không `useRef` guard. |
| F-2 | User reload giữa stream → partial assistant message lưu localStorage | `saveHistory` chạy sau mỗi `setMessages` → partial text ok. Next load hiển thị text cũ + input lại hỏi. |
| F-3 | localStorage quota exceeded | `saveHistory` try/catch, cap 50 messages. |
| F-4 | SSE parse buffer chia sai khi chunk cắt giữa `\n\n` | Buffer string, tìm `\n\n` lặp — chỉ process hoàn chỉnh events. Partial giữ lại buffer. |
| F-5 | JSON.parse fail trên malformed line | Try/catch ignore line. |
| F-6 | AbortController leak khi unmount giữa stream | `useEffect cleanup abort()`. |
| F-7 | User spam submit → multiple fetch chồng | Button `disabled={phase !== 'ready'}`. `send` double-guard `phase === 'streaming' return`. |
| F-8 | `getAnonId()` SSR call → `ReferenceError: localStorage` | T-202 anon-id đã SSR-safe. Verify import path. |
| F-9 | Next.js hydration mismatch nếu messages render khác server vs client | ChatPanel là `'use client'`, ban đầu empty `messages = []`, server match. useEffect nạp từ localStorage sau mount. OK. |
| F-10 | Browser SSE doesn't support POST (EventSource is GET only) | Dùng `fetch` + `ReadableStream.getReader()` thay vì `EventSource` — đã làm đúng. |
| F-11 | Ensure error lúc mount → user không biết phải làm gì | `ensure-error` phase hiển thị message + nút "Thử lại" reload. |
| F-12 | User xóa doc (nếu có feature) → chat page stale | Ngoài scope MVP. Nếu xảy ra → 404 `no_cards_for_document` → ensure-error state. |
| F-13 | `key={m.id}` list — id unique? | `newMessageId` = crypto.randomUUID hoặc timestamp+random. Collision risk trivial. |
| F-14 | Streaming assistant message edit bằng map find → O(n) mỗi chunk | Msg list ≤50, chunks vài chục → acceptable. Không optimize. |
| F-15 | Ngôn ngữ error mix English với Vietnamese | Vẫn OK — user code/debug dùng English, UI-facing text Vietnamese. Spec này dùng cả 2 đúng vị trí. |

## Local test plan (20 phút — E2E)

### Test 1 — tsc + build
```bash
cd vibeseek && npx tsc --noEmit && npm run build
```

### Test 2 — Dev server + full E2E
```bash
cd vibeseek && npm run dev
```
Trong browser: http://localhost:3000/dashboard
- Nếu chưa có doc: upload 1 PDF nhỏ → chờ cards.
- Bấm "💬 Chat với DOJO" → load `/chat/<id>`.
- Chờ "⏳ Đang chuẩn bị..." chuyển "ready" (2–10s tuỳ số card).
- Gõ "Tóm tắt tài liệu đi" → Enter.
- Expected: text appear progressive (không dump 1 lần), < 30s complete, có `done` event.
- Mở DevTools Network → `/api/chat` response là `text/event-stream`, raw body có nhiều `data: {...}` blocks.

### Test 3 — History persistence
Trên chat page vừa test, reload (F5). Expected: messages cũ vẫn hiển thị (localStorage).

### Test 4 — Rate limit UI response
Trong DevTools Console:
```js
for (let i=0; i<12; i++) {
  fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({documentId:'<UUID>', message:'hi', history:[], anonId:'rl-ui'})
  }).then(r => console.log(i, r.status))
}
```
Expected: 10×200, 2×429.

### Test 5 — Strict Mode idempotent ensure
Dev mode Strict Mode ON. Hard-refresh chat page. Network tab → `/api/embeddings/ensure` 1-2 calls. Supabase Dashboard count không tăng lần nào sau lần đầu:
```sql
SELECT COUNT(*) FROM card_embeddings WHERE document_id = '<UUID>';
```

### Test 6 — Error state
Tạm set `DEBUG_FORCE_GEMINI_FAIL=true` → restart dev → truy cập chat page của doc chưa embed.
Expected: `ensure-error` phase hiển thị "⚠️ Không chuẩn bị được embeddings: embedding_unavailable" + nút "Thử lại".

### Test 7 — Mobile viewport
Chrome DevTools → iPhone 13 viewport → chat page. Input + message bubble không tràn, không bị VibePointsBadge đè.

## Non-goals (KHÔNG làm)
- KHÔNG persist chat vào DB — Q-09 chốt localStorage only.
- KHÔNG support attachment (image / file) — out of scope MVP.
- KHÔNG i18n switcher — tiếng Việt MVP.
- KHÔNG add chat vào landing page — chỉ dashboard + chat page.
- KHÔNG tạo `<ChatBadge />` đếm unread — không có concept unread.
- KHÔNG modify `<VibePointsBadge />` / layout.tsx — badge auto-render trên chat page.
- KHÔNG refactor dashboard layout — chỉ thêm 1 Link.
- KHÔNG dùng SSE client library (`event-source-parser` hoặc tương tự) — tự parse buffer, giữ bundle nhỏ.

## Questions / Blockers
_(none)_

## Decisions log
_(agent fills — đặc biệt note nếu dashboard grep miss, nếu anon-id import path khác spec)_

## Notes for reviewer
- **Phase 2 lessons applied:** canonical `ignore` pattern (F-1), `key={m.id}` on list (F-13 matches Phase 2 lesson 6), no `useRef` guard against Strict Mode (server idempotent instead), error state UX rõ ràng (F-11), AbortController cleanup (F-6).
- **Review MUST run E2E Test 2 + 3 + 5** on dev server với doc thật — không chỉ tsc.
- Bundle size check: `components/ChatPanel.tsx` nên <8KB minified (heuristic).
- Agent red flags: import `event-source-parser`, add Redux/Zustand store, tạo chat history server endpoint, modify VibePointsBadge.
- Verify animation smooth: text stream 40-char chunks không giật — nếu giật, Phase 4 có thể debounce setState batch.
