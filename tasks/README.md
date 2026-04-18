# tasks/ — How executor agents work on VibeSeek

This folder contains **task files** — detailed specs for individual units of work.
The single source of truth for architecture is `ARCHITECT_BLUEPRINT.md` (root).

> **Who should read this:** any AI agent (Cursor, Copilot, new Claude Code session, etc.) **before** touching the codebase.

---

## Convention

| Artifact | Location | Who writes |
|---|---|---|
| Architecture | `ARCHITECT_BLUEPRINT.md` | Architect only |
| Task specs | `tasks/T-XXX-<slug>.md` | Architect writes spec; agent updates status + logs + blockers |
| Progress journal | `AGENT_LOG.md` | Every agent, append-only |
| PR template | `.github/PULL_REQUEST_TEMPLATE.md` | Architect |
| Branch naming | `task/T-XXX-<slug>` | Agent creates |

### Task file lifecycle

```
todo  ──►  in-progress  ──►  review  ──►  done
                │
                └──►  blocked  (back to Architect)
```

- `todo`: Architect wrote spec, no agent has started.
- `in-progress`: Agent is actively working. Agent sets this when starting.
- `blocked`: Agent cannot proceed. MUST fill `Questions / Blockers` section.
- `review`: Agent finished, PR open, waiting for Architect review.
- `done`: PR merged. Architect sets this.

---

## Prompt template for a new executor agent

Copy **everything between the `---` lines** and paste to the agent. Replace `T-XXX` with the real ID.

---
```
Bạn là executor agent cho dự án VibeSeek (đồ án học tập, Next.js + Supabase + Gemini).
Working directory: D:\WangNhat\Study\VibeCode

TRƯỚC KHI LÀM BẤT KỲ ĐIỀU GÌ:
1. Đọc `ARCHITECT_BLUEPRINT.md` ở root — kiến trúc tổng thể, §3 tech stack locked, §7 business rules.
2. Đọc `tasks/T-XXX-<slug>.md` — task cụ thể bạn phải làm.
3. `git checkout -b task/T-XXX-<slug>`

KHI LÀM TASK:
- Tuân thủ Acceptance Criteria và Definition of Done trong task file.
- Cập nhật `Status` trong task file sang `in-progress` + commit ngay.
- Append entry vào `AGENT_LOG.md` khi start, khi done, khi blocked.
- Nếu cần quyết định nhỏ không có trong spec → ghi vào mục "Decisions log" trong task file.
- Chỉ sửa file nằm trong "Files to touch" của task. Muốn sửa ngoài scope → báo user.

KHI BỊ KẸT (không rõ yêu cầu / xung đột blueprint / thiếu context):
- DỪNG LẠI.
- Ghi vào "Questions / Blockers" với prefix `[BLOCKED YYYY-MM-DD]`.
- Set Status = `blocked`, commit, báo user "T-XXX blocked, xem task file".
- KHÔNG tự đoán, KHÔNG skip AC.

KHI XONG:
- Commit code với message `T-XXX: <what>`.
- Set Status = `review` trong task file.
- Mở PR theo template `.github/PULL_REQUEST_TEMPLATE.md`.

CẤM:
- Sửa `ARCHITECT_BLUEPRINT.md` (chỉ Architect).
- Thêm dependency mới không có trong blueprint §3 mà không hỏi.
- Commit secret (check `.gitignore`).
- Làm task khác ngoài task được giao.

Task ID: T-XXX
```
---

## File naming

Task files: `T-XXX-<kebab-slug>.md` (slug ngắn, mô tả việc).
Examples:
- `T-001-fix-gitignore-env-local.md`
- `T-101-render-jobs-table.md`
- `T-104-github-workflow-render.md`

## When to create a new task file

Architect creates. Agent does NOT create new task files. If agent thinks a task should be split, they write `[SUGGEST-SPLIT]` in Decisions log and ask user.

## Index

Phase 0 tasks — **ALL DONE** ✅

- [T-001 Fix .gitignore for .env.local](./T-001-fix-gitignore-env-local.md) — ✅ done
- [T-002 Cleanup root junk files](./T-002-cleanup-root-junk.md) — ✅ done
- [T-003 Remove Python pipeline](./T-003-remove-python-pipeline.md) — ✅ done
- [T-004 Audit 3D models](./T-004-audit-3d-models.md) — ✅ done
- [T-005 Reconcile README + agent.md with blueprint](./T-005-reconcile-readme-agent-md.md) — ✅ done
- [T-006 Fix Model.tsx type errors](./T-006-fix-model-tsx-type-errors.md) — ✅ done

Phase 1 — **Video Renderer pipeline** — ✅ ALL DONE

Dependency graph:
```
T-101 (migration) ─ ✅ done by user
T-102 (storage client) ──┬──► T-105 (render script) ──┐
                         │                            │
T-103 (dispatch) ────────┼──► T-106 (vibefy-video) ◄─┤
                         │                            │
T-107 (callback+polling) ┴──► T-108 (VideoPlayer)    │
                                                      │
                                    T-104 (workflow) ◄┘
```

