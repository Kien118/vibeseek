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

    async function refresh() {
      const anonId = getOrCreateAnonId()
      if (!anonId) return
      try {
        const res = await fetch(`/api/leaderboard/profile?anonId=${encodeURIComponent(anonId)}`)
        const body = await res.json()
        if (body?.profile) setPoints(body.profile.total_points ?? 0)
      } catch {
        /* silent */
      }
    }

    refresh()
    // Listen for points-updated broadcasts (e.g., quiz submit) so the badge stays
    // live without requiring a route change.
    window.addEventListener('vibe-points-updated', refresh)
    return () => window.removeEventListener('vibe-points-updated', refresh)
  }, [pathname])

  if (pathname === '/') return null
  if (points === null) return null  // hide until loaded — prevents flash

  return (
    <Link
      href="/leaderboard"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-paper-cream/10 bg-paper-cream/5 backdrop-blur hover:bg-paper-cream/10 text-paper-cream/90 font-mono text-sm"
    >
      <Trophy className="w-4 h-4 text-sunflower" />
      <span className="font-bold">{points}</span>
      <span className="text-paper-cream/50">vibe</span>
    </Link>
  )
}
