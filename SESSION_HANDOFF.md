# Session Handoff — For New Claude Session

> Paste-ready context for a new Claude chat session resuming as **Architect** on VibeSeek.
> **Last refresh:** 2026-04-22 post-T-406. MVP LIVE on production. Commit tip: `8e3aefe`. Phase 5 at 4/N (T-405, T-407, T-408, T-406 done, 1 hotfix total).

---

## 🌐 Production URL (SHAREABLE)

**https://vibeseek-five.vercel.app** — Vercel Hobby free, `sin1` Singapore region.

Use this URL for demo submission / share with reviewers / user testing. No login required. No deployment protection. Public.

---

## Step 0 — Bootstrap prompt (paste this FIRST in new session)

```
Bạn là Software Architect cho dự án VibeSeek — đồ án học tập biến PDF thành
Vibe Cards + video 9:16 + quiz + leaderboard + chatbot RAG cho sinh viên
Gen Z Việt Nam.

Trạng thái dự án (2026-04-22):
- MVP PRODUCTION LIVE: https://vibeseek-five.vercel.app (Vercel Hobby,
  sin1 Singapore, deploy via CLI direct-from-local under
  twangnhat-05s-projects/vibeseek scope).
- Phase 0+1+2+3+4 sealed + E2E verified. Phase 5 at 4/N done
  (T-405 dashboard persist, T-407 chat_messages DB, T-408 Upstash
  rate-limit, T-406 Vercel deploy). Total 39 PRs merged, 13 hotfixes,
  3 blueprint overrides.
- Deploy is NOT git-linked → manual redeploy required:
  `cd vibeseek && vercel --prod --yes`.

Working dir: D:\WangNhat\Study\VibeCode
Repo: https://github.com/Kien118/vibeseek (private)
Git user: twangnhat-05 · email: twangnhat@gmail.com

TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ, đọc theo thứ tự:

1. SESSION_HANDOFF.md (file này) — TL;DR + deploy runbook.
2. ARCHITECT_BLUEPRINT.md §13 changelog top 3 entries — quick state recap.
3. AGENT_LOG.md — last 30 lines để bắt kịp T-406 lifecycle.
4. memory/feedback_vibeseek_phase5_deploy_lessons.md — D-7/D-8/D-9 + deploy
   runbook (BẮT BUỘC đọc nếu task touch deploy / env vars / routes).
5. memory/feedback_vibeseek_phase4_lessons.md — 18 lessons, still valid.
6. memory/feedback_vibeseek_phase3_lessons.md — UI failure modes.
7. memory/feedback_vibeseek_phase2_lessons.md — Next.js 14 / Strict Mode.
8. memory/feedback_minimize_user_asks.md — user directive về workflow.
9. memory/project_vibeseek_state_2026_04_22_phase5.md — current snapshot
   (DB + API + UI + prod URL + env vars).

Sau đó user sẽ chọn 1 trong các tracks:
- Update code → redeploy (follow deploy runbook in §Deploy Runbook below)
- Phase 5 remaining: B2 per-scene visuals / B3 SSML voice / B4 chat analytics
- E2E retest prod
- Đóng session nếu demo sắp tới

Xác nhận `sẵn sàng` + đề xuất quy trình. Không viết spec vội.
```

---

## Step 1 — What shipped

| Phase | Tasks | Status |
|---|---|---|
| 0 Hygiene | T-001..T-006 | ✅ done |
| 1 Video renderer | T-101..T-108 | ✅ done + E2E verified |
| 2 Quiz + Leaderboard | T-201..T-206 | ✅ done + E2E verified (8 hotfixes) |
| 3 Chatbot RAG | T-301..T-305 | ✅ done (2 hotfixes) |
| 4 Polish — video | P-401..P-405 | ✅ done (1 hotfix P-401) |
| 4 Polish — core | T-401..T-404 | ✅ done (0 hotfix) |
| **5 Deploy + persist** | **T-405, T-407, T-408, T-406** | **✅ done (1 hotfix T-406)** |
| 5 Remaining | B2/B3/B4 TBD | 📝 candidates, not yet scoped |

