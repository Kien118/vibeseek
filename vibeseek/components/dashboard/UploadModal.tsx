'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import UploadZone from '@/components/UploadZone'
import ProgressBar from '@/components/ProgressBar'
import { addDocToHistory, type DocHistoryEntry } from '@/utils/doc-history'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type ModalState = 'idle' | 'processing' | 'success'

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [modalState, setModalState] = useState<ModalState>('idle')
  const [cards, setCards] = useState<Array<{ title: string; vibe_points: number }>>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [totalVibePoints, setTotalVibePoints] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const fileLabel = useMemo(
    () => (file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : null),
    [file],
  )

  // Escape key handler (F-7, R3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState !== 'processing') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalState, onClose])

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    if (!title) {
      setTitle(selectedFile.name.replace(/\.pdf$/i, ''))
    }
    setError(null)
  }

  const handleAnalyzePdf = async () => {
    if (!file) {
      setError('Vui lòng chọn file PDF trước khi upload.')
      return
    }

    setModalState('processing')
    setError(null)
    setProgress(10)
    setCards([])
    setDocumentId(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('title', title || file.name.replace('.pdf', ''))
      formData.append('maxCards', '10')
      setProgress(30)

      const response = await fetch('/api/vibefy', {
        method: 'POST',
        body: formData,
      })
      setProgress(70)

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Upload thất bại')
      }

      const fetchedCards = payload.cards ?? []
      const fetchedDocId: string | null = payload.documentId ?? null
      const pts = fetchedCards.reduce((sum: number, c: { vibe_points: number }) => sum + c.vibe_points, 0)

      setCards(fetchedCards)
      setDocumentId(fetchedDocId)
      setTotalVibePoints(pts)

      if (fetchedDocId && fetchedDocId !== 'local') {
        const entry: DocHistoryEntry = {
          documentId: fetchedDocId,
          title: title || file.name.replace(/\.pdf$/i, ''),
          createdAt: Date.now(),
        }
        addDocToHistory(entry)
      }

      setProgress(100)
      setModalState('success')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Lỗi không xác định')
      setModalState('idle')
    }
  }

  const handleReset = () => {
    setFile(null)
    setTitle('')
    setProgress(0)
    setError(null)
    setCards([])
    setDocumentId(null)
    setTotalVibePoints(0)
    setModalState('idle')
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modalState !== 'processing') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-base/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="glass rounded-3xl border border-paper-cream/12 p-6 w-full max-w-xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {modalState === 'success' ? (
          /* SUCCESS STATE (R3) */
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display font-bold text-2xl text-sage-bright">
                ✓ {cards.length} Vibe Cards sẵn sàng
              </h2>
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

            <p className="text-paper-cream/75 text-sm">
              &ldquo;{title}&rdquo; · +{totalVibePoints} XP
            </p>

            <div className="flex gap-3">
              {documentId && documentId !== 'local' && (
                <button
                  onClick={() => { window.location.href = `/quiz/${documentId}` }}
                  className="btn-polish flex-1 px-4 py-3 rounded-xl font-display font-bold text-ink-base text-sm"
                  style={{ background: 'linear-gradient(135deg, #F5B83E 0%, #FFCE5E 100%)' }}
                >
                  Làm Quiz ngay →
                </button>
              )}
              <button
                onClick={onSuccess}
                className="flex-1 px-4 py-3 rounded-xl font-display font-bold text-paper-cream text-sm border border-paper-cream/20 bg-paper-cream/6 hover:bg-paper-cream/10 transition"
              >
                Về dashboard
              </button>
            </div>

            <p className="text-stone text-xs text-center">
              Hoặc tiếp tục upload PDF khác{' '}
              <button onClick={handleReset} className="text-sunflower underline hover:no-underline">
                reset form
              </button>
            </p>
          </div>
        ) : (
          /* IDLE / PROCESSING STATE */
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display font-bold text-2xl text-paper-cream">Upload PDF mới</h2>
              <button
                onClick={() => { if (modalState !== 'processing') onClose() }}
                disabled={modalState === 'processing'}
                className="text-stone hover:text-paper-cream transition p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Đóng"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-1">
              <label htmlFor="modal-doc-title" className="text-sm text-paper-cream/85">
                Tiêu đề tài liệu
              </label>
              <input
                id="modal-doc-title"
                type="text"
                placeholder="VD: Hóa Hữu Cơ Chương 3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={modalState === 'processing'}
                className="w-full rounded-xl px-3 py-2.5 bg-ink-surface/60 border border-paper-cream/15 text-paper-cream text-sm placeholder:text-stone/60 disabled:opacity-50 focus:outline-none focus:border-sunflower/40"
              />
            </div>

            <UploadZone onFileSelect={handleFileSelect} disabled={modalState === 'processing'} />

            {fileLabel && (
              <p className="text-[12px] text-stone font-mono">{fileLabel}</p>
            )}

            {(modalState === 'processing' || progress > 0) && (
              <ProgressBar
                progress={progress}
                variant="rainbow"
                label={modalState === 'processing' ? 'Đang phân tích PDF với AI...' : 'Phân tích hoàn tất'}
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAnalyzePdf}
                disabled={!file || modalState === 'processing'}
                className="btn-polish flex-1 px-4 py-3 rounded-xl font-display font-bold text-ink-base text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #F5B83E 0%, #FFCE5E 100%)' }}
              >
                {modalState === 'processing' ? 'Đang phân tích…' : 'Phân tích PDF'}
              </button>
              <button
                onClick={() => { if (modalState !== 'processing') onClose() }}
                disabled={modalState === 'processing'}
                className="px-4 py-3 rounded-xl font-display font-bold text-paper-cream text-sm border border-paper-cream/18 bg-paper-cream/5 hover:bg-paper-cream/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
            </div>

            {error && (
              <p className="text-[13px] text-error-terra">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
