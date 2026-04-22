# P-510 · Video quality upgrade — title card + scene kicker drawtext (Update #2)

**Status:** `spec`
**Severity:** HIGH (demo differentiator — unique educational content output)
**Branch:** `task/P-510-video-quality`
**Assignee:** **claude-sonnet-4-6 executor dispatch** (spec-heavy pre-audited, architect has done feasibility smoke + math)
**Depends on:** P-501 merged (xfade + palette pool). No brand tokens needed — video uses hex literals in ffmpeg.

## Context

User Update #2 request: improve video output quality beyond plain gradient + subtitle. Architect feasibility smoke 2026-04-22 validated `drawtext` per-scene pre-composite + xfade chain: 3-scene synthetic render 9.000s exact, frames show clear title card + kicker above gradient.

**Scope this task (V1):**
- **Title card** drawtext top of frame (scene.title, display font, paper cream on dark surface box)
- **Scene kicker** drawtext above title ("01 / 06" scene-index format, mono font, lapis color)
- **No bullet list** (narration already at bottom via ASS)
- **No PNG icon overlay** (scope defer — V2 if time)

**User constraint:** Free-tier. No new deps. No new API calls. Render time increase tolerated (+5-10s per render acceptable).

## Files to touch (3 files)

1. `vibeseek/scripts/render/render.mjs` — modify ffmpeg invocation: add font copy step + per-gradient drawtext pre-composite before xfade
2. `vibeseek/scripts/render/title-font.ttf` (**NEW binary**, committed) — copy of DejaVu Sans Bold or similar Vietnamese-supporting TTF. **EXECUTOR: copy `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf` (Linux) OR commit a small open-source font that renders Vietnamese diacritics. If you're on Windows local, copy `C:/Windows/Fonts/arial.ttf` to ensure VN support.** Single committed font avoids OS-specific paths in ffmpeg filter.
3. `tasks/P-510-video-quality.md` — status

**NOT touched:**
- `GRADIENT_POOL`, `XFADE_DURATION`, ASS header block, `splitNarrationLines`, `formatAssTime`, TTS path, audio concat pipeline
- All web UI (different stack)
- AGENT_LOG, BLUEPRINT

## Spec

### §1 — Commit font file

Architect provides: copy `C:/Windows/Fonts/arial.ttf` (Windows, has VN support) to `vibeseek/scripts/render/title-font.ttf`. ~800KB. Committed once.

**OR** use DejaVu Sans Bold from GH Actions runner (`/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`) — but commit requires architect to pre-fetch. Simplest: commit `arial.ttf` from Windows (both architect + GH runner render the same font).

Executor decision: commit `arial.ttf` from `C:/Windows/Fonts/arial.ttf`. Done once, stays in repo.

### §2 — `render.mjs` changes

**After `await writeFile(assPath, ...)`** and **before `const N = sceneDurations.length`**, add font copy step:

```javascript
// P-510: Copy title font to workDir so ffmpeg drawtext uses relative path
// (avoids Windows `C:/` drive-letter colon breaking filter option parsing).
const fontSrc = join(__dirname, 'title-font.ttf')  // relative to render.mjs location
const fontDst = join(workDir, 'title-font.ttf')
await copyFile(fontSrc, fontDst)
```

Need to add `copyFile` + `dirname`/`__dirname` import handling (render.mjs is ESM `.mjs`). Use:
```javascript
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```
(Add these only once near top of file, with existing imports.)

