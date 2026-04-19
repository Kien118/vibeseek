# P-405 · Scene transitions feel abrupt — ASS subtitle fade

**Status:** `todo`
**Severity:** LOW (Phase 4 cosmetic polish)
**Blueprint ref:** §10 Phase 4 · P-405
**Branch:** `task/P-405-scene-transitions`
**Assignee:** _(TBD)_
**Depends on:** P-401 (ASS subtitle pipeline in render.mjs). P-401 + P-402 + P-403 all merged to main.

## Context

**Current state (main `af39218`):**
- `render.mjs` generates a single-input video (1080x1920 solid color `#1a1a2e` for `totalDuration` seconds) + a single stereo audio track (concatenated TTS WAVs) + ASS subtitles.
- ASS dialogue lines (line ~273 in post-P-401 code) have a hard `startTime → endTime` boundary per scene. Subtitle text POPS IN at scene start + POPS OUT at scene end with zero opacity ramp.
- User reports "scene transitions feel abrupt" (Phase 1 E2E 2026-04-17).

**Blueprint prescription correction (architect 2026-04-19):** Blueprint §10 P-405 says *"ffmpeg xfade crossfade 0.3s giữa scenes"*. The `xfade` filter takes **two video inputs** and produces one output with a transition between them — useful when each scene is its own video segment. Current render has a single continuous video input, so `xfade` has nothing to transition between. The real abruptness the user perceives is the **subtitle text snap** at scene boundaries, because the background is continuous and the only per-scene visual element is the text.

**Real fix:** use ASS libass `\fad()` animation tag on each Dialogue line. Fade subtitle in at scene start, out at scene end. No `xfade`, no per-scene video segments, no render-pipeline restructuring. One-line addition to the ASS dialogue generator. Same UX effect.

**Why this tool is correct here:**
- libass renders `\fad(fadein_ms, fadeout_ms)` natively — standard ASS animation override.
- Fades the subtitle visibility, not the background. Since background is single-color continuous, fading the text IS the only visible transition.
- `\fad(300,300)` = 300ms fade in + 300ms fade out per dialogue block = ~0.6s of visible transition per scene boundary (scene N fading out as scene N+1 fades in, if timings abut).
- Future P-404 (per-scene gradient/pattern background) won't break this — the `\fad` tag only affects text layer.

**Optional future Phase 5:** if user wants per-scene background transitions, that requires P-404 first (per-scene distinct visual inputs) + ffmpeg `xfade` concat. Out of scope here.

## Files to touch
- `vibeseek/scripts/render/render.mjs` — ASS dialogue line generator gets `{\fad(300,300)}` prefix on each text
- `vibeseek/scripts/smoke-p405.mjs` (NEW, **delete before PR**) — synthetic ASS render with silent audio + frame extract for architect visual verify
- `tasks/P-405-scene-transitions.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/lib/ai/prompts.ts` — no AI change needed
- `vibeseek/lib/ai/processor.ts` — no schema/parser change
- `vibeseek/app/api/vibefy-video/route.ts` — unchanged
- ASS header (PlayResX/Y 1080/1920, `[V4+ Styles]` Default style) — P-401 scope, byte-for-byte preserved
- `splitNarrationLines`, `formatAssTime`, `countWords` helpers — preserved
- TTS call (P-402 `speakable_narration || narration` logic) — preserved
- Subtitle text content (P-401 2-line cap + `…` ellipsis logic) — preserved; only WRAPPER tag is added
- `package.json` — NO new deps

## Architect's spec

### 1. Add `\fad(300,300)` override to ASS dialogue text

Locate the dialogue generation loop in `render.mjs` (currently around line 273, the line that appends to `dialogueLines`):

```javascript
dialogueLines += `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,${text}\n`
```

Change to prepend `{\fad(300,300)}` at the start of the text field:

```javascript
dialogueLines += `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,{\\fad(300,300)}${text}\n`
```

