'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import type { VibeCard as VibeCardType } from '@/utils/supabase'

const cardTypeConfig = {
  concept: {
    label: 'CONCEPT',
    color: 'from-terracotta/20 to-plum/20',
    border: 'border-terracotta/30',
    badge: 'bg-terracotta/20 text-terracotta border-terracotta/30',
    glow: 'hover:shadow-[0_0_40px_rgba(217,108,79,0.2)]',
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
    color: 'from-sage/20 to-emerald-600/20',
    border: 'border-sage/30',
    badge: 'bg-sage/20 text-sage border-sage/30',
    glow: 'hover:shadow-[0_0_40px_rgba(122,155,126,0.2)]',
  },
  fact: {
    label: 'FACT',
    color: 'from-lapis/20 to-teal-600/20',
    border: 'border-lapis/30',
    badge: 'bg-lapis/20 text-lapis-soft border-lapis/30',
    glow: 'hover:shadow-[0_0_40px_rgba(91,137,176,0.2)]',
  },
  summary: {
    label: 'SUMMARY',
    color: 'from-sunflower/20 to-sunflower-deep/20',
    border: 'border-sunflower/30',
    badge: 'bg-sunflower/20 text-sunflower border-sunflower/30',
    glow: 'hover:shadow-[0_0_40px_rgba(245,184,62,0.2)]',
  },
}

interface VibeCardProps {
  card: Omit<VibeCardType, 'id' | 'document_id' | 'created_at'>
  index: number
  onQuiz?: () => void
}

export default function VibeCard({ card, index, onQuiz }: VibeCardProps) {
  const config = cardTypeConfig[card.card_type]

  // P-511 item 9: cursor parallax tilt (desktop only — graceful no-op on touch
  // because pointer events won't fire without fine pointer). ±4deg range.
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), { stiffness: 300, damping: 30 })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 1000 }}
      className={`
        draggable
        relative rounded-2xl p-5
        bg-gradient-to-br ${config.color}
        border ${config.border}
        backdrop-blur-glass
        shadow-glass
        ${config.glow}
        transition-shadow duration-300
        overflow-hidden
      `}
    >
      {/* Background mesh */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-paper-cream/5 blur-xl" />
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
          <div className="flex items-center gap-1 text-xs text-paper-cream/40 font-mono">
            <span className="text-sunflower">⚡</span>
            <span>+{card.vibe_points}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-paper-cream text-base mb-2 leading-tight">
          {card.title}
        </h3>

        {/* Content */}
        <p className="text-paper-cream/70 text-sm leading-relaxed font-body">
          {card.content}
        </p>

        {/* Footer: tags + quiz button */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-paper-cream/10">
          <div className="flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-paper-cream/10 text-paper-cream/50 font-body"
              >
                #{tag}
              </span>
            ))}
          </div>

          {onQuiz && (
            <button
              onClick={onQuiz}
              className="text-xs font-mono font-bold text-paper-cream/60 hover:text-paper-cream
                         transition-colors px-3 py-1 rounded-lg
                         border border-paper-cream/10 hover:border-paper-cream/30
                         hover:bg-paper-cream/5"
            >
              QUIZ ME →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
