# P-401 · Subtitle overflow on 1080x1920 MP4

**Status:** `review`
**Severity:** MEDIUM (Phase 4 video quality polish)
**Blueprint ref:** §10 Phase 4 · P-401
**Branch:** `task/P-401-subtitle-overflow`
**Assignee:** _(TBD)_
**Depends on:** none — `render.mjs` has been stable since Phase 1 merge.

## Context

**Current state (main `89e58dd`):**
- `vibeseek/scripts/render/render.mjs:237-251` writes each scene's `narration` as a single SRT block with no line-splitting. Narrations are typically 60–200 Vietnamese chars per scene.
- `render.mjs:268` ffmpeg filter: `subtitles=subtitles.srt:force_style='Fontsize=48,Alignment=2,MarginV=200,FontName=Arial'`
- At 1080px width + FontSize=48, long narrations either overflow horizontally or wrap into 3+ lines (libass version-dependent), covering too much of the 9:16 frame.

**Blueprint prescription (§10 P-401):** "force_style='MaxLineCount=2,FontSize=40' + SRT generator split lines > 40 chars".

**Architect note (2026-04-19, REVISED post-review):** The SRT-based fix from the initial spec was insufficient. **Root cause discovered during review:** libass with SRT input uses a default canvas `PlayResX=384, PlayResY=288` — fonts get scaled up ~3–6× when rendered onto a 1080×1920 video, regardless of `force_style='Fontsize=N'`. The `subtitles` filter's `original_size=1080x1920` option does not fix the scale. **Real fix:** emit a full ASS file with an explicit `[Script Info]` header declaring `PlayResX: 1080, PlayResY: 1920`, embed the `[V4+ Styles]` + `[Events]` sections, and drop `force_style` entirely. libass then renders at the correct scale. Manual line-split at word boundaries (≤36 chars/line) + 2-line cap with `…` ellipsis on line 2 when overflow. Fontsize=56 against the explicit 1920-tall canvas = readable on mobile 9:16.

## Files to touch
- `vibeseek/scripts/render/render.mjs` — add splitter helper + update SRT writer + update ffmpeg force_style
- `vibeseek/scripts/render/smoke-p401.mjs` (NEW, **must be deleted before PR**) — local smoke test
- `tasks/P-401-subtitle-overflow.md` (status `todo` → `review`)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/app/api/vibefy-video/route.ts` — storyboard generation unchanged (P-403 scope)
- `vibeseek/lib/ai/prompts.ts` — Gemini storyboard prompt unchanged (P-403 scope)
- `.github/workflows/render-video.yml` — workflow unchanged
- `vibeseek/scripts/render/README.md` — user-visible behavior unchanged, no doc edit
- `vibeseek/scripts/render/package.json` — NO new deps
- Any file outside `scripts/render/` — out of scope

## Architect's spec

### 1. Add helper `splitNarrationLines(text, maxCharsPerLine = 36)`

Place above `formatSrtTime` (near other helpers, ~line 125):

```javascript
/**
 * Split a narration string into lines ≤ maxCharsPerLine at word boundaries.
 * Single words longer than the cap get their own line (no mid-word break).
 * Returns [] for empty / whitespace-only input.
 */
function splitNarrationLines(text, maxCharsPerLine = 36) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines = []
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w
    } else if ((current + ' ' + w).length <= maxCharsPerLine) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}
