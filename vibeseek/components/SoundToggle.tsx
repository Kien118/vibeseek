'use client'

import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundEnabled, setSoundEnabled, playClick } from '@/utils/sounds'

/**
 * P-511 item 11: floating toggle button for sound on/off.
 * Bottom-right corner (next to VibePointsBadge top-right).
 * Default OFF per design doc "Gen Z rất ghét auto-sound".
 */
export default function SoundToggle() {
  const [enabled, setEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setEnabled(isSoundEnabled())
    setMounted(true)
  }, [])

  if (!mounted) return null

  function toggle() {
    const next = !enabled
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playClick() // feedback on turn-on
  }

  return (
    <button
      onClick={toggle}
      aria-label={enabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full
        flex items-center justify-center
        border border-paper-cream/10 bg-ink-surface/80 backdrop-blur
        hover:bg-ink-elevated text-paper-cream/70 hover:text-paper-cream
        btn-polish"
    >
      {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  )
}
