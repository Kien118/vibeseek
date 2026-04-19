# T-402 · 3D scene outer loading skeleton

**Status:** `done`
**Severity:** LOW (Phase 4 core polish — cosmetic)
**Blueprint ref:** §10 Phase 4 Core polish · T-402
**Branch:** `task/T-402-3d-loading-skeleton`
**Assignee:** _(TBD)_
**Depends on:** none.

## Context

**Current state (main `e54f5f7`):**
- `app/page.tsx` (landing) imports `LandingSceneCanvas` directly via static import:
  ```tsx
  'use client'
  import LandingSceneCanvas from '@/components/3d/LandingSceneCanvas'
  export default function HomePage() {
    return <main className="landing-page"><LandingSceneCanvas /></main>
  }
  ```
- `LandingSceneCanvas.tsx` has INNER Suspense fallback (`<Html center><SceneLoader /></Html>` rendered inside the `<Canvas>`). This handles model-asset loading AFTER R3F is initialized.
- **Gap:** the R3F library bundle (`@react-three/fiber` + `@react-three/drei` + Three.js + GLB assets) is ~300-500 KB. During initial JS chunk download, the whole landing page renders as a blank dark screen. Inner `<Html>` Suspense can't fire because `<Canvas>` itself hasn't mounted yet.

**User perception:** open vibeseek.com → blank screen 1-3s (depending on network) → suddenly DOJO mascot pops in. Looks broken during load.

**Fix:** use Next.js `dynamic()` to code-split `LandingSceneCanvas` into its own chunk with a `loading` component. While R3F chunk downloads, browser renders a lightweight HTML/CSS skeleton (purple glow centered on dark background). Zero R3F deps in the skeleton → renders immediately.

## Files to touch
- `vibeseek/app/page.tsx` — replace static import with `dynamic()` call; wire loading prop to new skeleton component
- `vibeseek/components/3d/CanvasSkeleton.tsx` (NEW — pure HTML/CSS, no R3F) — lightweight loading placeholder
- `tasks/T-402-3d-loading-skeleton.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/components/3d/LandingSceneCanvas.tsx` — the inner Suspense + SceneLoader stay. T-402 only adds an outer layer.
- `vibeseek/components/3d/SceneLoader.tsx` — that's the asset-load placeholder (shown once Canvas is mounted, while GLB loads). Unchanged.
- `vibeseek/components/3d/Experience.tsx`, `Experience`/models — unchanged.
- `vibeseek/app/layout.tsx` — unrelated (T-403 scope).
- Any other route (dashboard, quiz, chat, leaderboard) — they don't use R3F, no skeleton needed.
- `vibeseek/app/globals.css` — skeleton's styles inline via Tailwind, no globals change.

## Architect's spec

### 1. Create `vibeseek/components/3d/CanvasSkeleton.tsx`

Pure HTML/CSS placeholder. No imports beyond React. Renders a centered purple pulsing glow on dark background. Matches blueprint §2.1 palette (`--color-purple #a855f7`, `--color-bg #050505`).

```tsx
export default function CanvasSkeleton() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <div className="relative">
        {/* Outer pulsing glow */}
        <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-3xl animate-pulse" />
        {/* Inner core */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-80 animate-pulse flex items-center justify-center">
          <span className="text-white text-4xl font-bold">V</span>
        </div>
        {/* Caption below */}
        <p className="absolute top-full mt-8 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium whitespace-nowrap">
          Đang tải DOJO...
        </p>
      </div>
    </div>
  )
}
```

**Why this design:**
- `fixed inset-0` + dark bg = full-screen immediate paint, no layout shift when Canvas mounts.
- Purple pulsing glow = "alive" signal, on-brand.
- "Đang tải DOJO..." Vietnamese copy, matches VibeSeek voice.
- Zero 3D deps = renders in <50ms of HTML parse.

### 2. Update `vibeseek/app/page.tsx`

Convert static import to `dynamic()` with `ssr: false` (R3F requires browser Canvas API) + `loading` component.

```tsx
'use client'

import dynamic from 'next/dynamic'
import CanvasSkeleton from '@/components/3d/CanvasSkeleton'

const LandingSceneCanvas = dynamic(
  () => import('@/components/3d/LandingSceneCanvas'),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  }
)

export default function HomePage() {
  return <main className="landing-page"><LandingSceneCanvas /></main>
}
```

**Why `ssr: false`:** Three.js uses `window` + `document` during module init. Without `ssr: false`, Next.js will try to server-render it and crash on the build. The original static-import client component worked because `'use client'` made the whole page client-only, but with `dynamic()` we can be explicit.

**Why `loading: () => <CanvasSkeleton />`:** Next.js renders this while the async chunk downloads. Replaces the blank-screen gap.

**Why keep `'use client'` on page.tsx:** `dynamic()` itself is a client-side primitive (and `LandingSceneCanvas` is still a client component via its internal `'use client'`). Preserving the directive keeps behavior consistent.

