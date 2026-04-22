# P-503 · Brand Tokens — fonts + palette foundation (Day 1 Track A)

**Status:** `review`
**Severity:** HIGH (unblock Day 1-4 brand work across 3+ parallel Sonnet tracks)
**Blueprint ref:** §13 changelog slot · new §3 design tokens section TBD
**Branch:** `task/P-503-brand-tokens`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (mechanical palette + font swap across 23 files, spec gives literal mapping table — no judgment)
**Depends on:** P-502 merged (no conflict with chat_messages infrastructure)

---

## Context

User rebrand directive 2026-04-22 — swap cyberpunk palette (pink/cyan/purple/acid) to warm academic palette (Sunflower/Terracotta/Sage/Lapis/Plum) on near-black warm base. Fonts swap to Bricolage Grotesque (display) / Be Vietnam Pro (body) / Patrick Hand (handwritten) / Fraunces (serif) / JetBrains Mono (keep). Dark mode only v1 (light mode toggle ship in later task P-50X).

**This task = foundation batch (Day 1 Track A).** Must merge before Day 1 Track B dispatches (typing indicator P-504 + ambient bg P-505) — both depend on new tokens.

**Scope:** palette swap + font swap + utility updates. **NO motion, NO new components, NO new features.** Mechanical token migration.

---

## Files to touch (exactly 23 files)

### Foundation (3 files)
1. `vibeseek/tailwind.config.ts` — replace `colors.vibe` + `fontFamily` + gradient images
2. `vibeseek/app/globals.css` — replace `:root` CSS vars + body bg + component utility classes
3. `vibeseek/app/layout.tsx` — swap font imports (next/font/google) + Toaster toastOptions colors + viewport themeColor

### Component palette swap (20 files — mechanical map per §3)
4. `vibeseek/components/ChatPanel.tsx`
5. `vibeseek/components/VibeCard.tsx`
6. `vibeseek/components/GlowButton.tsx`
7. `vibeseek/components/ProgressBar.tsx`
8. `vibeseek/components/UploadZone.tsx`
9. `vibeseek/components/DocumentHistory.tsx`
10. `vibeseek/components/3d/CanvasSkeleton.tsx`
11. `vibeseek/app/chat/[documentId]/page.tsx`
12. `vibeseek/app/chat/[documentId]/error.tsx`
13. `vibeseek/app/dashboard/page.tsx`
14. `vibeseek/app/dashboard/error.tsx`
15. `vibeseek/app/leaderboard/page.tsx`
16. `vibeseek/app/leaderboard/error.tsx`
17. `vibeseek/app/quiz/[documentId]/error.tsx`
18. `vibeseek/app/error.tsx`
19. `vibeseek/app/not-found.tsx`

### Doc updates (3 files)
20. `ARCHITECT_BLUEPRINT.md` — §3 Stack update (new fonts) + §13 changelog prepend P-503 entry
21. `AGENT_LOG.md` — start + done entries
22. `tasks/P-503-brand-tokens.md` — this file (status transitions)

### Already listed above but named separately:
23. **NOTE:** `scripts/render/render.mjs` is **OUT OF SCOPE** — video palette (GRADIENT_POOL P-501) stays navy-purple for now. Video rebrand = separate Update #2 task.

## Files NOT to touch

| File / Region | Reason |
|---|---|
| `vibeseek/scripts/render/render.mjs` — `GRADIENT_POOL`, `XFADE_DURATION`, ASS header, all helpers | P-401/P-402/P-403/P-404/P-405/P-501 invariants. Video palette is separate task. |
| `vibeseek/lib/ai/**` all prompts | No brand mention in prompts (prompts are in Vietnamese about DOJO). Keep untouched. |
| `vibeseek/lib/**` non-UI libs (rate-limit, storage, github, ai/embeddings/chat/processor) | Logic, not UI |
| `vibeseek/app/api/**` routes | Backend, not UI |
| `vibeseek/utils/**` | Logic, not UI |
| `vibeseek/public/**` | Static assets — no color change needed (mascot 3D model stays) |
| `package.json` / `package-lock.json` | **NO new deps.** `next/font/google` already imports fonts. |

---

## Architect's spec

### §1 — Palette mapping table (semantic substitution)

**Literal swap map.** Executor applies these replacements in every component file where they appear:

