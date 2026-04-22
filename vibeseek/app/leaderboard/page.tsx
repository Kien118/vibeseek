'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getOrCreateAnonId } from '@/utils/anon-id'
import LeaderboardTable, { LeaderboardRow } from '@/components/LeaderboardTable'
import { Loader2 } from 'lucide-react'

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [anonId, setAnonId] = useState<string | null>(null)
  const [myName, setMyName] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    const id = getOrCreateAnonId()
    setAnonId(id)
    const [topRes, meRes] = await Promise.all([
      fetch('/api/leaderboard?limit=20').then((r) => r.json()),
      id ? fetch(`/api/leaderboard/profile?anonId=${id}`).then((r) => r.json()) : Promise.resolve(null),
    ])
    setRows(topRes.top || [])
    if (meRes?.profile?.display_name) setMyName(meRes.profile.display_name)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function saveName() {
    if (!anonId || !myName.trim()) return
    setSaving(true)
    try {
      await fetch('/api/leaderboard/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId, displayName: myName }),
      })
      await loadAll()
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-16 text-[#F5EFE4] space-y-8">
      <header className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-block text-sm text-[#F5EFE4]/60 hover:text-[#F5EFE4] transition-colors"
        >
          ← Về Dashboard
        </Link>
        <p className="text-[#F5EFE4]/50 font-mono uppercase text-xs">VibeSeek Leaderboard</p>
        <h1 className="font-display text-4xl">Top vibe</h1>
      </header>

      {anonId && (
        <section className="flex items-center gap-3">
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            maxLength={40}
            placeholder={`T\u00ean c\u1ee7a b\u1ea1n`}
            className="flex-1 px-4 py-2 rounded-full bg-[#F5EFE4]/5 border border-[#F5EFE4]/10 text-[#F5EFE4]/90 focus:border-[#5B89B0] outline-none"
          />
          <button
            onClick={saveName}
            disabled={saving || myName.trim().length < 1}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[#F5B83E] to-[#D96C4F] font-semibold disabled:opacity-40"
          >
            {saving ? '\u0110ang l\u01b0u...' : 'L\u01b0u t\u00ean'}
          </button>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#5B89B0]" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center p-12 space-y-4">
          <div className="text-6xl">🏆</div>
          <h2 className="text-xl font-bold text-[#F5EFE4]">Chưa có ai trên bảng</h2>
          <p className="text-[#F5EFE4]/60 text-sm max-w-md mx-auto">
            Hoàn thành quiz đầu tiên để xuất hiện trên leaderboard.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-[#D96C4F] to-[#F5B83E] text-[#F5EFE4] font-semibold text-sm hover:opacity-90"
          >
            Về Dashboard
          </Link>
        </div>
      ) : (
        <LeaderboardTable rows={rows} highlightAnonId={anonId} />
      )}
    </main>
  )
}
