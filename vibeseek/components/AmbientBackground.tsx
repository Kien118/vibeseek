'use client'

import { motion } from 'framer-motion'

/**
 * P-505: Global ambient background layer.
 * - 3 drifting color orbs (sunflower + terracotta + sage) with slow parallax drift
 * - Dot-grid overlay pattern (radial mask fades at edges)
 * - Fixed behind content, pointer-events: none, z-index: 0
 *
 * Mounted once in app/layout.tsx. Pure visual — no state, no interactivity.
 */
export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Orb 1 — sunflower, top-left, slow drift */}
      <motion.div
        className="absolute w-[42vw] h-[42vw] rounded-full blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--color-sunflower) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orb 2 — terracotta, bottom-right, slower drift */}
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full blur-3xl opacity-15"
        style={{
          background: 'radial-gradient(circle, var(--color-terracotta) 0%, transparent 70%)',
          bottom: '-15%',
          right: '-15%',
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 40, -20, 0],
        }}
        transition={{
          duration: 36,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orb 3 — sage accent, center-ish, different phase */}
      <motion.div
        className="absolute w-[30vw] h-[30vw] rounded-full blur-3xl opacity-10"
        style={{
          background: 'radial-gradient(circle, var(--color-sage) 0%, transparent 70%)',
          top: '40%',
          left: '50%',
        }}
        animate={{
          x: [0, 30, -40, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 42,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Dot-grid overlay — masked to fade at edges */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-paper) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
    </div>
  )
}