| Old token | New token | Semantic role |
|---|---|---|
| `bg-pink-500` | `bg-[#F5B83E]` (or `bg-sunflower`) | Primary CTA |
| `bg-pink-600` | `bg-[#E0A535]` (darker sunflower hover) | Primary CTA hover |
| `text-pink-500`, `text-pink-600` | `text-[#F5B83E]` (or `text-sunflower`) | Primary text accent |
| `border-pink-500`, `border-pink-400` | `border-[#F5B83E]` | Primary border |
| `bg-cyan-500`, `text-cyan-500` | `bg-[#5B89B0]`, `text-[#5B89B0]` (or lapis) | Info / link |
| `text-cyan-300` | `text-[#7CA0C5]` (lighter lapis) | Info on dark |
| `border-cyan-500` | `border-[#5B89B0]` | Info border |
| `bg-purple-500`, `text-purple-500` | `bg-[#D96C4F]`, `text-[#D96C4F]` (or terracotta) | Warm accent (human/AI) |
| `border-purple-500`, `border-purple-400` | `border-[#D96C4F]` | Warm border |
| `bg-lime-500`, `text-lime-500` (P-502 Feynman) | `bg-[#7A9B7E]`, `text-[#7A9B7E]` (or sage) | Success / Feynman mode |
| `bg-lime-50`, `border-lime-300`, `text-lime-700`, `text-lime-800`, `hover:bg-lime-100` | `bg-[#7A9B7E]/10`, `border-[#7A9B7E]/40`, `text-[#7A9B7E]`, `text-[#5C7B60]` (darker sage), `hover:bg-[#7A9B7E]/20` | Feynman surface shades |
| `#bef264`, `bef264`, `acid` (CSS literal) | `#7A9B7E` | Acid → sage |
| `#A855F7`, `#a855f7` (CSS literal) | `#D96C4F` | Purple → terracotta |
| `#22D3EE`, `#2dd4bf` | `#5B89B0` | Cyan → lapis |
| `#EC4899` | `#F5B83E` | Pink → sunflower |
| `#F43F5E` (toast error) | `#C85A3C` (darker terracotta for error) | Error |
| `#1a1a2e`, `#0A0A0F`, `#050505` (bg dark) | `#17140F` | Ink base |
| `rgba(168,85,247, ...)` (purple glow) | `rgba(217,108,79, ...)` (terracotta glow) | Glow aura |
| `rgba(34,211,238, ...)` (cyan glow) | `rgba(91,137,176, ...)` (lapis glow) | Info glow |
| `rgba(190,242,100, ...)` (acid glow) | `rgba(122,155,126, ...)` (sage glow) | Success glow |
| `rgba(255,255,255,0.04)` (glass bg) | `rgba(34,29,23,0.6)` (warm surface with alpha) | Glass surface |
| `rgba(255,255,255,0.08)`, `rgba(255,255,255,0.1)` (border light) | `rgba(245,239,228,0.1)` (paper cream alpha) | Divider |
| `rgba(255,255,255,0.62)`, `rgba(255,255,255,0.65)`, `rgba(255,255,255,0.78)`, `rgba(255,255,255,0.82)`, `rgba(255,255,255,0.85)`, `rgba(255,255,255,0.86)`, `rgba(255,255,255,0.92)` (light text) | `rgba(245,239,228, <same alpha>)` | Paper cream variants |
| `rgba(255,255,255,0.6)` (muted text) | `rgba(154,146,138,1)` (stone) | Meta / muted |
| `rgba(255,255,255,0.35)` (dim text) | `rgba(154,146,138,0.7)` (stone lighter) | Dim meta |
| `text-white` | `text-[#F5EFE4]` (paper cream) | Main text |
| `text-gray-900` | `text-[#17140F]` (ink base) | Dark-on-light if any |
| `text-gray-500`, `text-gray-600`, `text-gray-700`, `text-gray-400` | `text-[#9A928A]` (stone) | Meta text |
| `text-gray-300`, `text-gray-200` | `text-[#E8DFC9]` (paper soft) | Secondary text |
| `bg-white`, `bg-gray-50`, `bg-gray-100` | `bg-[#221D17]` (surface) | Card bg |
| `bg-gray-200` | `bg-[#2E2720]` (elevated) | Modal / hover bg |