**Escaping note:** JS template string `\\fad` produces `\fad` in the output ASS file. libass parses `{\fad(in,out)}` as the fade override tag. The existing `text` variable may contain `\\N` (JS-escaped `\N` hard newline for ASS) — the `{\fad}` override is prepended ONCE at the start of the text, not per line, so `\N` inside `text` is still handled correctly by libass.

**Parameter choice:** 300ms in + 300ms out.
- Shorter (100-200ms) feels twitchy for 4-15s scenes.
- Longer (500ms+) eats into visible display time on short 4s scenes.
- 300ms fades during 0-300ms of scene (arriving) + last 300ms (leaving); middle of scene = full opacity. On a 4s scene, subtitle is fully visible for 3.4s. Acceptable.

No other change to dialogue generation. Scene timing (startTime/endTime from cumulative TTS duration) unchanged; P-401 line-split + ellipsis logic unchanged; P-402 speakable-narration vs narration separation unchanged.

### 2. Create `scripts/smoke-p405.mjs` (LOCAL SMOKE — delete before PR)

Purpose: generate ASS with fade tag, render silent-audio MP4, extract frames at fade boundaries to verify visible transition.

```javascript
#!/usr/bin/env node
// P-405 smoke — DELETE BEFORE PR
// Usage: cd vibeseek/scripts/render && node smoke-p405.mjs
// Output: ./smoke-out.mp4 + ./frame-fade-in.png + ./frame-full.png + ./frame-fade-out.png

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const run = promisify(execFile)

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// 2 scenes, 4s each — enough to observe fade-in (0-300ms), full opacity
// middle, fade-out (last 300ms) of each.
const scenes = [
  { text: 'Scene một xuất hiện mượt', dur: 4 },
  { text: 'Scene hai tiếp nối liền mạch', dur: 4 },
]

async function main() {
  const workDir = join(tmpdir(), `p405-smoke-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  try {
    const totalDuration = scenes.reduce((a, s) => a + s.dur, 0)

    let dialogues = ''
    let t = 0
    for (let i = 0; i < scenes.length; i++) {
      dialogues += `Dialogue: 0,${formatAssTime(t)},${formatAssTime(t + scenes[i].dur)},Default,,0,0,0,,{\\fad(300,300)}${scenes[i].text}\n`
      t += scenes[i].dur
    }

    const assHeader = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920',
      'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,40,40,160,1', '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ].join('\n') + '\n'

    const assPath = join(workDir, 'subtitles.ass')
    await writeFile(assPath, assHeader + dialogues, 'utf-8')

    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', `color=c=#1a1a2e:s=1080x1920:d=${totalDuration}`,
      '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
      '-vf', `subtitles=subtitles.ass`,
      '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', '-t', String(totalDuration),
      'smoke-out.mp4',
    ], { cwd: workDir, timeout: 600_000 })

    await copyFile(join(workDir, 'smoke-out.mp4'), './smoke-out.mp4')

    // Extract diagnostic frames
    // - T=0.15s: scene 1 mid-fade-in (300ms fade / 2)
    // - T=2.0s: scene 1 full opacity (midpoint of 4s)
    // - T=3.85s: scene 1 mid-fade-out
    // - T=4.15s: scene 2 mid-fade-in
    const extract = async (ts, name) => run('ffmpeg', [
      '-y', '-i', 'smoke-out.mp4', '-ss', ts, '-vframes', '1', '-update', '1', name,
    ], { cwd: '.' })
    await extract('00:00:00.15', 'frame-fade-in.png')
    await extract('00:00:02.00', 'frame-full.png')
    await extract('00:00:03.85', 'frame-fade-out.png')
    await extract('00:00:04.15', 'frame-scene2-in.png')

    console.log('✅ smoke-out.mp4 + 4 diagnostic frames written')
  } finally {
    try { await rm(workDir, { recursive: true, force: true }) } catch {}
  }
}