```

### 2. Update SRT writer (lines 237–251 currently)

Replace:
```javascript
srtContent += `${narration}\n\n`
```

with:
```javascript
const allLines = splitNarrationLines(narration, 36)
let displayLines
if (allLines.length <= 2) {
  displayLines = allLines
} else {
  // Cap at 2 lines — line 2 gets ellipsis. Narration audio still plays full.
  displayLines = [allLines[0], allLines[1].replace(/[.,!?…\s]*$/, '') + '…']
}
srtContent += displayLines.join('\n') + '\n\n'
```

### 3. REVISED: SRT → ASS with explicit PlayRes

**Why:** SRT lacks a `[Script Info]` header; libass falls back to `PlayResX=384, PlayResY=288` default, which causes 3-6× font scale-up on 1080x1920 output. `force_style='Fontsize=N'` operates in that mismatched coordinate space, so no value of N gives predictable size. See Decisions log / failure mode F-13.

**Implementation:**

(a) Replace `formatSrtTime` with `formatAssTime` (ASS uses `H:MM:SS.cc`):
```javascript
function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
```

(b) Emit ASS instead of SRT. Header block:
```
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
```

Dialogue line per scene: `Dialogue: 0,{startAss},{endAss},Default,,0,0,0,,{text with \N}`
Display lines joined with ASS hard-newline `\N` (escaped as `\\N` in the JS template string).

(c) ffmpeg command simplified:
```javascript
'-vf', `subtitles=subtitles.ass`,
```
No `force_style`, no `original_size` — ASS header carries the full style + coordinate system.

**Style field semantics:**
- `Fontsize=56` at 1920-tall canvas = ~2.9% of height, legible on mobile 9:16
- `Alignment=2` = bottom-center
- `MarginV=160,MarginL=40,MarginR=40` = 160px from bottom edge, 40px each side
- `Outline=2, Shadow=2, BorderStyle=1` = white text, 2px black outline, 2px shadow — stays readable when Phase 4 P-404 swaps the monochrome background for gradient/pattern
- `PrimaryColour=&H00FFFFFF` = white fill, `OutlineColour=&H00000000` = black outline. Explicit avoids Fontconfig/libass fallback drift between Windows dev and Ubuntu GH runner.
- `ScaledBorderAndShadow: yes` = outline/shadow scale with PlayRes (guards against future runner font-substitution quirks).

### 4. Create `scripts/render/smoke-p401.mjs` (LOCAL SMOKE — delete before PR)

Purpose: exercise the SRT + ffmpeg path with 3 Vietnamese narrations of varying length, output `smoke-out.mp4` without touching Supabase / callback.

```javascript
#!/usr/bin/env node
// P-401 smoke test — DELETE THIS FILE BEFORE PR
// Usage: cd scripts/render && node smoke-p401.mjs
// Output: ./smoke-out.mp4

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const run = promisify(execFile)

// Copy the 3 helpers from render.mjs verbatim (splitNarrationLines, formatSrtTime, tts, probeDuration).
// Keep them identical to render.mjs so smoke exercises the real logic.
// ... [agent copies functions here — KEEP IN SYNC WITH render.mjs] ...

const scenes = [
  { narration: 'Chào các bạn sinh viên.' }, // ~24 chars → 1 line
  { narration: 'Hôm nay chúng ta sẽ tìm hiểu về thuật toán sắp xếp nổi bọt trong môn Cấu trúc dữ liệu.' }, // ~90 chars → 2-3 lines
  { narration: 'Thuật toán Bubble Sort hoạt động bằng cách duyệt qua mảng nhiều lần, so sánh từng cặp phần tử liền kề và hoán đổi nếu chúng sai thứ tự, lặp lại cho đến khi không còn cặp nào cần hoán đổi nữa.' }, // ~200 chars → 5+ lines → triggers cap+ellipsis
]

async function main() {
  const workDir = join(tmpdir(), `p401-smoke-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  try {
    // 1. TTS each scene
    const wavFiles = []
    for (let i = 0; i < scenes.length; i++) {
      const wavPath = join(workDir, `scene-${i}.wav`)
      await tts(scenes[i].narration, wavPath)
      wavFiles.push(wavPath)
    }

    // 2. Concat to mp3
    const concatListPath = join(workDir, 'concat.txt')
    await writeFile(
      concatListPath,
      wavFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'),
      'utf-8',
    )
    const audioPath = join(workDir, 'audio.mp3')
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c:a', 'libmp3lame', '-q:a', '2', audioPath])

    // 3. SRT
    const srtPath = join(workDir, 'subtitles.srt')
    const sceneDurations = []
    for (const f of wavFiles) sceneDurations.push(await probeDuration(f))
    const totalDuration = sceneDurations.reduce((a, b) => a + b, 0)
    let srt = '', t = 0
    for (let i = 0; i < scenes.length; i++) {
      const dur = sceneDurations[i] || 4
      const lines = splitNarrationLines(scenes[i].narration, 40)
      const display = lines.length <= 2
        ? lines
        : [lines[0], lines[1].replace(/[.,!?…\s]*$/, '') + '…']
      srt += `${i + 1}\n${formatSrtTime(t)} --> ${formatSrtTime(t + dur)}\n${display.join('\n')}\n\n`
      t += dur
    }
    await writeFile(srtPath, '\uFEFF' + srt, 'utf-8')

    // 4. Render
    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=#1a1a2e:s=1080x1920:d=${Math.ceil(totalDuration)}`,
      '-i', audioPath,
      '-vf', `subtitles=subtitles.srt:force_style='Fontsize=40,Alignment=2,MarginV=160,FontName=Arial,WrapStyle=2,Outline=2,Shadow=1,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&'`,
      '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest',
      'smoke-out.mp4',
    ], { cwd: workDir, timeout: 600_000 })

    // Copy out of temp dir
    const { copyFile } = await import('node:fs/promises')
    await copyFile(join(workDir, 'smoke-out.mp4'), './smoke-out.mp4')
    console.log('✅ smoke-out.mp4 written to scripts/render/smoke-out.mp4')
    console.log('   Open in VLC / Chrome / Windows Media Player to verify subtitles.')
  } finally {
    try { await rm(workDir, { recursive: true, force: true }) } catch {}
  }
}

