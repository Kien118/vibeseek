'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  trigger: boolean
  origin?: { x: number; y: number }
}

/**
 * P-508: Fire confetti burst when `trigger` flips true.
 * Sunflower + sage + terracotta palette, 30 particles, ~1.2s duration.
 * Respects prefers-reduced-motion.
 */
export default function Confetti({ trigger, origin = { x: 0.5, y: 0.3 } }: Props) {
  useEffect(() => {
    if (!trigger) return
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    confetti({
      particleCount: 30,
      spread: 70,
      startVelocity: 45,
      ticks: 120,
      origin,
      colors: ['#F5B83E', '#7A9B7E', '#D96C4F', '#FFCE5E'],
      scalar: 1.1,
      gravity: 1.2,
    })
  }, [trigger, origin])

  return null
}
