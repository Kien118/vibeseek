# T-401 · Error boundaries + empty states

**Status:** `review`
**Severity:** MEDIUM (Phase 4 core polish — user-visible UX)
**Blueprint ref:** §10 Phase 4 Core polish · T-401
**Branch:** `task/T-401-error-boundaries`
**Assignee:** _(TBD)_
**Depends on:** none.

## Context

**Current state (main `e54f5f7`):**
- Zero `error.tsx` files in `app/`. Any thrown error in a route segment falls through to Next.js's default error page (ugly, English-only, no branding).
- No `app/not-found.tsx` — 404s hit Next.js default too.
- Empty states on data-driven pages (dashboard with 0 documents, leaderboard with 0 profiles) render as a bare section with "0 rows" or just empty list — no user-friendly "get started" prompt.

**Why this matters:**
- Students uploading a corrupted PDF, losing network mid-quiz-submit, or hitting a bad `/chat/<invalid-uuid>` URL currently see a jarring untranslated Next.js error page. Trust tanks instantly.
- The empty dashboard on first visit (before any PDF upload) shows no guidance. User doesn't know what to do.
- Phase 2/3 hotfix memories repeatedly flagged "explicit UI text in Vietnamese" and "never white-on-white" — error pages are the current biggest gap.

**Scope — what IS included:**
- 1 global root `app/error.tsx` (Error Boundary for the whole app, rare catch-all)
- 4 route-specific `error.tsx` files (dashboard, quiz/[documentId], chat/[documentId], leaderboard) with route-aware messaging + retry
- 1 `app/not-found.tsx` (global 404)
- Empty states for dashboard (0 docs) and leaderboard (0 profiles)

**Scope — what is NOT included:**
- Error logging to Sentry/PostHog — deferred, local `console.error` only
- Retry-with-exponential-backoff — plain `reset()` per Next.js App Router pattern
- Dedicated loading.tsx files — Phase 5 if needed (separate concern from error.tsx)

## Files to touch
- `vibeseek/app/error.tsx` (NEW — global root)
- `vibeseek/app/not-found.tsx` (NEW — 404)
- `vibeseek/app/dashboard/error.tsx` (NEW)
- `vibeseek/app/quiz/[documentId]/error.tsx` (NEW)
- `vibeseek/app/chat/[documentId]/error.tsx` (NEW)
- `vibeseek/app/leaderboard/error.tsx` (NEW)
- `vibeseek/app/dashboard/page.tsx` (MODIFY — add empty state when docs list is empty)
- `vibeseek/app/leaderboard/page.tsx` (MODIFY — add empty state when no profiles)
- `tasks/T-401-error-boundaries.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/app/layout.tsx` — root layout unchanged (T-403/T-404 scope owns layout.tsx)
- `vibeseek/app/quiz/[documentId]/page.tsx` — has its own 4-phase state machine with error state already (P-2 shipped). Don't duplicate. Only add `error.tsx` boundary at the segment level for un-caught throws.
- `vibeseek/app/chat/[documentId]/page.tsx` — similar, ChatPanel already has `ensure-error` phase.
- `vibeseek/lib/**`, `vibeseek/components/**` — don't restructure existing components. Empty state is inline JSX within the page.tsx file.
- `vibeseek/app/api/**` — error boundaries are client-side UI. Server routes return JSON errors already.
- `vibeseek/app/page.tsx` (landing) — no error boundary needed; landing has no data fetch.

## Architect's spec

### 1. Shared style conventions (apply to all error.tsx + not-found.tsx)

All error/not-found pages follow the same visual skeleton so they feel unified. Use the existing globals.css dark theme (`body { color: white }` already applied). Explicit text colors everywhere (Phase 3 lesson F-1 dark-body color inherit).

```tsx
// Common structure — each file customizes the emoji, title, body text, actions
'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function SomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[route] error:', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold text-white">Lỗi tải trang</h1>
        <p className="text-white/70 text-sm">
          {error.message || 'Có lỗi xảy ra. Thử lại nhé?'}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => reset()}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90"
          >
            Thử lại
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded-full border border-white/20 text-white/80 text-sm hover:bg-white/5"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
```

Each route's error.tsx MUST customize:
- Emoji at top (different per route for visual distinction — e.g., 📄 dashboard, 🎯 quiz, 💬 chat, 🏆 leaderboard)
- Title text (route-specific: "Lỗi tải dashboard" / "Lỗi quiz" / "Lỗi chat" / "Lỗi leaderboard")
- Body text hint about what likely went wrong
- Primary CTA ("Thử lại" — calls `reset()`)
- Secondary CTA (link back to a parent — dashboard or landing)

