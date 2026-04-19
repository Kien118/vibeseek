# P-402 · English terms mispronounced by vi-VN TTS — dual-field narration

**Status:** `todo`
**Severity:** MEDIUM (Phase 4 video quality polish)
**Blueprint ref:** §10 Phase 4 · P-402
**Branch:** `task/P-402-english-tts-pronunciation`
**Assignee:** _(TBD)_
**Depends on:** none — clean on top of P-401 + P-403 already merged.

## Context

**Current state (main `fb1aa3f`):**
- `lib/ai/prompts.ts:67` system prompt allows *"Ngôn ngữ: Việt hoặc mix Việt-Anh tự nhiên"* — Gemini freely writes English technical terms in `narration` (e.g., "Bubble Sort", "API", "AI agent").
- `lib/ai/processor.ts:169-175` `VideoScene` interface has a single `narration: string` used for BOTH subtitle text AND TTS input.
- `scripts/render/render.mjs:213` passes `narration` directly to `tts()` which invokes `edge-tts --voice vi-VN-HoaiMyNeural --text "$narration"`. edge-tts's Vietnamese voice attempts to pronounce English words using Vietnamese phonemes → garbled output.
- Same `narration` is used for subtitle display (`render.mjs:267` splits it into lines).

**Symptom (user reported Phase 1 E2E 2026-04-17):** "English terms mispronounced". Example: "Bubble Sort" narrated as incoherent syllables, students can't follow the audio even though the subtitle is correct.

**Fix strategies evaluated:**

1. **Phonetic rewrite (replace English in narration)** — Gemini writes "bấp-bồ soóc" instead of "Bubble Sort". **Rejected:** student can't look up the term from subtitle; educational value drops.
2. **SSML voice-switching** — detect English substrings in render.mjs, wrap with `<voice name="en-US-*">` in SSML, pass to edge-tts via `--file`. **Rejected for P-402:** edge-tts SSML support for mid-text voice switching is not documented robustly; high complexity + rewrite of render TTS path; risk of new libass-tier env gotcha during review. Defer to Phase 5+ if dual-field approach insufficient.
3. **Dual-field narration (CHOSEN)** — storyboard schema gains `speakable_narration` field: phonetic-Việt version used for TTS. Existing `narration` keeps the original Latin terms + is used for subtitle. Render.mjs uses `speakable_narration || narration` (backward-compat fallback).

**Why dual-field wins:** (a) subtitle preserves the Latin term — students see "Bubble Sort" correctly and can search it later; (b) TTS reads a Vietnamese-phonetic approximation — audio is comprehensible; (c) single-prompt update + single-parser update + 2-line render.mjs change — bounded scope; (d) falls back gracefully if Gemini forgets the new field (old storyboards keep working).

**Design of `speakable_narration`:**
- Same Vietnamese semantic content as `narration` but with English/Latin terms replaced by Vietnamese-phonetic transliterations.
- Example: narration `"Bubble Sort là thuật toán đơn giản nhất"` → speakable_narration `"bấp-bồ soóc là thuật toán đơn giản nhất"`.
- Example: narration `"dùng API từ OpenAI"` → speakable_narration `"dùng a-pi-ai từ o-pen a-i"`.
- Rule: only ASCII `[A-Za-z]+` runs of ≥2 chars get rewritten; Vietnamese words (with diacritics) stay identical.
- If narration has no English terms, `speakable_narration` is identical to `narration` (Gemini copies).

