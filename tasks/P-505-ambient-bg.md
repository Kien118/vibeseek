# P-505 · Ambient background — orbs + noise + dot-grid fade (Day 1 Track B)

**Status:** `review`
**Severity:** LOW (global ambient polish, demo-visible)
**Branch:** `task/P-505-ambient-bg`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (tiny scope, 3 files — 1 new component + 2 edits)
**Depends on:** P-503 merged (uses new sunflower `#F5B83E` + terracotta `#D96C4F` tokens + `var(--color-*)` CSS vars)

---

## Context

User brand/motion spec item 10: "Background ambient — orb ánh sáng (sunflower + terracotta) di chuyển chậm như parallax. Noise grain overlay 15% opacity (giống phim analog). Dot-grid mask fade ra rìa màn hình."

Current state (post-P-503):
- `body` has warm radial gradient ellipses (sunflower 6% + terracotta 5%)
- `body::before` has noise SVG at 0.04 opacity (from earlier phase, palette-independent)

User wants:
1. **Orbs** — 2-3 blurred color blobs drifting slowly (parallax feel)
2. **Noise** bumped 0.04 → 0.12-0.15 (more film-grain)
3. **Dot-grid** pattern fade at viewport edges (vignette-style)

**Scope:** 3 files — 1 new client component (`AmbientBackground.tsx`) mounted once in layout, 1 edit to layout.tsx to render it, 1 edit to globals.css to bump noise opacity + remove/adjust conflicting body background.

---

## Files to touch (exactly 4 files)

1. `vibeseek/components/AmbientBackground.tsx` (**NEW**, ~80 LOC) — fixed-position client component with 3 drifting orbs + dot-grid overlay + edge fade masks
2. `vibeseek/app/layout.tsx` — render `<AmbientBackground />` inside `<body>` BEFORE `{children}` (so it sits behind content)
3. `vibeseek/app/globals.css` — bump `body::before` noise opacity 0.5 → 1.0 (see §3 note), adjust body background radial gradients to be subtler (orbs take over), ensure z-stack correct
4. `tasks/P-505-ambient-bg.md` — status transitions

## Files NOT to touch

- `components/ChatPanel.tsx`, `components/TypingDots.tsx` (**P-504 owns these** in parallel branch)
- `tailwind.config.ts` (Tailwind utilities suffice)
- Any Phase 1-5 invariants (render.mjs, prompts, routes, etc.)
- `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md` — **defer to architect close-out commit** (avoid parallel branch rebase conflicts)
- `package.json` / `package-lock.json` (framer-motion already installed, no new deps)

---

## Architect's spec

### §1 — `components/AmbientBackground.tsx` (NEW)

```tsx
'use client'

import { motion } from 'framer-motion'

/**
 * P-505: Global ambient background layer.
 * - 3 drifting color orbs (sunflower + terracotta + sage) with slow parallax drift
 * - Dot-grid overlay pattern (radial mask fades at edges)
 * - Fixed behind content, pointer-events: none, z-index: 0
 *
 * Mounted once in app/layout.tsx. Pure visual — no state, no interactivity.
 */
export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Orb 1 — sunflower, top-left, slow drift */}
      <motion.div
        className="absolute w-[42vw] h-[42vw] rounded-full blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, #F5B83E 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orb 2 — terracotta, bottom-right, slower drift */}
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full blur-3xl opacity-15"
        style={{
          background: 'radial-gradient(circle, #D96C4F 0%, transparent 70%)',
          bottom: '-15%',
          right: '-15%',
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 40, -20, 0],
        }}
        transition={{
          duration: 36,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orb 3 — sage accent, center-ish, different phase */}
      <motion.div
        className="absolute w-[30vw] h-[30vw] rounded-full blur-3xl opacity-10"
        style={{
          background: 'radial-gradient(circle, #7A9B7E 0%, transparent 70%)',
          top: '40%',
          left: '50%',
        }}
        animate={{
          x: [0, 30, -40, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 42,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Dot-grid overlay — masked to fade at edges */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F5EFE4 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
    </div>
  )
}
```

Notes:
- Pure motion primitives — `framer-motion` already installed (used in VibeCard, QuizCard)
- Long cycle durations (28/36/42s) = subtle "breathing" parallax, not distracting
- Different phase offsets via duration asymmetry → orbs feel alive but non-rhythmic
- `blur-3xl` + low opacity (10-20%) keeps orbs as background ambience
- Dot-grid uses radial mask to fade toward edges (vignette)
- `pointer-events-none` + `fixed inset-0 z-0` → sits behind interactive content
- `aria-hidden="true"` → screen readers skip

### §2 — `app/layout.tsx` — mount `<AmbientBackground />`