### 2. `app/error.tsx` (global root)

This fires when something outside a route segment throws (rare — layout.tsx-level failure).

```tsx
'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] error:', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">💥</div>
        <h1 className="text-2xl font-bold text-white">Ứng dụng gặp lỗi</h1>
        <p className="text-white/70 text-sm">
          VibeSeek đang gặp trục trặc. Bấm "Thử lại" hoặc quay lại trang chủ.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => reset()}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90"
          >
            Thử lại
          </button>
          <Link
            href="/"
            className="px-5 py-2 rounded-full border border-white/20 text-white/80 text-sm hover:bg-white/5"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
```

### 3. `app/not-found.tsx`

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-2xl font-bold text-white">Không tìm thấy trang</h1>
        <p className="text-white/70 text-sm">
          Trang bạn tìm không tồn tại hoặc đã bị xóa.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90"
          >
            Về Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2 rounded-full border border-white/20 text-white/80 text-sm hover:bg-white/5"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
```

No `'use client'` — `not-found.tsx` is a server component by default.

### 4. Route-specific error.tsx files — customizations

Each file uses the pattern from §1 with these swaps:

**`app/dashboard/error.tsx`:**
- Emoji: 📄
- Title: "Lỗi tải Dashboard"
- Body: "Không tải được danh sách tài liệu của bạn. Thử lại hoặc refresh trang."
- Secondary CTA: `<Link href="/">Về trang chủ</Link>`

**`app/quiz/[documentId]/error.tsx`:**
- Emoji: 🎯
- Title: "Lỗi tải Quiz"
- Body: "Không tạo được câu hỏi cho tài liệu này. Có thể do quota AI hết — thử lại sau 1 phút."
- Secondary CTA: `<Link href="/dashboard">Về Dashboard</Link>`

**`app/chat/[documentId]/error.tsx`:**
- Emoji: 💬
- Title: "Lỗi tải Chat"
- Body: "Không kết nối được với DOJO. Kiểm tra mạng hoặc thử lại."
- Secondary CTA: `<Link href="/dashboard">Về Dashboard</Link>`

**`app/leaderboard/error.tsx`:**
- Emoji: 🏆
- Title: "Lỗi tải Leaderboard"
- Body: "Không tải được bảng xếp hạng. Refresh hoặc quay lại sau."
- Secondary CTA: `<Link href="/dashboard">Về Dashboard</Link>`

### 5. Empty state: `app/dashboard/page.tsx`

Read the current dashboard page. Find the section where documents/cards list is rendered (likely `cards.length > 0 ? ... : null` or similar). Add an empty state branch when documents array is empty.

**Requirement:** when user hasn't uploaded any PDF yet (dashboard first visit):
```tsx
{documents.length === 0 && (
  <div className="dashboard-empty-state text-center p-12 space-y-4">
    <div className="text-6xl">📚</div>
    <h2 className="text-xl font-bold text-white">Chưa có tài liệu nào</h2>
    <p className="text-white/60 text-sm max-w-md mx-auto">
      Upload PDF đầu tiên để bắt đầu tạo Vibe Cards, Quiz, và chat với DOJO.
    </p>
  </div>
)}
```

Agent adapts to actual state variable name in dashboard/page.tsx. If existing code already has `if (cards.length === 0) return ...` fallback, replace with the branded empty state.

### 6. Empty state: `app/leaderboard/page.tsx`

Similar pattern — when `profiles.length === 0` (or equivalent):
```tsx
{profiles.length === 0 ? (
  <div className="text-center p-12 space-y-4">
    <div className="text-6xl">🏆</div>
    <h2 className="text-xl font-bold text-white">Chưa có ai trên bảng</h2>
    <p className="text-white/60 text-sm max-w-md mx-auto">
      Hoàn thành quiz đầu tiên để xuất hiện trên leaderboard.
    </p>
    <Link
      href="/dashboard"
      className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90"
    >
      Về Dashboard
    </Link>
  </div>
) : (
  /* existing leaderboard table */
)}
```

Agent reads current page.tsx to find `profiles` or equivalent variable name + integrates cleanly.

## Acceptance criteria
- [ ] **AC-1:** 6 new files created: `app/error.tsx`, `app/not-found.tsx`, `app/dashboard/error.tsx`, `app/quiz/[documentId]/error.tsx`, `app/chat/[documentId]/error.tsx`, `app/leaderboard/error.tsx`.
- [ ] **AC-2:** All 5 `error.tsx` files have `'use client'` directive + `{error, reset}` props + `useEffect` logging + Vietnamese title/body + "Thử lại" button + secondary link.
- [ ] **AC-3:** `not-found.tsx` is a server component (no `'use client'`) with 2 CTA links.
- [ ] **AC-4:** Every text element explicitly colored (`text-white`, `text-white/70`, etc.). Phase 3 lesson F-1 preempted — no inherited-color risks.
- [ ] **AC-5:** Dashboard empty state renders when user has 0 documents: branded prompt + upload hint.
- [ ] **AC-6:** Leaderboard empty state renders when 0 profiles: branded prompt + link to dashboard.
- [ ] **AC-7:** `cd vibeseek && npx tsc --noEmit` exit 0.
- [ ] **AC-8:** `cd vibeseek && npm run build` pass.
- [ ] **AC-9 (User-runnable, post-merge):**
  - Visit `/<nonexistent-path>` → renders custom 404 with back-to-dashboard button.
  - Manually throw in dashboard page (temporary test — `throw new Error('test')` → revert) → `dashboard/error.tsx` renders with 📄 emoji + retry button.
  - First visit to dashboard (DevTools → clear localStorage + Supabase test row cleanup if needed) → empty state shows instead of blank list.
- [ ] **AC-10:** Badge overlap check (Phase 3 lesson): open each error.tsx page in Chrome iPhone 13 viewport (390px) → VibePointsBadge (fixed top-right) doesn't overlap the page content. All error pages use centered flex layout so text + buttons stay left of badge zone.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- No new deps in `package.json`
- No logging service integrations (Sentry/PostHog off-scope)

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Agent writes `text-black` or default (inherit from body `color:white`) → invisible | Every text element has explicit `text-white*` class per §1 template. Phase 3 lesson F-9 reference. |
| F-2 | `error.tsx` missing `'use client'` → fails to use `useEffect` + `reset()` | Spec §1 template includes directive. Reviewer greps. |
| F-3 | VibePointsBadge `fixed top-4 right-4 z-50` overlaps CTA buttons on mobile | Error pages use `min-h-screen flex items-center justify-center` — content centered, badge floats at right edge, no overlap at 390px. Verified via Phase 3 lesson F-11 check. |
| F-4 | Empty state conditional misses edge case (e.g., `documents = null` vs `[]`) | Spec uses `.length === 0` check; agent handles `null` via `(documents ?? []).length === 0` if needed. |
| F-5 | Route error.tsx fires even on handled API errors (existing ChatPanel ensure-error phase, QuizCard 4-phase state) | error.tsx only fires on un-caught throws — handled errors inside page components don't propagate. No double-rendering risk. |
| F-6 | `reset()` doesn't actually retry (stale error state) | This is Next.js framework behavior; `reset()` re-renders the segment. Spec trusts the framework. |
| F-7 | Chinese/other-lang users see Vietnamese text | Accept — VibeSeek is Vietnamese-only MVP per blueprint. Phase 5+ i18n if ever needed. |
| F-8 | Empty state in dashboard/page.tsx breaks existing card grid rendering | Agent reads page.tsx first + integrates conditionally without removing existing branches. Empty state is NEW branch, existing card-grid branch preserved. |
| F-9 | Agent accidentally changes the 4-phase quiz/chat page state machines | Files NOT to touch list explicit — only `error.tsx` sibling is added, not page.tsx. |
| F-10 | not-found.tsx isn't triggered by Next.js (route matching) | `not-found.tsx` at `app/` root is global 404 — fires when no route matches. Standard App Router behavior. |
| F-11 | Dark-theme text hard to read on error page | Backgrounds from globals.css dark theme; text `text-white/70` for body = readable. Preview at AC-9. |
| F-12 | Reset button doesn't clear query-string / useSearchParams state | Out of scope. Next.js reset triggers segment re-render. |

## Local test plan

### Test 1 — Type check + build
```bash
cd vibeseek && npx tsc --noEmit && npm run build
```
Expected: exit 0. Build output lists all 6 new error/not-found routes.

### Test 2 — Dev server visual (architect)
```bash
cd vibeseek && npm run dev
```
- Visit http://localhost:3000/xxx-nonexistent → custom 404 renders
- Temporarily add `throw new Error('architect test')` to `app/dashboard/page.tsx`, reload → `dashboard/error.tsx` renders → revert throw → re-reload → normal dashboard.
- Repeat for `/quiz/<uuid>` + `/chat/<uuid>` + `/leaderboard`.

### Test 3 — Dev server mobile viewport
Chrome DevTools iPhone 13 (390px) → visit each error page → verify:
- Content centered, readable
- Buttons fit within viewport width
- VibePointsBadge top-right doesn't overlap

### Test 4 — Empty state
Clear dashboard data (Supabase SQL): `DELETE FROM vibe_documents WHERE anon_id = '<user's anon id>'` (DO NOT run on prod-like data without backup).
Or simpler — open a fresh browser incognito tab (new anon_id). Visit /dashboard. Expected: 📚 empty state with upload prompt.

