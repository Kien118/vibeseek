# P-403 · Narration duration vs scene duration_sec — word-count budget

**Status:** `review`
**Severity:** MEDIUM (Phase 4 video quality polish)
**Blueprint ref:** §10 Phase 4 · P-403
**Branch:** `task/P-403-narration-duration`
**Assignee:** _(TBD)_
**Depends on:** none — `generateVideoStoryboard` stable since T-106.

## Context

**Current state (main `fd1ec54`):**
- `lib/ai/prompts.ts:58-87` `VIDEO_STORYBOARD_SYSTEM_PROMPT` tells Gemini "Narration súc tích, dễ đọc bằng TTS" — soft guidance, no quantified budget.
- `lib/ai/processor.ts:195-230` `parseStoryboardResponse` clamps `duration_sec` to `[4, 15]` seconds but does NOT cross-validate narration length vs duration.
- `scripts/render/render.mjs` TTS via `edge-tts` voice `vi-VN-HoaiMyNeural` then concatenates audio. Scene's visual background is rendered for `Math.ceil(totalDuration)` seconds (the ffmpeg `color=d=...` line) — so subtitle timing uses TTS duration, NOT the storyboard's `duration_sec` field.

**Symptom (user reported Phase 1 E2E 2026-04-17):** narration thực tế dài gấp đôi `scene.duration_sec`. Gemini tends to write rich Vietnamese narration (30–60 words per scene) while `duration_sec` stays in 4–8s range. edge-tts reads ~2 words/sec vi-VN natural pace, so a 30-word narration needs ~15s, far beyond an 8s scene. This desyncs scene timing from narration flow — the "scene" as a storyboard concept is meaningless if the subtitle for scene N bleeds into scene N+1's visual slot.

**Why the render script doesn't save us:** the current render.mjs concatenates ALL audio into one track and derives total video duration from TTS, not storyboard. Subtitle SRT timing is cumulative from TTS durations (line 254–257). So visually the video plays fine end-to-end, but: (a) the `duration_sec` field in storyboard is a lie, (b) future Phase 4 additions (P-404 per-scene background, P-405 scene crossfades) WILL break because they rely on `duration_sec` for scene boundaries.

**Fix strategy (two layers, both needed):**

1. **Primary (prompt):** tighten `VIDEO_STORYBOARD_SYSTEM_PROMPT` with a quantified rule — `narration ≤ duration_sec × 2 từ tiếng Việt`. Include a worked example. This pushes Gemini to self-comply at generation time.
2. **Safety net (parser):** after Gemini returns, count narration words per scene in `parseStoryboardResponse`. If `words > duration_sec × 2.5`, extend `duration_sec = ceil(words / 2)` (clamped to max 15). Log the extension for diagnostic. Never truncate narration (that loses content); always extend time to accommodate.

Rate constant `2 words/sec` is conservative for edge-tts `vi-VN-HoaiMyNeural`. Empirical measurement during Phase 1 E2E showed ~1.5–2.5 từ/sec depending on diacritic density and sentence complexity.

## Files to touch
- `lib/ai/prompts.ts` — update `VIDEO_STORYBOARD_SYSTEM_PROMPT` with word-count budget rule + example
- `lib/ai/processor.ts` — extend `parseStoryboardResponse` with word-count safety net; log extensions via `console.warn`
- `vibeseek/scripts/smoke-p403.ts` (NEW, **delete before PR**) — local smoke: synthetic JSON validator test + optional real Gemini call
- `tasks/P-403-narration-duration.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/scripts/render/render.mjs` — render script unchanged (P-401 scope; P-405 will touch next)
- `vibeseek/app/api/vibefy-video/route.ts` — route unchanged; uses `generateVideoStoryboard` as black box
- `lib/ai/quiz.ts`, `lib/ai/chat.ts`, `lib/ai/embeddings.ts` — unrelated
- `lib/ai/providers/groq.ts` — Groq fallback uses same prompt + parser automatically
- Any `.env.local` change or new env var — not needed
- `supabase-schema.sql` — no DB change
- Any UI/React file — no UI change

## Architect's spec