main().catch(err => { console.error(err); process.exit(1) })
```

## Acceptance criteria
- [ ] **AC-1:** `splitNarrationLines` helper added, correctly splits at word boundaries, returns `[]` on empty.
- [ ] **AC-2:** SRT writer caps subtitle at 2 lines with `…` ellipsis on line 2 when overflow.
- [ ] **AC-3:** ffmpeg force_style matches spec string exactly (FontSize=40, WrapStyle=2, Outline=2, Shadow=1, explicit Primary/Outline colours).
- [ ] **AC-4:** `node --check scripts/render/render.mjs` pass (syntax).
- [ ] **AC-5:** `node scripts/render/smoke-p401.mjs` produces `smoke-out.mp4` without error.
- [ ] **AC-6 (User-runnable):** Open `smoke-out.mp4` in any player. Verify: (a) scene 1 subtitle is 1 line, (b) scene 2 subtitle is 2 lines each ≤40 chars, (c) scene 3 subtitle is 2 lines ending with `…`, (d) subtitles never extend past left/right edges of the 1080-wide frame.
- [ ] **AC-7:** `smoke-p401.mjs` deleted before PR (spec-required cleanup).

## Definition of Done
- AC pass, smoke video reviewed
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- `smoke-p401.mjs` NOT in final diff
- No changes to `package.json` / no new deps

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Single Vietnamese word > 40 chars (compound or agglutinated) | `splitNarrationLines` puts it on its own line, no mid-word break; font at 40 fits up to ~48 chars per 1080px width so rare single long words still fit. |
| F-2 | Narration ends with `...` already → double ellipsis after cap | Line-2 ellipsis code strips trailing `[.,!?…\s]+` before appending `…`. |
| F-3 | Narration has literal `\n` in source | `splitNarrationLines` uses `/\s+/` split which collapses all whitespace incl. `\n`, so pre-existing newlines are absorbed into word-boundary logic. |
| F-4 | libass on Ubuntu runner vs Windows dev renders `WrapStyle=2` differently | Manual `\n` + `WrapStyle=2` is honored identically; `WrapStyle=0` default would also respect `\n`. Explicit is safer. |
| F-5 | `FontName=Arial` not installed on Ubuntu GH runner | libass falls back to a sans-serif via Fontconfig. Not perfect but not broken. Out of scope for P-401 — addressed separately if P-402 surfaces font issues. |
| F-6 | `force_style` syntax error → ffmpeg succeeds with no subtitles rendered | Agent must run smoke + visually verify subtitles ARE visible (AC-6). If blank, force_style string is malformed. |
| F-7 | smoke-p401.mjs leaks into PR | Spec explicit AC-7 + DoD checklist line. Reviewer also greps PR diff for `smoke-p401`. |
| F-8 | Scene with empty narration (skip TTS) breaks SRT index numbering | Current code uses `wavIdx++` only when narration is non-empty — already correct, do not change. |
| F-9 | Ellipsis `…` char encoding issue on non-UTF-8 systems | SRT written with UTF-8 BOM (line 254 existing) + `…` is a valid UTF-8 codepoint. Verified in ffmpeg output. |
| F-10 | Very short narration (< 10 chars) leaves huge empty screen | Out of scope — font visible, frame bg visible, acceptable. |
| F-11 | Changing FontSize 48 → 40 retroactively shrinks all existing videos' subtitle size | By design — user explicitly flagged 48 too big. Acceptable. |
| F-12 | Agent copies helpers into smoke but forgets to keep in sync if render.mjs helpers change mid-task | Agent keeps render.mjs the source of truth; smoke copies at task-start and is deleted before PR. Sync risk ends with deletion. |
| F-13 | **libass SRT default PlayRes=384×288 scales font 3-6× up on 1080×1920 output** — no `force_style='Fontsize=N'` value gives predictable size because it operates in default coordinate space | **Emit ASS with explicit `PlayResX: 1080, PlayResY: 1920` in `[Script Info]`.** Do NOT rely on `subtitles=…:original_size=1080x1920` — that filter option does not fix this specific scaling. Root cause of the Phase 1 E2E "subtitle tràn" bug user reported 2026-04-17. |

## Local test plan

### Test 1 — Syntax check (5 sec)
```bash
cd vibeseek/scripts/render
node --check render.mjs
node --check smoke-p401.mjs
```
Expected: no output, exit code 0.

### Test 2 — Smoke render (2–3 min)
```bash
cd vibeseek/scripts/render
node smoke-p401.mjs
```
Expected output: `✅ smoke-out.mp4 written to scripts/render/smoke-out.mp4`.
File `smoke-out.mp4` exists in `scripts/render/`.

**If ffmpeg or edge-tts missing:**
- ffmpeg: install via https://ffmpeg.org/download.html or `choco install ffmpeg` (Windows)
- edge-tts: `pip install edge-tts` (requires Python)

### Test 3 — Visual subtitle check (3 min user-runnable)
Open `scripts/render/smoke-out.mp4` in VLC or Chrome (`file:///...`). Playback length ≈ total TTS duration (~20–30s).

