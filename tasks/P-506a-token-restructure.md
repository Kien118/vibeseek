# P-506a · Token Restructure — flat hex → nested design-doc tokens + AI chat pattern upgrade

**Status:** `review`
**Severity:** HIGH (SSOT alignment, unblocks Day 2 P-506..P-509 batch which depend on missing variants `sunflower-bright`, `terracotta-soft`, `sage-bright`, shadow `glow-sun/terra/sage`)
**Branch:** `task/P-506a-token-restructure`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (mechanical sweep ~250 LOC + 1 semantic upgrade to ChatPanel AI bubble, spec-heavy pre-audited)
**Depends on:** P-503 + P-504 + P-505 merged (main tip `a642c08`)

---

## Context

User supplied `VIBESEEK_DESIGN.md` as **Single Source of Truth**. P-503 shipped a warm-palette foundation using flat hex literals (`bg-[#F5B83E]`, `bg-[#221D17]`, etc.). Design doc SSOT uses **nested Tailwind tokens** with variants + shadow glow tokens + a specific AI chat bubble pattern (terracotta tint + Patrick Hand).

This task: (a) restructure `tailwind.config.ts` to match design doc nested schema + missing variants + shadow glows, (b) sweep all flat hex in components to token class names, (c) upgrade ChatPanel AI bubble to design-doc pattern (terracotta/[0.12] bg + border + `font-hand` body + kicker label — **but keep "DOJO" not "Bé Vibe"** per user directive 2026-04-22).

**User constraint (locked 2026-04-22):**
> "Giữ nguyên DOJO như hiện tại. Không cần full rebrand. Áp dụng pattern visual (terracotta + Patrick Hand) cho AI chat bubble nhưng label/prompt vẫn là DOJO."

Design doc snippet says kicker text "Bé Vibe 🤔" — **override to "DOJO 🤔"**.

---

## Files to touch (~22 files)

### Token infrastructure (2 files)
1. `vibeseek/tailwind.config.ts` — restructure `colors` block nested per design doc + add missing variants + add `boxShadow` glow-sun/terra/sage
2. `vibeseek/app/globals.css` — update `:root` CSS vars for new variants (bright/deep/soft variants) + ensure nothing references flat names that no longer exist

### Component sweep (19 files) — mechanical flat hex → token class
3. `vibeseek/app/layout.tsx`
4. `vibeseek/components/ChatPanel.tsx` — **ALSO semantic upgrade §5** (AI bubble pattern)
5. `vibeseek/components/VibeCard.tsx`
6. `vibeseek/components/GlowButton.tsx`
7. `vibeseek/components/ProgressBar.tsx`
8. `vibeseek/components/UploadZone.tsx`
9. `vibeseek/components/DocumentHistory.tsx`
10. `vibeseek/components/LeaderboardTable.tsx`
11. `vibeseek/components/QuizCard.tsx`
12. `vibeseek/components/VibePointsBadge.tsx`
13. `vibeseek/components/VideoPlayer.tsx`
14. `vibeseek/components/TypingDots.tsx` — swap `bg-[#D96C4F]` → `bg-terracotta`
15. `vibeseek/components/AmbientBackground.tsx` — swap orb hex → token names in inline style (or keep hex since these are inside `style` attribute, not className — decide per §4)
16. `vibeseek/components/3d/CanvasSkeleton.tsx`
17. `vibeseek/app/chat/[documentId]/page.tsx`, `error.tsx`
18. `vibeseek/app/dashboard/page.tsx`, `error.tsx`
19. `vibeseek/app/leaderboard/page.tsx`, `error.tsx`
20. `vibeseek/app/quiz/[documentId]/page.tsx`, `error.tsx`
21. `vibeseek/app/error.tsx`, `vibeseek/app/not-found.tsx`

### Doc updates (1 file)
22. `tasks/P-506a-token-restructure.md` — this file status transitions

**NOT touched (parallel safety):** AGENT_LOG.md, ARCHITECT_BLUEPRINT.md — architect close-out handles. `scripts/render/` (P-5xx video task). `lib/` (logic). `utils/` (logic). `app/api/` (backend). `package.json` (no new deps).

---

## Architect's spec

### §1 — `tailwind.config.ts` colors + shadows

