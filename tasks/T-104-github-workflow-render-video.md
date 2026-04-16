# T-104 · GitHub Actions workflow `render-video.yml`

**Status:** `todo`
**Severity:** HIGH
**Blueprint ref:** §2.1, §7.4, §11 T-104
**Branch:** `task/T-104-github-workflow-render-video`
**Assignee:** _(tba)_
**Depends on:** T-102 (storage client), T-105 (render script) — workflow invokes render.ts

## Context

GitHub Actions worker render MP4 offline. Nhận trigger từ T-103 qua `repository_dispatch`, chạy script render của T-105, upload lên Supabase Storage (T-102 client), POST callback về API.

## Files to touch
- `.github/workflows/render-video.yml` (NEW, ở **ROOT VibeCode**, KHÔNG trong vibeseek/)
- Update task file + AGENT_LOG

## Prerequisites

User phải set GitHub Actions secrets **TRƯỚC KHI** workflow chạy được (Agent không tự làm — báo user nếu chưa set):

Repo Settings → Secrets and variables → Actions → New repository secret:
- `SUPABASE_URL` (= NEXT_PUBLIC_SUPABASE_URL)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` = `vibeseek-videos`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `RENDER_CALLBACK_SECRET` (same value as `.env.local`)
- `APP_CALLBACK_URL` — URL tuyệt đối tới `/api/render-callback`. Options:
  - Vercel deploy: `https://vibeseek.vercel.app/api/render-callback`
  - Local dev: dùng ngrok tunnel (ngrok http 3000 → `https://xxx.ngrok.io/api/render-callback`)

## Architect's spec

### `.github/workflows/render-video.yml`

```yaml
name: Render VibeSeek Video

on:
  repository_dispatch:
    types: [render-video]
  workflow_dispatch:
    inputs:
      jobId:
        description: 'render_jobs.id to process'
        required: true

permissions:
  contents: read

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout render script + lib
        uses: actions/checkout@v4
        with:
          sparse-checkout: |
            vibeseek/scripts/render
            vibeseek/lib/storage
            vibeseek/lib/ai/prompts.ts

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install system deps (ffmpeg + edge-tts)
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg python3-pip
          pip3 install edge-tts

      - name: Install render script deps
        working-directory: vibeseek/scripts/render
        run: npm ci

      - name: Render video
        working-directory: vibeseek/scripts/render
        env:
          JOB_ID: ${{ github.event.client_payload.jobId || github.event.inputs.jobId }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SUPABASE_STORAGE_BUCKET: ${{ secrets.SUPABASE_STORAGE_BUCKET }}
          RENDER_CALLBACK_SECRET: ${{ secrets.RENDER_CALLBACK_SECRET }}
          APP_CALLBACK_URL: ${{ secrets.APP_CALLBACK_URL }}
        run: node render.mjs "$JOB_ID"
```

### Notes

- `timeout-minutes: 10` matches blueprint §7.4.
- `sparse-checkout` tránh clone toàn bộ repo (nhanh hơn).
- `workflow_dispatch` với input `jobId` cho phép test manual (không cần trigger từ API).
- Node 20 chọn để hỗ trợ `Buffer`, modern ES features, fetch API native.

## Acceptance criteria
- [ ] AC-1: File `.github/workflows/render-video.yml` tồn tại đúng format YAML.
- [ ] AC-2: Push branch → vào GitHub Actions tab, workflow `Render VibeSeek Video` xuất hiện.
- [ ] AC-3: Manual test qua `workflow_dispatch` với fake jobId `"test-123"`:
  - UI: Actions → Render VibeSeek Video → Run workflow → input `test-123`
  - Expected: workflow runs, fails gracefully at "fetch render_jobs" step (job id không tồn tại) — NHƯNG các bước checkout/install phải pass.
- [ ] AC-4: YAML lint pass: `npx yaml-lint .github/workflows/render-video.yml` hoặc dán vào https://www.yamllint.com/.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened, mô tả rõ prereq user phải set 7 secrets
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi nếu chọn Node 22, hoặc đổi ffmpeg version, v.v.)_

## Notes for reviewer
- Nếu user chưa set secrets → workflow sẽ fail ở step "Render video" với lỗi `Missing SUPABASE_URL`. Đây là expected, không phải bug của workflow.
- Khi T-105 (render script) chưa viết xong → workflow cũng fail ở bước cuối. Task này chỉ verify **yaml structure + prereq pipeline** hoạt động, không phải full render.
