# Session Handoff — For New Claude Session

> Paste-ready context for a new Claude chat session resuming as **Architect** on VibeSeek.
> **Last refresh:** Phase 4 FULLY COMPLETE — video + core polish (2026-04-19). Commit tip: `fbdc577` T-401 merge + architect close. **Phase 4 overall: 9/9 tasks, 1 hotfix total, 3 blueprint overrides, 2 rebase-rescues for parallel-dispatch AGENT_LOG conflicts.**

---

## Step 0 — Bootstrap prompt (paste this FIRST)

```
Bạn là Software Architect cho dự án VibeSeek — đồ án học tập biến PDF thành
Vibe Cards + video 9:16 + quiz + leaderboard + chatbot RAG cho sinh viên
Gen Z Việt Nam. **Phase 0/1/2/3/4-FULL đã sealed + E2E verified** (8/8 smoke
tests pass 2026-04-19). MVP production-ready marker earned. Phase 4 video
4-feature stack (P-401 subtitles + P-402 phonetic TTS + P-404 gradient +
P-405 fade) compose correctly trong real render. Phiên này ta làm Phase 5
(scope TBD — T-405 dashboard persistence là top candidate từ UX gaps phát
hiện trong E2E smoke) HOẶC đóng session nếu demo sắp tới.

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
| 3 Chatbot RAG | T-301…T-305 | ✅ done (2 hotfixes) |
| 4 Polish — video quality | P-401…P-405 | ✅ done (1 hotfix, all 5 merged 2026-04-19) |
| 4 Polish — core | T-401…T-404 | ✅ done (0 hotfix, 2 rebase-rescues — parallel dispatch AGENT_LOG conflicts) |
| 5 TBD | — | 📝 scope not yet decided |

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

## Step 4 — Proposed workflow for next session (post-Phase-4 E2E)

Phase 4 fully sealed + E2E verified. 4 UX gaps surfaced during smoke (all pre-existing, not Phase 4 regressions). Two paths forward:

### (Update 2026-04-20) T-405 merged `0ac1c0f` — 2/3 UX gaps closed. T-406 Vercel deploy attempted but deferred.

**T-406 state:** pre-audit clean (no code blockers). Deploy blocked on Vercel GitHub App permission scope — user is collaborator on `Kien118/vibeseek` private repo; Vercel import page doesn't list repo even after Kien118 attempted GitHub App install. Root cause uncertain (3 candidates: (a) Kien118 missed tick `vibeseek` in "Only select repositories", (b) Vercel cache, (c) Vercel OAuth account scope mismatch). Resume when Kien118 + user can jointly debug 15 min — or pivot to fork-based path `twangnhat-05/vibeseek-fork` (trade-off: PR workflow disconnects from upstream).

**Remaining Phase 5 candidates (unchanged):**

### Option A (OLD, NOW COMPLETE) — Phase 5 T-405 "Dashboard persistence + cross-page nav"

**Scope:**
- Dashboard mount reads `anon_id` → fetch recent `vibe_documents` from Supabase → render list with per-doc links (Quiz / Chat / Video). Eliminates re-upload-on-reload.
- VideoPlayer: on dashboard mount, fetch latest `render_jobs` for recent doc → if status=rendering resume polling; if status=ready render MP4 directly. Extend POLL_MAX_ATTEMPTS 240→360 (12→18 min) OR swap to Supabase Realtime channel subscribe.
- Populated leaderboard gains "← Về Dashboard" link in header (consistency with other pages).

**Why now:** biggest demo-blocker. Smoke test showed user must upload PDF twice in same session. Any presenter would hit this live.

### Option B — Phase 5 other directions
- SSML voice switching (if P-402 phonetic feels unnatural to target audience after more user tests)
- Per-scene distinct visuals + ffmpeg xfade concat (true blueprint P-405 original intent — architect overrode to ASS \\fad for MVP)
- Redis/Upstash chat rate-limit (cross-instance when deploy Vercel)
- Persistent chat_messages DB (cross-device sync, Q-09 deferred)
- Deploy Vercel production (domain + SSL + env rotation)

### Architect recommendation
**Option A first** — UX gap has 10× impact on demo experience vs any Phase 5B item. Then evaluate Phase 5B based on demo feedback.

### Old Phase 4 core polish queued path (now done, kept for history reference)

#### Option A (OLD, NOW COMPLETE) — Phase 4 core polish (T-401..T-404)
- T-401 Error boundaries + empty states (React App Router error.tsx patterns)
- T-402 3D scene loading skeletons (DOJO mascot page startup)
- T-403 PWA manifest (optional, `manifest.json` + icons)
- T-404 Dọn `debug-*.log` (hygiene, .gitignore update)

These are React/Next.js UI concerns. Phase 2/3 UI failure modes (dark-body color inherit, mount-time load/persist race, fixed-badge overlap) + Phase 3 pipeline directly apply. Architect frame-extract technique from Phase 4 does NOT apply (UI review needs dev-server run).

### Option B — Phase 5 scope discussion
Possible directions:
- **Per-scene distinct visuals** — true per-scene background images (Gemini visual_prompt → Imagen/DALL-E/Leonardo? Cost concern) + ffmpeg `xfade` concat = the original blueprint P-405 prescription, if P-405 `\fad` alone feels insufficient in Phase 4 user test.
- **SSML voice switching** — if P-402 `speakable_narration` phonetic feels unnatural after user runs AC-9, consider `<voice name="en-US-*">` inline for English substrings. Research edge-tts SSML support first.
- **Redis/Upstash rate-limit** — swap in-memory `chat:${anonId}` bucket in `lib/rate-limit.ts` for a cross-instance store. Only needed if moving off single-server / deploying to Vercel.
- **Persistent chat_messages** — reinstate DB table deferred in Q-09 Phase 3. Adds cross-device sync at cost of PII storage complexity.

Architect recommendation: **Option A** first. Small scope, unblocks mobile install (PWA), wraps Phase 4 cleanly. Then re-evaluate Option B based on P-402/P-404/P-405 subjective user feedback.

### Pipeline adjustments carried forward
- **Spec has `Failure modes` (8-15 items), `Files NOT to touch`, `Local test plan` sections** — mature, keep.
- **Architect pre-flight audit** against real codebase before dispatch — mature.
- **Architect local-runs before approve** — for UI, dev server; for video, frame-extract + anullsrc bypass (Phase 4 lesson). Don't `npm run build` during dev server active (Phase 3 lesson).
- **Three-strikes circuit breaker** — held across Phase 2 (8 hotfix chaos), Phase 3 (2 hotfix), Phase 4 (1 hotfix). Keep.
- **Protected-region grep** — new in Phase 4. For any render.mjs / processor.ts / prompts.ts touch, grep diff for sentinels from prior phases to verify no regression.
- **Architect overrides of blueprint prescriptions are expected** (Phase 4: 3/5 overrides). Document in spec Context section + Decisions log.

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
4. `git log --oneline -10 main` to confirm tip is close to `8682a3e` (P-404 merge) or the architect-close commit right after.
5. Ask user: "Phase 4 core polish (T-401..T-404) hay Phase 5 scope discussion?"
6. On user choice, draft spec(s) per validated Phase 3+4 pipeline (Failure modes, Files NOT to touch, Local test plan, protected-region grep sentinels, appropriate review technique per task domain).

Do **NOT** skip step 5. Pattern that worked twice (Phase 2 → Phase 3 transition, and this one if user follows) is propose-then-spec, never spec-first.
