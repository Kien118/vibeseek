'use client'

import { motion } from 'framer-motion'

interface Props {
  text: string
  charDelay?: number
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'div'
}

/**
 * P-507: Apple Vision Pro-style text reveal. Each char fades+translates in,
 * staggered by `charDelay` (default 30ms). Respects prefers-reduced-motion
 * via framer-motion's native handling.
 */
export default function TextReveal({ text, charDelay = 30, className, as = 'span' }: Props) {
  const Tag = motion[as] as typeof motion.span
  const chars = Array.from(text)

  return (
    <Tag className={className} aria-label={text}>
      {chars.map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: (i * charDelay) / 1000,
            duration: 0.3,
            ease: 'easeOut',
          }}
          aria-hidden="true"
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char}
        </motion.span>
      ))}
    </Tag>
  )
}
