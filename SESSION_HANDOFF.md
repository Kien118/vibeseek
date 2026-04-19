# Session Handoff — For New Claude Session

> Paste-ready context for a new Claude chat session resuming as **Architect** on VibeSeek.
> **Last refresh:** Phase 3 fully sealed (2026-04-19). Commit tip: `3b3ba5c` (T-305 hotfix 2 chat header badge overlap). **7/7 E2E tests pass. 2 hotfixes total vs Phase 2 baseline 8.**

---

## Step 0 — Bootstrap prompt (paste this FIRST)

```
Bạn là Software Architect cho dự án VibeSeek — đồ án học tập biến PDF thành
Vibe Cards + video 9:16 + quiz + leaderboard + chatbot RAG cho sinh viên
Gen Z Việt Nam. Tôi đã hoàn tất Phase 0/1/2/3 với bạn (Phase 3 đã E2E
seal — 7/7 tests pass, 2 hotfixes). Phiên này ta chuyển sang Phase 4
(Polish — T-401..T-404 core + P-401..P-405 video quality).

Working dir: D:\WangNhat\Study\VibeCode
Repo: https://github.com/Kien118/vibeseek (private)
Git user: twangnhat-05 · email: dev2@wolffungame.com

TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ, đọc theo thứ tự:

1. SESSION_HANDOFF.md (file này) — TL;DR + proposed way of working cho phase
   tiếp theo.
2. ARCHITECT_BLUEPRINT.md §1/§2/§3 — vision, architecture, stack. §10 roadmap
   (Phase 3 marked complete, Phase 4 queued). §13 changelog top.
3. AGENT_LOG.md — 30 dòng cuối để bắt nhịp T-305 close + Phase 3 complete marker.
4. memory/feedback_vibeseek_phase3_lessons.md — **NEW** — 7-step pipeline
   validated + 2 new UI failure modes (dark-body color inherit, mount-time
   load/persist race). **BẮT BUỘC ÁP DỤNG trong Phase 4.**
5. memory/feedback_vibeseek_phase2_lessons.md — Phase 2 checklist vẫn valid.
6. memory/project_vibeseek_state_2026_04_19.md — **NEW** — DB/API/UI snapshot
   sau Phase 3.

Sau đó: xác nhận `sẵn sàng cho Phase 4` (HOẶC `E2E full Phase 3 trước`) + đề
xuất quy trình. Không viết spec vội.
```

---

## Step 1 — What shipped through Phase 3

| Phase | Tasks | Status |
|---|---|---|
| 0 Hygiene | T-001…T-006 | ✅ done |
| 1 Video renderer | T-101…T-108 | ✅ done + E2E verified |
| 2 Quiz + Leaderboard | T-201…T-206 | ✅ done + E2E verified (8 hotfixes) |
| 3 Chatbot RAG | T-301…T-305 | ✅ done (1 hotfix) |
| 4 Polish | T-401…T-404 + P-401…P-405 | 📝 specs NOT written yet |

Commit tips worth knowing:
- `cf75ca1` — architect close T-305 + Phase 3 complete marker
- `08c803a` — T-305 merge (ChatPanel + `/chat/[documentId]` + dashboard link + localStorage)
- `49f628d` — T-305 hotfix (input text color + saveHistory empty-guard)
- `1c023f7` — T-304 merge (SSE `/api/chat` route)
- `7e7ea3a` — T-303 merge (`chat.ts` RAG retrieve + stream)
- `a9cc2d5` — T-302 merge (`embeddings.ts` + `/api/embeddings/ensure`)
- `d630f8e` — T-301 merge (pgvector + card_embeddings + raw_text)

---

## Step 2 — What worked in Phase 3 (keep doing)

**One hotfix across five tasks** vs Phase 2's eight hotfixes. The 7-step pipeline proposed after Phase 2 delivered. Read `memory/feedback_vibeseek_phase3_lessons.md` end-to-end. The short list:

1. Every spec gets a **Failure modes** table (8–15 items). Every listed mode must have explicit defensive code. Agent shipped them, zero post-merge hotfixes from in-spec failure modes in Phase 3.
2. Every spec gets a **Local test plan** with curl/SQL-ready commands (3–7 tests). Caught T-305 localStorage race in 30 seconds.
3. Every spec gets **Files NOT to touch**. Zero scope explosions in Phase 3.
4. **Architect pre-flight audit against real code** before dispatch (2026-04-18 caught 6 drift issues — wrong imports, missing DB column, SDK API shape). Saved 6 would-be hotfixes.
5. **Architect local-runs** the feature during review (not just tsc) — but DOES NOT `npm run build` while user's dev server is active (breaks `.next/server/` chunks).
6. **Three-strikes circuit breaker** held: T-305 hit 2 bugs → direct-fix on branch with user approval. Phase 2 pattern of 8 patch-in-place was replaced.

---

## Step 3 — Two new UI failure modes discovered in Phase 3

Add these to the Phase 2 checklist when reviewing any new UI:

### 9. Dark-theme app + light-theme widget = invisible text
`app/globals.css` sets `body { color: white }`. Any element inside a `bg-white` card without an explicit `text-*` class inherits white and goes invisible. Reviewer must grep for `bg-white` on the diff and confirm sibling `text-*` classes on every text element (input, textarea, span, etc.).