### 3. Flow after T-402 merge

Timeline user sees on vibeseek.com initial load:
1. **0ms:** HTML document arrives. `<main class="landing-page">` + skeleton placeholder paint instantly (dark bg + purple glow + "Đang tải DOJO..." text).
2. **~200-500ms** (depending on bundle CDN): R3F chunk finishes downloading. Next.js swaps skeleton for `<LandingSceneCanvas />`.
3. **<Canvas> mounts.** Internal Suspense activates with `<SceneLoader />` while GLB assets load.
4. **~800-2000ms:** GLB loaded, Experience mounts, DOJO mascot visible.

Before T-402: steps 1-2 are blank screen.
After T-402: step 1 paints the skeleton immediately, step 2-3 swap to R3F infrastructure, step 3-4 swap to actual mascot.

## Acceptance criteria
- [ ] **AC-1:** `components/3d/CanvasSkeleton.tsx` exists, is a default-exported function component, has NO import of `@react-three/*` or `three`.
- [ ] **AC-2:** `app/page.tsx` imports `dynamic` from `next/dynamic` + uses `dynamic(() => import('@/components/3d/LandingSceneCanvas'), {...})` with `ssr: false` + `loading: () => <CanvasSkeleton />`.
- [ ] **AC-3:** `app/page.tsx` no longer has a static `import LandingSceneCanvas from '...'`. Grep final diff confirms replacement, not addition.
- [ ] **AC-4:** `cd vibeseek && npx tsc --noEmit` exit 0.
- [ ] **AC-5:** `cd vibeseek && npm run build` pass. Build output shows `LandingSceneCanvas` as separate chunk (not in the main page bundle).
- [ ] **AC-6 (User-runnable, post-merge):**
  - Open Chrome DevTools → Network tab → Throttle to "Slow 3G" → Hard-refresh landing page `/`.
  - Expected: skeleton (purple glow + "Đang tải DOJO...") paints within ~100ms. Stays on screen 2-8 seconds while R3F chunk downloads. Then DOJO mascot replaces skeleton smoothly.
  - Without throttling: on fast connection, skeleton may flash briefly (<200ms) — still better than blank flash.
- [ ] **AC-7:** Skeleton readable on mobile viewport (iPhone 13 390px). Phase 3 lesson: `text-white/60` explicit color applied to caption.
- [ ] **AC-8:** `LandingSceneCanvas.tsx` + `SceneLoader.tsx` + `Experience.tsx` byte-for-byte unchanged in PR diff.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- 2 code files + meta = 4 files in PR diff max
- No new deps in `package.json`

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | `dynamic()` + `ssr: false` fails build because Next.js 14 requires Client Component context | Page is already `'use client'`; `dynamic()` inside a client component with `ssr: false` is valid per Next.js 14 docs. |
| F-2 | Skeleton flashes on fast connections (distracting vs useful) | Accept for MVP — flash duration on fast conn is <100ms, negligible. On slow conn it saves user from blank-screen confusion (main goal). |
| F-3 | Skeleton layout clashes with `.landing-page` class from globals.css | CanvasSkeleton uses `fixed inset-0` — breaks out of parent flex/grid. Independent of `.landing-page` CSS. Verified via Phase 2 pattern. |
| F-4 | `'Đang tải DOJO...'` text invisible due to body `color: white` inherit | Explicit `text-white/60` class applied. Phase 3 lesson F-1 preempted. |
| F-5 | Skeleton's `animate-pulse` is janky (if Tailwind's default keyframes are slow) | Tailwind's `animate-pulse` is CSS-only + hardware-accelerated. No JS frame loop. No jank. |
| F-6 | Chunk split by Next.js bundler doesn't actually separate R3F from main bundle | `dynamic()` is the canonical Next.js tool for this. Build output lists chunks; AC-5 verifies separation. |
| F-7 | `ssr: false` breaks SEO (crawlers see skeleton, not 3D content) | Landing page has no SEO-critical text in the 3D scene. `metadata` export in layout.tsx covers title/description for crawlers. Accept. |
| F-8 | Skeleton's purple glow distracts while Canvas mounts | Blueprint §2.1 palette match. User has seen purple during normal navigation (VibePointsBadge, buttons). Not distracting. |
| F-9 | `animate-pulse` tailwind class isn't configured in `tailwind.config.ts` | `animate-pulse` is built into Tailwind core. No config needed. |
| F-10 | Agent inlines skeleton in page.tsx instead of separate component | Spec mandates separate `CanvasSkeleton.tsx` for reusability + single-responsibility. If agent inlines, reviewer requests separate component. |

## Local test plan

### Test 1 — tsc + build
```bash
cd vibeseek && npx tsc --noEmit && npm run build
```
Expected: exit 0. Build output shows a separate chunk for LandingSceneCanvas (look for a chunk name containing "LandingSceneCanvas" or a hashed chunk with size >100KB that was previously in the main page bundle).

