# T-405 · Dashboard persistence + leaderboard back-link (client-side)

**Status:** `review`
**Severity:** MEDIUM (Phase 5 UX — demo blocker)
**Blueprint ref:** surfaced in Phase 4 E2E smoke (2026-04-19) — dashboard state loss on reload/navigation + populated leaderboard missing back-link
**Branch:** `task/T-405-dashboard-persistence`
**Assignee:** _(TBD)_
**Depends on:** none — client-side only, no DB migration.

## Context

**Current state (main `d8d7938`):**
- `app/dashboard/page.tsx` uses `useState` for `file`, `cards`, `documentId`, `currentJobId` — all component-local. Unmount/reload → state resets → user sees empty form.
- After upload/analyze, `documentId` exists only in client memory. Navigating to `/quiz/<id>` or `/chat/<id>` leaves dashboard; coming back loses state.
- `app/leaderboard/page.tsx` has "Về Dashboard" CTA **only in empty-state branch** (line 81-86). Once populated, table replaces empty state — no back navigation available. User must use browser back or VibePointsBadge (which links TO /leaderboard, useless when already there).
- `vibe_documents` table has `user_id REFERENCES auth.users` — unused (no auth); no `anon_id` column → server-side per-user list not possible without migration.

**Architect decision 2026-04-19:** A1 client-side localStorage history chosen over A2 server-side anon_id migration. Rationale:
- MVP đồ án học tập — cross-device persistence not required
- Pattern already exists (`utils/chat-history.ts` from T-305) → consistency
- Zero DB migration, <150 LOC total
- A2 upgrade path available when Phase 6+ wires Supabase Auth

**Trade-off accepted:** clearing browser localStorage wipes doc list. DB still has docs (accessible if user remembers UUID). Acceptable for MVP.

