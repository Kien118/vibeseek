# Session Handoff — For New Claude Session

> Paste-ready context for a new Claude chat session resuming as **Architect** on VibeSeek.
> **Last refresh:** end of Phase 2 E2E, 2026-04-17. Commit tip: `f49013e`.

---

## Step 0 — Bootstrap prompt (paste this FIRST)

```
Bạn là Software Architect cho dự án VibeSeek — đồ án học tập biến PDF thành
Vibe Cards + video 9:16 + quiz + leaderboard cho sinh viên Gen Z Việt Nam.
Tôi đã hoàn tất Phase 0, Phase 1, Phase 2 với bạn ở phiên trước. Phiên này
ta tiếp tục sang Phase 3 (Chatbot RAG).

Working dir: D:\WangNhat\Study\VibeCode
Repo: https://github.com/Kien118/vibeseek (private)
Git user: twangnhat-05 · email: dev2@wolffungame.com

TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ, đọc theo thứ tự:

1. SESSION_HANDOFF.md (file này) — TL;DR + "new ways of working" đề xuất cho
   phase 3 (rút ra từ 8 hotfix Phase 2).
2. ARCHITECT_BLUEPRINT.md §1/§2/§3 — vision, architecture, tech stack locked.
   §10 roadmap tổng, §13 changelog mới nhất.
3. AGENT_LOG.md 20 dòng cuối — bắt kịp lịch sử gần nhất (Phase 2 E2E + 8 hotfixes).
4. memory/feedback_vibeseek_phase2_lessons.md — checklist failure modes để
   preempt trong spec + review Phase 3. **BẮT BUỘC ÁP DỤNG.**
5. memory/project_vibeseek_state_2026_04_17.md — snapshot DB + API + UI hiện tại.

Sau đó: xác nhận với tôi `sẵn sàng cho Phase 3` + đề xuất QUY TRÌNH PHASE 3
MỚI dựa trên bài học Phase 2. Không viết spec vội — chờ tôi duyệt quy trình.
```

---

## Step 1 — What shipped through Phase 2

| Phase | Tasks | Status |
|---|---|---|
| 0 Hygiene | T-001…T-006 | ✅ done |
| 1 Video renderer | T-101…T-108 | ✅ done + E2E verified |
| 2 Quiz + Leaderboard | T-201…T-206 | ✅ done + E2E verified after 8 hotfixes |
| 3 Chatbot RAG | T-301…T-305 | 📝 specs NOT written yet |
| 4 Polish | T-401…T-404 + P-401…P-405 | 📝 video quality issues queued |

Commit tips worth knowing:
- `f49013e` — Phase 2 E2E verified marker
- `10bb068` — "Phase 2 COMPLETE" (post-merge, before E2E fixes)
- `92d91d` → `35e6eb4` — 8 hotfix commits during E2E (see §13 changelog)

---

## Step 2 — What went wrong in Phase 2 (don't repeat)

**Eight hotfixes in one E2E session** came from specs and reviews that missed foreseeable failure modes. User feedback verbatim: *"phiên này bạn làm chưa tốt lắm, có nhiều chỗ phải sửa đi sửa lại"*.

Read `memory/feedback_vibeseek_phase2_lessons.md` end-to-end. The short list:

1. `maxOutputTokens: 4096` is too small for Vietnamese batch JSON → always 16384
2. Retry loops must treat `SyntaxError`, 503, 500, shape-validation errors as retriable — not just 429
3. Every Gemini call site needs a Groq fallback. Audit all three in Phase 3
4. Next.js 14 monkey-patches `fetch` with data cache. supabase-js reads go stale unless you inject `cache: 'no-store'` into `createClient`'s `global.fetch`
5. React Strict Mode dev remounts components. Use canonical `let ignore = false` per effect, not `useRef` guards. Prevent duplicate INSERTs at the DB layer with UNIQUE constraints, not in the frontend
6. List components reusing instances across items need `key={item.id}` on the list entry
7. Any in-page data mutation that affects a global badge/indicator needs a CustomEvent broadcast — don't rely on route change to refresh

---

## Step 3 — Proposed workflow change for Phase 3 (architect to propose to user in first message)

User asked at end of Phase 2: *"ở phiên sau bạn sẽ cho tôi một quy trình tốt nhất khi bạn đóng vai trò là kiến trúc sư"*. Here is the improved pipeline to pitch:

### The seven-step Phase 3 pipeline

