# P-506 · Button hover/press polish (Day 2 parallel batch)

**Status:** `done`
**Branch:** `task/P-506-button-polish`
**Assignee:** **claude-sonnet-4-6 executor dispatch, worktree isolation**
**Depends on:** P-506a merged (uses `sunflower-bright`, `shadow-glow-sun`, `shadow-glow-terra` tokens)
**Parallel siblings:** P-507 (text reveal), P-508 (confetti), P-509 (quiz feedback). Zero file overlap.

## Files to touch (exactly 3 files)
1. `vibeseek/app/globals.css` — add `.btn-polish` + `.btn-polish-terra` + `.btn-polish-sage` utility classes
2. `vibeseek/components/GlowButton.tsx` — apply `.btn-polish` to rendered button
3. `tasks/P-506-button-polish.md` — status transition

## Files NOT to touch
- `components/QuizCard.tsx` (P-509 owns)
- `components/VibeCard.tsx` (P-507 owns)
- `app/page.tsx` (P-507 owns)
- `app/quiz/[documentId]/page.tsx` (P-508 owns)
- `package.json` (P-508 owns new dep)
- `components/TextReveal.tsx`, `components/Confetti.tsx` (don't exist yet, P-507/P-508 create)
- `AGENT_LOG.md`, `ARCHITECT_BLUEPRINT.md` (architect close-out)

## Spec

### §1 — `globals.css` add 3 utility classes (append at end of file)

```css
/* =========================================================
 * P-506: Button hover/press polish — design-doc item 4
 * Hover: translateY(-2px) + glow shadow fade-in 200ms
 * Press: scale(0.96) 100ms bounce
 * Mobile gated via @media (hover: hover) — no hover on touch
 * ========================================================= */

.btn-polish {
  transition: transform 200ms ease, box-shadow 200ms ease;
  will-change: transform, box-shadow;
}
.btn-polish:active {
  transform: scale(0.96);
  transition-duration: 100ms;
}
@media (hover: hover) {
  .btn-polish:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(245, 184, 62, 0.30), 0 0 60px rgba(245, 184, 62, 0.12); /* sunflower glow */
  }
}

.btn-polish-terra {
  transition: transform 200ms ease, box-shadow 200ms ease;
  will-change: transform, box-shadow;
}
.btn-polish-terra:active {
  transform: scale(0.96);
  transition-duration: 100ms;
}
@media (hover: hover) {
  .btn-polish-terra:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(217, 108, 79, 0.28), 0 0 60px rgba(217, 108, 79, 0.12); /* terracotta glow */
  }
}

.btn-polish-sage {
  transition: transform 200ms ease, box-shadow 200ms ease;
  will-change: transform, box-shadow;
}
.btn-polish-sage:active {
  transform: scale(0.96);
  transition-duration: 100ms;
}
@media (hover: hover) {
  .btn-polish-sage:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(122, 155, 126, 0.28), 0 0 60px rgba(122, 155, 126, 0.12); /* sage glow */
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-polish, .btn-polish-terra, .btn-polish-sage,
  .btn-polish:hover, .btn-polish-terra:hover, .btn-polish-sage:hover,
  .btn-polish:active, .btn-polish-terra:active, .btn-polish-sage:active {
    transform: none;
    transition: none;
  }
}
```

### §2 — `GlowButton.tsx` apply `.btn-polish` class

Read current file. Add `btn-polish` to the rendered button's className (combined with existing classes). If GlowButton accepts a `variant` prop (e.g., "primary" / "terra" / "sage"), branch the polish class variant; otherwise default to `.btn-polish` (sunflower).

## AC

- [ ] **AC-1:** globals.css has 3 classes per §1 exactly + reduced-motion guard
- [ ] **AC-2:** GlowButton uses `.btn-polish` (or variant) on rendered button
- [ ] **AC-3:** `npx tsc --noEmit` exit 0
- [ ] **AC-4:** Zero diff on QuizCard.tsx / VibeCard.tsx / app/page.tsx / quiz page / package.json / TextReveal.tsx / Confetti.tsx / AGENT_LOG / BLUEPRINT
- [ ] **AC-5 (visual):** Hover any GlowButton on desktop → slight lift + warm glow. Click → brief scale-down bounce. On mobile (hover none) → no hover effect, just press scale.

## Commit + PR
Title: `P-506: Button hover/press polish`
Body: files summary + parallel-branch note
Co-Authored-By: Claude Sonnet 4.6