- [T-101 Migration render_jobs + bucket](./T-102-supabase-storage-client.md) — ✅ done (merged into T-102's schema sync)
- [T-102 Supabase Storage client](./T-102-supabase-storage-client.md) — HIGH, foundation
- [T-103 GitHub dispatch trigger](./T-103-github-dispatch-trigger.md) — HIGH, foundation
- [T-104 GH Actions workflow render-video.yml](./T-104-github-workflow-render-video.md) — HIGH
- [T-105 Render script (ffmpeg + edge-tts)](./T-105-render-script.md) — HIGH, core
- [T-106 Refactor /api/vibefy-video + Groq fallback](./T-106-refactor-vibefy-video-api.md) — HIGH
- [T-107 Render callback + polling](./T-107-render-callback-and-polling.md) — MED
- [T-108 VideoPlayer component](./T-108-video-player-component.md) — MED

**Parallel batches:**
- Batch A (foundation, fully parallel): **T-102, T-103, T-107**
- Batch B (once Batch A done): **T-105** (needs T-102), **T-106** (needs T-103), **T-108** (needs T-107)
- Batch C (last): **T-104** (needs T-105)

Phase 2 — **Quiz + Leaderboard** — ✅ ALL DONE (6/6 tasks, Batch A + B + C complete)

Dependency graph:
```
T-201 (DB migration) ─────┐
T-202 (anon-id util) ─────┼──► T-204 (API routes) ──► T-205 (Quiz UI)
T-203 (quiz gen lib) ─────┘                       └──► T-206 (Leaderboard UI + Badge)
```

- [T-201 DB migration (leaderboard_profiles + quiz_attempts)](./T-201-db-migration-leaderboard-quiz.md) — ✅ done (PR #17, merge `95b3d8d`)
- [T-202 anon-id util (SSR-safe localStorage)](./T-202-anon-id-util.md) — ✅ done (PR #18, merge `98436dd`)
- [T-203 Quiz generation lib (batch Gemini→Groq)](./T-203-quiz-generation-lib.md) — ✅ done (PR #19, merge `d733fbe`)
- [T-204 Quiz + Leaderboard API routes (lazy generate + submit + top-N)](./T-204-quiz-leaderboard-api.md) — ✅ done (PR #20, merge `1d019b5`)
- [T-205 Quiz UI (QuizCard + /quiz/[documentId])](./T-205-quiz-ui.md) — ✅ done (PR #22, merge `49f7f9c`)
- [T-206 Leaderboard UI + VibePointsBadge in layout](./T-206-leaderboard-ui-badge.md) — ✅ done (PR #21, merge `7e3afd8`)

**Parallel batches:**
- Batch A (foundation, fully parallel): **T-201, T-202, T-203** — ✅ complete
- Batch B (once Batch A done): **T-204** (needs all of A) — ✅ complete
- Batch C (parallel, once Batch B done): **T-205, T-206** — ✅ complete

**Lessons learned from Batch A (relevant for Batch B/C executors):**
- **Stale-base conflict:** nếu bạn branch trước khi Batch trước merge, rebase onto latest `main` trước khi push. AGENT_LOG conflict là bình thường — giữ cả 2 bên close entries + agent entries.
- **Scope discipline:** `git status` trước mỗi `git add`. KHÔNG `git add .` / `git add -A`. PR #14/#15/#16 bị close vì scope explosion (1 agent làm 3 task, commit PDF + build artifacts).
- **Smoke scripts:** nếu spec yêu cầu xoá sau test → xoá thật. `vibeseek/scripts/smoke-*.ts` + `tsconfig.tsbuildinfo` đã gitignored nhưng vẫn nên check `git status`.

Phase 3 — **Chatbot RAG** — 📝 Specs drafted (2026-04-17), awaiting user batch review

Dependency graph:
```
T-301 (pgvector + card_embeddings DDL) ──► T-302 (embeddings.ts + /api/embeddings/ensure) ──┐
                                                                                             │
                                            T-303 (chat.ts RAG + RPC) ◄───────────────────── ┤
                                                        │                                    │
                                                        └──► T-304 (/api/chat SSE) ──► T-305 (ChatPanel + page)
```

- [T-301 Migration pgvector + card_embeddings + sync quiz UNIQUE](./T-301-pgvector-card-embeddings-migration.md) — ✅ done (PR #23, merge `d630f8e`)
- [T-302 `lib/ai/embeddings.ts` + `POST /api/embeddings/ensure`](./T-302-embeddings-lib-and-ensure-endpoint.md) — ✅ done (PR #24, merge `a9cc2d5`). Decision D-1: model `gemini-embedding-001` + `outputDimensionality: 768` (text-embedding-004 404 via @google/genai@1.50.0 SDK).
- [T-303 `lib/ai/chat.ts` RAG retrieval + streaming wrapper + RPC](./T-303-chat-lib-rag-streaming.md) — 📝 todo
- [T-304 `POST /api/chat` SSE route](./T-304-chat-sse-api-route.md) — 📝 todo
- [T-305 `ChatPanel` + `/chat/[documentId]` page + dashboard link](./T-305-chat-panel-and-page.md) — 📝 todo

**Proposed parallel batches:**
- Batch A (single, blocking everything): **T-301** (DDL, user chạy SQL Dashboard)
- Batch B (parallel once T-301 merged): **T-302, T-303** — T-303 import `embedTexts` từ T-302 nhưng chỉ ở lib level → có thể develop parallel nếu agent T-303 dùng type-only import hoặc dựng mock function tạm trong branch. Khuyến nghị an toàn: T-302 xong trước, T-303 base trên merged main.
- Batch C (once B done): **T-304** (cần T-302 + T-303)
- Batch D (cuối): **T-305** (cần T-304)

**Rule mới cho Phase 3 (rút từ 8 hotfix Phase 2):**
- Mỗi spec có section `Failure modes` + `Local test plan` + `Non-goals` + `Files NOT to touch` — đã áp dụng.
- **Architect PHẢI chạy Local test plan thật** (dev server + curl) khi review PR — không chỉ `tsc + build`.
- **Three-strikes circuit breaker:** nếu 1 task cần hotfix lần 3 trong E2E → dừng, gom consolidated fix task, dispatch agent. KHÔNG architect vá in-place vô hạn như Phase 2.
- `DEBUG_FORCE_GEMINI_FAIL=true` env flag có sẵn ở T-302/T-303 để test Groq fallback mà không chờ quota cạn.