**Edge case — GlowButton / glow effects.** Preserve glow style, swap colors:
- `shadow-[0_0_20px_rgba(168,85,247,0.3)]` → `shadow-[0_0_20px_rgba(245,184,62,0.3)]` (sunflower glow)
- `shadow-[0_0_40px_rgba(168,85,247,0.5),0_0_80px_rgba(34,211,238,0.2)]` → `shadow-[0_0_40px_rgba(245,184,62,0.5),0_0_80px_rgba(217,108,79,0.2)]`

**Edge case — noise overlay SVG data URL in body::before** (globals.css line 58-64): keep as-is. Noise is palette-independent.

### §2 — Fonts

**Current** (`app/layout.tsx`):
```typescript
import { JetBrains_Mono, Plus_Jakarta_Sans, Syne } from 'next/font/google'

const headingFont = Syne({ subsets: ['latin'], weight: ['800'], variable: '--font-syne' })
const bodyFont = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-plus-jakarta' })
const monoFont = JetBrains_Mono({ subsets: ['latin'], weight: ['500','700'], variable: '--font-jetbrains' })
```

**Replace with:**
```typescript
import { Bricolage_Grotesque, Be_Vietnam_Pro, Patrick_Hand, Fraunces, JetBrains_Mono } from 'next/font/google'

const displayFont = Bricolage_Grotesque({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const bodyFont = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const handwrittenFont = Patrick_Hand({
  subsets: ['latin', 'vietnamese'],
  weight: ['400'],
  variable: '--font-handwritten',
  display: 'swap',
})

const serifFont = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
})
```

**Body className update:**
```tsx
<body className={`${displayFont.variable} ${bodyFont.variable} ${handwrittenFont.variable} ${serifFont.variable} ${monoFont.variable}`}>
```

**Toaster colors update:**
```typescript
toastOptions={{
  style: {
    background: 'rgba(23,20,15,0.9)',          // ink base with alpha
    color: '#F5EFE4',                           // paper cream
    border: '1px solid rgba(245,184,62,0.3)',   // sunflower border
    backdropFilter: 'blur(20px)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
  },
  success: {
    iconTheme: { primary: '#7A9B7E', secondary: '#F5EFE4' },   // sage
  },
  error: {
    iconTheme: { primary: '#C85A3C', secondary: '#F5EFE4' },   // terracotta error
  },
}}
```

**Viewport themeColor:**
```typescript
export const viewport: Viewport = {
  themeColor: '#17140F', // ink base
}
```

### §3 — `globals.css` rewrite

Replace `:root` block:

```css
:root {
  /* Fonts */
  --font-display: 'Bricolage Grotesque', sans-serif;
  --font-body: 'Be Vietnam Pro', sans-serif;
  --font-handwritten: 'Patrick Hand', cursive;
  --font-serif: 'Fraunces', serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Semantic palette */
  --color-ink: #17140F;           /* base bg */
  --color-surface: #221D17;       /* card */
  --color-elevated: #2E2720;      /* modal / hover */
  --color-sunflower: #F5B83E;     /* primary / XP */
  --color-terracotta: #D96C4F;    /* warm / human / AI */
  --color-sage: #7A9B7E;          /* success / correct */
  --color-lapis: #5B89B0;         /* info / quiz / link */
  --color-plum: #9B5675;          /* rare badges */
  --color-paper: #F5EFE4;         /* main text */
  --color-paper-soft: #E8DFC9;    /* secondary text */
  --color-stone: #9A928A;         /* muted / meta */
  --color-error: #C85A3C;         /* error */

  /* Legacy vars retained ONLY IF imported elsewhere (verify none do) */
  --color-bg: var(--color-ink);   /* backward alias if any component reads --color-bg */
}
```

**Body rule:**
```css
html, body {
  max-width: 100vw;
  overflow-x: hidden;
  background-color: var(--color-ink);
  color: var(--color-paper);
}

body {
  font-family: var(--font-body);
  background:
    radial-gradient(ellipse at 20% 20%, rgba(245,184,62,0.06) 0%, transparent 52%),
    radial-gradient(ellipse at 80% 80%, rgba(217,108,79,0.05) 0%, transparent 48%),
    var(--color-ink);
  min-height: 100vh;
}
```

