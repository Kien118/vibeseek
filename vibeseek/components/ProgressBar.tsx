'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number // 0–100
  label?: string
  variant?: 'purple' | 'cyan' | 'rainbow'
  showPercentage?: boolean
}

const variantStyles = {
  purple: 'from-[#D96C4F] to-[#9B5675]',
  cyan: 'from-[#5B89B0] to-teal-500',
  rainbow: 'from-[#D96C4F] via-[#F5B83E] to-[#5B89B0]',
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
            <span className="text-sm font-mono text-[#F5EFE4]/60">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-mono font-bold text-[#F5EFE4]">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="h-2 w-full bg-[#F5EFE4]/10 rounded-full overflow-hidden border border-[#F5EFE4]/5">
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
