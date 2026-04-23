'use client'

import { useEffect, useState } from 'react'
import DojoFace from './DojoFace'

interface Props {
  displayName: string | null
  streakDays: number
  latestDoc: { title: string; documentId: string } | null
  onContinue: () => void
  onQuickQuiz: () => void
}

export default function HeroGreeting({ displayName, streakDays, latestDoc, onContinue, onQuickQuiz }: Props) {
  const [timeStr, setTimeStr] = useState<string | null>(null)

  useEffect(() => {
    // Set time on client only to avoid SSR hydration mismatch
    const update = () => {
      const now = new Date()
      const hh = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
      setTimeStr(hh)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  const dateStr = new Date().toLocaleString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  })

  const subText = latestDoc
    ? `${streakDays > 0 ? `Streak ${streakDays} ngày 🔥. ` : ''}Tiếp tục với "${latestDoc.title}" hay thử 1 quiz nhanh?`
    : 'Upload PDF đầu tiên để bắt đầu hành trình học.'

  return (
    <section
      className="glass rounded-3xl border border-sunflower/22 p-7 sm:p-8"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(245,184,62,0.07) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 85% 30%, rgba(217,108,79,0.06) 0%, transparent 60%)',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Kicker datetime */}
          <p className="font-mono text-[11px] text-stone uppercase tracking-wider">
            {dateStr}{timeStr ? ` · ${timeStr}` : ''}
          </p>

          {/* Heading */}
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight tracking-tight text-paper-cream">
            Chào <em className="not-italic" style={{ color: 'var(--accent, #F5B83E)' }}>{displayName ?? 'bạn'}</em> 👋
            <br />
            Hôm nay học gì nhỉ?
          </h1>

          {/* Sub */}
          <p className="text-paper-cream/75 text-[15px] leading-relaxed">
            {subText}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={onContinue}
              disabled={!latestDoc}
              className="btn-polish px-5 py-2.5 rounded-xl font-display font-bold text-ink-base text-[14px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #F5B83E 0%, #FFCE5E 100%)', boxShadow: '0 2px 12px rgba(245,184,62,0.35)' }}
            >
              Tiếp tục học
            </button>
            <button
              onClick={onQuickQuiz}
              disabled={!latestDoc}
              className="px-5 py-2.5 rounded-xl font-display font-bold text-paper-cream text-[14px] border border-paper-cream/18 bg-paper-cream/5 hover:bg-paper-cream/10 hover:border-paper-cream/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Quiz 5 phút
            </button>
          </div>
        </div>

        {/* RIGHT — DOJO face + bubble */}
        <div className="hidden lg:flex items-start gap-3">
          <DojoFace size={96} />
          <div className="relative max-w-[230px] p-4 bg-terracotta/10 border border-terracotta/35 rounded-2xl rounded-bl-sm font-hand text-lg">
            <span className="absolute -left-2 top-7 w-4 h-4 rotate-45 bg-terracotta/10 border-l border-b border-terracotta/35" />
            <p className="font-mono text-[10px] text-terracotta-soft font-bold uppercase tracking-wider mb-1">DOJO 🤔</p>
            <p className="text-paper-cream/85 leading-snug">Mình sẵn sàng. Hỏi gì cũng được!</p>
          </div>
        </div>
      </div>
    </section>
  )
}
