'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { AlertCircle, Loader2, RefreshCw, X } from 'lucide-react'
import VideoPlayer from '@/components/VideoPlayer'

interface Props {
  documentId: string
  documentTitle?: string
  onClose: () => void
}

type ModalState = 'starting' | 'rendering' | 'error'
type StartPayload = {
  jobId?: unknown
  error?: unknown
  detail?: unknown
}

async function readStartPayload(res: Response): Promise<StartPayload | string> {
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      return (await res.json()) as StartPayload
    } catch {
      return ''
    }
  }

  return res.text().catch(() => '')
}

function formatStartError(payload: StartPayload | string, status: number) {
  if (typeof payload === 'string') {
    return payload || `HTTP ${status}`
  }

  const parts = [payload.error, payload.detail].filter((part): part is string => typeof part === 'string' && part.length > 0)
  return parts.length ? parts.join(': ') : `HTTP ${status}`
}

export default function VideoGenerateModal({ documentId, documentTitle, onClose }: Props) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [state, setState] = useState<ModalState>('starting')
  const [error, setError] = useState<string | null>(null)
  const startedDocumentRef = useRef<string | null>(null)

  const start = useCallback(async () => {
    setState('starting')
    setError(null)
    setJobId(null)

    try {
      const res = await fetch('/api/vibefy-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, maxScenes: 10 }),
      })
      const payload = await readStartPayload(res)

      if (!res.ok) {
        throw new Error(formatStartError(payload, res.status))
      }

      if (typeof payload === 'string' || typeof payload.jobId !== 'string') {
        throw new Error('jobId missing trong response')
      }

      setJobId(payload.jobId)
      setState('rendering')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định')
      setState('error')
    }
  }, [documentId])

  useEffect(() => {
    // React StrictMode runs effects twice in dev; remember the document ID so
    // the first successful start request is the only automatic one.
    if (startedDocumentRef.current === documentId) return
    startedDocumentRef.current = documentId
    start()
  }, [documentId, start])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-ink-base/80 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl border border-paper-cream/12 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-paper-cream">Tạo video 9:16</h2>
            <p className="mt-1 text-xs text-paper-cream/45">Document ID: <code>{documentId}</code></p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone transition hover:bg-paper-cream/10 hover:text-paper-cream"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state === 'starting' && (
          <div className="flex items-center gap-3 rounded-2xl border border-paper-cream/10 bg-paper-cream/5 p-4 text-sm text-paper-cream/75">
            <Loader2 className="h-5 w-5 animate-spin text-sunflower" />
            <span>Đang tạo storyboard và xếp hàng render...</span>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4 rounded-2xl border border-error-terra/30 bg-error-terra/10 p-4 text-error-terra">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
              <div className="min-w-0">
                <p className="font-semibold">Không tạo được render job</p>
                <p className="mt-1 text-sm break-words">{error}</p>
              </div>
            </div>
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-full border border-error-terra/40 px-4 py-2 text-sm font-semibold text-error-terra hover:bg-error-terra/10"
            >
              <RefreshCw className="h-4 w-4" /> Thử lại
            </button>
          </div>
        )}

        {state === 'rendering' && jobId && (
          <VideoPlayer jobId={jobId} documentTitle={documentTitle} />
        )}
      </div>
    </div>
  )
}
