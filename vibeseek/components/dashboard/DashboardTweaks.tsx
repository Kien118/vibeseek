'use client'

import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { type DashboardTweaks, type AccentKey, type DensityKey, type LayoutKey, saveTweaks, ACCENT_HEX } from '@/utils/dashboard-tweaks'

interface Props {
  tweaks: DashboardTweaks
  onChange: (next: DashboardTweaks) => void
}

const ACCENT_LABELS: Record<AccentKey, string> = {
  sunflower: 'Sun',
  terracotta: 'Terra',
  lapis: 'Lapis',
  sage: 'Sage',
}

const ACCENT_SWATCHES: Record<AccentKey, string> = {
  sunflower: '#F5B83E',
  terracotta: '#D96C4F',
  lapis: '#5B89B0',
  sage: '#7A9B7E',
}

export default function DashboardTweaksPanel({ tweaks, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply accent CSS vars to dashboard root (F-6)
  useEffect(() => {
    if (!mounted) return
    const root = document.querySelector('.dashboard-shell') as HTMLElement | null
    if (!root) return
    const a = ACCENT_HEX[tweaks.accent]
    root.style.setProperty('--accent', a.v)
    root.style.setProperty('--accent-soft', a.soft)
    root.style.setProperty('--accent-deep', a.deep)
    root.style.setProperty('--accent-rgb', a.rgb)
  }, [tweaks.accent, mounted])

  if (!mounted) return null

  const update = <K extends keyof DashboardTweaks>(key: K, value: DashboardTweaks[K]) => {
    const next = { ...tweaks, [key]: value }
    saveTweaks(next)
    onChange(next)
  }

  const btnBase = 'flex-1 px-2 py-1.5 text-[11.5px] rounded-lg border border-paper-cream/12 bg-paper-cream/3 text-paper-soft font-medium hover:border-paper-cream/25 transition'
  const btnActive = 'bg-sunflower/18 border-sunflower text-sunflower font-bold'

  return (
    <>
      {/* Gear button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-28 z-50 w-10 h-10 rounded-full glass border border-paper-cream/10 grid place-items-center text-paper-cream/70 hover:text-paper-cream transition"
        aria-label="Dashboard tweaks"
      >
        <Settings2 size={18} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-50 w-64 p-4 glass rounded-2xl border border-paper-cream/14 shadow-2xl space-y-4">
          <div>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wider">Tweaks</p>
            <h5 className="font-display font-bold text-paper-cream text-sm">Dashboard controls</h5>
          </div>

          {/* Accent */}
          <div>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wider mb-1.5">Accent</p>
            <div className="flex gap-1.5">
              {(Object.keys(ACCENT_LABELS) as AccentKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => update('accent', key)}
                  className={`${btnBase} flex items-center gap-1 ${tweaks.accent === key ? btnActive : ''}`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: ACCENT_SWATCHES[key] }}
                  />
                  {ACCENT_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wider mb-1.5">Density</p>
            <div className="flex gap-1.5">
              {(['cozy', 'compact'] as DensityKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => update('density', key)}
                  className={`${btnBase} ${tweaks.density === key ? btnActive : ''}`}
                >
                  {key === 'cozy' ? 'Cozy' : 'Compact'}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wider mb-1.5">Layout</p>
            <div className="flex gap-1.5">
              {(['split', 'feed'] as LayoutKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => update('layout', key)}
                  className={`${btnBase} ${tweaks.layout === key ? btnActive : ''}`}
                >
                  {key === 'split' ? 'Split' : 'Feed 3-col'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
