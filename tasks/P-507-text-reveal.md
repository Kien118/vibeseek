# P-507 · Text reveal chapter title (Day 2 parallel batch)

**Status:** `spec`
**Branch:** `task/P-507-text-reveal`
**Assignee:** **claude-sonnet-4-6 executor dispatch, worktree isolation**
**Depends on:** P-506a merged
**Parallel siblings:** P-506, P-508, P-509. Zero file overlap.

## Files to touch (exactly 4 files)
1. `vibeseek/components/TextReveal.tsx` (**NEW** ~40 LOC) — reusable per-char reveal animation (30ms/char)
2. `vibeseek/app/page.tsx` — wrap landing heading (hero title) with `<TextReveal>`
3. `vibeseek/components/VibeCard.tsx` — wrap chapter kicker text with `<TextReveal>` (optional light — keep if low-risk)
4. `tasks/P-507-text-reveal.md` — status

## Files NOT to touch
- `components/GlowButton.tsx`, `app/globals.css` (P-506 owns)
- `app/quiz/[documentId]/page.tsx`, `package.json`, `components/Confetti.tsx` (P-508 owns)
- `components/QuizCard.tsx` (P-509 owns)
- `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md`

## Spec

### §1 — `components/TextReveal.tsx` (NEW)

```tsx
'use client'

import { motion } from 'framer-motion'

interface Props {
  text: string
  charDelay?: number  // ms per char, default 30
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'div'
}

/**
 * P-507: Apple Vision Pro-style text reveal. Each char fades+translates in,
 * staggered by `charDelay` (default 30ms). Respects prefers-reduced-motion.
 */
export default function TextReveal({ text, charDelay = 30, className, as = 'span' }: Props) {
  const Tag = motion[as] as typeof motion.span
  const chars = Array.from(text)

  return (
    <Tag className={className} aria-label={text}>
      {chars.map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: (i * charDelay) / 1000,
            duration: 0.3,
            ease: 'easeOut',
          }}
          aria-hidden="true"
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char}
        </motion.span>
      ))}
    </Tag>
  )
}
```

Accessibility: outer tag has `aria-label={text}` (screen readers read full text), inner spans `aria-hidden`.

### §2 — `app/page.tsx` apply to landing hero

Read current `app/page.tsx`. It's:
```tsx
'use client'
import dynamic from 'next/dynamic'
import CanvasSkeleton from '@/components/3d/CanvasSkeleton'
const LandingSceneCanvas = dynamic(() => import('@/components/3d/LandingSceneCanvas'), { ssr: false, loading: () => <CanvasSkeleton /> })
export default function HomePage() {
  return <main className="landing-page"><LandingSceneCanvas /></main>
}
```

Landing hero is inside `LandingSceneCanvas` — Three.js scene, not plain DOM. Text reveal on 3D text requires deeper work. **Scope this task minimally**:

Option A: Skip landing (Three.js doesn't have DOM text to reveal). Apply to **first meaningful H1 on dashboard** instead. Read `app/dashboard/page.tsx`, find the page title H1 (e.g., "Dashboard", "Upload tài liệu" or similar), wrap with `<TextReveal as="h1" text="..." className="...existing classes..." />`.

Option B: If dashboard H1 not obviously present, apply to a heading in `components/VibeCard.tsx` (chapter kicker).

**Executor chooses the most impactful heading** and wraps it. Scope: minimum 1 H1 reveal visible in demo flow (landing OR dashboard). Document choice in task md Decisions log.

### §3 — `components/VibeCard.tsx` chapter kicker (optional, light)

If VibeCard has a kicker line like "CHƯƠNG 02 · SINH HỌC 11" (per design doc) — wrap with `<TextReveal as="span" charDelay={20} />` for kicker reveal effect. If kicker doesn't match this pattern currently, **skip** — don't force.

## AC

- [ ] **AC-1:** `components/TextReveal.tsx` created per §1, reusable, reduced-motion guard via framer-motion native support
- [ ] **AC-2:** At least ONE heading (landing OR dashboard OR VibeCard kicker) wrapped with `<TextReveal>`, visible in demo flow
- [ ] **AC-3:** `npx tsc --noEmit` exit 0
- [ ] **AC-4:** No new deps (framer-motion already installed)
- [ ] **AC-5:** Zero diff on globals.css, GlowButton, QuizCard, quiz page, Confetti, package.json
- [ ] **AC-6 (visual):** Heading chars fade+slide in staggered 30ms each when entering viewport/page

## Commit + PR
Title: `P-507: Text reveal chapter title`
Co-Authored-By: Claude Sonnet 4.6