### 1. Update `VIDEO_STORYBOARD_SYSTEM_PROMPT` in `lib/ai/prompts.ts`

Replace the `QUY TẮC` block + add an explicit `NGÂN SÁCH TỪ` section. Keep everything else the same.

Current:
```
QUY TẮC:
- Scene ngắn, rõ, có hook và CTA.
- Ngôn ngữ: Việt hoặc mix Việt-Anh tự nhiên.
- Narration súc tích, dễ đọc bằng TTS.
- Visual prompt rõ bối cảnh, ánh sáng, phong cách.
- Duration thực tế (4-15 giây/scene).
```

Replace with:
```
QUY TẮC:
- Scene ngắn, rõ, có hook và CTA.
- Ngôn ngữ: Việt hoặc mix Việt-Anh tự nhiên.
- Visual prompt rõ bối cảnh, ánh sáng, phong cách.
- Duration thực tế (4-15 giây/scene).

NGÂN SÁCH TỪ (QUAN TRỌNG — không vi phạm):
- edge-tts giọng vi-VN-HoaiMyNeural đọc khoảng 2 từ/giây.
- Mỗi scene, "narration" phải ≤ duration_sec × 2 TỪ tiếng Việt.
- Ví dụ: scene 6 giây → tối đa 12 từ. Scene 10 giây → tối đa 20 từ. Scene 15 giây → tối đa 30 từ.
- Đếm từ theo dấu cách: "Chào các bạn sinh viên" = 5 từ.
- Nếu ý cần nhiều từ hơn, TĂNG duration_sec (đến max 15), KHÔNG viết tràn.
- Narration mà quá dài sẽ bị trừ điểm chất lượng video.
```

### 2. Update `parseStoryboardResponse` in `lib/ai/processor.ts`

Add a helper + a safety-net pass after scene normalization. Place the helper near line 186 (next to `isQuotaError`).

```typescript
// Helper: count words (whitespace-separated, Vietnamese-safe — diacritics are part of words).
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// edge-tts vi-VN-HoaiMyNeural speaking rate. Conservative; empirically 1.5-2.5.
const WORDS_PER_SECOND = 2
// Safety-net trigger: Gemini is allowed up to this ratio before we auto-extend.
const OVERFLOW_RATIO = 2.5
```

Then modify the scene mapping in `parseStoryboardResponse` (replacing the current line 214 only):

```typescript
const normalizedScenes = Array.isArray(parsed.scenes)
  ? parsed.scenes.map((scene, idx) => {
      const narration = String(scene?.narration || '')
      const originalDuration = Math.min(15, Math.max(4, Number(scene?.duration_sec) || 6))

      // Safety net: if narration exceeds budget at OVERFLOW_RATIO, extend duration.
      const words = countWords(narration)
      const wordBudgetAtCurrent = originalDuration * WORDS_PER_SECOND
      let duration_sec = originalDuration
      if (words > wordBudgetAtCurrent * (OVERFLOW_RATIO / WORDS_PER_SECOND)) {
        // wordBudget × OVERFLOW_RATIO/WORDS_PER_SECOND = originalDuration × OVERFLOW_RATIO
        // i.e., if words > originalDuration × OVERFLOW_RATIO → extend
        duration_sec = Math.min(15, Math.ceil(words / WORDS_PER_SECOND))
        console.warn(
          `[storyboard] scene ${idx + 1} narration ${words} words > ${originalDuration}s × ${OVERFLOW_RATIO} budget; ` +
          `extending duration_sec ${originalDuration} → ${duration_sec}`
        )
      }

      return {
        scene_index: Number(scene?.scene_index) || idx + 1,
        title: String(scene?.title || `Scene ${idx + 1}`),
        visual_prompt: String(scene?.visual_prompt || ''),
        narration,
        on_screen_text: Array.isArray(scene?.on_screen_text) ? scene.on_screen_text.map(String) : [],
        duration_sec,
      }
    })
  : []
```

