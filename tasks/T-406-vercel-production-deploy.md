# T-406 — Vercel production deploy

> **Phase 5 · Status:** review (pending user merge) · **Owner:** Architect (ops task, no executor dispatch) · **Path:** A2 (Vercel CLI direct-deploy, after Path A/A1 web-UI bugs blocked)
> **Production URL:** https://vibeseek-five.vercel.app (`sin1` Singapore region)
> **Base:** `main` (tip `8b7eae5` at spec time) · **Final PR diff:** 3 code files (`app/api/vibefy/route.ts` maxDuration + new `vibeseek/vercel.json` sin1 + `vibeseek/.gitignore` `.vercel`) + 3 doc files (this task md + blueprint §13 + AGENT_LOG).
> **Hotfix:** 1 (Windows Git Bash CR in env var upload — D-9 lesson)

---

## Context

T-406 là **ops task** cuối cùng của Phase 5: deploy VibeSeek lên Vercel production. Cross-instance rate-limit prereq đã cleared bởi T-408 (`d00fc68`, 2026-04-20). Pre-audit 2026-04-20 confirmed zero code blockers: no hardcoded `localhost`, 14 env vars standard, `next.config.js` + `package.json` + `.env.local.example` all prod-ready.

**Blocker lịch sử (2026-04-20):** Vercel import page không list `Kien118/vibeseek` sau khi Kien118 cài Vercel GitHub App. Root cause chưa diagnose — 3 candidates:
- (a) Kien118 missed tick `vibeseek` trong "Only select repositories" của GitHub App permission
- (b) Vercel cache stale / OAuth scope mismatch trên account `twangnhat-05`
- (c) Vercel organization scope vs user scope mismatch

**Hôm nay 2026-04-21:** Kien118 sẵn sàng live join debug. User (twangnhat-05) chọn **Path A** (fix GitHub App install, giữ PR workflow). Path B (fork `twangnhat-05/vibeseek-fork`) là fallback nếu three-strikes rule fire (>30ph Path A không unblock).

**Code gap phát hiện khi audit 2026-04-21:** `app/api/vibefy/route.ts` không set `maxDuration` → default Vercel Hobby = 10s. pdf-parse 10MB PDF + Gemini 3-model chain + Groq fallback có thể chạy 15-40s → timeout prod. Các route khác đã OK: `/api/chat` 60s, `/api/embeddings/ensure` 60s, `/api/vibefy-video` 30s, `/api/quiz/generate` 30s. T-406 bump `/api/vibefy` → 60s (Hobby plan ceiling).

**Vercel Hobby constraints:**
- Function timeout max: **60s** (Pro = 300s). Upgrade Pro out of scope (paid).
- Function memory: 1024MB default.
- Deploy region: default `iad1` (US East) — **cần change `sin1` (Singapore)** để gần Supabase ap-southeast-1 + user + Upstash ap-southeast-1 region → giảm latency ~200ms mỗi request.
- Free bandwidth: 100GB/tháng outbound (Supabase free cap là 2GB, so Vercel là bottleneck khác).

---

## Phases (5)

### Phase 1 — Diagnose GitHub App permission (15-20ph)
User + Kien118 join live. Architect guide check theo thứ tự 3 candidates. Hard cutoff 30ph → pivot Path B.

### Phase 2 — Env sync (10ph)
Paste 14 env vars vào Vercel Project → Settings → Environment Variables, scope `Production` + `Preview`. Architect provide literal list; user paste qua UI (không commit secrets).

### Phase 3 — Deploy + build verify (10-15ph)
Vercel auto-trigger build on first connect. Architect monitor build log; user paste errors nếu fail. Expected: Next.js build success, 10 routes listed, first deploy URL `vibeseek-*.vercel.app`.

### Phase 4 — Post-deploy smoke (20-30ph)
Architect curl 5 endpoint critical trên prod URL + user browser E2E 3 flow (upload PDF, quiz, chat). Phase 4 Lesson 2 (architect frame-extract) N/A — prod smoke là functional, không render.

### Phase 5 — Close-out (10ph)
- Code commit: `/api/vibefy` maxDuration bump + `.env.local.example` URL comment update. PR normal flow.
- Blueprint §13 changelog entry.
- `memory/project_vibeseek_state_2026_04_21_phase5.md` snapshot post-deploy.
- AGENT_LOG entries.
- SESSION_HANDOFF refresh.

