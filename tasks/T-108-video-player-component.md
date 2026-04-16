# T-108 · `VideoPlayer.tsx` — poll + play + download

**Status:** `todo`
**Severity:** MED
**Blueprint ref:** §2.2 step 9–10, §11 T-108
**Branch:** `task/T-108-video-player-component`
**Assignee:** _(tba)_
**Depends on:** T-107 (polling endpoint)

## Context

Client component nhận `jobId`, poll `/api/render-jobs/{jobId}` mỗi 5s, hiển thị progress → khi ready thì show `<video>` + button download MP4.

## Files to touch
- `vibeseek/components/VideoPlayer.tsx` (NEW)
- `vibeseek/app/dashboard/page.tsx` (MODIFY — tích hợp VideoPlayer vào flow "🎬 Tạo video")
- Update task file + AGENT_LOG

## Architect's spec

### `vibeseek/components/VideoPlayer.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  jobId: string
  documentTitle?: string
}

type Job = {
  jobId: string
  status: 'queued' | 'rendering' | 'ready' | 'failed'
  videoUrl: string | null
  durationSec: number | null
  errorMessage: string | null
}

const POLL_INTERVAL = 5000
const POLL_MAX_ATTEMPTS = 144  // 12 min

export default function VideoPlayer({ jobId, documentTitle = 'vibeseek-video' }: Props) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    async function poll() {
      attempts++
      if (attempts > POLL_MAX_ATTEMPTS) {
        setError('Render quá lâu. Vui lòng thử lại.')
        return
      }

      try {
        const res = await fetch(`/api/render-jobs/${jobId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: Job = await res.json()
        if (cancelled) return
        setJob(data)

        if (data.status === 'ready' || data.status === 'failed') return
        setTimeout(poll, POLL_INTERVAL)
      } catch (e) {
        if (cancelled) return
        setError(String(e))
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId])

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        <AlertCircle className="h-5 w-5" />
        <span>Lỗi: {error}</span>
      </div>
    )
  }

  if (!job || job.status === 'queued' || job.status === 'rendering') {
    const label = job?.status === 'rendering' ? 'Đang render video...' : 'Đang xếp hàng...'
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        <p className="text-white/70">{label}</p>
        <p className="text-xs text-white/40">Thường mất 1–2 phút. Đừng tắt tab.</p>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" /> Render thất bại
        </div>
        <p className="mt-2 text-sm">{job.errorMessage || 'Lỗi không xác định.'}</p>
      </div>
    )
  }

  // status === 'ready'
  const filename = `${documentTitle.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}.mp4`
  return (
    <div className="space-y-3">
      <video controls className="w-full rounded-2xl border border-white/10" src={job.videoUrl!} />
      <a
        href={job.videoUrl!}
        download={filename}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-2.5 font-semibold text-white hover:opacity-90"
      >
        <Download className="h-4 w-4" /> Tải về thiết bị
      </a>
    </div>
  )
}
```

### Integration trong `app/dashboard/page.tsx`

Agent đọc current dashboard flow + thêm state `currentJobId`. Khi user click "🎬 Tạo video" → POST `/api/vibefy-video` → nhận `jobId` → render `<VideoPlayer jobId={currentJobId} />`.

(Giữ minimal change — chỉ thay phần render video cũ, đừng refactor dashboard layout.)

## Acceptance criteria
- [ ] AC-1: `npx tsc --noEmit` + `npm run build` pass.
- [ ] AC-2: `npm run dev` → upload PDF → sinh cards → click tạo video → thấy spinner "Đang xếp hàng..." → sau 1-2 phút (nếu pipeline hoạt động) → video player xuất hiện với button Download.
- [ ] AC-3: Button Download → click → browser tải file `.mp4` đúng tên.
- [ ] AC-4: Nếu job `failed` → hiển thị error message, không crash page.
- [ ] AC-5: Component cleanup khi unmount — không leak interval (verify bằng devtools: đổi page → check network tab không còn poll).

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened với screenshot flow
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- Nếu dashboard hiện tại đã có state machine phức tạp cho video, agent **cố gắng không phá vỡ nó** — chỉ swap phần hiển thị video sang `<VideoPlayer jobId={...} />`.
- Polling 5s là interval đủ tốt cho demo. Có thể optimize sang Supabase Realtime subscription ở Phase 4.
- POLL_MAX_ATTEMPTS = 144 (12 phút) — quá thời gian coi như fail (render không bao giờ vượt 10 phút theo workflow timeout).