Tip commits worth knowing:
- `8e3aefe` — architect close T-406 (current main tip)
- `a6bc36e` — T-406 merge (Vercel deploy PR #39)
- `d00fc68` — T-408 Upstash rate-limit
- `bb16ee8` — T-407 chat_messages
- `0ac1c0f` — T-405 dashboard persist

---

## Step 2 — Deploy Runbook (MEMORIZE THIS)

### Regular redeploy after code change (99% of future deploys)

```bash
cd D:/Wangnhat/Study/VibeCode/vibeseek
npx tsc --noEmit        # must exit 0
vercel --prod --yes     # takes 2-4 minutes
```

Verify after:
```bash
curl -sI https://vibeseek-five.vercel.app/api/leaderboard | grep -E "HTTP|X-Vercel-Id"
# Expect: HTTP/1.1 200 OK + X-Vercel-Id: sin1::sin1::...
```

### Add / update env var

```bash
vercel env rm VAR_NAME production --yes
value=$(grep '^VAR_NAME=' .env.local | cut -d'=' -f2- | tr -d '\r\n' | sed 's/^"//; s/"$//')
printf "%s" "$value" | vercel env add VAR_NAME production
vercel --prod --yes
```

⚠️ **MUST use `tr -d '\r\n'` + quote-strip** on Windows Git Bash. Otherwise D-9 bug fires (Upstash URL crash).

### Debug logs

```bash
# Recent 500 errors
vercel logs --status-code 500 --since 10m --no-follow --no-branch --expand

# All recent logs
vercel logs --since 10m --no-follow --no-branch --expand | head -50
```

### Machine switch / first-time setup

If you're on a new machine (or CLI is not yet linked):

```bash
npm i -g vercel                                    # if not installed
cd D:/Wangnhat/Study/VibeCode/vibeseek             # or wherever repo is cloned
vercel login                                       # browser OAuth
vercel whoami                                      # should be twangnhat-05
vercel link --yes --project vibeseek               # creates .vercel/project.json
vercel env ls production                           # verify 14 vars present
```

Full details + common scenarios + edge cases: `memory/feedback_vibeseek_phase5_deploy_lessons.md`.

---

## Step 3 — Environment inventory (prod)

**14 env vars on Vercel production** (scope `Production`, NOT `Preview`, NOT `Development`):

Secret:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `RENDER_CALLBACK_SECRET`
- `GITHUB_DISPATCH_TOKEN`
- `UPSTASH_REDIS_REST_TOKEN`

Public / config:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (placeholder `https://vibeseek.vercel.app` — not code-referenced)
- `MAX_FILE_SIZE_MB=10`
- `SUPABASE_STORAGE_BUCKET=vibeseek-videos`
- `UPSTASH_REDIS_REST_URL`
- `GITHUB_REPO_OWNER=Kien118`
- `GITHUB_REPO_NAME=vibeseek`

**DEV-ONLY (NOT on Vercel):** `DEBUG_FORCE_GEMINI_FAIL`, `DEBUG_FORCE_CHAT_GEMINI_FAIL`

**GitHub Actions secrets** (for render-video.yml worker) are SEPARATE from Vercel env — set on GitHub repo settings, not Vercel.

---

## Step 4 — Function runtime config (Hobby 60s ceiling)

Each heavy route has `export const maxDuration = 60` where needed:
- `/api/chat` — 60s (SSE streaming)
- `/api/embeddings/ensure` — 60s (batch embed)
- `/api/vibefy` — 60s (PDF + Gemini chain, T-406 added)
- `/api/vibefy-video` — 30s
- `/api/quiz/generate` — 30s

Do NOT set `maxDuration` higher than 60 on Hobby — will be ignored.

**Function region pinned via `vibeseek/vercel.json` → `sin1`.** Do not remove.

---

## Step 5 — Proposed workflow for future sessions

### Scenario A — Small code update (1-2 file change, bug fix)
1. Read SESSION_HANDOFF.md (you're doing this) + phase5 deploy lessons.
2. Make code change + `npx tsc --noEmit`.
3. Commit on task branch + open PR.
4. After user merge → `cd vibeseek && vercel --prod --yes` from local (MANUAL, not auto-deploy).
5. Verify via curl + update AGENT_LOG + state snapshot.

### Scenario B — Larger feature (Phase 5 B2/B3/B4 candidates)
Follow Phase 3/4 pipeline from previous lessons:
1. Propose workflow to user (CLAUDE.md 4.1).
2. Draft spec with Failure modes + Files NOT to touch + Local test plan + protected-region grep sentinels.
3. Pre-audit against real code (Phase 3 lesson).
4. Dispatch executor OR architect direct-implement for ops tasks.
5. Review with tsc + protected grep + runtime smoke.
6. Open PR + architect review + user merge.
7. **Redeploy manually:** `vercel --prod --yes`.
8. Smoke on prod URL + close-out.

### Scenario C — Emergency hotfix
1. Edit file directly (with user's approval for direct-commit to main).
2. `npx tsc --noEmit` + local dev test.
3. Commit + push main.
4. `vercel --prod --yes`.
5. Verify via curl.
6. Log in AGENT_LOG.

---

## Step 6 — Protected regions (grep sentinels)

After Phase 4 accumulated many touches to core files, grep the diff of any new PR for these sentinel strings — must return 0 matches:

- `scripts/render/render.mjs` — `PlayResX | splitNarrationLines | formatAssTime | speakable_narration | gradients= | \\fad`
- `lib/ai/processor.ts` — `OVERFLOW_RATIO | WORDS_PER_SECOND`
- `lib/ai/prompts.ts` — `NGÂN SÁCH TỪ | PHIÊN ÂM CHO TTS`
- `lib/rate-limit.ts` — `Ratelimit | @upstash/ratelimit` (T-408 invariant)
- `app/api/chat/route.ts` — `enforceCap | assistantText` (T-407 invariant)
- `vibeseek/vercel.json` — `"regions"` (T-406 sin1 pin)

---

## Step 7 — Non-code Vercel operations quick links

- **Vercel Dashboard:** https://vercel.com/twangnhat-05s-projects/vibeseek
- **Deployment list:** https://vercel.com/twangnhat-05s-projects/vibeseek/deployments
- **Env vars UI:** https://vercel.com/twangnhat-05s-projects/vibeseek/settings/environment-variables
- **Function logs UI:** https://vercel.com/twangnhat-05s-projects/vibeseek/logs
- **GitHub repo:** https://github.com/Kien118/vibeseek
- **Supabase project:** https://app.supabase.com (user has credentials)
- **Upstash Redis console:** https://console.upstash.com
- **Google AI Studio (Gemini key):** https://aistudio.google.com/apikey

---

## Step 8 — First actions in new session

1. Read this file (you did).
2. Read `memory/feedback_vibeseek_phase5_deploy_lessons.md` (new in Phase 5).
3. Read `memory/project_vibeseek_state_2026_04_22_phase5.md` (current snapshot).
4. Read `ARCHITECT_BLUEPRINT.md` §13 top 3 changelog entries.
5. `git log --oneline -5 main` — tip should start with `8e3aefe` (architect close T-406).
6. `vercel whoami` from `vibeseek/` folder → confirm still linked. If not → `vercel link --yes --project vibeseek`.
7. Ask user: "Update code nào / task Phase 5 nào / check prod status?"
8. On user choice, follow Scenario A/B/C workflow above.

Do NOT skip step 6. Vercel CLI auth tokens can expire or machine-switch changes.

---

## Step 9 — Memory files to load

All live in `C:\Users\ADMIN\.claude\projects\C--Users-ADMIN\memory\`:

- `user_wangnhat.md` — user profile
- `feedback_vibeseek_architect_role.md` — triggers + hard rules
- `feedback_write_exact_commands.md` — always write literal commands inline
- `feedback_minimize_user_asks.md` — user directive về workflow
- `feedback_vibeseek_phase2_lessons.md` — Next.js 14 / Strict Mode / Supabase / Gemini pitfalls
- `feedback_vibeseek_phase3_lessons.md` — 7-step pipeline + UI failure modes
- `feedback_vibeseek_phase4_lessons.md` — libass + parallel dispatch (18 lessons)
- `feedback_vibeseek_phase5_deploy_lessons.md` — **NEW** D-7/D-8/D-9 + deploy runbook
- `project_vibeseek_state_2026_04_22_phase5.md` — **NEW** post-T-406 snapshot
- `project_vibeseek_state_2026_04_19_phase4.md` — superseded, kept for history
- `reference_vibeseek_paths.md` — SSOT file paths + gh CLI

---

## Step 10 — Environment notes (still true 2026-04-22)

- Windows 11, bash shell (forward slashes OK, `/dev/null` not `NUL`). PowerShell doesn't support `&&` — use `;` in PS.
- `.env.local` in `vibeseek/` has 14 core env vars + 2 debug flags. CRLF line endings — must handle with `tr -d '\r\n'` on upload.
- Local dev: `cd vibeseek && npm run dev` → http://localhost:3000.
- After main pull or weird Next.js error, wipe `.next`: `rm -rf .next` (Git Bash).
- **DO NOT** `npm run build` while user's dev server is active (corrupts `.next/server/` chunks).
- User role on repo: `write` (not admin on Kien118/vibeseek). But user's own Vercel account `twangnhat-05` owns the deploy — no Kien dependency for redeploy.
- Vercel CLI state lives in `vibeseek/.vercel/project.json` (gitignored).
- Vercel Hobby free: 60s function timeout, 100 GB bandwidth/mo, 45 min build time/mo.
