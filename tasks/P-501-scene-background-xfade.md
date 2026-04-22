# P-501 · Per-scene palette pool + ffmpeg xfade crossfade (B2-Lite)

**Status:** `done` (merged 2026-04-22 via PR #40, commit `4f7015f`, merge SHA `76c324f`)
**Severity:** MEDIUM (Phase 5 demo-polish, 1-week timeline)
**Blueprint ref:** §10 Phase 4 · P-405 (original intent revisit); §13 changelog slot (2026-04-XX P-501)
**Branch:** `task/P-501-scene-background-xfade`
**Assignee:** architect direct-implement (no executor dispatch — scope ~60-80 LOC, ffmpeg chain math validated in feasibility smoke)
**Depends on:** P-401 (ASS header + splitNarrationLines + formatAssTime) · P-402 (speakable_narration TTS) · P-403 (word-count budget) · P-404 (gradients lavfi bg) · P-405 (ASS `\fad` subtitle fade). All merged. All stay orthogonal.

---

## Context

**User demo:** 1 tuần from 2026-04-22. Risk tolerance LOW.

**Why B2-Lite (user chốt 2026-04-22):**
- Full B2 (per-scene AI-generated visuals) blocked — image API unavailable in stack.
- User's Manim/infographic idea rejected — Python/LaTeX/Puppeteer deps too risky for 1 tuần.
- B2-Lite = scope-down that delivers **visual diversity across scenes** + **true scene crossfade transitions** without any new deps.

**P-501 = true blueprint §10 P-405 revisit:** blueprint originally prescribed `ffmpeg xfade crossfade 0.3s giữa scenes`. P-405 architect override (2026-04-19) went to ASS `\fad` subtitle fade because render.mjs had only 1 continuous gradient input → `xfade` had nothing to transition between. P-501 lifts that constraint by **generating N per-scene gradient inputs** (one palette per scene from a pool of 8), making `xfade` viable for the first time. P-405 `\fad` stays — it fades subtitle text, orthogonal to bg crossfade. Both coexist.

**Feasibility smoke (architect, 2026-04-22):** 3-scene synthetic render with navy/teal/orange palettes + 0.3s xfade chain + subtitle overlay + anullsrc audio compiled + rendered 12.000s exact (sum of scene durations), visual delta across boundaries confirmed via frame-extract at T=4.5/4.85/5.2/8.5/8.85/9.2s. Math F-4 (`dur_0 = scene_0; dur_i≥1 = scene_i + 0.3`) verified zero drift against `-shortest` audio master. OOM check: 1080×1920×4B × N=20 gradients ≈ 160MB peak on 7GB GH Actions runner — not a risk.

**Key insight from pre-audit:** `sceneDurations[]` array already exists at render.mjs line 253-257 (via `probeDuration(wav)`). Audio concat already produces single mp3 (lines 226-239). P-501 only rewrites the FINAL ffmpeg invocation (lines 310-322) — all upstream data is ready. ~60-80 LOC diff.

---

## Files to touch

- `vibeseek/scripts/render/render.mjs` — add palette pool constant + gradient input builder + filter_complex builder + ffmpeg args rewrite. ~60-80 LOC net addition, ~15 LOC deleted (old simple-filter call).
- `ARCHITECT_BLUEPRINT.md` — §10 Phase 4 P-405 bullet gets note "(P-501 revisited 2026-04-XX with true xfade on per-scene gradients, complementary to this ASS `\fad` override)"; §13 changelog prepend P-501 entry.
- `AGENT_LOG.md` — start + done entries.
- `tasks/P-501-scene-background-xfade.md` (this file) — status transitions.
- `SESSION_HANDOFF.md` — §Step 11 replaced with post-P-501 handoff (after task done).
- `memory/project_vibeseek_state_2026_04_XX_phase5.md` — new state snapshot after merge.

## Files NOT to touch

**Phase 1-4 invariants (byte-for-byte preserved):**

| File / Region | Line (current main) | Phase invariant |
|---|---|---|
| `render.mjs` `splitNarrationLines` function | 129-146 | P-401 |
| `render.mjs` `formatAssTime` function | 151-157 | P-401 |
| `render.mjs` ASS header (`PlayResX`, `PlayResY`, `WrapStyle`, `[V4+ Styles]`) | 284-300 | P-401 |
| `render.mjs` TTS call `speakable_narration \|\| narration` | 211-216 | P-402 |
| `render.mjs` edge-tts invocation + `tts()` helper | 103-109 | P-402 |
| `render.mjs` Dialogue `\fad(300,300)` prefix | 280 | P-405 |
| `render.mjs` audio concat pipeline (concat.txt + ffmpeg -f concat + probeDuration) | 226-243 | core |
| `render.mjs` `scene.narration \|\| scene.text \|\| ''` fallback | 206 | core |
| `render.mjs` Supabase client + job fetch + status updates + upload + callback | 62-98, 164-191, 329-350 | core |
| `lib/ai/processor.ts` | entire file | P-403 |
| `lib/ai/prompts.ts` | entire file | P-402/P-403 |
| `app/api/vibefy-video/route.ts` | entire file | core |
| `lib/storage/*` | entire folder | core |
| `.github/workflows/render-video.yml` | entire file | core |
| `package.json` | — | **NO new deps** |
| `package-lock.json` | — | **NO new deps** |

---

## Architect's spec

### §1 — Palette pool constant

Add at module-top of `render.mjs` (after imports, before `requiredEnv` check). Literal array — do NOT extract to separate file, keep diff self-contained.

```javascript
// ---------------------------------------------------------------------------
// P-501: Palette pool for per-scene gradient backgrounds + xfade crossfade.
// Index 0 = P-404 original (backward visual compat on any 1-scene storyboard).
// Scenes pick by round-robin on scene index: POOL[i % POOL.length].
// ---------------------------------------------------------------------------
const GRADIENT_POOL = [
  { c0: '0x1a1a2e', c1: '0x2d1b4e', speed: 0.008 }, // 0 navy-purple (P-404 original)
  { c0: '0x0f172a', c1: '0x0891b2', speed: 0.008 }, // 1 slate-cyan
  { c0: '0x2d1b4e', c1: '0xc026d3', speed: 0.010 }, // 2 purple-fuchsia
  { c0: '0x7f1d1d', c1: '0xea580c', speed: 0.012 }, // 3 crimson-orange
  { c0: '0x064e3b', c1: '0x059669', speed: 0.008 }, // 4 forest-emerald
  { c0: '0x312e81', c1: '0xa21caf', speed: 0.010 }, // 5 indigo-fuchsia
  { c0: '0x1e293b', c1: '0x0284c7', speed: 0.008 }, // 6 slate-sky
  { c0: '0x9f1239', c1: '0xd97706', speed: 0.011 }, // 7 rose-amber
]
const XFADE_DURATION = 0.3 // seconds — 0.3s crossfade between adjacent scenes
```

### §2 — Deterministic palette picker

Scenes do NOT have `scene.id` in current storyboard schema (verified via render.mjs pre-audit). Use scene index `i` directly. Same PDF → same storyboard → same video on every render (F-7 resolved).

No separate function needed — inline `GRADIENT_POOL[i % GRADIENT_POOL.length]` at gradient input assembly site (§3).

### §3 — Gradient input builder

Replace the single `-f lavfi -i 'gradients=...'` input (current line 313) with N per-scene inputs built from `sceneDurations[]` (already computed at lines 253-257 — reuse, do NOT re-probe).

Build a JS array of input-args arrays, then flat-spread into ffmpeg argv:

```javascript
// sceneDurations already populated from probeDuration(wavFiles[i]) at lines 253-257.
// N = scenes.length (all scenes have gradient input regardless of whether narration was empty;
// but sceneDurations only has entries for scenes with narration — see §6 edge case).

const activeSceneCount = sceneDurations.length // scenes that generated TTS audio
const N = activeSceneCount

// Build gradient input args. Each entry is a pair ['-f', 'lavfi', '-i', '<lavfi-desc>'].
// First gradient duration = scene_0 duration (no xfade tail eat).
// Subsequent gradients get +XFADE_DURATION tail to compensate for xfade head-eat.
const gradientInputArgs = []
for (let i = 0; i < N; i++) {
  const palette = GRADIENT_POOL[i % GRADIENT_POOL.length]
  const dur = i === 0
    ? sceneDurations[i]
    : sceneDurations[i] + XFADE_DURATION
  gradientInputArgs.push(
    '-f', 'lavfi',
    '-i', `gradients=s=1080x1920:d=${dur.toFixed(3)}:c0=${palette.c0}:c1=${palette.c1}:x0=0:y0=0:x1=1080:y1=1920:speed=${palette.speed}:rate=30`
  )
}
```

### §4 — filter_complex builder

Build the xfade chain + subtitle overlay string. Math (verified in feasibility smoke):

- For k in 0..N-2: `xfade_k` offset = `sum(sceneDurations[0..k]) - XFADE_DURATION`.
- Each xfade output label: `[vxf0]`, `[vxf1]`, ..., `[vxf(N-2)]`.
- Chain: `[0:v][1:v]xfade=...offset=<o0>[vxf0]; [vxf0][2:v]xfade=...offset=<o1>[vxf1]; ...; [vxf(N-2)]subtitles=subtitles.ass[vout]`.
- Audio input index = `N` (after N gradient inputs).

```javascript
let filterComplex
if (N === 1) {
  // Single-scene: no xfade needed. Just subtitle overlay on the sole gradient.
  filterComplex = '[0:v]subtitles=subtitles.ass[vout]'
} else {
  const parts = []
  let cumulative = 0
  let prevLabel = '[0:v]'
  for (let k = 0; k < N - 1; k++) {
    cumulative += sceneDurations[k]
    const offset = (cumulative - XFADE_DURATION).toFixed(3)
    const outLabel = `[vxf${k}]`
    parts.push(`${prevLabel}[${k + 1}:v]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${offset}${outLabel}`)
    prevLabel = outLabel
  }
  parts.push(`${prevLabel}subtitles=subtitles.ass[vout]`)
  filterComplex = parts.join(';')
}
```

### §5 — ffmpeg invocation

Replace the current single-call block (current lines 310-322) with:

```javascript
console.log(`Rendering video with ffmpeg — ${N} scene(s), xfade=${XFADE_DURATION}s, palette-pool size=${GRADIENT_POOL.length}...`)
const outputPath = join(workDir, 'output.mp4')

await run('ffmpeg', [
  '-y',
  ...gradientInputArgs,
  '-i', audioPath,
  '-filter_complex', filterComplex,
  '-map', '[vout]',
  '-map', `${N}:a`,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-shortest',
  outputPath,
], { cwd: workDir, timeout: 600_000 })
```

Notes:
- `-map [vout]` selects the subtitles-overlay output from filter_complex.
- `-map ${N}:a` selects the audio input (N-th after N gradient inputs, 0-indexed).
- `-shortest` kept for safety — but with the §3 duration math, video total = audio total so no truncation happens.
- `{ cwd: workDir, timeout: 600_000 }` preserved exactly as current line 322.

### §6 — Edge case: scenes with empty narration

Current render.mjs already skips scenes with empty narration (line 207-210 `if (!narration) continue` before TTS + dialogue loop). Such scenes produce NO entry in `wavFiles`, `sceneDurations`, OR `dialogueLines`. P-501 uses `sceneDurations.length` as `N` — automatically skips empty-narration scenes. No extra code needed.

**Corollary:** if ALL scenes have empty narration, line 221 already throws `No audio generated` — P-501 path never reached. Safe.

### §7 — Summary of deltas

```
render.mjs changes:
  +  GRADIENT_POOL constant (16 LOC)
  +  XFADE_DURATION constant (1 LOC)
  +  gradientInputArgs builder loop (~12 LOC)
  +  filterComplex builder (N=1 + N≥2 branches, ~15 LOC)
  ~  ffmpeg invocation rewrite (~15 LOC replaces ~13 LOC)
  Net: ~+50 LOC render.mjs
```

---

## Acceptance criteria

- [ ] **AC-1:** `GRADIENT_POOL` array declared at module-top with exactly 8 palette entries. Index 0 = `{c0: '0x1a1a2e', c1: '0x2d1b4e', speed: 0.008}` (P-404 backward compat).
- [ ] **AC-2:** `XFADE_DURATION = 0.3` constant declared.
- [ ] **AC-3:** Gradient duration math: input 0 duration = `sceneDurations[0]`; input i≥1 duration = `sceneDurations[i] + XFADE_DURATION`.
- [ ] **AC-4:** xfade offset math: `offset_k = sum(sceneDurations[0..k]) - XFADE_DURATION` for k in 0..N-2.
- [ ] **AC-5:** filter_complex chain labels: `[vxf0]`, `[vxf1]`, ..., `[vxf(N-2)]`, then `[vout]` after subtitles overlay.
- [ ] **AC-6:** N=1 edge case: single-gradient + direct subtitle overlay (no xfade), chain = `[0:v]subtitles=subtitles.ass[vout]`.
- [ ] **AC-7:** `-map [vout]` + `-map ${N}:a` wiring correct. `-shortest` preserved.
- [ ] **AC-8:** `node --check scripts/render/render.mjs` exit 0.
- [ ] **AC-9 (architect-runnable via anullsrc bypass):** synthetic 3-scene smoke renders successfully; `ffprobe -show_entries format=duration` returns exact `sum(sceneDurations)` (12.000s for durations=[5,4,3]).
- [ ] **AC-10 (architect-runnable):** 6 frame-extract PNGs at T=pre-1/mid-1/post-1/pre-2/mid-2/post-2 of each boundary show:
  - pre frames: solid scene N palette
  - mid frames: visible crossfade blend
  - post frames: solid scene N+1 palette + subtitle text rendered at bottom center
- [ ] **AC-11:** Synthetic 10-scene smoke renders; filter_complex compiles; output duration = sum; no black frames between scenes.
- [ ] **AC-12:** Protected-region grep on final diff returns zero matches for: `splitNarrationLines`, `formatAssTime`, `PlayResX`, `PlayResY`, `[V4+ Styles]`, `speakable_narration`, `OVERFLOW_RATIO`, `WORDS_PER_SECOND`, `\\fad(300,300)`, `edge-tts`.
- [ ] **AC-13:** `GRADIENT_POOL[0]` literal values (`0x1a1a2e` / `0x2d1b4e` / `0.008`) preserved — backward visual compat for any single-scene storyboard.
- [ ] **AC-14 (User-runnable, post-merge + redeploy):** Upload a real PDF on prod dashboard (https://vibeseek-five.vercel.app) that produces ≥3-scene storyboard → render completes → user plays video → visible palette variation across scenes + smooth crossfade transitions.
- [ ] **AC-15:** Blueprint §10 P-405 bullet updated with revisit note. §13 changelog prepended with P-501 entry.
- [ ] **AC-16:** No new deps in `package.json` or `package-lock.json`. No new env vars. No new files except this task md.

## Definition of Done

- All AC pass
- AGENT_LOG start + done entries
- Task status → `review` (architect direct-implement = architect is reviewer + implementer; split commit into impl commit + doc commit so diff is readable)
- PR opened against `main`
- No smoke files in final diff (`.tmp-p501-smoke/` cleaned up)
- No new deps
- Post-merge: `cd vibeseek && vercel --prod --yes` redeploy
- Post-redeploy: user AC-14 smoke on prod
- SESSION_HANDOFF + state snapshot updated

---

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | xfade chain OOM on GH Actions runner with N>20 scenes | Memory audit: 1080×1920×4B × 20 = 160MB peak. Runner has 7GB RAM. Not a risk. If future user submits 30+ scene storyboard (unlikely — Gemini caps ~10 scenes), will re-evaluate. **No offramp needed.** |
| F-2 | filter_complex syntax error across edge cases (N=1, 2, many) | §4 explicitly branches N=1 (no xfade, direct subtitle). N=2 tested in smoke. N=10 tested in AC-11. N=3 tested in feasibility smoke 2026-04-22. |
| F-3 | xfade `offset` math wrong → black frames or overlap | Feasibility smoke confirmed 3-scene output = 12.000s exact. Math verified: `offset_k = sum(sceneDurations[0..k]) - XFADE_DURATION`. AC-10 frame-extract will catch any regression. |
| F-4 | Audio concat drift after xfade (video total ≠ audio total) | SOLVED via §3 duration math: input_i dur = `scene_i + 0.3` for i≥1 compensates xfade head-eat. Video total = audio total exactly. Verified 2026-04-22 smoke: 12.000s vs 12.000s. |
| F-5 | Subtitle ASS overlay timing wrong after xfade | ASS uses absolute timestamps from `cumulativeTime` (render.mjs line 266-268), which is `sum(sceneDurations)` — unchanged by xfade. Subtitle still aligns to audio. |
| F-6 | Palette pool too similar → no visual diversity for 3-5 scene videos | 8 entries span navy/cyan/fuchsia/orange/emerald/indigo/sky/rose — hue rotation covers full color wheel. Typical 4-5 scene PDF will show 4-5 visibly distinct bgs (indices 0,1,2,3,4). |
| F-7 | Stochastic palette selection → same PDF renders different each time | SOLVED: deterministic `GRADIENT_POOL[i % POOL.length]` — round-robin by scene index. Same storyboard → same video always. |
| F-8 | P-401/P-402/P-403/P-405 protected region regression | AC-12 explicit grep list. Architect review gate. |
| F-9 | Groq fallback path breaks with pool | Groq populates `render_jobs.storyboard` same JSONB schema — render.mjs doesn't care about AI source. P-501 works for both. |
| F-10 | Blueprint §10 P-405 conflict (xfade now implemented, but P-405 notes ASS `\fad` as "real fix") | Blueprint §10 P-405 bullet updated with revisit note: "(P-501 2026-04-XX revisited with true xfade on per-scene gradients; this ASS `\fad` stays as orthogonal subtitle fade)". Not a repeal — P-405 subtitle fade still in render.mjs line 280. Both coexist. |
| F-11 | xfade offset with non-uniform scene durations → math error | Math uses `sum(sceneDurations[0..k])` — handles any duration distribution. Feasibility smoke used [5,4,3] (non-uniform) — exact. |
| F-12 | Single-scene edge case (N=1) breaks (rare — 1-scene storyboard) | §6 explicit branch: N=1 path bypasses xfade entirely. AC-6 covers. |
| F-13 | Empty-narration scene interleaved with normal scenes | render.mjs already skips empty narration pre-TTS (line 207-210). `sceneDurations.length` reflects only active scenes. N = active count. Empty-scene position in storyboard is invisible to render path — no gap in xfade chain. |
| F-14 | Windows vs Linux ffmpeg filter_complex syntax diff | Both use same libavfilter. Semicolon-separated chain is portable. Architect smoke on Windows gyan.dev 2026-04-09; production is Ubuntu 22.04 GH Actions runner (ffmpeg apt-installed). Both support same syntax. |
| F-15 | Palette pool index rollover (N > 8 scenes) → adjacent scenes with same palette | N=9 → scenes 0 and 8 share palette 0. With xfade between them, user sees "fade to same color" = subtle but not broken. Acceptable. Alternative (shuffled pick) rejected for F-7 determinism. Future enhancement: expand pool to 16 if user feedback demands. |

---

## Local test plan

### Test 1 — Syntax check (2s)
```bash
cd D:/Wangnhat/Study/VibeCode/vibeseek/scripts/render
node --check render.mjs
```
Expected: exit 0, no output.

### Test 2 — 3-scene synthetic smoke (~30s, architect)
Reuse `.tmp-p501-smoke/` feasibility test structure, but invoke the NEW render.mjs logic in isolation via a tiny inline repro:

```bash
cd D:/Wangnhat/Study/VibeCode/.tmp-p501-smoke
# Duplicate the xfade chain smoke from Bước 2 feasibility — with the same 3-palette
# pool (indices 0, 1, 3 from GRADIENT_POOL). Expected output duration = 12.000s.
# Frame-extract at T=4.5/4.85/5.2/8.5/8.85/9.2 → visual diff + subtitle rendering.
```

Done already during Bước 2. Re-running only if architect modifies the math during impl.

### Test 3 — 10-scene synthetic stress (~1-2 min, architect)

Create `scripts/render/smoke-p501-stress.mjs` (DELETE before PR). Synthesizes 10 scenes with durations `[4, 5, 6, 4, 7, 5, 8, 4, 6, 5]` (realistic distribution), renders full pipeline with `anullsrc` audio (sum = 54s), verifies:
- ffmpeg exit code 0
- Output duration = 54.000s (±0.05s tolerance for codec rounding)
- filter_complex compiles without warnings
- Frame extract at each of 9 boundaries shows visible palette transition

If stress fails → OFFRAMP B (xfade only first/last 3 boundaries, concat for middle). But expected to pass per F-1 memory analysis.

### Test 4 — Protected-region grep (5s)
```bash
cd D:/Wangnhat/Study/VibeCode
git diff main -- vibeseek/scripts/render/render.mjs | grep -E "^-" | grep -E "splitNarrationLines|formatAssTime|PlayResX|PlayResY|\[V4\+ Styles\]|speakable_narration|OVERFLOW_RATIO|WORDS_PER_SECOND|\\\\fad\(300,300\)|edge-tts"
```
Expected: zero lines (no deletions touch these invariants).

### Test 5 — User smoke on prod (post-merge + redeploy, AC-14)
After `cd vibeseek && vercel --prod --yes`:
1. User opens https://vibeseek-five.vercel.app
2. Upload a PDF that produces ≥3-scene storyboard (e.g., the TTHCM test PDF from Phase 3 smoke)
3. Wait for render job to complete (~5-12 min on GH Actions)
4. Download + play MP4
5. Verify: (a) scene backgrounds visibly differ, (b) transitions between scenes crossfade smoothly (no hard cut), (c) subtitle text still fades in/out per P-405, (d) audio sync preserved, (e) total video length ≈ sum of scene durations

### Test 6 — Regression: P-404 single-scene path
If user somehow has a 1-scene storyboard (edge case), ensure N=1 branch kicks in + navy-purple palette renders as before P-501. Can validate via a forced 1-scene synthetic smoke with palette index 0 → should produce visually identical output to pre-P-501 render.

---

## Non-goals (KHÔNG làm)

- KHÔNG AI image generation per scene — image API unavailable, and scope blown.
- KHÔNG add Manim/LaTeX/Puppeteer/any Python dep — user's "infographic" idea rejected for 1-tuần demo risk.
- KHÔNG parameterize palette pool via env var or DB — hardcoded 8 entries MVP.
- KHÔNG parameterize xfade duration — 0.3s hardcoded.
- KHÔNG touch ASS header, subtitle text, TTS call, audio concat, Supabase client, callback post — only the final ffmpeg invocation.
- KHÔNG remove P-405 `\fad(300,300)` subtitle fade — it stays, orthogonal to bg xfade.
- KHÔNG repeal P-404 — palette index 0 IS the P-404 original; P-404 extends, not replaces.
- KHÔNG add per-scene audio crossfade — audio concat hard-cut remains (user not reporting audio abruptness).
- KHÔNG add new scene schema fields (e.g. `scene.palette_override`) — deterministic index pick only.
- KHÔNG add xfade transition types beyond `fade` — `transition=fade` hardcoded.
- KHÔNG break existing 1-scene render path — §6 N=1 branch preserves exact pre-P-501 behavior.

---

## Questions / Blockers

_(none — spec self-contained. Feasibility smoke at Bước 2 resolved all math + structure questions.)_

---

## Decisions log

- **D-1** (architect 2026-04-22): `GRADIENT_POOL` placed at module-top of `render.mjs` as inline const (16 LOC), not extracted to separate file. Rationale: keeps P-501 diff self-contained (4 files total), avoids spawning new files in `scripts/render/` dir, matches P-404's in-file palette literal pattern. Rollback trivial if palette tuning needed.
- **D-2** (architect 2026-04-22): `XFADE_DURATION = 0.3` hardcoded as module const. Rejected parameterizing via env var / storyboard schema — MVP only needs one value; future Phase 5+ can expose if user feedback demands per-storyboard control.
- **D-3** (architect 2026-04-22): Deterministic picker `GRADIENT_POOL[i % GRADIENT_POOL.length]` inline (no helper function). Rationale: one-line expression, no branching logic needed, function would bloat diff without added clarity.
- **D-4** (architect 2026-04-22): Gradient input duration formula: `i===0 ? sceneDurations[i] : sceneDurations[i] + XFADE_DURATION`. Verified at Bước 2 feasibility smoke (3-scene, 12.000s exact) and Bước 5 stress (10-scene, 54.000s exact). Math derivation in spec §3.
- **D-5** (architect 2026-04-22): N=1 edge case branch bypasses xfade entirely, uses `[0:v]subtitles=subtitles.ass[vout]`. Rationale: xfade filter needs ≥2 video inputs; chain-builder math assumes N≥2. Separate branch cleaner than special-casing loop boundaries.
- **D-6** (architect 2026-04-22): Audio input placement — after N gradient inputs, mapped via `-map ${N}:a`. Rationale: argv order determines ffmpeg input index; gradients go first (so they take indices 0..N-1), audio last (index N). Makes filter_complex labels `[0:v]..[N-1:v]` align with scene indices — easier to read during debug.
- **D-7** (architect 2026-04-22): Kept `-shortest` flag for safety. With §3 duration math, video total = audio total so `-shortest` is a no-op — but leaving it in means any future accidental drift (e.g., if someone adjusts gradient duration formula) gets silently truncated rather than producing malformed output.

---

## Notes for reviewer / future-self

### Phase 4 lessons explicitly applied here

- **Lesson 2 (frame-extract review):** architect runs synthetic xfade smokes with anullsrc + color/gradients lavfi + extracts PNGs at boundaries. **MUST run before PR** — Phase 4 showed visual bugs hide in MP4 that look fine to compile. 6-frame extract per transition boundary is the fastest signal.
- **Lesson 13 (architect override expected):** P-405 original blueprint prescription was `xfade` → overridden to ASS `\fad` for Phase 4 MVP → now revisited with P-501 doing the true xfade on a richer input structure. Blueprint §10 P-405 bullet gets revisit note, not a repeal.
- **Lesson 14 (protected-region grep):** AC-12 encodes the Phase 1-4 sentinel grep list. Non-optional review gate.
- **Lesson 15 (synthetic toolbox):** `anullsrc` + `gradients=` = entire P-501 testable without edge-tts, without Supabase, without storyboard. Feasibility smoke at Bước 2 proved this.
- **Lesson 17 (minimize user asks):** architect self-verifies via frame extracts, asks user only for AC-14 prod smoke + final merge click. Target ≤2 user asks total.

### Render pipeline deploy note

`render.mjs` runs in GH Actions (`.github/workflows/render-video.yml`) via `sparse-checkout`, NOT in Vercel Functions. Changes to render.mjs pickup on every GH Actions workflow dispatch — **Vercel redeploy is NOT strictly required for render.mjs changes to take effect**. However, per post-T-406 deploy protocol (CLAUDE.md §7), ANY code change to main → manual `vercel --prod --yes` to keep UI/API + render.mjs in sync on observable state. Exec anyway for consistency.

### Expected PR diff

- `vibeseek/scripts/render/render.mjs` (~+50 net LOC, 1 meaningful hunk + 1 constants-at-top hunk)
- `ARCHITECT_BLUEPRINT.md` (§10 P-405 note, §13 changelog prepend)
- `AGENT_LOG.md` (start + done entries)
- `tasks/P-501-scene-background-xfade.md` (this file, status transitions)

**Exactly 4 files.** If diff shows more, out of scope.

### Executor dispatch decision

Architect direct-implement (per Bước 1 pre-audit: ~50 LOC, structure validated, math verified). Skip executor agent — faster path + architect already holds full context from feasibility smoke. If implementation surprises push scope past ~100 LOC, pause + spawn claude-opus-4-7 executor with this spec.

### Post-merge ritual

1. `cd vibeseek && npx tsc --noEmit` (sanity, though render.mjs is plain JS).
2. `cd vibeseek && vercel --prod --yes` (deploy protocol CLAUDE.md §7).
3. User smoke AC-14 on prod.
4. Blueprint §13 P-501 entry. SESSION_HANDOFF replace §Step 11 with post-P-501 handoff. State snapshot `memory/project_vibeseek_state_2026_04_XX_phase5.md`.
5. Close-out per CLAUDE.md §5.
6. Demo prep (2 ngày cuối): record backup MP4 walkthrough, script, test PDFs.
