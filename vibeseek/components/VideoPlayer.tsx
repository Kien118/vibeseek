'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Download, ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  documentTitle?: string
}

type JobStatus = 'queued' | 'rendering' | 'ready' | 'failed'

type Job = {
  jobId: string
  status: JobStatus
  videoUrl: string | null
  durationSec: number | null
  errorMessage: string | null
}

type PollError = Error & { retryable?: boolean }

const POLL_INTERVAL = 5000
const POLL_MAX_ATTEMPTS = 240 // 20 min: cold GitHub runner + model retry can take a while.
const POLL_MAX_FAILURES = 5
const VIDEO_BUCKET = 'vibeseek-videos'

function statusLabel(status?: JobStatus) {
  if (status === 'rendering') return 'Đang render video...'
  if (status === 'queued') return 'Đang xếp hàng...'
  if (status === 'ready') return 'Sẵn sàng'
  if (status === 'failed') return 'Thất bại'
  return 'Đang tạo render job...'
}

function storagePath(id: string) {
  return `${VIDEO_BUCKET}/${id}.mp4`
}

async function readResponseMessage(res: Response) {
  const fallback = `HTTP ${res.status}`
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const payload = (await res.json()) as { error?: unknown; detail?: unknown }
      const parts = [payload.error, payload.detail].filter((part): part is string => typeof part === 'string' && part.length > 0)
      return parts.length ? parts.join(': ') : fallback
    } catch {
      return fallback
    }
  }

  const text = await res.text().catch(() => '')
  return text || fallback
}

function buildPollError(message: string, retryable: boolean): PollError {
  const error = new Error(message) as PollError
  error.retryable = retryable
  return error
}

