# P-404 · Background đơn sắc → animated gradient

**Status:** `in-progress`
**Severity:** LOW (Phase 4 cosmetic polish)
**Blueprint ref:** §10 Phase 4 · P-404
**Branch:** `task/P-404-background-gradient`
**Assignee:** _(TBD)_
**Depends on:** none — P-401 through P-405 all merged; render pipeline stable.

## Context

**Current state (main `b17a52e`):**
- `render.mjs` line ~298 sets a solid-color background: `-i color=c=#1a1a2e:s=1080x1920:d=${Math.ceil(totalDuration)}`.
- Video bg is static `#1a1a2e` dark navy for the entire duration. Looks flat / "cheap demo" per user feedback Phase 1 E2E 2026-04-17.

**Goal:** Replace monochrome with a subtle **animated linear gradient** (dark navy → dark purple) using ffmpeg's native `gradients` lavfi source. No external deps, no stock video download, no per-scene input restructuring. Single-filter swap.

**Palette chosen:** `#1a1a2e` (existing bg, keep as c0) → `#2d1b4e` (dark purple, complements VibeSeek blueprint §2.1 `--color-purple #a855f7` accent but keeps saturation low so subtitles stay the focus). Slow animation speed so users perceive motion without distraction.

**Why `gradients` lavfi source:**
- Built into ffmpeg ≥ 5.1 — ubuntu-latest GH Actions runner (2026 baseline ~ffmpeg 6.x) + Windows dev (gyan.dev 2026-04 build) both have it. Verified on architect's Windows machine: `ffmpeg -filters | grep gradients` → `.S gradients |->V Draw a gradients.`
- Animates smoothly with `speed` param; no scripting needed.
- Single input replacement — slots into the exact position of the current `color=` input. Everything downstream (subtitle overlay, audio mix, encoder) is untouched.

**Architect override of blueprint alternatives:**
- Blueprint suggested `testsrc2` (test pattern, ugly for product) or "stock video loop (Pexels free)" (requires download + licensing + Supabase Storage cost). `gradients` delivers the polish goal with zero supply-chain cost.
- Phase 5+ can revisit stock video loop if gradient still feels underwhelming.

## Files to touch
- `vibeseek/scripts/render/render.mjs` — swap `-i color=c=...` to `-i gradients=...`
- `vibeseek/scripts/render/smoke-p404.mjs` (NEW, **delete before PR**) — local smoke + frame extract at T=0 vs T=5s to verify gradient motion
- `tasks/P-404-background-gradient.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/lib/ai/*` — no AI or schema change
- `vibeseek/app/api/vibefy-video/route.ts` — unchanged
- ASS subtitle generation (P-401 scope — header + `\fad` from P-405 preserved)
- TTS path (P-402 `speakable_narration` preserved)
- Parser (P-403 safety-net preserved)
- `package.json` — NO new deps, NO new files, NO stock-video downloads

## Architect's spec

### 1. Swap `color=` input to `gradients=` in render.mjs ffmpeg call

Locate the ffmpeg args in `render.mjs` (around line 297-299 post-P-405):

```javascript
await run('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', `color=c=#1a1a2e:s=1080x1920:d=${Math.ceil(totalDuration)}`,
  '-i', audioPath,
  ...
])
```

Replace the `-i color=...` argument (single array element) with:

```javascript
  '-i', `gradients=s=1080x1920:d=${Math.ceil(totalDuration)}:c0=0x1a1a2e:c1=0x2d1b4e:x0=0:y0=0:x1=1080:y1=1920:speed=0.008:rate=30`,
```

**Param explanation:**
- `s=1080x1920` — same size as before (9:16 portrait).
- `d=${Math.ceil(totalDuration)}` — exact duration match.
- `c0=0x1a1a2e` + `c1=0x2d1b4e` — 2-color linear gradient (dark navy → dark purple). Colors in `0xRRGGBB` hex.
- `x0=0,y0=0,x1=1080,y1=1920` — diagonal gradient direction (top-left to bottom-right). Creates natural-looking movement.
- `speed=0.008` — very slow animation. At this speed, the gradient cycle takes ~2 minutes — subtle motion over a 30-90s video.
- `rate=30` — 30fps output frame rate, matches typical video frame rate.

No other ffmpeg args change. `audioPath`, `-vf subtitles=subtitles.ass`, encoder flags, `-shortest` — all untouched.

### 2. Create `scripts/render/smoke-p404.mjs` (LOCAL SMOKE — delete before PR)

Purpose: render 10-second silent-audio video with `gradients` bg + one sample subtitle; extract 3 PNG frames at T=0.1s, 5.0s, 9.9s to verify the gradient visibly moves (colors subtly shift between frames).

```javascript
#!/usr/bin/env node
// P-404 smoke — DELETE BEFORE PR
// Usage: cd vibeseek/scripts/render && node smoke-p404.mjs
// Output: ./smoke-out.mp4 + ./frame-t0.png + ./frame-t5.png + ./frame-t10.png

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const run = promisify(execFile)

