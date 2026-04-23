'use client'

import { useEffect, useRef, useState } from 'react'
import VideoPlayer from '@/components/VideoPlayer'

interface Props {
  documentId: string
  documentTitle?: string
  onClose: () => void
}

type ModalState = 'starting' | 'rendering' | 'error'

export default function VideoGenerateModal({ documentId, documentTitle, onClose }: Props) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [state, setState] = useState<ModalState>('starting')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // StrictMode guard via ref only. Do NOT add a `cancelled` cleanup — the
    // dev-only teardown would flip it and block mount-1's setState after
    // fetch resolves, leaving the modal stuck at 'starting'.
    if (startedRef.current) return
    startedRef.current = true

    async function start() {
      try {
        const res = await fetch('/api/vibefy-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, maxScenes: 6 }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`)
        if (!payload.jobId) throw new Error('jobId missing trong response')
        setJobId(payload.jobId)
        setState('rendering')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi không xác định')
        setState('error')
      }
    }
    start()
  }, [documentId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-base/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="glass rounded-3xl border border-paper-cream/12 p-6 w-full max-w-xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display font-bold text-2xl text-paper-cream">🎬 Tạo video 9:16</h2>
          <button
            onClick={onClose}
            className="text-stone hover:text-paper-cream transition p-1"
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {state === 'starting' && (
          <p className="text-paper-cream/75 text-sm">Đang tạo storyboard + xếp hàng render...</p>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-error-terra/30 bg-error-terra/10 p-4 text-error-terra text-sm">
            {error}
          </div>
        )}

        {state === 'rendering' && jobId && (
          <VideoPlayer jobId={jobId} documentTitle={documentTitle} />
        )}
      </div>
    </div>
  )
}
