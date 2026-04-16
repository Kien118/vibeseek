# T-107 · Render callback + polling endpoints

**Status:** `review`
**Severity:** MED
**Blueprint ref:** §6.3, §6.4, §11 T-107
**Branch:** `task/T-107-render-callback-and-polling`
**Assignee:** Antigravity
**Depends on:** none (table `render_jobs` đã có)

## Context

Hai API route:
- **Callback** — GitHub Actions worker gọi khi render xong, update `render_jobs`.
- **Polling** — client Next.js gọi mỗi 5s để lấy job status.

## Files to touch
- `vibeseek/app/api/render-callback/route.ts` (NEW)
- `vibeseek/app/api/render-jobs/[jobId]/route.ts` (NEW)
- `vibeseek/lib/constant-time.ts` (NEW — tiny util cho timing-safe compare)
- Update task file + AGENT_LOG

## Architect's spec

### 1. `vibeseek/lib/constant-time.ts`

```ts
import { timingSafeEqual } from 'node:crypto'

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
```

### 2. `vibeseek/app/api/render-callback/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeEqual } from '@/lib/constant-time'

const secret = process.env.RENDER_CALLBACK_SECRET!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-render-secret') || ''
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { jobId, status, videoUrl, durationSec, errorMessage } = await req.json()
  if (!jobId || !status) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  if (!['ready', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  const { error } = await supabase.from('render_jobs').update({
    status,
    video_url: videoUrl ?? null,
    duration_sec: durationSec ?? null,
    error_message: errorMessage ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### 3. `vibeseek/app/api/render-jobs/[jobId]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // public RLS read is fine
)

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const { data, error } = await supabase
    .from('render_jobs')
    .select('id,status,video_url,duration_sec,error_message')
    .eq('id', params.jobId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    jobId: data.id,
    status: data.status,
    videoUrl: data.video_url,
    durationSec: data.duration_sec,
    errorMessage: data.error_message,
  })
}
```

## Acceptance criteria
- [ ] AC-1: `npx tsc --noEmit` + `npm run build` pass.
- [ ] AC-2: Callback test:
  ```bash
  # Insert dummy render_job, then:
  curl -X POST http://localhost:3000/api/render-callback \
    -H "x-render-secret: <from .env.local>" \
    -H "Content-Type: application/json" \
    -d '{"jobId":"<uuid>","status":"ready","videoUrl":"https://example.com/v.mp4","durationSec":45}'
  # Expected: 200 { ok: true }, DB row updated
  ```
- [ ] AC-3: Callback **unauthorized** (wrong secret) → 401.
- [ ] AC-4: `GET /api/render-jobs/<uuid>` returns correct shape (§6.3 blueprint).
- [ ] AC-5: `GET /api/render-jobs/<nonexistent>` → 404.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- `safeEqual` dùng `timingSafeEqual` — nếu agent thấy có lib tương tự trong repo, **reuse**, đừng duplicate.
- Polling route dùng ANON_KEY + RLS (public SELECT) — không cần service_role. Giữ nhẹ và an toàn.
