export type AccentKey = 'sunflower' | 'terracotta' | 'lapis' | 'sage'
export type DensityKey = 'cozy' | 'compact'
export type LayoutKey = 'split' | 'feed'

export interface DashboardTweaks {
  accent: AccentKey
  density: DensityKey
  layout: LayoutKey
}

export const DEFAULT_TWEAKS: DashboardTweaks = {
  accent: 'sunflower',
  density: 'cozy',
  layout: 'split',
}

const STORAGE_KEY = 'vibeseek:dashboard-tweaks'

export function loadTweaks(): DashboardTweaks {
  if (typeof window === 'undefined') return DEFAULT_TWEAKS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TWEAKS
    const parsed = JSON.parse(raw)
    return {
      accent: ['sunflower', 'terracotta', 'lapis', 'sage'].includes(parsed.accent) ? parsed.accent : DEFAULT_TWEAKS.accent,
      density: ['cozy', 'compact'].includes(parsed.density) ? parsed.density : DEFAULT_TWEAKS.density,
      layout: ['split', 'feed'].includes(parsed.layout) ? parsed.layout : DEFAULT_TWEAKS.layout,
    }
  } catch {
    return DEFAULT_TWEAKS
  }
}

export function saveTweaks(t: DashboardTweaks): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  } catch {}
}

export const ACCENT_HEX: Record<AccentKey, { v: string; soft: string; deep: string; rgb: string }> = {
  sunflower:  { v: '#F5B83E', soft: '#FFCE5E', deep: '#C48920', rgb: '245 184 62' },
  terracotta: { v: '#D96C4F', soft: '#E89478', deep: '#B5573D', rgb: '217 108 79' },
  lapis:      { v: '#5B89B0', soft: '#88A9C5', deep: '#3F6788', rgb: '91 137 176' },
  sage:       { v: '#7A9B7E', soft: '#9ABDA0', deep: '#4F6953', rgb: '122 155 126' },
}