1. **Spec draft with failure-mode budget.** Each task spec (`tasks/T-XXX-*.md`) must include a dedicated **"Failure modes"** section listing every realistic way the feature can fail: quota, timeout, race condition, Strict Mode, stale cache, empty input, invalid JSON, auth edge case. The spec must describe the defensive code the agent must write for each.
2. **User-runnable test plan embedded in spec.** Each spec ends with 3–5 explicit commands (curl, SQL, browser steps) the user can run in ~10 minutes to sanity-check the feature before review. No hand-wave "AC-X deferred to E2E".
3. **Architect pre-flight before dispatch.** Architect drafts all specs for a batch, user reviews + approves the batch spec plan **before** any agent is dispatched. Catches spec gaps early (cheap) instead of after PR (expensive).
4. **Agent prompt with scope fence.** Prompt includes explicit "Files to touch" list (already done in Phase 2 after round-1 scope explosion) + "Files NOT to touch" for parallel batches.
5. **Architect local-runs the feature during review.** Not just `tsc + build + read diff`. Actually start the dev server, hit the endpoint with curl, verify the row in DB, click the UI button once. This is what Phase 2 reviews skipped and is why 8 hotfixes happened post-merge instead of pre-merge.
6. **Three-strikes circuit breaker.** If the same feature needs a third hotfix in one E2E session, **stop**. Collect all known bugs into a single consolidated fix task, write a proper spec for it, dispatch to agent. No architect firefighting in-place with protocol exceptions. (Phase 2 burned 8 exceptions → became noise in history.)
7. **E2E verification as a formal step per batch.** Before marking a phase "complete", run an explicit E2E checklist. If any check fails, that's a task, not a hotfix.

### New protocol triggers for user

| Trigger | Architect action |
|---|---|
| `review PR cho T-XXX` | Fetch PR, read diff, **start dev server + exercise the feature**, verify AC + failure-modes-section → verdict |
| `merged T-XXX` | Close task, delete branch local + remote, append AGENT_LOG, push |
| `stuck ở bước N` | Debug step-by-step, explicit options |
| `E2E fail: <feature>` (NEW) | If <3 bugs so far this E2E: architect hotfix directly with user's explicit approval. If ≥3: stop, create consolidated fix task, dispatch |

### Cost model the user should know

- Each agent round-trip ≈ 10–30 min
- Each hotfix ≈ 5–10 min architect time + ≈ 1 min user time (restart dev server)
- Each wasted Gemini request during E2E debugging ≈ 1/1500 of daily quota
- The three-strikes rule exists because beyond three patches it is cheaper to rethink than to keep patching

---

## Step 4 — Environment notes (still true as of 2026-04-17)

- Windows 11, bash shell (forward slashes OK). PowerShell doesn't support `&&` — use `;` or separate commands. `curl` is aliased to `Invoke-WebRequest`, use `curl.exe`.
- `.env.local` in `vibeseek/` has all 11 required env vars (Supabase URL+keys, Gemini, Groq, GitHub dispatch token, Supabase storage bucket, render callback secret)
- ngrok required only when testing video render callback locally (not for Phase 3 chat)
- GitHub Actions secrets: 7 configured per blueprint §8.2
- Dev server: `cd vibeseek && npm run dev`, hot-reload works for API routes + client components. After major dep changes or weird errors, wipe `.next`: `Remove-Item -Recurse -Force .next` (PowerShell) before restarting.
- User role on repo: `write` (collaborator), not admin. Cannot flip `delete_branch_on_merge` setting. Architect deletes branches manually via `git push origin --delete` in close workflow.

---

## Step 5 — Memory files architect should load (via memory system, not by reading the file in repo)

All live in `C:\Users\ADMIN\.claude\projects\C--Users-ADMIN\memory\`:

- `user_wangnhat.md` — user profile
- `feedback_vibeseek_architect_role.md` — three fixed triggers + hard rules
- `feedback_write_exact_commands.md` — always write literal commands inline
- `feedback_vibeseek_phase2_lessons.md` — **NEW** — eight Phase 2 hotfix lessons
- `project_vibeseek_state_2026_04_17.md` — **NEW** — snapshot of live DB + APIs + UI
- `reference_vibeseek_paths.md` — SSOT file paths + gh CLI commands

---

## Step 6 — First actions in new session (ordered)

1. Read this file (you did).
2. Read the 4 memory files above (via auto-memory, they'll be loaded).
3. Read `ARCHITECT_BLUEPRINT.md` §1, §2, §3, §13 (sections 10–12 as needed for Phase 3 spec work).
4. Read last 20 lines of `AGENT_LOG.md`.
5. `git log --oneline -15 main` to confirm latest state.
6. Respond to user with: "Đã nắm context Phase 0/1/2. Đề xuất quy trình Phase 3 mới (7 bước + 4 triggers). Duyệt để tôi bắt đầu viết spec T-301 → T-305?"
7. On user approval, draft Phase 3 specs WITH failure-modes + test-plan sections per the pipeline.

Do **NOT** skip step 6 — the user explicitly asked for a workflow proposal before jumping into spec work.