### Test 2 — Dev server instant paint
```bash
cd vibeseek && npm run dev
```
Visit http://localhost:3000/ → verify landing renders skeleton first (may be brief on dev because no minification). Open DevTools → Performance → Reload → look for "First Paint" event with skeleton DOM nodes visible.

### Test 3 — Throttled network
DevTools → Network tab → Throttling dropdown → "Slow 3G" → Hard-refresh `/`. Expected:
- 0-100ms: skeleton paints
- 100ms-8s (estimated): skeleton stays, "Đang tải DOJO..." visible
- After chunk downloaded: skeleton disappears, Canvas mounts, SceneLoader fallback fires briefly, then DOJO mascot renders.

### Test 4 — Mobile viewport
iPhone 13 (390px). Skeleton centered, caption readable, glow not cut off.

### Test 5 — Diff verification
```bash
cd vibeseek
git diff main -- components/3d/LandingSceneCanvas.tsx
git diff main -- components/3d/SceneLoader.tsx
git diff main -- components/3d/Experience.tsx
```
All three should return empty diffs. Only `app/page.tsx` + new `CanvasSkeleton.tsx` touched.

## Non-goals (KHÔNG làm)
- KHÔNG refactor `LandingSceneCanvas.tsx` / `SceneLoader.tsx` / `Experience.tsx` / any GLB model loading logic
- KHÔNG add asset preloading (`<link rel="preload">`) for GLB files
- KHÔNG implement skeleton on other pages (dashboard, quiz, chat, leaderboard have no 3D — no need)
- KHÔNG add animation library (framer-motion etc.) — Tailwind's `animate-pulse` suffices
- KHÔNG add error state to the skeleton — if dynamic import fails, Next.js falls to root error.tsx (T-401 scope)
- KHÔNG prefetch the R3F chunk (would defeat code-splitting benefit)
- KHÔNG attempt SSR of R3F (it genuinely requires browser APIs)

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
- **D-1** — `next/dynamic` API on Next.js 14.2.x unchanged vs spec. Canonical `dynamic(() => import(...), { ssr: false, loading: () => <CanvasSkeleton /> })` applied byte-for-byte from spec §2. `'use client'` kept on `app/page.tsx` (spec-noted rationale: explicit client boundary keeps behavior obvious).
- **D-2** — `CanvasSkeleton.tsx` written verbatim from spec §1: pure Tailwind JSX (`fixed inset-0`, `animate-pulse` glow, `text-white/60` caption). Zero imports beyond React's implicit JSX runtime — no `@react-three/*`, no `three`, no `framer-motion`. `animate-pulse` is Tailwind core so no `tailwind.config.ts` touch (F-9 preempted). Phase 3 F-1 dark-body inherit preempted via explicit `text-white/60`.
- **D-3** — **AC-5 `npm run build` deferred to architect review.** Dev server detected LISTENING on `:3000` (PID 24640, `netstat -ano`). Per Phase 3 lesson (SESSION_HANDOFF step 5 + `memory/feedback_vibeseek_phase3_lessons.md`), running `npm run build` while dev server is active corrupts `.next/server/` chunks. Executor ran AC-4 `npx tsc --noEmit` (exit 0) as the safe type-check proxy. Architect to run AC-5 + chunk-split verification after pausing dev server.
- **D-4** — Protected-region grep clean: `git diff main -- vibeseek/components/3d/LandingSceneCanvas.tsx vibeseek/components/3d/SceneLoader.tsx vibeseek/components/3d/Experience.tsx` returned empty — AC-8 satisfied. `app/page.tsx` diff is a clean swap (-1 static import line, +8 lines for `import dynamic`, `import CanvasSkeleton`, `const LandingSceneCanvas = dynamic(...)` block) — AC-3 satisfied (replacement, not addition). Final PR diff = 4 files (page.tsx, CanvasSkeleton.tsx new, tasks/T-402-…md, AGENT_LOG.md), matches DoD cap.
- **D-5** — Multi-agent concurrency note for this session: T-401 + T-403+T-404 executors ran in parallel. A T-401 commit `7e75cc9` briefly landed via branch-switching chaos; it has since been confirmed on `task/T-401-error-boundaries` (correct branch). A `rescue/T-401-commit-landed-on-T-402-branch` ref was created as a safety backup — can be deleted once T-401 PR is open. T-402 branch `task/T-402-3d-loading-skeleton` final base is `206d606` (main), clean of cross-task contamination.

## Notes for reviewer
- Small task, should take executor <20 minutes / <50 LOC total.
- Reviewer runs dev server + Performance profiler to confirm skeleton paints first.
- Verify no regression on slow devices via throttling (AC-6).
- Protected-region grep: `LandingSceneCanvas|SceneLoader|Experience|Canvas` in diff — only expected matches are in `app/page.tsx` imports. Internal component files unchanged.
- Phase 3 UI checklist (dark-body inherit, 390px viewport overlap) trivially passes — skeleton is centered + has no right-edge elements.
- Phase 4 frame-extract technique doesn't apply (no video artifact).