### Test 5 — Empty leaderboard
New incognito → /leaderboard. Expected: 🏆 empty-state prompt with "Về Dashboard" button.

## Non-goals (KHÔNG làm)
- KHÔNG add Sentry, PostHog, or any error tracking SDK
- KHÔNG implement `loading.tsx` files (Phase 5 if needed)
- KHÔNG modify quiz/chat page internal state machines (their in-page error handling is P-2/P-3 scope)
- KHÔNG add i18n / multi-language error messages
- KHÔNG implement exponential-backoff retry logic (basic Next.js `reset()` suffices)
- KHÔNG create shared `<ErrorPage />` component; keep each error.tsx inline per Next.js App Router pattern (Next.js doesn't recommend shared client components across route segments)
- KHÔNG change Toaster / react-hot-toast setup in layout.tsx (different UX — toast for handled errors, error.tsx for un-caught throws)
- KHÔNG add auth/permission checks on error pages (no auth in MVP anyway)

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log

**D-1 · Dashboard state variable = `cards`, not `documents`.** Spec suggested `documents.length === 0`; actual state in `app/dashboard/page.tsx` is `cards: Array<Omit<VibeCardType, ...>>` (line 35). Used `cards.length === 0` per F-4 guidance (matches actual code).

**D-2 · Dashboard empty-state trigger = `cards.length === 0 && !isProcessing && !isGeneratingVideo && !currentJobId`.** The dashboard is an upload studio (form always visible), not a list view. Gating only on `cards.length === 0` would flash the empty state during an active upload (between `setCards([])` in `handleAnalyzePdf` L59 and the response). Added the three activity flags to ensure the empty state only appears on idle first-visit or post-error states, never during active pipeline work. Kept inline between upload form and result sections, styled with `glass` class + `dashboard-empty-state` id (consistent with adjacent `dashboard-result glass` sections).

**D-3 · Leaderboard state variable = `rows`, not `profiles`.** Spec suggested `profiles.length === 0`; actual state in `app/leaderboard/page.tsx` is `rows: LeaderboardRow[]` (line 9). Used `rows.length === 0` per F-4. Integrated as a new branch in the existing `loading ? ... : ...` ternary → `loading ? <Loader/> : rows.length === 0 ? <EmptyState/> : <Table/>`. Added `import Link from 'next/link'` since the existing file didn't have it but the empty state needs the secondary CTA link.

**D-4 · AC-8 `npm run build` deferred to user.** Dev server detected listening on :3000 (PID 24640) at time of completion. Per Phase 3 lesson (SESSION_HANDOFF Step 5), running `npm run build` while user's dev server is active corrupts `.next/server/` chunks. AC-7 `npx tsc --noEmit` exit 0 verified. AC-8 left for user to run after stopping dev server, or for architect review step.

**D-5 · Text-color defensive pattern.** Every string element in all 6 new files + 2 empty states uses an explicit `text-white` / `text-white/70` / `text-white/60` / `text-white/80` class, preempting Phase 3 F-1 (dark-body color inherit). Reviewer can `grep -r "text-" vibeseek/app/error.tsx vibeseek/app/not-found.tsx vibeseek/app/*/error.tsx vibeseek/app/*/[documentId]/error.tsx` to confirm zero default-colored text nodes.

**D-6 · Escaped right-side quote chars in global error body (`&ldquo;`/`&rdquo;`).** React 18 + Next.js ESLint's `react/no-unescaped-entities` flags raw `"..."` inside JSX text. Used HTML entities for the quoted "Thử lại" reference to pass lint without wrapping the whole string in `{'...'}`.

## Notes for reviewer
- Reviewer runs dev server + visits each error path per Test 2/3.
- Reviewer greps for `'use client'` in all 5 error.tsx files.
- Reviewer greps for `text-black` / missing color — should find zero.
- Reviewer greps for Sentry / PostHog / new deps — should find zero.
- 6 new files + 2 page.tsx modifications = 8 code touches; 1 task md + 1 AGENT_LOG = 10 total files in PR diff.
- Phase 3 UI checklist applies directly (dark-body inherit, fixed-overlay overlap at 390px).
- This is the only T-4xx task with meaningful design choices. T-402/T-403/T-404 are tactical.
