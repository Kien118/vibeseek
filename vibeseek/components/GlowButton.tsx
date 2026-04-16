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
    bg: 'from-purple-600 to-violet-700',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(168,85,247,0.7)]',
    border: 'border-purple-500/30',
  },
  cyan: {
    bg: 'from-cyan-500 to-teal-600',
    glow: 'shadow-[0_0_30px_rgba(34,211,238,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(34,211,238,0.7)]',
    border: 'border-cyan-400/30',
  },
  pink: {
    bg: 'from-pink-500 to-rose-600',
    glow: 'shadow-[0_0_30px_rgba(236,72,153,0.5)]',
    hover: 'hover:shadow-[0_0_50px_rgba(236,72,153,0.7)]',
    border: 'border-pink-500/30',
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
        font-display font-semibold text-white rounded-xl
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
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
      
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Processing...</span>
        </>
      ) : children}
    </motion.button>
  )
}
