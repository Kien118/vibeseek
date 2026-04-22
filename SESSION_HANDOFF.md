# Session Handoff — For New Claude Session

> Paste-ready context for a new Claude chat session resuming as **Architect** on VibeSeek.
> **Last refresh:** 2026-04-22 Day 2 motion batch complete (P-506..P-509). MVP LIVE on production. Commit tip: `b237155`. Phase 5 at 14/N (+ P-503/P-504/P-505/P-506a/P-506/P-507/P-508/P-509 done — 3 hotfixes total). Day 2 remaining: item 9 card tilt + item 11 sound + item 12 light mode + item 13 idle state + Update #2 Video spec. Demo 2026-04-29.

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
| **5 Video polish** | **P-501 (B2-Lite palette pool + xfade)** | **✅ done 2026-04-22 (+ 1 hotfix AC-14)** |
| **5 Chat polish** | **P-502 (Feynman Dojo Mode dual-mode chat)** | **✅ done 2026-04-22 (0 hotfix, Sonnet dispatch)** |
| 5 Remaining | Video quality upgrade + Brand/UI refresh | 📝 next per 7-day roadmap |

Tip commits worth knowing:
- **`b8b6b50`** — P-502 hotfix (chat page fetch cards for Feynman picker, current main tip)
- `2c16974` — PR #41 merge (P-502 Feynman Dojo Mode)
- `8ea5ca9` — P-502 impl commit (Sonnet executor)
- `57fe62d` — AC-14 hotfix (render-jobs poll route uses supabaseAdmin)
- `76c324f` — PR #40 merge (P-501 B2-Lite palette pool + xfade)
- `4f7015f` — P-501 implementation commit
- `8e3aefe` — architect close T-406
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

## Step 11 — NEXT SESSION TASK (post-P-501, demo rehearsal)

**User demo timeline:** ~1 tuần from 2026-04-22 (demo ≈ 2026-04-29). Risk tolerance LOW. MVP + P-501 visual polish both shipped.

### P-501 close-out recap (2026-04-22)

- **Merged:** PR #40, commit `4f7015f`, merge SHA `76c324f`.
- **Scope shipped:** `render.mjs` +57/-4 LOC (8-entry `GRADIENT_POOL` + deterministic `POOL[i % 8]` picker + `XFADE_DURATION=0.3s` + filter_complex xfade chain + subtitle overlay on `[vout]`).
- **Architect direct-implemented** (no executor dispatch) — user feedback 2026-04-22 post-merge: **future tasks should dispatch to sub-agents with right-sized models (Sonnet default, Opus 4.7 only when genuinely complex)** to save cost. Rule saved in `memory/feedback_dispatch_sub_agents_cost_aware.md`.
- **Post-merge redeploy done:** `vercel --prod --yes` → deployment `dpl_9MQMXk548GZB1Rf2hGucD3Vgu9PG` READY, aliased to `vibeseek-five.vercel.app`, `X-Vercel-Id: sin1::sin1::...` verified (edge + function both Singapore).
- **Math verified:** 3-scene synth 12.000s + 10-scene synth 54.000s exact (0.000 drift). Protected-region grep 0 matches for P-401/P-402/P-403/P-405 sentinels.
- **0 hotfix. Phase 5 progress: 5/N tasks done, 1 hotfix total (only T-406 CR env upload).**

### AC-14 ✅ VERIFIED 2026-04-22 (user confirmed "Visual có chuyển màu")

End-to-end flow on prod with a real 6-scene storyboard: PDF upload → Gemini storyboard → GH Actions render.mjs với `6 scene(s), xfade=0.3s, palette-pool size=8` → 49.49s MP4 Supabase Storage → UI poll → video playback với palette diversity visible between scenes. P-501 ship confirmed working.

**Hotfix taken during AC-14:** poll route `/api/render-jobs/[jobId]` was using inline anon `createClient` without `noStoreFetch` → Next.js 14 fetch cache held stale `status=queued` response after render.mjs had transitioned DB to `ready`. Fixed in commit `57fe62d` (6 insertions/7 deletions): switched to `supabaseAdmin` from `utils/supabase.ts`. Lesson saved `memory/feedback_vibeseek_phase5_supabase_nostore_invariant.md`.

