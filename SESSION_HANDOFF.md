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

## Step 11 — NEXT SESSION TASK (P-501 B2-Lite, locked 2026-04-22)

**User demo timeline:** 1 tuần from 2026-04-22. Risk tolerance LOW.

**Chosen track:** P-501 B2-Lite — pre-made background pool + xfade crossfade. Architect rejected full B2 per-scene AI-generated visuals (image API unavailable) and user's Manim/infographic idea (too risky for 1-tuần + adds Python/LaTeX/Puppeteer deps). B2-Lite is scope-down that delivers visual diversity + true scene transitions without new deps.

### P-501 scope outline (discussed, NOT YET SPEC'd)

**What changes:**
- `vibeseek/scripts/render/render.mjs` — add pool of 8-10 gradient palette variants (color pairs + speed variations). Parser picks N gradients (one per scene) deterministically (e.g. round-robin by scene index, or hash by scene.id for stability).
- Single `-i gradients=...` input → N `-i gradients=...` inputs (one per scene, duration = scene duration).
- Current simple filter chain → ffmpeg `filter_complex` with `xfade` chain: `[0:v][1:v]xfade=transition=fade:duration=0.3:offset=T0[v01]; [v01][2:v]xfade=...` etc.
- Audio concat path unchanged; subtitle ASS overlay applied on final `[vN-1]` output.

**What stays (protected):**
- P-401 ASS header + `splitNarrationLines` + `formatAssTime` — subtitle rendering untouched
- P-402 `speakable_narration` — TTS path untouched
- P-403 `OVERFLOW_RATIO` / `WORDS_PER_SECOND` — parser duration extension untouched
- P-405 `\fad(300,300)` — subtitle fade tag untouched
- P-404 `gradients=...c0=0x1a1a2e:c1=0x2d1b4e:speed=0.008` — **EXTENDED** to pool (this is the task itself, but current values must remain as one entry in the pool for backward visual compat)

**Palette pool draft (for spec phase):**
1. Navy-purple (current P-404): `c0=0x1a1a2e c1=0x2d1b4e` + speed=0.008
2. Purple-pink: `c0=0x2d1b4e c1=0xc026d3` + speed=0.010
3. Teal-cyan: `c0=0x0f172a c1=0x0891b2` + speed=0.008
4. Orange-red: `c0=0x7f1d1d c1=0xea580c` + speed=0.012
5. Forest-emerald: `c0=0x064e3b c1=0x059669` + speed=0.008
6. Indigo-fuchsia: `c0=0x312e81 c1=0xa21caf` + speed=0.010
7. Slate-sky: `c0=0x1e293b c1=0x0284c7` + speed=0.008
8. Rose-amber: `c0=0x9f1239 c1=0xd97706` + speed=0.011
(Final palette list TBD in spec — designer taste call.)

**Failure modes to preempt (for spec phase):**
- F-1: xfade chain with N > 20 scenes OOM on GH Actions runner
- F-2: filter_complex syntax errors across edge cases (1 scene, 2 scenes, many scenes)
- F-3: xfade `offset` math wrong → black frames between scenes OR overlap
- F-4: audio concat timing desync after xfade (total video duration changes slightly with N-1 transitions × 0.3s)
- F-5: subtitle ASS overlay timing stays correct (uses absolute timestamps, should be robust)
- F-6: palette pool too similar → no visual diversity in short videos (3-5 scenes)
- F-7: random palette selection varies per render → user confusion when same PDF renders different each time. Decision needed: deterministic (hash) vs stochastic
- F-8: Phase 4 protected regions — grep must return 0 lines for P-401/P-402/P-403/P-405 sentinels
- F-9: Groq fallback path shares same render.mjs — must work with pool too
- F-10: blueprint §10 P-405 says xfade which architect overrode in Phase 4 — update blueprint §13 to note this is the Phase 5 revisit + override repeal
- F-11..F-15 TBD during spec

**Test plan for spec phase:**
- Test 1: unit — palette pool returns 8 distinct color pairs
- Test 2: unit — scene-index-to-palette mapping stable (deterministic)
- Test 3: integration — 3-scene render with xfade → verify 2 transition PNGs at boundaries show visible color delta (Phase 4 frame-extract technique)
- Test 4: integration — 10-scene render → verify filter_complex compiles, output MP4 plays, total duration = sum(scenes) - 0.3 × (N-1) overlap
- Test 5: integration — subtitle ASS overlay still renders correctly on all scenes post-xfade
- Test 6: regression — P-404 original gradient (navy-purple) still available + used (palette index 0 = current)

**Expected PR diff:** 3-4 files (render.mjs ~80 LOC added, task md, blueprint §13, AGENT_LOG). No new deps. No new env vars.

**Executor model:** claude-opus-4-7 (complex ffmpeg filter_complex logic, Phase 4 protected region risk). NOT sonnet — xfade chain math is not mechanical.

**Post-merge:** `cd vibeseek && vercel --prod --yes` to redeploy (deploy runbook §Step 2).

### Bootstrap prompt for new session (copy-paste)

```
Bạn là Software Architect cho dự án VibeSeek. Resume session mới cho task
P-501 B2-Lite (pre-made background pool + xfade crossfade).

MVP đang LIVE: https://vibeseek-five.vercel.app (Vercel Hobby, sin1).
Phase 5 at 4/N done (T-405/T-407/T-408/T-406). Demo 1 tuần tới.

Task P-501 đã LOCK (user chốt 2026-04-22):
- Pool 8-10 gradient palette variants trong render.mjs
- ffmpeg xfade crossfade 0.3s giữa scenes
- Không new deps, không AI image gen
- Đúng blueprint P-405 original intent (architect override Phase 4 sang ASS
  \fad, giờ revisit làm proper crossfade với multiple bg)

TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ:
1. Đọc SESSION_HANDOFF.md §Step 11 — P-501 scope outline + failure modes
   + test plan drafted
2. Đọc memory/feedback_vibeseek_phase4_lessons.md — libass + frame-extract
   review technique (MUST USE for this task)
3. Đọc memory/feedback_vibeseek_phase5_deploy_lessons.md — post-merge
   redeploy runbook
4. Đọc memory/project_vibeseek_state_2026_04_22_phase5.md — current state
5. Đọc ARCHITECT_BLUEPRINT.md §13 top 5 changelog + §10 Phase 4 (P-404/P-405)
6. git log --oneline -5 main — tip phải bắt đầu từ `a7abc4b` (docs handoff)
   hoặc `8e3aefe` (architect close T-406)

Sau đó confirm sẵn sàng + đề xuất quy trình P-501 (failure modes spec +
Files NOT to touch + frame-extract verify + protected-region grep). Không
viết spec vội — user phải duyệt quy trình trước.
```

### Post-P-501 close-out sẽ cần

- Redeploy prod: `vercel --prod --yes`
- Run smoke: render a real PDF + user verify visual diversity + no regression
- Update blueprint §13 with P-501 entry + mark P-405 override repealed
- Update SESSION_HANDOFF.md + state snapshot
- **Demo rehearsal:** sau P-501 ship + verify, dành 1-2 ngày cuối tuần prep demo (script, test PDFs, backup recorded video)

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
