# P-504 · Typing indicator — "Bé Vibe đang suy nghĩ" (Day 1 Track B)

**Status:** `review`
**Severity:** LOW (chat UX polish, demo-visible)
**Branch:** `task/P-504-typing-indicator`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (tiny scope, single file + optional tiny new component)
**Depends on:** P-503 merged (uses new terracotta `#D96C4F` color + `var(--color-terracotta)` CSS var)

---

## Context

User brand/motion spec item 3: "Typing indicator cho DOJO — ba chấm • • • nhảy theo sóng (0ms, 150ms, 300ms delay). Hiện trong bubble màu terracotta khi AI đang suy nghĩ."

Current state: when chat streams response, ChatPanel.tsx renders empty assistant bubble with fallback `"..."` text (line 225 in P-503-merged ChatPanel). We replace this placeholder with a nicer 3-dot wave animation.

**Scope:** single file change (or 1 file + 1 tiny new component). No global CSS touch — keeps this branch disjoint from P-505 which owns globals.css edits.

---

## Files to touch (exactly 2-3 files)

1. `vibeseek/components/TypingDots.tsx` (**NEW**, ~25 LOC) — reusable component encapsulating the 3-dot wave animation
2. `vibeseek/components/ChatPanel.tsx` — import `TypingDots`, swap `"..."` fallback for `<TypingDots />` when `streamingId === m.id && !m.content`
3. `tasks/P-504-typing-indicator.md` — status transition spec → review → done

## Files NOT to touch

- `app/globals.css` — **P-505 owns this file in parallel branch** · Keep zero diff here. Use Tailwind utilities only for animation.
- `tailwind.config.ts` — don't add custom keyframes (use Tailwind built-ins)
- All other Phase 1-5 invariants (render.mjs, prompts, routes, etc.)
- `AGENT_LOG.md` — **defer to architect close-out commit** (avoid parallel branch merge conflicts per Phase 4 Lesson 18)
- `ARCHITECT_BLUEPRINT.md` — defer to architect close-out

---

## Architect's spec

### §1 — `components/TypingDots.tsx` (NEW)

```tsx
'use client'

/**
 * P-504: 3-dot wave animation for chat streaming state.
 * Terracotta (#D96C4F) dots, staggered bounce at 0ms/150ms/300ms.
 * Used inside assistant bubble when streaming before any content arrives.
 */
export default function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="DOJO đang suy nghĩ">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-[#D96C4F] animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '900ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-[#D96C4F] animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '900ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-[#D96C4F] animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '900ms' }}
      />
    </span>
  )
}
```

Notes:
- Uses Tailwind built-in `animate-bounce` — no custom keyframe needed → zero CSS file change
- `animationDuration: 900ms` (slower than default 1s `animate-bounce`) for chill vibe
- `aria-label` for screen readers
- `bg-[#D96C4F]` literal terracotta (matches P-503 palette mapping)

### §2 — `components/ChatPanel.tsx` — wire TypingDots into streaming bubble

**Current** (around line 220-228 post-P-503):
```tsx
<div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
  m.role === 'user'
    ? (m.mode === 'feynman' ? 'bg-[#7A9B7E] text-[#F5EFE4]' : 'bg-[#F5B83E] text-[#F5EFE4]')
    : 'bg-[#F5EFE4]/10 text-[#F5EFE4]/90'
}`}>
  {m.content || (streamingId === m.id ? '...' : '')}
</div>
```

**Replace** the `{m.content || ...}` render with:

```tsx
{m.content ? (
  m.content
) : streamingId === m.id ? (
  <TypingDots />
) : null}
```

**Import at top of file:**
```tsx
import TypingDots from '@/components/TypingDots'
```

No other logic change. State machine, SSE handling, Feynman mode, round counter — all untouched.

**NB:** If the exact color classes/pattern differ post-P-503 (because P-503 merged after spec author saw file), executor applies the equivalent swap keeping Sonnet/Pink bubble logic intact and only replacing the content render expression.

---

## Acceptance criteria

- [ ] **AC-1:** `components/TypingDots.tsx` created with exactly the code in §1 (or equivalent using Tailwind `animate-bounce` with 0/150/300ms delays + terracotta `#D96C4F`)
- [ ] **AC-2:** `ChatPanel.tsx` imports `TypingDots` and renders it when assistant bubble is streaming with no content yet
- [ ] **AC-3:** When stream yields first delta, content replaces TypingDots (no dots behind text)
- [ ] **AC-4:** No edit to `globals.css` or `tailwind.config.ts` (use Tailwind built-ins only)
- [ ] **AC-5:** No edit to AGENT_LOG.md or ARCHITECT_BLUEPRINT.md (architect close-out handles)
- [ ] **AC-6:** `npx tsc --noEmit` exit 0
- [ ] **AC-7:** No new deps (framer-motion, animation libs — already have what we need)
- [ ] **AC-8:** Feynman mode streaming: dots still terracotta (not sage) per spec — typing indicator color is constant across modes
- [ ] **AC-9 (manual visual):** Local dev smoke — send chat message, observe 3 dots bouncing in staggered wave before response arrives, dots disappear once text streams in