### Demo rehearsal plan (2 ngày cuối tuần before 2026-04-29)

**Day 1 (2026-04-27 est):**
1. **Full E2E on prod** — upload 2-3 different PDFs (varying complexity). Record each flow: upload → cards → quiz → chat RAG → leaderboard → video render → download.
2. **Backup MP4 recording** — record screen (OBS / Loom) of golden-path flow on 1 PDF end-to-end. 2-3 min video. If live demo breaks, play the recording.
3. **Test PDFs selection** — pick 2-3 PDFs that showcase different card counts / chapter depths / multilingual content (Phase 4 P-402 EN-in-VN TTS showcase).
4. **Stopwatch practice runs** — time yourself from "share URL" to "video ready" to know demo pacing.

**Day 2 (2026-04-28 est):**
1. **Demo script** — 2-3 min narrative: "Problem (Gen Z học khó tập trung) → Solution (AI convert PDF → TikTok-style cards + quiz + chat) → Live demo (upload → show cards/quiz/chat/video) → Tech stack summary → Questions". Write beats bằng tiếng Việt if Vietnamese audience.
2. **Slide deck minimal** — 5-7 slides for context before/after live demo. Architecture diagram, tech stack table, future roadmap.
3. **Rehearsal dry-run** — 2-3 full walkthroughs with timer.
4. **Q&A prep** — anticipate: scaling? cost? AI model choice? security? data privacy? MVP limits? Write cheat-sheet answers.

### Backup plans if demo breaks

| Failure | Backup |
|---|---|
| Vercel down | Play pre-recorded screen capture |
| Gemini quota dry | Groq fallback chain kicks in (Phase 2 verified) |
| GH Actions render slow | Pre-render 2 videos in advance, show those instead |
| Upload fails | Pre-load a document in browser beforehand |
| Internet spotty | Have phone hotspot as backup |
| Laptop dies | Have laptop charger + power bank |

### B3/B4/B5 candidates (deferred post-demo)

Do NOT start during demo week. Revisit 2026-05-01+:
- **B3** SSML voice switching for English terms (if user feedback from demo asks for better pronunciation)
- **B4** chat analytics / moderation dashboard
- **B5** Vercel git-auto-deploy (requires reopening D-7/D-8 from T-406)

### Bootstrap prompt for new session (copy-paste)

```
Bạn là Software Architect cho dự án VibeSeek. Resume session mới post-P-501.

MVP + P-501 B2-Lite đã LIVE: https://vibeseek-five.vercel.app (Vercel Hobby,
sin1). Phase 5 at 5/N done. Demo 2026-04-29 (1 tuần từ P-501 merge).

TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ:
1. Đọc SESSION_HANDOFF.md §Step 11 — post-P-501 handoff, AC-14 pending,
   demo rehearsal plan
2. Đọc memory/feedback_dispatch_sub_agents_cost_aware.md — user directive
   2026-04-22 về Sonnet-default dispatch (áp dụng mọi task code impl sau này)
3. Đọc memory/project_vibeseek_state_2026_04_22_phase5_p501.md — post-P-501
   snapshot
4. Đọc memory/feedback_vibeseek_phase5_deploy_lessons.md — deploy runbook
   (nếu cần ops)
5. git log --oneline -5 main — tip phải bắt đầu từ `76c324f` (PR #40 merge P-501)

User có thể chọn 1 trong:
- AC-14 prod smoke (upload real PDF, verify visual diversity)
- Demo rehearsal prep (Day 1 hoặc Day 2 plan)
- B3/B4/B5 post-demo (KHÔNG nên trong demo week)
- Đóng session cuối cùng trước demo

Sau đó confirm sẵn sàng + đề xuất quy trình. Không viết code vội.
Khi nào cần impl → DISPATCH sub-agent với model hợp lý (Sonnet default).
```

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
