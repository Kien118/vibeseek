'use client'

import { motion } from 'framer-motion'
import type { VibeCard as VibeCardType } from '@/utils/supabase'

const cardTypeConfig = {
  concept: {
    label: 'CONCEPT',
    color: 'from-purple-500/20 to-violet-600/20',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
    glow: 'hover:shadow-[0_0_40px_rgba(168,85,247,0.2)]',
  },
  quote: {
    label: 'QUOTE',
    color: 'from-amber-500/20 to-orange-600/20',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    glow: 'hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]',
  },
  tip: {
    label: 'TIP',
    color: 'from-green-500/20 to-emerald-600/20',
    border: 'border-green-500/30',
    badge: 'bg-green-500/20 text-green-300 border-green-400/30',
    glow: 'hover:shadow-[0_0_40px_rgba(16,185,129,0.2)]',
  },
  fact: {
    label: 'FACT',
    color: 'from-cyan-500/20 to-teal-600/20',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
    glow: 'hover:shadow-[0_0_40px_rgba(34,211,238,0.2)]',
  },
  summary: {
    label: 'SUMMARY',
    color: 'from-pink-500/20 to-rose-600/20',
    border: 'border-pink-500/30',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    glow: 'hover:shadow-[0_0_40px_rgba(236,72,153,0.2)]',
  },
}

interface VibeCardProps {
  card: Omit<VibeCardType, 'id' | 'document_id' | 'created_at'>
  index: number
  onQuiz?: () => void
}

export default function VibeCard({ card, index, onQuiz }: VibeCardProps) {
  const config = cardTypeConfig[card.card_type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: index * 0.08, 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`
        relative rounded-2xl p-5
        bg-gradient-to-br ${config.color}
        border ${config.border}
        backdrop-blur-glass
        shadow-glass
        ${config.glow}
        transition-shadow duration-300
        overflow-hidden
        cursor-default
      `}
    >
      {/* Background mesh */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 blur-xl" />
      </div>

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{card.emoji}</span>
            <span className={`
              text-xs font-mono font-bold tracking-widest px-2 py-0.5 
              rounded-md border ${config.badge}
            `}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/40 font-mono">
            <span className="text-yellow-400">⚡</span>
            <span>+{card.vibe_points}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-white text-base mb-2 leading-tight">
          {card.title}
        </h3>

        {/* Content */}
        <p className="text-white/70 text-sm leading-relaxed font-body">
          {card.content}
        </p>

        {/* Footer: tags + quiz button */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <div className="flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-body"
              >
                #{tag}
              </span>
            ))}
          </div>

          {onQuiz && (
            <button
              onClick={onQuiz}
              className="text-xs font-mono font-bold text-white/60 hover:text-white
                         transition-colors px-3 py-1 rounded-lg
                         border border-white/10 hover:border-white/30
                         hover:bg-white/5"
            >
              QUIZ ME →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