**Current body section** (post-P-503):
```tsx
<body className={`${displayFont.variable} ${bodyFont.variable} ${handwrittenFont.variable} ${serifFont.variable} ${monoFont.variable}`}>
  {children}
  <VibePointsBadge />
  <Toaster ... />
</body>
```

**Change to** — add import + render `<AmbientBackground />` as FIRST body child (below noise overlay ::before, behind all interactive content):

```tsx
import AmbientBackground from '@/components/AmbientBackground'
// ... existing imports

// inside body:
<body className={`${displayFont.variable} ${bodyFont.variable} ${handwrittenFont.variable} ${serifFont.variable} ${monoFont.variable}`}>
  <AmbientBackground />
  {children}
  <VibePointsBadge />
  <Toaster ... />
</body>
```

Since `AmbientBackground` has `z-0` and other content is default (`z-auto` = higher), content renders on top. VibePointsBadge has `z-50` per existing code — stays on top.

### §3 — `app/globals.css` — bump noise opacity + subtle body bg

**Current** `body::before` (approximate post-P-503, retrieved from globals.css):
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,...");
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
}
```

The existing SVG already has its own `opacity='0.04'` in the filter. Combined with `body::before { opacity: 0.5 }`, the effective noise is ~2%. User wants ~15%. Two ways to bump:
- (A) Increase `body::before { opacity: 0.5 → 0.95 }` (takes SVG 0.04 × 0.95 = 3.8% — still too low)
- (B) Increase opacity in SVG filter from 0.04 → 0.4, keep body::before at 0.5 → effective 20% noise
- (C) Inline SVG data url rewrite with new opacity value

Use **(B)** — edit the SVG data URL inside body::before to set `opacity='0.3'` (gives ~15% effective after the `body::before { opacity: 0.5 }` multiplier).

**Exact line to change** in `body::before`:
```css
background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E");
```

(Only the `opacity='0.04'` → `opacity='0.3'` substitution inside the SVG fragment.)

**Body background adjustment** — the P-503 warm gradient ellipses on body now compete with the new orbs. Reduce their opacity by half so orbs lead:

```css
body {
  font-family: var(--font-body);
  background:
    radial-gradient(ellipse at 20% 20%, rgba(245,184,62,0.03) 0%, transparent 52%),
    radial-gradient(ellipse at 80% 80%, rgba(217,108,79,0.025) 0%, transparent 48%),
    var(--color-ink);
  min-height: 100vh;
}
```

(0.06 → 0.03, 0.05 → 0.025 — half)

**z-index correction** — ensure `body::before` noise is above `<AmbientBackground />` orbs (so noise texture covers orbs too):

Change `body::before { z-index: 0 }` to `z-index: 1`. AmbientBackground stays at `z-0`. App content defaults `z-auto` (above `z-1`). VibePointsBadge stays `z-50`.

Result visual stack (bottom → top):
1. `var(--color-ink)` ink base bg
2. Body radial gradient ellipses (subtler now)
3. `<AmbientBackground />` drifting orbs + dot-grid (z-0)
4. `body::before` noise grain (z-1, covers orbs)
5. App content (z-auto)
6. `<VibePointsBadge />` (z-50)

---

## Acceptance criteria

- [ ] **AC-1:** `components/AmbientBackground.tsx` created per §1 with 3 orbs (sunflower/terracotta/sage) + dot-grid overlay + fade mask
- [ ] **AC-2:** `app/layout.tsx` imports and renders `<AmbientBackground />` as first body child before `{children}`
- [ ] **AC-3:** `app/globals.css` noise SVG `opacity='0.04' → opacity='0.3'` substitution applied; body radial gradient halved (0.06→0.03, 0.05→0.025); `body::before { z-index: 0 → 1 }`
- [ ] **AC-4:** No edit to `components/ChatPanel.tsx`, `components/TypingDots.tsx`, `tailwind.config.ts`, `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md`
- [ ] **AC-5:** `npx tsc --noEmit` exit 0
- [ ] **AC-6:** No new deps in package.json/package-lock.json
- [ ] **AC-7 (manual visual):** Local dev smoke — orbs drift visibly (slowly, 28-42s cycles), noise texture more prominent than before, dot-grid visible near center but fades at edges, interactive content (buttons, forms, cards) not occluded
- [ ] **AC-8:** Orbs are behind all content including Toaster + VibePointsBadge
- [ ] **AC-9:** Performance — no jank when drifting (60fps feel). framer-motion handles GPU compositing via `transform`.

## Definition of Done

- All AC pass
- Task md status `spec` → `review` → `done`
- PR: `task/P-505-ambient-bg` → main, title `P-505: Ambient background — drifting orbs + noise + dot-grid`
- Exactly 4 files in PR: new AmbientBackground.tsx + layout.tsx + globals.css + task md
- Zero diff on: ChatPanel.tsx, TypingDots.tsx (P-504 independence gate), tailwind.config.ts, AGENT_LOG.md, BLUEPRINT.md, package.json

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Orbs distract from content (too bright / too fast) | Opacity 10-20% + long cycles (28-42s). Easy tune post-merge if user dislikes. |
| F-2 | Noise opacity 0.3 too grainy | User asked 15% — visual inspection + adjust to 0.2 or 0.25 if architect feels excessive. |
| F-3 | Dot-grid pattern visible on top of orbs — color clash | Pattern uses paper cream `#F5EFE4` at 0.08 opacity — subtle, shouldn't clash. |
| F-4 | framer-motion adds to bundle size | Already installed (~50KB gzipped). No new dep. |
| F-5 | Performance regression on low-end mobile | `blur-3xl` + 3 orbs = moderate GPU work. If demo device struggles, reduce to 2 orbs or lower blur. Post-merge tune. |
| F-6 | AmbientBackground appears ON TOP of content (z-stack wrong) | Fixed `z-0` + `pointer-events-none` + `fixed inset-0`. Body::before at `z-1` above (covers noise over orbs). Content at `z-auto` above both. VibePointsBadge `z-50` above all. Verified stack in §3. |
| F-7 | Collision with P-504 on globals.css | P-504 explicitly forbidden from touching globals.css. Zero overlap. |
| F-8 | Executor touches AGENT_LOG / BLUEPRINT → parallel merge conflict | Architect close-out handles docs after both P-504 + P-505 merge. Executor AC-4 enforces zero diff. |
| F-9 | Noise SVG data URL edit corrupts encoding | §3 provides exact literal replacement. Executor uses Edit with `opacity='0.04'` → `opacity='0.3'`. URL-encoded `%3D` preserved. |
| F-10 | Body gradient reduction makes background look flat | Orbs + noise + dot-grid layers compensate. If still flat after smoke, revert gradient halving (keep 0.06 and 0.05). Judgment call during review. |

