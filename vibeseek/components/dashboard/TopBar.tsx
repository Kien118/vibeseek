'use client'

import Link from 'next/link'

interface Props {
  displayName: string | null
  totalPoints: number
  streakDays: number
}

export default function TopBar({ displayName, totalPoints, streakDays }: Props) {
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : 'VS'

  return (
    <div className="sticky top-4 z-40 mx-4 sm:mx-6 mt-4">
      <nav className="rounded-full px-4 py-2.5 bg-ink-base/80 backdrop-blur-glass border border-paper-cream/10 flex items-center gap-4">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span
            className="w-3 h-3 rounded-full bg-sunflower"
            style={{ boxShadow: '0 0 8px rgba(245,184,62,0.7)' }}
          />
          <span className="font-display font-extrabold text-paper-cream tracking-tight">VibeSeek</span>
          <span className="font-mono text-[11px] text-stone">/ DOJO</span>
        </Link>

        {/* Nav — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-full bg-sunflower/12 border border-sunflower/25 text-sunflower font-medium text-[13px]"
          >
            Dashboard
          </Link>
          <Link
            href="/leaderboard"
            className="px-3 py-1.5 rounded-full text-stone hover:text-paper-cream transition text-[13px]"
          >
            Xếp hạng
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-full text-stone hover:text-paper-cream transition text-[13px]"
          >
            Thư viện
          </Link>
        </div>

        {/* Search stub — hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-xs ml-auto">
          <div className="relative w-full">
            <input
              disabled
              placeholder="Tìm kiếm..."
              className="w-full rounded-full px-3 py-1.5 bg-ink-surface/60 border border-paper-cream/10 text-paper-cream/50 text-[13px] placeholder:text-stone/60 cursor-not-allowed"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-stone border border-paper-cream/12 rounded px-1 py-0.5 bg-ink-base/60">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {streakDays > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-terracotta/12 border border-terracotta/30 text-terracotta font-mono font-bold text-[12px]">
              🔥 {streakDays}
            </span>
          )}
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sunflower/12 border border-sunflower/30 text-sunflower font-mono font-bold text-[12px]">
            ⚡ {totalPoints.toLocaleString('vi-VN')} XP
          </span>
          <Link href="/leaderboard">
            <div
              className="w-[38px] h-[38px] rounded-full grid place-items-center text-paper-cream font-display font-bold text-sm cursor-pointer hover:opacity-90 transition shrink-0"
              style={{ background: 'linear-gradient(135deg, #D96C4F 0%, #9B5675 100%)' }}
            >
              {initials}
            </div>
          </Link>
        </div>
      </nav>
    </div>
  )
}