Expected:
- **Scene 1** ("Chào các bạn sinh viên."): 1-line subtitle, fits on screen with left/right margin.
- **Scene 2** ("Hôm nay chúng ta sẽ tìm hiểu..."): 2-line subtitle, each line ≤ ~40 chars, no horizontal overflow.
- **Scene 3** ("Thuật toán Bubble Sort..."): 2-line subtitle ending with `…`. First 2 lines of split shown, rest truncated.

Any subtitle that extends past the left or right frame edge = FAIL.
Any subtitle wrapping to 3+ lines = FAIL.

### Test 4 — Syntax of ffmpeg filter string
If Test 2 produces MP4 but subtitle doesn't appear at all in Test 3, force_style is malformed. Workaround: manually run the ffmpeg command from `smoke-p401.mjs` and watch stderr for parse errors. Fix the quoting.

### Test 5 — Full E2E (deferred, post-merge optional)
Upload a real PDF via dashboard → video renders via GH Actions → download MP4 → verify subtitles on real-length narrations. Deferred because P-403 (narration duration fix) is coming next and will further shape real narrations.

## Non-goals (KHÔNG làm)
- KHÔNG đổi storyboard/narration generation (P-403 scope)
- KHÔNG đổi background color/gradient (P-404 scope)
- KHÔNG thêm scene transitions (P-405 scope)
- KHÔNG fix TTS tiếng Anh lẫn tiếng Việt (P-402 scope)
- KHÔNG add deps vào `scripts/render/package.json`
- KHÔNG refactor `render.mjs` layout beyond the 3 targeted changes
- KHÔNG auto-split a long scene's narration into multiple SRT entries (teleprompter mode) — deferred; 2-line cap + truncate is MVP

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
- **2026-04-19 · claude-opus-4-7 (executor)** — AC-5 smoke (`node smoke-p401.mjs`) blocked locally: `spawn edge-tts ENOENT`. The Python module `edge_tts` IS installed (`python -m edge_tts --version` → 7.2.8), but the `edge-tts` CLI shim isn't on PATH in this Git Bash environment. Did NOT modify `render.mjs`'s `tts()` helper (would violate "3 targeted edits only" constraint) and did NOT alter `smoke-p401.mjs`'s verbatim-copy of that helper. AC-4 syntax check pass on both files. AC-1/2/3 code-level pass by inspection. User must verify AC-5/AC-6 locally with proper `edge-tts` CLI on PATH (`pipx install edge-tts` or add Python Scripts dir to PATH).
- **2026-04-19 · architect (post-review hotfix)** — Agent implementation followed spec exactly. During review, architect bypassed edge-tts blocker via silent `anullsrc` audio + ffmpeg frame extraction. First smoke revealed text rendered ~3-6× larger than Fontsize= requested. Root cause: libass SRT input defaults to `PlayResX=384 PlayResY=288` canvas → font scales up on 1080x1920 output. Iterated Fontsize 40→32→28→24 + char caps 40→32→28→36 — overflow persisted because font was being SCALED not sized. Added `original_size=1080x1920` filter option — no effect (that option controls something else). **Real fix: emit `.ass` with explicit `PlayResX/PlayResY: 1080/1920` header + embedded `[V4+ Styles]` block; drop `force_style` entirely.** Fontsize=56 on the correct canvas = legible. Frame extraction from smoke-out.mp4 at scene 1/2/3 timestamps confirmed proper bottom-anchored 2-line render with ellipsis. This also explains the Phase 1 E2E "subtitle tràn" bug root cause. Spec §2/§3 rewritten to match final ASS implementation; F-13 added to failure modes checklist.

## Notes for reviewer
- Phase 3 pipeline applies: reviewer runs smoke locally (Test 2+3) before approve.
- This is ffmpeg/node territory, not React/Next.js. Phase 2/3 UI failure-modes checklist does NOT apply. Phase 4 ffmpeg-specific failure modes documented above.
- Reviewer must visually inspect `smoke-out.mp4` — tsc/lint won't catch subtitle overflow.
- Reviewer must grep final diff for `smoke-p401` and confirm it's absent.
- `scripts/render/node_modules/` should stay in `.gitignore` (Phase 0 hygiene).
