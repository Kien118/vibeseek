'use client'

import Link from 'next/link'
import DojoFace from './DojoFace'

interface Activity {
  streakDays: number
  doneDates: string[]
  monthDays: number
  todayIso: string
  weeklyTarget: number
  weeklyDone: number
}

interface LeaderboardRow {
  rank: number
  anonId: string
  displayName: string | null
  totalPoints: number
  isMe: boolean
}

interface Props {
  latestDocId: string | null
  activity: Activity | null
  leaderboardTop: LeaderboardRow[]
}

// Hash anonId to pick avatar gradient
function avatarGradient(anonId: string): string {
  const GRADIENTS = [
    'linear-gradient(135deg, #F5B83E 0%, #C48920 100%)',
    'linear-gradient(135deg, #5B89B0 0%, #3F6788 100%)',
    'linear-gradient(135deg, #D96C4F 0%, #9B5675 100%)',
    'linear-gradient(135deg, #7A9B7E 0%, #4F6953 100%)',
  ]
  let hash = 0
  for (let i = 0; i < anonId.length; i++) hash = (hash * 31 + anonId.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

export default function SidebarStack({ latestDocId, activity, leaderboardTop }: Props) {
  const docId = latestDocId === 'local' ? null : latestDocId

  const act = activity ?? {
    streakDays: 0,
    doneDates: [],
    monthDays: 30,
    todayIso: new Date().toISOString().slice(0, 10),
    weeklyTarget: 7,
    weeklyDone: 0,
  }

  const { streakDays, doneDates, monthDays, todayIso, weeklyTarget, weeklyDone } = act
  const todayDay = parseInt(todayIso.split('-')[2], 10)
  const month = parseInt(todayIso.split('-')[1], 10)
  const year = parseInt(todayIso.split('-')[0], 10)

  // Compute first weekday of month (0=Sun..6=Sat → convert to Mon=0..Sun=6)
  const rawDow = new Date(year, month - 1, 1).getDay() // 0 Sun
  const firstDow = rawDow === 0 ? 6 : rawDow - 1 // Mon=0..Sun=6

  // SVG ring
  const CIRC = 251.3 // 2π × 40
  const pct = weeklyTarget > 0 ? weeklyDone / weeklyTarget : 0
  const offset = CIRC * (1 - Math.min(pct, 1))
  const pctLabel = Math.round(pct * 100)

  const doneDatesSet = new Set(doneDates)

  return (
    <aside className="flex flex-col gap-4">
      {/* 1. AskDojo */}
      <div
        className="glass rounded-3xl border border-terracotta/22 p-5 text-center relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(217,108,79,0.1) 0%, transparent 70%)' }}
      >
        <p className="font-mono text-[11px] text-stone uppercase tracking-wider">Trợ lý học tập</p>
        <DojoFace size={112} className="mx-auto mt-2 mb-3" />
        <h3 className="font-display font-extrabold text-paper-cream text-lg">Bé DOJO</h3>
        <p className="font-mono text-[10.5px] text-terracotta-soft mt-0.5">Luôn sẵn sàng 🤖</p>
        {docId ? (
          <Link
            href={`/chat/${docId}`}
            className="mt-3 w-full px-3.5 py-3 rounded-full bg-ink-base/65 border border-terracotta/35 text-stone text-left font-body text-sm hover:border-terracotta hover:text-paper-cream transition flex items-center gap-2"
          >
            <span>✨</span>
            <span>Hỏi DOJO bất cứ điều gì…</span>
          </Link>
        ) : (
          <button
            onClick={() => alert('Upload PDF trước để chat với DOJO.')}
            className="mt-3 w-full px-3.5 py-3 rounded-full bg-ink-base/65 border border-terracotta/35 text-stone text-left font-body text-sm hover:border-terracotta hover:text-paper-cream transition flex items-center gap-2"
          >
            <span>✨</span>
            <span>Hỏi DOJO bất cứ điều gì…</span>
          </button>
        )}
      </div>

      {/* 2. GoalRing */}
      <div className="glass rounded-3xl border border-paper-cream/10 p-5 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F5B83E" />
                <stop offset="100%" stopColor="#FFCE5E" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx="48" cy="48" r="40"
              fill="none"
              stroke="rgba(245,239,228,0.08)"
              strokeWidth="8"
            />
            {/* Progress */}
            <circle
              cx="48" cy="48" r="40"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={offset}
              transform="rotate(-90 48 48)"
            />
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <span className="font-display font-extrabold text-2xl text-sunflower leading-none">{pctLabel}%</span>
              <p className="font-mono text-[10px] text-stone uppercase mt-0.5">tuần này</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-bold text-paper-cream text-base">Mục tiêu tuần</h4>
          <p className="text-stone text-[12.5px] mt-1 leading-relaxed">
            {weeklyDone}/{weeklyTarget} ngày học. Còn {weeklyTarget - weeklyDone} ngày để có huy hiệu tuần!
          </p>
          <p className="font-hand text-base text-sunflower mt-1.5">keep going! ✨</p>
        </div>
      </div>

      {/* 3. StreakCalendar */}
      <div className="glass rounded-3xl border border-paper-cream/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-bold text-paper-cream">Streak · tháng {month}</h4>
          <span className="text-terracotta-soft font-bold font-mono text-sm">🔥 {streakDays} ngày</span>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['T2','T3','T4','T5','T6','T7','CN'].map((d) => (
            <div key={d} className="text-center font-mono text-[9.5px] text-stone tracking-wider">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Leading blanks */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {/* Days */}
          {Array.from({ length: monthDays }).map((_, i) => {
            const day = i + 1
            const dayStr = `${todayIso.slice(0, 7)}-${String(day).padStart(2, '0')}`
            const isDone = doneDatesSet.has(dayStr)
            const isToday = day === todayDay
            const isFuture = day > todayDay

            let cellClass = 'aspect-square rounded-lg grid place-items-center font-mono text-[10px] '
            if (isDone) {
              cellClass += 'bg-gradient-to-br from-sunflower/60 to-terracotta/50 border border-sunflower/50 text-ink-base font-bold shadow-[0_0_12px_rgba(245,184,62,0.35)]'
            } else if (isToday) {
              cellClass += 'border-2 border-sunflower bg-sunflower/12 text-sunflower font-bold'
            } else if (isFuture) {
              cellClass += 'bg-paper-cream/4 border border-paper-cream/6 text-stone opacity-30'
            } else {
              cellClass += 'bg-paper-cream/4 border border-paper-cream/6 text-stone'
            }

            return (
              <div key={day} className={cellClass}>
                {day}
              </div>
            )
          })}
        </div>

        <div className="flex justify-between text-[11.5px] mt-3">
          <span className="text-stone">Còn {monthDays - todayDay} ngày trong tháng</span>
          <span className="font-hand text-sunflower">#trendline up</span>
        </div>
      </div>

      {/* 4. LeaderboardPeek */}
      <div className="glass rounded-3xl border border-paper-cream/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-bold text-paper-cream">Xếp hạng · top</h4>
          <Link href="/leaderboard" className="text-sunflower text-xs hover:underline">Xem hết</Link>
        </div>

        {leaderboardTop.length === 0 ? (
          <p className="text-stone text-sm">Chưa có dữ liệu xếp hạng</p>
        ) : (
          <div>
            {leaderboardTop.map((row) => {
              const initials = (row.displayName ?? 'VS').slice(0, 2).toUpperCase()
              const rankColor = row.rank === 1 ? 'text-sunflower' : row.isMe ? 'text-sunflower' : 'text-stone'
              return (
                <div
                  key={row.anonId}
                  className="grid grid-cols-[22px_30px_1fr_auto] items-center gap-2.5 py-2 border-b border-paper-cream/5 last:border-b-0"
                >
                  <span className={`font-mono font-bold text-xs text-center ${rankColor}`}>
                    {row.rank > 0 ? row.rank : '?'}
                  </span>
                  <div
                    className="w-[30px] h-[30px] rounded-full grid place-items-center font-display font-bold text-[11px] text-paper-cream shrink-0"
                    style={{ background: avatarGradient(row.anonId) }}
                  >
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-paper-cream truncate">
                    {row.displayName ?? 'Anonymous'}
                    {row.isMe && (
                      <span className="ml-1 font-mono text-[10px] text-sunflower"> · Bạn</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-xs text-sunflower shrink-0">
                    {row.totalPoints.toLocaleString('vi-VN')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
