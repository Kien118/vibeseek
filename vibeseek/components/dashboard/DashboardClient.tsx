'use client'

import { useEffect, useState, useCallback } from 'react'
import { getOrCreateAnonId } from '@/utils/anon-id'
import { loadDocHistory, type DocHistoryEntry } from '@/utils/doc-history'
import { loadTweaks, type DashboardTweaks } from '@/utils/dashboard-tweaks'
import TopBar from './TopBar'
import HeroGreeting from './HeroGreeting'
import ContinueLearningCard from './ContinueLearningCard'
import VibeBoard from './VibeBoard'
import QuickActionGrid from './QuickActionGrid'
import UploadPromptCard from './UploadPromptCard'
import UploadModal from './UploadModal'
import SidebarStack from './SidebarStack'
import DashboardTweaksPanel from './DashboardTweaks'

interface DashboardPayload {
  profile: {
    displayName: string | null
    totalPoints: number
    quizCorrectCount: number
    documentsCount: number
  }
  activity: {
    streakDays: number
    doneDates: string[]
    monthDays: number
    todayIso: string
    weeklyTarget: number
    weeklyDone: number
  }
  latestDoc: {
    documentId: string
    title: string
    totalCards: number
    hasVideo: boolean
    createdAt: string
  } | null
  recentCards: Array<{
    id: string
    documentId: string
    cardType: 'concept' | 'quote' | 'tip' | 'fact' | 'summary'
    title: string
    content: string
    emoji: string
    tags: string[]
    vibePoints: number
  }>
  leaderboardTop: Array<{
    rank: number
    anonId: string
    displayName: string | null
    totalPoints: number
    isMe: boolean
  }>
}

export default function DashboardClient() {
  const [anonId, setAnonId] = useState<string | null>(null)
  // docHistory is fetched but not directly rendered — used for API call scoping
  const [, setDocHistory] = useState<DocHistoryEntry[]>([])
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [tweaks, setTweaks] = useState<DashboardTweaks>(() => loadTweaks())

  const refresh = useCallback(async (currentAnonId: string) => {
    try {
      const docs = loadDocHistory()
      setDocHistory(docs)
      const docIds = docs.map((d) => d.documentId).filter((id) => id !== 'local').join(',')
      const url = `/api/profile/dashboard?anonId=${encodeURIComponent(currentAnonId)}${docIds ? `&docIds=${encodeURIComponent(docIds)}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPayload(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    }
  }, [])

  useEffect(() => {
    const id = getOrCreateAnonId()
    setAnonId(id)
  }, [])

  useEffect(() => {
    if (anonId) refresh(anonId)
  }, [anonId, refresh])

  return (
    <div
      className="dashboard-shell min-h-screen pb-20"
      data-density={tweaks.density}
      data-layout={tweaks.layout}
      data-accent={tweaks.accent}
    >
      <TopBar
        displayName={payload?.profile.displayName ?? null}
        totalPoints={payload?.profile.totalPoints ?? 0}
        streakDays={payload?.activity.streakDays ?? 0}
      />

      <main
        className={`mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8 pt-7 grid gap-6 ${
          tweaks.layout === 'feed'
            ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_300px]'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]'
        }`}
      >
        <div className="flex flex-col gap-5 min-w-0">
          <HeroGreeting
            displayName={payload?.profile.displayName ?? null}
            streakDays={payload?.activity.streakDays ?? 0}
            latestDoc={payload?.latestDoc ?? null}
            onContinue={() => {
              if (payload?.latestDoc) window.location.href = `/quiz/${payload.latestDoc.documentId}`
            }}
            onQuickQuiz={() => {
              if (payload?.latestDoc) window.location.href = `/quiz/${payload.latestDoc.documentId}`
            }}
          />
          {payload?.latestDoc && (
            <ContinueLearningCard
              latestDoc={payload.latestDoc}
              recentCardsCount={payload.recentCards.length}
            />
          )}
          <VibeBoard cards={payload?.recentCards ?? []} />
          <QuickActionGrid
            latestDocId={payload?.latestDoc?.documentId ?? null}
            onUpload={() => setUploadOpen(true)}
          />
          <UploadPromptCard onUpload={() => setUploadOpen(true)} />
        </div>

        <SidebarStack
          latestDocId={payload?.latestDoc?.documentId ?? null}
          activity={payload?.activity ?? null}
          leaderboardTop={payload?.leaderboardTop ?? []}
        />
      </main>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false)
            if (anonId) refresh(anonId)
          }}
        />
      )}

      <DashboardTweaksPanel tweaks={tweaks} onChange={setTweaks} />

      {error && (
        <div className="fixed bottom-4 left-4 px-4 py-2 rounded-lg bg-error-terra/20 border border-error-terra/40 text-error-terra text-sm font-mono z-50">
          {error}
        </div>
      )}
    </div>
  )
}
