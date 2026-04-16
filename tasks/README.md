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

Phase 1 — **Video Renderer pipeline** (active)

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