**Replace entire `theme.extend` block** with (copy-paste literal):

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        hand: ['var(--font-handwritten)', 'cursive'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        // Warm ink background system
        ink: {
          base:     '#17140F',
          surface:  '#221D17',
          elevated: '#2E2720',
          border:   '#3A3229',
        },
        // Paper text system
        paper: {
          cream: '#F5EFE4',
          soft:  '#E8DFC9',
        },
        stone: '#9A928A',
        // Accents
        sunflower: {
          DEFAULT: '#F5B83E',
          bright:  '#FFCE5E',
          deep:    '#C48920',
        },
        terracotta: {
          DEFAULT: '#D96C4F',
          soft:    '#E89478',
        },
        sage: {
          DEFAULT: '#7A9B7E',
          bright:  '#9ABDA0',
        },
        lapis: {
          DEFAULT: '#5B89B0',
          soft:    '#88A9C5',
        },
        plum: '#9B5675',
        // Error (preserved from P-503)
        'error-terra': '#C85A3C',
      },
      backgroundImage: {
        'glow-sunflower': 'radial-gradient(circle at 50% 50%, rgba(245,184,62,0.15) 0%, transparent 70%)',
        'glow-terracotta': 'radial-gradient(circle at 50% 50%, rgba(217,108,79,0.15) 0%, transparent 70%)',
        'mesh-gradient': 'linear-gradient(135deg, #17140F 0%, #1E1912 50%, #221D17 100%)',
      },
      backdropBlur: {
        xs: '2px',
        glass: '20px',
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scanLine 2s linear infinite',
        'vibe-spin': 'vibeSpin 20s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245,184,62,0.3)' },
          '50%': { boxShadow: '0 0 60px rgba(245,184,62,0.6), 0 0 100px rgba(217,108,79,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        vibeSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,239,228,0.1)',
        'glow-sun':   '0 0 30px rgba(245,184,62,0.30), 0 0 60px rgba(245,184,62,0.12)',
        'glow-terra': '0 0 30px rgba(217,108,79,0.28), 0 0 60px rgba(217,108,79,0.12)',
        'glow-sage':  '0 0 30px rgba(122,155,126,0.28), 0 0 60px rgba(122,155,126,0.12)',
      },
    },
  },
  plugins: [],
}
export default config
```

**Key nested tokens resolve as:**
- `bg-ink-base`, `bg-ink-surface`, `bg-ink-elevated`, `border-ink-border`
- `text-paper-cream`, `text-paper-soft` (Tailwind auto-resolves `DEFAULT` in `paper` if accessed as `bg-paper`)
- `bg-sunflower` (DEFAULT), `bg-sunflower-bright`, `bg-sunflower-deep`
- `bg-terracotta` (DEFAULT), `bg-terracotta-soft`
- `bg-sage` (DEFAULT), `bg-sage-bright`
- `bg-lapis` (DEFAULT), `bg-lapis-soft`
- `shadow-glow-sun`, `shadow-glow-terra`, `shadow-glow-sage`
- Alpha syntax works: `bg-sunflower/10`, `border-terracotta/30`, etc.

### §2 — `globals.css` CSS var review

**No changes required** if components only reference tokens via Tailwind classes (not via `var(--color-*)`). Scan the file: if any `.glitch-text`, `.landing-*`, `.dashboard-*`, `.scene-loader`, `.quiz-card`, etc. custom classes use `var(--color-purple)` or similar legacy vars → remove those vars from `:root` since no consumer remains.

**Current `:root` post-P-503 has 11 `--color-*` vars** (ink, surface, elevated, sunflower, terracotta, sage, lapis, plum, paper, paper-soft, stone, error). Keep all. Add 5 new variants for consistency (even if not immediately consumed):

```css
:root {
  /* Fonts (unchanged) */
  --font-display: 'Bricolage Grotesque', sans-serif;
  --font-body: 'Be Vietnam Pro', sans-serif;
  --font-handwritten: 'Patrick Hand', cursive;
  --font-serif: 'Fraunces', serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Ink system */
  --color-ink: #17140F;
  --color-surface: #221D17;
  --color-elevated: #2E2720;
  --color-ink-border: #3A3229;        /* NEW */
  /* Paper text */
  --color-paper: #F5EFE4;
  --color-paper-soft: #E8DFC9;
  --color-stone: #9A928A;
  /* Accents */
  --color-sunflower: #F5B83E;
  --color-sunflower-bright: #FFCE5E;  /* NEW */
  --color-sunflower-deep: #C48920;    /* NEW */
  --color-terracotta: #D96C4F;
  --color-terracotta-soft: #E89478;   /* NEW */
  --color-sage: #7A9B7E;
  --color-sage-bright: #9ABDA0;       /* NEW */
  --color-lapis: #5B89B0;
  --color-lapis-soft: #88A9C5;        /* NEW */
  --color-plum: #9B5675;
  --color-error: #C85A3C;

  --color-bg: var(--color-ink);       /* backward alias from P-503 */
}
```

### §3 — Flat hex → Tailwind token class mapping table

**Executor applies these substitutions across all 19 component/page files:**

| Flat hex (any form) | Tailwind class |
|---|---|
| `bg-[#17140F]` | `bg-ink-base` |
| `bg-[#221D17]` | `bg-ink-surface` |
| `bg-[#2E2720]` | `bg-ink-elevated` |
| `border-[#3A3229]` | `border-ink-border` |
| `text-[#F5EFE4]` | `text-paper-cream` |
| `text-[#F5EFE4]/<N>` | `text-paper-cream/<N>` (preserve alpha) |
| `bg-[#F5EFE4]` | `bg-paper-cream` |
| `bg-[#F5EFE4]/<N>` | `bg-paper-cream/<N>` |
| `border-[#F5EFE4]/<N>` | `border-paper-cream/<N>` |
| `text-[#E8DFC9]` | `text-paper-soft` |
| `bg-[#E8DFC9]` | `bg-paper-soft` |
| `text-[#9A928A]` | `text-stone` |
| `bg-[#9A928A]` | `bg-stone` |
| `border-[#9A928A]` | `border-stone` |
| `text-[#F5B83E]` | `text-sunflower` |
| `bg-[#F5B83E]` | `bg-sunflower` |
| `bg-[#F5B83E]/<N>` | `bg-sunflower/<N>` |
| `border-[#F5B83E]` | `border-sunflower` |
| `border-[#F5B83E]/<N>` | `border-sunflower/<N>` |
| `bg-[#E0A535]` (P-503 hover) | `bg-sunflower-deep` (closest semantic = pressed/darker; or keep `bg-[#E0A535]` if exact color matters) — **use `bg-sunflower-deep`** |
| `bg-[#7CA0C5]` | `text-lapis-soft` or `bg-lapis-soft` (semantic = lighter lapis) |
| `text-[#5C7B60]` (P-503 darker sage) | `text-sage` (design doc has no darker sage variant; use default) |
| `text-[#D96C4F]` | `text-terracotta` |
| `bg-[#D96C4F]` | `bg-terracotta` |
| `bg-[#D96C4F]/<N>` | `bg-terracotta/<N>` |
| `border-[#D96C4F]` | `border-terracotta` |
| `border-[#D96C4F]/<N>` | `border-terracotta/<N>` |
| `text-[#7A9B7E]` | `text-sage` |
| `bg-[#7A9B7E]` | `bg-sage` |
| `bg-[#7A9B7E]/<N>` | `bg-sage/<N>` |
| `border-[#7A9B7E]` | `border-sage` |
| `border-[#7A9B7E]/<N>` | `border-sage/<N>` |
| `text-[#5B89B0]` | `text-lapis` |
| `bg-[#5B89B0]` | `bg-lapis` |
| `border-[#5B89B0]` | `border-lapis` |
| `bg-[#5B89B0]/<N>` | `bg-lapis/<N>` |
| `text-[#9B5675]` | `text-plum` |
| `bg-[#9B5675]` | `bg-plum` |
| `text-[#C85A3C]` | `text-error-terra` |
| `bg-[#C85A3C]` | `bg-error-terra` |
| `bg-[#C85A3C]/<N>` | `bg-error-terra/<N>` |
| `border-[#C85A3C]` | `border-error-terra` |
| `border-[#C85A3C]/<N>` | `border-error-terra/<N>` |
| `text-[#E8A08A]` (lighter error from P-503) | `text-error-terra` (no lighter variant — use default) |
| Gradient `from-[#F5B83E] to-[#D96C4F]` | `from-sunflower to-terracotta` |

### §4 — `AmbientBackground.tsx` exception

Inline `style={{ background: 'radial-gradient(circle, #F5B83E 0%, transparent 70%)' }}` cannot use Tailwind classes (it's a `style` object not `className`). **Keep hex literals here** — CSS-in-JS via inline style must use literal values. AC-4 grep excludes this file for the `#F5B83E`/`#D96C4F`/`#7A9B7E` pattern.

Alternative: refactor to CSS variables `var(--color-sunflower)` in the `radial-gradient` string. Valid and preferred. Apply:

```tsx
// Orb 1 — sunflower
style={{
  background: 'radial-gradient(circle, var(--color-sunflower) 0%, transparent 70%)',
  top: '-10%',
  left: '-10%',
}}
```

(Same pattern for orbs 2 + 3, `--color-terracotta`, `--color-sage`.) Dot-grid overlay `radial-gradient(circle, #F5EFE4 1px, transparent 1px)` → `radial-gradient(circle, var(--color-paper) 1px, transparent 1px)`.

### §5 — `ChatPanel.tsx` AI bubble pattern upgrade (design doc §Chat Bubble)

**Current assistant bubble** (post-Token-sweep flat hex → class but BEFORE §5 pattern upgrade):
```tsx
<div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
  m.role === 'user'
    ? (m.mode === 'feynman' ? 'bg-sage text-ink-base' : 'bg-sunflower text-ink-base')
    : 'bg-ink-elevated text-paper-cream/90'
}`}>
```

**Upgrade assistant bubble** to design-doc pattern (`self-start max-w-[82%] px-4.5 py-3.5 rounded-2xl rounded-bl-sm bg-terracotta/[0.12] border border-terracotta/30 font-hand text-xl leading-tight text-paper-cream relative`) + kicker label `DOJO 🤔` (NOT "Bé Vibe"):

```tsx
<div
  key={m.id}
  className={m.role === 'user' ? 'text-right' : 'text-left'}
>
  {m.role === 'assistant' ? (
    <div className="relative inline-block max-w-[82%] px-4 py-3 rounded-2xl rounded-bl-sm
      bg-terracotta/[0.12] border border-terracotta/30
      font-hand text-xl leading-tight text-paper-cream
      whitespace-pre-wrap mt-5">
      <span className="absolute -top-5 left-2.5 font-mono text-[10px] tracking-wider
        uppercase text-terracotta">DOJO 🤔</span>
      {m.content ? (
        m.content
      ) : streamingId === m.id ? (
        <TypingDots />
      ) : null}
    </div>
  ) : (
    <div className={`inline-block max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm whitespace-pre-wrap font-body font-medium text-sm leading-relaxed ${
      m.mode === 'feynman' ? 'bg-sage text-ink-base' : 'bg-sunflower text-ink-base'
    }`}>
      {m.content || ''}
    </div>
  )}
</div>
```

**Key changes in assistant bubble:**
- `bg-ink-elevated` → `bg-terracotta/[0.12]` + `border border-terracotta/30` (design-doc tinted pattern)
- `rounded-lg` → `rounded-2xl rounded-bl-sm` (tail on bottom-left per design)
- `font-hand text-xl leading-tight` (Patrick Hand, larger, tighter — hand-written feel)
- New kicker label `DOJO 🤔` above bubble (absolute positioned, mono font, uppercase, terracotta color)
- `mt-5` extra top margin to make room for kicker

**User bubble unchanged** except small polish:
- `rounded-lg` → `rounded-2xl rounded-br-sm` (tail bottom-right, design parity)
- `font-body font-medium text-sm leading-relaxed` (explicit body font)
- Mode colors (sunflower default, sage Feynman) preserved

**Feynman round counter + toggle UI** (the header above chat scroll): NO pattern change, just token sweep per §3.

**TypingDots.tsx** (inside assistant bubble during stream): terracotta dots still match — no change needed beyond §3 hex swap.

---

## Acceptance criteria

- [ ] **AC-1:** `tailwind.config.ts` has nested `colors` block per §1 exact (ink/paper nested; sunflower/terracotta/sage/lapis with DEFAULT + variants; shadow glow-sun/terra/sage added).
- [ ] **AC-2:** `globals.css` `:root` has 5 new variant vars (`--color-ink-border`, `--color-sunflower-bright`, `--color-sunflower-deep`, `--color-terracotta-soft`, `--color-sage-bright`, `--color-lapis-soft`). Existing vars preserved.
- [ ] **AC-3:** `npx tsc --noEmit` exit 0.
- [ ] **AC-4:** Grep sentinel on components + app (EXCLUDING AmbientBackground.tsx inline style): `grep -rE "bg-\[#|text-\[#|border-\[#|from-\[#|to-\[#" vibeseek/components vibeseek/app | grep -v "AmbientBackground.tsx"` returns **zero matches**. AmbientBackground's 3 orb hex + dot-grid hex are refactored to `var(--color-*)` per §4.
- [ ] **AC-5:** `ChatPanel.tsx` assistant bubble renders with `bg-terracotta/[0.12] border border-terracotta/30 font-hand text-xl` + kicker label `DOJO 🤔` (NOT "Bé Vibe" — this is critical).
- [ ] **AC-6:** User bubble still shows sunflower (default mode) / sage (Feynman mode) with `rounded-br-sm` tail.
- [ ] **AC-7:** No new deps. `package.json`/`package-lock.json` zero diff.
- [ ] **AC-8:** AGENT_LOG.md, ARCHITECT_BLUEPRINT.md, scripts/render/, lib/, utils/, app/api/ — all zero diff.
- [ ] **AC-9 (visual smoke, local dev):** Chat page on `/chat/[id]`: assistant messages appear as warm terracotta tint handwritten bubbles with "DOJO 🤔" kicker floating above. User messages crisp sunflower (or sage in Feynman mode) with Be Vietnam Pro body font. Feynman toggle/badge/round counter still work.
- [ ] **AC-10:** TypingDots still renders 3 terracotta dots when streaming — now they sit inside the terracotta-tinted bubble.

## Definition of Done

- All AC pass
- Task status `spec` → `review` → `done`
- PR title `P-506a: Token restructure — nested tokens + AI chat pattern upgrade`
- Exactly ~22 files in PR
- Architect close-out commits AGENT_LOG + BLUEPRINT after merge

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Tailwind `paper.cream` doesn't resolve as `bg-paper-cream` | Tailwind 3 resolves nested keys as `bg-paper-cream`. `DEFAULT` key accessed as `bg-paper`. Test with `npx tsc` + dev server. |
| F-2 | Alpha syntax `bg-sunflower/10` breaks on nested key | Tailwind 3 supports alpha on DEFAULT key: `bg-sunflower/10` = `bg-sunflower-DEFAULT/10` auto. Tested pattern. |
| F-3 | `font-hand` class doesn't resolve | `fontFamily.hand` in config §1. Executor verifies `class="font-hand"` applies Patrick Hand. |
| F-4 | User bubble Feynman mode (sage) becomes hard to read on AI bubble nearby | AI always terracotta, user always sunflower/sage — distinct color families. Visual test in Feynman chat. |
| F-5 | "Bé Vibe" label accidentally used instead of "DOJO" | Spec §5 literal `DOJO 🤔`. AC-5 gate. User directive 2026-04-22 locked. |
| F-6 | Existing `font-display`/`font-body` classes break after tailwind.config.ts rewrite | §1 preserves `fontFamily.display/body/hand/serif/mono`. Zero change. |
| F-7 | AmbientBackground orbs disappear after `var(--color-*)` swap | CSS var must exist in `:root`. §2 ensures. Test: inspect computed style of orb div. |
| F-8 | Alpha-with-slash syntax `bg-[#F5B83E]/20` in mid-component doesn't get swapped | §3 map includes `/<N>` variants. Sonnet applies to all alpha variants. Grep AC-4 catches any miss. |
| F-9 | Executor misses files not listed (e.g. a new component added Day 1) | Executor runs post-sweep grep to catch strays. Pre-sweep inventory: 19 files use flat hex (verified by architect). |
| F-10 | P-504/P-505 new files have flat hex | `TypingDots.tsx` has `bg-[#D96C4F]` → swap to `bg-terracotta`. `AmbientBackground.tsx` handled per §4. |
| F-11 | Feynman mode distinction lost (user can't tell which mode) | User bubble color + header badge (🥋 FEYNMAN DOJO • Round X/3) still distinguishes. AI bubble unified terracotta is by design — matches SSOT. |
| F-12 | Patrick Hand font makes long assistant responses hard to read | `text-xl leading-tight` is per design doc. User feedback post-merge if readability issue. Easy tune. |

---

## Local test plan

### Test 1 — tsc
`cd vibeseek && npx tsc --noEmit` → exit 0

### Test 2 — AC-4 grep
```bash
cd D:/Wangnhat/Study/VibeCode/vibeseek && grep -rE "bg-\[#|text-\[#|border-\[#|from-\[#|to-\[#" components app 2>&1 | grep -v -E "node_modules|\.next|AmbientBackground" | head -5
```
Expected: empty.

### Test 3 — Dev smoke
`cd vibeseek && npm run dev` → open:
- `/chat/[someDocId]` — verify AI bubble: terracotta tint + handwritten font + "DOJO 🤔" kicker. Verify user bubble: sunflower or sage crisp.
- `/dashboard` — cards render correctly with new tokens.
- `/leaderboard` — table rows render.
- `/quiz/[id]` — quiz options render.
- Landing `/` — drifting orbs still visible (AmbientBackground still works with CSS var refactor).

### Test 4 — Build
`cd vibeseek && npm run build` — must succeed. Tailwind purge includes new token classes.

---

## Non-goals

- KHÔNG rebrand "DOJO" → "Bé Vibe" (user directive locked)
- KHÔNG add light mode toggle (separate task)
- KHÔNG add motion beyond what P-504/P-505 shipped
- KHÔNG add new components (sweep only)
- KHÔNG touch render.mjs (Video update separate)
- KHÔNG touch prompts / routes / backend
- KHÔNG add new deps
- KHÔNG touch AGENT_LOG / BLUEPRINT (architect close-out)

---

## Decisions log

_Populated by claude-sonnet-4-6 executor, 2026-04-22._

1. **`font-hand` alias** — `tailwind.config.ts` now exposes `fontFamily.hand` as `['var(--font-handwritten)', 'cursive']`. This enables `font-hand` in the AI bubble per §5. The old `fontFamily.handwritten` key is removed; any usage of `font-handwritten` class would break — confirmed no components used that class (they all used inline var() directly).

2. **Nested `ink.*` tokens** — old flat `ink`, `surface`, `elevated` tokens (string values) replaced with nested `ink.base`, `ink.surface`, `ink.elevated`, `ink.border`. All former usages like `bg-ink` or `text-ink` in ChatPanel were updated to `bg-ink-surface`, `bg-ink-elevated`, `text-ink-base` as appropriate.

3. **`paper` token** — kept nested (`paper.cream`, `paper.soft`). The old `paper.DEFAULT` is gone; usage of `bg-paper` would resolve to undefined. Swept all `text-[#F5EFE4]` → `text-paper-cream` and `bg-[#F5EFE4]` → `bg-paper-cream` across all 19 files.

4. **`text-ink` in user bubble** — old code had `text-ink` (flat token no longer exists). Updated to `text-ink-base` (nested token) for both sage and sunflower mode user bubbles.

5. **`hover:bg-elevated`** — old flat `elevated` token gone. Updated to `hover:bg-ink-elevated` in ChatPanel mode toggle buttons.

6. **VideoPlayer `text-[#E8A08A]`** (lighter error, no variant in new schema) — mapped to `text-error-terra` per §3 ("no lighter variant — use default").

7. **AmbientBackground** — all 3 orb hex + dot-grid hex converted to `var(--color-*)` CSS variables. Excluded from AC-4 grep per spec §4.

8. **`layout.tsx` Toaster inline styles** — uses JS object `style={{ background: '...' }}` not Tailwind classes; correct per spec (inline styles don't use Tailwind). No change needed.

9. **`DOJO 🤔` kicker** — applied as `absolute -top-5 left-2.5` span with `font-mono text-[10px] tracking-wider uppercase text-terracotta`. User directive 2026-04-22 locked — NOT "Bé Vibe".

10. **AC-4 result** — grep `bg-\[#|text-\[#|border-\[#|from-\[#|to-\[#` across `components/` and `app/` (excluding AmbientBackground) returns zero matches.

11. **`npx tsc --noEmit`** — exits 0, no type errors.

---

## Notes for reviewer

### Dispatch model
Sonnet. Mechanical sweep with literal mapping table §3 + explicit design-doc pattern §5. No judgment.

### Commit style
Title: `P-506a: Token restructure — nested tokens + AI chat pattern upgrade`
Co-Authored-By: `Claude Sonnet 4.6 <noreply@anthropic.com>`

### Architect post-merge
- Architect close-out commit: AGENT_LOG + SESSION_HANDOFF + BLUEPRINT §13 entry
- Day 2 batch (P-506 hover + P-507 text reveal + P-508 confetti + P-509 quiz feedback) can dispatch AFTER this — they'll use the new variant tokens (`sunflower-bright`, `sage-bright`) + shadow glows (`shadow-glow-sun`, `shadow-glow-sage`)