**Math explanation:** trigger when `words > originalDuration × OVERFLOW_RATIO` (i.e., > 2.5× the per-second rate). Extension sets `duration_sec = ceil(words / WORDS_PER_SECOND)` = the time actually needed at 2 từ/sec, clamped to 15s max. If Gemini writes 40 words with `duration_sec=6`, budget is 12 words at target / 15 words at overflow trigger; 40 > 15 so extend to `ceil(40/2) = 20` → clamped to 15. Logged to console.

**Why 15 is the ceiling:** existing `duration_sec` clamp is `[4, 15]` (line 214 original) — P-403 preserves that invariant. Narrations that even at 15s × 2 từ/sec = 30 từ still overflow will remain over-budget after extension. That's a Gemini-side quality issue, not a Phase 4 correctness issue; logged for telemetry.

### 3. Create `vibeseek/scripts/smoke-p403.ts` (LOCAL SMOKE — delete before PR)

Purpose: exercise the parser safety-net logic with 3 synthetic scene shapes, without calling Gemini. Then (optional) one real Gemini call to verify prompt compliance.

```typescript
// P-403 smoke — DELETE BEFORE PR
// Usage: cd vibeseek && npx tsx scripts/smoke-p403.ts

import { generateVideoStoryboard } from '@/lib/ai/processor'

// --- Part 1: synthetic parser test (no Gemini call) ---
// To exercise parseStoryboardResponse directly, expose it (TEMPORARILY)
// or call via a test-only wrapper. Simpler: import via relative path if possible.
// Agent decision: agent may either (a) export parseStoryboardResponse from
// processor.ts for this smoke only (then remove), or (b) construct input via
// Gemini mock. Prefer (b) — parse-path is exercised transitively via any
// generateVideoStoryboard call when Gemini is mocked.

// Minimal direct test via re-exporting parseStoryboardResponse for smoke only:
// const { parseStoryboardResponse } = require('@/lib/ai/processor')
// or refactor to export it.

// If agent chooses (b): for smoke simplicity, copy parseStoryboardResponse +
// helpers into smoke-p403.ts verbatim (DELETE BEFORE PR, so no drift risk).
// That's the same pattern used by smoke-p401.mjs (deleted pre-merge).

// Expected behavior under extension:
// Scene A: duration_sec=6, narration=12 words → NO extension (≤ 6×2.5=15) → duration_sec=6
// Scene B: duration_sec=6, narration=20 words → EXTEND (> 15) → ceil(20/2)=10s
// Scene C: duration_sec=6, narration=50 words → EXTEND → min(15, ceil(50/2)=25)=15s (capped)
// Scene D: duration_sec=10, narration=25 words → NO extension (≤ 10×2.5=25) → duration_sec=10

// --- Part 2 (optional, quota permitting): real Gemini call ---
// Agent skip if quota low. Goal: generate 1 storyboard, check that NO scene has
// words > duration_sec × 2 (in the ideal case) or at least no scene triggers extension.

async function main() {
  console.log('Part 1: synthetic parser test')
  // Test scenes A-D (see expected above)
  // Print actual results + PASS/FAIL

  console.log('\nPart 2: real Gemini compliance (optional)')
  // const storyboard = await generateVideoStoryboard(sampleCards, 'P-403 smoke', 4)
  // for each scene: log `${words} words / ${duration_sec}s budget = ${words / duration_sec} words/sec`
  // flag anything > 2.5 words/sec
}
main().catch(err => { console.error(err); process.exit(1) })
```

Agent can choose whether to export `parseStoryboardResponse` for testing (and revert export before PR) or copy-paste the logic into smoke. Either path must leave `processor.ts` with no new exports in the final diff.