**Escape helper** for drawtext text values (handles `:`, `'`, `%`, `\`):

```javascript
/**
 * Escape a string for ffmpeg drawtext `text=` option value.
 * Order matters — backslash first.
 */
function escapeDrawtext(s) {
  return s
    .replace(/\\/g, '\\\\')   // backslash FIRST
    .replace(/'/g, "\\'")      // single quote
    .replace(/:/g, '\\:')      // colon (filter option separator)
    .replace(/%/g, '\\%')      // percent (expression delimiter)
}
```

**Modify filterComplex builder** — currently:
```javascript
let filterComplex
if (N === 1) {
  filterComplex = '[0:v]subtitles=subtitles.ass[vout]'
} else {
  // xfade chain + subtitles
}
```

**New version:**

```javascript
const totalScenes = N

// Build per-scene drawtext chain BEFORE xfade. Each scene gets [sK] output
// with title + kicker drawn over gradient.
const sceneDrawtextParts = []
for (let i = 0; i < N; i++) {
  const scene = scenes[i]
  const title = escapeDrawtext((scene.title || `Scene ${i + 1}`).slice(0, 50))
  const kicker = `${String(i + 1).padStart(2, '0')} / ${String(totalScenes).padStart(2, '0')}`
  // Layer: kicker (top, small mono lapis) + title (boxed, large paper-cream)
  const kickerDraw = `drawtext=fontfile=title-font.ttf:text='${kicker}':fontsize=28:fontcolor=0x5B89B0:x=(w-text_w)/2:y=80:borderw=2:bordercolor=0x17140F`
  const titleDraw = `drawtext=fontfile=title-font.ttf:text='${title}':fontsize=64:fontcolor=0xF5EFE4:x=(w-text_w)/2:y=140:box=1:boxcolor=0x221D17@0.75:boxborderw=24`
  sceneDrawtextParts.push(`[${i}:v]${kickerDraw},${titleDraw}[s${i}]`)
}

// Build xfade chain FROM [sK] labels instead of [K:v]
let xfadeFilterParts = []
if (N === 1) {
  // No xfade needed — subtitle overlay on single scene's drawtext output
  xfadeFilterParts.push('[s0]subtitles=subtitles.ass[vout]')
} else {
  let cumulative = 0
  let prevLabel = '[s0]'
  for (let k = 0; k < N - 1; k++) {
    cumulative += sceneDurations[k]
    const offset = (cumulative - XFADE_DURATION).toFixed(3)
    const outLabel = `[vxf${k}]`
    xfadeFilterParts.push(`${prevLabel}[s${k + 1}]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${offset}${outLabel}`)
    prevLabel = outLabel
  }
  xfadeFilterParts.push(`${prevLabel}subtitles=subtitles.ass[vout]`)
}

const filterComplex = [...sceneDrawtextParts, ...xfadeFilterParts].join(';')
```

Result structure:
```
[0:v]drawtext=...kicker...,drawtext=...title...[s0];
[1:v]drawtext=...[s1];
[2:v]drawtext=...[s2];
[s0][s1]xfade=...[vxf0];
[vxf0][s2]xfade=...[vxf1];
[vxf1]subtitles=subtitles.ass[vout]
```

### §3 — GH Actions workflow check

Workflow `.github/workflows/render-video.yml` has `sparse-checkout: vibeseek/scripts/render` which ALREADY includes the new `title-font.ttf` file when committed. No workflow change needed.

### §4 — Text escape edge cases

Vietnamese storyboard titles often contain:
- Apostrophes: `'` → escaped to `\'`
- Colons: `:` → escaped to `\:`
- Numbers + slashes: `12/06` → no escape needed (slash is safe in drawtext)

Examples:
- Input: `Thuật toán Quick Sort` → escape: `Thuật toán Quick Sort` (no special chars, safe)
- Input: `Tại sao: Bubble Sort?` → escape: `Tại sao\: Bubble Sort?` (colon escaped)
- Input: `Don't panic` → escape: `Don\'t panic` (apostrophe escaped)

### §5 — Title truncation

Long titles (>50 chars) get truncated with `.slice(0, 50)`. Rationale: drawtext doesn't wrap; overflow would extend off-frame. Truncate is safer than crash. Title is visual hint; full text is in subtitle at bottom anyway.

## AC

- [ ] **AC-1:** `vibeseek/scripts/render/title-font.ttf` committed (~800KB arial.ttf from Windows or equivalent VN-supporting TTF)
- [ ] **AC-2:** `render.mjs` imports `copyFile` + `fileURLToPath` + `dirname` + declares `__dirname`
- [ ] **AC-3:** Font copy step runs after ASS write, before ffmpeg invocation
- [ ] **AC-4:** `escapeDrawtext` helper added + used for all text passed to drawtext
- [ ] **AC-5:** `filterComplex` builder produces: per-scene drawtext chain → xfade chain → subtitle overlay on final `[vout]`. Labels `[s0]..[s(N-1)]` for pre-composited scenes, `[vxf0]..[vxf(N-2)]` for xfade outputs.
- [ ] **AC-6:** N=1 edge case: `[s0]subtitles=subtitles.ass[vout]` (drawtext still applied, just no xfade)
- [ ] **AC-7:** `node --check render.mjs` exit 0
- [ ] **AC-8 (architect-runnable synth smoke, ALREADY DONE):** 3-scene render 9.000s exact ✓ frames show kicker "01 / 06" + title box visible
- [ ] **AC-9:** Protected-region grep on diff: `GRADIENT_POOL | XFADE_DURATION | PlayResX | PlayResY | splitNarrationLines | formatAssTime | speakable_narration | OVERFLOW_RATIO | WORDS_PER_SECOND | \\fad(300,300) | edge-tts` → 0 matches on DELETED lines
- [ ] **AC-10:** No new npm deps (title-font.ttf is a file asset, not npm)
- [ ] **AC-11 (user post-merge smoke):** upload real PDF → render video → verify title card + kicker visible above gradient on each scene, Vietnamese diacritics render correctly, no mid-render crash

## Non-goals

- KHÔNG add PNG icon overlay (V2 if time)
- KHÔNG add bullet list drawtext (subtitle covers narration at bottom)
- KHÔNG animate title card (static per scene is fine)
- KHÔNG change gradient palette (P-501 stays)
- KHÔNG add new storyboard schema fields (use existing `scene.title`)
- KHÔNG touch prompts.ts (title already generated by Gemini per existing schema)
- KHÔNG touch `AGENT_LOG.md` / `BLUEPRINT.md` (architect close-out)

## Commit + PR

Title: `P-510: Video quality — title card + scene kicker drawtext`
Co-Authored-By: Claude Sonnet 4.6

## Notes for executor

- Architect has done feasibility smoke at `.tmp-video-smoke/` (do not reference in code). Confirmed drawtext + xfade compatible, VN text renders with arial.ttf.
- Font copy step pattern matches existing subtitle.ass write-to-workDir pattern.
- If Sonnet dispatch hits Bash denial mid-task: STOP and report. Do NOT run other skills.
