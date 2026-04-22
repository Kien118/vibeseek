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
const POLL_MAX_ATTEMPTS = 240  // 20 min — first render on cold runner + Gemini 429 retry can exceed 12min

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

  // Cursor system: body.loading while video render is pending/rendering
  useEffect(() => {
    const pending = !job || job.status === 'queued' || job.status === 'rendering'
    if (pending) document.body.classList.add('loading')
    else document.body.classList.remove('loading')
    return () => document.body.classList.remove('loading')
  }, [job])

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-error-terra/30 bg-error-terra/10 p-4 text-error-terra">
        <AlertCircle className="h-5 w-5" />
        <span>Lỗi: {error}</span>
      </div>
    )
  }

  if (!job || job.status === 'queued' || job.status === 'rendering') {
    const label = job?.status === 'rendering' ? 'Đang render video...' : 'Đang xếp hàng...'
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-paper-cream/10 bg-paper-cream/5 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-sunflower" />
        <p className="text-paper-cream/70">{label}</p>
        <p className="text-xs text-paper-cream/40">Thường mất 1–2 phút. Đừng tắt tab.</p>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div className="rounded-2xl border border-error-terra/30 bg-error-terra/10 p-6 text-error-terra">
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
      <video controls className="zoomable w-full rounded-2xl border border-paper-cream/10" src={job.videoUrl!} />
      <a
        href={job.videoUrl!}
        download={filename}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sunflower to-terracotta px-6 py-2.5 font-semibold text-paper-cream hover:opacity-90"
      >
        <Download className="h-4 w-4" /> Tải về thiết bị
      </a>
    </div>
  )
}