## Acceptance criteria
- [ ] **AC-1:** `VIDEO_STORYBOARD_SYSTEM_PROMPT` updated with `NGÂN SÁCH TỪ` block including formula + 3 worked examples. `QUY TẮC` block keeps its non-narration rules.
- [ ] **AC-2:** `parseStoryboardResponse` adds `countWords` + extension logic. Constants `WORDS_PER_SECOND = 2` + `OVERFLOW_RATIO = 2.5` defined as module-level or inline constants.
- [ ] **AC-3:** When extension triggers, `console.warn` emits line matching `/\[storyboard\] scene \d+ narration \d+ words/` for telemetry.
- [ ] **AC-4:** `npx tsc --noEmit` pass.
- [ ] **AC-5:** `npm run build` agent-run (if dev server not active per Phase 3 lesson). Architect will skip build during review if user's dev is running.
- [ ] **AC-6:** Smoke Part 1 synthetic test: scene A no extend; scene B duration 6→10; scene C duration 6→15 (capped); scene D no extend. Agent logs these in PR description.
- [ ] **AC-7 (User-runnable):** Trigger a real storyboard generation via `/api/vibefy-video` (upload PDF on dashboard) and check server log for `[storyboard] scene N narration X words` warnings. Ideal outcome = 0 warnings (Gemini self-complies via prompt). If ≥1 warning per 10 scenes, the prompt rule isn't strong enough — Phase 4+ can revisit wording.
- [ ] **AC-8:** `smoke-p403.ts` deleted before PR. No new `export` left in `processor.ts`.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- `smoke-p403.ts` NOT in final diff
- No new deps in `package.json`

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Gemini ignores the word-count rule | Safety-net parser extends `duration_sec` at OVERFLOW_RATIO=2.5. Worst case video has longer scenes, not broken timing. |
| F-2 | Narration with mix Việt-Anh → "từ" count differs from pure Vietnamese | `countWords` uses whitespace split; English words count equally. Close enough for the TTS-pace heuristic. |
| F-3 | Narration with punctuation-only "words" (e.g., "..." or "!!!") | `filter(Boolean)` + `.trim().split(/\s+/)` handles; standalone punctuation still counted as a word but edge-tts speaks nothing for it. Minor undercount acceptable. |
| F-4 | Gemini returns `duration_sec` outside [4, 15] | Already clamped at line 214 original; preserved. Extension also clamped to max 15. |
| F-5 | Extended `duration_sec` makes `total_duration_sec` disagree with sum — inconsistency | `total_duration_sec` is already recomputed from `normalizedScenes` on line 222 original. Extension is applied before sum → no inconsistency. |
| F-6 | Multiple scenes all extend → total video > 90s blueprint target | Per-scene 15s cap + 6-scene max (maxScenes default) = 90s ceiling preserved. |
| F-7 | `console.warn` pollutes prod logs | Warnings are informational + sampled (only fires on overflow). Accept log volume; Phase 5+ can move to structured metric. |
| F-8 | Prompt change breaks Groq fallback (prompt format too Gemini-specific) | Both providers use same prompt string; Groq llama-3.3-70b handles Vietnamese instructions fine per T-106 E2E. No provider-specific tokens added. |
| F-9 | Agent exports `parseStoryboardResponse` for smoke + forgets to un-export | AC-8 explicitly requires no new exports in final diff. Reviewer greps. |
| F-10 | `console.warn` format doesn't match regex expected by future log-analytics tool | Format pinned in spec + AC-3. Stable. |
| F-11 | Word-count helper misattributed to `\s+` diacritic boundary issue | Unicode-aware `split(/\s+/)` is `\s` = whitespace, which correctly handles non-breaking spaces + tabs + newlines. Diacritics are part of character, not whitespace. Vietnamese compatible. |
| F-12 | `OVERFLOW_RATIO=2.5` still too permissive and videos stay desynced | Telemetry from AC-7 will reveal. Phase 5 can tune. Target ratio is 2, trigger at 2.5 = 25% headroom for Gemini creative variance. |

## Local test plan

### Test 1 — Type check (5s)
```bash
cd vibeseek && npx tsc --noEmit
```
Expected: exit 0, no diagnostics.

### Test 2 — Smoke part 1 (synthetic parser)
```bash
cd vibeseek && npx tsx scripts/smoke-p403.ts
```
Expected output (all 4 cases pass):
- Scene A (6s, 12 words): duration_sec=6 (no extend)
- Scene B (6s, 20 words): duration_sec=10 (extended), console.warn emitted
- Scene C (6s, 50 words): duration_sec=15 (capped), console.warn emitted
- Scene D (10s, 25 words): duration_sec=10 (no extend, within 10×2.5=25 budget)

