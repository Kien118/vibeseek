'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getOrCreateAnonId } from '@/utils/anon-id'

/**
 * Top-right floating badge showing current user's vibe points.
 * Hidden on landing (`/`) per blueprint §7.11.
 * Clicking navigates to /leaderboard.
 */
export default function VibePointsBadge() {
  const pathname = usePathname()
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    if (pathname === '/') return  // landing — don't even fetch
    const anonId = getOrCreateAnonId()
    if (!anonId) return
    fetch(`/api/leaderboard/profile?anonId=${encodeURIComponent(anonId)}`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.profile) setPoints(body.profile.total_points ?? 0)
      })
      .catch(() => {/* silent */})
  }, [pathname])

  if (pathname === '/') return null
  if (points === null) return null  // hide until loaded — prevents flash

  return (
    <Link
      href="/leaderboard"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/10 text-white/90 font-mono text-sm"
    >
      <Trophy className="w-4 h-4 text-yellow-400" />
      <span className="font-bold">{points}</span>
      <span className="text-white/50">vibe</span>
    </Link>
  )
}