### 10. Mount-time useEffect race between load + persist
When component has both `Effect A: load → setState` and `Effect B: save(state)`, Effect B fires in the same commit as Effect A but with the initial empty-state closure — wipes storage before the load's setState propagates. Fix: make the persist helper defensively refuse to write empty-equivalent values, and add a `clearHelper()` for intentional clears. Document the contract change.

---

## Step 4 — Proposed workflow for Phase 4

Phase 3 closed clean. Phase 4 queued:

- **Core polish (T-4xx):** T-401 error boundaries + empty states, T-402 3D scene loading skeletons, T-403 PWA manifest (optional), T-404 dọn `debug-*.log`.
- **Video quality polish (P-4xx) — found during 2026-04-17 Phase 1 E2E:** P-401 subtitle overflow on 1080x1920 (fix ffmpeg `force_style` + SRT line-split), P-402 English-in-Vietnamese TTS mispronunciation (phonetic rewrite OR bilingual voice concat), P-403 narration duration overshoot scene (limit `duration_sec × 1.5` words, OR probe TTS + extend scene), P-404 monochrome ffmpeg background (upgrade to `testsrc2` gradient or Pexels loop), P-405 scene hard cuts (add `xfade` crossfade 0.3s).

### Architect's proposal for Phase 4 pipeline
Continue the 7-step pipeline from Phase 3 (validated: 2 hotfixes across 5 tasks). Two adjustments based on Phase 3 lessons:

1. **Add `E2E test hygiene` section to any rate-limit/quota-related spec.** Phase 3 Test 4 false-negative (Date.now() unique keys + 60s bucket pollution) wasted 10 min. Spec must bake fixed literal key into test script + document cool-down window.
2. **Add `badge/overlay overlap check` to UI review template.** Phase 3 Test 7 caught late because reviewer only ran desktop viewport. Any new page that renders while `VibePointsBadge` is visible must be checked at 390px (iPhone 13) before approve.

Video-quality specs (P-4xx) are ffmpeg/edge-tts territory, not React/Next.js, so Phase 2 UI failure modes don't map directly. New failure modes to expect: ffmpeg filter syntax errors, TTS voice availability, encoding codec mismatches, duration edge cases (0s scenes). Spec should list these per task.

### Start order (architect recommendation)
P-401 first (subtitle overflow — highest visible polish, low risk) → P-403 (duration — requires coordination with Gemini prompt changes, medium risk) → P-402 (bilingual TTS — most complex, highest risk) → P-405 (crossfade — quick win) → P-404 (background — cosmetic) → T-4xx core polish in parallel with any P-4xx.

---

## Step 5 — Environment notes (still true as of 2026-04-19)

- Windows 11, bash shell (forward slashes OK). PowerShell doesn't support `&&` — use `;` or separate commands. `curl` is aliased to `Invoke-WebRequest`; use `curl.exe` for native.
- `.env.local` in `vibeseek/` has 11 core env vars + 2 Phase 3 debug flags (`DEBUG_FORCE_GEMINI_FAIL`, `DEBUG_FORCE_CHAT_GEMINI_FAIL`).
- ngrok only for Phase 1 render-callback (not needed Phase 3/4 so far).
- GitHub Actions secrets: 7 per blueprint §8.2.
- Dev server: `cd vibeseek && npm run dev`. After any main pull or weird error, wipe `.next`: `Remove-Item -Recurse -Force .next` (PS) / `rm -rf .next` (Git Bash).
- **DO NOT run `npm run build` while user's dev server is active** — corrupts `.next/server/` chunks. tsc alone is enough for review type-check.
- User role on repo: `write` (not admin) — architect deletes branches manually via `git push origin --delete`.

---

## Step 6 — Memory files architect should load

All live in `C:\Users\ADMIN\.claude\projects\C--Users-ADMIN\memory\`:

- `user_wangnhat.md` — user profile
- `feedback_vibeseek_architect_role.md` — triggers + hard rules
- `feedback_write_exact_commands.md` — always write literal commands inline
- `feedback_vibeseek_phase2_lessons.md` — Phase 2 hotfix checklist
- `feedback_vibeseek_phase3_lessons.md` — **NEW** Phase 3 pipeline validation + 2 new UI failure modes
- `project_vibeseek_state_2026_04_19.md` — **NEW** post-Phase-3 snapshot
- `project_vibeseek_state_2026_04_17.md` — superseded, kept for history
- `reference_vibeseek_paths.md` — SSOT file paths + gh CLI

---

## Step 7 — First actions in new session

1. Read this file (you did).
2. Read the memory files above (auto-loaded).
3. Read `ARCHITECT_BLUEPRINT.md` §1, §2, §3, §10, §13.
4. `git log --oneline -10 main` to confirm tip is `3b3ba5c` (or newer if user merged more between sessions).
5. Propose Phase 4 start order (P-401 → P-403 → P-402 → P-405 → P-404, T-4xx in parallel) with 2 pipeline adjustments (rate-limit test hygiene + badge overlap UI review step). Wait for user approval.
6. On user approval, draft Phase 4 specs per validated Phase 3 pipeline (Failure modes + Local test plan + Files NOT to touch + new "E2E test hygiene" + "badge overlap check" sections where relevant).

Do **NOT** skip step 5. Pattern that worked twice (Phase 2 → Phase 3 transition, and this one if user follows) is propose-then-spec, never spec-first.