### Test 3 — Smoke part 2 (real Gemini, optional)
Requires quota + network. Agent decides whether to run based on quota state.
```bash
GEMINI_API_KEY=xxx npx tsx scripts/smoke-p403.ts --with-gemini
```
Log every scene's `{words} words / {duration_sec}s = {ratio} words/sec`. Flag ratio > 2.5.

### Test 4 — User-runnable: trigger real storyboard (AC-7)
Architect or user: upload a test PDF via dashboard. Wait for storyboard generation (check server console for `[storyboard]` warnings).
Expected: 0 warnings for a typical PDF (Gemini self-complies).
Tolerance: ≤ 1 warning per 6-scene storyboard acceptable (occasional creative overrun).

### Test 5 — Full video E2E (deferred, post-merge optional)
Render a real video after P-403 merge. Check that subtitle timing (SRT timestamps in `/tmp` during render) roughly matches each scene's extended `duration_sec`. Watch final MP4 to see if scene-level visual cues (future Phase 4 P-404/P-405) line up with narration. Not blocking P-403 merge.

## Non-goals (KHÔNG làm)
- KHÔNG thay đổi `render.mjs` (render script không cần biết about word-count)
- KHÔNG modify edge-tts voice or pace flags
- KHÔNG add per-scene probe-TTS-then-adjust pass in render.mjs (Phase 5 if prompt+safety-net prove insufficient)
- KHÔNG add new external deps (no `sbd` sentence boundary detector, no `compromise` NLP, etc.)
- KHÔNG đổi storyboard JSON schema (`narration` + `duration_sec` field names preserved)
- KHÔNG truncate narration (always extend duration, never drop content)
- KHÔNG thêm UI hiển thị "scene too long" warning to user — pure backend concern
- KHÔNG add DB field to log extensions persistently — `console.warn` only

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log

- **D-1 (smoke strategy):** picked option (b) — inline-copy of `parseStoryboardResponse` + `countWords` + constants into `scripts/smoke-p403.ts`. Rationale: avoid adding a throw-away `export` to `processor.ts` and the risk of forgetting to revert it (spec F-9 / AC-8). The smoke file is self-contained and deleted before PR, so short-term duplication has no drift surface.
- **D-2 (smoke cleanup):** after tsc + build + Part 1 + Part 2 all pass, deleted `scripts/smoke-p403.ts`. Verified `processor.ts` exports unchanged vs `main` (`git diff main -- lib/ai/processor.ts | grep '^[+-]export'` = empty).
- **D-3 (Part 2 real Gemini):** ran with `.env.local` sourced. `gemini-2.0-flash` + `gemini-2.0-flash-lite` both quota'd, `gemini-2.5-flash` succeeded. Two scenes triggered the safety-net extension:
  - scene 1: 20 words / 6s → extended to 10s (final ratio 2.00 w/s)
  - scene 3: 21 words / 8s → extended to 11s (final ratio 1.91 w/s)
  - scenes 2 + 4 were already in-budget at source (2.25 + 2.38 w/s respectively). All final scene ratios ≤ 2.38 w/s < OVERFLOW_RATIO=2.5. Prompt+parser combo works end-to-end against the same model user most commonly hits.
- **D-4 (smoke type cast):** Part 2 sample cards required `card_type: 'concept' as const` (vs plain `string`) to satisfy the `Pick<VibeCard, 'card_type' | ...>` union literal type in `generateVideoStoryboard`. Cosmetic; no impact on production code.

## Notes for reviewer
- Phase 4 lessons apply:
  - Ffmpeg/libass NOT relevant here (all Gemini-side).
  - `feedback_vibeseek_phase4_lessons.md` frame-extract technique NOT applicable (no video artifact produced by P-403 itself).
- Reviewer should tsc + read diff + mentally trace parseStoryboardResponse's extension math on a few examples.
- AC-7 (real Gemini) is the ground-truth test — architect runs it during review if quota permits.
- Phase 2 lesson F-4 (Groq fallback parity): both paths share the same prompt + parser, so prompt change covers Groq automatically.
- Agent red flags: adding new helper modules (`lib/ai/word-counter.ts` etc.), refactoring unrelated parts of processor.ts, introducing new `export` that lingers after smoke deletion.
