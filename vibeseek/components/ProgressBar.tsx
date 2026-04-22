'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number // 0–100
  label?: string
  variant?: 'purple' | 'cyan' | 'rainbow'
  showPercentage?: boolean
}

const variantStyles = {
  purple: 'from-terracotta to-plum',
  cyan: 'from-lapis to-teal-500',
  rainbow: 'from-terracotta via-sunflower to-lapis',
}

const glowStyles = {
  purple: 'shadow-[0_0_10px_rgba(217,108,79,0.8)]',
  cyan: 'shadow-[0_0_10px_rgba(91,137,176,0.8)]',
  rainbow: 'shadow-[0_0_10px_rgba(245,184,62,0.8)]',
}

export default function ProgressBar({
  progress,
  label,
  variant = 'purple',
  showPercentage = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className="w-full space-y-2">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center">
          {label && (
            <span className="text-sm font-mono text-paper-cream/60">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-mono font-bold text-paper-cream">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="h-2 w-full bg-paper-cream/10 rounded-full overflow-hidden border border-paper-cream/5">
        {/* Fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${variantStyles[variant]} relative`}
        >
          {/* Glow tip */}
          <span
            className={`
              absolute right-0 top-1/2 -translate-y-1/2
              w-3 h-3 rounded-full
              bg-gradient-to-r ${variantStyles[variant]}
              ${glowStyles[variant]}
            `}
          />
        </motion.div>
      </div>
    </div>
  )
}