**Total estimate:** 65-95ph (nếu Path A success). Path B adds ~30ph fork-setup overhead.

---

## Files to touch (2)

1. **`vibeseek/app/api/vibefy/route.ts`** — ADD `export const maxDuration = 60` after line 2 (top of file, before `MAX_FILE_SIZE` const). Reason: PDF 10MB + Gemini fallback chain > default 10s.

2. **`vibeseek/.env.local.example`** — UPDATE line 18 comment:
   - Trước: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - Sau: Add comment `# Local dev: http://localhost:3000 · Prod: https://<your-vercel-domain>.vercel.app` + keep default localhost value (dev is the common case).

Final PR diff: 2 files, ~3 lines. Separate 1 PR normal flow.

---

## Files NOT to touch (protected regions)

### Phase 4 video invariants (grep sentinels, MUST return 0 lines):
- `vibeseek/scripts/render/render.mjs` — `PlayResX|splitNarrationLines|formatAssTime|speakable_narration|gradients=|\\fad`
- `vibeseek/lib/ai/processor.ts` — `OVERFLOW_RATIO|WORDS_PER_SECOND`
- `vibeseek/lib/ai/prompts.ts` — `NGÂN SÁCH TỪ|PHIÊN ÂM CHO TTS`

### T-407/T-408 chat invariants:
- `vibeseek/app/api/chat/route.ts` — ZERO touches (maxDuration=60 đã set từ T-304)
- `vibeseek/app/api/chat/history/route.ts` — ZERO touches
- `vibeseek/lib/rate-limit.ts` — ZERO touches
- `vibeseek/supabase-schema.sql` — ZERO touches
- `vibeseek/components/ChatPanel.tsx` — ZERO touches

### Other protected:
- `next.config.js` — ZERO touches (audit clean, không cần `output:'standalone'` cho Vercel)
- `package.json` — ZERO touches (Upstash deps đã có từ T-408)
- `vercel.json` — **KHÔNG TẠO MỚI**. Per-route `export const maxDuration` là idiomatic, vercel.json chỉ cần nếu có custom build command / route rewrites — không có ở T-406.
- `.github/workflows/render-video.yml` — ZERO touches. GitHub Actions deploy chain khác Vercel pipeline; render worker vẫn chạy trên GH Actions.
- Mọi `app/**/page.tsx` và `components/*` — ZERO touches.

---

## Acceptance criteria

