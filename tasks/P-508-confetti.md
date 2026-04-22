# P-508 · Confetti VibePoints celebration (Day 2 parallel batch)

**Status:** `spec`
**Branch:** `task/P-508-confetti`
**Assignee:** **claude-sonnet-4-6 executor dispatch, worktree isolation**
**Depends on:** P-506a merged
**Parallel siblings:** P-506, P-507, P-509. Zero file overlap.

## Files to touch (exactly 5 files)
1. `vibeseek/package.json` + `vibeseek/package-lock.json` — add `canvas-confetti` + `@types/canvas-confetti` deps
2. `vibeseek/components/Confetti.tsx` (**NEW** ~50 LOC) — client component wrapper using `canvas-confetti`
3. `vibeseek/app/quiz/[documentId]/page.tsx` — trigger Confetti when entering `done` phase with `correctCount/totalQuestions >= 0.7` (70%)
4. `tasks/P-508-confetti.md` — status

## Files NOT to touch
- `components/QuizCard.tsx` (P-509 owns)
- `components/GlowButton.tsx`, `app/globals.css` (P-506)
- `components/TextReveal.tsx`, `app/page.tsx`, `components/VibeCard.tsx` (P-507)
- `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md`

## Spec

### §1 — Install deps

```bash
cd vibeseek && npm install --save canvas-confetti && npm install --save-dev @types/canvas-confetti
```

(`canvas-confetti` ~5KB gzipped, pure canvas, no peer deps. `@types/canvas-confetti` for TypeScript.)

### §2 — `components/Confetti.tsx` (NEW)

```tsx
'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  trigger: boolean
  origin?: { x: number; y: number } // 0..1 viewport coords, default center-top
}

/**
 * P-508: Fire confetti burst when `trigger` flips true.
 * Sunflower + sage + terracotta palette, 30 particles, 1.2s duration.
 * Respects prefers-reduced-motion (skips animation if user prefers).
 */
export default function Confetti({ trigger, origin = { x: 0.5, y: 0.3 } }: Props) {
  useEffect(() => {
    if (!trigger) return
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    confetti({
      particleCount: 30,
      spread: 70,
      startVelocity: 45,
      ticks: 120,
      origin,
      colors: ['#F5B83E', '#7A9B7E', '#D96C4F', '#FFCE5E'], // sunflower + sage + terracotta + sunflower-bright
      scalar: 1.1,
      gravity: 1.2,
    })
  }, [trigger, origin])

  return null
}
```

### §3 — `app/quiz/[documentId]/page.tsx` trigger

Read current file. Locate the `phase === 'done'` render branch. Add:

```tsx
import Confetti from '@/components/Confetti'
import { useMemo } from 'react'

// inside component, compute trigger:
const scoreRatio = useMemo(
  () => (questions.length > 0 ? correctCount / questions.length : 0),
  [correctCount, questions.length],
)
const celebrate = phase === 'done' && scoreRatio >= 0.7

// inside phase === 'done' JSX, add component:
{celebrate && <Confetti trigger={celebrate} />}
```

Place `<Confetti>` ABOVE the existing `<main>` inside done branch so it mounts when phase enters 'done' with good score. The `trigger` prop passed to Confetti fires the burst exactly once via useEffect dependency.

## AC

- [ ] **AC-1:** `canvas-confetti` + `@types/canvas-confetti` added to package.json (1 prod + 1 dev dep). package-lock.json reflects install.
- [ ] **AC-2:** `components/Confetti.tsx` per §2 exactly
- [ ] **AC-3:** `app/quiz/[documentId]/page.tsx` triggers Confetti on `phase === 'done' && correctCount/total >= 0.7`
- [ ] **AC-4:** `npx tsc --noEmit` exit 0
- [ ] **AC-5:** Zero diff on QuizCard.tsx, GlowButton.tsx, globals.css, TextReveal.tsx (not created), VibeCard.tsx, app/page.tsx
- [ ] **AC-6 (visual):** Finish a quiz with ≥70% correct → confetti burst 30 particles (sunflower/sage/terracotta) from upper-center. Finish with <70% → no confetti.

## Notes for executor

- `canvas-confetti` has its own canvas, no conflict with Three.js or framer-motion.
- `prefers-reduced-motion` guard per design doc rule.
- Trigger fires exactly once via useEffect dependency array [trigger, origin] — if `celebrate` toggles true on done-phase mount, fires once.

## Commit + PR
Title: `P-508: Confetti VibePoints celebration`
Co-Authored-By: Claude Sonnet 4.6