main().catch(err => { console.error(err); process.exit(1) })
```

## Acceptance criteria
- [ ] **AC-1:** `render.mjs` ASS dialogue generator prepends `{\fad(300,300)}` to each text. Exactly 1 line changed in the dialogue loop; escape `\\fad` produces `\fad` in ASS output.
- [ ] **AC-2:** `node --check scripts/render/render.mjs` exit 0.
- [ ] **AC-3:** `npm run build` not required (render.mjs is standalone Node); tsc not applicable.
- [ ] **AC-4 (architect-runnable via anullsrc bypass):** smoke-p405.mjs produces `smoke-out.mp4` + 4 frame PNGs. Architect opens `frame-fade-in.png` and `frame-full.png` — fade-in frame shows subtitle at ~50% opacity vs full opacity on full-frame. Visual difference confirms `\fad` is honored.
- [ ] **AC-5 (User-runnable, post-merge):** Render a real video via dashboard. Watch scene boundaries — subtitle text should fade in and out smoothly vs pop in/out pre-P-405. Feel test, not measurement.
- [ ] **AC-6:** `smoke-p405.mjs` deleted before PR. No other file touched beyond the dialogue-line change.
- [ ] **AC-7:** P-401 ASS header + P-402 speakable-narration path + P-403 word-count/safety-net logic all untouched. Grep final diff for `PlayResX`, `speakable_narration`, `OVERFLOW_RATIO`, `splitNarrationLines` — zero diff lines on these.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- `smoke-p405.mjs` NOT in final diff
- No new deps

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | libass older version doesn't honor `\fad` tag | `\fad` is a core ASS override supported since libass's early days. Ubuntu 22.04+ GH Actions runner ships recent libass; Windows dev ffmpeg gyan.dev build similarly. No fallback needed. |
| F-2 | 300ms fade eats too much of 4s scene (shortest allowed) | 300+300ms = 600ms of transition on a 4s scene = 5.4s fully visible... actually 3.4s fully visible + 600ms with reduced opacity. Acceptable; shorter scenes still readable. If user complains, tune parameter. |
| F-3 | Fade on final scene's fadeout leaves blank frame at video end | TTS-derived totalDuration already includes the final scene's full length; fadeout completes before video ends. |
| F-4 | Fade tag `{\fad}` collides with libass `{\...}` overrides added by other passes | No other passes add `\...` overrides currently. P-401 manual `\N` is inside text, not a `{\...}` override tag. Isolated. |
| F-5 | JS escape `\\fad` produces wrong output (`\\fad` instead of `\fad`) | JS template literal `\\` = single backslash. Verified in smoke-p405.mjs smoke: ASS file content should show literal `\fad`. Reviewer can `cat /tmp/.../subtitles.ass` during smoke to confirm. |
| F-6 | Fade visible in subtitle is subtle and users don't notice improvement | Fine-grained test — architect frame-extract at T=0.15s vs T=2.0s will show clear opacity difference. User feel-test in AC-5 confirms MVP. |
| F-7 | smoke-p405.mjs leaks into PR | AC-6 + DoD + reviewer grep. |
| F-8 | Fade breaks when `text` is empty (scene with empty narration) | Existing code skips empty-narration scenes (line 208 `if (!narration) continue`) — fade code never sees empty text. |
| F-9 | `{\fad}` interacts weirdly with `\N` manual newlines in multi-line subtitle | libass applies overrides to the whole dialogue block regardless of internal `\N`. Visual: whole block fades as a unit. Exactly what we want. |
| F-10 | Back-to-back scenes with adjacent startTime/endTime: scene N fadeout overlaps scene N+1 fadein — both partially visible | This IS the intended "smooth transition" effect. Visually: N fades out 300ms while N+1 fades in 300ms. 150ms of both visible simultaneously (cross-fade). Desirable. |

## Local test plan

### Test 1 — Syntax check (2s)
```bash
cd vibeseek/scripts/render
node --check render.mjs
```
Expected: exit 0, no output.

### Test 2 — Smoke render + frame extract (~1 min)
```bash
cd vibeseek/scripts/render
node smoke-p405.mjs
```
Expected: `✅ smoke-out.mp4 + 4 diagnostic frames written`. Files present:
- `smoke-out.mp4`
- `frame-fade-in.png` (T=0.15s — scene 1 mid-fade-in, subtitle visible but low opacity)
- `frame-full.png` (T=2.00s — scene 1 full opacity)
- `frame-fade-out.png` (T=3.85s — scene 1 mid-fade-out)
- `frame-scene2-in.png` (T=4.15s — scene 2 mid-fade-in)

### Test 3 — Visual confirm (architect-runnable, ~1 min)
Architect opens the 4 PNGs (via Read tool on file path). Expected:
- `frame-full.png`: subtitle text at full opacity (white on dark background, fully legible).
- `frame-fade-in.png` + `frame-fade-out.png` + `frame-scene2-in.png`: subtitle text visible but at reduced opacity (~30-60% white on dark).
- If all frames look identical (full opacity everywhere) → `\fad` not honored, bug.
- If fade frames show no text at all → fade timing mismatch, bug.

### Test 4 — User-runnable post-merge (AC-5)
User uploads a PDF on dashboard → watches resulting video. Between each scene: subtitle text softly fades out, next scene's text softly fades in. Should feel noticeably smoother than pre-P-405.

### Test 5 — Inspect generated ASS (sanity)
If smoke fails silently (no subtitle visible at all), cat the ASS file during smoke to verify `\fad` is correctly written:
```bash
# Add a debug line to smoke-p405.mjs right before ffmpeg call:
# console.log(await readFile(assPath, 'utf-8'))
```
Expected content shows `Dialogue: 0,0:00:00.00,0:00:04.00,Default,,0,0,0,,{\fad(300,300)}Scene một xuất hiện mượt` — literal `\fad`, not `\\fad` or `\fad\fad`.

## Non-goals (KHÔNG làm)
- KHÔNG implement ffmpeg `xfade` filter — blueprint prescription was incorrect tool (see Context). `\fad` delivers the UX goal with a fraction of the scope.
- KHÔNG restructure render.mjs into per-scene video segments — Phase 5+ if user wants per-scene visual distinction.
- KHÔNG add fade to the whole MP4 (fade-from-black opening or fade-to-black ending) — different feature, out of scope.
- KHÔNG change subtitle content, timing, or styling — only add the fade animation tag.
- KHÔNG add audio fade/crossfade — TTS concatenation stays as-is.
- KHÔNG parameterize fade duration via env var or storyboard field — 300ms hardcoded MVP. Fast-follow can expose if needed.
- KHÔNG depend on P-404 (gradient background) being done first — they're orthogonal.

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- Phase 4 lessons apply:
  - Architect frame-extract technique from `feedback_vibeseek_phase4_lessons.md` = the review method here. Architect runs smoke, extracts PNGs, verifies `\fad` honor visually without needing user to play MP4.
  - anullsrc bypass = no edge-tts needed; this spec's smoke is 100% ffmpeg-only.
- Reviewer expected diff summary: `render.mjs` — 1 line changed (the Dialogue `+=` assembly), `tasks/P-405-...` status update, `AGENT_LOG.md` entries. Max 3 files in final diff.
- Agent red flags: adding `xfade` filter, restructuring to per-scene video inputs, parameterizing fade duration, adding new env vars, touching ASS header or Style block (P-401 scope), touching TTS or subtitle text generation (P-402/P-401 scope).
- This is the smallest remaining Phase 4 task. Should take an executor agent < 10 minutes. If agent drafts > 50 LOC of new code, they're out of scope.