### Phase 1 — Diagnose (AC-1..AC-3)
- **AC-1** Kien118 confirm Vercel GitHub App đã install trên account `Kien118`, tick `vibeseek` trong "Only select repositories" (link: https://github.com/settings/installations).
- **AC-2** User (twangnhat-05) truy cập https://vercel.com/new thấy `Kien118/vibeseek` trong list repo available to import.
- **AC-3** Nếu AC-1+AC-2 fail sau 30ph → document root cause + pivot Path B (fork). Three-strikes circuit breaker fires.

### Phase 2 — Env sync (AC-4..AC-5)
- **AC-4** Vercel Project `vibeseek` → Settings → Environment Variables có **đủ 14 vars** (list §Env vars bên dưới), scope `Production` + `Preview` đều tick.
- **AC-5** Secrets (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, UPSTASH_REDIS_REST_TOKEN, GITHUB_DISPATCH_TOKEN, RENDER_CALLBACK_SECRET) **KHÔNG commit** anywhere. Chỉ paste vào Vercel UI.

### Phase 3 — Build + deploy (AC-6..AC-8)
- **AC-6** Code commit maxDuration bump merged trước khi deploy (PR mini-flow normal).
- **AC-7** Vercel deploy build success: `Compiled successfully`, all 10 route listed (`/`, `/dashboard`, `/quiz/[documentId]`, `/chat/[documentId]`, `/leaderboard`, `/api/vibefy`, `/api/vibefy-video`, `/api/chat`, `/api/chat/history`, `/api/quiz/generate`, `/api/quiz/submit`, `/api/leaderboard`, `/api/leaderboard/profile`, `/api/embeddings/ensure`, `/api/render-callback`, `/api/render-jobs/[jobId]`).
- **AC-8** Deploy region = `sin1` (Singapore). Check Settings → General → Function Region. Default `iad1` phải change.

### Phase 4 — Post-deploy smoke (AC-9..AC-14)
Thay `<PROD_URL>` = Vercel domain thực tế.

- **AC-9** `curl -i <PROD_URL>/api/embeddings/ensure -H 'Content-Type: application/json' -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'` → 404 `no_cards_for_document` (không phải 500).
- **AC-10** `curl -i <PROD_URL>/api/chat/history?documentId=x` → 400 `anonId_required` (validation works).
- **AC-11** `curl -i <PROD_URL>/api/leaderboard` → 200 JSON `{ data: [...] }` (empty OK).
- **AC-12** User browser upload 1 PDF ≤ 3MB vào `<PROD_URL>/dashboard` → cards render ≤ 15s, tất cả text visible, không 500.
- **AC-13** User browser click "🎯 Làm Quiz" → quiz load ≤ 15s, 10 câu hiện, answer 3 câu → badge top-right update live.
- **AC-14** User browser `/chat/<documentId>` → gõ câu hỏi → SSE stream về chunk-by-chunk, response grounded trong doc. Reload page → history hydrate từ DB (T-407 verify).

### Phase 5 — Close-out (AC-15..AC-17)
- **AC-15** `ARCHITECT_BLUEPRINT.md` §13 changelog prepend entry T-406 với prod URL + deploy date.
- **AC-16** `AGENT_LOG.md` append 5 entries (start, diagnose, deploy, smoke, close).
- **AC-17** `memory/project_vibeseek_state_2026_04_21_phase5.md` tạo mới với: prod URL, 14 env vars list (name-only, no values), 10 route list, Phase 5 progress 4/N done.

---

## Env vars list (14 — paste vào Vercel)

**Secret** (copy from `vibeseek/.env.local` — user paste qua Vercel UI):
1. `SUPABASE_SERVICE_ROLE_KEY`
2. `GEMINI_API_KEY`
3. `GROQ_API_KEY`
4. `RENDER_CALLBACK_SECRET`
5. `GITHUB_DISPATCH_TOKEN`
6. `UPSTASH_REDIS_REST_TOKEN`

**Public** (prefix `NEXT_PUBLIC_` hoặc app config):
7. `NEXT_PUBLIC_SUPABASE_URL`
8. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
9. `NEXT_PUBLIC_APP_URL` — ⚠️ **CHANGE**: `http://localhost:3000` → `https://<vercel-domain>.vercel.app`
10. `MAX_FILE_SIZE_MB` = `10`
11. `SUPABASE_STORAGE_BUCKET` = `vibeseek-videos`
12. `UPSTASH_REDIS_REST_URL`
13. `GITHUB_REPO_OWNER` = `Kien118`
14. `GITHUB_REPO_NAME` = `vibeseek`

**KHÔNG paste lên Vercel** (local-dev / GH Actions only):
- `DEBUG_FORCE_GEMINI_FAIL`, `DEBUG_FORCE_CHAT_GEMINI_FAIL` — dev debug flags
- `SUPABASE_URL`, `APP_CALLBACK_URL`, `EDGE_TTS_VOICE`, `PIPER_MODEL_PATH` — render.mjs env, set ở GH Actions secrets (không phải Vercel)

---

## Failure modes (14)

### Path A diagnose
- **F-1** Vercel import page rỗng sau khi Kien118 install GitHub App. Mitigation: Kien118 uninstall → install lại + tick `vibeseek` explicit trong "Only select repositories". Refresh https://vercel.com/new với hard-reload (Ctrl+Shift+R).
- **F-2** User `twangnhat-05` login Vercel với email khác account expect. Mitigation: User check Vercel Settings → Account → Email khớp GitHub email (`twangnhat@gmail.com`).
- **F-3** Vercel GitHub App chỉ grant trên `Kien118` user account, nhưng Vercel OAuth scope user `twangnhat-05` không có access `Kien118` repo. Mitigation: Kien118 add `twangnhat-05` vào Vercel team (nếu dùng team plan) hoặc transfer repo ownership (out of scope). Fallback: Path B fork.
- **F-4** Three-strikes fire (30ph no progress). Mitigation: Pivot Path B — `twangnhat-05` fork `Kien118/vibeseek` → `twangnhat-05/vibeseek-fork` → Vercel import fork → deploy. Trade-off: PR workflow disconnect, manual sync upstream khi Kien push main. Document rõ trong Decisions.

### Env sync
- **F-5** User paste nhầm prod secret thành dev key (ví dụ Gemini free key với quota 1500/day share production). Mitigation: Architect nhắc user rotate GEMINI_API_KEY + SUPABASE_SERVICE_ROLE_KEY riêng cho prod trước deploy. Out of scope nếu user OK dùng chung.
- **F-6** `NEXT_PUBLIC_APP_URL` quên change → build-time inline `localhost:3000` vào client bundle → callback URL sai. Mitigation: AC-4 explicit check var này ≠ localhost. Verify qua curl `<PROD_URL>` → response không chứa `localhost`.
- **F-7** Upstash REST URL typo / token expired. Mitigation: Phase 2 architect test connectivity local (`curl -H "Authorization: Bearer $TOKEN" $UPSTASH_URL/PING` = `PONG`) trước khi paste vào Vercel. Rate-limit fail-open semantics (T-408 Q3) means silent fail không block deploy — phải catch sớm.

### Build
- **F-8** Build fail: `pdf-parse` module not found prod. Mitigation: `next.config.js` line 4 `serverComponentsExternalPackages: ['pdf-parse']` đã có — verify build log. Nếu fail, check `pdf-parse` trong `dependencies` không phải `devDependencies` của `vibeseek/package.json`.
- **F-9** Build warn about `dynamic = 'force-dynamic'` routes vs static generation. Mitigation: Expected + OK — 8/14 route dùng `force-dynamic` for supabase + Upstash calls. Ignore warn.
- **F-10** TypeScript build error xuất hiện chỉ ở prod (không có local). Mitigation: Rare, thường là `tsconfig.json` paths mismatch — local tsc đã xanh tip `8b7eae5`. Nếu fire, architect pull prod log, check bước `npx tsc --noEmit` local.

### Runtime
- **F-11** `/api/vibefy` timeout 10s prod (maxDuration chưa bump). Mitigation: AC-6 bump maxDuration=60 BEFORE deploy. Verified in Files to touch §1.
- **F-12** Function region mặc định `iad1` → Supabase query round-trip US↔SG = 300ms/call. Mitigation: AC-8 change region `sin1`. Check Settings → General → Function Region → Select `Singapore (sin1)`.
- **F-13** GitHub dispatch từ Vercel function fail — `lib/github/dispatch.ts` POST tới `api.github.com/repos/{OWNER}/{REPO}/dispatches` nhưng `GITHUB_DISPATCH_TOKEN` scope sai. Mitigation: Verify token có scope `repo` (private) + `workflow`. Phase 4 smoke AC-12 indirectly verify (user click "Tạo video" trigger dispatch).
- **F-14** Supabase RLS deny prod insert — service role key paste sai. Mitigation: AC-9 test `/api/embeddings/ensure` với doc giả → nếu trả 500 "RLS policy violation" thay vì 404, secret hash sai. Rotate + re-paste.

---

## Post-deploy smoke plan (architect-runnable)

Thay `<PROD>` = Vercel domain khi deploy xong. User paste domain vào chat, architect run.

### Smoke 1 — Route liveness (architect curl, ~5ph)
```bash
curl -i <PROD>/ -o /dev/null -w "%{http_code}\n"                           # 200
curl -i <PROD>/api/leaderboard                                              # 200 JSON
curl -i <PROD>/api/embeddings/ensure -H 'Content-Type: application/json' \
  -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'                # 404 no_cards_for_document
curl -i <PROD>/api/chat/history -o /dev/null -w "%{http_code}\n"            # 400 (no params)
```

### Smoke 2 — Rate-limit prod verify (architect curl, ~2ph)
```bash
# POST /api/chat 11 bursts with fixed anonId → expect 10×200 + 1×429
ANON="t406-smoke-$(date +%s)"
for i in {1..11}; do
  curl -s -o /dev/null -w "req $i: %{http_code}\n" \
    <PROD>/api/chat -H 'Content-Type: application/json' \
    -d "{\"documentId\":\"invalid\",\"message\":\"hi\",\"history\":[],\"anonId\":\"$ANON\"}"
done
# Expect: req 1-10 = 404 (no embeddings, rate-limit passes), req 11 = 429
```
Verify Upstash key namespace: architect curl Upstash REST `SCAN 0 MATCH vibeseek:rl:chat:$ANON*` → key tồn tại. Confirms cross-instance rate-limit live prod.

### Smoke 3 — User browser E2E (user, ~15ph)
User truy cập `<PROD>/dashboard`:
1. Upload PDF ≤ 3MB → cards render ≤ 15s + dashboard lưu history (T-405 verify).
2. Click "🎯 Làm Quiz" → quiz load ≤ 15s → answer 3 câu → badge update live (T-206 verify).
3. Click "💬 VibeBuddy Chat" → gõ 1 câu → SSE stream chunks → response grounded (T-305 verify).
4. Reload chat page → history hydrate DB + localStorage (T-407 verify).

### Smoke 4 — Video render end-to-end (user + architect, ~8ph)
1. User trên `<PROD>/dashboard` click "🎬 Tạo video" → expect 202 + jobId.
2. Architect `gh run list --repo Kien118/vibeseek --limit 1 --json status,url` → check GH Actions render-video workflow triggered.
3. Wait 3-8ph → user refresh dashboard → VideoPlayer hiện MP4.
4. User download MP4 → verify playable.

---

## Non-goals

- **KHÔNG migrate Vercel Hobby → Pro** ($20/mo). User directive: free-tier tuyệt đối (blueprint §1.4). Hobby 60s timeout là ceiling cho T-406.
- **KHÔNG setup custom domain** (`vibeseek.app`, etc). Vercel free `vercel.app` subdomain đủ cho demo.
- **KHÔNG setup Vercel Analytics** (tốn function invocation quota). User directive blueprint §1.4: "Không cần analytics/telemetry".
- **KHÔNG add Sentry/PostHog/telemetry SDK.** Out of scope.
- **KHÔNG transfer repo ownership** từ `Kien118` → `twangnhat-05`. Path B fork thay vì transfer.
- **KHÔNG update `.github/workflows/render-video.yml`.** Render worker chạy độc lập trên GH Actions, callback về Vercel URL (`NEXT_PUBLIC_APP_URL`). Phase 1 T-107 `/api/render-callback` đã nhận callback từ bất kỳ URL.
- **KHÔNG touch `render-callback-secret` scheme.** Nếu smoke AC-12 cho thấy callback fail → hotfix riêng, không expand T-406 scope.
- **KHÔNG set up preview deployments** per-PR branch. Vercel default behavior OK.
- **KHÔNG rotate secrets**. Nếu user quan ngại share secrets giữa dev/prod, deferred Phase 6.

---

## Decisions log

- **D-1 (Path A primary, B fallback):** Path A giữ PR workflow team-synced, reversible (có thể pivot B). Path B commits to fork maintenance. Three-strikes 30ph.
- **D-2 (Region `sin1`):** Supabase project + user + Upstash đều ap-southeast-1. Cross-region latency US↔SG = 300ms/hop — compound across Supabase read + Upstash rate-limit + Gemini API call = 1-2s overhead mỗi request. `sin1` deploy = same-region, ~50ms round-trip.
- **D-3 (`/api/vibefy` maxDuration=60):** Hobby ceiling. PDF 10MB + Gemini 3-chain + Groq = worst 30-40s. 60s không pad nhưng đủ headroom. Nếu user muốn safer → rework `/api/vibefy` thành 2-call (extract-only endpoint + cards-gen endpoint), out of scope.
- **D-4 (per-route maxDuration vs vercel.json):** Per-route `export const maxDuration` idiomatic Next.js 14 App Router. vercel.json là legacy cho Pages Router. Tránh duplicate config.
- **D-5 (14 env vars, không 16):** T-408 spec nói 16 = 14 cũ + 2 Upstash. Audit lại: `DEBUG_FORCE_*` không deploy prod (dev-only); `SUPABASE_URL` + `APP_CALLBACK_URL` + `EDGE_TTS_VOICE` + `PIPER_MODEL_PATH` là GH Actions env (set trong workflow secrets, không Vercel). Vercel chỉ cần 14.
- **D-6 (E2E smoke trên prod URL thay vì preview URL):** Preview URL có rate-limit + function quota riêng. Smoke trực tiếp trên prod tránh double-count. Trade-off: production user có thể thấy smoke traffic. Demo đồ án → chấp nhận.

---

## References

- Vercel GitHub App install: https://github.com/apps/vercel
- Vercel project import: https://vercel.com/new
- Vercel function region settings: Project → Settings → General → Function Region
- Vercel env vars: Project → Settings → Environment Variables
- Supabase region check: https://app.supabase.com → Project → Settings → General
- Upstash Redis console: https://console.upstash.com
- GitHub App installations (Kien118): https://github.com/settings/installations
- Next.js 14 per-route config: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- T-408 merge commit: `d00fc68` (Upstash rate-limit, prereq)
- T-407 merge commit: `bb16ee8` (chat_messages persist, needs cross-device hydrate verify on prod)

---

## Progress log (append as architect executes)

- **2026-04-21** spec drafted.
- **2026-04-21** Path A attempted: Kien118 deploy on own Vercel account. GitHub App permission OK (AC-1/AC-2). Configure UI bug: Framework Preset field vanished after setting Root Directory = `vibeseek` → build ran `next build` but Vercel runtime didn't wire as Next.js → Functions tab empty → all routes 404. Redeploy without cache didn't fix. **Pivoted to Path A2 (new, added to Decisions as D-8):** Vercel CLI direct-deploy from user machine bypassing web UI.
- **2026-04-21** Path A2 success: `vercel link --yes --project vibeseek` auto-detected Next.js correctly. Prod deploy via CLI: `https://vibeseek-five.vercel.app` (alias) + `https://vibeseek-g32vcwd0o-twangnhat-05s-projects.vercel.app` (deployment). 14/14 env vars uploaded via CLI (printf piped stdin).
- **2026-04-21** Hotfix #1: first deploy had Upstash Redis crash 500 on `/api/chat`. Root cause: Git Bash Windows preserved `\r` (CRLF) in env var values when upload via shell script → Upstash URL had trailing `\r` → client threw `[UrlError] url contains whitespace or newline`. Fixed: `vercel env rm` both Upstash vars → re-add with `tr -d '\r\n'` + `sed` quote-strip → redeploy. `/api/chat` rate-limit now returns 10×404 + 1×429 correctly. Logged as Lesson candidate for Phase 5.
- **2026-04-21** Code change: `app/api/vibefy/route.ts` added `export const maxDuration = 60` (prev default 10s → timeout risk on PDF 10MB + Gemini chain). tsc clean. Deployed via CLI. Git commit pending (architect will open PR after browser E2E pass).
- **2026-04-21** Smoke 1 passed (AC-9/10/11): `/api/embeddings/ensure` 404, `/api/chat/history?documentId=x` 400, `/api/leaderboard` 200 with real data. Smoke 2 passed (rate-limit Upstash 10×404 + 1×429 cross-instance). AC-12/13/14 (browser E2E) pending user test on `https://vibeseek-five.vercel.app`.

## Decisions (addendum)

- **D-7 (Vercel UI Framework Preset regression):** When setting Root Directory via Configure screen, Vercel UI sometimes fails to re-detect framework → Preset field disappears → project deploys as generic static → all routes 404 despite "Compiled successfully" log. Web UI workaround (set Preset before Root, or edit in Settings post-deploy) often still fails. **Reliable workaround: skip web UI entirely, use CLI `vercel link --yes`.** CLI reads `package.json` in current directory → auto-detects Next.js reliably.
- **D-8 (Path A2 = CLI direct-deploy, bypasses Path A/B dichotomy):** Original plan was Path A (Kien web UI) vs Path B (fork). CLI is third option: authenticate as any user (here `twangnhat-05`), link/create project in that user's scope, deploy local files. Benefits: bypasses GitHub App scope entirely (no git-linking needed), bypasses web UI framework detection bug, full env var control via CLI. Drawbacks: no auto-deploy on git push (manual `vercel --prod` each time). Acceptable for demo project. Deploy now lives under `twangnhat-05s-projects/vibeseek` team scope, not `Kien118` scope — but the end URL (`vibeseek-five.vercel.app`) is publicly accessible regardless of owning team.
- **D-9 (env var CR gotcha on Windows):** Bash script piping values from `.env.local` on Windows Git Bash preserves `\r` (CRLF line endings) even after `read` builtin. Must explicitly strip with `tr -d '\r\n'` before `printf "%s" | vercel env add`. Otherwise Upstash Redis URL parser throws `[UrlError] url contains whitespace or newline`. Affects any env var where trailing char matters (URLs, base64 tokens). Supabase/Gemini keys happened to tolerate trailing CR (HTTP header context accepts), masking the issue for 12 of 14 vars.