## Files to touch
- `vibeseek/utils/doc-history.ts` (NEW) — localStorage helper (pattern from `utils/chat-history.ts`)
- `vibeseek/components/DocumentHistory.tsx` (NEW) — list UI with per-doc Quiz/Chat links + remove-from-history button
- `vibeseek/app/dashboard/page.tsx` (MODIFY) — read history on mount, persist after successful upload, render `<DocumentHistory />` above existing form
- `vibeseek/app/leaderboard/page.tsx` (MODIFY) — add "← Về Dashboard" link in header (above existing title)
- `tasks/T-405-dashboard-persistence.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `supabase-schema.sql` — NO DB migration
- `vibeseek/app/api/**` — NO new API endpoint, NO server changes
- `vibeseek/components/VideoPlayer.tsx` — defer resume-on-mount to Phase 6+ (user workaround = Supabase video_url direct)
- `vibeseek/utils/chat-history.ts` — preserved pattern (do NOT refactor into shared helper; keep them parallel)
- `vibeseek/utils/anon-id.ts` — preserved
- `vibeseek/lib/**` — unrelated
- Any error.tsx / not-found.tsx (T-401 scope)
- Any render/storyboard file (Phase 4 scope)
- `package.json` — NO new deps

## Architect's spec

### 1. `vibeseek/utils/doc-history.ts` — SSR-safe localStorage helper

Copy the shape + SSR-guard pattern from `utils/chat-history.ts`. 4 exported functions + 1 type.

```typescript
export interface DocHistoryEntry {
  documentId: string
  title: string
  createdAt: number
}

const KEY = 'vibeseek:docs'
const MAX_ENTRIES = 20

export function loadDocHistory(): DocHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (d) =>
        d &&
        typeof d.documentId === 'string' &&
        d.documentId.length > 0 &&
        d.documentId !== 'local' &&
        typeof d.title === 'string' &&
        typeof d.createdAt === 'number',
    )
  } catch {
    return []
  }
}

export function addDocToHistory(entry: DocHistoryEntry): void {
  if (typeof window === 'undefined') return
  // Skip invalid entries — parser-side defense
  if (!entry.documentId || entry.documentId === 'local' || !entry.title) return
  try {
    const current = loadDocHistory()
    // Dedupe by documentId — newer entry replaces older
    const filtered = current.filter((d) => d.documentId !== entry.documentId)
    // Most-recent-first, cap at MAX_ENTRIES
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // quota exceeded or privacy mode — silent ignore (match chat-history pattern)
  }
}

export function removeDocFromHistory(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    const filtered = loadDocHistory().filter((d) => d.documentId !== documentId)
    window.localStorage.setItem(KEY, JSON.stringify(filtered))
  } catch {}
}

export function clearDocHistory(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {}
}
```

**Invariants:**
- `documentId === 'local'` filtered out (legacy non-Supabase fallback that existed in some flows)
- Dedupe by `documentId` — uploading same doc twice = 1 entry, title updated
- Max 20 entries, most-recent-first — prevent localStorage bloat

### 2. `vibeseek/components/DocumentHistory.tsx` — list UI

Purely presentational. Props: `entries: DocHistoryEntry[]` + `onRemove: (id: string) => void`.

```tsx
'use client'

import Link from 'next/link'
import type { DocHistoryEntry } from '@/utils/doc-history'

function formatRelative(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`
  return new Date(timestamp).toLocaleDateString('vi-VN')
}

interface Props {
  entries: DocHistoryEntry[]
  onRemove: (documentId: string) => void
}

export default function DocumentHistory({ entries, onRemove }: Props) {
  if (entries.length === 0) return null
  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Tài liệu gần đây</h2>
        <span className="text-xs text-white/40 font-mono">{entries.length}/20</span>
      </div>
      <ul className="space-y-2">
        {entries.map((doc) => (
          <li
            key={doc.documentId}
            className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate" title={doc.title}>
                {doc.title}
              </p>
              <p className="text-xs text-white/50 font-mono">{formatRelative(doc.createdAt)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/quiz/${doc.documentId}`}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold hover:opacity-90"
              >
                🎯 Quiz
              </Link>
              <Link
                href={`/chat/${doc.documentId}`}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90"
              >
                💬 Chat
              </Link>
              <button
                onClick={() => onRemove(doc.documentId)}
                className="px-2 py-1.5 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 text-xs"
                title="Xóa khỏi danh sách (không xóa trong DB)"
                aria-label={`Xóa ${doc.title} khỏi danh sách`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-white/40">
        Danh sách lưu local trên trình duyệt. Xóa cookies/localStorage sẽ reset.
      </p>
    </section>
  )
}
```

**Explicit colors** (Phase 3 F-1 preempt): every text node has `text-white*` class. No default color inherit.

### 3. `vibeseek/app/dashboard/page.tsx` — wire history

Changes (additive, minimal-churn):

(a) Imports:
```tsx
import DocumentHistory from '@/components/DocumentHistory'
import {
  loadDocHistory,
  addDocToHistory,
  removeDocFromHistory,
  type DocHistoryEntry,
} from '@/utils/doc-history'
```

(b) State + effect at top of `DashboardPage()`:
```tsx
const [docHistory, setDocHistory] = useState<DocHistoryEntry[]>([])

useEffect(() => {
  setDocHistory(loadDocHistory())
}, [])
```

(c) After successful upload in `handleAnalyzePdf`, persist the new doc. Insert right after `setDocumentId(payload.documentId ?? null)` (currently line 82):
```tsx
setDocumentId(payload.documentId ?? null)
if (payload.documentId && payload.documentId !== 'local') {
  const entry: DocHistoryEntry = {
    documentId: payload.documentId,
    title: title || file.name.replace(/\.pdf$/i, ''),
    createdAt: Date.now(),
  }
  addDocToHistory(entry)
  setDocHistory(loadDocHistory())
}
```

(d) Remove handler:
```tsx
const handleRemoveFromHistory = (documentId: string) => {
  removeDocFromHistory(documentId)
  setDocHistory(loadDocHistory())
}
```

(e) Render — insert `<DocumentHistory />` between the form section and the empty-state section. Current JSX structure (lines 133-179):
```
<section className="dashboard-form glass">...</section>
{cards.length === 0 && ... && <section className="dashboard-empty-state ...">...</section>}
```

Change to:
```tsx
<section className="dashboard-form glass">...</section>

<DocumentHistory entries={docHistory} onRemove={handleRemoveFromHistory} />

{docHistory.length === 0 && cards.length === 0 && !isProcessing && !isGeneratingVideo && !currentJobId && (
  <section className="dashboard-empty-state glass text-center p-12 space-y-4">
    ...
  </section>
)}
```

**Empty-state condition update:** add `docHistory.length === 0` as first clause. Rationale: if user has any docs in localStorage, they're not "new" — 📚 empty prompt is misleading.

### 4. `vibeseek/app/leaderboard/page.tsx` — add back-link

Current header (lines 47-50):
```tsx
<header className="space-y-2">
  <p className="text-white/50 font-mono uppercase text-xs">VibeSeek Leaderboard</p>
  <h1 className="font-display text-4xl">Top vibe</h1>
</header>
```

Change to:
```tsx
<header className="space-y-2">
  <Link
    href="/dashboard"
    className="inline-block text-sm text-white/60 hover:text-white transition-colors"
  >
    ← Về Dashboard
  </Link>
  <p className="text-white/50 font-mono uppercase text-xs">VibeSeek Leaderboard</p>
  <h1 className="font-display text-4xl">Top vibe</h1>
</header>
```

**Note:** `Link` import already present (line 4 — used by empty-state CTA). No new import needed.

Back-link visible **always** (populated AND empty state), since empty-state already has its own "Về Dashboard" button further down. Redundancy acceptable — header link is for navigation habit, empty-state button is for first-time-user guidance.

## Acceptance criteria

- [ ] **AC-1:** `utils/doc-history.ts` exports `loadDocHistory`, `addDocToHistory`, `removeDocFromHistory`, `clearDocHistory`, and type `DocHistoryEntry`. All SSR-safe (`typeof window === 'undefined'` guard).
- [ ] **AC-2:** `loadDocHistory` returns `[]` on invalid JSON / non-array / empty localStorage. Dedupes invalid-shape entries.
- [ ] **AC-3:** `addDocToHistory` dedupes by `documentId` (newer replaces older), caps at 20 most-recent-first, silently ignores `documentId === 'local'` or empty strings.
- [ ] **AC-4:** `components/DocumentHistory.tsx` renders list with title, relative time ("X phút trước" / "X giờ trước" / "X ngày trước" / date for >7d), Quiz + Chat links, remove ✕ button. Returns `null` if empty.
- [ ] **AC-5:** `app/dashboard/page.tsx` reads history on mount via `useEffect`, renders `<DocumentHistory />` between form and empty-state sections.
- [ ] **AC-6:** After successful upload in `handleAnalyzePdf`, new doc persisted via `addDocToHistory` + local state refreshed.
- [ ] **AC-7:** Dashboard empty-state (📚) hidden when `docHistory.length > 0` (user has prior docs — "new" prompt misleading).
- [ ] **AC-8:** `app/leaderboard/page.tsx` header has "← Về Dashboard" link above title. Text color explicit `text-white/60` (Phase 3 F-1 preempt).
- [ ] **AC-9:** `cd vibeseek && npx tsc --noEmit` exit 0.
- [ ] **AC-10:** `cd vibeseek && npm run build` pass.
- [ ] **AC-11 (User-runnable, post-merge):** Upload PDF → reload dashboard → doc appears in history list → click Quiz link → navigates to quiz page. Reload chat page → chat works. Remove doc from history → disappears from list (DB unchanged, accessible if user knows UUID).
- [ ] **AC-12 (User-runnable):** Leaderboard page → "← Về Dashboard" visible at top → click → navigates to `/dashboard`. Works on both populated and empty states.
- [ ] **AC-13:** 390px mobile viewport check (Phase 3 F-11): DocumentHistory list items wrap cleanly, Quiz/Chat/Remove buttons don't overflow horizontally. VibePointsBadge top-right doesn't overlap doc list content.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- No new deps (`package.json` unchanged)
- No DB migration (`supabase-schema.sql` unchanged)
- No new API endpoint (`app/api/**` unchanged)
- VideoPlayer resume explicitly out of scope

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | localStorage quota exceeded | `try/catch` silent in `addDocToHistory` (match chat-history.ts pattern). |
| F-2 | Stale doc in history (deleted from DB) → clicking Quiz/Chat hits 404 | Existing `/quiz/[id]/error.tsx` + `/chat/[id]/error.tsx` (T-401) handle gracefully. User can click ✕ to remove from list. |
| F-3 | React Strict Mode double-fire of mount effect → doc added twice | `addDocToHistory` dedupes by `documentId`; 2 writes = 1 final entry. |
| F-4 | Multiple tabs upload concurrently → localStorage write race | Last-write-wins; acceptable (no cross-tab sync in MVP). User reopens tab → sees latest state. |
| F-5 | Doc title overflow UI on long filenames | `truncate` Tailwind class on `<p>` + `title={doc.title}` for hover tooltip. Mobile viewport tested at AC-13. |
| F-6 | `documentId === 'local'` legacy entries pollute list | Both `loadDocHistory` filter and `addDocToHistory` guard reject this value. |
| F-7 | Empty-state still shows when doc history populated | Condition adds `docHistory.length === 0` as first clause. Verified by inspecting JSX. |
| F-8 | `DocumentHistory` fires on server render (SSR) → hydration mismatch (initial [] vs populated post-effect) | Dashboard is `'use client'` (line 1). Initial render sees `docHistory = []`, effect sets after mount → matches SSR state. No mismatch. |
| F-9 | Relative-time formatter locale issues (Vietnamese display) | Text is hardcoded Vietnamese ("phút trước" etc.). `toLocaleDateString('vi-VN')` fallback for old dates. No Intl API edge case. |
| F-10 | VibePointsBadge overlap with remove ✕ button on 390px viewport | DocumentHistory items use `flex flex-wrap gap-2` — buttons wrap if needed. Badge at `fixed top-4 right-4 z-50` stays above header only (max-w-3xl content is centered, badge sits in right margin on desktop, may overlap right edge on mobile but list items have left-aligned core content). Acceptable. Verified Phase 3 F-11 pattern. |
| F-11 | Leaderboard back-link redundant with empty-state "Về Dashboard" button | Acceptable — header link is for returning users (navigation habit); empty-state button is for first-visit guidance. Both shown in empty state; populated state only has header link. |
| F-12 | Agent duplicates chat-history pattern into shared helper | Spec explicit: keep `doc-history.ts` and `chat-history.ts` parallel. Do NOT refactor. Different domains, stable APIs. |

## Local test plan

### Test 1 — tsc + build
```bash
cd vibeseek && npx tsc --noEmit && npm run build
```
Expected: exit 0, no new routes (no new API), dashboard/leaderboard still listed.

### Test 2 — Upload + reload persistence (5 min)
Dev mode (`npm run dev`):
1. Clear localStorage (DevTools → Application → Local Storage → clear).
2. Visit `/dashboard` → verify 📚 empty state renders.
3. Upload PDF → cards generate → `<DocumentHistory />` list replaces empty state with new entry ("vừa xong").
4. **Reload page** (F5). Expected: form still at top, DocumentHistory list shows the uploaded doc, empty state does NOT show.
5. Click Quiz link → navigates to `/quiz/<id>` → quiz loads from DB.
6. Back to dashboard → list still shows doc.

### Test 3 — Multiple docs
1. Upload 2-3 PDFs (sequential).
2. Each upload persists.
3. Reload → list shows 2-3 entries, most-recent first.
4. Relative timestamps ("vừa xong" / "X phút trước").

### Test 4 — Remove from history
1. Click ✕ on one entry → item disappears from list immediately.
2. Reload → item stays removed.
3. Manually visit `/quiz/<removed-id>` → works (DB unchanged).

### Test 5 — Leaderboard back-link (1 min)
1. Navigate to `/leaderboard` (populated, you have 50 pts from smoke).
2. Verify "← Về Dashboard" visible at top of header.
3. Click → navigates to `/dashboard`.
4. Fresh browser (clear localStorage) → `/leaderboard` → empty state shows. Back-link still visible at top.

### Test 6 — 390px viewport (Phase 3 F-11 preempt, 2 min)
1. DevTools iPhone 13 viewport (390px).
2. Dashboard with 3+ docs in history.
3. Verify: list items wrap gracefully, buttons fit, VibePointsBadge doesn't overlap.
4. Leaderboard back-link readable, not overlapped.

### Test 7 — Strict Mode dedup
Dev mode has Strict Mode ON. Upload PDF → Strict Mode double-fires mount effect → list state potentially reads twice. Verify: only 1 entry per documentId.

## Non-goals (KHÔNG làm)
- KHÔNG DB migration (no `anon_id` column add to `vibe_documents` — Phase 6+ when Supabase Auth wired)
- KHÔNG new API endpoint (no `/api/documents`, no `/api/render-jobs?documentId=X`)
- KHÔNG VideoPlayer resume from DB on mount (Phase 6+; MVP workaround: Supabase video_url direct)
- KHÔNG cards cache in localStorage (user re-uploads if wants to re-view cards; Quiz/Chat links work from history)
- KHÔNG cross-device sync
- KHÔNG merge `doc-history.ts` + `chat-history.ts` into shared generic helper
- KHÔNG add delete-from-DB button (only remove-from-local-list; DB is source of truth)
- KHÔNG Supabase Realtime integration for live updates
- KHÔNG server-side render (SSR) of dashboard
- KHÔNG pagination / search of doc history (20-entry cap sufficient for MVP)

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
_(agent fills — especially if Tailwind `.glass` class cannot be reused on DocumentHistory without conflict, or if relative-time formatter needs extra edge cases)_

## Notes for reviewer
- Phase 3 UI failure modes checklist applies:
  - F-1 dark-body inherit: every text node `text-white*` explicit.
  - F-11 VibePointsBadge overlap at 390px: verified via Test 6.
- Phase 2 lesson applies: dev Strict Mode double-fire → dedup at helper level (F-3).
- Protected-region grep on final diff:
  - `git diff main -- vibeseek/components/VideoPlayer.tsx` → empty (T-405 does NOT touch)
  - `git diff main -- vibeseek/app/api/` → empty
  - `git diff main -- vibeseek/supabase-schema.sql` → empty
- This is a pure client-side UX task. No new failure modes beyond chat-history precedent (Phase 3 T-305).
- PR diff expected: 2 NEW files + 2 MODIFIED files + 1 task md + AGENT_LOG = 6 files total.
- Agent should take <20 minutes. If agent drafts > 250 LOC total or touches any server/DB file, reviewer requests changes.