## Definition of Done

- All AC pass
- Task md status `spec` → `review` → `done` after merge
- PR opened: `task/P-504-typing-indicator` → main, title `P-504: Typing indicator — dots wave during chat stream`
- Exactly 3 files in PR: new TypingDots.tsx + modified ChatPanel.tsx + this task md
- tsc clean, 0 new deps, globals.css + tailwind.config.ts + AGENT_LOG.md all zero diff (P-505 independence gate)

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | `animate-bounce` duration too fast/too slow feels wrong | 900ms specified. Tune post-merge if user feedback. |
| F-2 | 3 dots don't stagger visually — all jumping together | `animationDelay` inline style explicit. Tailwind's `delay-150` utility only applies to transitions, NOT keyframe animations — that's why we use inline style. |
| F-3 | TypingDots persists after stream done | Logic `m.content ? content : streamingId===m.id ? <TypingDots/> : null` — once content arrives, TypingDots unmounts automatically. |
| F-4 | Collides with P-505 (ambient bg) branch on globals.css | **Prevention:** this task spec explicitly NOT to touch globals.css. P-504 uses Tailwind utilities + inline style only. Zero globals.css diff → no merge conflict. |
| F-5 | Executor touches AGENT_LOG.md → rebase conflict with P-505 | **Prevention:** AC-5 explicit. Architect close-out writes AGENT_LOG after both merge. |
| F-6 | TypingDots shows for user messages mid-send | `streamingId` only set for assistant message ID (ChatPanel line 107-108 `setStreamingId(assistantId)`). User message has different id. Safe. |
| F-7 | Accessibility — screen reader announces dots as content | `aria-label="DOJO đang suy nghĩ"` on the span → screen reader reads the label, not the dots. |

---

## Local test plan

### Test 1 — tsc
`cd vibeseek && npx tsc --noEmit` → exit 0

### Test 2 — Dev smoke
`cd vibeseek && npm run dev` → open `/chat/[someDocId]` → send a message → observe assistant bubble shows 3 staggered bouncing dots for the brief window before first SSE chunk arrives → dots replaced by streaming text.

### Test 3 — Parallel branch independence grep
Before commit:
```bash
cd D:/Wangnhat/Study/VibeCode && git diff --cached --stat
```
Must show ONLY: `components/ChatPanel.tsx`, `components/TypingDots.tsx`, `tasks/P-504-typing-indicator.md`. Zero other files. Zero globals.css / tailwind.config.ts / layout.tsx changes.

---

## Non-goals

- KHÔNG edit globals.css / tailwind.config.ts (P-505 owns these)
- KHÔNG edit layout.tsx (P-505 owns)
- KHÔNG add new deps
- KHÔNG rebuild streaming state machine
- KHÔNG add typing sound effect (item 11 Sound is a later task P-50X)
- KHÔNG change dot count (3 is the spec)
- KHÔNG change color per mode (constant terracotta)
- KHÔNG touch AGENT_LOG or blueprint (architect handles in close-out)

---

## Decisions log

- **2026-04-22** — Executor (claude-sonnet-4-6): Created `TypingDots.tsx` per spec §1 verbatim. No deviations.
- **2026-04-22** — ChatPanel.tsx line 334: swapped `{m.content || (streamingId === m.id ? '...' : '')}` for mode-aware ternary rendering `<TypingDots />` when streaming with no content. Import added at line 4.
- **2026-04-22** — Confirmed Tailwind built-in `animate-bounce` + inline `animationDelay` pattern (F-2 prevention: Tailwind `delay-*` utilities don't apply to keyframe animations, only transitions).
- **2026-04-22** — Zero diff on `globals.css`, `tailwind.config.ts`, `layout.tsx`, `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md` — parallel branch isolation with P-505 maintained.

---

## Notes for reviewer

### Dispatch model
Sonnet. Extremely tight scope, 2 files, literal code in spec. Opus overkill.

### Parallel branch contract
This task is **Day 1 Track B-1** running in parallel with **P-505 Track B-2** (ambient bg). Both branched from main tip `b2a94ab`. Branch isolation:
- P-504 touches: ChatPanel.tsx + new TypingDots.tsx (+ task md)
- P-505 touches: layout.tsx + globals.css + new AmbientBackground.tsx (+ task md)
- Zero file overlap → zero merge conflict expected

If you find yourself needing globals.css edits → pause + flag architect. Don't solve it by touching globals.css.

### Commit style
Title: `P-504: Typing indicator — dots wave during chat stream`
Co-Authored-By: `Claude Sonnet 4.6 <noreply@anthropic.com>`