---

## Local test plan

### Test 1 — tsc
`cd vibeseek && npx tsc --noEmit` → exit 0

### Test 2 — Dev smoke
`cd vibeseek && npm run dev` → open `/` (landing), `/dashboard`, `/chat/[id]` — each should:
- Show drifting orbs behind content (visible without blocking)
- Texture feel: noise grain 3-4× more prominent than pre-P-505
- Dot-grid fades smoothly toward viewport edges
- Buttons/cards/text still crisp and readable

### Test 3 — Performance
Open DevTools Performance tab → record 5s idle on dashboard → check FPS stays ~60 (orbs should not cause dropped frames).

### Test 4 — Parallel branch independence
`cd D:/Wangnhat/Study/VibeCode && git diff --cached --name-only` — must show ONLY: `components/AmbientBackground.tsx`, `app/layout.tsx`, `app/globals.css`, `tasks/P-505-ambient-bg.md`. Zero other files.

---

## Non-goals

- KHÔNG edit ChatPanel.tsx / TypingDots.tsx (P-504 owns)
- KHÔNG add new animation library (framer-motion sufficient)
- KHÔNG add orb hover/click interactions (pure ambient)
- KHÔNG parameterize orb colors via prop (hardcoded palette from P-503)
- KHÔNG add page-specific orb variations (one global layer)
- KHÔNG touch AGENT_LOG / BLUEPRINT (architect close-out)
- KHÔNG add scan-line effect (out of scope)
- KHÔNG add CRT/glitch overlays (out of scope, different vibe)

---

## Decisions log

- **2026-04-22 (executor: claude-sonnet-4-6):** Implemented spec verbatim. AmbientBackground.tsx created with 3 orbs (sunflower #F5B83E / terracotta #D96C4F / sage #7A9B7E) + dot-grid mask. layout.tsx updated — import + `<AmbientBackground />` as first body child before `{children}`. globals.css 3-spot edits: SVG noise opacity 0.04→0.3, body gradient alphas halved (0.06→0.03, 0.05→0.025), body::before z-index 0→1 (noise above orbs). No new deps. tsc --noEmit exits 0. Exactly 4 files changed.

---

## Notes for reviewer

### Dispatch model
Sonnet. 3 files, literal code + SVG data-url substitution + z-stack math all in spec. No judgment required.

### Parallel branch contract
**Day 1 Track B-2** in parallel with **P-504 Track B-1** (typing indicator). Both branched from main tip `b2a94ab`. Branch isolation:
- P-505 touches: AmbientBackground.tsx (new) + layout.tsx + globals.css + task md
- P-504 touches: TypingDots.tsx (new) + ChatPanel.tsx + task md
- Zero file overlap → zero merge conflict expected

If you need to touch ChatPanel.tsx or TypingDots.tsx → pause + flag architect.

### Commit style
Title: `P-505: Ambient background — drifting orbs + noise + dot-grid`
Co-Authored-By: `Claude Sonnet 4.6 <noreply@anthropic.com>`