async function fetchJob(jobId: string): Promise<Job> {
  const res = await fetch(`/api/render-jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' })

  if (!res.ok) {
    const message = await readResponseMessage(res)
    if (res.status === 404) {
      throw buildPollError(`Không tìm thấy render job ${jobId}.`, false)
    }

    throw buildPollError(message, res.status === 408 || res.status === 429 || res.status >= 500)
  }

  return (await res.json()) as Job
}

export default function VideoPlayer({ jobId, documentTitle = 'vibeseek-video' }: Props) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryNotice, setRetryNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let consecutiveFailures = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const schedulePoll = () => {
      timeoutId = setTimeout(poll, POLL_INTERVAL)
    }

    async function poll() {
      attempts += 1
      if (attempts > POLL_MAX_ATTEMPTS) {
        setError(`Render quá lâu. Job ID: ${jobId}. Kiểm tra Storage: ${storagePath(jobId)}.`)
        return
      }

      try {
        const data = await fetchJob(jobId)
        if (cancelled) return

        consecutiveFailures = 0
        setRetryNotice(null)
        setError(null)
        setJob(data)

        if (data.status === 'ready') {
          if (!data.videoUrl) {
            setError(`Render job ${data.jobId} đã ready nhưng API chưa trả videoUrl. Kiểm tra Storage: ${storagePath(data.jobId)}.`)
          }
          return
        }

        if (data.status === 'failed') return

        if (data.status !== 'queued' && data.status !== 'rendering') {
          setError(`Trạng thái render không hợp lệ: ${String(data.status)}.`)
          return
        }

        schedulePoll()
      } catch (e) {
        if (cancelled) return
        const pollError = e as PollError
        const message = pollError.message || 'Không đọc được trạng thái render.'
        const canRetry = pollError.retryable !== false && consecutiveFailures < POLL_MAX_FAILURES

        if (!canRetry) {
          setRetryNotice(null)
          setError(`${message} Job ID: ${jobId}.`)
          return
        }

        consecutiveFailures += 1
        setRetryNotice(`Polling bị gián đoạn (${message}). Đang thử lại ${consecutiveFailures}/${POLL_MAX_FAILURES}...`)
        schedulePoll()
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [jobId])

  // Cursor system: body.loading while video render is pending/rendering.
  useEffect(() => {
    const pending = !error && (!job || job.status === 'queued' || job.status === 'rendering')
    if (pending) document.body.classList.add('loading')
    else document.body.classList.remove('loading')
    return () => document.body.classList.remove('loading')
  }, [error, job])

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-error-terra/30 bg-error-terra/10 p-4 text-error-terra">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Lỗi render video</p>
            <p className="mt-1 text-sm break-words">{error}</p>
          </div>
        </div>
        <div className="grid gap-1 text-xs text-paper-cream/60">
          <span>Job ID: <code className="text-paper-cream/80">{jobId}</code></span>
          <span>Storage: <code className="text-paper-cream/80">{storagePath(jobId)}</code></span>
        </div>
      </div>
    )
  }

  if (!job || job.status === 'queued' || job.status === 'rendering') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-paper-cream/10 bg-paper-cream/5 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-sunflower" />
        <div>
          <p className="text-paper-cream/75">{retryNotice ? 'Đang thử lại kết nối...' : statusLabel(job?.status)}</p>
          <p className="mt-1 text-xs text-paper-cream/40">Thường mất 1-2 phút. Đừng tắt tab.</p>
        </div>
        {retryNotice && <p className="max-w-full text-xs text-sunflower/80 break-words">{retryNotice}</p>}
        <div className="grid gap-1 text-xs text-paper-cream/45">
          <span>Job ID: <code className="text-paper-cream/70">{jobId}</code></span>
          <span>Trạng thái: <code className="text-paper-cream/70">{job?.status ?? 'starting'}</code></span>
        </div>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div className="space-y-3 rounded-2xl border border-error-terra/30 bg-error-terra/10 p-6 text-error-terra">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" /> Render thất bại
        </div>
        <p className="text-sm break-words">{job.errorMessage || 'Lỗi không xác định.'}</p>
        <div className="grid gap-1 text-xs text-paper-cream/60">
          <span>Job ID: <code className="text-paper-cream/80">{job.jobId}</code></span>
          <span>Storage: <code className="text-paper-cream/80">{storagePath(job.jobId)}</code></span>
        </div>
      </div>
    )
  }

  if (!job.videoUrl) {
    return (
      <div className="space-y-3 rounded-2xl border border-error-terra/30 bg-error-terra/10 p-4 text-error-terra">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Thiếu videoUrl</p>
            <p className="mt-1 text-sm break-words">Render job đã sẵn sàng nhưng API chưa trả link video.</p>
          </div>
        </div>
        <div className="grid gap-1 text-xs text-paper-cream/60">
          <span>Job ID: <code className="text-paper-cream/80">{job.jobId}</code></span>
          <span>Storage: <code className="text-paper-cream/80">{storagePath(job.jobId)}</code></span>
        </div>
      </div>
    )
  }

  const videoUrl = job.videoUrl
  const filename = `${documentTitle.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}.mp4`

  return (
    <div className="space-y-3">
      <video controls className="zoomable w-full rounded-2xl border border-paper-cream/10" src={videoUrl} />
      <div className="grid gap-1 text-xs text-paper-cream/55">
        <span>Job ID: <code className="text-paper-cream/80">{job.jobId}</code></span>
        <span>Trạng thái: <code className="text-paper-cream/80">{statusLabel(job.status)}</code></span>
        <span>Storage: <code className="text-paper-cream/80">{storagePath(job.jobId)}</code></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={videoUrl}
          download={filename}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sunflower to-terracotta px-6 py-2.5 font-semibold text-paper-cream hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Tải về thiết bị
        </a>
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-paper-cream/15 px-6 py-2.5 font-semibold text-paper-cream hover:bg-paper-cream/10"
        >
          <ExternalLink className="h-4 w-4" /> Mở video
        </a>
      </div>
    </div>
  )
}
