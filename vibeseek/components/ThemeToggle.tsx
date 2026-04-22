'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/**
 * P-511 item 12: dark/light mode toggle v1.
 * v1 scope: toggle UI exists + data-theme attribute swaps + CSS vars respond.
 * Full per-component theming deferred (demo stays dark-default).
 * Persists to localStorage.
 */
const STORAGE_KEY = 'vibeseek:theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const next = saved === 'light' ? 'light' : 'dark'
      setTheme(next)
      document.documentElement.setAttribute('data-theme', next)
    } catch {
      // ignore
    }
    setMounted(true)
  }, [])

  if (!mounted) return null

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Chuyển chế độ sáng' : 'Chuyển chế độ tối'}
      className="fixed bottom-4 right-16 z-50 w-10 h-10 rounded-full
        flex items-center justify-center
        border border-paper-cream/10 bg-ink-surface/80 backdrop-blur
        hover:bg-ink-elevated text-paper-cream/70 hover:text-paper-cream
        btn-polish"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
