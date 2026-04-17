'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import UploadZone from '@/components/UploadZone'
import ProgressBar from '@/components/ProgressBar'
import GlowButton from '@/components/GlowButton'
import VibeCard from '@/components/VibeCard'
import VideoPlayer from '@/components/VideoPlayer'
import type { VibeCard as VibeCardType } from '@/utils/supabase'

interface VideoScene {
  scene_index: number
  title: string
  visual_prompt: string
  narration: string
  on_screen_text: string[]
  duration_sec: number
}

interface VideoStoryboard {
  video_title: string
  total_duration_sec: number
  style: string
  scenes: VideoScene[]
}

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<Array<Omit<VibeCardType, 'id' | 'document_id' | 'created_at'>>>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  const fileLabel = useMemo(() => (file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'No file selected'), [file])
  const totalVibePoints = useMemo(() => cards.reduce((sum, card) => sum + card.vibe_points, 0), [cards])

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    if (!title) {
      setTitle(selectedFile.name.replace(/\.pdf$/i, ''))
    }
    setError(null)
  }

  const handleAnalyzePdf = async () => {
    if (!file) {
      setError('Please choose a PDF before uploading.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setProgress(10)
    setCards([])
    setDocumentId(null)
    setCurrentJobId(null)

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
        throw new Error(payload.error || 'Upload failed')
      }

      setCards(payload.cards ?? [])
      setDocumentId(payload.documentId ?? null)
      setProgress(100)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!documentId) {
      setError('Please analyze a PDF first to generate video scenes.')
      return
    }

    setIsGeneratingVideo(true)
    setError(null)
    setCurrentJobId(null)

    try {
      const response = await fetch('/api/vibefy-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          maxScenes: 6,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to enqueue video rendering')
      }

      setCurrentJobId(payload.jobId)
    } catch (videoError) {
      setError(videoError instanceof Error ? videoError.message : 'Unknown video generation error')
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <p className="dashboard-kicker">VibeSeek Studio</p>
          <h1>Upload PDF - Analyze - Convert to Video</h1>
          <p>Pipeline: Read PDF, generate Vibe Cards, then turn key insights into a ready-to-produce video storyboard.</p>
        </header>

        <section className="dashboard-form glass">
          <label htmlFor="doc-title">Document Title</label>
          <input
            id="doc-title"
            type="text"
            placeholder="e.g. Organic Chemistry Chapter 3"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <UploadZone onFileSelect={handleFileSelect} disabled={isProcessing || isGeneratingVideo} />
          <p className="dashboard-file-label">{fileLabel}</p>

          {(isProcessing || progress > 0) && (
            <ProgressBar
              progress={progress}
              variant="rainbow"
              label={isProcessing ? 'Analyzing PDF with AI...' : 'Analysis complete'}
            />
          )}

          <div className="dashboard-actions">
            <GlowButton onClick={handleAnalyzePdf} disabled={!file} loading={isProcessing} variant="purple">
              Analyze PDF
            </GlowButton>
            <GlowButton
              onClick={handleGenerateVideo}
              disabled={!documentId}
              loading={isGeneratingVideo}
              variant="purple"
            >
              🎬 Tạo video
            </GlowButton>
          </div>

          {error && <p className="dashboard-error">{error}</p>}
        </section>

        {cards.length > 0 && (
          <section className="dashboard-result glass">
            <div className="dashboard-result-header">
              <h2>Generated Vibe Cards: {cards.length}</h2>
              <p>Total vibe points: +{totalVibePoints}</p>
              {documentId && documentId !== 'local' && (
                <Link
                  href={`/quiz/${documentId}`}
                  className="inline-block mt-2 px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  🎯 Làm Quiz
                </Link>
              )}
            </div>
            <div className="dashboard-card-grid">
              {cards.map((card, index) => (
                <VibeCard key={`${card.order_index}-${card.title}`} card={card} index={index} />
              ))}
            </div>
          </section>
        )}

        {currentJobId && (
          <section className="dashboard-result glass">
            <div className="dashboard-result-header">
              <h2>Video Rendering Status</h2>
              <p>Your video is being processed.</p>
            </div>
            <VideoPlayer jobId={currentJobId} documentTitle={title || file?.name || 'vibeseek-video'} />
          </section>
        )}
      </section>
    </main>
  )
}
