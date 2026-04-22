'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface GlowButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'purple' | 'cyan' | 'pink'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  type?: 'button' | 'submit'
}

const variantStyles = {
  purple: {
    bg: 'from-[#D96C4F] to-[#9B5675]',
    glow: 'shadow-[0_0_30px_rgba(217,108,79,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(217,108,79,0.7)]',
    border: 'border-[#D96C4F]/30',
  },
  cyan: {
    bg: 'from-[#5B89B0] to-teal-600',
    glow: 'shadow-[0_0_30px_rgba(91,137,176,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(91,137,176,0.7)]',
    border: 'border-[#5B89B0]/30',
  },
  pink: {
    bg: 'from-[#F5B83E] to-[#E0A535]',
    glow: 'shadow-[0_0_30px_rgba(245,184,62,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(245,184,62,0.7)]',
    border: 'border-[#F5B83E]/30',
  },
}

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export default function GlowButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'purple',
  size = 'md',
  className = '',
  type = 'button',
}: GlowButtonProps) {
  const v = variantStyles[variant]
  const s = sizeStyles[size]

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      className={`
        relative inline-flex items-center justify-center gap-2
        font-display font-semibold text-[#F5EFE4] rounded-xl
        bg-gradient-to-r ${v.bg}
        border ${v.border}
        ${v.glow} ${v.hover}
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
        overflow-hidden
        ${s} ${className}
      `}
    >
      {/* Shimmer effect */}
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F5EFE4]/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />

      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-[#F5EFE4]/30 border-t-[#F5EFE4] rounded-full animate-spin" />
          <span>Processing...</span>
        </>
      ) : children}
    </motion.button>
  )
}