**Scrollbar:**
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: rgba(245,239,228,0.02); }
::-webkit-scrollbar-thumb { background: rgba(245,184,62,0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(245,184,62,0.5); }
```

**Glass utility:**
```css
.glass {
  background: rgba(34,29,23,0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(245,239,228,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,239,228,0.05);
}
```

**Existing custom classes** (.glitch-text, .insight-card, .quiz-card, .reward-panel, .login-button, .landing-panel etc.) — swap all purple/cyan/acid hex → new palette per §1 mapping. Executor goes file end-to-end line-by-line.

### §4 — `tailwind.config.ts`

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
        handwritten: ['var(--font-handwritten)', 'cursive'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: '#17140F',
        surface: '#221D17',
        elevated: '#2E2720',
        sunflower: '#F5B83E',
        terracotta: '#D96C4F',
        sage: '#7A9B7E',
        lapis: '#5B89B0',
        plum: '#9B5675',
        paper: {
          DEFAULT: '#F5EFE4',
          soft: '#E8DFC9',
        },
        stone: '#9A928A',
        // Legacy `vibe` kept REMOVED — executor replaces all `vibe-*` class usages per §1 map
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
        'glow-sm': '0 0 20px rgba(245,184,62,0.4)',
        'glow-md': '0 0 40px rgba(245,184,62,0.5), 0 0 80px rgba(217,108,79,0.2)',
        'glow-sage': '0 0 30px rgba(122,155,126,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
```

### §5 — Component swap playbook

For each of the 20 component files:
1. Open file
2. Search for `pink-`, `cyan-`, `purple-`, `lime-`, `acid`, hex literals from §1 map
3. Replace per mapping table §1
4. Replace `text-white` → `text-[#F5EFE4]` OR `text-paper` (if using Tailwind extend from §4)
5. Replace `text-gray-XXX` / `bg-gray-XXX` per §1
6. Verify `bg-white` / `bg-gray-50` / `bg-gray-100` → `bg-surface` or `bg-[#221D17]`
7. **IF** font className like `font-display` / `font-body` exists → no change needed (tailwind will resolve via §4)
8. **IF** hardcoded font string like `'Syne, sans-serif'` → swap to `'Bricolage Grotesque, sans-serif'` etc.

**Reviewer grep after swap — must return 0 matches in component files:**
```
grep -rE "pink-[0-9]|cyan-[0-9]|purple-[0-9]|lime-[0-9]|acid|bef264|A855F7|a855f7|22D3EE|2dd4bf|EC4899|1a1a2e|#0A0A0F|#050505" vibeseek/components vibeseek/app
```

Expected: exit with no matches (excluding comments + this task md).

### §6 — Example component swap (ChatPanel.tsx partial)

Before (P-502 ChatPanel):
```tsx
<button
  className={`px-2 py-0.5 rounded ${mode === 'default' ? 'bg-pink-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
>Default</button>
```

After:
```tsx
<button
  className={`px-2 py-0.5 rounded ${mode === 'default' ? 'bg-sunflower text-ink' : 'text-stone hover:bg-elevated'}`}
>Default</button>
```

Feynman bubble:
```tsx
// Before: bg-lime-500 / border-lime-300 / text-lime-700 / bg-lime-50
// After:  bg-sage / border-sage/40 / text-sage / bg-sage/10
```

---

## Acceptance criteria

- [ ] **AC-1:** `tailwind.config.ts` has new `colors` block matching §4 exactly. No `vibe` palette left.
- [ ] **AC-2:** `globals.css` `:root` block matches §3 exactly. Legacy `--color-purple`, `--color-cyan`, `--color-acid`, `--color-danger` removed (or remapped to new tokens if any component imports them).
- [ ] **AC-3:** `app/layout.tsx` font imports + className + Toaster style + viewport themeColor match §2.
- [ ] **AC-4:** Component grep sentinel returns zero matches for `pink-|cyan-|purple-|lime-|acid|bef264|A855F7|22D3EE|2dd4bf|EC4899|1a1a2e|#0A0A0F|#050505` in `vibeseek/components` + `vibeseek/app`.
- [ ] **AC-5:** `npx tsc --noEmit` exit 0.
- [ ] **AC-6:** `npm run build` (or dev server boot) succeeds with no font-loading errors in console. All 4 new Google Fonts load.
- [ ] **AC-7:** Visual smoke — dashboard + chat + quiz + leaderboard + landing all render with new palette. No "white flash" (meaning Tailwind `bg-white` wasn't missed). Screenshots attached to PR.
- [ ] **AC-8:** Existing functionality byte-for-byte preserved: Feynman toggle still works, quiz grading still works, chat streaming still works. No logic change.
- [ ] **AC-9:** `package.json`/`package-lock.json` zero diff lines (no new deps).
- [ ] **AC-10:** Protected-region grep: `GRADIENT_POOL`, `XFADE_DURATION`, `PlayResX`, `splitNarrationLines`, `formatAssTime`, `speakable_narration`, `OVERFLOW_RATIO`, `WORDS_PER_SECOND`, `\\fad(300,300)`, `CHAT_SYSTEM_PROMPT`, `FEYNMAN_SYSTEM_PROMPT`, `VIBEFY_SYSTEM_PROMPT`, `QUIZ_SYSTEM_PROMPT` — all zero diff lines.

---

## Definition of Done

- All AC pass
- AGENT_LOG start + done entries
- Task status `spec` → `review` → `done`
- PR opened against `main` with title `P-503: Brand Tokens — fonts + palette foundation`
- PR body: screenshots of dashboard + chat (default mode) + chat (Feynman mode) + quiz page showing new palette
- Blueprint §13 P-503 entry prepended
- Post-merge: redeploy + visual verify prod

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Executor misses a hex literal deep in globals.css custom classes | AC-4 grep + AC-7 visual smoke + architect review line-by-line globals.css |
| F-2 | Next/font google doesn't support Bricolage Grotesque / Patrick Hand / Fraunces with vietnamese subset | Verify next/font/google docs supports these families. Patrick Hand only has weight 400 (correct). Fraunces variable weight. Bricolage Grotesque variable. All support vietnamese subset. |
| F-3 | Font loading triggers layout shift (FOIT/FOUT) | `display: 'swap'` on all fonts. System font fallback during load. |
| F-4 | Page drop-cap or custom typography uses old font variable (`var(--font-syne)`) | Grep old var names `--font-syne`, `--font-plus-jakarta`, `--font-dm-sans` — all must be replaced. |
| F-5 | VibePointsBadge or 3D components hardcoded old colors | Check `VibePointsBadge.tsx` (if exists), `DojoModel.tsx`, other 3D/ files in component swap list. |
| F-6 | Gradient backgrounds in body::before or .mesh-gradient don't update | §3 + §4 include new gradients. Executor verify `body`, `.mesh-gradient`, `.glow-*` classes updated. |
| F-7 | Broken dark mode (light flash, white bg) | html.dark class preserved in layout.tsx. All `bg-white`/`bg-gray-50` replaced with `bg-surface`. |
| F-8 | P-502 Feynman lime-500 theme breaks after swap | §1 mapping covers lime-* → sage equivalents. AC-8 verifies Feynman toggle still visually distinct (sage vs sunflower). |
| F-9 | render.mjs accidentally touched | `scripts/render/` in Files NOT to touch table. Architect review checks diff excludes this folder. |
| F-10 | Legacy CSS var name stays unused but referenced somewhere | Full grep `--color-purple`, `--color-cyan`, `--color-acid`, `--color-danger` before + after swap. |
| F-11 | `text-white` in some component not swapped | Global grep for `text-white` post-swap. Accept only if intentional white (unlikely since we're paper-cream). |
| F-12 | Build fails due to tailwind colors schema change (nested DEFAULT) | `paper.DEFAULT` nested object works in Tailwind 3. Verify `bg-paper` resolves to `#F5EFE4`. |

---

## Local test plan

### Test 1 — `npx tsc --noEmit` — exit 0 (AC-5)

### Test 2 — Dev server smoke
```bash
cd vibeseek && npm run dev
```
Open http://localhost:3000 → verify:
- Landing page: mesh gradient warm tones, no cyan, no purple. DOJO mascot 3D still renders (color-independent).
- Dashboard: form + cards + video grid → new palette.
- Chat page: input, buttons, bubbles, toggle mode. Default mode = sunflower accent. Feynman mode = sage accent.
- Quiz page: options, correct/wrong states.
- Leaderboard: table, badges.

### Test 3 — Grep sentinel (AC-4)
```bash
cd vibeseek && grep -rE "pink-[0-9]|cyan-[0-9]|purple-[0-9]|lime-[0-9]|bef264|A855F7|22D3EE|2dd4bf|EC4899|1a1a2e|#0A0A0F|#050505" components app 2>&1 | grep -v -E "node_modules|\.next" | head -20
```
Expected: empty output.

### Test 4 — Font network check
Open DevTools Network tab → refresh landing → should see 4 woff2 fetches for Bricolage Grotesque, Be Vietnam Pro, Patrick Hand, Fraunces. JetBrains Mono already cached / fetched.

### Test 5 — Vietnamese diacritic render
Type "Tôi đang học" on a heading → verify Bricolage Grotesque renders diacritics correctly (dấu huyền, dấu ngã). If garbled → subset config wrong.

---

## Non-goals (KHÔNG làm)

- KHÔNG đụng `render.mjs` (Video update #2 task)
- KHÔNG add motion/animation (items 3-14 là các task riêng: P-504 typing indicator, P-505 ambient bg, etc.)
- KHÔNG add new components (only swap tokens in existing)
- KHÔNG add light mode toggle (item 12 là task riêng P-50X)
- KHÔNG refactor component structure / layout / logic
- KHÔNG add new deps (canvas-confetti, framer-motion updates, etc. — later tasks)
- KHÔNG modify prompts (CHAT_SYSTEM_PROMPT, FEYNMAN_SYSTEM_PROMPT, etc.)
- KHÔNG change DOJO mascot 3D mesh / model
- KHÔNG rebrand DOJO name (user confirmed keep)
- KHÔNG update video drawtext / overlay (Video update #2)

---

## Decisions log

- **D-1:** Kept `--color-bg: var(--color-ink)` as a backward compat alias in `:root` — searched all non-spec files and confirmed only globals.css itself used `var(--color-bg)` internally; alias costs zero and protects against hidden references.
- **D-2:** `vietnamese` subset confirmed for all 4 new Google Fonts (Bricolage Grotesque, Be Vietnam Pro, Patrick Hand, Fraunces) — all support it per next/font/google registry. JetBrains Mono kept `latin` only (code font, no Vietnamese needed).
- **D-3:** Patrick Hand weight locked to `['400']` only (only weight available per Google Fonts spec — F-2 pre-empted).
- **D-4:** GlowButton variant prop names (`purple`, `cyan`, `pink`) preserved unchanged — renaming would be a logic/API change outside scope. Colors updated per §1 map: purple→terracotta/plum, cyan→lapis, pink→sunflower.
- **D-5:** `text-white` refs in `LeaderboardTable.tsx`, `QuizCard.tsx`, `VibePointsBadge.tsx`, `VideoPlayer.tsx`, `app/quiz/[documentId]/page.tsx` are NOT in spec file list — flagged to architect for P-503b or next pass. Scope gate: 16 in-scope components all clean per AC-4 grep.
- **D-6:** `dashboard/page.tsx` gradient links changed: quiz button kept `indigo→fuchsia` (not in §1 map), chat button changed from `pink→purple` to `sunflower→terracotta` per §1 map.
- **D-7:** `globals.css` custom classes (.glitch-text, .insight-card, .quiz-card, .reward-panel, .login-button, .landing-cta, etc.) — all purple/cyan/acid/lime/pink hex values replaced per §1 mapping table systematically.
- **D-8:** `body::before` noise overlay SVG kept as-is per §3 explicit instruction "keep as-is. Noise is palette-independent."

---

## Notes for reviewer / future-self

### Dispatch model
**claude-sonnet-4-6.** Spec is literal mapping table — no judgment. Pattern-match ability is what Sonnet excels at. Opus overkill.

### Scope gate
If executor finds > 30 files need touching (not 23), pause + flag architect. If any file requires logic change beyond color/font swap, pause + flag.

### Parallel batch note
This is **Day 1 Track A foundation batch**. After this merges, parallel dispatch Day 1 Track B = P-504 typing indicator + P-505 ambient bg. Both Track B tasks depend on new tokens existing in CSS vars + Tailwind config.

### P-502 Feynman color preservation
Feynman mode uses lime-500/lime-50/lime-300 for visual distinction from default pink. Swap lime → sage keeps the distinction (sage is muted success green vs sunflower primary). Architect confirmed sage semantic role = "success/correct" aligns with Feynman Dojo "you got it right".

### Commit style
`P-503: Brand Tokens — fonts + palette foundation (Day 1 Track A)` + Co-Authored-By: Sonnet line.