const duration = 10

async function main() {
  const workDir = join(tmpdir(), `p404-smoke-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  try {
    // Minimal ASS to prove subtitle still overlays correctly on gradient
    const ass = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920',
      'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,40,40,160,1', '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      `Dialogue: 0,0:00:00.00,0:00:${String(duration).padStart(2,'0')}.00,Default,,0,0,0,,{\\fad(300,300)}Nền gradient chạy mượt`,
    ].join('\n') + '\n'
    await writeFile(join(workDir, 'subtitles.ass'), ass, 'utf-8')

    await run('ffmpeg', ['-y',
      '-f', 'lavfi', '-i',
      `gradients=s=1080x1920:d=${duration}:c0=0x1a1a2e:c1=0x2d1b4e:x0=0:y0=0:x1=1080:y1=1920:speed=0.008:rate=30`,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', 'subtitles=subtitles.ass',
      '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', '-t', String(duration),
      'smoke-out.mp4',
    ], { cwd: workDir, timeout: 600_000 })

    await copyFile(join(workDir, 'smoke-out.mp4'), './smoke-out.mp4')

    const extract = async (ts, name) =>
      run('ffmpeg', ['-y', '-i', 'smoke-out.mp4', '-ss', ts, '-vframes', '1', '-update', '1', name],
        { cwd: '.' })
    await extract('00:00:00.10', 'frame-t0.png')
    await extract('00:00:05.00', 'frame-t5.png')
    await extract('00:00:09.90', 'frame-t10.png')
    console.log('✅ 3 frames extracted for gradient-motion verification')
  } finally {
    try { await rm(workDir, { recursive: true, force: true }) } catch {}
  }
}
main().catch(e => { console.error(e); process.exit(1) })
```

## Acceptance criteria
- [ ] **AC-1:** `render.mjs` ffmpeg `-i color=...` argument swapped to `-i gradients=s=1080x1920:d=...:c0=0x1a1a2e:c1=0x2d1b4e:x0=0:y0=0:x1=1080:y1=1920:speed=0.008:rate=30`. Exactly 1 line changed.
- [ ] **AC-2:** `node --check scripts/render/render.mjs` exit 0.
- [ ] **AC-3 (architect-runnable via anullsrc bypass):** smoke-p404.mjs renders 10s MP4 + extracts 3 frames. Architect opens PNGs — frames at T=0.1s, 5.0s, 9.9s show the gradient's color distribution shifting subtly (upper-left corner darker/lighter relative to lower-right across the 3 frames).
- [ ] **AC-4 (User-runnable, post-merge):** Render real video via dashboard. Watch: background should no longer be flat dark blue — should show a subtle gradient with gentle movement. Subtitles + fades (P-405) + audio (P-402) all still work correctly.
- [ ] **AC-5:** `smoke-p404.mjs` deleted before PR. No touches to any other file beyond the 1-line swap.
- [ ] **AC-6:** P-401 ASS header, P-402 TTS path, P-403 word-count safety-net, P-405 `\fad` tag all untouched. Grep final diff for `PlayResX`, `speakable_narration`, `OVERFLOW_RATIO`, `splitNarrationLines`, `\\fad` — zero diff lines on these.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- `smoke-p404.mjs` NOT in final diff
- No new deps, no new asset files

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | `gradients` filter unavailable on Ubuntu GH Actions runner (older ffmpeg) | Architect verified filter listed in ffmpeg 2026-04 Windows + filter is stable since ffmpeg 5.1 (2022). ubuntu-latest (22.04/24.04) ships ffmpeg 6.x. If production runner fails, fallback commit swaps `gradients` → `color=c=0x1a1a2e` (current behavior) — revertable single-line. |
| F-2 | Gradient too busy / distracting from subtitles | `speed=0.008` = ~2-minute full cycle. Verified via frame-extract — motion barely perceptible at 5s intervals. If user complains, fast-follow reduces speed further. |
| F-3 | Gradient colors clash with subtitle white/black outline | `#1a1a2e` → `#2d1b4e` both dark saturated; white subtitle + 2px black outline stays high-contrast per P-401 style. |
| F-4 | Animated bg increases file size / render time significantly | `gradients` is a simple synthetic source — encoder difference vs static `color=` is negligible (just means more non-identical frames for H.264 to encode, but pattern is smooth so compression is still efficient). Frame-by-frame probe during smoke will reveal if size doubles. |
| F-5 | `d=${Math.ceil(totalDuration)}` interpolation breaks ffmpeg param parsing | JS template literal expands to integer before string assembly; `d=45` etc is valid lavfi syntax. |
| F-6 | Color values `0x1a1a2e` vs `#1a1a2e` encoding difference | lavfi `gradients` uses `0xRRGGBB` hex format (not CSS `#RRGGBB`). Spec uses `0x` prefix explicitly. Original `color=c=#1a1a2e` uses `#` which also works in lavfi — `gradients` is stricter. |
| F-7 | smoke-p404.mjs leaks into PR | AC-5 + DoD + reviewer grep. |
| F-8 | Gradient direction `x0,y0,x1,y1` creates static-looking result (no motion visible) | `speed` param independently drives color-cycling animation — direction only sets the gradient's spatial axis. Verified via frame-extract at 3 timestamps. |
| F-9 | Background change breaks Phase 1 E2E (download, Supabase Storage, callback) | Downstream pipeline (encode, upload, callback) untouched. Only the video generator changes. Fast-follow revert to `color=` if E2E breaks. |
| F-10 | Animated gradient increases GitHub Actions render time past 12-min VideoPlayer POLL_MAX_ATTEMPTS=240 threshold | `gradients` CPU cost is negligible (<1% of frame time vs libx264 encoding). Current render averages ~3-5min per video. No risk. |

## Local test plan

### Test 1 — Syntax check (2s)
```bash
cd vibeseek/scripts/render
node --check render.mjs
```
Expected: exit 0.

### Test 2 — Smoke render + frame extract (~1 min)
```bash
cd vibeseek/scripts/render
node smoke-p404.mjs
```
Expected: `✅ 3 frames extracted for gradient-motion verification`. Files: `smoke-out.mp4`, `frame-t0.png`, `frame-t5.png`, `frame-t10.png`.

### Test 3 — Visual confirm (architect-runnable via Read tool)
Architect opens 3 PNGs:
- `frame-t0.png`: subtle gradient visible, dark-blue-dominated
- `frame-t5.png`: gradient should have shifted — slightly more purple bias somewhere
- `frame-t10.png`: further shift from T=0

If all 3 frames look identical → `speed` param not working, bug.
If bg is solid one color → `gradients` filter not honored, bug.
If frames look chaotic / flashy → animation too aggressive, tune speed down.

### Test 4 — ffmpeg stderr check
When running smoke, watch ffmpeg stderr for `No such filter: 'gradients'` or similar. If filter unavailable locally, spec is blocked on that machine — fall back to `color=` and log as blocker in PR.

### Test 5 — User-runnable post-merge (AC-4)
User uploads a PDF → render completes → dashboard video player. Watch 10-20s: bg should feel more alive than pre-P-404 flat blue. Not dramatic — subtle.

## Non-goals (KHÔNG làm)
- KHÔNG download stock video loops (Pexels or elsewhere) — adds supply-chain + storage + licensing
- KHÔNG implement `testsrc2` test pattern — blueprint listed but aesthetically wrong for product
- KHÔNG per-scene distinct background — Phase 5+ if needed
- KHÔNG add gradient animation speed as env var or storyboard field — 0.008 hardcoded MVP
- KHÔNG change subtitle style, TTS path, storyboard schema — all out of scope
- KHÔNG add 3+ color gradients (`c2`, `c3`) — 2-color sufficient for subtle bg
- KHÔNG switch to radial gradient — linear diagonal matches vertical format better

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- Phase 4 lesson frame-extract technique is the architect verification tool. Expect reviewer to run `smoke-p404.mjs` locally (or equivalent architect-side smoke) + open 3 PNGs to confirm gradient motion.
- Reviewer greps final diff for: `gradients=` (1 added line), `color=c=` (1 removed line), `export` (0 new), `package.json` (0 changes).
- If architect's local ffmpeg lacks `gradients` filter, review falls back to trusting agent's smoke log — but ubuntu-latest GH runner will definitely have it.
- Agent red flags: downloading stock videos, adding `node-fetch` or HTTP deps, adding per-scene color variation, restructuring ffmpeg call to pipe through multiple stages, modifying `-vf subtitles=...` filter chain.
- P-404 completes Phase 4. After merge: architect closes Phase 4 formally (all 5 P-4xx done), creates `memory/feedback_vibeseek_phase4_lessons.md` addendum if any new lesson emerged.
