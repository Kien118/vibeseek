# P-509 · Quiz feedback motion (Day 2 parallel batch)

**Status:** `done`
**Branch:** `task/P-509-quiz-feedback`
**Assignee:** **claude-sonnet-4-6 executor dispatch, worktree isolation**
**Depends on:** P-506a merged (uses `border-sage`, `bg-sage/[0.12]`, `border-error-terra`, `bg-error-terra/[0.12]` tokens)
**Parallel siblings:** P-506, P-507, P-508. Zero file overlap.

## Files to touch (exactly 2 files)
1. `vibeseek/components/QuizCard.tsx` — motion upgrades to reveal state (already has `revealed` stage)
2. `tasks/P-509-quiz-feedback.md` — status

## Files NOT to touch
- `app/quiz/[documentId]/page.tsx` (P-508 owns confetti on done state)
- Everything else

## Spec

Design-doc rules (item 8):
- **Chọn đúng:** border glow sage + check mark vẽ từ trái qua phải (SVG stroke-dasharray animation)
- **Chọn sai:** shake ngang nhẹ (3 lần, biên độ 4px) + border error-terra
- **Auto-highlight:** đáp án đúng tự highlight sau 500ms nếu user sai

### §1 — Upgrade `classForOption` in QuizCard.tsx

Current (post-P-506a):
```tsx
function classForOption(idx: number) {
  if (stage === 'answering') {
    return selected === idx ? 'border-sunflower bg-sunflower/20' : 'border-paper-cream/10 bg-paper-cream/5 hover:border-paper-cream/30'
  }
  if (idx === result?.correctIndex) return 'border-sage bg-sage/20'
  if (idx === selected && !result?.correct) return 'border-error-terra bg-error-terra/20'
  return 'border-paper-cream/10 bg-paper-cream/5 opacity-60'
}
```

Add classes to trigger animations:

```tsx
function classForOption(idx: number) {
  if (stage === 'answering') {
    return selected === idx ? 'border-sunflower bg-sunflower/20' : 'border-paper-cream/10 bg-paper-cream/5 hover:border-paper-cream/30'
  }
  // revealed
  const isCorrectAnswer = idx === result?.correctIndex
  const isUserWrongPick = idx === selected && !result?.correct
  if (isCorrectAnswer) return 'border-sage bg-sage/20 shadow-glow-sage animate-[correctPulse_600ms_ease-out]'
  if (isUserWrongPick) return 'border-error-terra bg-error-terra/20 animate-[wrongShake_400ms_ease-in-out]'
  return 'border-paper-cream/10 bg-paper-cream/5 opacity-60'
}
```

### §2 — Add keyframes for shake + correctPulse

Since we can't touch globals.css (P-506 boundary-safe), inline keyframes via `<style jsx>` OR extend tailwind.config via animation key. But we also can't touch tailwind.config.ts in P-509 scope (out of spec).

**Solution:** use framer-motion inline animate props on the button. Keep classForOption returning static classes (color + border only), and wrap each option button with `<motion.button>` that animates on mount of revealed state:

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// Inside the map loop, replace <button> with <motion.button>:
<motion.button
  key={idx}
  disabled={stage === 'revealed'}
  onClick={() => setSelected(idx)}
  // Animation triggers when stage becomes 'revealed'
  animate={
    stage === 'revealed' && idx === result?.correctIndex
      ? { scale: [1, 1.03, 1], transition: { duration: 0.5 } }
      : stage === 'revealed' && idx === selected && !result?.correct
        ? { x: [0, -4, 4, -4, 4, 0], transition: { duration: 0.4 } }
        : {}
  }
  className={`
    w-full text-left px-5 py-3 rounded-2xl border transition
    text-paper-cream/90 font-body
    ${classForOption(idx)}
  `}
>
  ...children unchanged...
</motion.button>
```

`classForOption` reverts to simple token classes (no animation class names):

```tsx
function classForOption(idx: number) {
  if (stage === 'answering') {
    return selected === idx ? 'border-sunflower bg-sunflower/20' : 'border-paper-cream/10 bg-paper-cream/5 hover:border-paper-cream/30'
  }
  if (idx === result?.correctIndex) return 'border-sage bg-sage/20 shadow-glow-sage'
  if (idx === selected && !result?.correct) return 'border-error-terra bg-error-terra/20'
  return 'border-paper-cream/10 bg-paper-cream/5 opacity-60'
}
```

### §3 — Auto-highlight correct after 500ms delay (when user picks wrong)

Currently result is revealed immediately on submit — correct answer shows at stage transition. Design wants: if user picks WRONG, highlight THEIR wrong pick immediately, then after 500ms pulse the correct one.

Implementation: use framer-motion's `delay` on correct-answer `motion.button` animate prop when user answered wrong:

```tsx
animate={
  stage === 'revealed' && idx === result?.correctIndex
    ? {
        scale: [1, 1.03, 1],
        transition: {
          duration: 0.5,
          delay: result?.correct ? 0 : 0.5, // wait 500ms if user was wrong
        },
      }
    : stage === 'revealed' && idx === selected && !result?.correct
      ? { x: [0, -4, 4, -4, 4, 0], transition: { duration: 0.4 } }
      : {}
}
```

### §4 — SVG check mark draw animation (correct answer)

Currently CheckCircle2 icon shows statically on correct answer. Design wants animated draw-in. Use framer-motion on the icon wrapper:

Current:
```tsx
{stage === 'revealed' && idx === result?.correctIndex && (
  <CheckCircle2 className="inline-block w-4 h-4 ml-2 text-sage" />
)}
```

Upgrade:
```tsx
{stage === 'revealed' && idx === result?.correctIndex && (
  <motion.span
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: result?.correct ? 0.2 : 0.7, type: 'spring', stiffness: 260, damping: 18 }}
    className="inline-block"
  >
    <CheckCircle2 className="inline-block w-4 h-4 ml-2 text-sage" />
  </motion.span>
)}
```

(Scale-in spring gives "stamp" feel. Real SVG stroke-dasharray draw would need custom SVG; spring scale is a good proxy for demo.)

XCircle on wrong:
```tsx
{stage === 'revealed' && idx === selected && !result?.correct && (
  <motion.span
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    className="inline-block"
  >
    <XCircle className="inline-block w-4 h-4 ml-2 text-error-terra" />
  </motion.span>
)}
```

## AC

- [x] **AC-1:** `QuizCard.tsx` option buttons use `motion.button` with conditional animate prop per §2
- [x] **AC-2:** Correct answer: scale-pulse 1→1.03→1 over 500ms, + `shadow-glow-sage` class, + check icon springs in (delay 0 if user correct, 0.5s if user wrong)
- [x] **AC-3:** Wrong user pick: horizontal shake 6 frames ±4px over 400ms, + X icon springs in
- [x] **AC-4:** `npx tsc --noEmit` exit 0
- [x] **AC-5:** Zero diff on app/quiz/[documentId]/page.tsx, globals.css, tailwind.config.ts, GlowButton.tsx, TextReveal.tsx (not created here), Confetti.tsx (not created here), VibeCard.tsx, app/page.tsx, package.json
- [x] **AC-6 (visual):** Answer a quiz question correctly → option pulses with sage glow + check stamps in. Answer incorrectly → user's pick shakes left-right with error-terra border + X stamps, then correct answer pulses 500ms later with sage glow + check.

## Commit + PR
Title: `P-509: Quiz feedback motion`
Co-Authored-By: Claude Sonnet 4.6