## Files to touch
- `lib/ai/prompts.ts` — `VIDEO_STORYBOARD_SYSTEM_PROMPT` gains instructions for `speakable_narration` + updated JSON schema example
- `lib/ai/processor.ts` — `VideoScene` interface adds `speakable_narration: string`; `parseStoryboardResponse` defaults it to `narration` if missing
- `vibeseek/scripts/render/render.mjs` — TTS uses `speakable_narration || narration`; subtitle generation unchanged (keeps using `narration`)
- `vibeseek/scripts/smoke-p402.ts` (NEW, **delete before PR**) — synthetic parser test covering all fallback paths
- `tasks/P-402-english-tts-pronunciation.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `supabase-schema.sql` — storyboard lives in `render_jobs.storyboard JSONB`; no DDL change
- `vibeseek/app/api/vibefy-video/route.ts` — route unchanged (storyboard persisted as-is)
- `lib/ai/quiz.ts`, `lib/ai/chat.ts`, `lib/ai/embeddings.ts` — unrelated
- `lib/ai/providers/groq.ts` — Groq fallback inherits new prompt + parser automatically
- Render.mjs SRT/ASS subtitle path (P-401 scope; must NOT regress ASS header work)
- Any UI / React / Next.js file
- `package.json` — NO new deps

## Architect's spec

### 1. Update `VIDEO_STORYBOARD_SYSTEM_PROMPT` in `lib/ai/prompts.ts`

(a) Change the existing language rule — clarify English is allowed IN `narration` but must have phonetic Việt companion in `speakable_narration`:

Current line 67:
```
- Ngôn ngữ: Việt hoặc mix Việt-Anh tự nhiên.
```

Replace with:
```
- Ngôn ngữ narration: Việt hoặc mix Việt-Anh tự nhiên (giữ nguyên thuật ngữ Anh để sinh viên nhìn đúng).
```

(b) Add a new rule block after `NGÂN SÁCH TỪ` (which was added by P-403):

```
PHIÊN ÂM CHO TTS (speakable_narration):
- Trường "speakable_narration" = bản đọc-được của "narration" cho edge-tts tiếng Việt.
- Với MỌI từ tiếng Anh trong "narration" (≥2 ký tự Latin liền nhau), viết phiên âm Việt tương đương.
- Ví dụ: "Bubble Sort" → "bấp-bồ soóc" · "API" → "a-pi-ai" · "AI" → "ây-ai" · "Google" → "gu-gồ" · "debug" → "đi-bấg".
- Từ tiếng Việt (có dấu) giữ nguyên, KHÔNG đổi.
- Nếu "narration" không có từ tiếng Anh nào, "speakable_narration" = copy nguyên "narration".
- Dấu câu + khoảng trắng + độ dài nên xấp xỉ giống "narration" để SRT timing khớp.
```

(c) Update the `RESPONSE FORMAT` JSON example to include the new field:

Current (lines 72-87):
```
{
  ...
  "scenes": [
    {
      "scene_index": 1,
      "title": "Hook",
      "visual_prompt": "Mô tả hình ảnh cho scene",
      "narration": "Lời thoại",
      "on_screen_text": ["line 1", "line 2"],
      "duration_sec": 6
    }
  ]
}
```

Update the scene object to:
```
    {
      "scene_index": 1,
      "title": "Hook",
      "visual_prompt": "Mô tả hình ảnh cho scene",
      "narration": "Lời thoại (có thể có thuật ngữ Anh như Bubble Sort)",
      "speakable_narration": "Lời thoại phiên âm (bấp-bồ soóc thay Bubble Sort)",
      "on_screen_text": ["line 1", "line 2"],
      "duration_sec": 6
    }
```

### 2. Update `VideoScene` interface + `parseStoryboardResponse` in `lib/ai/processor.ts`

(a) Extend interface (line 169):
```typescript
export interface VideoScene {
  scene_index: number
  title: string
  visual_prompt: string
  narration: string
  speakable_narration: string
  on_screen_text: string[]
  duration_sec: number
}
```

(b) In `parseStoryboardResponse` scene mapping (around line 215-239), add extraction + fallback. Inside the existing `parsed.scenes.map((scene, idx) => { ... })` block, add `speakable_narration` alongside `narration`:

```typescript
const narration = String(scene?.narration || '')
const speakable_narration = String(scene?.speakable_narration || '').trim() || narration
```

And include it in the returned object:
```typescript
return {
  scene_index: Number(scene?.scene_index) || idx + 1,
  title: String(scene?.title || `Scene ${idx + 1}`),
  visual_prompt: String(scene?.visual_prompt || ''),
  narration,
  speakable_narration,
  on_screen_text: Array.isArray(scene?.on_screen_text) ? scene.on_screen_text.map(String) : [],
  duration_sec,
}
```

**Fallback semantics:** if Gemini omits `speakable_narration` OR returns an empty/whitespace-only string, we default to `narration`. This preserves today's behavior (TTS reads narration) while letting compliant outputs upgrade to phonetic.

**P-403 word-count logic:** unchanged — uses `narration` for word count (`countWords(narration)`). Rationale: speakable is phonetic variant with ~same word count; budget anchors on the authored text.

### 3. Update `scripts/render/render.mjs` TTS invocation

Change the TTS call (line 206-213 currently) to prefer `speakable_narration`:

```javascript
const scene = scenes[i]
const narration = scene.narration || scene.text || ''
if (!narration) {
  console.warn(`Scene ${i} has no narration text, skipping TTS`)
  continue
}
const speakable = (typeof scene.speakable_narration === 'string' && scene.speakable_narration.trim())
  ? scene.speakable_narration
  : narration
const wavPath = join(workDir, `scene-${i}.wav`)
console.log(`  TTS scene ${i}: "${speakable.substring(0, 50)}..."${speakable !== narration ? ' (phonetic)' : ''}`)
await tts(speakable, wavPath)
wavFiles.push(wavPath)
```

**Subtitle generation (line 257-281 currently) — NO CHANGE.** Still uses `narration` (the Latin-preserving form) for ASS dialogue text. Students see `"Bubble Sort"` in subtitles; audio reads `"bấp-bồ soóc"`.

**Why both paths reference the same `scene` object, not a separate mapping:** the scene object comes from `render_jobs.storyboard.scenes`, persisted by processor.ts. New field flows through DB automatically (JSONB column).

### 4. Create `scripts/smoke-p402.ts` (LOCAL SMOKE — delete before PR)

Purpose: exercise parser fallback matrix without Gemini call. Covers 4 cases:

| Case | Gemini output shape | Expected `speakable_narration` |
|---|---|---|
| A | `narration: "Bubble Sort là ...", speakable_narration: "bấp-bồ soóc là ..."` | phonetic version preserved |
| B | `narration: "Thuật toán sắp xếp"` (speakable_narration missing from JSON) | falls back to narration |
| C | `narration: "Bubble Sort là ...", speakable_narration: ""` (empty string) | falls back to narration |
| D | `narration: "Bubble Sort là ...", speakable_narration: "   "` (whitespace only) | falls back to narration |

Agent chooses: either (a) temporarily export `parseStoryboardResponse` from `processor.ts` for the smoke + revert export before PR, or (b) copy parse logic inline into smoke. Prefer (b) — no drift risk post-deletion (same pattern as smoke-p401.mjs and smoke-p403.ts).

Optional Part 2: if quota permits, one real Gemini call — check that output contains `speakable_narration` with recognizable phonetic variants for any Latin terms found in `narration`.

## Acceptance criteria
- [ ] **AC-1:** `VIDEO_STORYBOARD_SYSTEM_PROMPT` language rule updated + new `PHIÊN ÂM CHO TTS` block + JSON schema example includes `speakable_narration`.
- [ ] **AC-2:** `VideoScene` interface adds `speakable_narration: string` (required field in type, defaulted in parser).
- [ ] **AC-3:** `parseStoryboardResponse` extracts `speakable_narration`, defaults to `narration` when missing/empty/whitespace.
- [ ] **AC-4:** `render.mjs` TTS call uses `speakable_narration` when non-empty, else `narration`. Log line reveals which path was used.
- [ ] **AC-5:** `render.mjs` subtitle (ASS dialogue) generation **unchanged** — still uses `narration`.
- [ ] **AC-6:** `npx tsc --noEmit` pass.
- [ ] **AC-7:** `npm run build` pass (may be skipped by architect if user dev server running; agent must run).
- [ ] **AC-8:** Smoke Part 1 synthetic: 4/4 fallback cases produce expected `speakable_narration`. Log + PR body include actual vs expected.
- [ ] **AC-9 (User-runnable, post-merge):** Render a real video via dashboard with a PDF containing CS terms (any existing English-heavy doc). Verify: (a) subtitle shows English terms in Latin, (b) audio pronounces them as Vietnamese-phonetic syllables (students can understand the sound even if imperfect), (c) server log shows `"TTS scene N: ..." (phonetic)` on scenes with English terms.
- [ ] **AC-10:** `smoke-p402.ts` deleted before PR. No new `export` lingering in `processor.ts`. No touches to `render.mjs` SRT/ASS paths beyond the TTS field swap.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- `smoke-p402.ts` NOT in final diff
- No new deps / new exports

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Gemini omits `speakable_narration` entirely | Parser falls back to `narration` → TTS same as today (no regression). |
| F-2 | Gemini returns `speakable_narration` identical to `narration` (doesn't rewrite terms) | Log line shows no `(phonetic)` marker; TTS still works (mispronounces as before). Post-merge AC-9 reveals if prompt is too weak. |
| F-3 | Gemini returns Latin chars INSIDE `speakable_narration` ("bấp-bồ Sort") | edge-tts still mispronounces the residual Latin. Minor regression vs fully-Việt. Accept for MVP; log could flag Latin detection if noisy — deferred. |
| F-4 | Existing storyboards in DB (from before P-402 merge) don't have `speakable_narration` | Parser fallback + render.mjs fallback handle missing/undefined field. No DB migration needed. |
| F-5 | `speakable_narration` has very different length than `narration` → SRT timing mismatch with TTS | SRT timing uses TTS duration (probed from .wav files in render.mjs line 232). Subtitle timing anchored on audio, not narration length. Works correctly. |
| F-6 | P-403 word-count budget applies to `narration` but TTS reads `speakable_narration` which could differ | Accepted: phonetic variants are ~same word count as source (Gemini writes phonetic by-syllable, ~1:1). Spec pins `countWords(narration)` explicitly. |
| F-7 | Ambiguous Vietnamese words (no diacritics like "em", "anh", "cho") — Gemini might phonetic-rewrite them unnecessarily | Rule in prompt: only rewrite Latin runs ≥2 chars. Gemini respects. If edge-case, log + ignore. |
| F-8 | `scripts/smoke-p402.ts` leaks into PR | DoD + AC-10 + reviewer greps `smoke-p402` on diff. |
| F-9 | New `export parseStoryboardResponse` left in processor.ts | Agent chooses strategy (b) = inline copy; if (a) is chosen, agent reverts + AC-10 reviewer grep confirms. |
| F-10 | render.mjs `speakable` local variable shadows existing identifier | None exists (checked); variable name unique in TTS block. |
| F-11 | Proper nouns (person names) phonetic-rewritten oddly ("Claude" → "cờ-lô đờ") | Acceptable — edge-tts default vi voice was doing the same, just worse. Phonetic is equal or better quality. |
| F-12 | edge-tts voice fallback or upgrade changes pronunciation behavior in future | Out of scope. P-402 anchors on current `vi-VN-HoaiMyNeural` pace + phonetic style. |
| F-13 | Test PDF for AC-9 isn't available (user doesn't have English-heavy doc on dashboard) | Any doc with CS terms works. If no doc, user uploads fresh CS-topic PDF (same pattern as P-401 E2E). Not blocking merge — AC-9 is user-runnable. |

## Local test plan

### Test 1 — Type check (5s)
```bash
cd vibeseek && npx tsc --noEmit
```
Expected: exit 0.

### Test 2 — Smoke Part 1 (synthetic parser, 10s)
```bash
cd vibeseek && npx tsx scripts/smoke-p402.ts
```
Expected output:
```
Case A: narration="Bubble Sort là ...", speakable="bấp-bồ soóc là ..." [PASS — phonetic preserved]
Case B: narration="Thuật toán sắp xếp", speakable=<fallback to narration> [PASS]
Case C: narration="Bubble Sort là ...", speakable=<fallback, empty string> [PASS]
Case D: narration="Bubble Sort là ...", speakable=<fallback, whitespace> [PASS]
Synthetic: 4/4 pass
```

### Test 3 — Smoke Part 2 (real Gemini, optional)
```bash
GEMINI_API_KEY=xxx npx tsx scripts/smoke-p402.ts --with-gemini
```
Log each scene's `narration` vs `speakable_narration`. Agent flags scenes where Gemini:
- omitted the field → fallback worked
- returned identical values → phonetic rewrite not applied (prompt weak, telemetry data)
- returned phonetic ≠ narration → success case

### Test 4 — User-runnable E2E (AC-9, post-merge)
User uploads a PDF with CS/tech terminology → check video render:
- Subtitle still shows "Bubble Sort" (or any Latin term) correctly
- Audio pronunciation clearly different from pre-P-402: now sounds like Vietnamese syllables approximating the English term
- Dashboard video playback: toggle between subtitle display + audio mute/unmute to compare

If audio STILL sounds like the original garbled attempt, prompt didn't work and Phase 5 needs SSML path (approach 2).

### Test 5 — Full render (deferred, requires local render.mjs run)
If user has render stack locally (ffmpeg + edge-tts + Node):
```bash
cd vibeseek/scripts/render && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node render.mjs <existing-render-job-id>
```
Use a job with English terms. Listen to output MP4 audio.

## Non-goals (KHÔNG làm)
- KHÔNG implement SSML voice switching or dual-voice concat (deferred Phase 5+)
- KHÔNG add English-detection regex in render.mjs (Gemini handles rewriting)
- KHÔNG change edge-tts voice or rate
- KHÔNG change `narration` field semantics (still the source of truth for subtitle + word count)
- KHÔNG add DB migration for storyboard (JSONB is schemaless; new field flows automatically)
- KHÔNG refactor `VideoScene` to union types / optional fields — `speakable_narration` is required in type, defaulted by parser
- KHÔNG auto-detect English terms + rewrite in code — Gemini is the rewriter; we never apply our own phonetic algorithm
- KHÔNG touch ASS subtitle styling / layout (P-401 scope, already shipped)

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- Phase 4 lessons apply:
  - libass/ffmpeg NOT touched — no frame-extract technique needed for this review.
  - Audio verification requires playback — architect can only smoke the parser; user confirms actual audio in AC-9.
- Reviewer greps final diff for `smoke-p402`, new `export`, new deps.
- Groq parity: both providers use the same prompt + parser, so `speakable_narration` propagates automatically. No Groq-specific logic.
- Architect cannot listen to MP4 audio — AC-9 is explicitly user-runnable.
- Agent red flags: adding `lib/ai/phonetic.ts` helper, English-detection regex in render.mjs, new edge-tts CLI flags, changes to SRT/ASS subtitle block (P-401 territory).
